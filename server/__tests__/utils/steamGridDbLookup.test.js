const steamGridDbLookup = require('../../utils/steamGridDbLookup');
const axios = require('axios');
jest.mock('axios');

describe('steamGridDbLookup', () => {
  beforeEach(() => {
    process.env.STEAMGRIDDB_API_KEY = 'testkey';
  });
  it('returns null if no API key', async () => {
    process.env.STEAMGRIDDB_API_KEY = '';
    const result = await steamGridDbLookup.getSteamGridDbIcon(123, 'Test');
    expect(result).toBeNull();
  });
  it('returns iconUrl if found', async () => {
    axios.get.mockResolvedValueOnce({ data: { data: [{ id: 1 }] } });
    axios.get.mockResolvedValueOnce({ data: { data: [{ width: 100, height: 100, url: 'icon.png' }] } });
    const result = await steamGridDbLookup.getSteamGridDbIcon(123, 'Test');
    expect(result).toHaveProperty('iconUrl', 'icon.png');
  });
  it('returns null if no icon found', async () => {
    axios.get.mockResolvedValueOnce({ data: { data: [{ id: 1 }] } });
    axios.get.mockResolvedValueOnce({ data: { data: [] } });
    const result = await steamGridDbLookup.getSteamGridDbIcon(123, 'Test');
    expect(result).toBeNull();
  });
});
