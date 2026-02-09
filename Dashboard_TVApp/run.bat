@echo off
cd /d "%~dp0"
if not exist "venv\Scripts\activate.bat" (
  echo Creare venv...
  python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
python app.py
