@echo off
title Climate Risk Navigator
cd /d "%~dp0"
echo ================================================
echo        CLIMATE RISK NAVIGATOR
echo ================================================
echo.
python -m pip install -r backend\requirements.txt
if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
)
echo.
echo Starting server...
start "" http://127.0.0.1:5000/
python backend\app.py
pause
