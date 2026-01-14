# Game Server Manager - Deployment Guide

## Quick Start (No Git Clone Required!)

Deploy Game Server Manager using just the `docker-compose.yml` file.

### Prerequisites

- Docker and Docker Compose installed
- Domain name pointing to your server
- Ports 80, 81, and 443 available

---

## Option 1: Download Compose File Only (Recommended for Production)

Perfect for deploying on a server using pre-built images.

### Step 1: Download docker-compose.yml

```bash
mkdir gsm && cd gsm
curl -O https://raw.githubusercontent.com/michaelsstuff/gsm/main/docker-compose.yml
```

### Step 2: Set Required Environment Variables

Create a `.env` file or export variables:

```bash
# Required values
export DOMAIN_NAME="gsm.example.com"
export MONGO_PASSWORD=$(openssl rand -hex 24)
export SESSION_SECRET=$(openssl rand -hex 48)
export JWT_SECRET=$(openssl rand -hex 48)

# Optional: Adjust paths if needed
export GAME_VOLUMES_PATH="/var/opt/container-volumes"
export COMPOSE_PATH="/var/opt/container-compose"
export BACKUP_PATH="./backups"
```

Or create `.env` file:

```bash
cat > .env << EOF
DOMAIN_NAME=gsm.example.com
MONGO_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -hex 48)
JWT_SECRET=$(openssl rand -hex 48)
GAME_VOLUMES_PATH=/var/opt/container-volumes
COMPOSE_PATH=/var/opt/container-compose
BACKUP_PATH=./backups
EOF
```

### Step 3: Start Services

```bash
docker compose up -d
```

### Step 4: Configure SSL in Nginx Proxy Manager

1. **Access NPM Admin UI:** `http://YOUR_SERVER_IP:81`

2. **Login with defaults:**
   - Email: `admin@example.com`
   - Password: `changeme`
   - ⚠️ **CHANGE PASSWORD IMMEDIATELY!**

3. **Add Proxy Host:**
   - Hosts → Proxy Hosts → Add Proxy Host
   - **Domain Names:** `gsm.example.com`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `gsm-frontend`
   - **Forward Port:** `80`
   - **Block Common Exploits:** ✓
   - **Websockets Support:** ✓

4. **Enable SSL:**
   - Go to "SSL" tab
   - **SSL Certificate:** Request a new SSL Certificate
   - **Force SSL:** ✓
   - **HTTP/2 Support:** ✓
   - **HSTS Enabled:** ✓
   - **Email Address:** your-email@example.com
   - Click "Save"

5. **Access Application:** `https://gsm.example.com`

---

## Option 2: Development Setup (Build from Source)

For developers who want to modify the code.

### Step 1: Clone Repository

```bash
git clone https://github.com/michaelsstuff/gsm.git
cd gsm
```

### Step 2: Edit docker-compose.yml

Uncomment the `build:` sections and comment out the `image:` lines:

```yaml
backend:
  build:
    context: ./server
    dockerfile: Dockerfile
  # image: ghcr.io/michaelsstuff/gsm-backend:latest
```

```yaml
frontend:
  build:
    context: ./client
    dockerfile: Dockerfile
  # image: ghcr.io/michaelsstuff/gsm-frontend:latest
```

### Step 3: Configure Environment

```bash
cp .env.example .env
# Edit .env and set your values
```

### Step 4: Build and Start

```bash
docker compose build
docker compose up -d
```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN_NAME` | Your domain name | `gsm.example.com` |
| `MONGO_PASSWORD` | MongoDB password | Generate with: `openssl rand -hex 24` |
| `SESSION_SECRET` | Session secret | Generate with: `openssl rand -hex 48` |
| `JWT_SECRET` | JWT secret | Generate with: `openssl rand -hex 48` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_USERNAME` | `admin` | MongoDB admin username |
| `API_PORT` | `5000` | Backend API port |
| `BACKUP_PATH` | `./backups` | Backup storage location |
| `GAME_VOLUMES_PATH` | `/var/opt/container-volumes` | Game server data path |
| `COMPOSE_PATH` | `/var/opt/container-compose` | Compose files path |
| `DISABLE_IPV6` | `false` | Disable IPv6 in NPM |

---

## Management Commands

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Restart services
docker compose restart

# Stop services
docker compose down

# Update to latest images
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

docker cp gsm-mongodb:/data/db/backup.gz ./backup.gz
```

---

## Volume Mounts Explained

### Docker Socket (Required)
```yaml
/var/run/docker.sock:/var/run/docker.sock
```
Allows the backend to manage external game server containers.

### Game Server Volumes (Required)
```yaml
/var/opt/container-volumes:/app/container-volumes:ro
```
**Read-only** access to game server data for backups. Adjust path to match your game server setup.

### Compose Files (Required)
```yaml
/var/opt/container-compose:/app/container-compose:ro
```
**Read-only** access to game server compose files. Adjust path to your setup.

### Backup Storage
```yaml
./backups:/app/backups
```
Where game server backups are stored. Can be adjusted to any host path.

---

## Troubleshooting

### "MONGO_PASSWORD must be set" Error

You need to set the required environment variables:
```bash
export MONGO_PASSWORD=$(openssl rand -hex 24)
export SESSION_SECRET=$(openssl rand -hex 48)
export JWT_SECRET=$(openssl rand -hex 48)
export DOMAIN_NAME=your-domain.com
```

### NPM Not Accessible on Port 81

- Check if port is already in use: `sudo netstat -tlnp | grep :81`
- Verify firewall allows port 81
- Check NPM logs: `docker compose logs nginx-proxy-manager`

### SSL Certificate Generation Fails

- Verify your domain's DNS points to the server IP
- Ensure ports 80 and 443 are accessible from the internet
- Check NPM logs for ACME challenge errors
- For Cloudflare-protected domains, use DNS challenge in NPM

### Backend Can't Connect to MongoDB

- Verify `MONGO_PASSWORD` environment variable is set correctly
- Check MongoDB logs: `docker compose logs mongodb`
- Ensure connection string includes `?authSource=admin`

### Game Server Management Not Working

- Verify Docker socket is mounted: `docker inspect gsm-backend | grep docker.sock`
- Check backend has permissions to access socket
- Verify external game server containers exist: `docker ps -a`
- Check volume mount paths match your actual setup

---

## Security Notes

- **Change NPM default password** immediately after first login
- **Generate strong secrets** using `openssl rand -hex 48`
- **Use HTTPS** - NPM makes this easy with Let's Encrypt
- **Docker socket access** - Backend needs privileged access to manage containers
- **First user is admin** - First registered user automatically gets admin role
- **Firewall** - Only expose ports 80, 443, and temporarily 81 (can restrict 81 to local network)

---

## Next Steps

1. **Register first user** - Visit `https://your-domain.com/register`
2. **Add game servers** - Admin Dashboard → Add Server
3. **Configure backups** - Set up backup schedules per server
4. **Optional: Discord webhooks** - Get notifications for backups and events

---

## Support

- GitHub Issues: https://github.com/michaelsstuff/gsm/issues
- Documentation: https://github.com/michaelsstuff/gsm
- License: GNU GPL v3.0
