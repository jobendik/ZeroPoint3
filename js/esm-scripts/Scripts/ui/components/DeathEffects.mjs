/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DEATH VISUAL EFFECTS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE:
 * Manages all visual effects for cinematic death experience:
 * - Impact effects (chromatic aberration, vignette)
 * - Death camera effects (desaturation, blur)
 * - Death stats overlay
 * - Respawn countdown
 * - Resurrection flash
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */ class DeathEffects {
    /**
     * Create HTML overlays for death effects
     */ _createEffectOverlays() {
        // Impact flash overlay (red vignette)
        this.impactOverlay = document.createElement('div');
        this.impactOverlay.id = 'death-impact-overlay';
        this.impactOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9998;
            opacity: 0;
            background: radial-gradient(circle at center, transparent 0%, rgba(255,0,0,0.8) 100%);
            transition: opacity 0.1s ease-out;
        `;
        document.body.appendChild(this.impactOverlay);
        // Death camera overlay (desaturation + blue tint)
        this.deathCameraOverlay = document.createElement('div');
        this.deathCameraOverlay.id = 'death-camera-overlay';
        this.deathCameraOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9997;
            opacity: 0;
            background: rgba(20, 40, 60, 0.3);
            backdrop-filter: saturate(0.3) blur(2px);
            transition: opacity 0.5s ease-in;
        `;
        document.body.appendChild(this.deathCameraOverlay);
        // Death stats overlay
        this.deathStatsOverlay = document.createElement('div');
        this.deathStatsOverlay.id = 'death-stats-overlay';
        this.deathStatsOverlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 9999;
            opacity: 0;
            text-align: center;
            font-family: 'Orbitron', 'Rajdhani', sans-serif;
            color: white;
            text-shadow: 0 0 20px rgba(255,0,0,0.8), 0 0 40px rgba(255,0,0,0.5);
            transition: opacity 0.3s ease-in;
        `;
        this.deathStatsOverlay.innerHTML = `
            <div style="border: 2px solid rgba(255,255,255,0.3); padding: 30px 60px; background: rgba(0,0,0,0.8); border-radius: 10px; backdrop-filter: blur(10px);">
                <div id="death-title" style="font-size: 48px; font-weight: bold; margin-bottom: 20px; letter-spacing: 3px;">
                    💀 ELIMINATED 💀
                </div>
                <div style="font-size: 20px; opacity: 0.8; margin: 10px 0; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 15px;">
                    <div id="death-killer" style="margin: 5px 0;">Killed by: <span style="color: #ff4444;">AI-HUNTER-3</span></div>
                    <div id="death-weapon" style="margin: 5px 0;">Weapon: <span style="color: #ffaa00;">Combat Shotgun</span></div>
                </div>
                <div style="font-size: 18px; opacity: 0.6; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px;">
                    <div id="death-kills" style="margin: 5px 0;">Your Kills: <span style="color: #00ff88;">0</span></div>
                    <div id="death-streak" style="margin: 5px 0;">Kill Streak: <span style="color: #00ff88;">0</span> ⚡</div>
                </div>
            </div>
        `;
        document.body.appendChild(this.deathStatsOverlay);
        // Respawn countdown overlay
        this.respawnCountdown = document.createElement('div');
        this.respawnCountdown.id = 'respawn-countdown';
        this.respawnCountdown.style.cssText = `
            position: fixed;
            top: 60%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            font-family: 'Orbitron', 'Rajdhani', sans-serif;
            font-size: 72px;
            font-weight: bold;
            color: white;
            text-shadow: 0 0 30px rgba(0,255,255,0.8), 0 0 60px rgba(0,255,255,0.5);
            transition: opacity 0.2s ease-in;
        `;
        this.respawnCountdown.textContent = 'RESPAWNING...';
        document.body.appendChild(this.respawnCountdown);
        // Respawn flash overlay (white)
        this.respawnFlash = document.createElement('div');
        this.respawnFlash.id = 'respawn-flash';
        this.respawnFlash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10001;
            opacity: 0;
            background: white;
            transition: opacity 0.1s ease-out;
        `;
        document.body.appendChild(this.respawnFlash);
    }
    /**
     * Show impact effects (red flash + vignette)
     */ showImpact() {
        console.log('[DeathEffects] 💥 Impact flash');
        this.impactOverlay.style.opacity = '1';
        // Fade out after 200ms
        setTimeout(()=>{
            this.impactOverlay.style.opacity = '0';
        }, 200);
    }
    /**
     * Show death camera effects (desaturation + blur)
     */ showDeathCamera() {
        console.log('[DeathEffects] 🎥 Death camera effects');
        this.deathCameraOverlay.style.opacity = '1';
    }
    /**
     * Show death stats overlay
     */ showStats(deathInfo) {
        console.log('[DeathEffects] 📊 Death stats', deathInfo);
        // Update stats with actual data
        if (deathInfo) {
            const killerName = deathInfo.killer?.name || deathInfo.killerName || 'Unknown';
            const weapon = deathInfo.weapon || 'Unknown Weapon';
            const kills = deathInfo.playerKills || 0;
            const streak = deathInfo.killStreak || 0;
            document.getElementById('death-killer').innerHTML = `Killed by: <span style="color: #ff4444;">${killerName}</span>`;
            document.getElementById('death-weapon').innerHTML = `Weapon: <span style="color: #ffaa00;">${weapon}</span>`;
            document.getElementById('death-kills').innerHTML = `Your Kills: <span style="color: #00ff88;">${kills}</span>`;
            document.getElementById('death-streak').innerHTML = `Kill Streak: <span style="color: #00ff88;">${streak}</span> ⚡`;
        }
        // Animate in
        this.deathStatsOverlay.style.opacity = '1';
        // Add pulsing animation
        const title = document.getElementById('death-title');
        if (title) {
            title.style.animation = 'pulse 1s ease-in-out infinite';
        }
    }
    /**
     * Show respawn countdown
     */ showCountdown() {
        console.log('[DeathEffects] 🔢 Respawn countdown');
        this.respawnCountdown.style.opacity = '1';
        // Animated countdown: 3... 2... 1...
        let count = 3;
        this.respawnCountdown.textContent = count.toString();
        const countdownInterval = setInterval(()=>{
            count--;
            if (count > 0) {
                this.respawnCountdown.textContent = count.toString();
                // Scale pulse animation
                this.respawnCountdown.style.transform = 'translate(-50%, -50%) scale(1.3)';
                setTimeout(()=>{
                    this.respawnCountdown.style.transform = 'translate(-50%, -50%) scale(1)';
                }, 100);
            } else {
                this.respawnCountdown.textContent = 'GO!';
                clearInterval(countdownInterval);
                // Hide after showing GO
                setTimeout(()=>{
                    this.respawnCountdown.style.opacity = '0';
                }, 300);
            }
        }, 333); // 3 counts in 1 second
    }
    /**
     * Show respawn flash (white burst)
     */ showRespawnFlash() {
        console.log('[DeathEffects] ✨ Respawn flash');
        // Full white flash
        this.respawnFlash.style.opacity = '1';
        // Fade out quickly
        setTimeout(()=>{
            this.respawnFlash.style.transition = 'opacity 0.5s ease-out';
            this.respawnFlash.style.opacity = '0';
        }, 100);
    }
    /**
     * Hide all death effects
     */ hideAll() {
        console.log('[DeathEffects] 🔄 Hiding all death effects');
        this.impactOverlay.style.opacity = '0';
        this.deathCameraOverlay.style.opacity = '0';
        this.deathStatsOverlay.style.opacity = '0';
        this.respawnCountdown.style.opacity = '0';
        this.respawnFlash.style.opacity = '0';
    }
    /**
     * Cleanup
     */ destroy() {
        if (this.impactOverlay) this.impactOverlay.remove();
        if (this.deathCameraOverlay) this.deathCameraOverlay.remove();
        if (this.deathStatsOverlay) this.deathStatsOverlay.remove();
        if (this.respawnCountdown) this.respawnCountdown.remove();
        if (this.respawnFlash) this.respawnFlash.remove();
    }
    constructor(uiManager){
        this.uiManager = uiManager;
        this.app = uiManager.app;
        // Create effect overlays
        this._createEffectOverlays();
        console.log('[DeathEffects] ✅ Initialized');
    }
}
// Add pulse animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }
`;
document.head.appendChild(style);

export { DeathEffects };
