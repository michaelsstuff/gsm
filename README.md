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
- **Deployment**: Docker Compose for containerized deployment

## Prerequisites

- Docker and Docker Compose
- SSL certificates (for production deployment)

## Installation and Deployment

The Game Server Manager is designed to be deployed using Docker Compose for easier setup and management.

### 1. Clone the repository

```bash
git clone https://your-repository-url/game-server-manager.git
cd game-server-manager
```

### 2. Environment Configuration

```bash
# The system will create an .env file from template on first run
./docker-deploy.sh start
```

After the script creates the .env file, edit it with your preferred settings before continuing deployment.

### 3. Deployment Commands

The `docker-deploy.sh` script provides all necessary commands to manage your deployment:

```bash
# Start the application
./docker-deploy.sh start

# Stop the application
./docker-deploy.sh stop

# Restart the application
./docker-deploy.sh restart

# Rebuild and restart containers
./docker-deploy.sh rebuild

# View container logs
./docker-deploy.sh logs

# Backup MongoDB data
./docker-deploy.sh backup

# Set up custom SSL certificates
./docker-deploy.sh custom-ssl <path-to-fullchain.pem> <path-to-privkey.pem>
```

## SSL Configuration

For production deployment, you have two options:

1. **Let's Encrypt** (Automatic): Follow the instructions in `init-letsencrypt.sh`
2. **Custom SSL**: Use your own certificates with:
   ```bash
   ./docker-deploy.sh custom-ssl ./my-cert.pem ./my-key.pem
   ```

For more details on SSL setup, see the `SSL-SETUP.md` file.

## Initial Setup

1. Deploy the application using `./docker-deploy.sh start`
2. Access the web interface at https://your-domain
3. Register the first user (automatically becomes an admin)
4. Log in as admin
5. Add your game servers through the admin dashboard

## Security Considerations

- Change the default secrets in the `.env` file
- Set up proper Docker security for container management
- Always use HTTPS in production environments
- Configure proper MongoDB authentication

## Quick Start

For a more detailed step-by-step guide, see `QUICK-START.md`.

## License

MIT License

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request.