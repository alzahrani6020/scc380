#!/bin/bash
set -e

echo "=========================================="
echo "  SCC380 Oracle Cloud Auto-Setup Script"
echo "=========================================="

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
 curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
 echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
 sudo apt-get update
 sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker || true

# Install docker-compose (standalone)
DOCKER_COMPOSE_VERSION=v2.27.0
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create app directory
mkdir -p ~/scc380 && cd ~/scc380

# Clone repo
git clone https://github.com/alzahrani6020/scc380.git .

# Create .env file
cat > .env << 'ENVEOF'
# Supabase Database
DATABASE_URL=postgresql://postgres.hiwrbnvzwjfencajqmpx:HDC5Es#2c-.J2Z5@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.hiwrbnvzwjfencajqmpx:HDC5Es#2c-.J2Z5@aws-1-eu-central-1.pooler.supabase.com:5432/postgres

# Redis (local container)
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=scc380-super-secret-key-change-this
JWT_EXPIRES_IN=1h

# CORS - Frontend URL
CORS_ORIGINS=https://scc380-web.vercel.app

# MinIO (optional - leave empty if not using)
MINIO_ENDPOINT=
MINIO_PORT=9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=

# Ollama (optional - leave empty if not using)
OLLAMA_URL=
ENVEOF

echo ""
echo "=========================================="
echo "  Building & Starting Services..."
echo "=========================================="

# Build and run
docker-compose -f docker-compose.oracle.yml up -d --build

echo ""
echo "=========================================="
echo "  ✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "API running on: http://$(curl -s ifconfig.me):3001"
echo ""
echo "To view logs: docker-compose -f docker-compose.oracle.yml logs -f api"
echo "To stop:     docker-compose -f docker-compose.oracle.yml down"
echo ""
