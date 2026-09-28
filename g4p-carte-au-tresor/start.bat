@echo off
title Carte au tresor - serveur
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe : https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Installation des dependances...
  call npm install --no-audit --no-fund
)
:boucle
echo.
echo [%date% %time%] Demarrage du serveur...
node server.js
echo.
echo [%date% %time%] Le serveur s'est arrete, relance dans 5 s (Ctrl+C pour quitter)
timeout /t 5 /nobreak >nul
goto boucle
