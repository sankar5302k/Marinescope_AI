# tele.py
import os
import logging
import json
import io
import google.generativeai as genai
from pymongo import MongoClient
from bson.objectid import ObjectId
from bson import json_util

from telegram import Update, InputFile
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

# --- Configuration ---
TELEGRAM_TOKEN = "8480609402:AAF2JHvSKDxpJGKydD1tiBnfdb_Qc1RsNMY"
MONGO_URI = "mongodb://localhost:27017/"
MONGO_DB = "wod_data_db"
MONGO_COLLECTION = "cast_records"
GEMINI_API_KEY = "AIzaSyCAWND8PsZAPSA5Pc4TOfAZJCjhYIezxwY"
BOT_PASSWORD = "1234" # The password required to access protected commands

# --- Set up logging ---
logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configure Clients ---
try:
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]
    collection = db[MONGO_COLLECTION]
    logger.info("Successfully connected to MongoDB.")
except Exception as e:
    logger.error(f"Error connecting to MongoDB: {e}")
    client = None

try:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-2.5-flash')
    logger.info("Successfully configured Gemini API.")
except Exception as e:
    logger.error(f"Error configuring Gemini API: {e}")
    gemini_model = None


# --- Bot Command Handlers ---

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    welcome_message = (
        f"Hi {user.first_name}! I am your Oceanographic Data Bot. 🤖\n\n"
        "<b>Workflow:</b>\n"
        "1. Authenticate using <code>/password --password </code> to access data commands.\n"
        "2. Use /listfiles to see available records.\n"
        "3. Use /focus <code>&lt;file_id&gt;</code> to load a record into memory for questions.\n"
        "4. Ask questions about the focused record.\n"
        "5. Use /unfocus to clear the memory.\n\n"
        "You can also /download <code>&lt;file_id&gt;</code> at any time after authenticating."
    )
    await update.message.reply_html(welcome_message)

async def password_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles user authentication."""
    try:
        user_password = context.args[0]
        if user_password == BOT_PASSWORD:
            context.user_data['authenticated'] = True
            await update.message.reply_text("✅ Access granted. You can now use /listfiles and /download.")
        else:
            await update.message.reply_text("❌ Incorrect password.")
    except (IndexError, ValueError):
        await update.message.reply_html("<b>Usage:</b> /password <code>&lt;password&gt;</code>")


async def list_files_command(update: Update, context: ContextTypes.DEFAULT_TYPE):

    if not context.user_data.get('authenticated'):
        await update.message.reply_text("🔒 This command requires a password. Please use /password <your_password> first.")
        return

    if not client: return await update.message.reply_text("DB Error.")
    try:

        files = list(collection.find({}, {"_id": 1, "raw.cast_data.country": 1}).limit(15))
        if not files: return await update.message.reply_text("No files found. 📂")

        file_list = []
        for doc in files:
            doc_id = str(doc.get("_id"))
            country = doc.get("raw", {}).get("cast_data", {}).get("country", "N/A")

            country = country.replace('-', '\\-').replace('.', '\\.')
            file_list.append(f"📄 `{doc_id}` \\(Country: {country}\\)")

        files_formatted = "\n".join(file_list)

        response_message = f"*Showing first 15 files:*\n\n{files_formatted}"
        await update.message.reply_markdown_v2(response_message)
    except Exception as e:
        logger.error(f"Error in /listfiles: {e}")
        await update.message.reply_text("Error fetching files.")

async def download_command(update: Update, context: ContextTypes.DEFAULT_TYPE):

    if not context.user_data.get('authenticated'):
        await update.message.reply_text("🔒 This command requires a password. Please use /password <your_password> first.")
        return

    if not client: return await update.message.reply_text("DB Error.")
    try:
        file_id = context.args[0]
        obj_id = ObjectId(file_id)
        document = collection.find_one({"_id": obj_id})
        if document:
            doc_json_str = json_util.dumps(document, indent=4)
            in_memory_file = io.BytesIO(doc_json_str.encode('utf-8'))
            file_to_send = InputFile(in_memory_file, filename=f"{file_id}.json")
            await update.message.reply_document(document=file_to_send)
        else:
            await update.message.reply_text(f"File with ID {file_id} not found.")
    except IndexError:
        await update.message.reply_markdown_v2("⚠️ *Usage:* `/download \\<file\\_id\\>`")
    except Exception as e:
        logger.error(f"Error in /download: {e}")
        await update.message.reply_text("Invalid ID or error.")


async def focus_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Selects a single document to be the conversational context."""
    if not client: return await update.message.reply_text("DB Error.")
    try:
        file_id = context.args[0]
        obj_id = ObjectId(file_id)
        document = collection.find_one({"_id": obj_id}, {"_id": 1})
        if document:
            context.user_data['focused_doc_id'] = file_id
            await update.message.reply_markdown_v2(
                f"✅ *Memory Loaded\\.*\nNow focusing on record: `{file_id}`\\.\n\nYou can now ask me questions about this specific record\\."
            )
        else:
            await update.message.reply_text(f"File with ID {file_id} not found in the database.")
    except IndexError:
        await update.message.reply_markdown_v2("⚠️ *Usage:* `/focus \\<file\\_id\\>`")
    except Exception as e:
        logger.error(f"Error in /focus: {e}")
        await update.message.reply_text("An error occurred. Make sure you provided a valid file ID.")

async def unfocus_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Clears the focused document from the user's context."""
    if 'focused_doc_id' in context.user_data:
        del context.user_data['focused_doc_id']
        await update.message.reply_text("🧠 Memory Cleared.\nI am no longer focused on a specific record. I will now answer questions generally.")
    else:
        await update.message.reply_text("I am not currently focused on any record.")


# --- General Message Handler (Not password protected) ---

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not gemini_model:
        return await update.message.reply_text("AI service not configured.")

    user_query = update.message.text
    await update.message.reply_text("🧠 Thinking...")

    focused_id = context.user_data.get('focused_doc_id')

    if focused_id:
        if not client: return await update.message.reply_text("DB Error.")
        try:
            document = collection.find_one({"_id": ObjectId(focused_id)})
            context_str = json_util.dumps(document, indent=2)
            prompt = (
                "You are an expert assistant for oceanographic data.\n"
                "Answer the user's query based *ONLY* on the single data record provided as context.\n"
                "Do not use any external knowledge. If the context doesn't contain the answer, "
                "state that the information is not available in this specific record.\n\n"
                "--- CONTEXT RECORD ---\n"
                f"{context_str}\n\n"
                "--- USER QUERY ---\n"
                f"{user_query}\n\n"
                "--- ANSWER ---\n"
            )
        except Exception as e:
            logger.error(f"Error retrieving focused doc '{focused_id}': {e}")
            return await update.message.reply_text("Error retrieving the record from the database.")
    else:
        prompt = (
            "You are a helpful general-purpose assistant named MarineBot. Answer the user's query.\n"
            f"User Query: {user_query}"
        )

    try:
        response = await gemini_model.generate_content_async(prompt)
        await update.message.reply_text(response.text)
    except Exception as e:
        logger.error(f"Error during Gemini generation: {e}")
        await update.message.reply_text("Sorry, I encountered an error generating a response.")


def main():
    if not all([TELEGRAM_TOKEN, MONGO_URI, GEMINI_API_KEY]):
        logger.error("FATAL: Missing one or more required configuration values.")
        return

    application = Application.builder().token(TELEGRAM_TOKEN).build()

    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("password", password_command))
    application.add_handler(CommandHandler("listfiles", list_files_command))
    application.add_handler(CommandHandler("download", download_command))
    application.add_handler(CommandHandler("focus", focus_command))
    application.add_handler(CommandHandler("unfocus", unfocus_command))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("Bot is starting... Press Ctrl-C to stop.")
    application.run_polling()

if __name__ == "__main__":
    main()