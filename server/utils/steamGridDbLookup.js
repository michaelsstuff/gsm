// Utility to query SteamGridDB for a square icon by Steam app ID
// Returns: { iconUrl } or null
const axios = require('axios');

const STEAMGRIDDB_API_KEY = process.env.STEAMGRIDDB_API_KEY;

async function getSteamGridDbIcon(appId, gameName) {
  if (!STEAMGRIDDB_API_KEY) {
    console.log(`[SteamGridDB] No API key set, skipping icon lookup for appId ${appId}`);
    return null;
  }
  try {
    // Step 1: Search for game by Steam app ID
    console.log(`[SteamGridDB] Searching for game by Steam appId ${appId}`);
    let gameId = null;
    let searchRes = await axios.get(`https://www.steamgriddb.com/api/v2/search/autocomplete/${appId}?type=steam`, {
      headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
    });
    if (searchRes.data?.data?.length) {
      gameId = searchRes.data.data[0].id;
      console.log(`[SteamGridDB] Found internal gameId ${gameId} for appId ${appId}`);
    }
    // Fallback: search by name if appId fails
    if (!gameId && gameName) {
      console.log(`[SteamGridDB] Searching for game by name '${gameName}'`);
      const nameRes = await axios.get(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameName)}`, {
        headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
      });
      if (nameRes.data?.data?.length) {
        gameId = nameRes.data.data[0].id;
        console.log(`[SteamGridDB] Found internal gameId ${gameId} for name '${gameName}'`);
      }
    }
    if (!gameId) {
      console.log(`[SteamGridDB] No internal gameId found for appId ${appId} or name '${gameName}'`);
      return null;
    }
    // Step 2: Get icons for internal game ID
    console.log(`[SteamGridDB] Requesting icon for internal gameId ${gameId}`);
    const iconRes = await axios.get(`https://www.steamgriddb.com/api/v2/icons/game/${gameId}`, {
      headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
    });
    const icons = iconRes.data?.data || [];
    // Prefer square icons
    const squareIcon = icons.find(icon => icon.width === icon.height);
    if (squareIcon) {
      console.log(`[SteamGridDB] Found square icon for gameId ${gameId}: ${squareIcon.url}`);
      return { iconUrl: squareIcon.url };
    }
    // Fallback to first icon
    if (icons.length) {
      console.log(`[SteamGridDB] Found non-square icon for gameId ${gameId}: ${icons[0].url}`);
      return { iconUrl: icons[0].url };
    }
    console.log(`[SteamGridDB] No icons found for gameId ${gameId}`);
    return null;
  } catch (err) {
    console.log(`[SteamGridDB] Error for appId ${appId}:`, err?.response?.data || err.message);
    return null;
  }
}

module.exports = { getSteamGridDbIcon };
