@echo off
chcp 65001 > nul
title LIG DNA Smart Todo Web App

echo ======================================================================
echo    🧬 LIG DNA Smart Task Manager 웹 애플리케이션 시작
echo ======================================================================
echo.

set PYTHON_CMD=python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    )
)

echo [1/3] 파이썬 환경 확인 중... (%PYTHON_CMD%)
echo [2/3] 필수 패키지 점검 중...
"%PYTHON_CMD%" -m pip install -r requirements.txt >nul 2>&1

echo [3/3] 브라우저 열기 및 플라스크 서버 구동 중...
echo.
echo  접속 주소: http://127.0.0.1:5000
echo  서버를 종료하려면 이 창에서 Ctrl + C 를 누르세요.
echo ======================================================================
echo.

start "" http://127.0.0.1:5000
"%PYTHON_CMD%" app.py

pause
