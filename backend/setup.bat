@echo off
echo ========================================
echo MoMetric Backend Setup Script
echo ========================================
echo.

echo Step 1: Creating virtual environment...
python -m venv venv
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)
echo ✓ Virtual environment created

echo.
echo Step 2: Activating virtual environment...
call venv\Scripts\activate.bat
echo ✓ Virtual environment activated

echo.
echo Step 3: Installing dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed

echo.
echo Step 4: Creating .env file...
python setup.py
echo ✓ .env file created

echo.
echo ========================================
echo Setup Complete! ✅
echo ========================================
echo.
echo NEXT STEPS:
echo 1. Edit .env file and add your OPENAI_API_KEY
echo 2. Make sure PostgreSQL is running
echo 3. Create database: CREATE DATABASE mometric_db;
echo 4. Run: python run_dev.py
echo.
echo ========================================
pause
