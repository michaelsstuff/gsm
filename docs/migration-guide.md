# Migration Guide

## Migrating GSM to a New Server

**Prerequisites:** Docker/Podman with Compose plugin installed on new server, DNS updated to point to new IP.

### Step 1: Backup Old System

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

### Step 2: Install on New System

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

### Step 3: Restore Data

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

### Step 4: Migrate Game Servers

Migrate your game server containers to the new system. Once running, update container names in GSM admin interface if they changed during migration.

### Step 5: Configure SSL & Verify

1. Access NPM at `http://NEW_SERVER_IP:81`
2. Create proxy host and SSL certificate (see Quick Start section in README)
3. Test login and verify all servers are listed
4. Run manual backup to confirm functionality

## Migration Troubleshooting

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
