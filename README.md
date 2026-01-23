# Game Server Manager

[![Build and Publish](https://github.com/michaelsstuff/gsm/actions/workflows/build-publish.yml/badge.svg)](https://github.com/michaelsstuff/gsm/actions/workflows/build-publish.yml)
[![Docker Backend](https://img.shields.io/docker/v/michaelsstuff/gsm-backend?label=backend&logo=docker)](https://hub.docker.com/r/michaelsstuff/gsm-backend)
[![Docker Frontend](https://img.shields.io/docker/v/michaelsstuff/gsm-frontend?label=frontend&logo=docker)](https://hub.docker.com/r/michaelsstuff/gsm-frontend)
[![Docker Pulls](https://img.shields.io/docker/pulls/michaelsstuff/gsm-backend?logo=docker)](https://hub.docker.com/r/michaelsstuff/gsm-backend)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![React](https://img.shields.io/badge/React-18+-blue?logo=react)
![MongoDB](https://img.shields.io/badge/MongoDB-5.0-green?logo=mongodb)
![Docker](https://img.shields.io/badge/Docker-Required-blue?logo=docker)

Web application for managing game servers running as Docker containers. Features real-time status monitoring, backup scheduling, and Discord notifications via a secure admin interface.

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Management](#management)
- [Volume Mounts](#volume-mounts)
- [Game Server Backups](#game-server-backups)
- [Troubleshooting](#troubleshooting)
- [Migration Guide](#migration-guide)
- [Development](#development)
- [License](#license)
- [Contributing](#contributing)

## What This Is (and Isn't)

**GSM is a management interface** for game servers that already exist as Docker containers. It provides a web UI to:
- Monitor status of your game server containers
- Start, stop, and restart containers
- Schedule and manage backups
- View server details and connection info

**GSM does NOT:**
- Create or provision new game servers
- Install game server software
- Manage game server configurations
- Replace tools like LinuxGSM, AMP, or Pterodactyl

Your game servers must already be running as Docker containers before adding them to GSM.

## Features

- **Server Dashboard**: Real-time status indicators and connection details
- **Admin Control**: Start, stop, restart, and backup game servers
- **Automated Backups**: Scheduled backups with Discord webhook notifications
- **User Authentication**: Role-based access control (first user becomes admin)
- **Docker Integration**: Manages external containers via Docker API
- **SSL Management**: Simple HTTPS setup via Nginx Proxy Manager web UI

## Screenshots

<details>
<summary><b>📸 View Application Screenshots</b> (click to expand)</summary>

<div align="center">
  
  <img src="docs/images/gameservers_overview.png" alt="Game Servers Overview" width="800"/>
  <p><em>Server dashboard with real-time status monitoring and quick actions</em></p>
  
  <img src="docs/images/gameserver_detail.png" alt="Server Detail View" width="800"/>
  <p><em>Detailed server information and connection details</em></p>
  
  <img src="docs/images/gameserver_detail_admin.png" alt="Admin Control Panel" width="800"/>
  <p><em>Admin control panel for managing game servers</em></p>

</div>

</details>

## Architecture

See [docs/architecture.md](docs/architecture.md) for traffic flow diagrams and security model.

## Quick Start

### TL;DR (for experienced users)

```bash
mkdir gsm && cd gsm
curl -O https://raw.githubusercontent.com/michaelsstuff/gsm/main/docker-compose.yml
export MONGO_PASSWORD=$(openssl rand -hex 24)
export SESSION_SECRET=$(openssl rand -hex 48)
export JWT_SECRET=$(openssl rand -hex 48)
docker compose up -d
# Configure SSL at http://YOUR_IP:81, then access https://your-domain.com
```

### Prerequisites

- Docker and Docker Compose
- Domain name pointing to your server
- Ports 80, 81, and 443 available

### 1. Create docker-compose.yml

```bash
mkdir gsm && cd gsm
```

Create `docker-compose.yml`:

```yaml
services:
  nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:latest
    container_name: gsm-proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - gsm-proxy-data:/data
      - gsm-proxy-letsencrypt:/etc/letsencrypt
    networks:
      - gsm-network
    environment:
      DISABLE_IPV6: ${DISABLE_IPV6:-false}

  mongodb:
    image: mongo:5.0
    container_name: gsm-mongodb
    restart: unless-stopped
    volumes:
      - mongodb-data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:?MONGO_PASSWORD must be set}
    networks:
      - gsm-network

  backend:
    image: michaelsstuff/gsm-backend:latest
    container_name: gsm-backend
    restart: unless-stopped
    depends_on:
      - mongodb
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5000/api/auth/status', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${BACKUP_PATH:-./backups}:/app/backups
      - ${GAME_VOLUMES_PATH:-/var/opt/container-volumes}:/app/container-volumes:ro
    environment:
      NODE_ENV: production
      PORT: 5000
      CLIENT_URL: ${CLIENT_URL:-http://localhost:3000}
      MONGO_URI: mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/gameserver-manager?authSource=admin
      SESSION_SECRET: ${SESSION_SECRET:?SESSION_SECRET must be set}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET must be set}
      BACKUP_PATH: /app/backups
    networks:
      - gsm-network

  frontend:
    image: michaelsstuff/gsm-frontend:latest
    container_name: gsm-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - gsm-network

networks:
  gsm-network:
    driver: bridge

volumes:
  mongodb-data:
  gsm-proxy-data:
  gsm-proxy-letsencrypt:
```

### 2. Configure Environment

Create `.env`:

```env
MONGO_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -hex 48)
JWT_SECRET=$(openssl rand -hex 48)
```

Or use shell exports:

```bash
export MONGO_PASSWORD=$(openssl rand -hex 24)
export SESSION_SECRET=$(openssl rand -hex 48)
export JWT_SECRET=$(openssl rand -hex 48)
```

### 3. Start Services

```bash
docker compose up -d
```

### 4. Configure SSL

> 💡 **Local Testing:** Use `localhost` as Domain Name and skip SSL configuration (access via `http://localhost`).

1. Access NPM: `http://YOUR_SERVER_IP:81`
2. On first visit, register admin account
3. Add Proxy Host:
   - Domain: `your-domain.com`
   - Forward to: `gsm-frontend` port `80`
   - Enable: Block Common Exploits, Websockets Support
4. SSL Tab: Request SSL Certificate, enable Force SSL and HSTS
5. Access: `https://your-domain.com`

📚 Full NPM guide: https://nginxproxymanager.com/guide/

### 5. First Use

1. Register first user (auto-admin)
2. Login → Admin Dashboard
3. Add game servers with Docker container names

---

## Management

```bash
# View logs
docker compose logs -f

# Update images
docker compose pull && docker compose up -d

# Restart
docker compose restart

# Stop
docker compose down

# Backup MongoDB
docker exec gsm-mongodb mongodump \
  --username admin \
  --password YOUR_MONGO_PASSWORD \
  --authenticationDatabase admin \
  --db gameserver-manager \
  --archive=/data/db/backup.gz \
  --gzip
```

## Volume Mounts

Backend requires these mounts:

| Mount | Purpose |
|-------|---------|
| `/var/run/docker.sock` | Docker API access to control containers |
| `/var/opt/container-volumes` | Parent directory containing game server data (read-only) |
| `./backups` | Where backup archives are stored |

### Game Server Data Structure

For backups to work, your game server containers must store their persistent data in subdirectories named after the **container name** you configure in GSM.

**Example:** When you add a server in GSM with container name `minecraft-server`, the backup system looks for data at:
```
/var/opt/container-volumes/minecraft-server/
```

You control this by configuring your game server's Docker volume mounts:

```yaml
# Your game server's docker-compose.yml
services:
  minecraft-server:                    # ← This is the container name
    image: itzg/minecraft-server
    volumes:
      - /var/opt/container-volumes/minecraft-server:/data  # ← Must match!
```

Expected structure:
```
/var/opt/container-volumes/
├── minecraft-server/      # Matches container name "minecraft-server"
├── valheim-server/        # Matches container name "valheim-server"
└── terraria-server/       # Matches container name "terraria-server"
```

When you trigger a backup in GSM, it archives the directory matching the container name you specified.

Adjust paths in `.env` if your setup differs:

```env
GAME_VOLUMES_PATH=/your/path
BACKUP_PATH=/your/path
```

## Game Server Backups

Configure automated backups per server via Admin Dashboard:

- **Cron Schedule**: e.g., `0 2 * * *` for daily at 2 AM
- **Retention**: Number of backups to keep
- **Discord Webhook**: Optional notifications

Backups execute automatically on schedule or via "Backup Now" button.

## Troubleshooting

See [docs/troubleshooting.md](docs/troubleshooting.md) for common issues and solutions.

## Migration Guide

See [docs/migration-guide.md](docs/migration-guide.md) for step-by-step instructions on moving GSM to a new server.

## Development

See [docs/development.md](docs/development.md) for building from source, project structure, and contribution guidelines.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Issues and pull requests welcome: https://github.com/michaelsstuff/gsm
