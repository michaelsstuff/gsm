# External Integrations & Services

This project relies on several external services and APIs to provide enhanced functionality, security, and game metadata. Below is a summary of each integration, its purpose, and where it is used in the codebase.

---

- **Purpose:** Retrieves the game name, Steam ID, description, and an image (if SteamGridDB is not set up).
- **Usage:**
  - Used in: `server/utils/steamLookup.js`
- **Docs:** https://developer.valvesoftware.com/wiki/Steam_Web_API

## SteamGridDB API
- **Purpose:** Retrieves high-quality game images and assets for UI display.
- **Usage:**
  - Used in: `server/utils/steamGridDbLookup.js`
  - Requires: SteamGridDB API key (set via environment variable)
- **Docs:** https://www.steamgriddb.com/api/docs
- **See also:** [docs/steamgriddb.md](steamgriddb.md) for integration details and usage notes.

## HaveIBeenPwned (Pwned Passwords API)
- **Purpose:** Checks user passwords against known data breaches to prevent use of compromised credentials.
- **Usage:**
  - Used in: `server/utils/passwordSecurity.js`
  - No API key required for k-Anonymity endpoint
- **Docs:** https://haveibeenpwned.com/API/v3#PwnedPasswords

## Discord Webhook
- **Purpose:** Sends notifications for backup events and server state changes to a Discord channel.
- **Usage:**
  - Used in: `server/utils/discordWebhook.js`
  - Requires: Discord webhook URL (set via environment variable)
- **Docs:** https://discord.com/developers/docs/resources/webhook

---

## Adding/Updating Integrations
- Document all new external services here.
- Include: service name, purpose, code location, required credentials, and official docs link.
