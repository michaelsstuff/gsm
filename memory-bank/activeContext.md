# Active Context - Game Server Manager

## Current Work Focus

**Status:** Production-ready containerized deployment with Docker Hub images
**Priority:** Maintaining and improving simplified deployment workflow

## Recent Changes

- **File Browser Editor UX:** Added adjustable editor height control, resizable editor modal, and in-file text search (next/previous, optional case sensitivity) for admin file editing
- **Preview Image Workflow:** Added GitHub Actions workflow to build preview Docker images for `feature/*` branches and pull requests with preview-only tags
- **Documentation Refactoring:** Split README into focused docs under `docs/`:
  - `docs/architecture.md` - Traffic flow diagrams and security model
  - `docs/troubleshooting.md` - Common issues and solutions
  - `docs/migration-guide.md` - Step-by-step server migration
  - `docs/development.md` - Building from source (moved from DEVELOPMENT.md)
- **README Improvements:** Added Table of Contents, TL;DR quick start, "What This Is" section
- **Volume Mount Cleanup:** Removed unused `container-compose` volume mount
- **License Fix:** Corrected license text to Apache 2.0 (was incorrectly GPL v3)
- **NPM Fix:** Removed incorrect default login references (NPM requires registration)
- **Deployment Simplification:** Removed all bash scripts (setup.sh, docker-deploy.sh, backup scripts)
- **Nginx Proxy Manager:** Added NPM for simple SSL management via web UI
- **Docker Hub Images:** Published pre-built images to `michaelsstuff/gsm-backend` and `gsm-frontend`
- **GitHub Actions CI/CD:** Automated multi-arch builds triggered by version tags

## Next Steps

1. **Short Term:**
   - Gather user feedback on simplified deployment
   - Consider additional NPM configurations (websockets, rate limiting)
   - Add API documentation

2. **Medium Term:**
   - Add health checks and monitoring endpoints
   - Implement additional security features (2FA, login attempt limiting)
   - Create Docker Hub automated builds for PR testing

## Active Decisions

**No Bash Scripts:** End users only interact with `docker compose` commands

**NPM for SSL:** Eliminated 315-line deployment script complexity by using NPM web UI

**Pre-built Images:** Users pull images from Docker Hub instead of building from source

**Consolidated Docs:** Single README replaces multiple doc files (README, DEPLOYMENT-GUIDE, SSL-SETUP)

## Current Challenges

- Keeping memory bank updated with rapid architectural changes
- Balancing simplicity for users with flexibility for developers
- Maintaining backward compatibility while simplifying deployment

## Recent Discoveries

- Project manages external Docker containers rather than creating them
- First user registration automatically grants admin privileges
- **NEW:** NPM can handle SSL for all services through single proxy interface
- **NEW:** GitHub Actions can sync README to Docker Hub atomically with builds
- MongoDB requires specific authentication database parameter: `?authSource=admin`
- **NEW:** Frontend can run HTTP-only when behind NPM reverse proxy
