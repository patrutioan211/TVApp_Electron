"""
Dashboard TV App – aplicație Python care actualizează directorul WORKSPACE
(al echipe, playlist-uri) pentru Digital Signage. Rulează local; poate fi împachetată ca .exe cu PyInstaller.
"""
import json
import os
import subprocess
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")

# Calea către WORKSPACE (rădăcina proiectului TV_App = parent al acestui folder)
BASE_DIR = Path(__file__).resolve().parent
WORKSPACE_DIR = Path(os.environ.get("WORKSPACE_PATH", "../WORKSPACE")).resolve()
if not WORKSPACE_DIR.is_absolute():
    WORKSPACE_DIR = (BASE_DIR / WORKSPACE_DIR).resolve()


def _team_path(name: str) -> Path:
    """Cale absolută pentru echipă; validează că e sub WORKSPACE."""
    name = (name or "").strip().replace("..", "").replace("/", "").replace("\\", "")
    if not name:
        raise ValueError("Invalid team name")
    p = (WORKSPACE_DIR / name).resolve()
    if not str(p).startswith(str(WORKSPACE_DIR)):
        raise ValueError("Invalid team name")
    return p


@app.route("/")
def index():
    return send_from_directory("templates", "dashboard.html")


# ---------- API Echipe ----------
@app.route("/api/teams", methods=["GET"])
def list_teams():
    if not WORKSPACE_DIR.exists():
        return jsonify([])
    teams = [d.name for d in WORKSPACE_DIR.iterdir() if d.is_dir() and not d.name.startswith(".")]
    return jsonify(sorted(teams))


@app.route("/api/teams", methods=["POST"])
def create_team():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    safe = "".join(c for c in name if c.isalnum() or c in " -_").strip() or "team"
    team_dir = _team_path(safe)
    try:
        team_dir.mkdir(parents=True, exist_ok=True)
        (team_dir / "playlist.json").write_text(
            json.dumps({"slides": []}, indent=2), encoding="utf-8"
        )
        for sub in ("documents", "photos", "videos"):
            (team_dir / sub).mkdir(exist_ok=True)
        return jsonify({"ok": True, "name": safe})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/teams/<name>", methods=["DELETE"])
def delete_team(name):
    try:
        team_dir = _team_path(name)
        if not team_dir.exists():
            return jsonify({"error": "not found"}), 404
        import shutil
        shutil.rmtree(team_dir)
        return jsonify({"ok": True})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- API Playlist ----------
@app.route("/api/teams/<name>/playlist", methods=["GET"])
def get_playlist(name):
    try:
        team_dir = _team_path(name)
        pl_path = team_dir / "playlist.json"
        if not pl_path.exists():
            return jsonify({"slides": []})
        data = json.loads(pl_path.read_text(encoding="utf-8"))
        slides = data.get("slides") if isinstance(data.get("slides"), list) else []
        return jsonify({"slides": slides})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/teams/<name>/playlist", methods=["PUT"])
def save_playlist(name):
    try:
        team_dir = _team_path(name)
        team_dir.mkdir(parents=True, exist_ok=True)
        data = request.get_json()
        if not data:
            return jsonify({"error": "body required"}), 400
        slides = data.get("slides") if isinstance(data.get("slides"), list) else []
        for i, s in enumerate(slides):
            if not isinstance(s, dict):
                continue
            if not s.get("id"):
                s["id"] = f"slide-{i + 1}"
        pl_path = team_dir / "playlist.json"
        pl_path.write_text(
            json.dumps({"slides": slides}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return jsonify({"ok": True})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- Upload imagini / video în WORKSPACE/<team>/photos|videos ----------
ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO = {"video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"}


@app.route("/api/teams/<name>/upload", methods=["POST"])
def upload_team_file(name):
    try:
        team_dir = _team_path(name)
        team_dir.mkdir(parents=True, exist_ok=True)
        if "file" not in request.files:
            return jsonify({"error": "file required"}), 400
        f = request.files["file"]
        kind = (request.form.get("kind") or "").strip().lower()
        if kind not in ("image", "video"):
            return jsonify({"error": "kind must be image or video"}), 400
        if not f or not f.filename:
            return jsonify({"error": "no file selected"}), 400
        fn = secure_filename(f.filename) or "file"
        base, ext = os.path.splitext(fn)
        if not ext:
            ext = ".jpg" if kind == "image" else ".mp4"
        unique = f"{base}_{uuid.uuid4().hex[:8]}{ext}"
        if kind == "image":
            folder = "photos"
            if f.content_type and f.content_type not in ALLOWED_IMAGE:
                return jsonify({"error": "invalid image type"}), 400
        else:
            folder = "videos"
            allowed = ALLOWED_VIDEO | {"application/octet-stream"}
            if f.content_type and f.content_type not in allowed:
                return jsonify({"error": "invalid video type"}), 400
        dest_dir = team_dir / folder
        dest_dir.mkdir(exist_ok=True)
        dest = dest_dir / unique
        f.save(str(dest))
        path = f"{folder}/{unique}"
        return jsonify({"ok": True, "path": path})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- Git: helper commit ----------
def _git_head_commit(cwd: str) -> Optional[str]:
    r = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=5,
    )
    if r.returncode != 0:
        return None
    return (r.stdout or "").strip()


# ---------- Git Connect: verificare + return commit ----------
@app.route("/api/git/connect", methods=["GET", "POST"])
def git_connect():
    """Verifică remote și returnează commit-ul curent."""
    repo_root = WORKSPACE_DIR.parent
    if not (repo_root / ".git").exists():
        return jsonify({"ok": False, "error": "No git repo in project root."})
    cwd = str(repo_root)
    try:
        r = subprocess.run(
            ["git", "fetch", "--dry-run"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if r.returncode != 0:
            err = (r.stderr or r.stdout or "").strip() or "Git fetch failed."
            return jsonify({"ok": False, "error": err})
        commit = _git_head_commit(cwd)
        return jsonify({"ok": True, "commit": commit or ""})
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Connection timeout."})
    except FileNotFoundError:
        return jsonify({"ok": False, "error": "Git is not installed."})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@app.route("/api/git/commit", methods=["GET"])
def git_commit():
    """Returnează commit-ul curent (HEAD)."""
    repo_root = WORKSPACE_DIR.parent
    if not (repo_root / ".git").exists():
        return jsonify({"ok": False, "error": "No git repo."})
    commit = _git_head_commit(str(repo_root))
    return jsonify({"ok": True, "commit": commit or ""})


@app.route("/api/git/push", methods=["POST"])
def git_push():
    """Add, commit, push. Validates expectedCommit before proceeding."""
    repo_root = WORKSPACE_DIR.parent
    if not (repo_root / ".git").exists():
        return jsonify({"ok": False, "error": "No git repo."})
    cwd = str(repo_root)
    data = request.get_json() or {}
    expected_commit = (data.get("expectedCommit") or "").strip()
    current = _git_head_commit(cwd)
    if expected_commit and current and current != expected_commit:
        return jsonify({
            "ok": False,
            "error": "Changes have been made in the meantime. Please pull first.",
            "needPull": True,
        })
    try:
        subprocess.run(["git", "add", "-A"], cwd=cwd, capture_output=True, text=True, timeout=10, check=True)
        r = subprocess.run(
            ["git", "commit", "-m", "Dashboard: update workspace"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=10,
        )
        out = (r.stdout or "") + (r.stderr or "")
        if r.returncode != 0 and "nothing to commit" not in out.lower():
            return jsonify({"ok": False, "error": (r.stderr or r.stdout or "Commit failed.").strip()})
        r2 = subprocess.run(["git", "push"], cwd=cwd, capture_output=True, text=True, timeout=60)
        if r2.returncode != 0:
            err = (r2.stderr or r2.stdout or "Push failed.").strip()
            return jsonify({"ok": False, "error": err})
        new_commit = _git_head_commit(cwd)
        return jsonify({"ok": True, "message": "Push successful.", "commit": new_commit or ""})
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Timeout."})
    except FileNotFoundError:
        return jsonify({"ok": False, "error": "Git is not installed."})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@app.route("/api/git/pull", methods=["POST"])
def git_pull():
    """Run git pull."""
    repo_root = WORKSPACE_DIR.parent
    if not (repo_root / ".git").exists():
        return jsonify({"ok": False, "error": "No git repo."})
    cwd = str(repo_root)
    try:
        r = subprocess.run(["git", "pull"], cwd=cwd, capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            err = (r.stderr or r.stdout or "Pull failed.").strip()
            return jsonify({"ok": False, "error": err})
        return jsonify({"ok": True, "message": "Pull successful."})
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Timeout."})
    except FileNotFoundError:
        return jsonify({"ok": False, "error": "Git is not installed."})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


if __name__ == "__main__":
    print("WORKSPACE_DIR =", WORKSPACE_DIR)
    # debug=False evită procesul „reloader” care rămânea activ după Ctrl+C
    app.run(host="127.0.0.1", port=5000, debug=False)
