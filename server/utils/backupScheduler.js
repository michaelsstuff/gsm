const cron = require('node-cron');
const GameServer = require('../models/GameServer');
const dockerService = require('./dockerService');

class BackupScheduler {
    constructor() {
        this.jobs = new Map();
        // Watch for server deletions
        this.setupModelWatcher();
    }

    setupModelWatcher() {
        // Setup post-remove hook on GameServer model
        GameServer.schema.post('remove', (server) => {
            this.stopJob(server._id.toString());
        });

        // Setup post-save hook to ensure scheduler stays in sync
        GameServer.schema.post('save', (server) => {
            if (server.backupSchedule?.enabled) {
                this.updateJob(server);
            } else {
                this.stopJob(server._id.toString());
            }
        });
    }

    async initializeJobs() {
        try {
            // Clear existing jobs
            this.stopAllJobs();

            // Get all servers with enabled backup schedules
            const servers = await GameServer.find({ 'backupSchedule.enabled': true });
            
            // Create jobs for each server
            servers.forEach(server => {
                this.createJob(server);
            });

            console.log(`Initialized ${servers.length} backup jobs`);
        } catch (error) {
            console.error('Failed to initialize backup jobs:', error);
        }
    }

    createJob(server) {
        if (this.jobs.has(server._id.toString())) {
            this.jobs.get(server._id.toString()).stop();
        }

        if (!server.backupSchedule?.enabled || !server.backupSchedule?.cronExpression) {
            return;
        }

        // Validate cron expression
        if (!cron.validate(server.backupSchedule.cronExpression)) {
            console.error(`Invalid cron expression for server ${server.name}`);
            return;
        }

        const job = cron.schedule(server.backupSchedule.cronExpression, async () => {
            console.log(`Starting scheduled backup for ${server.name}`);
            try {
                // Reload server to get latest config
                const updatedServer = await GameServer.findById(server._id);
                if (!updatedServer || !updatedServer.backupSchedule?.enabled) {
                    console.log(`Skipping backup for ${server.name} - schedule disabled or server removed`);
                    this.stopJob(server._id.toString());
                    return;
                }

                await dockerService.runCommand(server.containerName, 'backup');
                
                // Update last backup time
                await GameServer.findByIdAndUpdate(server._id, {
                    'backupSchedule.lastBackup': new Date()
                });
                
                console.log(`Completed scheduled backup for ${server.name}`);
            } catch (error) {
                console.error(`Backup failed for ${server.name}:`, error);
                // Update server status to indicate backup failure
                await GameServer.findByIdAndUpdate(server._id, {
                    $set: {
                        'backupSchedule.lastError': {
                            message: error.message,
                            date: new Date()
                        }
                    }
                }).catch(err => {
                    console.error('Failed to update backup error status:', err);
                });
            }
        });

        this.jobs.set(server._id.toString(), job);
        console.log(`Created backup job for ${server.name} with schedule ${server.backupSchedule.cronExpression}`);
    }

    updateJob(server) {
        this.createJob(server); // This will handle stopping existing job if it exists
    }

    stopJob(serverId) {
        if (this.jobs.has(serverId)) {
            this.jobs.get(serverId).stop();
            this.jobs.delete(serverId);
        }
    }

    stopAllJobs() {
        this.jobs.forEach(job => job.stop());
        this.jobs.clear();
    }
}

// Create singleton instance
const scheduler = new BackupScheduler();

module.exports = scheduler;