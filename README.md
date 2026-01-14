# Game Server Manager

A web application for managing and monitoring game servers running as Docker containers. Provides a user-friendly interface to check server status, view connection details, and control game servers through a secure admin interface.

## Features

- **Server Status Dashboard**: Real-time status indicators for all game servers
- **Server Details**: Connection strings, logos, Steam links, and website links
- **Admin Control Panel**: Start, stop, restart, and backup game servers
- **Docker Integration**: Seamless management via Docker API
- **User Authentication**: Secure role-based access control
- **Automated Backups**: Scheduled MongoDB and game server backups with Discord notifications
- **Nginx Proxy Manager**: Simple SSL/HTTPS management through web UI

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: React with Bootstrap
- **Database**: MongoDB
- **Reverse Proxy**: Nginx Proxy Manager (SSL/HTTPS)
- **Authentication**: Passport.js with session management
- **Container Management**: Dockerode

## Quick Start (5 Minutes)

### Prerequisites

- Docker and Docker Compose installed
- Domain name pointing to your server
- Ports 80, 81, and 443 available

### Step 1: Create docker-compose.yml

Create a new directory and save this as `docker-compose.yml`:

```bash
mkdir gsm && cd gsm
```

Then create `docker-compose.yml` with this content:

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
      - npm-data:/data
      - npm-letsencrypt:/etc/letsencrypt
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
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USERNAME:-admin}
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
    ports:
      - "${API_PORT:-5000}:5000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${BACKUP_PATH:-./backups}:/app/backups
      - ${GAME_VOLUMES_PATH:-/var/opt/container-volumes}:/app/container-volumes:ro
      - ${COMPOSE_PATH:-/var/opt/container-compose}:/app/container-compose:ro
    environment:
      NODE_ENV: production
      PORT: 5000
      CLIENT_URL: https://${DOMAIN_NAME:?DOMAIN_NAME must be set}
      MONGO_URI: mongodb://${MONGO_USERNAME:-admin}:${MONGO_PASSWORD}@mongodb:27017/gameserver-manager?authSource=admin
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
  npm-data:
  npm-letsencrypt:
```

### Step 2: Set Environment Variables

Create a `.env` file with your configuration:

```env
DOMAIN_NAME=your-domain.com
MONGO_PASSWORD=<generate with: openssl rand -hex 24>
SESSION_SECRET=<generate with: openssl rand -hex 48>
JWT_SECRET=<generate with: openssl rand -hex 48>
```

Or set them as environment variables:

```bash
export DOMAIN_NAME="your-domain.com"
export MONGO_PASSWORD=$(openssl rand -hex 24)
export SESSION_SECRET=$(openssl rand -hex 48)
export JWT_SECRET=$(openssl rand -hex 48)
```

### Step 3: Start Services

```bash
docker compose up -d
```

Services will start and pull the necessary images. This may take a few minutes on first run.

### Step 4: Configure SSL (Nginx Proxy Manager)

> 💡 **Local Testing:** For local testing without a domain, use `localhost` as the Domain Name and skip the SSL tab (access via `http://localhost`).
> 
> 📚 **Full Documentation:** See the [official Nginx Proxy Manager guide](https://nginxproxymanager.com/guide/) for advanced configuration options.

1. **Access NPM Admin UI:** `http://YOUR_SERVER_IP:81`

2. **Login with default credentials:**
   - Email: `admin@example.com`
   - Password: `changeme`
   - ⚠️ **Change password immediately!**

3. **Add Proxy Host:**
   - Domain Names: `your-domain.com` (or `localhost` for local testing)
   - Scheme: `http`
   - Forward Hostname / IP: `gsm-frontend`
   - Forward Port: `80`
   - Block Common Exploits: ✓
   - Websockets Support: ✓

4. **SSL Tab:**
   - SSL Certificate: Request a new SSL Certificate
   - Force SSL: ✓
   - HTTP/2 Support: ✓
   - HSTS Enabled: ✓
   - Email Address for Let's Encrypt: your-email@example.com
   - ⚠️ **Skip this step if using localhost for testing**

5. **Access your application:** `https://your-domain.com` (or `http://localhost` for local testing)

---

## First Use

1. Visit `https://your-domain.com`
2. Register first user (automatically becomes admin)
3. Login and navigate to Admin Dashboard
4. Add game servers with Docker container details

---

## Development

Want to build from source or contribute? See [DEVELOPMENT.md](DEVELOPMENT.md) for instructions.

---

## Management Commands

```bash
# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Restart services
docker compose restart

# Stop services
docker compose down

# Update to latest images (when published)
docker compose pull
docker compose up -d

# Backup MongoDB
docker exec gsm-mongodb mongodump \
  --username admin \
  --password YOUR_MONGO_PASSWORD \
  --authenticationDatabase admin \
  --db gameserver-manager \
  --archive=/data/db/backup.gz \
  --gzip
```

## Required Volume Mounts

The backend container needs access to manage external game server containers:

- `/var/run/docker.sock` - Docker API access (required)
- Game server volumes (default: `/var/opt/container-volumes`)
- Compose files (default: `/var/opt/container-compose`)

Edit paths in `.env` if your setup is different.

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
- **Use HTTPS in production** - configured via Nginx Proxy Manager
- MongoDB authentication is enabled by default
- First registered user becomes admin automatically
- Docker socket access requires appropriate container privileges

## Troubleshooting

- **Container issues**: Check logs with `docker compose logs -f`
- **Database errors**: Verify MongoDB credentials in `.env`
- **SSL problems**: Ensure domain DNS points to server (and configure in Nginx Proxy Manager)
- **Docker API errors**: Verify `/var/run/docker.sock` mount permissions

## Backup System

The application supports two types of backups with different workflows:

### MongoDB Database Backups

Backup application data (users, game server metadata, settings) manually:

```bash
docker exec gsm-mongodb mongodump \
  --username admin \
  --password YOUR_MONGO_PASSWORD \
  --authenticationDatabase admin \
  --db gameserver-manager \
  --archive=/data/db/backup-$(date +%Y%m%d-%H%M%S).gz \
  --gzip

# Copy backup to host
docker cp gsm-mongodb:/data/db/backup-*.gz ./backups/
```

Backups are stored in the configured `BACKUP_PATH` directory.

### Game Server Backups

Automated backups of game server data configured individually per server through the admin dashboard:

**Setup Process:**

1. Navigate to Admin Dashboard → Server Settings
2. Configure backup schedule:
   - **Cron Expression**: Define schedule (e.g., `0 2 * * *` for daily at 2 AM)
   - **Retention Policy**: Number of backups to keep (older backups auto-deleted)
   - **Discord Webhook** (optional): URL for backup notifications

**How It Works:**

- Backup jobs register automatically on application startup
- `backupScheduler.js` uses node-cron to execute scheduled backups
- When triggered, the server is stopped, data is archived, then server restarts
- Backups are stored in `BACKUP_PATH` as compressed tar.gz files
- Old backups are automatically pruned based on retention policy
- Discord notifications sent on completion/failure (if webhook configured)

**Requirements:**

Configure these paths in `.env`:

```bash
# Backup storage location (host path)
BACKUP_PATH=/mnt/backup/container
```

The backend container requires these volume mounts (automatically configured in docker-compose.yml):

- `BACKUP_PATH:/app/backups` - Backup destination
- `/var/opt/container-volumes:/app/container-volumes:ro` - Game server data (read-only)
- `/var/opt/container-compose:/app/container-compose:ro` - Compose files (read-only)

**Manual Backup:**

Backup any server immediately via the admin interface "Backup Now" button, which executes the backup process outside the normal schedule.

**Implementation Details:**

See [server/utils/backupScheduler.js](server/utils/backupScheduler.js) for scheduling logic and [server/scripts/backup_container.sh](server/scripts/backup_container.sh) for backup execution.

## License

GNU General Public License v3.0 - See `LICENSE` file

## Known Issues

### Build Warnings

**lodash.get and lodash.isequal deprecation warnings:**
During Docker build, you may see npm warnings about deprecated `lodash.get` and `lodash.isequal` packages. These are transitive dependencies of `react-ace` (used for the file browser code editor) and cannot be resolved until react-ace updates their dependencies. 

- **Impact**: None - these are build-time warnings only
- **Security**: No security vulnerabilities
- **Functionality**: All features work correctly
- **Tracking**: react-ace v14.0.1 (latest) still uses these packages
- **Resolution**: Will be resolved automatically when react-ace updates

These warnings can be safely ignored. The deprecated packages use syntax that npm suggests replacing with modern JavaScript features (optional chaining `?.` and `util.isDeepStrictEqual`), but they still function correctly.

## Contributing

Contributions welcome! Please submit pull requests or open issues for bugs and feature requests.
