# Feature Plan: Docker Compose Server Management

> ⚠️ **TEMPORARY PLANNING DOCUMENT** - Do not commit to git

## Overview

Allow admins to create, store, and manage game server containers directly from the GSM web UI using Docker Compose files.

## Current State

- GSM manages **existing** Docker containers
- Admins must manually create game server containers outside GSM
- GSM only stores metadata and controls containers via Docker socket

## Proposed Feature

Enable admins to:
1. Create new game servers by uploading/editing docker-compose files
2. Store compose files in GSM
3. Deploy/undeploy containers from stored compose files
4. Edit and update existing compose configurations

---

## User Stories

- [ ] As an admin, I want to create a new game server by pasting a docker-compose file
- [ ] As an admin, I want to edit environment variables without editing the full compose file
- [ ] As an admin, I want to deploy a compose file to create the container
- [ ] As an admin, I want to stop and remove a deployed container
- [ ] As an admin, I want to update a running server's compose and redeploy

---

## Technical Considerations

### Storage Options

**Option A: Database Storage**
- Store compose YAML as text field in GameServer model
- Pros: Simple, all in one place
- Cons: Large documents, harder to version

**Option B: File System Storage**
- Store compose files in `/app/compose-files/{server-id}/docker-compose.yml`
- Mount volume for persistence
- Pros: Easy to backup, can use docker-compose CLI directly
- Cons: Need volume mount, file sync issues

**Option C: Hybrid**
- Store in DB, write to temp file for deployment
- Pros: DB as source of truth, CLI compatibility
- Cons: More complex

### Docker Compose Execution

```javascript
// Option 1: Use dockerode compose (limited)
// Option 2: Shell exec docker-compose CLI
const { exec } = require('child_process');
exec(`docker compose -f ${composeFile} up -d`, callback);

// Option 3: Use docker-compose library (if exists)
```

### Security Concerns

- [ ] Validate compose file syntax before storing
- [ ] Restrict allowed images (whitelist?)
- [ ] Prevent privileged containers
- [ ] Prevent host network mode
- [ ] Sanitize volume mounts (no host system access)
- [ ] Rate limit deployments
- [ ] Resource limits (CPU, memory)

### Compose File Verification (Before Save)

Validate compose files before storing to catch errors early:

1. **YAML Syntax Validation**
   - Parse YAML, reject if malformed
   - Use `js-yaml` library for parsing

2. **Docker Compose Schema Validation**
   - Validate against official compose-spec schema
   - Check required fields (services, image/build)
   - Use `docker compose config` to validate

3. **Security Policy Checks**
   - No `privileged: true`
   - No `network_mode: host`
   - No sensitive host path mounts (`/`, `/etc`, `/var/run/docker.sock`)
   - ⚠️ **Warning only** for `cap_add` - display clear warning but allow

4. **GSM-Specific Validation**
   - Container name must be unique
   - Container name must be valid (alphanumeric, hyphens)
   - Volume paths should follow backup convention

```javascript
// Verification flow
async function validateComposeFile(yamlContent) {
  // 1. Parse YAML
  const parsed = yaml.load(yamlContent);
  
  // 2. Docker validation (dry-run)
  await exec('docker compose -f /tmp/compose.yml config');
  
  // 3. Security checks
  checkSecurityPolicy(parsed);
  
  // 4. GSM checks
  checkContainerNameUnique(parsed);
  
  return { valid: true, warnings: [] };
}
```

### Volume Path Convention

Need to auto-configure volume paths to match GSM backup convention:
```yaml
volumes:
  - /var/opt/container-volumes/${CONTAINER_NAME}:/data
```

---

## Data Model Changes

### ✅ Decision: Separate ComposeFile Model

Keep compose logic separate from GameServer for cleaner architecture:

```javascript
const ComposeFileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,  // YAML content
    required: true
  },
  gameServer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'GameServer',
    default: null  // null until deployed
  },
  status: {
    type: String,
    enum: ['draft', 'deploying', 'deployed', 'error', 'stopped'],
    default: 'draft'
  },
  containerName: {
    type: String,
    trim: true,
    unique: true,
    sparse: true  // allows multiple nulls
  },
  deployedAt: Date,
  lastError: String,
  version: {
    type: Number,
    default: 1
  }
}, { timestamps: true });
```

### GameServer Model Addition

Add reference to compose file for managed servers:

```javascript
// Add to existing GameServer schema
isManaged: {
  type: Boolean,  // true = created by GSM via compose, false = external container
  default: false
},
composeFile: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'ComposeFile',
  default: null
}
```

### Workflow

1. Admin creates ComposeFile (status: `draft`)
2. Admin deploys → creates container + GameServer entry (status: `deployed`)
3. GameServer.isManaged = true, GameServer.composeFile = ref
4. Undeploy → removes container, keeps ComposeFile and GameServer metadata

---

## API Endpoints

```
POST   /api/admin/compose              - Create new compose file
GET    /api/admin/compose/:id          - Get compose file
PUT    /api/admin/compose/:id          - Update compose file
DELETE /api/admin/compose/:id          - Delete compose file

POST   /api/admin/compose/:id/deploy   - Deploy (docker compose up)
POST   /api/admin/compose/:id/undeploy - Undeploy (docker compose down)
POST   /api/admin/compose/:id/validate - Validate compose syntax

GET    /api/admin/templates            - List available templates
GET    /api/admin/templates/:name      - Get template content
```

---

## UI Components

### New Components Needed

1. **ComposeEditor** - Monaco/CodeMirror YAML editor
2. **TemplateSelector** - Dropdown/cards for pre-built templates
3. **ComposeDeployButton** - Deploy/undeploy with status
4. **EnvironmentVariableEditor** - Key-value editor for env vars

### Modified Components

1. **ServerForm** - Add compose file tab/section
2. **ServerDetail** - Show compose status, add deploy controls
3. **AdminDashboard** - Add "Create Server" button

---

## Pre-built Templates

Store in `/server/templates/` or database:

- `minecraft-java.yml` - itzg/minecraft-server
- `minecraft-bedrock.yml` - itzg/minecraft-bedrock-server  
- `valheim.yml` - lloesche/valheim-server
- `terraria.yml` - ryshe/terraria
- `satisfactory.yml` - wolveix/satisfactory-server
- `palworld.yml` - thijsvanloef/palworld-server-docker

---

## Implementation Phases

### Phase 1: Basic Compose Storage
- [ ] Add compose fields to GameServer model
- [ ] Create compose CRUD API endpoints
- [ ] Add compose editor to ServerForm
- [ ] Validate YAML syntax

### Phase 2: Deploy/Undeploy
- [ ] Implement docker-compose CLI execution
- [ ] Add deploy/undeploy endpoints
- [ ] Add deploy status tracking
- [ ] UI deploy buttons and status

### Phase 3: Templates
- [ ] Create template storage system
- [ ] Build 5-10 common game server templates
- [ ] Template selector UI
- [ ] Environment variable customization

### Phase 4: Security & Polish
- [ ] Compose file validation rules
- [ ] Resource limits enforcement
- [ ] Volume path auto-configuration
- [ ] Error handling and rollback

---

## Open Questions

1. **Where to store compose files?** DB vs filesystem vs hybrid?
2. **How to handle updates?** Recreate container or in-place update?
3. **Template customization?** Full YAML edit or just env vars?
4. **Multi-container composes?** Allow or restrict to single service?
5. **Networking?** Auto-join gsm-network or separate?
6. **Naming convention?** Auto-generate container names or user-defined?

---

## Risks

- **Security:** Malicious compose files could compromise host
- **Complexity:** Docker Compose adds significant complexity
- **Scope creep:** Could turn into full container orchestration
- **Breaking change:** Shifts GSM from "management" to "provisioning"

---

## Decision Needed

Before implementation, decide:

1. MVP scope - what's the minimum viable feature?
2. Security model - how restrictive should validation be?
3. Storage approach - DB or filesystem?
4. Template strategy - bundled or user-created?

---

## Notes

_Add discussion notes here during planning_

