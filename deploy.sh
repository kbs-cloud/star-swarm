#!/bin/bash
set -e

echo "=== Starting deployment to ~/live/starswarm ==="

# 1. Sync files from Public/starswarm to live/starswarm
echo "Syncing files..."
rsync -av --delete \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude 'starswarm.db' \
  --exclude 'test-results/' \
  --exclude '.env' \
  /home/gemini/Public/starswarm/ /home/gemini/live/starswarm/

# 2. Install/update dependencies in live directory
echo "Installing dependencies in production directory..."
cd /home/gemini/live/starswarm
/home/gemini/.nvm/versions/node/v24.16.0/bin/npm install

# 3. Restart the systemd user service
echo "Restarting starswarm systemd service..."
systemctl daemon-reload
systemctl restart starswarm.service

echo "=== Deployment finished successfully ==="
