// Utility to query Steam for game info by name
// Returns: { appId, name, storeUrl, logoUrl }
const axios = require('axios');
const { getSteamGridDbIcon } = require('./steamGridDbLookup');

async function searchSteamGame(gameName) {
  // Step 1: Search Steam Store for the game
  const searchRes = await axios.get('https://store.steampowered.com/api/storesearch', {
    params: { term: gameName, cc: 'us', l: 'en' }
  });
  const items = searchRes.data?.items || [];
  if (!items.length) return null;
  // Step 2: Prefer exact match, then main game (type: 'app', not soundtrack/DLC)
  let match = items.find(item => item.name.toLowerCase() === gameName.toLowerCase() && item.type === 'app');
  if (!match) {
    match = items.find(item => item.type === 'app');
  }
  if (!match) match = items[0];
  if (!match) return null;
  // Step 3: Get details from appdetails
  const appId = match.id;
  let logoUrl = match.tiny_image;
  // Try SteamGridDB for square icon (pass gameName for fallback)
  const gridIcon = await getSteamGridDbIcon(appId, gameName);
  if (gridIcon && gridIcon.iconUrl) {
    console.log(`[SteamLookup] Found SteamGridDB icon for appId ${appId}: ${gridIcon.iconUrl}`);
    logoUrl = gridIcon.iconUrl;
  } else {
    console.log(`[SteamLookup] No SteamGridDB icon for appId ${appId}, using Steam image.`);
    try {
      const storeRes = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
      const data = storeRes.data?.[appId]?.data;
      if (data) {
        logoUrl = data.capsule_image || data.header_image || logoUrl;
      }
    } catch (e) {
      // Ignore appdetails errors, fallback to tiny_image
    }
  }
  return {
    appId,
    name: match.name,
    storeUrl: `https://store.steampowered.com/app/${appId}`,
    logoUrl
  };
}

module.exports = { searchSteamGame };