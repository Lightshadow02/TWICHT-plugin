#!/bin/bash
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --no-audit --no-fund
while true; do node server.js; echo "Serveur arrêté, relance dans 5 s…"; sleep 5; done
