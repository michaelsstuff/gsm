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

<details>
<summary><b>Traffic Flow & Security Model</b> (click to expand)</summary>

### Traffic Flow

```mermaid
flowchart TB
    Client[("👤 Client Browser")]
    NPM["🔒 Nginx Proxy Manager<br/>(gsm-proxy)<br/>Ports: 80, 443, 81"]
    Frontend["📱 Frontend Container<br/>(gsm-frontend)<br/>nginx + React SPA<br/>Internal port: 80"]
    Backend["⚙️ Backend Container<br/>(gsm-backend)<br/>Node.js + Express<br/>Internal port: 5000"]
    MongoDB["🗄️ MongoDB<br/>(gsm-mongodb)<br/>Internal port: 27017"]
    Docker["🐳 Docker Socket<br/>/var/run/docker.sock"]
    GameServers["🎮 External Game<br/>Server Containers"]
    
    Client <-->|"HTTPS (443)<br/>your-domain.com<br/>Static files & API calls"| NPM
    NPM <-->|"HTTP (80)<br/>SSL Termination<br/>Proxies all requests"| Frontend
    Frontend -->|"Proxies /api/*<br/>to backend:5000"| Backend
    Backend -->|"Response"| Frontend
    Backend <-->|"Auth & Data"| MongoDB
    Backend -->|"Container Control"| Docker
    Docker -.->|"Manage"| GameServers
    
    style Client fill:#e1f5ff
    style NPM fill:#fff4e1
    style Frontend fill:#e8f5e9
    style Backend fill:#f3e5f5
    style MongoDB fill:#fce4ec
    style Docker fill:#e0f2f1
    style GameServers fill:#fff3e0
    
    subgraph "Internet"
        Client
    end
    
    subgraph "Docker Network (gsm-network)"
        NPM
        Frontend
        Backend
        MongoDB
    end
    
    subgraph "Host System"
        Docker
        GameServers
    end
```

### Security Model

- **🔒 SSL/TLS**: All external traffic encrypted via Nginx Proxy Manager
- **🔐 Internal Communication**: Containers communicate over isolated Docker network (HTTP only)
- **🚫 No Direct Access**: Backend and database not exposed to internet
- **🛡️ Single Entry Point**: Only ports 80, 443 (NPM) and 81 (NPM admin) accessible externally

### Key Design Decisions

1. **Frontend as Reverse Proxy**: Client never connects directly to backend - all API calls proxied through frontend nginx
2. **No Port Exposure**: Backend has no host port mapping, only accessible via Docker network
3. **SSL Termination at Edge**: NPM handles all SSL/TLS, internal services use HTTP
4. **External Container Management**: Game servers exist outside compose stack, managed via Docker socket

</details>

## Quick Start

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
      - ${COMPOSE_PATH:-/var/opt/container-compose}:/app/container-compose:ro
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

Backend requires these mounts to manage external game servers:

- `/var/run/docker.sock` - Docker API access (required)
- `/var/opt/container-volumes` - Game server data (read-only)
- `/var/opt/container-compose` - Compose files (read-only)
- `./backups` - Backup storage

Adjust paths in `.env` if different:

```env
GAME_VOLUMES_PATH=/your/path
COMPOSE_PATH=/your/path
BACKUP_PATH=/your/path
```

## Game Server Backups

Configure automated backups per server via Admin Dashboard:

- **Cron Schedule**: e.g., `0 2 * * *` for daily at 2 AM
- **Retention**: Number of backups to keep
- **Discord Webhook**: Optional notifications

Backups execute automatically on schedule or via "Backup Now" button.

## Troubleshooting

<details>
<summary><b>Common Issues</b> (click to expand)</summary>

**"MONGO_PASSWORD must be set"**
```bash
export MONGO_PASSWORD=$(openssl rand -hex 24)
export SESSION_SECRET=$(openssl rand -hex 48)
export JWT_SECRET=$(openssl rand -hex 48)
```

**NPM not accessible on port 81**
- Check port usage: `sudo netstat -tlnp | grep :81`
- Check logs: `docker compose logs nginx-proxy-manager`

**SSL certificate fails**
- Verify DNS points to server
- Ensure ports 80/443 open
- For Cloudflare, use DNS challenge in NPM

**Backend can't connect to MongoDB**
- Verify `MONGO_PASSWORD` is set
- Check logs: `docker compose logs mongodb`

**Game server management not working**
- Verify socket mount: `docker inspect gsm-backend | grep docker.sock`
- Check containers exist: `docker ps -a`
- Verify volume paths match your setup

</details>

## Migration Guide

<details>
<summary><b>Migrating GSM to a New Server</b> (click to expand)</summary>

**Prerequisites:** Docker/Podman with Compose plugin installed on new server, DNS updated to point to new IP.

#### Step 1: Backup Old System

```bash
cd /path/to/old/gsm
docker compose down

# Create backup directory
mkdir -p ~/gsm-backup

# Export MongoDB
docker compose up -d mongodb
docker exec gsm-mongodb mongodump \
  --username admin \
  --password YOUR_MONGO_PASSWORD \
  --authenticationDatabase admin \
  --db gameserver-manager \
  --archive=/data/db/gsm-backup.gz \
  --gzip

docker cp gsm-mongodb:/data/db/gsm-backup.gz ~/gsm-backup/
docker compose down

# Copy configuration and backups
cp .env docker-compose.yml ~/gsm-backup/
cp -r ./backups ~/gsm-backup/ 2>/dev/null || true
```

Copy `~/gsm-backup` to new server (use your preferred method).

#### Step 2: Install on New System

```bash
mkdir -p ~/gsm && cd ~/gsm

# Copy files from backup
cp ~/gsm-backup/docker-compose.yml .
cp ~/gsm-backup/.env .

# Update .env if needed (volume paths, passwords)
vim .env

# Start MongoDB
docker compose up -d mongodb
sleep 10
```

#### Step 3: Restore Data

```bash
# Import database
docker cp ~/gsm-backup/gsm-backup.gz gsm-mongodb:/tmp/
docker exec gsm-mongodb mongorestore \
  --username admin \
  --password $MONGO_PASSWORD \
  --authenticationDatabase admin \
  --archive=/tmp/gsm-backup.gz \
  --gzip \
  --drop

# Restore backups (optional)
cp -r ~/gsm-backup/backups/* ./backups/ 2>/dev/null || true

# Start all services
docker compose up -d
```

#### Step 4: Migrate Game Servers

Migrate your game server containers to the new system. Once running, update container names in GSM admin interface if they changed during migration.

#### Step 5: Configure SSL & Verify

1. Access NPM at `http://NEW_SERVER_IP:81`
2. Create proxy host and SSL certificate (see Quick Start section)
3. Test login and verify all servers are listed
4. Run manual backup to confirm functionality

### Migration Troubleshooting

**MongoDB connection fails after restore**
- Verify `MONGO_PASSWORD` matches old server
- Check connection string includes `?authSource=admin`
- Test: `docker compose logs mongodb`

**Game servers not visible**
- Check Docker socket mount: `docker inspect gsm-backend | grep docker.sock`
- Verify containers exist: `docker ps -a`
- Check backend logs: `docker compose logs backend`

**Sessions/logins not working**
- Verify `SESSION_SECRET` and `JWT_SECRET` match old server
- Clear browser cookies and try again
- Check backend health: `curl http://localhost:5000/api/auth/status`

**SSL certificate issues**
- DNS propagation incomplete - wait and retry
- Port 80/443 blocked - check firewall
- Use NPM DNS challenge for Cloudflare
- Previous certificates auto-revoked when new server issues cert

**Backup jobs not running**
- Check server models imported correctly
- Verify `backupSchedule` field present: `docker compose exec mongodb mongosh ...`
- Check backend logs for scheduler initialization
- Manually trigger backup to test

**Volume paths incorrect**
- Update paths in `.env` file
- Restart services: `docker compose down && docker compose up -d`
- Verify mounts: `docker inspect gsm-backend`

</details>

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for building from source, project structure, and contribution guidelines.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](https://github.com/michaelsstuff/gsm/blob/master/LICENSE) file for details.

## Contributing

Issues and pull requests welcome: https://github.com/michaelsstuff/gsm
