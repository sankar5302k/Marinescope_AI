# Marinescope_AI

An AI-driven marine biodiversity platform that integrates data ingestion, processing, and visualization
for real-time insights.
Our solution integrates automated data ingestion, AI-driven processing, and interactive visualization into a single, scalable
ecosystem.
It enables real-time marine biodiversity monitoring and
updation support.

## Repository Overview
This Project consist of the 6 main server System.

# Server 1 - Ingestion tool 
- This server is built on the Prefect Library Python.
- The prefect alows us to run the Task and Flows efficently which helps in collects oceanographic, biological, and sensor data from APIs and external sources.
- Centralized dashboard to configure and manage data flows.
``` Setup and run for Prefect
cd ingestion-tool-server
python -m venv venv
venv\Scripts\activate
pip install --upgrade pip
pip install prefect
python app.py
```
# Server 2 - Python preprocessor Backend 
- This preprocessor server is to Cleans, validates, and processes heterogeneous data (CSV, NetCDF, sensor stream).
- Metadata-based clustering for efficient organization and retrieval.
- This preprocessor server in implemented in core python ML library which is Pytorch and the logic is impplemented using ARIMA MODEL, ARIMA MODEL, Time series.
``` Setup and Run
cd python-preprocessor-backend
python preprocessor_server.py
```

# Server 3 - Frontend NextJS 
- The core frontend is implemented in React + NextJS for the UI and Interactive, efficent repository management.
- The repository is connected to the Server 1 and Server 2.
```bash or Powershell
npm install
npm run dev
```

# Server 4 - MongoDB server
- The MongoDB local is used for DB as of now.
- The all Respository files and JSON, csv, Netcdf is stored herr.
- After selection we will intergrate cloud MongoDB.

# Server 5 - ML server 
- The core ML is implemented for the Insights and Data Visualization and predictions.
- The RAG + GEMINI is integrated for the Query the chatbot regarding the Insights.

# Server 6 - Telegram server
- The implementation of the Telegram chat service using python
- This server is implemented to access and get insights from the telegram chatbot securely.
```
cd python-telegram-server
pip install -r requirements.txt
python create.py
python tele.py
```

# Containerization
This multi server will be managed by the containers by using docker.
Docker allows us to build and ship the application to make it as image file. So it can be easily deployed in Cloud platforms.

# Telegram service 
Checkout the bot here : http://t.me/Marinescope_AI_bot
1. Use `/listfiles` to see all records.
2. Use `/focus <file_id>` to load a record into memory.
3. Ask the questions about that specific record.
4. Use `/unfocus` to clear the memory.

You can also `/download <file_id>` at any time.
## Solution Overview

**Marinescope_AI_clone** is a unified, scalable ecosystem designed to automate the collection, processing, and visualization of marine biodiversity data. Its main features include:

- **Automated Data Ingestion:** Collects oceanographic, biological, and sensor data from APIs and user-provided sources. An advanced dashboard pipelines the data and manages data flows.
- **Preprocessing & Clustering:** Cleans, validates, and processes heterogeneous datasets (CSV, NetCDF, sensor streams). Utilizes metadata-based clustering for efficient organization and retrieval.
- **Centralized Repository:** Supports taxonomy, otolith morphology, eDNA data, and WOD (World Ocean Database) data for comprehensive marine research.
- **Real-Time Monitoring & Updates:** Enables continuous marine biodiversity monitoring, with support for updating data and insights.
- **AI-Driven Processing:** Leverages machine learning for automated analysis, clustering, and visualization.
- **Interactive Visualization:** Presents processed data in intuitive dashboards for actionable insights.

## Repository Overview

- **Primary Language:** TypeScript (84.5%)
- **Other Languages:** Python (12%), CSS (3.1%), JavaScript (0.4%)
- **Default Branch:** `main`
- **Public Repository**

## Main Directories & Files

- [`app/`](https://github.com/jothiprakasam/Marinescope_AI_clone/tree/main/app) - Main application code.
- [`components/`](https://github.com/jothiprakasam/Marinescope_AI_clone/tree/main/components) - UI components and shared logic.
- [`hooks/`](https://github.com/jothiprakasam/Marinescope_AI_clone/tree/main/hooks) - Custom React hooks for advanced state and data management.
- [`lib/`](https://github.com/jothiprakasam/Marinescope_AI_clone/tree/main/lib) - Library code and utilities.
- [`public/`](https://github.com/jothiprakasam/Marinescope_AI_clone/tree/main/public) - Static assets.
- [`styles/`](https://github.com/jothiprakasam/Marinescope_AI_clone/tree/main/styles) - CSS and styling files.
- [`ingestion-tool-server/`](https://github.com/jothiprakasam/Marinescope_AI_clone/tree/main/ingestion-tool-server) - Backend server for automated data ingestion.
- [`python-preprocessor-backend/`](https://github.com/jothiprakasam/Marinescope_AI_clone/tree/main/python-preprocessor-backend) - Python backend for preprocessing and clustering.
- [`python-telegram-server/`](https://github.com/jothiprakasam/Marinescope_AI_clone/tree/main/python-telegram-server) - Python backend for Telegram integration.

**Config & Metadata Files:**
- [`package.json`](https://github.com/jothiprakasam/Marinescope_AI_clone/blob/main/package.json) / [`package-lock.json`](https://github.com/jothiprakasam/Marinescope_AI_clone/blob/main/package-lock.json)
- [`pnpm-lock.yaml`](https://github.com/jothiprakasam/Marinescope_AI_clone/blob/main/pnpm-lock.yaml)
- [`tsconfig.json`](https://github.com/jothiprakasam/Marinescope_AI_clone/blob/main/tsconfig.json)
- [`next.config.mjs`](https://github.com/jothiprakasam/Marinescope_AI_clone/blob/main/next.config.mjs)
- [`tailwind.config.js`](https://github.com/jothiprakasam/Marinescope_AI_clone/blob/main/tailwind.config.js)
- [`components.json`](https://github.com/jothiprakasam/Marinescope_AI_clone/blob/main/components.json)
- [`postcss.config.mjs`](https://github.com/jothiprakasam/Marinescope_AI_clone/blob/main/postcss.config.mjs)

## Features

- **Automated Data Ingestion:** Seamlessly collects and pipelines various marine data sources.
- **Preprocessing & Clustering:** Handles data cleaning, validation, and organizes data with metadata-based clustering.
- **Centralized Data Repository:** Stores taxonomy, otolith morphology, eDNA, and WOD data for easy retrieval and research.
- **AI-Powered Analysis:** Applies machine learning for insightful clustering and analysis.
- **Interactive Dashboards:** Visualizes real-time data for actionable marine biodiversity monitoring.
- **Python Microservices:** Supports data preprocessing and integration with platforms like Telegram.
- **Modular Frontend:** Built with reusable components in TypeScript and React.
- **Rapid UI Development:** Uses Tailwind CSS for fast and responsive design.

