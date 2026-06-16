#!/bin/bash
set -e

echo "=== Starting deployment to /servers/starswarm ==="

# 1. Sync files from repos to /servers/starswarm
echo "Syncing files..."
sudo rsync -av --delete \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude 'starswarm.db' \
  --exclude 'test-results/' \
  --exclude '.env' \
  /home/gemini/repos/kbs-cloud/starswarm/ /servers/starswarm/

# 1b. Sync shared files to /servers/shared
echo "Syncing shared files..."
sudo mkdir -p /servers/shared
sudo rsync -av --delete /home/gemini/repos/kbs-cloud/shared/ /servers/shared/
sudo chown -R gemini:gemini /servers/shared

# 2. Install/update dependencies in live directory
echo "Installing dependencies in production directory..."
cd /servers/starswarm
/home/gemini/.nvm/versions/node/v24.16.0/bin/npm install

# 3. Restart the systemd user service
echo "Restarting starswarm systemd service..."
sudo systemctl daemon-reload
sudo systemctl restart starswarm.service

echo "=== Deployment finished successfully ==="
