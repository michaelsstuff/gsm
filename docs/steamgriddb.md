# SteamGridDB Integration

This project integrates with [SteamGridDB](https://www.steamgriddb.com/) to automatically enrich game server entries with high-quality square icons and game metadata.

## What It Does
- When you add or edit a game server, the backend attempts to fetch a square icon from SteamGridDB using the Steam App ID (if available).
- If no icon is found by App ID, it falls back to searching by game name.
- If SteamGridDB does not return an icon, the system falls back to the default Steam image for the game.
- The frontend displays a warning if SteamGridDB lookup fails and a Steam logo is used instead.

## Why Use SteamGridDB?
- SteamGridDB provides high-quality, community-curated square icons for thousands of games, which look better in the UI than Steam's default rectangular images.
- This improves the visual consistency and polish of your game server dashboard.

## API Key Requirement
- To use SteamGridDB integration, you **must** provide an API key.
- Register for a free account at [steamgriddb.com](https://www.steamgriddb.com/).
- After registering, create an API key at: [Profile Preferences → API](https://www.steamgriddb.com/profile/preferences/api)
- Add your API key to your `.env` file:

```
STEAMGRIDDB_API_KEY=your_api_key_here
```

- The API key is required for all icon lookups. If not set, the system will always fall back to Steam images.

## Fallback Logic
- **Primary:** Search SteamGridDB by Steam App ID
- **Secondary:** If no result, search by game name
- **Final:** If still no result, use Steam's default image

## Troubleshooting
- If you see a warning about SteamGridDB icon lookup failure, check that your API key is set and valid.
- You can test your API key and search results using curl or Postman with the SteamGridDB API endpoints.

## Links
- [SteamGridDB Home](https://www.steamgriddb.com/)
- [API Key Creation](https://www.steamgriddb.com/profile/preferences/api)
- [API Documentation](https://www.steamgriddb.com/api/docs)
