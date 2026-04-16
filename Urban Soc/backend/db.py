import mysql.connector

# ======================== COMMENT ========================
# Provide a new MySQL connection for backend routes (update creds as needed).
def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="117717",   # apna password dalna agar hai
        database="urban_society"
    )
