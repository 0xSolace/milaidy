#!/bin/bash
set -e

echo "Vercel build script starting..."

# Export environment variables for Vite
export VITE_CLOUD_ONLY="${VITE_CLOUD_ONLY:-true}"
export VITE_ELIZACLOUD_BASE="${VITE_ELIZACLOUD_BASE:-https://www.elizacloud.ai}"

echo "Environment variables:"
echo "  VITE_CLOUD_ONLY=$VITE_CLOUD_ONLY"
echo "  VITE_ELIZACLOUD_BASE=$VITE_ELIZACLOUD_BASE"

# Patch app/package.json to remove workspace dependencies
cd apps/app
echo "Patching package.json to remove workspace dependencies..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
// Remove workspace dependencies
if (pkg.dependencies) {
  Object.keys(pkg.dependencies).forEach(key => {
    if (pkg.dependencies[key] === 'workspace:*') {
      delete pkg.dependencies[key];
    }
  });
}
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

# Install dependencies in app directory
echo "Installing app dependencies..."
npm install --legacy-peer-deps --no-workspaces

# Build using the local vite
echo "Building app..."
./node_modules/.bin/vite build

echo "Build complete!"
