import os
import json
import re
import csv
import numpy as np
from io import BytesIO, StringIO
from flask import Flask, request, jsonify, send_file
from pymongo import MongoClient
from bson.objectid import ObjectId
from netCDF4 import Dataset
from datetime import datetime
from werkzeug.utils import secure_filename
import logging
# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
# --- Configuration & Initialization ---
# NOTE: Using your specified MongoDB URI.
MONGO_URI = "mongodb://localhost:27017/"
DATABASE_NAME = "wod_data_db"
COLLECTION_NAME = "cast_records"
UPLOAD_FOLDER = 'uploads' # Temporary storage for uploaded files

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Database Connection ---
client = None
collection = None
try:
    client = MongoClient(MONGO_URI)
    client.admin.command('ping') # Test connection
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    print(f"Successfully connected to MongoDB: {MONGO_URI}")
except Exception as e:
    print(f"Could not connect to MongoDB. Ensure it is running: {e}")

# --- Helper Functions (From original converter.py) ---

def convert_numpy_types(obj):
    """Recursively converts numpy data types and arrays to JSON-serializable Python types."""
    if isinstance(obj, (np.floating, np.float32, np.float64)):
        return float(obj)
    elif isinstance(obj, (np.integer, np.int8, np.int16, np.int32, np.int64)):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        if obj.size == 1:
            return convert_numpy_types(obj.item())
        if obj.dtype.kind == 'S':
            return [convert_numpy_types(item) for item in obj]
        return [convert_numpy_types(item) for item in obj.tolist()]
    elif isinstance(obj, (np.str_, str)):
        return str(obj)
    elif isinstance(obj, (np.bytes_, bytes)):
        return obj.decode('utf-8')
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif obj is np.ma.masked or obj is None:
        return None
    return obj

def impute_missing_data(data, method='mean'):
    """Replaces missing values (None or np.nan) in a list or array using mean imputation."""
    if not isinstance(data, (list, np.ndarray)):
        return data
    data_np = np.array(data, dtype=float)

    if method == 'mean':
        mean_value = np.nanmean(data_np)
        if np.isnan(mean_value):
            mean_value = 0
        data_np[np.isnan(data_np)] = mean_value
        return data_np.tolist()
    else:
        return data

# --- Data Source (.nc or .csv) to JSON ---

def parse_netcdf_to_json(nc_file_path):
    """Converts a NetCDF file into a JSON-compatible dictionary, organized by 'casts'."""
    with Dataset(nc_file_path, 'r') as nc:
        # Determine file type
        file_type = nc.getncattr('cdm_data_type') if 'cdm_data_type' in nc.ncattrs() else None
        if file_type is None or file_type == 'Profile':
            if 'pH_obs' in nc.dimensions: file_type = 'PFL'
            elif 'Chlorophyll_obs' in nc.dimensions: file_type = 'CTD'
            elif 'Phosphate_obs' in nc.dimensions: file_type = 'OSD'
            elif 'Salinity_obs' not in nc.dimensions and 'Temperature_obs' in nc.dimensions: file_type = 'XBT'
            elif 'Wind_Speed' in nc.variables: file_type = 'MRB'
            elif 'Ocean_Vehicle' in nc.variables and 'z_obs' in nc.dimensions: file_type = 'APB'
            else: file_type = 'UNKNOWN'

        obs_vars_map = {
            'CTD': ['z', 'Temperature', 'Salinity', 'Oxygen', 'Chlorophyll'],
            'OSD': ['z', 'Temperature', 'Salinity', 'Oxygen', 'Phosphate', 'Silicate', 'Nitrate'],
            'XBT': ['z', 'Temperature'],
            'PFL': ['z', 'Temperature', 'Salinity', 'Oxygen', 'Nitrate', 'Chlorophyll', 'pH'],
            'MRB': ['z', 'Temperature', 'Salinity'],
            'APB': ['z', 'Temperature', 'Salinity'],
            'UNKNOWN': []
        }
        obs_variables = obs_vars_map.get(file_type, [])
        
        num_casts = nc.dimensions['casts'].size
        global_attrs = {attr: convert_numpy_types(nc.getncattr(attr)) for attr in nc.ncattrs()}
        
        all_casts = []
        final_json = {"global_attributes": global_attrs}

        if file_type in ['PFL'] and 'Primary_Investigator' in nc.variables:
            pi_data = {
                "Primary_Investigator": convert_numpy_types(nc.variables['Primary_Investigator'][:]),
                "Primary_Investigator_VAR": convert_numpy_types(nc.variables['Primary_Investigator_VAR'][:])
            }
            final_json["primary_investigator_info"] = pi_data
        
        for i in range(num_casts):
            cast_record = {}
            
            for var_name, var in nc.variables.items():
                if 'casts' in var.dimensions and var_name not in ['Primary_Investigator_VAR', 'Primary_Investigator']:
                    data = convert_numpy_types(var[i])
                    if var.dtype.kind == 'S':
                        data = b"".join(var[i]).decode('utf-8').strip()
                    if data is not None and data is not np.ma.masked:
                        cast_record[var_name] = data
            
            for var_name in obs_variables:
                if f'{var_name}_row_size' in nc.variables:
                    row_size_var = nc.variables[f'{var_name}_row_size']
                    
                    row_size_val = row_size_var[i]
                    if isinstance(row_size_val, np.ma.core.MaskedConstant) or row_size_val is np.ma.masked:
                         row_size = 0
                    else:
                         row_size = int(row_size_val.item())

                    row_sizes_slice = nc.variables[f'{var_name}_row_size'][:i]
                    safe_row_sizes = []
                    for val in row_sizes_slice:
                         if isinstance(val, np.ma.core.MaskedConstant) or val is np.ma.masked:
                             safe_row_sizes.append(0)
                         else:
                             safe_row_sizes.append(int(val.item()))

                    start_idx = sum(safe_row_sizes)
                    end_idx = start_idx + row_size

                    obs_data = convert_numpy_types(nc.variables[var_name][start_idx:end_idx])
                    obs_data = impute_missing_data(obs_data)
                    cast_record[var_name] = obs_data

                    for suffix in ['_sigfigs', '_WODflag']:
                        flag_var_name = f'{var_name}{suffix}'
                        if flag_var_name in nc.variables:
                             flag_data = convert_numpy_types(nc.variables[flag_var_name][start_idx:end_idx])
                             cast_record[flag_var_name] = flag_data
            
            all_casts.append(cast_record)
        
        final_json['casts'] = all_casts
        return final_json

def parse_wod_csv_to_json(file_path):
    """Parses a World Ocean Database CSV file into a structured dictionary (JSON format)."""
    casts = []
    current_cast = None
    variables = []
    measurements = []
    
    with open(file_path, 'r') as file:
        content = file.read()
    
    cast_sections = content.split('#--------------------------------------------------------------------------------')
    
    for section in cast_sections:
        section = section.strip()
        if not section: continue
            
        lines = section.split('\n')
        csv_content = StringIO('\n'.join(lines))
        reader = csv.reader(csv_content)
        
        current_section = None
        
        for row in reader:
            if not row or not row[0]: continue
                
            if row[0].strip() == 'CAST':
                if current_cast:
                    if measurements and variables:
                        current_cast['measurements'] = [
                            {variables[i]: measurements[i] for i in range(len(variables))}
                            for measurements in measurements
                        ]
                    casts.append(current_cast)
                
                current_cast = {
                    'cast_number': row[2].strip(),
                    'metadata': {},
                    'measurements': []
                }
                measurements = []
                current_section = 'header'
                continue
            
            if row[0].strip() == 'METADATA': current_section = 'metadata'; continue
            if row[0].strip() == 'VARIABLES':
                current_section = 'variables'
                variables = [re.sub(r'\(.*\)', '', r).strip() for r in row[1::3] if r.strip()]
                continue
            if row[0].strip() == 'UNITS': current_section = 'units'; continue
            if row[0].strip() == 'Prof-Flag': current_section = 'prof_flag'; continue
            if row[0].strip() == 'END OF VARIABLES SECTION': current_section = None; continue
                
            if current_section == 'header':
                if row[0].strip():
                    current_cast[row[0].strip()] = row[2].strip() if row[2].strip() else None
            elif current_section == 'metadata':
                if row[0].strip():
                    current_cast['metadata'][row[0].strip()] = row[2].strip() if row[2].strip() else None
            elif current_section == 'variables' or current_section == 'prof_flag' or current_section == 'units':
                continue
            else:
                if row[0].strip() and row[0][0].isdigit():
                    measurement = []
                    for i in range(1, len(row), 3):
                        value = row[i].strip()
                        try:
                            if value in ['---', '---*---']:
                                measurement.append(None)
                            else:
                                val = float(value) if '.' in value else int(value)
                                measurement.append(val)
                        except ValueError:
                            measurement.append(value)
                    
                    measurement = impute_missing_data(measurement)
                    measurements.append(measurement)
    
    if current_cast:
        if measurements and variables:
            transposed_measurements = list(zip(*measurements))
            cast_data = {k: v for k, v in current_cast.items() if k not in ['measurements', 'metadata']}
            
            for i, var_name in enumerate(variables):
                if i < len(transposed_measurements):
                    cast_data[var_name] = list(transposed_measurements[i])
                    
            casts.append(cast_data)

    return {"casts": casts, "global_attributes": {"source": "WOD CSV File"}}


# --- JSON to Data Source (.nc or .csv) ---

def get_nc_structure_from_json(json_data):
    """Infers NetCDF dimensions and variable types from the JSON data."""
    casts = json_data.get('casts', [])
    if not casts: return None
    
    num_casts = len(casts)
    obs_dims = {}
    obs_var_names = ['z', 'Temperature', 'Salinity', 'Oxygen', 'Phosphate', 'Silicate', 'Nitrate', 'Chlorophyll', 'pH']
    
    for var_name in obs_var_names:
        row_size_key = f'{var_name}_row_size'
        total_obs = sum(int(c.get(row_size_key, 0)) for c in casts if c.get(row_size_key) is not None)
        if total_obs > 0:
            obs_dims[var_name] = total_obs
            
    all_vars = {}
    first_cast = casts[0]
    
    for key, value in first_cast.items():
        is_obs_or_flag = any(key.startswith(v) and (key.endswith(('_sigfigs', '_WODflag')) or key == v) for v in obs_var_names)
        
        if not is_obs_or_flag:
            if isinstance(value, str):
                dtype = 'S1' 
            elif isinstance(value, int):
                dtype = 'i4'
            elif isinstance(value, float):
                dtype = 'f4'
            else:
                 dtype = 'f4'
                
            dims = ('casts',)
            if isinstance(value, str):
                if 'strnlen' in key.lower(): dims = ('casts', 'strnlen')
                elif 'strnlensmall' in key.lower(): dims = ('casts', 'strnlensmall')
                else: dims = ('casts', 'strnlensmall')
            
            all_vars[key] = {'dims': dims, 'dtype': dtype, 'is_obs': False}

    for var_name in obs_dims:
        all_vars[var_name] = {'dims': (f'{var_name}_obs',), 'dtype': 'f4', 'is_obs': True}
        
        if f'{var_name}_sigfigs' in first_cast: all_vars[f'{var_name}_sigfigs'] = {'dims': (f'{var_name}_obs',), 'dtype': 'i1', 'is_obs': True}
        if f'{var_name}_WODflag' in first_cast: all_vars[f'{var_name}_WODflag'] = {'dims': (f'{var_name}_obs',), 'dtype': 'i1', 'is_obs': True}
             
    if 'primary_investigator_info' in json_data:
        pi_info = json_data['primary_investigator_info']
        if 'Primary_Investigator' in pi_info: all_vars['Primary_Investigator'] = {'dims': ('numberofpis', 'strnlen'), 'dtype': 'S1', 'is_obs': False}
        if 'Primary_Investigator_VAR' in pi_info: all_vars['Primary_Investigator_VAR'] = {'dims': ('numberofpis', 'strnlensmall'), 'dtype': 'S1', 'is_obs': False}
             
    return {'num_casts': num_casts, 'obs_dims': obs_dims, 'variables': all_vars}

def json_to_netcdf_converter(json_data, output_file_path):
    structure = get_nc_structure_from_json(json_data)
    if not structure:
        raise ValueError("JSON data is empty or missing 'casts' array for NetCDF conversion.")

    casts = json_data.get('casts', [])
    
    with Dataset(output_file_path, 'w', format='NETCDF4') as nc:
        # 1. Define Dimensions
        nc.createDimension('casts', structure['num_casts'])
        nc.createDimension('strnlen', 170)
        nc.createDimension('strnlensmall', 40)
        
        for var_name, size in structure['obs_dims'].items():
            nc.createDimension(f'{var_name}_obs', size)
            
        if 'numberofpis' in structure['variables']:
            pi_data = json_data.get('primary_investigator_info', {}).get('Primary_Investigator', [])
            pi_dim_size = len(pi_data) if pi_data and isinstance(pi_data, list) else 0
            nc.createDimension('numberofpis', pi_dim_size)

        # 2. Define Variables
        for var_name, var_info in structure['variables'].items():
            dtype = var_info['dtype']
            fill_val = None
            if dtype.startswith('f'):
                fill_val = -9999.0
            elif dtype.startswith('i'):
                fill_val = -127 if dtype == 'i1' else -9999
            
            nc.createVariable(var_name, dtype, var_info['dims'], fill_value=fill_val)

        # 3. Write Global Attributes
        for attr, value in json_data.get('global_attributes', {}).items():
            if value is not None:
                nc.setncattr(attr, value)
        
        # 4. Write Data
        logger.debug("Writing data to NetCDF variables")
        if 'primary_investigator_info' in json_data:
            pi_info = json_data['primary_investigator_info']
            if 'Primary_Investigator' in pi_info and 'Primary_Investigator' in nc.variables:
                nc_var = nc.variables['Primary_Investigator']
                pi_data = pi_info['Primary_Investigator']
                for i, char_list in enumerate(pi_data):
                    nc_var[i] = [c.encode('ascii') for c in char_list]
            
            if 'Primary_Investigator_VAR' in pi_info and 'Primary_Investigator_VAR' in nc.variables:
                nc_var = nc.variables['Primary_Investigator_VAR']
                pi_var_data = pi_info['Primary_Investigator_VAR']
                for i, char_list in enumerate(pi_var_data):
                    nc_var[i] = [c.encode('ascii') for c in char_list]

        obs_indices = {var_name: 0 for var_name in structure['obs_dims']}
        
        for i, cast in enumerate(casts):
            for var_name, var_info in structure['variables'].items():
                if not var_info['is_obs'] and var_name in cast:
                    nc_var = nc.variables[var_name]
                    value = cast[var_name]
                    logger.debug(f"Writing non-obs variable {var_name}: {value}")
                    
                    if var_info['dims'] == ('casts',):
                        if isinstance(value, (str, int, float, bool)):
                            if isinstance(value, str) and dtype.startswith(('f', 'i')):
                                try:
                                    value = float(value) if dtype.startswith('f') else int(value)
                                except ValueError:
                                    logger.warning(f"Skipping invalid value for {var_name}: {value}")
                                    continue
                            nc_var[i] = value
                        else:
                            logger.warning(f"Skipping invalid value for {var_name}: {value}")
                    else:
                        max_len = nc_var.shape[1]
                        if isinstance(value, str):
                            truncated_value = value[:max_len]
                            padded_value = truncated_value.ljust(max_len)
                            nc_var[i] = [c.encode('ascii') for c in padded_value]
                        elif isinstance(value, list) and value and isinstance(value[0], str):
                            list_to_write = value[:max_len]
                            nc_var[i] = [c.encode('ascii') for c in list_to_write]

            for var_name in structure['obs_dims']:
                row_size_key = f'{var_name}_row_size'
                row_size = int(cast.get(row_size_key, 0))
                start_idx = obs_indices[var_name]
                end_idx = start_idx + row_size
                
                if var_name in cast:
                    nc_var = nc.variables[var_name]
                    data_to_write = cast[var_name]
                    logger.debug(f"Writing obs variable {var_name}: {data_to_write}")
                    if isinstance(data_to_write, list) and len(data_to_write) == row_size:
                        nc_var[start_idx:end_idx] = np.array(data_to_write, dtype=nc_var.dtype)

                for suffix in ['_sigfigs', '_WODflag']:
                    flag_var_name = f'{var_name}{suffix}'
                    if flag_var_name in cast and flag_var_name in nc.variables:
                        nc_flag_var = nc.variables[flag_var_name]
                        flag_data = cast[flag_var_name]
                        logger.debug(f"Writing flag variable {flag_var_name}: {flag_data}")
                        if isinstance(flag_data, list) and len(flag_data) == row_size:
                            nc_flag_var[start_idx:end_idx] = np.array(flag_data, dtype=nc_flag_var.dtype)

                obs_indices[var_name] = end_idx
        
        return True
    
def json_to_csv_converter(json_data, output_file_path):
    """Converts the hierarchical JSON data into a single, flat CSV file."""
    casts = json_data.get('casts', [])
    if not casts: raise ValueError("JSON data is empty or missing 'casts' array for CSV conversion.")
    
    metadata_keys = set()
    measurement_headers = set()
    
    for cast in casts:
        for k in cast.keys():
            if isinstance(cast[k], list) and k in ['z', 'Temperature', 'Salinity', 'Oxygen', 'Phosphate', 'Silicate', 'Nitrate', 'Chlorophyll', 'pH', 'z_sigfigs', 'z_WODflag', 'Temperature_sigfigs', 'Temperature_WODflag', 'Salinity_sigfigs', 'Salinity_WODflag', 'Oxygen_sigfigs', 'Oxygen_WODflag', 'Phosphate_sigfigs', 'Phosphate_WODflag', 'Silicate_sigfigs', 'Silicate_WODflag', 'Nitrate_sigfigs', 'Nitrate_WODflag', 'Chlorophyll_sigfigs', 'Chlorophyll_WODflag', 'pH_sigfigs', 'pH_WODflag']:
                 measurement_headers.add(k)
            else: metadata_keys.add(k)

    sorted_metadata = sorted(list(metadata_keys))
    sorted_measurements = sorted(list(measurement_headers))
    fieldnames = sorted_metadata + sorted_measurements
    
    all_rows = []
    
    for i, cast in enumerate(casts):
        max_len = 0
        for h in measurement_headers:
            if h in cast and isinstance(cast[h], list): max_len = max(max_len, len(cast[h]))
        
        if max_len == 0: max_len = 1
        
        for j in range(max_len):
            row = {}
            for k in sorted_metadata: row[k] = cast.get(k)
            for h in sorted_measurements:
                data = cast.get(h, [])
                row[h] = data[j] if j < len(data) else None
                
            all_rows.append(row)

    with open(output_file_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, restval='---')
        writer.writeheader()
        writer.writerows(all_rows)
        
    return True # Indicate success

# --- MongoDB Integration Functions ---

def insert_json_to_db(json_data):
    """Inserts the global attributes and individual casts into MongoDB."""
    if collection is None:
        raise ConnectionError("MongoDB collection is not initialized.")

    global_attrs = json_data.get('global_attributes', {})
    casts = json_data.get('casts', [])
    
    metadata_document = {"type": "metadata", "attributes": global_attrs, "date_created": datetime.now()}
    metadata_id = collection.insert_one(metadata_document).inserted_id
    
    documents_to_insert = []
    
    for cast in casts:
        documents_to_insert.append({"type": "cast", "metadata_id": metadata_id, "cast_data": cast})
        
    if documents_to_insert:
        inserted_result = collection.insert_many(documents_to_insert)
        return inserted_result.inserted_ids, str(metadata_id)
    
    return [], str(metadata_id)

# --- API Routes ---

@app.route('/original', methods=['POST'])
def handle_original_upload():
    """Handles .nc or .csv upload, converts to JSON, and stores in MongoDB."""
    if 'file' not in request.files: return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        if filename.endswith('.nc'): json_data = parse_netcdf_to_json(filepath)
        elif filename.endswith('.csv'): json_data = parse_wod_csv_to_json(filepath)
        else: return jsonify({"error": "Unsupported file format. Must be .nc or .csv."}), 400

        inserted_cast_ids, metadata_id = insert_json_to_db(json_data)
        
        return jsonify({
            "message": f"Successfully converted {filename} (File Type: {filename.split('.')[-1].upper()}), stored {len(inserted_cast_ids)} casts.",
            "metadata_id": metadata_id,
            "first_cast_id": str(inserted_cast_ids[0]) if inserted_cast_ids else None
        }), 200

    except Exception as e:
        app.logger.error(f"Error during conversion or storage: {e}")
        return jsonify({"error": f"Internal server error: {e}"}), 500
    finally:
        if os.path.exists(filepath): os.remove(filepath)

@app.route('/cdf', methods=['POST'])
def handle_json_to_netcdf():
    if 'file' not in request.files:
        return jsonify({"error": "No JSON file uploaded"}), 400
    
    json_file = request.files['file']
    if json_file.filename == '' or not json_file.filename.endswith('.json'):
        return jsonify({"error": "Invalid or missing JSON file"}), 400

    output_filepath = None
    try:
        json_data = json.load(json_file)
        logger.debug("Original JSON data: %s", json_data)
        
        # Check if the data is a list and wrap it in the expected format
        if isinstance(json_data, list):
            json_data = {"casts": json_data}

        # --- Enhanced Flattening and Cleaning Logic ---
        def flatten_dict(d, parent_key='', sep='_'):
            """Recursively flatten a nested dictionary."""
            items = []
            for key, value in d.items():
                new_key = f"{parent_key}{sep}{key}" if parent_key else key
                if isinstance(value, dict):
                    items.extend(flatten_dict(value, new_key, sep).items())
                elif isinstance(value, list) and value and isinstance(value[0], dict):
                    for i, sub_dict in enumerate(value):
                        items.extend(flatten_dict(sub_dict, f"{new_key}_{i}", sep).items())
                else:
                    items.append((new_key, value))
            return dict(items)

        def clean_numeric_data(data):
            """Convert data to numeric type or None if invalid."""
            if isinstance(data, list):
                cleaned = []
                for item in data:
                    try:
                        cleaned.append(float(item) if item is not None else None)
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid numeric value: {item}, replacing with None")
                        cleaned.append(None)
                return cleaned
            try:
                return float(data) if data is not None else None
            except (ValueError, TypeError):
                logger.warning(f"Invalid numeric value: {data}, replacing with None")
                return None

        if "casts" in json_data and isinstance(json_data["casts"], list):
            for cast in json_data["casts"]:
                # Flatten the entire cast dictionary
                flattened_cast = flatten_dict(cast)
                cast.clear()
                cast.update(flattened_cast)
                
                # Clean numeric data for observation and flag variables
                obs_var_names = ['z', 'Temperature', 'Salinity', 'Oxygen', 'Phosphate', 'Silicate', 'Nitrate', 'Chlorophyll', 'pH']
                for key, value in list(cast.items()):
                    if key in obs_var_names or key.endswith(('_sigfigs', '_WODflag')):
                        if isinstance(value, list):
                            cast[key] = clean_numeric_data(value)
                        else:
                            cast[key] = clean_numeric_data(value)
                
                # Dynamically add row_size for observation arrays
                for key, value in list(cast.items()):
                    if isinstance(value, list) and key not in ['Primary_Investigator', 'Primary_Investigator_VAR']:
                        cast[f"{key}_row_size"] = len(value)
        
        logger.debug("Flattened and cleaned JSON data: %s", json_data)
        
        # --- Validate Data ---
        for cast in json_data.get("casts", []):
            for key, value in cast.items():
                if key not in ['Primary_Investigator', 'Primary_Investigator_VAR']:
                    if isinstance(value, dict):
                        raise ValueError(f"Nested dictionary found in cast for key: {key}")
                    if isinstance(value, list):
                        for item in value:
                            if isinstance(item, dict):
                                raise ValueError(f"Nested dictionary found in list for key: {key}")
                            if item is not None and not isinstance(item, (str, int, float, bool)):
                                raise ValueError(f"Invalid data type {type(item)} in list for key: {key}")

        base_name = os.path.splitext(secure_filename(json_file.filename))[0]
        output_filename = f"{base_name}_reconstructed.nc"
        output_filepath = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
        
        json_to_netcdf_converter(json_data, output_filepath)
        
        return send_file(output_filepath, 
                        mimetype='application/x-netcdf', 
                        as_attachment=True, 
                        download_name=output_filename)

    except Exception as e:
        logger.error(f"Error during JSON to NetCDF conversion: {e}", exc_info=True)
        return jsonify({"error": f"Conversion error: {e}"}), 500
    finally:
        if output_filepath and os.path.exists(output_filepath):
            os.remove(output_filepath)

@app.route('/data/<cast_id>', methods=['GET'])
def get_cast_data(cast_id):
    """Retrieves a single cast record by its MongoDB ObjectId."""
    if not collection: return jsonify({"error": "Database not connected"}), 503
        
    try:
        document = collection.find_one({"_id": ObjectId(cast_id)})
        if document:
            document['_id'] = str(document['_id'])
            if 'metadata_id' in document: document['metadata_id'] = str(document['metadata_id'])
            return jsonify(document), 200
        else: return jsonify({"error": "Cast not found"}), 404
            
    except Exception as e: return jsonify({"error": f"Invalid ID format or database error: {e}"}), 400


if __name__ == '__main__':
    app.run(debug=True)
