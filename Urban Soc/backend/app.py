from flask import Flask, request, jsonify, send_file
from db import get_db
from flask_cors import CORS
from werkzeug.security import check_password_hash
import mysql.connector
import os
from datetime import datetime
from pathlib import Path

# Paths

BASE_DIR = Path(**file**).resolve().parent.parent
LOGIN_FILE = BASE_DIR / "login.html"

app = Flask(**name**, static_folder='../', static_url_path='/')
CORS(app)

# ===== HEALTH CHECK =====

@app.route("/healthz")
def health():
return "OK", 200

# ===== HOME =====

@app.route('/')
def home():
return send_file(LOGIN_FILE)

# ===== LOGIN =====

@app.route('/login', methods=['POST'])
def login():
try:
data = request.json
role = data.get('role')
email = data.get('email', '').strip()
flat_id = data.get('flatId', '').strip()
password = data.get('password', '').strip()

```
    # ADMIN LOGIN
    if role == 'admin':
        if email == "admin@urbansociety.com" and password == "123456":
            return jsonify({"message": "Admin login success"})
        return jsonify({"error": "Invalid admin credentials"}), 401

    # MEMBER LOGIN
    if role == 'member':
        if not email or not flat_id:
            return jsonify({"error": "Email and Flat ID required"}), 401

        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT * FROM members WHERE email=%s AND flat_id=%s",
            (email, flat_id)
        )
        user = cursor.fetchone()

        cursor.close()
        conn.close()

        if not user:
            return jsonify({"error": "Invalid user"}), 401

        return jsonify({
            "message": "Login success",
            "name": user['name'],
            "memberId": user['id']
        })

    return jsonify({"error": "Invalid role"}), 401

except Exception as e:
    return jsonify({"error": str(e)}), 500
```

# ===== ADD MEMBER =====

@app.route('/add_member', methods=['POST'])
def add_member():
try:
data = request.json

```
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO members (name, email, flat_id) VALUES (%s, %s, %s)",
        (data['name'], data['email'], data['flatId'])
    )

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Member added"})

except Exception as e:
    return jsonify({"error": str(e)}), 500
```

# ===== GET MEMBERS =====

@app.route('/get_members', methods=['GET'])
def get_members():
conn = get_db()
cursor = conn.cursor(dictionary=True)

```
cursor.execute("SELECT * FROM members")
data = cursor.fetchall()

cursor.close()
conn.close()

return jsonify(data)
```

# ===== RUN (IMPORTANT FOR RENDER) =====

if **name** == '**main**':
port = int(os.environ.get("PORT", 10000))
app.run(host="0.0.0.0", port=port)
