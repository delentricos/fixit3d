#!/bin/bash

echo "=== FIXIT3D RESTART ==="

echo "Cerrando servidores anteriores..."
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

sleep 2

echo "Iniciando BACK END..."
(
  cd apps/backend
  source venv/bin/activate
  exec uvicorn app.main:app --reload --port 8000
) &

echo "Iniciando FRONT..."
(
  cd apps/frontend
  exec npm run dev
) &

echo
echo "=== SERVIDORES INICIADOS ==="
echo "BACK END: http://localhost:8000"
echo "FRONT:    http://localhost:5173"
echo
echo "Prueba: curl -s http://localhost:8000/health"
echo

wait
