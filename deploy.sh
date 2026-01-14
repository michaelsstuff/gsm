#!/bin/bash
# Simple deployment script for Game Server Manager
# Replaces the complex docker-deploy.sh with NPM-based approach
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Check for .env file
if [ ! -f .env ]; then
  print_warning "No .env file found. Creating from template..."
  if [ ! -f .env.example ]; then
    print_error ".env.example not found. Cannot continue."
    exit 1
  fi
  cp .env.example .env
  echo ""
  print_warning "SETUP REQUIRED"
  echo "Edit .env and set these values:"
  echo "  1. DOMAIN_NAME=your-domain.com"
  echo "  2. MONGO_INITDB_ROOT_PASSWORD=\$(openssl rand -hex 24)"
  echo "  3. SESSION_SECRET=\$(openssl rand -hex 48)"
  echo "  4. JWT_SECRET=\$(openssl rand -hex 48)"
  echo ""
  print_info "After editing .env, run: ./deploy.sh start"
  exit 1
fi

# Load environment
source .env

# Validate required variables
REQUIRED_VARS="DOMAIN_NAME MONGO_INITDB_ROOT_PASSWORD SESSION_SECRET JWT_SECRET"
MISSING_VARS=""
for var in $REQUIRED_VARS; do
  if [ -z "${!var:-}" ]; then
    MISSING_VARS="$MISSING_VARS $var"
  fi
done

if [ -n "$MISSING_VARS" ]; then
  print_error "Required variables not set in .env:$MISSING_VARS"
  echo ""
  echo "Generate secrets with:"
  echo "  openssl rand -hex 24  # For MONGO_INITDB_ROOT_PASSWORD"
  echo "  openssl rand -hex 48  # For SESSION_SECRET and JWT_SECRET"
  exit 1
fi

# Detect compose command
if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  print_error "Docker Compose not found"
  echo "Install Docker Compose: https://docs.docker.com/compose/install/"
  exit 1
fi

print_info "Using: $COMPOSE"
echo ""

# Get server IP for display
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "YOUR_SERVER_IP")

# Execute command
case "${1:-}" in
  start)
    print_info "Starting Game Server Manager..."
    $COMPOSE up -d
    echo ""
    print_success "Services started successfully!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  NEXT STEPS: Configure Nginx Proxy Manager"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Access NPM Admin UI:"
    echo "   ${BLUE}http://${SERVER_IP}:81${NC}"
    echo ""
    echo "2. Login with default credentials:"
    echo "   Email:    admin@example.com"
    echo "   Password: changeme"
    echo "   ${YELLOW}(Change password immediately!)${NC}"
    echo ""
    echo "3. Add Proxy Host:"
    echo "   Domain:           ${DOMAIN_NAME}"
    echo "   Scheme:           http"
    echo "   Forward Host:     gsm-frontend"
    echo "   Forward Port:     80"
    echo "   Block Exploits:   ✓"
    echo "   Websockets:       ✓"
    echo ""
    echo "4. SSL Tab:"
    echo "   Request SSL:      ✓"
    echo "   Force SSL:        ✓"
    echo "   HTTP/2:           ✓"
    echo "   HSTS:             ✓"
    echo ""
    echo "5. Access your application:"
    echo "   ${GREEN}https://${DOMAIN_NAME}${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ;;
    
  stop)
    print_info "Stopping Game Server Manager..."
    $COMPOSE down
    print_success "Services stopped"
    ;;
    
  restart)
    print_info "Restarting Game Server Manager..."
    $COMPOSE restart
    print_success "Services restarted"
    ;;
    
  logs)
    SERVICE="${2:-}"
    if [ -n "$SERVICE" ]; then
      print_info "Showing logs for: $SERVICE"
      $COMPOSE logs -f "$SERVICE"
    else
      print_info "Showing logs for all services"
      $COMPOSE logs -f
    fi
    ;;
    
  update)
    print_info "Pulling latest images..."
    $COMPOSE pull
    print_info "Restarting services with new images..."
    $COMPOSE up -d
    print_success "Updated to latest versions"
    ;;
    
  rebuild)
    print_info "Rebuilding images from source..."
    $COMPOSE down
    $COMPOSE build --no-cache
    $COMPOSE up -d
    print_success "Rebuild complete"
    ;;
    
  backup)
    print_info "Backing up MongoDB database..."
    BACKUP_DIR="${BACKUP_PATH:-./backups}/mongodb"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    
    # Check if MongoDB container is running
    if ! docker ps | grep -q gsm-mongodb; then
      print_error "MongoDB container is not running"
      exit 1
    fi
    
    # Create backup
    docker exec gsm-mongodb mongodump \
      --username "${MONGO_INITDB_ROOT_USERNAME:-admin}" \
      --password "$MONGO_INITDB_ROOT_PASSWORD" \
      --authenticationDatabase admin \
      --db gameserver-manager \
      --archive="/data/db/backup-$TIMESTAMP.gz" \
      --gzip
    
    # Copy to host
    docker cp "gsm-mongodb:/data/db/backup-$TIMESTAMP.gz" "$BACKUP_DIR/"
    
    # Clean up container backup
    docker exec gsm-mongodb rm "/data/db/backup-$TIMESTAMP.gz"
    
    print_success "Backup created: $BACKUP_DIR/backup-$TIMESTAMP.gz"
    ;;
    
  status)
    print_info "Service Status:"
    echo ""
    $COMPOSE ps
    ;;
    
  npm)
    print_info "Opening Nginx Proxy Manager admin UI..."
    echo "Access at: http://${SERVER_IP}:81"
    echo "Default credentials:"
    echo "  Email:    admin@example.com"
    echo "  Password: changeme"
    ;;
    
  *)
    echo "Game Server Manager - Deployment Script"
    echo ""
    echo "Usage: $0 {command}"
    echo ""
    echo "Commands:"
    echo "  start    - Start all services"
    echo "  stop     - Stop all services"
    echo "  restart  - Restart all services"
    echo "  logs     - View logs (optional: specify service name)"
    echo "  update   - Pull latest images and restart"
    echo "  rebuild  - Rebuild images from source"
    echo "  backup   - Backup MongoDB database"
    echo "  status   - Show service status"
    echo "  npm      - Show Nginx Proxy Manager info"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs backend"
    echo "  $0 backup"
    exit 1
    ;;
esac

exit 0
