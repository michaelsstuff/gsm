# Game Server Manager - Quick Start Guide

This guide will help you quickly get your game server management system up and running using Docker Compose.

## Initial Setup

### 1. Prerequisites

- Docker and Docker Compose installed on your system
- Domain name configured (for production deployments)
- Basic understanding of Docker concepts

### 2. Deploy with Docker

The easiest way to deploy the Game Server Manager is using the provided docker-deploy.sh script:

```bash
# Make the script executable if needed
chmod +x docker-deploy.sh

# Start the application for the first time
./docker-deploy.sh start
```

On first run, the script will:
- Create an `.env.example` file if not present
- Ask you to configure your environment variables
- Deploy the containers using Docker Compose

### 3. Environment Configuration

Edit the `.env` file with your preferred settings:
- Database credentials
- Domain name
- Admin credentials
- Secret keys

### 4. Accessing the Application

- The frontend will be available at https://your-domain
- For local development, it will be available at https://localhost

## Managing Your Deployment

### Basic Commands

```bash
# Start the application
./docker-deploy.sh start

# Stop the application
./docker-deploy.sh stop

# Restart the application
./docker-deploy.sh restart

# View logs from all containers
./docker-deploy.sh logs

# Backup the MongoDB database
./docker-deploy.sh backup
```

### SSL Configuration

For production use, configure SSL using one of these methods:

1. **Let's Encrypt (Automated)**:
   ```bash
   ./init-letsencrypt.sh
   ```

2. **Custom SSL Certificates**:
   ```bash
   ./docker-deploy.sh custom-ssl ./my-cert.pem ./my-key.pem
   ```

## First-time Application Setup

1. **Create Admin Account**
   - Open https://your-domain in your browser
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

3. **Test Game Server Commands**
   - After adding a game server, test the start/stop functionality
   - Verify that the Docker API can properly communicate with your game server containers

## Troubleshooting

- **Container Startup Issues**: Check logs using `./docker-deploy.sh logs`
- **Database Connection Errors**: Verify MongoDB container is running and credentials are correct
- **SSL Certificate Problems**: Ensure your domain points to your server and certificates are valid
- **Docker API Errors**: Check that the Docker socket is properly mounted in the containers

## Next Steps

- Set up regular backups for your database using `./docker-deploy.sh backup`
- Replace placeholder images with actual game logos
- Configure monitoring for your Docker containers