# Major Version Upgrade Tasks

This document tracks major version upgrades that require testing and may introduce breaking changes.

## Priority: High (Security-Related)

### 1. Dockerode 3.3.5 → 4.0.9
**Status:** ✅ Completed (January 7, 2026)  
**Security Impact:** Critical - Fixes tar-fs vulnerabilities (path traversal, symlink bypass)  
**Breaking Changes:** None encountered  
**Actual Effort:** Low - No API changes required  
**Dependencies Affected:** Core Docker container management functionality  

**Steps Completed:**
- [x] Review [Dockerode v4 changelog](https://github.com/apocas/dockerode/releases)
- [x] Update dependency in `server/package.json`
- [x] Test all container operations (start, stop, restart, backup)
- [x] Test compose file operations
- [x] Test file browser functionality
- [x] Verify Docker socket access still works
- [x] Update `server/utils/dockerService.js` if API changes (Not needed)

**Results:**
- Upgraded to v4.0.9 successfully
- All npm audit vulnerabilities resolved (0 vulnerabilities remaining)
- API compatibility maintained - no code changes required
- Container operations tested and working
- Backend restarted successfully with new version

---

## Priority: Medium (Framework Updates)

### 2. Express 4.21.2 → 5.2.1
**Status:** ⚠️ Pending  
**Security Impact:** Medium - General updates and security improvements  
**Breaking Changes:** Yes (major version)  
**Estimated Effort:** High  
**Dependencies Affected:** All backend routes and middleware  

**Steps:**
- [ ] Review [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html)
- [ ] Update dependency in `server/package.json`
- [ ] Test all API endpoints (`/auth`, `/api/servers`, `/admin`)
- [ ] Verify session handling still works
- [ ] Test file upload functionality (`express-fileupload` compatibility)
- [ ] Test error handling middleware
- [ ] Check passport.js integration
- [ ] Verify CORS configuration

**Key Breaking Changes:**
- Promise support for route handlers
- Removed some deprecated middleware
- Changed error handling behavior

---

### 3. Mongoose 7.8.6 → 9.1.2
**Status:** ⚠️ Pending  
**Security Impact:** Low - Performance and feature improvements  
**Breaking Changes:** Yes (2 major versions)  
**Estimated Effort:** Medium  
**Dependencies Affected:** All database models and queries  

**Steps:**
- [ ] Review [Mongoose 8 changelog](https://mongoosejs.com/docs/migrating_to_8.html)
- [ ] Review [Mongoose 9 changelog](https://mongoosejs.com/docs/migrating_to_9.html)
- [ ] Update dependency in `server/package.json`
- [ ] Test User model (authentication, password hashing)
- [ ] Test GameServer model (backup scheduler hooks!)
- [ ] Verify post-save/post-remove hooks still fire correctly
- [ ] Test all CRUD operations
- [ ] Check connection string format
- [ ] Verify session storage with connect-mongo

**Critical Test Areas:**
- `gameServerSchema.post('save')` → backup scheduler updates
- `gameServerSchema.post('remove')` → backup job cancellation
- User registration with HIBP password check

---

### 4. React 18.2.0 → 19.2.3
**Status:** ⚠️ Pending  
**Security Impact:** Low  
**Breaking Changes:** Yes  
**Estimated Effort:** Medium  
**Dependencies Affected:** All frontend components  

**Steps:**
- [ ] Review [React 19 changelog](https://react.dev/blog/2024/12/05/react-19)
- [ ] Update `react` and `react-dom` in `client/package.json`
- [ ] Test all components for rendering issues
- [ ] Check AuthContext for state management changes
- [ ] Verify react-router-dom v6 compatibility
- [ ] Test Bootstrap components (react-bootstrap compatibility)
- [ ] Check FontAwesome icon rendering
- [ ] Test React Ace editor integration

**Key Breaking Changes:**
- New JSX transform
- Changes to useEffect behavior
- Stricter hooks rules
- Possible changes to Context API

---

## Priority: Low (Nice to Have)

### 5. Node-Cron 3.0.3 → 4.2.1
**Status:** ⚠️ Pending  
**Breaking Changes:** Yes  
**Estimated Effort:** Low  
**Dependencies Affected:** Backup scheduler  

**Steps:**
- [ ] Review node-cron v4 changelog
- [ ] Update dependency in `server/package.json`
- [ ] Test backup scheduling (`backupScheduler.js`)
- [ ] Verify cron expressions still parse correctly
- [ ] Test job initialization on startup
- [ ] Test dynamic job updates when server saved
- [ ] Verify job cancellation on server removal

---

### 6. BCryptJS 2.4.3 → 3.0.3
**Status:** ⚠️ Pending  
**Breaking Changes:** Possible  
**Estimated Effort:** Low  
**Dependencies Affected:** Password hashing  

**Steps:**
- [ ] Review bcryptjs v3 changelog
- [ ] Update dependency in `server/package.json`
- [ ] Test user registration
- [ ] Test user login
- [ ] Verify existing passwords still validate
- [ ] Check salt rounds configuration

---

### 7. Connect-Mongo 5.1.0 → 6.0.0
**Status:** ⚠️ Pending  
**Breaking Changes:** Yes  
**Estimated Effort:** Low  
**Dependencies Affected:** Session storage  

**Steps:**
- [ ] Review connect-mongo v6 changelog
- [ ] Update dependency in `server/package.json`
- [ ] Test session persistence across restarts
- [ ] Verify login sessions work
- [ ] Check session cleanup/expiration

---

### 8. Dotenv 16.5.0 → 17.2.3
**Status:** ⚠️ Pending  
**Breaking Changes:** Possible  
**Estimated Effort:** Very Low  
**Dependencies Affected:** Environment variable loading  

**Steps:**
- [ ] Review dotenv v17 changelog
- [ ] Update dependency in `server/package.json`
- [ ] Test `.env` file loading on startup
- [ ] Verify all environment variables load correctly
- [ ] Test with `setup.sh` script

---

### 9. FontAwesome 6.7.2 → 7.1.0
**Status:** ⚠️ Pending  
**Breaking Changes:** Yes  
**Estimated Effort:** Low  
**Dependencies Affected:** UI icons  

**Steps:**
- [ ] Review FontAwesome v7 changelog
- [ ] Update all FA packages in `client/package.json`
- [ ] Check for deprecated icon names
- [ ] Test all icons render correctly
- [ ] Verify icon sizes and styling

---

### 10. @fortawesome/react-fontawesome 0.2.2 → 3.0.0
**Status:** ⚠️ Pending  
**Breaking Changes:** Yes  
**Estimated Effort:** Low  
**Dependencies Affected:** FontAwesome integration  

**Steps:**
- [ ] Review react-fontawesome v3 changelog
- [ ] Update with FontAwesome core packages
- [ ] Test icon components throughout app
- [ ] Check import statements

---

## Testing Strategy

### Pre-Upgrade Checklist
- [ ] Create feature branch: `git checkout -b upgrade/dependencies`
- [ ] Document current behavior (screenshots/videos)
- [ ] Back up production database
- [ ] Ensure all tests pass (once implemented)

### Upgrade Process
1. Update one dependency at a time
2. Run `npm install` to update lock file
3. Test affected functionality
4. Commit changes with descriptive message
5. Move to next dependency

### Post-Upgrade Testing
- [ ] Full authentication flow (register, login, logout)
- [ ] All game server operations (start, stop, restart, backup)
- [ ] Admin functions (file browser, user management)
- [ ] Backup scheduler (create, update, delete jobs)
- [ ] Discord notifications
- [ ] Password security check (HIBP)
- [ ] Session persistence across restarts
- [ ] Container management via Docker socket
- [ ] SSL/TLS functionality
- [ ] Frontend UI/UX (all pages, forms, modals)

### Rollback Plan
If issues occur:
```bash
git checkout main
git branch -D upgrade/dependencies
./docker-deploy.sh rebuild
```

---

## Completed Upgrades

### ✅ Dockerode 3.3.5 → 4.0.9 (January 7, 2026)
- **tar-fs vulnerabilities resolved** (path traversal, symlink bypass)
- **All backend npm audit issues fixed** (0 vulnerabilities)
- No breaking API changes - full backward compatibility
- Container operations tested and verified working
- Files updated: `server/package.json`, `server/package-lock.json`

### ✅ Security Patches Applied (January 7, 2026)
- **Axios:** 1.9.0 → 1.13.2 (DoS vulnerability fixed)
- **Express-Session:** 1.18.1 → 1.18.2
- **JsonWebToken:** 9.0.2 → 9.0.3
- **Form-data:** Critical vulnerability patched
- **QS:** High severity DoS vulnerability patched
- **On-headers:** HTTP header manipulation fixed
- **Webpack-dev-server:** 4.13.3 → 5.2.2 (source code theft vulnerability fixed)
- **Multiple client dependencies:** Updated via `npm audit fix --force`

**Backend:** 10 vulnerabilities → 0 vulnerabilities ✅  
**Frontend:** 10 vulnerabilities → 0 vulnerabilities ✅

---

## Notes

- **All security vulnerabilities resolved!** ✅
- Priority now shifts to framework upgrades (Express, Mongoose, React)
- Test in development environment before production deployment
- Consider implementing automated tests before major upgrades
- Document any code changes required for compatibility

---

## Commands Reference

```bash
# Check for outdated packages
docker exec gsm-backend npm outdated
docker run --rm -v "$PWD:/app" -w /app node:18-alpine npm outdated

# Run security audit
docker exec gsm-backend npm audit
docker run --rm -v "$PWD:/app" -w /app node:18-alpine npm audit

# Update dependencies
docker exec gsm-backend npm update <package>
docker run --rm -v "$PWD:/app" -w /app node:18-alpine npm update <package>

# Rebuild after changes
./docker-deploy.sh rebuild
```
