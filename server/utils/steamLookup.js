// Utility to query Steam for game info by name
// Returns: { appId, name, storeUrl, logoUrl }
const axios = require('axios');
const { getSteamGridDbIcon } = require('./steamGridDbLookup');

const isSteamHostedAssetUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'store.steampowered.com' ||
      hostname === 'steamstatic.com' ||
      hostname.endsWith('.steamstatic.com')
    );
  } catch (error) {
    return false;
  }
};

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
  let description = '';
  // Try SteamGridDB for square icon (pass gameName for fallback)
  const gridIcon = await getSteamGridDbIcon(appId, gameName);
  let appDetails = null;
  try {
    const storeRes = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
    appDetails = storeRes.data?.[appId]?.data;
    if (appDetails) {
      logoUrl = appDetails.capsule_image || appDetails.header_image || logoUrl;
      description = appDetails.short_description || '';
    }
  } catch (e) {
    // Ignore appdetails errors, fallback to tiny_image
  }
  if (gridIcon && gridIcon.iconUrl) {
    console.log(`[SteamLookup] Found SteamGridDB icon for appId ${appId}: ${gridIcon.iconUrl}`);
    logoUrl = gridIcon.iconUrl;
  } else {
    console.log(`[SteamLookup] No SteamGridDB icon for appId ${appId}, using Steam image.`);
  }
  return {
    appId,
    name: match.name,
    storeUrl: `https://store.steampowered.com/app/${appId}`,
    logoUrl,
    description
  };
}

function mapSteamInfoToGameServerFields(steamInfo, fallbackName = '') {
  if (!steamInfo || !steamInfo.appId) return {};
  let steamGridDbFailed = false;
  const logo = steamInfo.logoUrl || '';
  if (isSteamHostedAssetUrl(logo)) {
    steamGridDbFailed = true;
  }
  return {
    steamAppId: steamInfo.appId,
    name: steamInfo.name || fallbackName,
    websiteUrl: steamInfo.storeUrl || '',
    logo,
    description: steamInfo.description || '',
    steamGridDbFailed
  };
}

module.exports = { searchSteamGame, mapSteamInfoToGameServerFields };
