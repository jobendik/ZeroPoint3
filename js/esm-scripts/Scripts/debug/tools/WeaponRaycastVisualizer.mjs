import { Color } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

class WeaponRaycastVisualizer {
    _setupEventListeners() {
        // Listen for weapon shots from ALL weapon systems
        this.app.on('weapon:shotRay', this._onWeaponFired, this);
        // Keyboard control
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', (e)=>{
                if (e.key === 'w' || e.key === 'W') {
                    this.toggle();
                }
            });
        }
    }
    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            Logger.info('[WeaponRaycastVisualizer] ✅ Weapon raycast visualization ENABLED');
            this._showNotification('Weapon Debug: ON', '#F44336');
        } else {
            Logger.info('[WeaponRaycastVisualizer] ❌ Weapon raycast visualization DISABLED');
            this._clearAllRays();
            this._showNotification('Weapon Debug: OFF', '#757575');
        }
    }
    _showNotification(message, color) {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: ${color};
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            font-family: 'Consolas', monospace;
            font-size: 14px;
            font-weight: bold;
            z-index: 10001;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(notification);
        // Fade out and remove after 2 seconds
        setTimeout(()=>{
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(()=>{
                document.body.removeChild(notification);
                document.head.removeChild(style);
            }, 300);
        }, 2000);
    }
    /**
     * Update loop - draws all active rays and removes expired ones
     */ update(dt) {
        if (!this.enabled) return;
        const now = performance.now();
        // Draw rays and remove expired ones
        for(let i = this.debugRays.length - 1; i >= 0; i--){
            const ray = this.debugRays[i];
            if (now < ray.expiresAt) {
                // Calculate fade based on age
                let color = this.rayColor;
                if (this.fadeEnabled) {
                    const age = now - ray.createdAt;
                    const lifetime = ray.expiresAt - ray.createdAt;
                    const ageRatio = age / lifetime;
                    const alpha = 1 - ageRatio; // Fade from 1 to 0
                    color = new Color(this.rayColor.r, this.rayColor.g, this.rayColor.b, alpha);
                }
                // Draw the ray (depthTest=false to show through walls)
                this.app.drawLine(ray.from, ray.to, color, false);
            } else {
                // Ray expired, remove it
                this.debugRays.splice(i, 1);
            }
        }
    }
    /**
     * Handle weapon fire event
     */ _onWeaponFired(data) {
        if (!this.enabled) return;
        // Validate data
        if (!data || !data.from || !data.to) {
            Logger.warn('[WeaponRaycastVisualizer] Invalid weapon:shotRay event data');
            return;
        }
        // Limit number of stored rays to prevent memory bloat
        if (this.debugRays.length >= this.maxDebugRays) {
            this.debugRays.shift(); // Remove oldest ray
        }
        // Add new ray
        const now = performance.now();
        this.debugRays.push({
            from: data.from.clone(),
            to: data.to.clone(),
            shooter: data.shooter || 'unknown',
            createdAt: now,
            expiresAt: now + this.rayLifetimeMs
        });
    }
    /**
     * Clear all rays
     */ _clearAllRays() {
        this.debugRays = [];
    }
    /**
     * Get current ray count (for debugging)
     */ getRayCount() {
        return this.debugRays.length;
    }
    /**
     * Set ray lifetime
     */ setRayLifetime(lifetimeMs) {
        this.rayLifetimeMs = Math.max(50, Math.min(2000, lifetimeMs));
        Logger.debug(`[WeaponRaycastVisualizer] Ray lifetime set to ${this.rayLifetimeMs}ms`);
    }
    /**
     * Set maximum number of rays
     */ setMaxRays(maxRays) {
        this.maxDebugRays = Math.max(5, Math.min(100, maxRays));
        Logger.debug(`[WeaponRaycastVisualizer] Max rays set to ${this.maxDebugRays}`);
        // Trim if over limit
        while(this.debugRays.length > this.maxDebugRays){
            this.debugRays.shift();
        }
    }
    /**
     * Set ray color
     */ setRayColor(r, g, b, a = 1) {
        this.rayColor = new Color(r, g, b, a);
    }
    /**
     * Toggle fade effect
     */ setFadeEnabled(enabled) {
        this.fadeEnabled = enabled;
    }
    /**
     * Cleanup
     */ destroy() {
        // Remove event listener
        this.app.off('weapon:shotRay', this._onWeaponFired, this);
        // Clear all rays
        this._clearAllRays();
        Logger.debug('[WeaponRaycastVisualizer] Destroyed');
    }
    constructor(app){
        this.app = app;
        this.enabled = false;
        // Ray storage and limits
        this.debugRays = [];
        this.maxDebugRays = 20; // Limit to prevent spam and memory bloat
        this.rayLifetimeMs = 200; // How long each ray is visible
        // Visual settings
        this.rayColor = new Color(1, 0, 0, 1); // Red
        this.fadeEnabled = true; // Fade rays as they age
        // Listen for weapon fire events
        this._setupEventListeners();
        Logger.info('[WeaponRaycastVisualizer] Initialized - Press W to toggle');
    }
}

export { WeaponRaycastVisualizer };
