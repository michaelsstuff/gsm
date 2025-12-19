# Game Server Manager

A web application for managing and monitoring game servers running as Docker containers. Provides a user-friendly interface to check server status, view connection details, and control game servers through a secure admin interface.

## Features

- **Server Status Dashboard**: Real-time status indicators for all game servers
- **Server Details**: Connection strings, logos, Steam links, and website links
- **Admin Control Panel**: Start, stop, restart, and backup game servers
- **Docker Integration**: Seamless management via Docker API
- **User Authentication**: Secure role-based access control
- **Automated Backups**: Scheduled MongoDB and game server backups with Discord notifications

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: React with Bootstrap
- **Database**: MongoDB
- **Authentication**: Passport.js with session management
- **Container Management**: Dockerode
- **Deployment**: Docker Compose

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Domain name (for production)

### Installation

```bash
# Clone and navigate to repository
git clone https://github.com/michaelsstuff/gsm.git
cd gsm
```

### Configuration

Run the setup helper to create `.env`, generate random secrets, and capture your domain/email:

```bash
./setup.sh
```

The script fills `MONGO_INITDB_ROOT_PASSWORD`, `SESSION_SECRET`, and `JWT_SECRET` with random values, sets `DOMAIN_NAME` and `EMAIL_ADDRESS` from your prompts, and leaves `CLOUDFLARE_API_TOKEN` empty for you to fill if you use Cloudflare DNS.

Prefer manual setup? Copy the template and edit it yourself:

```bash
cp .env.example .env
vi .env  # or use your preferred editor
```

After configuration, start the application:
```bash
./docker-deploy.sh start
```

### SSL Setup

**Option 1: Let's Encrypt (Recommended)**
```bash
./init-letsencrypt.sh
```

**Option 2: Custom Certificates**
```bash
./docker-deploy.sh custom-ssl /path/to/fullchain.pem /path/to/privkey.pem
```

See `SSL-SETUP.md` for Cloudflare DNS challenge setup.

### First Use

1. Access `https://your-domain` (or `https://localhost` for development)
2. Register first user (automatically becomes admin)
3. Login and navigate to Admin Dashboard
4. Add game servers with Docker container details

### Management Commands

```bash
./docker-deploy.sh start       # Start all containers
./docker-deploy.sh stop        # Stop all containers
./docker-deploy.sh restart     # Restart containers
./docker-deploy.sh rebuild     # Rebuild and restart
./docker-deploy.sh logs        # View container logs
./docker-deploy.sh backup      # Backup MongoDB
```

## Game Server Management

Add servers through the admin interface with:
- Server name and description
- Docker container name
- Connection details
- Optional: Logo URL, Steam App ID, website link
- Backup schedule and Discord webhook notifications

The application manages external Docker containers (not part of the compose stack) via the mounted Docker socket.

## Security Notes

- **Change all default secrets** in `.env` before production use
- Use HTTPS in production (enforce via nginx config)
- MongoDB authentication is enabled by default
- First registered user becomes admin automatically
- Docker socket access requires appropriate container privileges

## Troubleshooting

- **Container issues**: Check logs with `./docker-deploy.sh logs`
- **Database errors**: Verify MongoDB credentials in `.env`
- **SSL problems**: Ensure domain DNS points to server
- **Docker API errors**: Verify `/var/run/docker.sock` mount permissions

## License

GNU General Public License v3.0 - See `LICENSE` file

## Contributing

Contributions welcome! Please submit pull requests or open issues for bugs and feature requests.