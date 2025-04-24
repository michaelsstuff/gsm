# Game Server Manager

A web application for managing and monitoring game servers running as Docker containers. This system provides a user-friendly interface to check server status, view connection details, and control game servers through a secure admin interface.

## Features

- **Server Status Dashboard**: View all game servers with real-time status indicators
- **Server Details**: Connection strings, logos, Steam links, and website links
- **Admin Control Panel**: Start, stop, restart, and backup game servers
- **Docker Integration**: Seamless management of game servers running in Docker containers
- **User Authentication**: Secure access with role-based permissions

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: React with Bootstrap
- **Database**: MongoDB
- **Authentication**: Passport.js with JWT
- **Container Management**: Dockerode for Docker API integration

## Prerequisites

- Node.js 16.x or higher
- MongoDB database
- Docker engine running on the host machine
- Game server Docker containers (already set up)

## Installation

### 1. Clone the repository

```bash
git clone https://your-repository-url/game-server-manager.git
cd game-server-manager
```

### 2. Set up the server

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB connection string and secrets
```

### 3. Set up the client

```bash
# Navigate to client directory
cd ../client

# Install dependencies
npm install
```

## Running the Application

### Development Mode

```bash
# Start the server (from server directory)
npm run dev

# Start the client (from client directory)
npm start
```

The server will run on http://localhost:5000 and the client on http://localhost:3000.

### Production Mode

```bash
# Build the client
cd client
npm run build

# Start the server in production mode
cd ../server
NODE_ENV=production npm start
```

## Docker Support

The application is designed to work with existing game server containers. Make sure your Docker containers have the required scripts for:

- Starting the game server (`start.sh`)
- Stopping the game server (`stop.sh`)
- Restarting the game server (`restart.sh`)
- Backing up the game server (`backup.sh`)

## Initial Setup

1. Start the application
2. Register the first user (automatically becomes an admin)
3. Log in as admin
4. Add your game servers through the admin dashboard

## Security Considerations

- Change the default secrets in the `.env` file
- Set up proper Docker security for container management
- When deploying to production, use HTTPS
- Consider setting up proper MongoDB authentication

## License

MIT License

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request.