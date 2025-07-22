# Copilot Rules - Game Server Manager

## 🚨 Security: Never Upload Secrets

- Never copy, move, or commit secret files or values (e.g., `.env`, `secrets.json`, API keys, tokens, passwords) to version control or into example/sample config files
- Example files like `.env.example` must be built by hand with only safe placeholder values
- Always verify that no secrets are present before staging, committing, or pushing code
- If a secret is ever committed, treat as a security incident: remove from history and rotate affected credentials immediately
- Use secret scanning tools and always double-check environment files

## 🐳 Docker Deployment Rules

- **NEVER use `docker-compose` commands directly** - always use `./docker-deploy.sh`
- The deployment script handles environment setup, volume mounting, and container lifecycle
- Bypassing the script breaks environment variable templating and can cause deployment failures
- For debugging, use `./docker-deploy.sh logs` instead of direct docker commands

## 📊 Container Management Patterns

- Always check container status before performing operations via `dockerService.getContainerStatus()`
- Container names in the database MUST exactly match actual Docker container names
- Use promisified exec commands for docker-compose operations within containers
- External game server containers are managed, not created by this application

## 🔐 Authentication Implementation

- Use session-based authentication with Passport.js, not stateless JWT for user sessions
- First registered user automatically becomes admin (hardcoded behavior)
- Protect admin routes with middleware chain: `isAuthenticated` → `isAdmin`
- MongoDB sessions require `authSource=admin` in connection string

## 🎯 Frontend Development

- Use React Context (`AuthContext`, `ThemeContext`) for state management, not Redux
- Bootstrap 5 classes throughout for consistency
- Axios calls must include `credentials: true` for session cookies
- Protect admin routes with `AdminRoute` wrapper component

## 📁 File Structure Conventions

- All Docker operations go through `server/utils/dockerService.js`
- Database models in `server/models/` with Mongoose hooks for backup scheduling
- React components organized by feature in `client/src/components/`
- Memory bank files provide persistent context across AI sessions

## 🔄 Backup System Rules

- Backup scheduler uses Mongoose post-hooks to auto-cleanup cron jobs
- All backup operations should notify via Discord webhooks
- External volume mounts required: `/mnt/backup/container2/` and `/var/opt/container-volumes/`
- File uploads limited to 100MB via express-fileupload middleware

## 🌐 SSL and Production

- Support both Let's Encrypt automation and custom certificate upload
- Domain name must match certificate for SSL to work
- SSL certificates stored in `data/certbot/` for Let's Encrypt or root directory for custom
- Always enforce HTTPS in production via nginx configuration

## 🐛 Common Debugging Patterns

- "Container not found" usually means name mismatch between database and actual container
- Docker permission errors mean socket mount or container privileges are wrong
- Auth failures often caused by missing `authSource=admin` in MongoDB URI
- Check deployment script output for environment variable issues

## 📝 Development Workflow

- Read entire memory bank before starting any significant work
- Update `activeContext.md` and `progress.md` as work progresses
- Use semantic search when unsure about existing implementations
- Follow the project's pattern of external container management, not creation

## 🎮 Game Server Context

- This manages existing game servers (Minecraft, Valheim, etc.), doesn't create them
- Connection strings are for game clients to connect, not internal API calls
- Server status comes from Docker container state, not game server APIs
- Backup operations work with container volumes, not direct file access
