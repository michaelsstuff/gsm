# Game Server Manager - AI Coding Assistant Instructions

## Memory Bank System

- 🧠 **ALWAYS read `/memory-bank/memory-bank-instructions.md` first**
- 🗂 **Load all `/memory-bank/*.md` files before each task**
- 📂 **Also load files from active feature folders (e.g. `/memory-bank/authentication/`)**
- 📝 **On "/update memory bank", refresh `activeContext.md` & `progress.md`**

## Project Overview
A containerized web application for managing game servers via Docker API. Uses React frontend, Node.js/Express backend, MongoDB database, and Docker Compose orchestration.

## Architecture & Key Components

### Container Structure
- **Frontend**: React SPA with nginx (port 80/443)
- **Backend**: Node.js API server (port 5000) 
- **Database**: MongoDB with authentication
- **Docker Socket**: Mounted to `/var/run/docker.sock` for container management

### Critical Data Flow
Game servers are external Docker containers managed through Dockerode API. The backend:
1. Stores server metadata in MongoDB (`GameServer` model)
2. Controls actual containers via Docker socket
3. Provides real-time status through `/api/gameservers` endpoints

## Development Workflows

### Primary Deployment Command
```bash
./docker-deploy.sh start|stop|restart|rebuild|logs|backup
```
**Never use `docker-compose` directly** - always use the deployment script which handles environment setup.

### Environment Setup
First run creates `.env` from template - **must edit before production deployment**. Critical vars:
- `MONGO_INITDB_ROOT_*`: Database credentials
- `SESSION_SECRET`, `JWT_SECRET`: Auth security
- `DOMAIN_NAME`: SSL certificate domain

### Docker Volumes Pattern
Backend mounts external paths for game server management:
```yaml
- /var/run/docker.sock:/var/run/docker.sock
- /mnt/backup/container2/:/app/backups
- /var/opt/container-volumes:/app/container-volumes:ro
```

## Code Patterns & Conventions

### Authentication Flow
1. **Passport.js** for session-based auth (not JWT for sessions)
2. **Role-based access**: First user becomes admin automatically
3. **Middleware chain**: `isAuthenticated` → `isAdmin` for protected routes
4. **Frontend auth context**: `useAuth()` hook with role checking

### Docker Service Integration
Use `server/utils/dockerService.js` for all container operations:
```javascript
// Check status before operations
const status = await dockerService.getContainerStatus(containerName);
// Use promisified exec for docker-compose commands
const { stdout } = await execPromise(`docker-compose ...`);
```

### Database Models
- `GameServer`: Core entity with Docker container mapping
- `User`: Role-based (admin/user) with bcrypt passwords
- **Mongoose hooks**: `post('save')`, `post('remove')` for backup scheduling

### Backup System
Automated via `backupScheduler.js` using cron jobs:
- MongoDB backups through `mongodump` in container
- Game server data backups via mounted volumes
- Discord webhook notifications for status

### Frontend State Management
- **AuthContext**: Global auth state with role checking
- **Bootstrap 5** styling throughout
- **React Router**: Admin routes protected by `AdminRoute` component
- **Axios**: API calls with credentials for session cookies

## File Structure Significance
- `docker-deploy.sh`: **Main deployment interface** - handles all container lifecycle
- `server/models/`: Mongoose schemas with validation and hooks
- `server/utils/`: Core services (Docker API, backup, Discord webhooks)
- `client/src/context/`: React context providers for global state
- `data/certbot/`: Let's Encrypt SSL certificate storage

## Integration Points
- **Docker API**: Direct container control via socket mount
- **External game servers**: Managed as separate containers, not part of compose stack
- **SSL/TLS**: Nginx frontend with Let's Encrypt or custom certificates
- **Backup storage**: External mount at `/mnt/backup/container2/`

## Common Pitfalls
- Docker socket permissions require container to run with appropriate privileges
- Game server containers must be created outside main compose stack
- SSL setup requires either Let's Encrypt setup or custom certificate deployment
- MongoDB connection requires auth database specification: `?authSource=admin`
