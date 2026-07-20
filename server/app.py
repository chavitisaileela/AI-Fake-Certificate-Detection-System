import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import pytesseract

app = Flask(__name__)
CORS(app)

# Explicit Tesseract Path Configuration
pytesseract.pytesseract.tesseract_cmd = r'F:\Program Files\Tesseract-OCR\tesseract.exe'

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Database Helper Operations ---
def read_json(filename):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    if not os.path.exists(filepath):
        return []
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def write_json(filename, data):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

# --- Routes Definitions ---

@app.route('/', methods=['GET'])
def home():
    return "AI Certificate Verification Server Running"

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "No data received"}), 400
        
    users = read_json('users.json')
    
    # Check uniqueness based on email
    for u in users:
        if u.get('email') == data.get('email'):
            return jsonify({"success": False, "message": "Account with this email already exists"}), 400
            
    new_user = {
        "first_name": data.get('first_name'),
        "last_name": data.get('last_name'),
        "email": data.get('email'),
        "phone": data.get('phone'),
        "location": data.get('location', '-'),  # 保存されたロケーション
        "password": data.get('password'),
        "role": data.get('role', 'Verifier')
    }
    
    users.append(new_user)
    write_json('users.json', users)
    return jsonify({"success": True, "message": "Registration successful"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "Missing credentials"}), 400
        
    users = read_json('users.json')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role')
    
    for u in users:
        if u.get('email') == email and u.get('password') == password and u.get('role') == role:
            return jsonify({
                "success": True, 
                "user": {
                    "first_name": u.get('first_name'),
                    "last_name": u.get('last_name'),
                    "email": u.get('email'),
                    "phone": u.get('phone'),
                    "location": u.get('location', '-'),  # Sent back to your profile view layout cache
                    "role": u.get('role')
                }
            })
            
    return jsonify({"success": False, "message": "Invalid email, password, or role choice"}), 401

@app.route('/verify', methods=['POST'])
def verify():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "No selected file"}), 400

    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    try:
        img = Image.open(filepath)
        extracted_text = pytesseract.image_to_string(img)
    except Exception as e:
        extracted_text = f"OCR Error: Unable to extract text. {str(e)}"

    master_certificates = read_json('certificates.json')
    best_score = 0
    matched_details = None
    normalized_ocr = extracted_text.lower()

    for cert in master_certificates:
        current_score = 0
        if cert.get('certificate_id', '').lower() in normalized_ocr:
            current_score += 40
        if cert.get('name', '').lower() in normalized_ocr:
            current_score += 40
        if cert.get('college', '').lower() in normalized_ocr:
            current_score += 20
            
        if current_score > best_score:
            best_score = current_score
            matched_details = cert

    status = "GENUINE" if best_score >= 60 else "FRAUD"

    result = {
        "filename": file.filename,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ocr_text": extracted_text.strip() if extracted_text else "No readable text detected.",
        "status": status,
        "confidence": best_score,
        "reason": "Auto-check verified structural properties matched against centralized ledger storage details." if status == "GENUINE" else "Auto-check flagged suspicious criteria mismatches inside critical credential property parameters."
    }

    db = read_json('database.json')
    db.append(result)
    write_json('database.json', db)

    return jsonify(result)

@app.route('/dashboard', methods=['GET'])
def dashboard():
    db = read_json('database.json')
    scanned = len(db)
    genuine = sum(1 for item in db if item.get('status') == "GENUINE")
    fraud = sum(1 for item in db if item.get('status') == "FRAUD")
    
    return jsonify({
        "scanned": scanned,
        "genuine": genuine,
        "fraud": fraud,
        "pending": 0,
        "recent": db[-10:],  
        "alerts": [item for item in db if item.get('status') == "FRAUD"]
    })

@app.route('/change-password', methods=['POST'])
def change_password():
    data = request.get_json()
    current_password = data.get('current')
    new_password = data.get('newPass')
    
    users = read_json('users.json')
    password_updated = False
    
    for u in users:
        if u.get('password') == current_password:
            u['password'] = new_password
            password_updated = True
            break
            
    if password_updated:
        write_json('users.json', users)
        return jsonify({"status": "success", "message": "Password changed successfully!"}), 200
    else:
        return jsonify({"status": "error", "message": "Current password authentication failed."}), 400


# --- Server Initialization Execution Block ---
if __name__ == '__main__':
    app.run(port=5000, debug=True)