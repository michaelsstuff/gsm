# Product Context - Game Server Manager

## Why This Project Exists

Server administrators often manage multiple game servers across different games (Minecraft, Valheim, Satisfactory, etc.). Each server typically runs in its own Docker container with unique configurations, but there's no unified way to monitor and control them all.

## Problems It Solves

**Scattered Management:** Admins currently SSH into servers or use multiple tools to check status, restart containers, or manage backups.

**No Centralized Status:** No single dashboard showing which servers are online, player counts, or connection details.

**Manual Backup Management:** Backups are often manual or use scattered cron jobs without central monitoring.

**User Access Control:** No way for trusted users to restart servers without full admin access.

## User Experience Goals

**Single Dashboard:** One web interface showing all game servers, their status, and connection info.

**Simple Operations:** Click to start/stop/restart servers without command line access.

**Automated Backups:** Set and forget backup scheduling with notifications when things go wrong.

**Role-Based Access:** Admins can manage everything, regular users can view and restart assigned servers.

**Mobile Friendly:** Check server status and perform basic operations from mobile devices.

## Success Metrics

- Reduce time to check all server statuses from minutes to seconds
- Enable non-technical users to restart servers safely
- Catch backup failures immediately via Discord notifications
- Zero manual SSH sessions for routine server management

## User Personas

**Primary: Gaming Community Admin**

- Manages 3-10 game servers for friends/community
- Technical enough to use Docker but wants simpler management
- Needs to delegate some control to trusted moderators

**Secondary: Home Lab Enthusiast**

- Runs various game servers for family/friends
- Wants professional-looking interface for guests
- Values automation and monitoring
