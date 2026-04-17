from flask import Flask, request, jsonify, send_file
from db import get_db
from flask_cors import CORS
from werkzeug.security import check_password_hash
import mysql.connector
import os
import re
from datetime import datetime
from pathlib import Path

# Resolve paths relative to the repository root instead of the current working directory.
BASE_DIR = Path(__file__).resolve().parent.parent
LOGIN_FILE = BASE_DIR / "login.html"
LOGO_FILE = BASE_DIR / "admin" / "images" / "image.png"

app = Flask(__name__, static_folder='../', static_url_path='/')
CORS(app)

# ====== ADMIN AUTH CONFIG ======
DEFAULT_ADMIN_EMAIL = "admin@urbansociety.com"
# hashed for password "123456" generated via werkzeug.security.generate_password_hash
DEFAULT_ADMIN_PASSWORD_HASH = "scrypt:32768:8:1$lDTjJyHXLXhp4qhG$cba63f714a7f85f9802569c6ab0653de730bcf5b33b25a9d3c4f3ac07da918b5b6663bb8dec9a6d663cd9bea78bbac6f8e475d30bce9a4ddf16e7612dc092c5c"


# ======================== COMMENT ========================
# Fetch admin email/password hash from env, falling back to baked-in defaults.
def get_admin_creds():
    """Read admin credentials from environment with secure defaults."""
    admin_email = os.environ.get("ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL).lower()
    admin_hash = os.environ.get("ADMIN_PASSWORD_HASH", DEFAULT_ADMIN_PASSWORD_HASH)
    return admin_email, admin_hash


# ======================== COMMENT ========================
# Parse limit/offset query params with sane bounds to protect the API.
def parse_pagination(default_limit=100, max_limit=500):
    """Extract limit/offset query params safely."""
    try:
        limit = int(request.args.get("limit", default_limit))
    except ValueError:
        limit = default_limit
    try:
        offset = int(request.args.get("offset", 0))
    except ValueError:
        offset = 0

    limit = max(1, min(limit, max_limit))
    offset = max(0, offset)
    return limit, offset


# ======================== COMMENT ========================
# Idempotently create core tables (members/notices/bills/complaints/events) if absent.
def ensure_tables():
    """Create required tables if they don't exist (idempotent)."""
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            flat_id VARCHAR(20) NOT NULL,
            phone VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
        """,
        """
        CREATE TABLE IF NOT EXISTS notices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT NOT NULL,
            type VARCHAR(50) DEFAULT 'general',
            status ENUM('published','draft') DEFAULT 'published',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
        """,
        """
        CREATE TABLE IF NOT EXISTS bills (
            id INT AUTO_INCREMENT PRIMARY KEY,
            member_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            description TEXT,
            due_date DATE NOT NULL,
            status ENUM('pending','paid','overdue','partial') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_bills_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
        """,
        """
        CREATE TABLE IF NOT EXISTS complaints (
            id INT AUTO_INCREMENT PRIMARY KEY,
            member_id INT NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) DEFAULT 'General',
            priority ENUM('low','medium','high') DEFAULT 'medium',
            status ENUM('pending','in-progress','resolved','rejected') DEFAULT 'pending',
            assigned_to VARCHAR(100),
            expected_date DATE,
            resolved_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_complaints_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
        """,
        """
        CREATE TABLE IF NOT EXISTS events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            type VARCHAR(100) DEFAULT 'General',
            date DATE NOT NULL,
            start_time TIME DEFAULT '00:00:00',
            end_time TIME DEFAULT '23:59:59',
            venue VARCHAR(200),
            capacity INT DEFAULT 0,
            description TEXT,
            organizer VARCHAR(150),
            contact VARCHAR(50),
            rsvp_going INT DEFAULT 0,
            rsvp_maybe INT DEFAULT 0,
            rsvp_declined INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
        """
    ]
    try:
        conn = get_db()
        cursor = conn.cursor()
        for ddl in ddl_statements:
            cursor.execute(ddl)
        # Drop legacy unique constraint on flat_id to allow multiple occupants per flat
        try:
            cursor.execute("ALTER TABLE members DROP INDEX flat_id")
        except mysql.connector.Error as ae:
            if ae.errno not in (1091, 1061):  # 1091: can't drop; 1061: duplicate index name
                raise
        # Backfill optional columns for notices when upgrading
        try:
            cursor.execute("ALTER TABLE notices ADD COLUMN type VARCHAR(50) DEFAULT 'general' AFTER description")
        except mysql.connector.Error as ae:
            if ae.errno != 1060:  # duplicate column
                raise
        try:
            cursor.execute("ALTER TABLE notices ADD COLUMN status ENUM('published','draft') DEFAULT 'published' AFTER type")
        except mysql.connector.Error as ae:
            if ae.errno != 1060:
                raise
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print("SCHEMA INIT ERROR:", e)


# ======================== COMMENT ========================
# Seed initial admin account and sample data (only if missing).
def seed_defaults():
    """Seed sample events/notices/bills/complaints if empty (lightweight)."""
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM events")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO events (title, type, date, start_time, end_time, venue, capacity, description, organizer, contact, rsvp_going, rsvp_maybe, rsvp_declined)
                VALUES
                ('Annual Sports Day', 'Sports', DATE_ADD(CURDATE(), INTERVAL 14 DAY), '09:00:00', '18:00:00', 'Society Ground', 200, 'Sports competition for all age groups.', 'Sports Committee', '9876543210', 45, 12, 3),
                ('Holi Celebration', 'Festival', DATE_ADD(CURDATE(), INTERVAL 7 DAY), '16:00:00', '20:00:00', 'Community Hall', 150, 'Colorful Holi celebration with organic colors.', 'Cultural Committee', '9876543211', 78, 15, 2),
                ('Society Meeting', 'Meeting', DATE_ADD(CURDATE(), INTERVAL 3 DAY), '18:30:00', '20:00:00', 'Conference Room', 50, 'Monthly society meeting to discuss issues and budget.', 'Secretary', '9876543212', 32, 8, 5)
            """)

        cursor.execute("SELECT COUNT(*) FROM notices")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO notices (title, description) VALUES
                ('Water tank cleaning', 'Water supply will be off from 10 AM to 2 PM on Saturday for tank cleaning.'),
                ('Fire drill', 'Mandatory fire drill next Monday at 4 PM. Please participate.'),
                ('Maintenance fee update', 'Quarterly maintenance fee invoices will be shared by the 5th of this month.')
            """)

        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print("SEED ERROR:", e)

# ================= HOME =================
@app.route('/')
# ======================== COMMENT ========================
# Serve the SPA root/index.
def home():
    # Use file path anchored to repo root so it works no matter where the server is started from.
    return send_file(LOGIN_FILE)


# ================= LOGIN =================
@app.route('/login', methods=['POST'])
# ======================== COMMENT ========================
# Authenticate admin or member and return minimal identity payload.
def login():
    try:
        data = request.json
        role = data.get('role')
        email = data.get('email', '').strip()
        flat_id = data.get('flatId', '').strip()
        password = data.get('password', '').strip()

        print(f"\n🔐 LOGIN ATTEMPT - Role: {role}, Email: {email}, FlatID: {flat_id}")

        # ✅ ADMIN → FREE LOGIN
        if role == 'admin':
            if not email or not password:
                print("⛔ ADMIN LOGIN FAILED - Missing email or password")
                return jsonify({"error": "Email and password are required"}), 401

            admin_email, admin_hash = get_admin_creds()
            if email.lower() != admin_email or not check_password_hash(admin_hash, password):
                print("⛔ ADMIN LOGIN FAILED - Invalid credentials")
                return jsonify({"error": "Invalid admin credentials"}), 401

            print(f"✅ ADMIN LOGIN GRANTED")
            return jsonify({"message": "Admin login success"})

        # ✅ MEMBER → STRICT LOGIN (MUST exist in database)
        if role == 'member':
            if not email or not flat_id:
                print(f"❌ MEMBER LOGIN FAILED - Missing email or flatId")
                return jsonify({"error": "Email and Flat ID are required"}), 401

            norm_email = email.lower()
            norm_flat = flat_id.replace(' ', '').upper()

            conn = get_db()
            cursor = conn.cursor(dictionary=True)

            query = "SELECT id, name, email, flat_id FROM members WHERE LOWER(email)=%s AND UPPER(REPLACE(flat_id, ' ', ''))=%s"
            print(f"🔍 QUERY: {query}")
            print(f"📦 PARAMS: email='{norm_email}', flat_id='{norm_flat}'")

            cursor.execute(query, (norm_email, norm_flat))
            user = cursor.fetchone()

            print(f"🗂️  DATABASE RESULT: {user}")

            cursor.close()
            conn.close()

            if not user:
                print(f"❌ MEMBER LOGIN FAILED - No matching record in database")
                return jsonify({"error": "❌ Invalid email or flat ID. Only members added by admin can login"}), 401

            print(f"✅ MEMBER LOGIN SUCCESSFUL - User: {user['name']}")
            return jsonify({
                "message": "Login success",
                "name": user['name'],
                "flatId": user['flat_id'],
                "memberId": user['id']
            })
        
        print(f"❌ INVALID ROLE: {role}")
        return jsonify({"error": "Invalid role"}), 401
    
    except Exception as e:
        print(f"❌ LOGIN ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Server error: {str(e)}"}), 500


# ================= ADD MEMBER =================
@app.route('/add_member', methods=['POST'])
# ======================== COMMENT ========================
# Create a new member row from posted JSON fields.
def add_member():
    try:
        data = request.json
        ensure_tables()

        conn = get_db()
        cursor = conn.cursor()

        clean_flat = data.get('flatId', '').strip()
        clean_flat = clean_flat.replace(' ', '').upper()

        if not data.get('name') or not data.get('email') or not clean_flat:
            cursor.close()
            conn.close()
            return jsonify({"error": "name, email, and flatId are required"}), 400

        # Reject duplicate email only (multiple people can share flat)
        cursor.execute(
            "SELECT id FROM members WHERE LOWER(email)=%s",
            (data.get('email', '').lower(),)
        )
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": "Member with this email already exists"}), 409

        cursor.execute(
            "INSERT INTO members (name, email, flat_id) VALUES (%s, %s, %s)",
            (
                data.get('name'),
                data.get('email'),
                clean_flat
            )
        )

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Member added"})

    except mysql.connector.Error as db_err:
        if db_err.errno == 1062:
            return jsonify({"error": "Duplicate entry"}), 409
        print("ADD MEMBER DB ERROR:", str(db_err))
        return jsonify({"error": str(db_err)}), 500
    except Exception as e:
        print("ADD MEMBER ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/update_member', methods=['POST', 'PUT'])
# ======================== COMMENT ========================
# Update an existing member record by id.
def update_member():
    try:
        ensure_tables()
        data = request.json or {}
        member_id = data.get('id') or data.get('member_id')
        if not member_id:
            return jsonify({"error": "member id is required"}), 400

        name = (data.get('name') or "").strip()
        email = (data.get('email') or "").strip().lower()
        clean_flat = (data.get('flatId') or data.get('flat_id') or "").replace(' ', '').upper()

        if not name or not email or not clean_flat:
            return jsonify({"error": "name, email, and flatId are required"}), 400

        conn = get_db()
        cursor = conn.cursor()

        # Check duplicates on other records
        cursor.execute(
            "SELECT id FROM members WHERE LOWER(email)=%s AND id<>%s",
            (email, member_id)
        )
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": "Another member already uses this email"}), 409

        cursor.execute(
            "UPDATE members SET name=%s, email=%s, flat_id=%s WHERE id=%s",
            (name, email, clean_flat, member_id)
        )
        conn.commit()
        updated = cursor.rowcount
        cursor.close()
        conn.close()

        if updated == 0:
            return jsonify({"error": "Member not found"}), 404
        return jsonify({"message": "Member updated"})

    except Exception as e:
        print("UPDATE MEMBER ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/delete_member', methods=['POST', 'DELETE'])
@app.route('/delete_member/<int:member_id>', methods=['DELETE', 'POST'])
# ======================== COMMENT ========================
# Delete a member by id (accepts id in path or JSON).
def delete_member(member_id=None):
    try:
        ensure_tables()
        data = request.get_json(silent=True) or {}
        target_id = member_id or data.get('id') or data.get('member_id') or request.args.get('id')
        if not target_id:
            return jsonify({"error": "member id is required"}), 400

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM members WHERE id=%s", (target_id,))
        conn.commit()
        deleted = cursor.rowcount
        cursor.close()
        conn.close()

        if deleted == 0:
            return jsonify({"error": "Member not found"}), 404
        return jsonify({"message": "Member deleted"})
    except Exception as e:
        print("DELETE MEMBER ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= GET MEMBERS =================
@app.route('/get_members', methods=['GET'])
def get_members():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM members ORDER BY id DESC")
    members = cursor.fetchall()

    return jsonify(members)


# ================= ADD NOTICE =================
@app.route('/add_notice', methods=['POST'])
# ======================== COMMENT ========================
# Insert a new notice (published or draft) from JSON payload.
def add_notice():
    data = request.json or {}
    ensure_tables()

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO notices (title, description, type, status) VALUES (%s, %s, %s, %s)",
        (
            data.get('title'),
            data.get('description'),
            data.get('type', 'general'),
            data.get('status', 'published')
        )
    )
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Notice added successfully"})


# ================= GET NOTICES =================
@app.route('/get_notices', methods=['GET'])
def get_notices():
    # ======================== COMMENT ========================
    # Return all notices (published and drafts) with no filtering.
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM notices ORDER BY id DESC")
    notices = cursor.fetchall()

    return jsonify(notices)


# ================= DELETE NOTICE =================
@app.route('/delete_notice', methods=['POST', 'DELETE'])
@app.route('/delete_notice/<int:notice_id>', methods=['DELETE', 'POST'])
# ======================== COMMENT ========================
# Delete a notice by id (id may come from URL or JSON payload).
def delete_notice(notice_id=None):
    try:
        ensure_tables()
        payload = request.get_json(silent=True) or {}
        nid = notice_id or payload.get('id') or payload.get('notice_id') or request.args.get('id')
        if not nid:
            return jsonify({"error": "notice id is required"}), 400

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notices WHERE id=%s", (nid,))
        conn.commit()
        deleted = cursor.rowcount
        cursor.close()
        conn.close()

        if deleted == 0:
            return jsonify({"error": "Notice not found"}), 404
        return jsonify({"message": "Notice deleted"})

    except Exception as e:
        print("DELETE NOTICE ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= ADD BILL =================
@app.route('/add_bill', methods=['POST'])
# ======================== COMMENT ========================
# Create a bill for a member with amount/description/due date.
def add_bill():
    try:
        data = request.json

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO bills (member_id, amount, description, due_date, status) VALUES (%s, %s, %s, %s, %s)",
            (
                data.get('member_id'),
                data.get('amount'),
                data.get('description'),
                data.get('due_date'),
                data.get('status', 'pending')
            )
        )

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Bill added successfully"})

    except Exception as e:
        print("ADD BILL ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= GET BILLS =================
@app.route('/get_bills', methods=['GET'])
def get_bills():
    # ======================== COMMENT ========================
    # List all bills with optional pagination and status filtering.
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        limit, offset = parse_pagination()

        cursor.execute("""
            SELECT 
                b.*, 
                m.name AS member_name, 
                m.flat_id AS flat_id, 
                m.email AS member_email
            FROM bills b
            JOIN members m ON m.id = b.member_id
            ORDER BY b.id DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        bills = cursor.fetchall()

        cursor.close()
        conn.close()
        return jsonify(bills)

    except Exception as e:
        print("GET BILLS ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= GET BILLS FOR A MEMBER =================
@app.route('/get_member_bills', methods=['GET'])
def get_member_bills():
    # ======================== COMMENT ========================
    # Fetch bills for a specific member id (query param).
    try:
        member_id = request.args.get('member_id')
        if not member_id:
            return jsonify({"error": "member_id is required"}), 400
        limit, offset = parse_pagination()

        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                b.*, 
                m.name AS member_name, 
                m.flat_id AS flat_id, 
                m.email AS member_email
            FROM bills b
            JOIN members m ON m.id = b.member_id
            WHERE b.member_id = %s
            ORDER BY b.id DESC
            LIMIT %s OFFSET %s
        """, (member_id, limit, offset))

        bills = cursor.fetchall()

        cursor.close()
        conn.close()
        return jsonify(bills)

    except Exception as e:
        print("GET MEMBER BILLS ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= UPDATE BILL STATUS =================
@app.route('/update_bill_status', methods=['POST'])
def update_bill_status():
    # ======================== COMMENT ========================
    # Update bill status (paid/pending/overdue/partial) via JSON payload.
    try:
        data = request.json

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE bills SET status=%s WHERE id=%s",
            (data.get('status'), data.get('bill_id'))
        )

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Bill status updated"})

    except Exception as e:
        print("UPDATE BILL ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/pay_bill', methods=['POST'])
def pay_bill():
    # ======================== COMMENT ========================
    # Member-triggered bill payment: validates ownership then marks paid.
    """
    Member-triggered payment: mark bill as paid if it belongs to the member.
    """
    try:
        data = request.json or {}
        bill_id = data.get('bill_id')
        member_id = data.get('member_id')
        if not bill_id or not member_id:
            return jsonify({"error": "bill_id and member_id are required"}), 400

        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, member_id FROM bills WHERE id=%s", (bill_id,))
        bill = cursor.fetchone()
        if not bill or str(bill["member_id"]) != str(member_id):
            cursor.close()
            conn.close()
            return jsonify({"error": "Bill not found for this member"}), 404

        cursor.close()
        cursor = conn.cursor()
        cursor.execute("UPDATE bills SET status='paid' WHERE id=%s", (bill_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Bill marked as paid"})
    except Exception as e:
        print("PAY BILL ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/update_bill', methods=['POST', 'PUT'])
def update_bill():
    # ======================== COMMENT ========================
    # Edit bill details (amount, description, due date) by bill id.
    try:
        ensure_tables()
        data = request.json or {}
        bill_id = data.get('id') or data.get('bill_id')
        if not bill_id:
            return jsonify({"error": "bill id is required"}), 400

        fields = []
        values = []
        for col, key in [('member_id', 'member_id'), ('amount', 'amount'), ('description', 'description'),
                         ('due_date', 'due_date'), ('status', 'status')]:
            if data.get(key) is not None:
                fields.append(f"{col}=%s")
                values.append(data.get(key))

        if not fields:
            return jsonify({"error": "No fields to update"}), 400

        values.append(bill_id)
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(f"UPDATE bills SET {', '.join(fields)} WHERE id=%s", values)
        conn.commit()
        updated = cursor.rowcount
        cursor.close()
        conn.close()

        if updated == 0:
            return jsonify({"error": "Bill not found"}), 404
        return jsonify({"message": "Bill updated"})
    except Exception as e:
        print("UPDATE BILL FULL ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/delete_bill', methods=['POST', 'DELETE'])
@app.route('/delete_bill/<int:bill_id>', methods=['DELETE', 'POST'])
def delete_bill(bill_id=None):
    # ======================== COMMENT ========================
    # Delete a bill by id (from path or JSON payload).
    try:
        ensure_tables()
        data = request.get_json(silent=True) or {}
        target_id = bill_id or data.get('id') or data.get('bill_id') or request.args.get('id')
        if not target_id:
            return jsonify({"error": "bill id is required"}), 400

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM bills WHERE id=%s", (target_id,))
        conn.commit()
        deleted = cursor.rowcount
        cursor.close()
        conn.close()

        if deleted == 0:
            return jsonify({"error": "Bill not found"}), 404
        return jsonify({"message": "Bill deleted"})
    except Exception as e:
        print("DELETE BILL ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= ADD COMPLAINT =================
@app.route('/add_complaint', methods=['POST'])
def add_complaint():
    # ======================== COMMENT ========================
    # Insert a new complaint raised by a member.
    try:
        ensure_tables()
        data = request.json
        print("ADD_COMPLAINT payload:", data)

        conn = get_db()
        cursor = conn.cursor()

        # Validate member exists
        cursor.execute("SELECT id FROM members WHERE id=%s", (data.get('member_id'),))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": "Member not found; please re-login"}), 400

        cursor.execute(
            "INSERT INTO complaints (member_id, title, description, category, priority, status) VALUES (%s, %s, %s, %s, %s, %s)",
            (
                data.get('member_id'),
                data.get('title'),
                data.get('description'),
                data.get('category', 'General'),
                data.get('priority', 'medium'),
                data.get('status', 'pending')
            )
        )

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Complaint added successfully"})

    except Exception as e:
        print("ADD COMPLAINT ERROR:", str(e))
        return jsonify({"error": f"Failed to add complaint: {str(e)}"}), 500


# ================= GET COMPLAINTS =================
@app.route('/get_complaints', methods=['GET'])
def get_complaints():
    # ======================== COMMENT ========================
    # Fetch all complaints with optional filters/pagination.
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        limit, offset = parse_pagination()

        cursor.execute("""
            SELECT 
                c.*, 
                m.name AS member_name, 
                m.flat_id AS flat_id, 
                m.email AS member_email
            FROM complaints c
            LEFT JOIN members m ON m.id = c.member_id
            ORDER BY c.created_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        complaints = cursor.fetchall()

        cursor.close()
        conn.close()
        return jsonify(complaints)

    except Exception as e:
        print("GET COMPLAINTS ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= GET COMPLAINTS FOR A MEMBER =================
@app.route('/get_member_complaints', methods=['GET'])
def get_member_complaints():
    # ======================== COMMENT ========================
    # Return complaints for a specific member id.
    try:
        member_id = request.args.get('member_id')
        if not member_id:
            return jsonify({"error": "member_id is required"}), 400
        limit, offset = parse_pagination()

        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                c.*, 
                m.name AS member_name, 
                m.flat_id AS flat_id, 
                m.email AS member_email
            FROM complaints c
            LEFT JOIN members m ON m.id = c.member_id
            WHERE c.member_id = %s
            ORDER BY c.created_at DESC
            LIMIT %s OFFSET %s
        """, (member_id, limit, offset))
        complaints = cursor.fetchall()

        cursor.close()
        conn.close()
        return jsonify(complaints)

    except Exception as e:
        print("GET MEMBER COMPLAINTS ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= UPDATE COMPLAINT STATUS =================
@app.route('/update_complaint_status', methods=['POST'])
def update_complaint_status():
    # ======================== COMMENT ========================
    # Change complaint status (pending/in-progress/resolved) by id.
    try:
        data = request.json

        conn = get_db()
        cursor = conn.cursor()

        # Update status and assigned_to if provided
        update_fields = ["status = %s"]
        update_values = [data.get('status')]

        if 'assigned_to' in data:
            update_fields.append("assigned_to = %s")
            update_values.append(data.get('assigned_to'))

        if 'expected_date' in data:
            update_fields.append("expected_date = %s")
            update_values.append(data.get('expected_date'))

        if data.get('status') == 'resolved':
            update_fields.append("resolved_date = CURDATE()")
        elif data.get('status') == 'rejected':
            update_fields.append("resolved_date = CURDATE()")

        update_values.append(data.get('complaint_id'))

        query = f"UPDATE complaints SET {', '.join(update_fields)} WHERE id = %s"
        cursor.execute(query, update_values)

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Complaint status updated"})

    except Exception as e:
        print("UPDATE COMPLAINT ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= DELETE COMPLAINT =================
@app.route('/delete_complaint', methods=['POST', 'DELETE'])
@app.route('/delete_complaint/<int:complaint_id>', methods=['DELETE', 'POST'])
def delete_complaint(complaint_id=None):
    # ======================== COMMENT ========================
    # Delete a complaint by id (from URL or JSON).
    try:
        ensure_tables()
        payload = request.get_json(silent=True) or {}
        comp_id = complaint_id or payload.get('id') or payload.get('complaint_id') or request.args.get('id')
        member_id = payload.get('member_id') or request.args.get('member_id')

        if not comp_id:
            return jsonify({"error": "complaint id is required"}), 400

        conn = get_db()
        cursor = conn.cursor()

        if member_id:
            cursor.execute("DELETE FROM complaints WHERE id=%s AND member_id=%s", (comp_id, member_id))
        else:
            cursor.execute("DELETE FROM complaints WHERE id=%s", (comp_id,))

        conn.commit()
        deleted = cursor.rowcount
        cursor.close()
        conn.close()

        if deleted == 0:
            return jsonify({"error": "Complaint not found or not allowed"}), 404
        return jsonify({"message": "Complaint deleted"})

    except Exception as e:
        print("DELETE COMPLAINT ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= EVENTS =================
@app.route('/add_event', methods=['POST'])
def add_event():
    # ======================== COMMENT ========================
    # Create a new event with schedule, venue, capacity, and type.
    try:
        ensure_tables()
        data = request.json or {}

        required_fields = ['title', 'date']
        for f in required_fields:
            if not data.get(f):
                return jsonify({"error": f"{f} is required"}), 400

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO events 
            (title, type, date, start_time, end_time, venue, capacity, description, organizer, contact, rsvp_going, rsvp_maybe, rsvp_declined)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                data.get('title'),
                data.get('type', 'General'),
                data.get('date'),
                data.get('start_time', '00:00'),
                data.get('end_time', '23:59'),
                data.get('venue'),
                data.get('capacity', 0),
                data.get('description'),
                data.get('organizer'),
                data.get('contact'),
                data.get('rsvp_going', 0),
                data.get('rsvp_maybe', 0),
                data.get('rsvp_declined', 0),
            )
        )

        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({"message": "Event created", "id": new_id})

    except Exception as e:
        print("ADD EVENT ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/update_event', methods=['POST'])
def update_event():
    # ======================== COMMENT ========================
    # Edit an existing event's details by id.
    try:
        ensure_tables()
        data = request.json or {}
        event_id = data.get('id')
        if not event_id:
            return jsonify({"error": "id is required"}), 400

        fields = [
            ('title', data.get('title')),
            ('type', data.get('type')),
            ('date', data.get('date')),
            ('start_time', data.get('start_time')),
            ('end_time', data.get('end_time')),
            ('venue', data.get('venue')),
            ('capacity', data.get('capacity')),
            ('description', data.get('description')),
            ('organizer', data.get('organizer')),
            ('contact', data.get('contact')),
        ]
        set_clause = []
        values = []
        for col, val in fields:
            if val is not None:
                set_clause.append(f"{col}=%s")
                values.append(val)

        if not set_clause:
            return jsonify({"error": "No fields to update"}), 400

        values.append(event_id)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(f"UPDATE events SET {', '.join(set_clause)} WHERE id=%s", values)
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Event updated"})

    except Exception as e:
        print("UPDATE EVENT ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/delete_event', methods=['POST', 'DELETE'])
@app.route('/delete_event/<int:event_id>', methods=['DELETE', 'POST'])
def delete_event(event_id=None):
    # ======================== COMMENT ========================
    # Delete an event by id (path or JSON).
    try:
        ensure_tables()
        data = request.get_json(silent=True) or {}
        target_id = event_id or data.get('id') or data.get('event_id') or request.args.get('id')
        if not target_id:
            return jsonify({"error": "id is required"}), 400

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM events WHERE id=%s", (target_id,))
        conn.commit()
        deleted = cursor.rowcount
        cursor.close()
        conn.close()

        if deleted == 0:
            return jsonify({"error": "Event not found"}), 404
        return jsonify({"message": "Event deleted"})

    except Exception as e:
        print("DELETE EVENT ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/get_events', methods=['GET'])
def get_events():
    # ======================== COMMENT ========================
    # List events with optional type/status filtering and pagination.
    ensure_tables()
    limit, offset = parse_pagination()
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT * FROM events
            ORDER BY date ASC, start_time ASC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        events = []
        for r in rows:
            # MySQL returns TIME as datetime.timedelta; coerce to HH:MM strings
            st = r.get("start_time")
            et = r.get("end_time")
            if hasattr(st, "seconds"):
                st = f"{int(st.seconds/3600):02d}:{int((st.seconds%3600)/60):02d}"
            if hasattr(et, "seconds"):
                et = f"{int(et.seconds/3600):02d}:{int((et.seconds%3600)/60):02d}"

            evt = dict(r)
            if isinstance(r.get("date"), (datetime, )):
                evt["date"] = r["date"].date().isoformat()
            elif hasattr(r.get("date"), "isoformat"):
                evt["date"] = r["date"].isoformat()
            evt["start_time"] = st
            evt["end_time"] = et
            events.append(evt)

        return jsonify(events)
    except mysql.connector.Error as e:
        # Auto-recover if table missing
        if e.errno == 1146:
            ensure_tables()
            try:
                conn = get_db()
                cursor = conn.cursor(dictionary=True)
                cursor.execute("""
                    SELECT * FROM events
                    ORDER BY date ASC, start_time ASC
                    LIMIT %s OFFSET %s
                """, (limit, offset))
                rows = cursor.fetchall()
                cursor.close()
                conn.close()
                events = []
                for r in rows:
                    st = r.get("start_time")
                    et = r.get("end_time")
                    if hasattr(st, "seconds"):
                        st = f"{int(st.seconds/3600):02d}:{int((st.seconds%3600)/60):02d}"
                    if hasattr(et, "seconds"):
                        et = f"{int(et.seconds/3600):02d}:{int((et.seconds%3600)/60):02d}"
                    evt = dict(r)
                    if isinstance(r.get("date"), (datetime, )):
                        evt["date"] = r["date"].date().isoformat()
                    elif hasattr(r.get("date"), "isoformat"):
                        evt["date"] = r["date"].isoformat()
                    evt["start_time"] = st
                    evt["end_time"] = et
                    events.append(evt)
                return jsonify(events)
            except Exception as e2:
                print("GET EVENTS RETRY ERROR:", e2)
                return jsonify({"error": str(e2)}), 500
        print("GET EVENTS ERROR:", e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print("GET EVENTS ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/rsvp_event', methods=['POST'])
def rsvp_event():
    # ======================== COMMENT ========================
    # Record a member RSVP status for an event.
    try:
        ensure_tables()
        data = request.json or {}
        event_id = data.get('event_id')
        status = data.get('status')

        # Enforce correct event_id type and validate
        try:
            event_id = int(event_id)
        except (TypeError, ValueError):
            return jsonify({"error": "event_id is required and must be numeric"}), 400

        if status not in ['going', 'maybe', 'declined']:
            return jsonify({"error": "status must be going, maybe, or declined"}), 400

        column_map = {
            'going': 'rsvp_going',
            'maybe': 'rsvp_maybe',
            'declined': 'rsvp_declined'
        }
        column = column_map[status]

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(f"UPDATE events SET {column} = {column} + 1 WHERE id = %s", (event_id,))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "RSVP recorded"})

    except Exception as e:
        print("RSVP EVENT ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ================= LOGOUT =================
@app.route('/logout')
def logout():
    # ======================== COMMENT ========================
    # Log out by redirecting to the unified login page.
    return send_file(LOGIN_FILE)

@app.route('/favicon.ico')
def favicon():
    # ======================== COMMENT ========================
    # Serve existing logo as favicon fallback.
    # Serve existing logo as favicon to avoid 404s
    if LOGO_FILE.exists():
        return send_file(LOGO_FILE)
    return '', 404

# ================= RUN =================
if __name__ == '__main__':
    ensure_tables()
    seed_defaults()

    import os
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)