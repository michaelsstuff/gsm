const axios = require('axios');

/**
 * Discord webhook service for sending notifications about game server status changes
 */
const discordWebhook = {
  /**
   * Send a notification to Discord via webhook
   * @param {Object} server - The game server object
   * @param {string} action - The action that occurred (start, stop, restart, backup)
   * @param {string} status - Current status of the server
   * @returns {Promise<boolean>} - True if notification was sent successfully
   */
  async sendNotification(server, action, status) {
    try {
      // Skip if Discord webhooks are disabled for this server
      if (!server.discordWebhook || !server.discordWebhook.enabled || !server.discordWebhook.url) {
        return false;
      }

      // Skip based on notification preferences
      if ((action === 'start' && !server.discordWebhook.notifyOnStart) ||
          (action === 'stop' && !server.discordWebhook.notifyOnStop)) {
        return false;
      }

      // Format message based on action
      let color, title, description;
      
      switch (action) {
        case 'start':
          color = 5763719; // Green
          title = '🟢 Server Started';
          description = `The game server has been started and is now online.`;
          break;
        case 'stop':
          color = 15548997; // Red
          title = '🔴 Server Stopped';
          description = `The game server has been stopped and is now offline.`;
          break;
        case 'restart':
          color = 16776960; // Yellow
          title = '🔄 Server Restarted';
          description = `The game server has been restarted.`;
          break;
        case 'backup':
          color = 7506394; // Blue
          title = '💾 Server Backup';
          description = `A backup of the server has been created.`;
          break;
        default:
          color = 8421504; // Gray
          title = `Server Update`;
          description = `The server status has changed to: ${status}`;
      }

      // Create Discord embed
      const embed = {
        color: color,
        title: title,
        description: description,
        fields: [
          {
            name: 'Server Name',
            value: server.name,
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Game Server Manager'
        }
      };

      // Add connection info if server is running
      if (status === 'running' && server.connectionString) {
        embed.fields.push({
          name: 'Connection',
          value: server.connectionString,
          inline: false
        });
      }

      // Send the webhook notification
      await axios.post(server.discordWebhook.url, {
        embeds: [embed]
      });

      console.log(`Discord notification sent for server ${server.name} (${action})`);
      return true;
    } catch (error) {
      console.error(`Error sending Discord notification for server ${server?._id || 'unknown'}:`, error.message);
      return false;
    }
  }
};

module.exports = discordWebhook;
