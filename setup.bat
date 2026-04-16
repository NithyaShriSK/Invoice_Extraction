@echo off
REM Complete Setup Script for Invoice OCR Application (Windows)
REM Run this from the project root: setup.bat

echo.
echo 🚀 Invoice OCR - Automated Setup Script (Windows)
echo ============================================================
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Python not found. Please install Python 3.10+
    exit /b 1
)
echo ✓ Python found

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Node.js not found. Please install Node.js 16+
    exit /b 1
)
echo ✓ Node.js found

REM Setup Backend
echo.
echo Setting up Backend...
cd backend

REM Create virtual environment
if not exist "venv" (
    echo ✓ Creating Python virtual environment...
    python -m venv venv
) else (
    echo ✓ Virtual environment already exists
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install Python dependencies
echo ✓ Installing Python dependencies...
pip install --upgrade pip > nul
pip install -r requirements.txt > nul

REM Create .env file
if not exist ".env" (
    echo ✓ Creating .env file...
    copy .env.example .env
    echo. ⚠ Please update backend\.env with your configuration
) else (
    echo ✓ .env already exists
)

REM Create uploads and output directories
if not exist "..\uploads" mkdir ..\uploads
if not exist "..\output" mkdir ..\output

echo ✓ Backend setup complete

REM Setup Frontend
echo.
echo Setting up Frontend...
cd ..\frontend

REM Create .env.local file
if not exist ".env.local" (
    echo ✓ Creating .env.local file...
    copy .env.example .env.local
) else (
    echo ✓ .env.local already exists
)

REM Install npm dependencies
echo ✓ Installing Node.js dependencies (this may take a few minutes)...
call npm install > nul 2>&1

echo ✓ Frontend setup complete

REM Return to root
cd ..

REM Summary
echo.
echo ============================================================
echo ✓ Setup Complete!
echo ============================================================
echo.
echo Next steps:
echo.
echo 1. Start MongoDB:
echo    mongod
echo.
echo 2. Start Backend (Terminal 1):
echo    cd backend
echo    venv\Scripts\activate.bat
echo    python run.py
echo.
echo 3. Start Frontend (Terminal 2):
echo    cd frontend
echo    npm start
echo.
echo 4. Open in browser:
echo    http://localhost:3000
echo.
echo 5. Test the application:
echo    - Register a new account
echo    - Upload an invoice image
echo    - View OCR results
echo.
echo For detailed instructions, see SETUP_INSTRUCTIONS.md
echo.
pause
