@echo off
title Cal Ledger Launcher
echo ========================================================
echo       CAL LEDGER - CUSTOMER BALANCE & STATEMENT APP
echo ========================================================
echo Starting local server and opening app in browser...

cd /d "%~dp0python dev"
start /b "" python -u server.py

timeout /t 1 /nobreak >nul
start "" "http://localhost:8000"

exit
