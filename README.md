# Climate Risk Navigator

A VS Code-ready Flask + JavaScript climate risk dashboard.

## Features
- City name → Open-Meteo geocoding
- City coordinates → live weather data
- Location-specific risk calculation
- Heat, flood, drought, water stress, exposure, infrastructure and vegetation indicators
- Adaptation recommendations
- SQLite assessment history
- Fixed JavaScript coordinate `.toFixed()` error
- Responsive dashboard

## Requirements
- Python 3.9+
- Internet connection

## Windows / VS Code
1. Open this folder in VS Code.
2. Open Terminal.
3. Run:
   `python -m pip install -r backend\requirements.txt`
4. Run:
   `python backend\app.py`
5. Open:
   `http://127.0.0.1:5000/`

## Optional
Double-click `run_windows.bat` to install dependencies and start the app.

## Health check
Open:
`http://127.0.0.1:5000/api/health`

## Note
This is a project/demo climate-risk screening model. Weather values come from Open-Meteo; the final risk score is a project-defined screening formula and is not an official disaster-risk assessment.
