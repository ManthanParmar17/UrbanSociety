import os
from urllib.parse import parse_qs, urlparse

import mysql.connector


def _read_database_config():
    database_url = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL")
    if database_url:
        parsed = urlparse(database_url)
        query = parse_qs(parsed.query)
        return {
            "host": parsed.hostname or "localhost",
            "user": parsed.username or "root",
            "password": parsed.password or "",
            "database": (parsed.path or "").lstrip("/") or query.get("database", ["urban_society"])[0],
            "port": parsed.port or 3306,
        }

    return {
        "host": os.getenv("MYSQLHOST") or os.getenv("DB_HOST") or "localhost",
        "user": os.getenv("MYSQLUSER") or os.getenv("DB_USER") or "root",
        "password": os.getenv("MYSQLPASSWORD") or os.getenv("DB_PASSWORD") or "",
        "database": os.getenv("MYSQLDATABASE") or os.getenv("DB_NAME") or "urban_society",
        "port": int(os.getenv("MYSQLPORT") or os.getenv("DB_PORT") or 3306),
    }


def get_db():
    try:
        conn = mysql.connector.connect(**_read_database_config())
        print("MySQL connected")
        return conn
    except Exception as exc:
        print("DB connection error:", exc)
        return None
