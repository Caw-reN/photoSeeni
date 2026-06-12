#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting Snaptime Deployment Script for Ubuntu 24.04"

# 1. Update system and install dependencies
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl git

# 2. Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
    echo "✅ Docker is already installed."
fi

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# 3. Clone Repository
REPO_DIR="/opt/snaptime"
if [ -d "$REPO_DIR" ]; then
    echo "🔄 Repository already exists, pulling latest changes..."
    cd $REPO_DIR
    # Reset any local changes to ensure clean pull
    sudo git checkout .
    sudo git pull origin main
else
    echo "📥 Cloning Snaptime repository..."
    sudo git clone https://github.com/Caw-reN/photoSeeni.git $REPO_DIR
    cd $REPO_DIR
fi

# 4. Set permissions for Laravel
echo "🔒 Setting permissions..."
sudo chmod -R 777 $REPO_DIR/backend/storage
sudo chmod -R 777 $REPO_DIR/backend/bootstrap/cache

# 5. Set up IP config for API (Important for Cloudflare later)
SERVER_IP=$(curl -s http://checkip.amazonaws.com || echo "localhost")
echo "🌐 Detected Server IP: $SERVER_IP"

# Force frontend to talk to backend port 8000 on the VPS
# Note: Next.js dev server reads this environment variable
if grep -q "NEXT_PUBLIC_API_URL=" $REPO_DIR/frontend/.env.local 2>/dev/null; then
    sudo sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${SERVER_IP}:8000/api|g" $REPO_DIR/frontend/.env.local
else
    echo "NEXT_PUBLIC_API_URL=http://${SERVER_IP}:8000/api" | sudo tee $REPO_DIR/frontend/.env.local
fi

# 6. Build and run containers
echo "🏗️ Building and starting Docker containers..."
sudo docker compose down
sudo docker compose up -d --build

echo ""
echo "🎉 Deployment Complete!"
echo "✅ Backend API is running on port 8000"
echo "✅ Frontend is running on port 3000"
echo ""
echo "👉 You can test it by accessing: http://${SERVER_IP}:3000"
echo "👉 To point Cloudflare, set your Domain's A Record to ${SERVER_IP}"
