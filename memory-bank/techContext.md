# Tech Context - Game Server Manager

## Core Technology Stack

### Backend

- **Node.js** with Express 4.x framework
- **MongoDB 5.0** with Mongoose 7.x ODM
- **Passport.js** for session-based authentication
- **Dockerode** library for Docker API integration
- **node-cron** for backup scheduling

### Frontend

- **React 18.x** with React Router 6.x
- **Bootstrap 5** for UI components and styling
- **Axios** for API communication with credentials
- **Webpack** for build process and development server

### Infrastructure

- **Docker Compose** v3.8+ for orchestration
- **nginx** for reverse proxy and SSL termination
- **Let's Encrypt** or custom certificates for SSL
- **MongoDB sessions** for authentication persistence

## Development Setup

### Prerequisites

- Docker and Docker Compose installed
- External game server containers already running
- SSL certificates (for production deployment)

### Environment Configuration

```bash
# First run creates .env from template
./docker-deploy.sh start
# Edit .env with production values before deployment
```

### Required Environment Variables

- `MONGO_INITDB_ROOT_USERNAME/PASSWORD` - Database credentials
- `SESSION_SECRET` - Express session encryption
- `JWT_SECRET` - Token signing (though sessions are primary)
- `DOMAIN_NAME` - SSL certificate domain
- `CLIENT_URL` - Frontend URL for CORS

## Technical Constraints

### Docker Requirements

- Container must run with privileged access for Docker socket
- Host must mount `/var/run/docker.sock:/var/run/docker.sock`
- External volume mounts required for backup and data access

### Database Constraints

- MongoDB connections require `authSource=admin` parameter
- Session storage requires persistent MongoDB connection
- Not suitable for stateless/serverless deployments

### Security Requirements

- All secrets must be in environment variables, never committed
- Docker socket access requires careful privilege management
- SSL/TLS required for production deployments

## External Dependencies

### Required Mounts

- `/var/run/docker.sock` - Docker API access
- `/mnt/backup/container/` - Backup storage location
- `/var/opt/container-volumes/` - Game server data access (read-only)
- `/var/opt/container-compose/` - Docker compose files access (read-only)

### Optional Integrations

- **Discord Webhooks** - Backup and system notifications
- **Let's Encrypt** - Automated SSL certificate management
- **Steam API** - Game server metadata (Steam app IDs)

## Development Workflows

### Build Process

- Frontend: Webpack builds React to static files
- Backend: Multi-stage Docker build with Node.js
- Database: MongoDB container with authentication enabled

### Deployment Process

- Use `docker-deploy.sh` script exclusively
- Never run `docker-compose` commands directly
- Environment setup handled by deployment script

### Backup Process

- MongoDB backups via `mongodump` inside container
- Game server data backups via mounted volumes
- Automated scheduling with Discord notifications
