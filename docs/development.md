# Development Guide

This guide is for developers who want to build Game Server Manager from source, contribute to the project, or customize it for their needs.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git

---

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/michaelsstuff/gsm.git
cd gsm
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```env
MONGO_INITDB_ROOT_PASSWORD=dev_password_12345
SESSION_SECRET=dev_session_secret_12345
JWT_SECRET=dev_jwt_secret_12345
BACKUP_PATH=./backups
```

### 3. Build and Start

```bash
docker compose build
docker compose up -d
```

### 4. View Logs

```bash
docker compose logs -f
```

---

## Local Development (Without Docker)

For faster iteration during development, you can run services locally.

**Environment Setup for Local Dev:**

```bash
# Set required variables
export MONGO_INITDB_ROOT_PASSWORD=dev_password_12345
export SESSION_SECRET=dev_session_secret_12345
export JWT_SECRET=dev_jwt_secret_12345

# Set CLIENT_URL for CORS (frontend will be on localhost:3000)
export CLIENT_URL=http://localhost:3000
```

### Backend

```bash
cd server
npm install
node server.js
```

Backend will run on `http://localhost:5000`

**Note:** You'll still need MongoDB running (can use Docker for just MongoDB):

```bash
docker run -d -p 27017:27017 \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:5.0
```

### Frontend

```bash
cd client
npm install
npm start
```

Frontend development server will run on `http://localhost:3000`

---

## Project Structure

```
gsm/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── context/          # React context providers
│   │   ├── App.js           # Main app component
│   │   └── index.js         # Entry point
│   ├── Dockerfile           # Frontend container
│   └── nginx.conf           # Nginx configuration
│
├── server/                   # Node.js backend
│   ├── config/              # Configuration
│   │   └── passport.js      # Authentication config
│   ├── models/              # MongoDB models
│   ├── routes/              # API routes
│   ├── scripts/             # Backup scripts
│   ├── utils/               # Utility functions
│   │   ├── backupScheduler.js
│   │   ├── discordWebhook.js
│   │   ├── dockerService.js
│   │   └── passwordSecurity.js
│   ├── Dockerfile           # Backend container
│   └── server.js            # Entry point
│
├── docker-compose.yml        # Container orchestration
└── README.md                # User documentation
```

---

## Making Changes

### Frontend Changes

1. Edit files in `client/src/`
2. If running locally: Changes auto-reload via webpack dev server
3. If using Docker:
   ```bash
   docker compose build frontend
   docker compose up -d frontend
   ```

### Backend Changes

1. Edit files in `server/`
2. If running locally: Restart node server
3. If using Docker:
   ```bash
   docker compose build backend
   docker compose up -d backend
   ```

### Testing Changes

Always test both locally and in containers before submitting PRs:

```bash
# Build fresh images
docker compose build --no-cache

# Start with clean volumes
docker compose down -v
docker compose up -d

# Check logs for errors
docker compose logs -f
```

---

## Building for Production

### Build Images Locally

```bash
# Build all images
docker compose build

# Build specific service
docker compose build backend
docker compose build frontend
```

### Tag Images

```bash
docker tag gsm-backend:latest ghcr.io/yourusername/gsm-backend:v1.0.0
docker tag gsm-frontend:latest ghcr.io/yourusername/gsm-frontend:v1.0.0
```

### Push to Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push images
docker push ghcr.io/yourusername/gsm-backend:v1.0.0
docker push ghcr.io/yourusername/gsm-frontend:v1.0.0
```

---

## CI/CD Pipeline

The project uses GitHub Actions to automatically build and publish images.

See `.github/workflows/build-publish.yml` (to be created) for the CI/CD configuration.

### Workflow Triggers

- Push to `main` branch → Build and push `latest` tag
- Push tag `v*` → Build and push versioned tag
- Pull requests → Build only (no push)

---

## Testing

### Unit Tests

Run unit tests locally:

```bash
# Backend tests
cd server
npm test

# Frontend tests
cd client
npm test
```

**Note:** Test packages are devDependencies and excluded from production builds via:
- Backend: `npm install --omit=dev` in Dockerfile
- Frontend: Multi-stage build only includes compiled output
- Both: `.dockerignore` excludes test files

### Manual Testing Checklist

- [ ] User registration and login
- [ ] Admin dashboard access
- [ ] Game server CRUD operations
- [ ] Docker container control (start/stop/restart)
- [ ] Backup scheduling and execution
- [ ] Discord webhook notifications
- [ ] File browser functionality
- [ ] Password security validation

---

## Code Style

### JavaScript/Node.js

- Use ES6+ features
- Async/await over callbacks
- Destructuring where appropriate
- Clear variable names

### React

- Functional components with hooks
- Context for global state
- Bootstrap for styling
- Clear component hierarchy

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format - keep messages short and concise:

```
feat: Add backup scheduling
fix: Resolve Docker socket permission issue
docs: Update installation instructions
chore: Update dependencies
ci: Add test stage to pipeline
test: Add auth context tests
```

Format: `<type>: <short description>` - let the code changes speak for themselves.

---

## Debugging

### Backend Issues

```bash
# Check backend logs
docker compose logs backend

# Enter backend container
docker exec -it gsm-backend sh

# Check MongoDB connection
docker exec -it gsm-mongodb mongosh -u admin -p password
```

### Frontend Issues

```bash
# Check frontend logs
docker compose logs frontend

# Check nginx config
docker exec -it gsm-frontend cat /etc/nginx/conf.d/default.conf

# Enter frontend container
docker exec -it gsm-frontend sh
```

### Docker Socket Issues

```bash
# Check socket permissions
ls -la /var/run/docker.sock

# Verify backend can access socket
docker exec -it gsm-backend docker ps
```

---

## Contributing

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Review

All PRs require:
- Clean commit history
- Tests passing (when implemented)
- No merge conflicts
- Clear description of changes

---

## Troubleshooting Development Issues

### Port Conflicts

If ports are already in use:

```bash
# Check what's using the port
sudo netstat -tlnp | grep :5000

# Change ports in docker-compose.yml
ports:
  - "5001:5000"  # Use different host port
```

### Volume Permission Issues

```bash
# Fix backup directory permissions
sudo chown -R $(id -u):$(id -g) ./backups
```

### Clean Slate Rebuild

```bash
# Stop everything
docker compose down -v

# Remove images
docker rmi gsm-backend gsm-frontend

# Remove node_modules (optional)
rm -rf server/node_modules client/node_modules

# Rebuild from scratch
docker compose build --no-cache
docker compose up -d
```

---

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [React Documentation](https://react.dev/)
- [Express Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Nginx Proxy Manager](https://nginxproxymanager.com/)

---

## License

GNU General Public License v3.0 - See `LICENSE` file
