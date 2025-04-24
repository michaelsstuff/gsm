# Game Server Manager - Quick Start Guide

This guide will help you quickly get your game server management system up and running.

## Initial Setup

### 1. Install Dependencies

Install all dependencies for the server, client, and development tools:

```bash
npm run install-all
```

### 2. Start MongoDB

Ensure MongoDB is running on your system. If you don't have MongoDB installed:

#### Using Docker (recommended)
```bash
docker run -d --name mongodb -p 27017:27017 mongo:latest
```

#### Using a local installation
Start your MongoDB service according to your operating system's instructions.

### 3. Start the Application

To run both the server and client in development mode:

```bash
npm start
```

This will launch:
- Backend server on http://localhost:5000
- Frontend client on http://localhost:3000

## First-time Configuration

1. **Create Admin Account**
   - Open http://localhost:3000 in your browser
   - Click "Register" and create your first user
   - The first registered user automatically becomes an admin

2. **Add Game Servers**
   - Log in with your admin account
   - Navigate to "Admin Dashboard"
   - Click "Add New Server"
   - Enter the information for your Docker game server:
     - Name
     - Connection string
     - Docker container name
     - Logo URL (optional)
     - Steam App ID (optional)
     - Custom command scripts (if different from defaults)

3. **Test Game Server Commands**
   - After adding a game server, test the start/stop functionality
   - If commands don't work, check that:
     - The Docker container exists
     - The command scripts exist within the container
     - The Docker socket is accessible to the application

## Docker Container Requirements

For each game server Docker container, you should have:

1. **Command Scripts**:
   - `start.sh`: Script to start the game server
   - `stop.sh`: Script to gracefully stop the game server
   - `restart.sh`: Script to restart the game server
   - `backup.sh`: Script to back up game data

2. **Proper File Permissions**:
   - Make sure these scripts are executable: `chmod +x *.sh`

## Common Issues

- **Docker Connection Errors**: Ensure the application has access to Docker socket
- **MongoDB Connection Issues**: Check your MongoDB connection in `.env`
- **Script Execution Failures**: Verify script paths and permissions inside containers

## Next Steps

- Set up HTTPS for production use
- Configure proper MongoDB security
- Replace placeholder images with actual game logos
- Set up regular backups for your database