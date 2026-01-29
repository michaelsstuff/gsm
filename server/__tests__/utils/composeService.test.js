const composeService = require('../../utils/composeService');
const ComposeFile = require('../../models/ComposeFile');
const mongoose = require('mongoose');

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, opts, cb) => {
    if (cmd.includes('up')) cb(null, { stdout: 'Deployed', stderr: '' });
    else if (cmd.includes('down')) cb(null, { stdout: 'Undeployed', stderr: '' });
    else cb(new Error('Unknown command'));
  })
}));

describe('composeService', () => {
  describe('deploy', () => {
    it('should deploy compose content successfully', async () => {
      const result = await composeService.deploy('id', 'version: "3"', 'testproject');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Deployed');
      expect(result.error).toBeNull();
    });
    it('should handle deployment errors', async () => {
      require('child_process').exec.mockImplementationOnce((cmd, opts, cb) => cb(new Error('fail')));
      const result = await composeService.deploy('id', 'badcontent', 'testproject');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('undeploy', () => {
    it('should undeploy compose project successfully', async () => {
      const result = await composeService.undeploy('id', 'testproject');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Undeployed');
      expect(result.error).toBeNull();
    });
    it('should handle undeploy errors', async () => {
      require('child_process').exec.mockImplementationOnce((cmd, opts, cb) => cb(new Error('fail')));
      const result = await composeService.undeploy('id', 'testproject');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
