#!/bin/bash
# Game Server Manager Deployment Script

echo "Starting deployment process..."

# Build the client
echo "Building React client..."
cd client
npm install
npm run build
cd ..

# Prepare the server
echo "Setting up server..."
cd server
npm install
cd ..

# Create production .env file if it doesn't exist
if [ ! -f server/.env.production ]; then
  echo "Creating production environment file..."
  cp server/.env server/.env.production
  echo "Please edit server/.env.production with your production settings"
fi

echo "Deployment preparation complete!"
echo "Run 'pm2 start server/server.js --name game-server-manager' to start the application"