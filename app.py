import json
import os
import sqlite3
import secrets
import time
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, session, redirect

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "flowline.db"

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get("FLOWLINE_SECRET_KEY") or secrets.token_hex(32)
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")


def gitlab_config():
    return (os.environ.get("GITLAB_URL", "").rstrip("/"),
            os.environ.get("GITLAB_CLIENT_ID", ""),
            os.environ.get("GITLAB_CLIENT_SECRET", ""),
            os.environ.get("GITLAB_REDIRECT_URI", "http://127.0.0.1:5050/auth/gitlab/callback"))


@app.get("/api/auth")
def auth_status():
    base, client, secret, _ = gitlab_config()
    return jsonify({"configured": bool(base and client and secret), "user": current_identity()})


def current_identity():
    return session.get("user") or session.get("display_user")


@app.post("/api/auth/name")
def set_display_name():
    if request.headers.get("Origin") and request.headers["Origin"] != request.host_url.rstrip("/"):
        return jsonify({"error": "다른 사이트의 요청은 허용되지 않습니다."}), 403
    name = (request.get_json(silent=True) or {}).get("name")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
        return jsonify({"error": "이름을 1~80자로 입력해 주세요."}), 400
    session["display_user"] = {"id": None, "username": "", "name": name.strip(), "provider": "local"}
    return jsonify({"user": current_identity()})


@app.get("/auth/gitlab")
def gitlab_login():
    base, client, secret, callback = gitlab_config()
    if not (base and client and secret):
        return "GitLab OAuth 환경변수를 설정해 주세요.", 503
    session["oauth_state"] = secrets.token_urlsafe(32)
    session["oauth_started"] = time.time()
    return redirect(base + "/oauth/authorize?" + urlencode({"client_id": client,
        "redirect_uri": callback, "response_type": "code", "scope": "read_user",
        "state": session["oauth_state"]}))


@app.get("/auth/gitlab/callback")
def gitlab_callback():
    expected = session.pop("oauth_state", "")
    started = session.pop("oauth_started", 0)
    if not expected or not secrets.compare_digest(expected, request.args.get("state", "")) or time.time() - started > 600:
        return "로그인 요청이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.", 400
    if not request.args.get("code"):
        return "GitLab 로그인이 승인되지 않았습니다.", 400
    base, client, secret, callback = gitlab_config()
    try:
        data = urlencode({"grant_type": "authorization_code", "client_id": client,
            "client_secret": secret, "code": request.args["code"], "redirect_uri": callback}).encode()
        with urlopen(Request(base + "/oauth/token", data=data), timeout=15) as response:
            token = json.load(response)["access_token"]
        with urlopen(Request(base + "/api/v4/user", headers={"Authorization": "Bearer " + token}), timeout=15) as response:
            user = json.load(response)
        session.clear()
        session["user"] = {"id": user["id"], "username": user["username"], "name": user["name"]}
        return redirect("/")
    except (URLError, ValueError, KeyError):
        return "GitLab 인증에 실패했습니다. 서버 주소, OAuth 설정 및 사내 인증서를 확인해 주세요.", 502


@app.post("/auth/logout")
def logout():
    session.clear()
    return redirect("/")


def stamp_checks(state, previous):
    old_runs = {run.get("id"): run for run in (previous or {}).get("instances", [])}
    for run in state.get("instances", []):
        old_tasks = {task.get("taskId"): task for task in old_runs.get(run.get("id"), {}).get("tasks", [])}
        for task in run.get("tasks", []):
            for collection, flag in (("checklist", "checked"), ("subtasks", "completed")):
                stamp_items(task.get(collection, []), old_tasks.get(task.get("taskId"), {}).get(collection, []), flag)


def stamp_items(items, previous, flag):
    old_checks = {item.get("itemId"): item for item in previous}
    for check in items:
        old = old_checks.get(check.get("itemId"), {})
        if check.get(flag) and not old.get(flag):
            user = current_identity()
            if not user:
                raise PermissionError("체크하려면 먼저 사용자 이름을 입력해 주세요.")
            check.update(checkedBy=user["name"], checkedUserId=user["id"],
                checkedUsername=user["username"], checkedAt=datetime.now(timezone.utc).isoformat())
        elif check.get(flag):
            for key in ("checkedBy", "checkedUserId", "checkedUsername", "checkedAt"):
                check[key] = old.get(key)
        else:
            for key in ("checkedBy", "checkedUserId", "checkedUsername", "checkedAt"):
                check[key] = None


@app.after_request
def disable_browser_cache(response):
    if request.path == "/" or request.path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


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
    if request.headers.get("Origin") and request.headers["Origin"] != request.host_url.rstrip("/"):
        return jsonify({"error": "다른 사이트의 저장 요청은 허용되지 않습니다."}), 403
    body = request.get_json(silent=True) or {}
    state = body.get("state")
    if not isinstance(state, dict) or not isinstance(state.get("workflows"), list):
        return jsonify({"error": "유효한 Workflow 상태가 필요합니다."}), 400
    with connection() as db:
        row = db.execute("SELECT payload FROM app_state WHERE id = 1").fetchone()
        try:
            stamp_checks(state, json.loads(row[0]) if row else None)
        except PermissionError as error:
            return jsonify({"error": str(error)}), 401
        payload = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
        db.execute(
            "INSERT INTO app_state(id, payload, updated_at) VALUES(1, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=CURRENT_TIMESTAMP",
            (payload,),
        )
    return jsonify({"saved": True, "state": state})


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/favicon.ico")
def favicon():
    return "", 204


@app.get("/<path:path>")
def static_files(path):
    if path not in ("index.html", "styles.css", "relationship.css") and not (path.startswith("src/") and path.endswith(".js")):
        return "Not Found", 404
    return send_from_directory(BASE_DIR, path)


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.environ.get("PORT", "5050")),
        debug=os.environ.get("FLASK_DEBUG") == "1",
        use_reloader=False,
    )
