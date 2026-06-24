#!/bin/bash
# Exit on error
set -e

REPO_DIR="/home/gemini/repos/kbs-cloud/starswarm"
APP_NAME="starswarm"
DEFAULT_OFFSET=2  # Offset in the port ranges

# Determine if we are deploying production or test
DEPLOY_ENV="testing"
if [ "$1" == "prod" ] || [ "$DEPLOY_TYPE" == "prod" ] || [ "$DEPLOY_ENV" == "production" ]; then
    DEPLOY_ENV="production"
fi

echo "=== Starting Star-Swarm Deployment ($DEPLOY_ENV) ==="

# Find Node.js path (default to NVM directory if not in current PATH)
NODE_EXEC=$(which node || echo "/home/gemini/.nvm/versions/node/v24.16.0/bin/node")
NODE_BIN=$(dirname "$NODE_EXEC")
export PATH="$NODE_BIN:$PATH"

# Assign ports and directories based on environment
if [ "$DEPLOY_ENV" == "production" ]; then
    DEPLOY_DIR="/servers/$APP_NAME"
    FRONTEND_PORT=$((19000 + DEFAULT_OFFSET))
    BACKEND_PORT=$((20000 + DEFAULT_OFFSET))
    SERVICE_NAME="$APP_NAME"
    SERVICE_DESC="Star-Swarm Production Service"
else
    DEPLOY_DIR="/servers/dev/$APP_NAME"
    FRONTEND_PORT=$((28000 + DEFAULT_OFFSET))
    BACKEND_PORT=$((29000 + DEFAULT_OFFSET))
    SERVICE_NAME="$APP_NAME-dev"
    SERVICE_DESC="Star-Swarm Dev/Testing Service"
fi

# Prepare deploy folder
echo "Preparing deploy folder at $DEPLOY_DIR..."
if [ ! -d "$DEPLOY_DIR" ]; then
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown -R gemini:gemini "$DEPLOY_DIR"
fi

# 1. Sync files from repos to deploy directory
echo "Syncing files..."
sudo rsync -av --delete \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude 'starswarm.db' \
  --exclude 'test-results/' \
  --exclude '.env' \
  "$REPO_DIR/" "$DEPLOY_DIR/"

sudo chown -R gemini:gemini "$DEPLOY_DIR"

# 1b. Sync shared files to /servers/shared
echo "Syncing shared files..."
sudo mkdir -p /servers/shared
sudo rsync -av --delete /home/gemini/repos/kbs-cloud/shared/ /servers/shared/
sudo chown -R gemini:gemini /servers/shared

# 2. Install/update dependencies in deploy directory
echo "Installing dependencies..."
cd "$DEPLOY_DIR"
npm install

# Write systemd service file
echo "Configuring systemd service ($SERVICE_NAME)..."
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=$SERVICE_DESC
After=network.target

[Service]
Type=simple
User=gemini
Group=gemini
WorkingDirectory=$DEPLOY_DIR
ExecStart=$NODE_BIN/npm run dev
Restart=always
Environment=NODE_ENV=production FRONTEND_PORT=$FRONTEND_PORT BACKEND_PORT=$BACKEND_PORT AUTH_SERVER_URL=http://localhost:20001 HUB_API_URL=http://localhost:20000
EnvironmentFile=/etc/environment
Environment="PATH=$NODE_BIN:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=multi-user.target
EOF

# Reload and restart service
echo "Reloading systemd and restarting $SERVICE_NAME service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

# Handle Git Tagging
if [ "$DEPLOY_ENV" == "production" ]; then
    echo "Creating release tags..."
    cd "$REPO_DIR"
    TAG_NAME="prod-$APP_NAME-v$(date +%Y%m%d-%H%M%S)"
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo "Creating git tag $TAG_NAME..."
        git tag "$TAG_NAME"
        # Push tag, catch errors gracefully
        git push origin "$TAG_NAME" >/dev/null 2>&1 || echo "Warning: Could not push git tag to remote."
    fi
else
    echo "Skipping git tagging for test/dev deployment."
fi

echo "=== Deployment Finished Successfully ($DEPLOY_ENV) ==="
