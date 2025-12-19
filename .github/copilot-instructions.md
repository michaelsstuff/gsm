````instructions
# Game Server Manager - AI Coding Assistant Instructions

## Memory Bank System

- 🧠 **ALWAYS read `/memory-bank/memory-bank-instructions.md` first**
- 🗂 **Load all `/memory-bank/*.md` files before each task**
- 📂 **Also load files from active feature folders (e.g. `/memory-bank/features/`)**
- 📝 **On "/update memory bank", refresh `activeContext.md` & `progress.md`**

## Project Overview
Containerized web application for managing external game server Docker containers. Three-tier architecture: React/nginx frontend, Node.js/Express backend, MongoDB database. **Key distinction**: App runs in containers but manages *external* containers via Docker socket - it does NOT create/destroy game servers.

## Architecture & Critical Data Flow

### Container Structure
- **Frontend**: React SPA with nginx (port 80/443 with SSL)
- **Backend**: Node.js API (port 5000) with Docker socket access
- **Database**: MongoDB 5.0 with authentication
- **External game servers**: Separate Docker containers controlled via API

### How Container Management Works
Game servers are NOT part of the compose stack. Backend accesses them through:
1. Metadata stored in `GameServer` MongoDB model (name, containerName, status)
2. Real Docker container control via `/var/run/docker.sock` mount using Dockerode
3. Status synchronization: DB status updated when GET requests check actual container state

**Critical pattern**: Always check actual container status via `dockerService.getContainerStatus()` before operations, then update DB if status changed.

## Development Workflows

### Primary Commands
```bash
# Setup environment (only needed once)
./setup.sh  # Auto-generates secrets, prompts for domain/email

# SSL setup (REQUIRED before first start)
./docker-deploy.sh letsencrypt-cloudflare    # Production (Cloudflare DNS)
./docker-deploy.sh custom-ssl                 # Development (self-signed)

# Daily operations
./docker-deploy.sh start|stop|restart|rebuild|logs|backup
```

**NEVER use `docker-compose` directly** - deployment script handles environment loading and runtime detection (Docker vs Podman).

### Environment Setup
- First run of `docker-deploy.sh` creates `.env` from `.env.example`
- `setup.sh` auto-generates `MONGO_INITDB_ROOT_PASSWORD`, `SESSION_SECRET`, `JWT_SECRET`
- Must set: `DOMAIN_NAME`, `EMAIL_ADDRESS`, `CLOUDFLARE_API_TOKEN` (if using CF DNS)

### Required Volume Mounts
Backend container needs these host paths:
```yaml
/var/run/docker.sock:/var/run/docker.sock      # Docker API access
/mnt/backup/container2/:/app/backups           # Backup storage
/var/opt/container-volumes:/app/container-volumes:ro   # Game data (read-only)
/var/opt/container-compose:/app/container-compose:ro   # Compose files (read-only)
```

## Code Patterns & Conventions

### Authentication Architecture
**Session-based (NOT JWT for sessions)** - JWT tokens only for bearer auth compatibility:
1. Passport.js LocalStrategy validates username/password
2. Sessions stored in MongoDB via `connect-mongo`
3. First registered user automatically becomes admin (see `User` model)
4. Middleware chain: `isAuthenticated` → `isAdmin` for protected routes
5. Password security check via `HaveIBeenPwned` API (blocks compromised passwords)

Frontend auth:
```javascript
// AuthContext provides: user, isAuthenticated, login, register, logout
const { user, isAuthenticated } = useAuth();
// Check roles: user?.role === 'admin'
```

### Docker Service Layer Pattern
**ALL container operations MUST go through `server/utils/dockerService.js`**:
```javascript
// Always check existence first
const exists = await dockerService.containerExists(containerName);

// Get current status (returns 'running'|'stopped'|'error')
const status = await dockerService.getContainerStatus(containerName);

// Run commands with options
await dockerService.runCommand(containerName, 'restart', { 
  isBackupOperation: false // controls Discord notifications 
});

// Use promisified exec for docker-compose operations
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { stdout } = await execPromise(`docker restart ${containerName}`);
```

### Database Model Hooks
Mongoose hooks trigger side effects - **understand these when modifying models**:
```javascript
// GameServer.js
gameServerSchema.post('save', async function() {
  // Updates backup scheduler when backupSchedule changes
  await backupScheduler.updateJobForServer(this);
});

gameServerSchema.post('remove', async function() {
  // Cancels backup jobs when server deleted
  await backupScheduler.removeJobForServer(this);
});
```

### Backup System Flow
1. `GameServer.backupSchedule` fields define schedule (cron expression, retention, notifications)
2. `backupScheduler.js` creates node-cron jobs on server save/app startup
3. Backup script executed via `exec()` in backend container
4. Discord webhook sent via `discordWebhook.js` (if enabled)
5. `activeBackupJob` field tracks in-progress backups

### Frontend Routing & Protection
```javascript
// AdminRoute wrapper checks auth AND role
<AdminRoute path="/admin/servers/new" component={ServerForm} />

// Regular protected routes
<ProtectedRoute path="/profile" component={Profile} />

// Bootstrap 5 styling - NO custom CSS frameworks
import { Container, Row, Col, Button } from 'react-bootstrap';
```

### API Communication Pattern
```javascript
// Axios configured with credentials for session cookies
axios.defaults.withCredentials = true;

// Auth token also sent in headers (hybrid approach)
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

## File Structure Significance

### Critical Service Files
- `server/utils/dockerService.js`: **Single source of truth** for container operations
- `server/utils/backupScheduler.js`: Manages all cron jobs, initialized on DB connect
- `server/utils/discordWebhook.js`: Notification delivery for backups and events
- `server/utils/passwordSecurity.js`: HaveIBeenPwned API integration

### Route Organization
- `server/routes/auth.js`: Login, register, logout, current user
- `server/routes/gameServers.js`: Public GET endpoints + authenticated control endpoints
- `server/routes/admin.js`: Admin-only operations (file browser, user management)

### Model Hooks Location
- `server/models/GameServer.js`: Line ~100+ contains post-save/post-remove hooks
- `server/models/User.js`: Pre-save hook for password hashing, comparePassword method

### Frontend Context Providers
- `client/src/context/AuthContext.js`: Global auth state, provides useAuth() hook
- `client/src/context/ThemeContext.js`: Theme switching (if implemented)

## Integration Points & External Dependencies

### Docker Socket Access
Backend requires privileged access to manage external containers:
- Container must mount `/var/run/docker.sock`
- Uses Dockerode library (abstracted by dockerService)
- Can manage containers NOT in compose stack

### SSL/TLS Setup
Three approaches handled by deployment script:
1. **Let's Encrypt with Cloudflare DNS**: `letsencrypt-cloudflare` command
2. **Self-signed certificates**: `custom-ssl` with no args
3. **Custom certificates**: `custom-ssl /path/to/cert.pem /path/to/key.pem`

### MongoDB Connection String Format
```javascript
// MUST include authSource=admin
mongodb://${user}:${pass}@mongodb:27017/gameserver-manager?authSource=admin
```

### Discord Webhook Format
Sent for backup events and server state changes:
```javascript
await discordWebhook.sendBackupNotification({
  serverName: server.name,
  status: 'success|failed',
  message: 'Backup completed',
  timestamp: new Date()
});
```

## Common Pitfalls & Solutions

### Docker Socket Permissions
- Container needs privileged mode or appropriate user permissions
- Socket path must be `/var/run/docker.sock` (Linux standard)
- Podman users: deployment script auto-detects and uses podman-compose

### Game Server Lifecycle
- **DO NOT** add game servers to docker-compose.yml
- They must exist externally before adding to web app
- Web app only stores metadata and controls existing containers

### SSL Certificate Issues
- Must run SSL setup command BEFORE first `start`
- Certificates stored in `./data/certbot/conf/`
- nginx config expects certs at `/etc/letsencrypt/`

### Session Persistence
- Sessions stored in MongoDB, persist across restarts
- If MongoDB connection fails, sessions lost (users logged out)
- Check `MONGO_URI` includes `?authSource=admin`

### Status Synchronization
- DB `status` field can become stale
- Always call `dockerService.getContainerStatus()` for truth
- GET endpoints auto-update status in DB when checking

### Backup Job Registration
- Jobs registered on app startup via `backupScheduler.initializeJobs()`
- Called after MongoDB connection established (see server.js)
- If server model saved, job automatically updated via Mongoose hook
- MongoDB connection requires auth database specification: `?authSource=admin`
