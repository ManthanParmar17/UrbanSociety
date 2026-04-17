import mysql.connector
import os

# ======================== COMMENT ========================
# Provide a new MySQL connection for backend routes (update creds as needed).
import os
import mysql.connector

conn = mysql.connector.connect(
    host=os.getenv("mysql.railway.internal"),
    user=os.getenv("root"),
    password=os.getenv("snCqdlNByrwgtrjpbyTKLMFKFwUjXfis"),
    database=os.getenv("railway"),
    port=int(os.getenv("3306"))
)

print("✅ MySQL Connected")
