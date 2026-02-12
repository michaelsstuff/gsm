# Development Guide

This guide is for contributors building GSM from source.

For contribution process and pull request expectations, see `CONTRIBUTING.md`.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Git

## Docker Development Setup

1. Clone the repository:

```bash
git clone https://github.com/michaelsstuff/gsm.git
cd gsm
```

2. Create your local environment file:

```bash
cp .env.example .env
```

3. Set required variables in `.env`:

```env
MONGO_PASSWORD=dev_password_12345
SESSION_SECRET=dev_session_secret_12345
JWT_SECRET=dev_jwt_secret_12345
BACKUP_PATH=./backups
```

4. Build and start the development stack:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

5. Check service logs:

```bash
docker compose -f docker-compose.dev.yml logs -f
```

Service URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## Local Development Without Docker

Use this mode for faster frontend/backend iteration.

### Environment Setup

```bash
export MONGO_PASSWORD=dev_password_12345
export SESSION_SECRET=dev_session_secret_12345
export JWT_SECRET=dev_jwt_secret_12345
export CLIENT_URL=http://localhost:3000
```

You still need MongoDB running. Example:

```bash
docker run -d -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  --name gsm-mongodb-dev \
  mongo:5.0
```

### Run Backend

```bash
cd server
npm install
npm run dev
```

### Run Frontend

```bash
cd client
npm install
npm start
```

## Testing

Run tests before opening a pull request:

```bash
cd server
npm test

cd ../client
npm test
```

## Useful Commands

```bash
# Rebuild one service
docker compose -f docker-compose.dev.yml up -d --build backend

# Restart one service
docker compose -f docker-compose.dev.yml restart frontend

# Stop and remove containers/volumes
docker compose -f docker-compose.dev.yml down -v
```

## Debugging

```bash
# Backend logs
docker compose -f docker-compose.dev.yml logs backend

# Frontend logs
docker compose -f docker-compose.dev.yml logs frontend

# Enter backend container
docker exec -it gsm-backend sh
```
