# Game Server Manager - Container Publication Plan

## Overview

Transform GSM from a build-from-source project into a publish-ready container application using pre-built images and [Nginx Proxy Manager](https://nginxproxymanager.com/) for simplified SSL/proxy management.

**Date:** January 14, 2026  
**Status:** ✅ Phase 1-3 Complete - Ready for CI/CD setup  
**Goal:** Enable users to deploy GSM with just `docker compose up -d`

---

## Current State (COMPLETED ✅)

### What Changed

✅ **Removed ALL deployment scripts** - Users use `docker compose` commands directly  
✅ **Simplified nginx config** - HTTP only, no SSL/template logic  
✅ **Added Nginx Proxy Manager** - Web UI for SSL management  
✅ **Updated docker-compose.yml** - NPM service added, frontend ports removed  
✅ **Simplified .env.example** - Clear instructions, removed SSL vars  
✅ **Updated README** - 5-minute quick start guide  
✅ **Tested locally** - All services start and run correctly  

### New User Experience

```bash
# 1. Get files
git clone repo && cd gsm

# 2. Configure
cp .env.example .env
# Edit .env (set domain, generate secrets)

# 3. Start
docker compose up -d

# 4. Configure SSL via NPM web UI at http://YOUR_IP:81

# 5. Access at https://your-domain.com
```

**Total commands: 3** (down from ~10 with old approach)  

---

## Solution: Nginx Proxy Manager + Pre-built Images

### Why Nginx Proxy Manager?

✅ **Web UI** - Users manage SSL certificates through browser  
✅ **Automatic Let's Encrypt** - Built-in ACME client with auto-renewal  
✅ **Multiple Providers** - Supports Cloudflare, Route53, etc. DNS challenges  
✅ **Reverse Proxy** - Handles routing without complex nginx configs  
✅ **No Scripts** - Zero bash scripting for SSL setup  
✅ **Proven Solution** - Widely used in self-hosted communities  

### Architecture Changes

```
BEFORE:
User → nginx (SSL + static files) → backend
       ↓
       Custom certbot scripts + cron jobs

AFTER:
User → Nginx Proxy Manager (SSL + routing) → frontend (nginx, HTTP only)
                                            → backend (HTTP only)
```

---

## Implementation Plan

### Phase 1: Remove SSL Complexity

#### 1.1 Simplify Frontend nginx Configuration

**Current:** `client/nginx.conf`
- Listens on ports 80 and 443
- SSL certificate management
- ACME challenge handling
- Requires DOMAIN_NAME env var substitution

**New:** `client/nginx.conf`
```nginx
# Simple HTTP-only config - NPM handles SSL
server {
    listen 80;
    server_name _;  # Accept any hostname
    root /usr/share/nginx/html;
    index index.html;
    
    client_max_body_size 100M;

    # Static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 1.2 Simplify Frontend Dockerfile

**Changes:**
- Remove nginx template system
- Remove DOMAIN_NAME environment variable
- Keep static build approach

```dockerfile
# Build stage - NO CHANGES
FROM node:25-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage - SIMPLIFIED
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf  # Direct copy, no template
EXPOSE 80  # Only HTTP
CMD ["nginx", "-g", "daemon off;"]
```

#### 1.3 Delete SSL-Related Files

Remove these files entirely:
- `SSL-SETUP.md` - No longer needed
- `docker-deploy.sh` - Replace with simple script
- Large portions of deployment logic

#### 1.4 Update docker-compose.yml

**Remove:**
- Port 443 mapping from frontend
- SSL certificate volume mounts
- DOMAIN_NAME env vars (mostly)

**Add:**
- Nginx Proxy Manager service
- Simplified port mappings

### Phase 2: Add Nginx Proxy Manager

#### 2.1 New docker-compose.yml Structure

```yaml
version: '3.8'

services:
  # Nginx Proxy Manager - Handles SSL and routing
  nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:latest
    container_name: gsm-proxy
    restart: unless-stopped
    ports:
      - "80:80"      # HTTP
      - "443:443"    # HTTPS
      - "81:81"      # Admin UI
    volumes:
      - npm-data:/data
      - npm-letsencrypt:/etc/letsencrypt
    networks:
      - gsm-network
    environment:
      - DISABLE_IPV6=true  # Optional, for IPv4-only setups

  # MongoDB Database
  mongodb:
    image: mongo:5.0
    container_name: gsm-mongodb
    restart: unless-stopped
    volumes:
      - mongodb-data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USERNAME:-admin}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}
    networks:
      - gsm-network

  # Backend API Server
  backend:
    image: ghcr.io/YOUR_USERNAME/gsm-backend:latest  # Pre-built image
    container_name: gsm-backend
    restart: unless-stopped
    depends_on:
      - mongodb
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${BACKUP_PATH:-./backups}:/app/backups
      - ${GAME_VOLUMES_PATH:-/var/opt/container-volumes}:/app/container-volumes:ro
      - ${COMPOSE_PATH:-/var/opt/container-compose}:/app/container-compose:ro
    environment:
      - NODE_ENV=production
      - PORT=5000
      - MONGO_URI=mongodb://${MONGO_USERNAME:-admin}:${MONGO_PASSWORD}@mongodb:27017/gameserver-manager?authSource=admin
      - SESSION_SECRET=${SESSION_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - CLIENT_URL=https://${DOMAIN_NAME}  # Still needed for CORS
    networks:
      - gsm-network

  # Frontend Client (React + nginx)
  frontend:
    image: ghcr.io/YOUR_USERNAME/gsm-frontend:latest  # Pre-built image
    container_name: gsm-frontend
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - gsm-network
    # NO PORT MAPPING - Accessed through NPM only

networks:
  gsm-network:
    driver: bridge

volumes:
  mongodb-data:
  npm-data:
  npm-letsencrypt:
```

#### 2.2 NPM Initial Setup Steps (User Documentation)

```markdown
### First-Time Setup

1. Access NPM admin UI: `http://YOUR_SERVER_IP:81`
2. Default login:
   - Email: `admin@example.com`
   - Password: `changeme`
3. Change admin credentials immediately
4. Add Proxy Host:
   - Domain: `your-domain.com`
   - Scheme: `http`
   - Forward Hostname: `gsm-frontend`
   - Forward Port: `80`
   - Block Common Exploits: ✓
   - Websockets Support: ✓
5. SSL Tab:
   - Request SSL Certificate: ✓
   - Force SSL: ✓
   - HTTP/2 Support: ✓
   - HSTS Enabled: ✓
   - Email: your-email@example.com
   - Use DNS Challenge: ✓ (for Cloudflare)
   - DNS Provider: Cloudflare
   - Credentials: API Token
```

### Phase 3: Simplify Deployment

#### 3.1 New Minimal Deployment Script

Create `deploy.sh` (replaces 315-line `docker-deploy.sh`):

```bash
#!/bin/bash
# Simple deployment script for Game Server Manager
set -euo pipefail

# Check for .env file
if [ ! -f .env ]; then
  echo "Creating .env from template..."
  cp .env.example .env
  echo ""
  echo "⚠️  SETUP REQUIRED"
  echo "Edit .env and set these values:"
  echo "  - DOMAIN_NAME=your-domain.com"
  echo "  - MONGO_PASSWORD=\$(openssl rand -hex 24)"
  echo "  - SESSION_SECRET=\$(openssl rand -hex 48)"
  echo "  - JWT_SECRET=\$(openssl rand -hex 48)"
  echo ""
  exit 1
fi

# Load environment
source .env

# Validate required variables
REQUIRED_VARS="DOMAIN_NAME MONGO_PASSWORD SESSION_SECRET JWT_SECRET"
for var in $REQUIRED_VARS; do
  if [ -z "${!var:-}" ]; then
    echo "Error: $var is not set in .env"
    exit 1
  fi
done

# Detect compose command
if docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "Error: Docker Compose not found"
  exit 1
fi

# Execute command
case "${1:-}" in
  start)
    echo "Starting Game Server Manager..."
    $COMPOSE up -d
    echo ""
    echo "✓ Services started"
    echo ""
    echo "Next steps:"
    echo "1. Configure Nginx Proxy Manager: http://$(hostname -I | awk '{print $1}'):81"
    echo "2. Add proxy host for: $DOMAIN_NAME → gsm-frontend:80"
    echo "3. Enable SSL certificate for your domain"
    echo "4. Access application: https://$DOMAIN_NAME"
    ;;
  stop)
    echo "Stopping Game Server Manager..."
    $COMPOSE down
    ;;
  restart)
    echo "Restarting Game Server Manager..."
    $COMPOSE restart
    ;;
  logs)
    $COMPOSE logs -f "${2:-}"
    ;;
  update)
    echo "Updating to latest images..."
    $COMPOSE pull
    $COMPOSE up -d
    echo "✓ Updated to latest versions"
    ;;
  backup)
    echo "Backing up MongoDB..."
    BACKUP_DIR="${BACKUP_PATH:-./backups}/mongodb"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    docker exec gsm-mongodb mongodump \
      --username "${MONGO_USERNAME:-admin}" \
      --password "$MONGO_PASSWORD" \
      --authenticationDatabase admin \
      --db gameserver-manager \
      --archive="/data/db/backup-$TIMESTAMP.gz" \
      --gzip
    docker cp "gsm-mongodb:/data/db/backup-$TIMESTAMP.gz" "$BACKUP_DIR/"
    echo "✓ Backup created: $BACKUP_DIR/backup-$TIMESTAMP.gz"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|logs|update|backup}"
    echo ""
    echo "Commands:"
    echo "  start   - Start all services"
    echo "  stop    - Stop all services"
    echo "  restart - Restart all services"
    echo "  logs    - View logs (optional: specify service name)"
    echo "  update  - Pull latest images and restart"
    echo "  backup  - Backup MongoDB database"
    exit 1
    ;;
esac
```

#### 3.2 Simplified .env.example

```env
# Domain Configuration
DOMAIN_NAME=example.com

# Database Configuration
MONGO_USERNAME=admin
MONGO_PASSWORD=  # Generate with: openssl rand -hex 24

# Application Secrets
SESSION_SECRET=  # Generate with: openssl rand -hex 48
JWT_SECRET=      # Generate with: openssl rand -hex 48

# Optional: Custom Paths
# BACKUP_PATH=./backups
# GAME_VOLUMES_PATH=/var/opt/container-volumes
# COMPOSE_PATH=/var/opt/container-compose
```

### Phase 4: Build and Publish Container Images

#### 4.1 GitHub Actions Workflow

Create `.github/workflows/build-publish.yml`:

```yaml
name: Build and Publish Container Images

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-frontend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./client
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  build-backend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./server
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

#### 4.2 Update README.md for End Users

```markdown
# Game Server Manager

Web application for managing game servers running as Docker containers.

## Quick Start (5 Minutes)

### Prerequisites
- Docker and Docker Compose installed
- Domain name pointing to your server
- Ports 80, 81, and 443 available

### Installation

1. **Download deployment files:**
```bash
mkdir gsm && cd gsm
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/gsm/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/gsm/main/.env.example
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/gsm/main/deploy.sh
chmod +x deploy.sh
```

2. **Create configuration:**
```bash
cp .env.example .env
# Edit .env and set:
# - DOMAIN_NAME=your-domain.com
# - MONGO_PASSWORD=$(openssl rand -hex 24)
# - SESSION_SECRET=$(openssl rand -hex 48)
# - JWT_SECRET=$(openssl rand -hex 48)
```

3. **Start services:**
```bash
./deploy.sh start
```

4. **Configure Nginx Proxy Manager:**
- Open `http://YOUR_SERVER_IP:81`
- Login with `admin@example.com` / `changeme` (change immediately!)
- Add Proxy Host:
  - Domain: your-domain.com
  - Forward to: gsm-frontend / port 80
  - Enable SSL (Let's Encrypt)

5. **Access your installation:**
- Visit `https://your-domain.com`
- First registered user becomes admin

### Updates
```bash
./deploy.sh update
```

### Management
```bash
./deploy.sh logs         # View logs
./deploy.sh restart      # Restart services
./deploy.sh backup       # Backup database
./deploy.sh stop         # Stop all services
```

## Required Volume Mounts

Backend container needs access to manage external game servers:
- `/var/run/docker.sock` - Docker API access (required)
- Game server volumes (default: `/var/opt/container-volumes`)
- Compose files (default: `/var/opt/container-compose`)

Configure paths in `.env` if different.
```

### Phase 5: Migration Path

#### For Existing Users

Create `MIGRATION.md`:

```markdown
# Migration Guide: From Custom SSL to Nginx Proxy Manager

## For Existing Installations

### Option 1: Fresh Install (Recommended)

1. **Backup data:**
```bash
./docker-deploy.sh backup
# Backup stored in $BACKUP_PATH/mongodb
```

2. **Stop old installation:**
```bash
./docker-deploy.sh stop
```

3. **Move to new structure:**
```bash
cd ..
mkdir gsm-new && cd gsm-new
# Download new docker-compose.yml
# Copy .env (or create new with secrets)
```

4. **Start with new setup:**
```bash
./deploy.sh start
```

5. **Restore data if needed**

### Option 2: In-Place Update

1. **Backup first!**
```bash
./docker-deploy.sh backup
```

2. **Replace docker-compose.yml** with new version

3. **Update .env** - remove SSL-related vars

4. **Remove old certificates:**
```bash
rm -rf ./data/certbot
```

5. **Start new stack:**
```bash
docker compose down
docker compose up -d
```

6. **Configure NPM** as described in README

## Benefits After Migration

✅ No more SSL script management  
✅ GUI-based certificate management  
✅ Automatic certificate renewal (built-in)  
✅ Easier troubleshooting  
✅ Multi-domain support  
✅ Better logging and monitoring  
```

---

## Implementation Checklist

### Code Changes

- [ ] Update `client/nginx.conf` - remove SSL, use simple HTTP config
- [ ] Update `client/Dockerfile` - remove template system
- [ ] Update `docker-compose.yml` - add NPM, remove SSL volumes
- [ ] Create new `deploy.sh` - replace 315-line script
- [ ] Update `.env.example` - remove SSL-related vars
- [ ] Delete `SSL-SETUP.md`
- [ ] Delete or archive `docker-deploy.sh`
- [ ] Delete `setup.sh` (functionality moved to deploy.sh)

### New Files

- [ ] `.github/workflows/build-publish.yml` - CI/CD for images
- [ ] `PUBLISH-PLAN.md` - This document
- [ ] `MIGRATION.md` - Migration guide for existing users
- [ ] Update `README.md` - New quick start instructions

### Documentation

- [ ] Update README.md with NPM setup instructions
- [ ] Create user guide for NPM configuration
- [ ] Document volume mount requirements
- [ ] Add troubleshooting section for NPM
- [ ] Update architecture diagrams

### Testing

- [ ] Test fresh installation with new stack
- [ ] Verify NPM proxy to frontend works
- [ ] Verify SSL certificate generation via NPM
- [ ] Test backend API through NPM proxy
- [ ] Verify game server management still works
- [ ] Test backup/restore procedures
- [ ] Multi-architecture build testing (amd64, arm64)

### Publishing

- [ ] Set up GitHub Container Registry
- [ ] Configure repository secrets for CI/CD
- [ ] Create initial release tag (v1.0.0)
- [ ] Publish images to GHCR
- [ ] Verify images pull correctly
- [ ] Update Docker Hub (optional)

---

## Timeline Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1 | Remove SSL complexity | 2-3 hours |
| 2 | Add NPM to compose | 1 hour |
| 3 | Simplify deployment | 2 hours |
| 4 | CI/CD setup | 2-3 hours |
| 5 | Documentation | 2-3 hours |
| **Total** | | **9-12 hours** |

---

## Benefits Summary

### For Users

| Before | After |
|--------|-------|
| Build from source (5-10 min) | Pull images (30 sec) |
| Run complex SSL setup script | Configure SSL in web UI |
| Edit multiple config files | Edit single .env file |
| Manage certbot cron jobs | Automatic renewal (built-in) |
| Troubleshoot bash scripts | View logs in NPM UI |
| Custom domains need script rerun | Add domains in NPM UI |

### For Maintainers

| Before | After |
|--------|-------|
| Maintain 315-line bash script | Maintain 60-line script |
| Debug SSL issues across platforms | NPM handles it |
| Test Docker + Podman separately | Standard compose works |
| Document complex setup | Point to NPM docs |
| Support various SSL scenarios | One approach for all |

---

## Risks and Mitigations

### Risk: Users unfamiliar with NPM

**Mitigation:** 
- Detailed screenshots in documentation
- Video tutorial (optional)
- Pre-configured NPM template (optional)

### Risk: Breaking change for existing users

**Mitigation:**
- Clear migration guide
- Keep old method documented
- Version new approach as 2.0.0

### Risk: NPM adds another container

**Mitigation:**
- NPM is lightweight (~100MB)
- Single NPM can manage multiple apps
- Users likely already use it for other services

### Risk: Port 81 conflicts

**Mitigation:**
- Document how to change NPM admin port
- Make it configurable in compose file

---

## Success Criteria

✅ New user can deploy in < 5 minutes  
✅ No bash scripting required  
✅ SSL certificates work first try  
✅ Images available on GHCR  
✅ Multi-architecture support  
✅ Documentation clear for non-technical users  
✅ Existing installations can migrate  
✅ CI/CD builds on every commit  

---

## Next Steps

1. **Review this plan** - Get feedback on approach
2. **Create feature branch** - `feature/npm-migration`
3. **Implement Phase 1** - Remove SSL complexity
4. **Test locally** - Verify NPM integration works
5. **Implement CI/CD** - Set up image publishing
6. **Update docs** - New user-facing documentation
7. **Release v2.0.0** - Major version for breaking changes

---

## Questions to Resolve

- [ ] Preferred container registry? (GitHub Container Registry vs Docker Hub)
- [ ] Repository naming convention? (gsm-frontend vs gsm/frontend)
- [ ] Keep backward compatibility? (Old deploy script in v1 branch)
- [ ] Support other reverse proxies? (Traefik, Caddy) or NPM-only?
- [ ] Include NPM in main compose or separate? (Current: included)
- [ ] Pre-configure NPM via API? (Advanced: auto-setup proxy on first run)
