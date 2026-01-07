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

### SSL Setup (Required Before Starting)

SSL certificates must be configured before starting the application. Choose one option:

**Option 1: Cloudflare DNS Challenge (Recommended for Production)**

Best for most setups - works behind firewalls and doesn't require ports 80/443 open during setup:

```bash
./docker-deploy.sh letsencrypt-cloudflare YOUR_CLOUDFLARE_API_TOKEN
```

Or set `CLOUDFLARE_API_TOKEN` in `.env` and run:

```bash
./docker-deploy.sh letsencrypt-cloudflare
```

**Option 2: Self-Signed Certificates (Development/Testing)**

Quick setup for local development or testing (will show browser warnings):

```bash
./docker-deploy.sh custom-ssl
```

**Option 3: Custom Certificates (Production)**

If you have your own SSL certificates:

```bash
./docker-deploy.sh custom-ssl /path/to/fullchain.pem /path/to/privkey.pem
```

See [SSL-SETUP.md](SSL-SETUP.md) for detailed configuration options and troubleshooting.

### Start Application

After SSL setup is complete, start the application:

```bash
./docker-deploy.sh start
```

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

## Backup System

The application supports two types of backups with different workflows:

### MongoDB Database Backups

Backup application data (users, game server metadata, settings) manually or via scheduled tasks:

```bash
./docker-deploy.sh backup
```

Backups are stored in the configured `BACKUP_PATH` directory under `mongodb/` subdirectory.

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
