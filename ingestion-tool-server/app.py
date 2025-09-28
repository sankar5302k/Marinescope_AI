from prefect import flow, task
import requests
import pandas as pd
import os

@task
def fetch_ocean_weather(api_url: str):
    r = requests.get(api_url)
    r.raise_for_status()
    return r.json()

@task
def transform_ocean_weather(data):
    df = pd.DataFrame(data["hourly"])
    return df

@task
def store_ocean_weather(df, path="data/ocean_weather.csv"):
    os.makedirs("data", exist_ok=True)
    df.to_csv(path, index=False)
    return path

@task
def fetch_ocean_seismic(api_url: str):
    r = requests.get(api_url)
    r.raise_for_status()
    return r.json()

@task
def transform_ocean_seismic(data):
    features = data["features"]
    df = pd.json_normalize(features)
    return df[["properties.mag", "properties.place", "properties.time"]]

@task
def store_ocean_seismic(df, path="data/ocean_seismic.csv"):
    df.to_csv(path, index=False)
    return path


@task
def fetch_gene_data(api_url: str, api_key: str):
    headers = {"Accept": "application/json", "api-key": api_key}
    r = requests.get(api_url, headers=headers)
    r.raise_for_status()
    return r.json()

@task
def transform_gene_data(data):
    df = pd.json_normalize(data)
    return df

@task
def store_gene_data(df, path="data/gene_data.csv"):
    os.makedirs("data", exist_ok=True)
    df.to_csv(path, index=False)
    return path

@task
def upload_file(file_path: str, upload_url: str):
    """
    Upload any file (CSV, NetCDF, etc.) to the given API.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

  
    if file_path.endswith(".csv"):
        mime_type = "text/csv"
    elif file_path.endswith(".nc"):
        mime_type = "application/x-netcdf"
    else:
        mime_type = "application/octet-stream"

    with open(file_path, "rb") as f:
        files = {"file": (os.path.basename(file_path), f, mime_type)}
        response = requests.post(upload_url, files=files)

    response.raise_for_status()
    return response.json()

@flow
def ocean_data_pipeline(ocean_weather_api: str, ocean_seismic_api: str, gene_api_url: str, gene_api_key: str, upload_url: str):

    ocean_weather_raw = fetch_ocean_weather(ocean_weather_api)
    ocean_weather_df = transform_ocean_weather(ocean_weather_raw)
    ocean_weather_csv = store_ocean_weather(ocean_weather_df)
    upload_file(ocean_weather_csv, upload_url)

    ocean_seismic_raw = fetch_ocean_seismic(ocean_seismic_api)
    ocean_seismic_df = transform_ocean_seismic(ocean_seismic_raw)
    ocean_seismic_csv = store_ocean_seismic(ocean_seismic_df)
    upload_file(ocean_seismic_csv, upload_url)

    # Gene Data
    gene_raw = fetch_gene_data(gene_api_url, gene_api_key)
    gene_df = transform_gene_data(gene_raw)
    gene_csv = store_gene_data(gene_df)
    upload_file(gene_csv, upload_url)

    return {
        "weather_csv": ocean_weather_csv,
        "seismic_csv": ocean_seismic_csv,
        "gene_csv": gene_csv
    }


@flow
def upload_pipeline(csv_path: str, nc_path: str, upload_url: str):
    csv_result = upload_file(csv_path, upload_url)
    print("✅ CSV Upload Successful:", csv_result)

    nc_result = upload_file(nc_path, upload_url)
    print("✅ NetCDF Upload Successful:", nc_result)

    return {"csv": csv_result, "nc": nc_result}


# ----------------- Main Runner -----------------
if __name__ == "__main__":
    # 🌊 Pipeline mode
    ocean_weather_api = "https://api.open-meteo.com/v1/forecast?latitude=35&longitude=139&hourly=temperature_2m"
    ocean_seismic_api = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
    gene_api_url = "https://api.ncbi.nlm.nih.gov/datasets/v2/gene/accession/NM_021803.84"
    gene_api_key = "becfdf42318883c1a2e30cc940070a98fe08"
    upload_url = "http://localhost:3000/api/upload"

    print("=== Running Full Ocean Data Pipeline ===")
    print(
        ocean_data_pipeline(
            ocean_weather_api,
            ocean_seismic_api,
            gene_api_url,
            gene_api_key,
            upload_url
        )
    )

    
    csv_path = "ocean.csv"
    nc_path = "ocean_nc.nc"
    print("=== Uploading CSV + NetCDF ===")
    print(upload_pipeline(csv_path, nc_path, upload_url))