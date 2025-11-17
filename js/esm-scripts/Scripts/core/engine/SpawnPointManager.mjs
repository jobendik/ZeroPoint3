/**
 * SpawnPointManager.mjs
 * 
 * Handles spawn point selection and management
 * Extracted from SessionCore to improve modularity
 */ class SpawnPointManager {
    /**
     * Get spawn point for AI agent
     * @param {number} agentIndex - Index of agent being spawned
     * @returns {pc.Entity|null} Spawn point entity
     */ getAISpawnPoint(agentIndex) {
        if (!this.gameManager) {
            this.logger('error', '[SpawnPointManager] GameManager is null');
            return null;
        }
        const spawnPoints = this.gameManager.getSpawnPoints();
        if (!spawnPoints || spawnPoints.length === 0) {
            this.logger('error', '[SpawnPointManager] No spawn points available');
            return null;
        }
        // Try to find an unused spawn point first
        const now = Date.now();
        const availablePoints = spawnPoints.filter((sp)=>{
            const lastUsed = this.usedSpawnPoints.get(sp);
            return !lastUsed || now - lastUsed > this.spawnCooldown;
        });
        let spawnPoint;
        if (availablePoints.length > 0) {
            // Use round-robin on available points
            const index = agentIndex % availablePoints.length;
            spawnPoint = availablePoints[index];
        } else {
            // All points on cooldown, use round-robin on all points
            const index = agentIndex % spawnPoints.length;
            spawnPoint = spawnPoints[index];
        }
        // Mark spawn point as used
        this.usedSpawnPoints.set(spawnPoint, now);
        return spawnPoint;
    }
    /**
     * Get spawn point for player
     * @returns {pc.Entity|null} Spawn point entity
     */ getPlayerSpawnPoint() {
        if (!this.gameManager) {
            this.logger('error', '[SpawnPointManager] GameManager is null');
            return null;
        }
        const spawnPoints = this.gameManager.getSpawnPoints();
        if (!spawnPoints || spawnPoints.length === 0) {
            this.logger('error', '[SpawnPointManager] No spawn points available for player');
            return null;
        }
        // Player gets first spawn point by default
        // You can make this more sophisticated later
        return spawnPoints[0];
    }
    /**
     * Clear spawn point usage tracking
     */ reset() {
        this.usedSpawnPoints.clear();
    }
    constructor(gameManager, logger){
        this.gameManager = gameManager;
        this.logger = logger;
        // Track used spawn points to avoid clustering
        this.usedSpawnPoints = new Map(); // spawnPoint -> lastUsedTime
        this.spawnCooldown = 2000; // ms before reusing a spawn point
    }
}

export { SpawnPointManager };
