# System Patterns - Game Server Manager

## Architecture Overview

**Three-Tier Containerized Web Application:**
- React frontend served by nginx (SSL termination, static files)
- Node.js/Express backend API (authentication, Docker integration)
- MongoDB database (user data, server metadata, session storage)

**External Integration Pattern:**
- Manages external Docker containers via mounted socket
- Does NOT create or destroy game server containers
- Metadata in database maps to actual container names

## Key Design Patterns

### Docker Service Layer
All container operations go through `server/utils/dockerService.js`:
- Abstracts Dockerode API calls
- Provides consistent error handling
- Centralizes container name validation
- Wraps exec commands for docker-compose operations

### Authentication Flow
```
User Registration → Session Creation → Role Assignment → Route Protection
                 ↓
               MongoDB Session Store (persistent across restarts)
                 ↓
              Passport.js Middleware → isAuthenticated → isAdmin
```

### Data Flow Pattern
```
Frontend Request → Backend API → Docker Service → External Container
       ↓                ↓              ↓               ↓
   UI Update     ← Database    ← Status Check  ← Container State
```

### Backup Orchestration
- Mongoose post-hooks trigger backup scheduler updates
- node-cron manages per-server backup jobs
- Discord webhooks provide notification layer
- External volume mounts enable data access

## Component Relationships

**Frontend Components:**
- `AuthContext` provides global authentication state
- `AdminRoute` wrapper protects admin-only pages
- Server components (`ServerList`, `ServerDetail`) consume API
- Bootstrap 5 for consistent styling

**Backend Services:**
- `dockerService` for container management
- `backupScheduler` for automated backup jobs
- `discordWebhook` for notification delivery
- Route modules with middleware protection

**Database Models:**
- `User` with role-based access (admin/user)
- `GameServer` with Docker container mapping
- Session store for authentication persistence

## Security Boundaries

**Container Isolation:** Web app runs in containers, manages external containers via socket mount

**Role-Based Access:** Two-tier system with middleware enforcement

**Secret Management:** All sensitive data in environment variables

**Network Security:** Internal container network plus external Docker API access

## Deployment Pattern

**Single Command Deployment:** `docker-deploy.sh` handles all lifecycle operations

**Environment Configuration:** Auto-generated `.env` from template, must be edited for production

**SSL Flexibility:** Supports both Let's Encrypt automation and custom certificate upload

**Volume Mounts:** External paths for backup storage and container data access
