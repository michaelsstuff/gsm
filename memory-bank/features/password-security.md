# Password Security Integration - HaveIBeenPwned

## Overview

The Game Server Manager now integrates with the HaveIBeenPwned (HIBP) Pwned Passwords API to check user passwords against known data breaches during registration and password changes.

## Implementation Details

### Backend Components

**`server/utils/passwordSecurity.js`**
- Core service implementing k-anonymity model for password checking
- Uses SHA-1 hashing with only first 5 characters sent to HIBP API
- Configurable blocking threshold (currently: 10+ breaches)
- Graceful degradation when service is unavailable

**API Endpoints:**
- `POST /api/auth/register` - Enhanced with password checking
- `PUT /api/auth/profile` - Enhanced with password checking  
- `POST /api/auth/check-password` - Real-time password validation

### Frontend Components

**`PasswordSecurityChecker.js`**
- React component providing real-time password feedback
- Debounced API calls (800ms after user stops typing)
- Visual indicators with Bootstrap alerts
- Non-blocking when service is unavailable

**Enhanced Forms:**
- Registration form with live password validation
- Profile form with password change validation
- Submit buttons disabled for compromised passwords

## Security Model

### K-Anonymity Protection
- Only first 5 characters of SHA-1 hash sent to HIBP
- API returns all hashes with matching prefix
- Client searches locally for exact match
- Protects actual password from being transmitted

### Blocking Policy
- Passwords found >10 times in breaches are blocked
- Lower breach counts show warnings but allow usage
- Service unavailability doesn't block users
- Clear messaging about security status

## User Experience

### Real-time Feedback
- ✅ Secure passwords show green success message
- ⚠️ Low-breach passwords show warning but allow usage
- 🚫 High-breach passwords show error and block submission
- 🔍 Loading spinner during API check

### Error Handling
- Network failures gracefully degrade
- Service timeouts don't block users
- Clear error messages explain temporary unavailability
- Security checks continue working when service recovers

## Technical Configuration

### Dependencies
- Uses existing `axios` for HTTP requests
- Uses built-in `crypto` module for SHA-1 hashing
- No additional npm packages required

### Performance
- 800ms debounce prevents excessive API calls
- 5-second request timeout prevents hanging
- Caching of last checked password prevents duplicate calls
- Lightweight API responses (~1KB typical)

## Future Enhancements

- Password strength scoring integration
- Breach date information display
- User education about password security
- Optional two-factor authentication
- Rate limiting and abuse prevention
