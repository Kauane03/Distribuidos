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
elif [ "$MODE" = "scale" ]; then
    REPLICAS=${2:-3}
    echo "⚖️  Iniciando ambiente com Escalabilidade Horizontal (${REPLICAS} réplicas do backend + Nginx LB)..."
    docker compose up --build --scale backend="${REPLICAS}"
elif [ "$MODE" = "official" ]; then
    REPLICAS=${2:-3}
    echo "🏛️  Iniciando Plataforma Oficial do InterSCity (Kong + PostgreSQL + MongoDB + RabbitMQ + Redis + Cataloguer + Collector)..."
    docker compose -f docker-compose.yml -f docker-compose.official.yml up --build --scale backend="${REPLICAS}"
elif [ "$MODE" = "infra" ]; then
    echo "📦 Subindo infraestrutura base (MySQL + Mosquitto + InterSCity + Load Balancer)..."
    docker compose up -d mysql mosquitto interscity loadbalancer
    echo "Pronto! MySQL:3306, Mosquitto:1883, InterSCity:8000, LoadBalancer:3000."
elif [ "$MODE" = "seed" ]; then
    echo "🌱 Executando registro dos 500 recursos no InterSCity Catalog..."
    python3 "$DIR/simulators/seed_interscity.py"
elif [ "$MODE" = "sim" ]; then
    echo "🚀 Iniciando simulador Python com 500 pets virtuais..."
    python3 "$DIR/simulators/main.py" --interval 3
elif [ "$MODE" = "status" ]; then
    echo "📊 Status dos Containers do Cluster:"
    docker compose ps
    echo ""
    echo "📈 Consumo de CPU e Memória (Docker Stats):"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    echo ""
    echo "⚖️  Verificando Balanceamento de Carga Round Robin (Nginx -> Réplicas):"
    for i in 1 2 3; do
        curl -sI http://localhost:3000/health | grep -iE "(HTTP/|X-Served-By)" || true
    done
    echo ""
    echo "🩺 Health Check da API:"
    curl -s http://localhost:3000/health | python3 -m json.tool || true
elif [ "$MODE" = "benchmark" ]; then
    TOTAL_REQS=${2:-1000000}
    echo "⚡ Disparando Teste de Carga Massivo no Cluster (${TOTAL_REQS} requisições)..."
    node "$DIR/benchmark/stress_test_1m.js" "${TOTAL_REQS}"
elif [ "$MODE" = "down" ]; then
    echo "🛑 Parando todos os containers e liberando portas..."
    docker compose -f docker-compose.yml -f docker-compose.official.yml down --remove-orphans || true
    docker compose down --remove-orphans || true
else
    echo "Uso: ./start.sh [docker | scale [N] | official [N] | infra | seed | sim | status | benchmark [N] | down]"
    echo "  docker        : Executa todos os serviços via Docker Compose (padrão)"
    echo "  scale [N]     : Sobe o cluster com N réplicas do backend (ex: ./start.sh scale 3)"
    echo "  official [N]  : Sobe a stack oficial do InterSCity integrada ao Pet Tracker"
    echo "  infra         : Sobe apenas MySQL, Mosquitto, InterSCity e LoadBalancer"
    echo "  seed          : Registra os 1500 recursos no catálogo do InterSCity"
    echo "  sim           : Executa os simuladores Python na máquina local"
    echo "  status        : Exibe status dos containers, métricas e teste do balanceador Nginx"
    echo "  benchmark [N] : Executa teste de carga massivo de 1M requisições (ou N requisições)"
    echo "  down          : Para todos os containers e libera todas as portas"
fi
