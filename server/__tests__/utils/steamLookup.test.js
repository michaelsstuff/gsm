const steamLookup = require('../../utils/steamLookup');
const axios = require('axios');
jest.mock('axios');

describe('steamLookup', () => {
  it('should return null if no items found', async () => {
    axios.get.mockResolvedValueOnce({ data: { items: [] } });
    const result = await steamLookup.searchSteamGame('Nonexistent');
    expect(result).toBeNull();
  });

  it('should return game info for a found game', async () => {
    axios.get.mockResolvedValueOnce({ data: { items: [{ id: 1, name: 'Test', type: 'app', tiny_image: 'img' }] } });
    axios.get.mockResolvedValueOnce({ data: { 1: { data: { capsule_image: 'img2', short_description: 'desc' } } } });
    const result = await steamLookup.searchSteamGame('Test');
    expect(result).toHaveProperty('appId', 1);
    expect(result).toHaveProperty('name', 'Test');
    expect(result).toHaveProperty('logoUrl');
    expect(result).toHaveProperty('description');
  });
});
