"""
Dashboard TV App – aplicație Python care actualizează directorul WORKSPACE
(al echipe, playlist-uri) pentru Digital Signage. Rulează local; poate fi împachetată ca .exe cu PyInstaller.
"""
import json
import os
import subprocess
import uuid
from pathlib import Path
from typing import Optional, Tuple

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


@app.route("/api/teams/<name>/delete-resource", methods=["POST"])
def delete_team_resource(name):
    """Șterge fișierul sau directorul din WORKSPACE (ex. documents/folder, photos/file.jpg). La push va fi șters și din git."""
    import shutil
    try:
        team_dir = _team_path(name)
        data = request.get_json() or {}
        src = (data.get("src") or "").strip().replace("\\", "/").strip("/")
        if not src or ".." in src:
            return jsonify({"error": "invalid src"}), 400
        parts = src.split("/")
        if parts[0] not in ("documents", "photos", "videos"):
            return jsonify({"error": "src must be under documents, photos or videos"}), 400
        target = (team_dir / src).resolve()
        if not str(target).startswith(str(team_dir)):
            return jsonify({"error": "invalid path"}), 400
        if not target.exists():
            return jsonify({"ok": True, "message": "already gone"})
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
        return jsonify({"ok": True})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
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


# ---------- Upload document (word, excel, pptx, pdf) -> documents/<folder>/ ----------
DOC_EXT = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt"}
DOC_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
}


def _safe_folder_name(name: str) -> str:
    base = "".join(c for c in name if c.isalnum() or c in " -_").strip() or "doc"
    return base[:50]


@app.route("/api/teams/<name>/upload-document", methods=["POST"])
def upload_document(name):
    """Upload PDF/Word/Excel/PPTX to team/documents/<folder_name>/."""
    try:
        team_dir = _team_path(name)
        team_dir.mkdir(parents=True, exist_ok=True)
        docs_dir = team_dir / "documents"
        docs_dir.mkdir(exist_ok=True)
        if "file" not in request.files:
            return jsonify({"error": "file required"}), 400
        f = request.files["file"]
        if not f or not f.filename:
            return jsonify({"error": "no file selected"}), 400
        fn = (f.filename or "").strip()
        base, ext = os.path.splitext(fn)
        ext = ext.lower()
        if ext not in DOC_EXT:
            return jsonify({"error": "allowed: pdf, docx, doc, xlsx, xls, pptx, ppt"}), 400
        folder_name = _safe_folder_name(base) + "_" + uuid.uuid4().hex[:8]
        dest_dir = docs_dir / folder_name
        dest_dir.mkdir(parents=True, exist_ok=True)
        safe_fn = secure_filename(fn) or base + ext
        dest_file = dest_dir / safe_fn
        f.save(str(dest_file))
        path = f"documents/{folder_name}"
        return jsonify({"ok": True, "path": path})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _parse_range(range_str: str, total_pages: int) -> list:
    """Parse range string to 1-based page numbers. 'all' -> [1..total], '1,3,5' -> [1,3,5], '2-5' -> [2,3,4,5]."""
    s = (range_str or "").strip().lower()
    if not s or s == "all":
        return list(range(1, total_pages + 1))
    out = []
    for part in s.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            try:
                lo, hi = int(a.strip()), int(b.strip())
                for p in range(max(1, lo), min(total_pages, hi) + 1):
                    out.append(p)
            except ValueError:
                pass
        else:
            try:
                p = int(part)
                if 1 <= p <= total_pages:
                    out.append(p)
            except ValueError:
                pass
    return sorted(set(out))


def _convert_pdf_to_images(pdf_path: Path, page_numbers_1based: list, out_dir: Path) -> int:
    import fitz  # pymupdf
    doc = fitz.open(str(pdf_path))
    count = 0
    for i, page_1 in enumerate(page_numbers_1based):
        page_0 = page_1 - 1
        if page_0 < 0 or page_0 >= len(doc):
            continue
        page = doc[page_0]
        pix = page.get_pixmap(dpi=150, alpha=False)
        out_name = f"{i + 1:03d}.png"
        pix.save(str(out_dir / out_name))
        count += 1
    doc.close()
    return count


def _libreoffice_paths():
    """Return list of possible soffice executable paths (PATH names + Windows install dirs)."""
    candidates = ["soffice", "libreoffice"]
    if os.name == "nt":
        for base in (
            os.environ.get("ProgramFiles", "C:\\Program Files"),
            os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"),
        ):
            for sub in ("LibreOffice", "LibreOffice 5", "LibreOffice 6", "LibreOffice 7", "LibreOffice 24", "LibreOffice 25"):
                exe = Path(base) / sub / "program" / "soffice.exe"
                if exe.exists():
                    candidates.append(str(exe))
    return candidates


def _convert_office_to_pdf_win32(office_path: Path, out_dir: Path) -> Tuple[Optional[Path], Optional[str]]:
    """Convert Word/Excel/PPTX to PDF using Microsoft Office (Windows only). Returns (pdf_path, error_message)."""
    if os.name != "nt":
        return None, "Not Windows."
    try:
        import pythoncom
        import win32com.client
    except ImportError:
        return None, "pywin32 not installed. Run: pip install pywin32"
    pythoncom.CoInitialize()
    try:
        suffix = office_path.suffix.lower()
        pdf_path = out_dir / (office_path.stem + ".pdf")
        in_path = os.path.abspath(office_path)
        out_pdf = os.path.abspath(pdf_path)
        app = None
        if suffix in (".doc", ".docx"):
            wdFormatPDF = 17
            app = win32com.client.Dispatch("Word.Application")
            app.Visible = False
            doc = app.Documents.Open(in_path)
            doc.SaveAs(out_pdf, FileFormat=wdFormatPDF)
            doc.Close(SaveChanges=False)
        elif suffix in (".xls", ".xlsx"):
            xlTypePDF = 0
            app = win32com.client.Dispatch("Excel.Application")
            app.Visible = False
            app.DisplayAlerts = False
            book = app.Workbooks.Open(in_path)
            book.ExportAsFixedFormat(Type=xlTypePDF, Filename=out_pdf)
            book.Close(SaveChanges=False)
        elif suffix in (".ppt", ".pptx"):
            ppFixedFormatTypePDF = 2
            out_dir.mkdir(parents=True, exist_ok=True)
            app = win32com.client.Dispatch("PowerPoint.Application")
            app.Visible = True
            pres = app.Presentations.Open(in_path, WithWindow=False)
            pres.ExportAsFixedFormat(out_pdf, ppFixedFormatTypePDF)
            pres.Close()
        else:
            return None, None
        if app:
            app.Quit()
        return (pdf_path if pdf_path.exists() else None), None
    except Exception as e:
        if app:
            try:
                app.Quit()
            except Exception:
                pass
        err = str(e).strip() or type(e).__name__
        return None, err
    finally:
        pythoncom.CoUninitialize()


def _convert_office_to_pdf(office_path: Path, out_dir: Path) -> Tuple[Optional[Path], Optional[str]]:
    """Convert to PDF: try LibreOffice first, then on Windows try Microsoft Office. Returns (path, error_msg)."""
    for cmd in _libreoffice_paths():
        try:
            r = subprocess.run(
                [cmd, "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(office_path)],
                cwd=str(out_dir),
                capture_output=True,
                text=True,
                timeout=120,
            )
            if r.returncode != 0:
                continue
            pdf_name = office_path.stem + ".pdf"
            pdf_path = out_dir / pdf_name
            if pdf_path.exists():
                return pdf_path, None
        except FileNotFoundError:
            continue
    path, err = _convert_office_to_pdf_win32(office_path, out_dir)
    return path, err


@app.route("/api/teams/<name>/convert-document", methods=["POST"])
def convert_document(name):
    """Convert document in src folder to images. Body: { src: 'documents/folder', range: 'all'|'1,3,5'|'2-5' }."""
    try:
        team_dir = _team_path(name)
        data = request.get_json() or {}
        src = (data.get("src") or "").strip().replace("\\", "/").strip("/")
        if not src or ".." in src:
            return jsonify({"error": "invalid src"}), 400
        folder_rel = src.split("/")[0] == "documents" and src or f"documents/{src}"
        folder_abs = (team_dir / folder_rel).resolve()
        if not folder_abs.is_dir() or not str(folder_abs).startswith(str(team_dir)):
            return jsonify({"error": "folder not found"}), 400
        range_str = (data.get("range") or "all").strip()
        doc_file = None
        for f in folder_abs.iterdir():
            if f.is_file() and f.suffix.lower() in DOC_EXT:
                doc_file = f
                break
        if not doc_file:
            return jsonify({"error": "no document file in folder"}), 400
        suffix = doc_file.suffix.lower()
        pdf_path = None
        if suffix == ".pdf":
            pdf_path = doc_file
        else:
            pdf_path, office_err = _convert_office_to_pdf(doc_file, folder_abs)
            if not pdf_path:
                msg = "Install LibreOffice or Microsoft Office to convert Office files. Or upload a PDF instead."
                if office_err:
                    msg += " (Office error: " + office_err[:200] + ")"
                return jsonify({"error": msg}), 400
        import fitz
        doc = fitz.open(str(pdf_path))
        total_pages = len(doc)
        doc.close()
        if total_pages == 0:
            return jsonify({"error": "document has no pages"}), 400
        page_list = _parse_range(range_str, total_pages)
        if not page_list:
            return jsonify({"error": "range resulted in no pages"}), 400
        count = _convert_pdf_to_images(pdf_path, page_list, folder_abs)
        return jsonify({"ok": True, "count": count, "path": folder_rel})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


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
        workspace_rel = str(WORKSPACE_DIR.relative_to(repo_root)).replace("\\", "/")
        subprocess.run(["git", "add", workspace_rel], cwd=cwd, capture_output=True, text=True, timeout=10, check=True)
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
