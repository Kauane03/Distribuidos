#!/usr/bin/env bash

# Script de Inicialização Facilitada - Pet Tracker Distribuído (UFMA)
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo "🐾 PET TRACKER DISTRIBUÍDO - UFMA (SISTEMAS DISTRIBUÍDOS) 🐾"
echo "=========================================================="

MODE=${1:-"docker"}

if [ "$MODE" = "docker" ]; then
    echo "🐳 Iniciando ambiente completo via Docker Compose..."
    docker compose up --build
elif [ "$MODE" = "infra" ]; then
    echo "📦 Subindo apenas infraestrutura base (MySQL + Mosquitto)..."
    docker compose up -d mysql mosquitto
    echo "Pronto! MySQL na porta 3306 e Mosquitto na porta 1883."
elif [ "$MODE" = "sim" ]; then
    echo "🚀 Iniciando simulador Python..."
    "$DIR/simulators/.venv/bin/python" "$DIR/simulators/main.py" --interval 3
else
    echo "Uso: ./start.sh [docker | infra | sim]"
    echo "  docker : Executa todos os serviços via Docker Compose (padrão)"
    echo "  infra  : Sobe apenas MySQL e Mosquitto em background"
    echo "  sim    : Executa os simuladores Python na máquina local"
fi
