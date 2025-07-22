# Project Brief - Game Server Manager

## Core Requirements
- Web-based management interface for existing Docker game servers
- Single admin can control multiple game servers across different games
- Real-time status monitoring and container control
- Secure authentication with role-based access
- Automated backup scheduling with notifications

## Project Scope
**What it does:**
- Manages external Docker containers (Minecraft, Valheim, etc.)
- Provides web UI for start/stop/restart operations
- Shows real-time connection info and server status
- Schedules and manages backups
- User management with admin/user roles

**What it does NOT do:**
- Create or provision new game servers
- Host game server files directly
- Provide game server installation
- Manage Docker container creation

## Success Criteria
- Admin can add existing game servers by container name
- Real-time status updates (running/stopped/error)
- Secure authentication with first-user-becomes-admin
- Automated backups with Discord notifications
- SSL/TLS support for production deployment
- Zero-downtime deployment via Docker Compose

## Target Users
- Server administrators managing multiple game servers
- Home lab enthusiasts with containerized games
- Small gaming communities with dedicated servers

## Key Constraints
- Must work with existing Docker containers
- Requires Docker socket access for container control
- MongoDB for persistent data storage
- Must support both Let's Encrypt and custom SSL certificates
