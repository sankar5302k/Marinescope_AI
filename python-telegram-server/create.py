# create_index.py
from pymongo import MongoClient
import pprint

# --- CONFIGURE THIS ---
MONGO_URI = "mongodb://localhost:27017/"
MONGO_DB = "wod_data_db"
MONGO_COLLECTION = "cast_records"
# ---

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
collection = db[MONGO_COLLECTION]

# --- 1. VERIFY YOUR DOCUMENT STRUCTURE ---
print("--- Checking a sample document from your collection... ---")
try:
    sample_doc = collection.find_one()
    if sample_doc:
        print("Here is the structure of one of your documents:")
        pprint.pprint(sample_doc)
        print("\n---")
        print("Please CHECK if the field paths below are correct based on the sample.")
        print("For example, for 'country', the path should match the structure.")
    else:
        print("Your collection is empty. No index can be created.")
        exit()
except Exception as e:
    print(f"Could not retrieve a sample document. Error: {e}")
    exit()

# --- 2. DEFINE THE FIELDS TO INDEX ---
# IMPORTANT: Adjust these paths if they don't match your sample document!
# The current paths assume your data is nested like: { "raw": { "cast_data": { "country": "...", "Recorder": "..." } } }
fields_to_index = [
    ("raw.cast_data.country", "text"),
    ("raw.cast_data.Recorder", "text"),
    ("raw.cast_data.dataset", "text")
]

# --- 3. CREATE THE INDEX ---
try:
    print(f"\nAttempting to create a text index on: {[field[0] for field in fields_to_index]}")
    collection.create_index(fields_to_index)
    print("\n✅ Success! Text index was created or already exists.")
    print("You can now run your main bot script (tele.py).")
except Exception as e:
    print(f"\n❌ An error occurred while creating the index: {e}")