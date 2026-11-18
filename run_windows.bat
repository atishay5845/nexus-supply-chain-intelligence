@echo off
setlocal
cd /d "%~dp0"
if not exist "backend\.venv\Scripts\python.exe" (
  py -3 -m venv backend\.venv
)
call backend\.venv\Scripts\activate.bat
python -m pip install -r backend\requirements.txt
start "NEXUS API" cmd /k "cd /d \"%~dp0backend\" && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
if not exist "frontend\node_modules" (
  cd frontend
  call npm install
  cd ..
)
start "NEXUS UI" cmd /k "cd /d \"%~dp0frontend\" && npm run dev"
echo NEXUS is starting. Open http://localhost:5173 after both terminals are ready.
