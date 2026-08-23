import json
import os
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "flowline.db"

app = Flask(__name__, static_folder=None)


def connection():
    DATA_DIR.mkdir(exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.execute(
        "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    )
    return db


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "storage": "sqlite"})


@app.get("/api/state")
def get_state():
    with connection() as db:
        row = db.execute("SELECT payload, updated_at FROM app_state WHERE id = 1").fetchone()
    return jsonify({"state": json.loads(row[0]) if row else None, "updatedAt": row[1] if row else None})


@app.put("/api/state")
def put_state():
    body = request.get_json(silent=True) or {}
    state = body.get("state")
    if not isinstance(state, dict) or not isinstance(state.get("workflows"), list):
        return jsonify({"error": "유효한 Workflow 상태가 필요합니다."}), 400
    payload = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    with connection() as db:
        db.execute(
            "INSERT INTO app_state(id, payload, updated_at) VALUES(1, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=CURRENT_TIMESTAMP",
            (payload,),
        )
    return jsonify({"saved": True})


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:path>")
def static_files(path):
    return send_from_directory(BASE_DIR, path)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5050")), debug=True)
