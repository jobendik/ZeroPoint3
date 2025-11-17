import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

/**
 * KillFeedSystem - Live FPS-style kill feed with HTML overlays
 * Displays kills, deaths, headshots, and other exciting events
 * Features smooth animations, emojis, icons, and auto-fade
 * Uses HTML overlays for maximum visual impact!
 */ function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
/**
 * KillFeedEntry - Individual kill feed item (HTML-based)
 */ class KillFeedEntry {
    /**
     * Get weapon emoji icon
     */ getWeaponIcon() {
        const icons = {
            'pistol': '🔫',
            'machinegun': '⚡',
            'shotgun': '💥',
            'melee': '🔪',
            'explosion': '💣',
            'fall': '⬇️'
        };
        return icons[this.weapon] || '→';
    }
    /**
     * Get colors based on event type
     */ getColors() {
        if (this.isPlayer && this.isHeadshot) {
            return {
                bg: 'linear-gradient(90deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.05) 100%)',
                border: '#FFD700',
                killer: '#FFD700',
                victim: '#FFFFFF',
                glow: '0 0 15px rgba(255,215,0,0.5)'
            };
        } else if (this.isPlayer) {
            return {
                bg: 'linear-gradient(90deg, rgba(0,255,0,0.15) 0%, rgba(0,255,0,0.05) 100%)',
                border: '#00FF00',
                killer: '#00FF00',
                victim: '#FFFFFF',
                glow: '0 0 15px rgba(0,255,0,0.4)'
            };
        } else if (this.isHeadshot) {
            return {
                bg: 'linear-gradient(90deg, rgba(255,107,107,0.12) 0%, rgba(255,107,107,0.04) 100%)',
                border: '#FF6B6B',
                killer: '#FFFFFF',
                victim: '#FF6B6B',
                glow: '0 0 12px rgba(255,107,107,0.3)'
            };
        } else {
            return {
                bg: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                border: '#888888',
                killer: '#CCCCCC',
                victim: '#AAAAAA',
                glow: 'none'
            };
        }
    }
    /**
     * Create HTML element for this entry with EPIC animations
     */ createHTMLElement() {
        const colors = this.getColors();
        const weaponIcon = this.getWeaponIcon();
        const headshotBadge = this.isHeadshot ? '<span style="color: #FF0000; font-weight: bold; margin-left: 8px; animation: pulse 0.5s ease-in-out;">💀 HEADSHOT</span>' : '';
        const div = document.createElement('div');
        div.className = 'killfeed-entry';
        div.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
            padding: 14px 24px;
            margin-bottom: 10px;
            background: ${colors.bg};
            border-left: 4px solid ${colors.border};
            border-radius: 12px;
            font-family: 'Impact', 'Arial Black', sans-serif;
            font-size: 18px;
            font-weight: bold;
            white-space: nowrap;
            backdrop-filter: blur(10px);
            box-shadow: ${colors.glow}, 0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
            transition: all 0.3s ease;
            transform: translateX(100%);
            opacity: 0;
            overflow: hidden;
        `;
        // Add animated background shine for player kills
        if (this.isPlayer) {
            const shine = document.createElement('div');
            shine.style.cssText = `
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
                animation: shine 2s ease-in-out infinite;
                pointer-events: none;
            `;
            div.appendChild(shine);
        }
        div.innerHTML += `
            <span style="
                color: ${colors.killer}; 
                text-shadow: 0 0 8px ${colors.killer}, 0 2px 4px rgba(0,0,0,0.9);
                letter-spacing: 1px;
                position: relative;
                z-index: 1;
            ">${this.killer}</span>
            <span style="
                color: #FFFFFF; 
                margin: 0 16px; 
                font-size: 24px; 
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.9)) drop-shadow(0 0 10px ${colors.border});
                animation: ${this.isPlayer ? 'weaponPulse 1s ease-in-out infinite' : 'none'};
                position: relative;
                z-index: 1;
            ">${weaponIcon}</span>
            <span style="
                color: ${colors.victim}; 
                text-shadow: 0 0 8px rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.9);
                letter-spacing: 1px;
                position: relative;
                z-index: 1;
            ">${this.victim}</span>
            ${headshotBadge}
        `;
        this.htmlElement = div;
        return div;
    }
    constructor(data){
        this.killer = data.killer || 'Unknown';
        this.victim = data.victim || 'Unknown';
        this.weapon = data.weapon || 'pistol';
        this.isHeadshot = data.isHeadshot || false;
        this.isPlayer = data.isPlayer || false; // Is player the killer?
        this.timestamp = Date.now();
        this.htmlElement = null;
    }
}
/**
 * KillFeedSystem Class - HTML Overlay Based with Performance Optimization
 */ class KillFeedSystem {
    /**
     * Initialize kill feed system
     */ initialize() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🎯 [KillFeed] INITIALIZING HTML overlay system...');
        console.log('═══════════════════════════════════════════════════════════');
        Logger.debug('[KillFeed] Initializing HTML overlay system...');
        // Create HTML container
        this._createHTMLContainer();
        // Setup event listeners
        this._setupEventListeners();
        // Start update loop
        this._startUpdateLoop();
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ [KillFeed] HTML OVERLAY SYSTEM READY!');
        console.log(`   - Lifetime: ${this.entryLifetime}ms`);
        console.log(`   - Fade duration: ${this.fadeOutDuration}ms`);
        console.log(`   - Max entries: ${this.maxEntries}`);
        console.log('═══════════════════════════════════════════════════════════');
        Logger.debug('[KillFeed] ✅ HTML overlay system ready');
    }
    /**
     * Create HTML container for kill feed with CSS animations
     */ _createHTMLContainer() {
        // Inject CSS animations
        this._injectCSS();
        this.htmlContainer = document.createElement('div');
        this.htmlContainer.id = 'killfeed-container';
        this.htmlContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 450px;
            max-height: 500px;
            z-index: 9999;
            pointer-events: none;
            font-family: 'Impact', 'Arial Black', sans-serif;
        `;
        document.body.appendChild(this.htmlContainer);
        Logger.debug('[KillFeed] HTML container with animations created');
    }
    /**
     * Inject CSS animations and styles (OPTIMIZED)
     */ _injectCSS() {
        if (document.getElementById('killfeed-styles')) return;
        const style = document.createElement('style');
        style.id = 'killfeed-styles';
        style.textContent = `
            @keyframes shine {
                0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
                100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
            }
            
            @keyframes weaponPulse {
                0%, 100% { transform: scale(1) rotate(0deg); }
                50% { transform: scale(1.2) rotate(5deg); }
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.8; }
            }
            
            @keyframes slideInBounce {
                0% { transform: translateX(100%); opacity: 0; }
                60% { transform: translateX(-10px); opacity: 1; }
                80% { transform: translateX(5px); }
                100% { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes glowPulse {
                0%, 100% { filter: brightness(1); }
                50% { filter: brightness(1.3); }
            }
            
            .killfeed-entry {
                animation: slideInBounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                will-change: transform, opacity;
            }
            
            .particle {
                will-change: transform, opacity;
            }
        `;
        document.head.appendChild(style);
    }
    /**
     * Detect performance and adjust quality
     */ _detectPerformance() {
        const now = performance.now();
        const delta = now - this._lastFrameTime;
        this._lastFrameTime = now;
        const fps = 1000 / delta;
        this._fpsHistory.push(fps);
        // Keep last 60 frames
        if (this._fpsHistory.length > 60) {
            this._fpsHistory.shift();
        }
        // Calculate average FPS every 60 frames
        if (this._fpsHistory.length === 60) {
            const avgFps = this._fpsHistory.reduce((a, b)=>a + b) / 60;
            // Adjust quality based on FPS
            if (avgFps < 30) {
                this._performanceMode = 'low';
            } else if (avgFps < 50) {
                this._performanceMode = 'medium';
            } else {
                this._performanceMode = 'high';
            }
            this._fpsHistory = []; // Reset
        }
    }
    /**
     * Get particle count based on performance mode
     */ _getParticleCount(isHeadshot) {
        switch(this._performanceMode){
            case 'low':
                return isHeadshot ? 6 : 4; // DRASTICALLY REDUCED
            case 'medium':
                return isHeadshot ? 10 : 6; // REDUCED
            case 'high':
            default:
                return isHeadshot ? 14 : 8; // REDUCED from 24/16
        }
    }
    /**
     * Get sparkle count based on performance mode
     */ _getSparkleCount(intense) {
        switch(this._performanceMode){
            case 'low':
                return intense ? 3 : 2; // DRASTICALLY REDUCED
            case 'medium':
                return intense ? 5 : 3; // REDUCED
            case 'high':
            default:
                return intense ? 8 : 4; // REDUCED from 12/8
        }
    }
    /**
     * Get or create particle from pool
     */ _getParticle() {
        if (this._particlePool.length > 0) {
            return this._particlePool.pop();
        }
        return document.createElement('div');
    }
    /**
     * Return particle to pool
     */ _returnParticle(particle) {
        if (this._particlePool.length < this._maxPoolSize) {
            // Reset particle
            particle.style.cssText = '';
            particle.className = 'particle';
            this._particlePool.push(particle);
        }
    }
    /**
     * Setup event listeners
     */ _setupEventListeners() {
        if (this._eventsBound) return;
        this._eventsBound = true;
        // Listen to combat events
        this.app.on('entity:died', this._onEntityDied, this);
        this.app.on('entity:damaged', this._onEntityDamaged, this);
        this.app.on('killfeed:add', this._onCustomFeedEntry, this);
        // Listen to kill streak events
        this.app.on('ui:killstreak_milestone', this._onKillStreakMilestone, this);
        // Listen to menu state changes
        this.app.on('menu:opened', this._onMenuOpened, this);
        this.app.on('menu:closed', this._onMenuClosed, this);
        Logger.debug('[KillFeed] Event listeners setup');
    }
    /**
     * Handle menu opened - hide killfeed
     */ _onMenuOpened() {
        if (this.htmlContainer) {
            this._wasVisibleBeforeMenu = this.htmlContainer.style.display !== 'none';
            this.htmlContainer.style.display = 'none';
            Logger.debug('[KillFeed] Menu opened - hiding killfeed');
        }
    }
    /**
     * Handle menu closed - restore killfeed
     */ _onMenuClosed() {
        if (this.htmlContainer && this._wasVisibleBeforeMenu) {
            this.htmlContainer.style.display = 'block';
            Logger.debug('[KillFeed] Menu closed - restoring killfeed');
        }
    }
    /**
     * Handle entity death
     */ _onEntityDied(data) {
        Logger.debug('[KillFeed] entity:died event received:', data);
        // Support both 'killer' and 'attacker' field names
        const { entity, killer, attacker, isHeadshot } = data;
        const killerEntity = killer || attacker;
        if (!entity || !killerEntity) {
            Logger.warn('[KillFeed] Missing entity or killer in death event:', {
                entity: !!entity,
                killer: !!killer,
                attacker: !!attacker,
                killerEntity: !!killerEntity
            });
            return;
        }
        // Get entity names
        const victimName = this._getEntityName(entity);
        const killerName = this._getEntityName(killerEntity);
        // Determine if player is the killer
        const isPlayer = killerEntity.tags && killerEntity.tags.has('player');
        // Get weapon type
        const weapon = this._getCurrentWeapon(killerEntity);
        Logger.debug('[KillFeed] Adding entry:', {
            killer: killerName,
            victim: victimName,
            weapon: weapon,
            isHeadshot: isHeadshot || false,
            isPlayer: isPlayer
        });
        // Add kill feed entry
        this.addEntry({
            killer: killerName,
            victim: victimName,
            weapon: weapon,
            isHeadshot: isHeadshot || false,
            isPlayer: isPlayer
        });
        // Show elimination announcement if player killed someone
        if (isPlayer) {
            this._showEliminationAnnouncement(victimName, isHeadshot, weapon);
            this._trackMultiKill();
        }
    }
    /**
     * Track multi-kills for special announcements
     */ _trackMultiKill() {
        const now = Date.now();
        // Check if within multi-kill window
        if (now - this.lastKillTime < this.multiKillWindow) {
            this.multiKillCount++;
            // Show special multi-kill messages
            if (this.multiKillCount === 2) {
                this._showMultiKillAnnouncement('🔥 DOUBLE KILL! 🔥', '#FF6B00');
            } else if (this.multiKillCount === 3) {
                this._showMultiKillAnnouncement('⚡ TRIPLE KILL! ⚡', '#FF0000');
            } else if (this.multiKillCount === 4) {
                this._showMultiKillAnnouncement('💀 QUAD KILL! 💀', '#8B00FF');
            } else if (this.multiKillCount >= 5) {
                this._showMultiKillAnnouncement('👑 MEGA KILL! 👑', '#FFD700');
            }
        } else {
            this.multiKillCount = 1;
        }
        this.lastKillTime = now;
    }
    /**
     * Show multi-kill announcement with OPTIMIZED styling (SIMPLIFIED for performance)
     */ _showMultiKillAnnouncement(text, color) {
        // Skip in LOW performance mode
        if (this._performanceMode === 'low') {
            Logger.debug('[KillFeed] Skipping multi-kill announcement in LOW mode');
            return;
        }
        // Convert hex color to rgba for glow effects
        const hexToRgba = (hex, alpha)=>{
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        const glowColor = hexToRgba(color, 0.9);
        const announcement = document.createElement('div');
        announcement.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            z-index: 10001;
            text-align: center;
            pointer-events: none;
            font-family: 'Impact', 'Arial Black', sans-serif;
            font-size: 72px;
            font-weight: 900;
            color: ${color};
            letter-spacing: 8px;
            text-shadow: 
                0 0 20px ${glowColor},
                0 0 40px ${glowColor},
                5px 5px 10px rgba(0, 0, 0, 0.9);
            filter: brightness(1.4) drop-shadow(0 0 20px ${color});
        `;
        announcement.textContent = text;
        document.body.appendChild(announcement);
        // SIMPLIFIED animation - no flicker, no shake, no excessive effects
        const duration = 500; // Faster
        const startTime = performance.now();
        const animate = ()=>{
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Simple scale with ease-out
            const scale = progress * 1.5;
            announcement.style.transform = `translate(-50%, -50%) scale(${scale})`;
            announcement.style.opacity = progress;
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Quick hold, then simple fade
                const holdStart = performance.now();
                const holdDuration = 800; // Shorter hold
                const hold = ()=>{
                    const holdElapsed = performance.now() - holdStart;
                    if (holdElapsed < holdDuration) {
                        // Simple pulse - NO complex effects
                        const pulseScale = 1.5 + Math.sin(holdElapsed * 0.004) * 0.05;
                        announcement.style.transform = `translate(-50%, -50%) scale(${pulseScale})`;
                        requestAnimationFrame(hold);
                    } else {
                        // Simple fade-out
                        const fadeStart = performance.now();
                        const fadeDuration = 400;
                        const fadeOut = ()=>{
                            const fadeElapsed = performance.now() - fadeStart;
                            const fadeProgress = Math.min(fadeElapsed / fadeDuration, 1);
                            announcement.style.opacity = 1 - fadeProgress;
                            announcement.style.transform = `translate(-50%, -50%) scale(${1.5 + fadeProgress * 0.3})`;
                            if (fadeProgress < 1) {
                                requestAnimationFrame(fadeOut);
                            } else {
                                document.body.removeChild(announcement);
                            }
                        };
                        fadeOut();
                    }
                };
                hold();
            }
        };
        animate();
    }
    /**
     * Handle special damage events (optional for future use)
     */ _onEntityDamaged(data) {
    // Could be used for shield breaks, armor destroys, etc.
    // Not implemented yet to avoid spam
    }
    /**
     * Handle custom feed entries
     */ _onCustomFeedEntry(data) {
        // Allow other systems to add custom messages
        this.addEntry(data);
    }
    /**
     * Handle kill streak milestones
     */ _onKillStreakMilestone(data) {
        const { streak } = data;
        // Add special kill streak message with epic styling
        this.addEntry({
            killer: `⚡ ${streak} KILL STREAK`,
            victim: 'ON FIRE! 🔥',
            weapon: '',
            isPlayer: true,
            isHeadshot: false
        });
    }
    /**
     * Get entity name
     */ _getEntityName(entity) {
        // Check if it's the player
        if (entity.tags && entity.tags.has('player')) {
            return 'YOU';
        }
        // Check if it's an AI agent
        if (entity.tags && entity.tags.has('ai')) {
            // ✨ NEW: Try to get display name from AI profile
            if (entity.script && entity.script.aiAgent) {
                const aiAgent = entity.script.aiAgent;
                // Use profile name if available
                if (aiAgent.profile) {
                    return aiAgent.getDisplayName();
                }
                // Fallback to agent name
                const agentName = aiAgent.agentName;
                if (agentName && agentName !== 'AIAgent') {
                    return agentName;
                }
            }
            // Fallback: Generate unique name from entity
            const uniqueId = entity.getGuid ? entity.getGuid().substring(0, 6) : Math.random().toString(36).substring(2, 8);
            return `Enemy-${uniqueId.toUpperCase()}`;
        }
        // Try to get name from entity
        if (entity.name && entity.name !== 'Untitled' && entity.name !== 'AIAgent') {
            return entity.name;
        }
        return 'Unknown';
    }
    /**
     * Get current weapon from entity
     */ _getCurrentWeapon(entity) {
        // Try to get weapon from WeaponCore script
        if (entity.script && entity.script.weaponCore) {
            return entity.script.weaponCore.currentWeapon || 'pistol';
        }
        return 'pistol';
    }
    /**
     * Add entry to kill feed with EPIC FIREWORKS!
     */ addEntry(data) {
        Logger.debug('[KillFeed] Adding HTML overlay entry:', data);
        if (!this.htmlContainer) {
            Logger.error('[KillFeed] Cannot add entry - HTML container not found!');
            return;
        }
        // Create entry
        const entry = new KillFeedEntry(data);
        // Add to entries array
        this.entries.unshift(entry); // Add to top
        Logger.debug('[KillFeed] Entry created, total entries:', this.entries.length);
        // Limit entries
        if (this.entries.length > this.maxEntries) {
            const removed = this.entries.pop();
            this._removeHTMLElement(removed);
        }
        // Create and add HTML element
        const htmlElement = entry.createHTMLElement();
        this.htmlContainer.insertBefore(htmlElement, this.htmlContainer.firstChild);
        // 🎯 CRITICAL FIX: Trigger slide-in animation by removing inline transform/opacity
        // The CSS animation won't work if inline styles override it!
        requestAnimationFrame(()=>{
            htmlElement.style.transform = ''; // Remove inline transform to let CSS animation work
            htmlElement.style.opacity = ''; // Remove inline opacity to let CSS animation work
        });
        // Trigger fireworks for player kills!
        if (data.isPlayer) {
            this._createKillFireworks(htmlElement, data.isHeadshot);
            // Extra epic effects for headshots
            if (data.isHeadshot) {
                this._createHeadshotExplosion(htmlElement);
                this._shakeElement(htmlElement);
            }
            // Mega pulse effect (delayed to not interfere with slide-in animation)
            setTimeout(()=>{
                htmlElement.style.transform = 'scale(1.12)';
                htmlElement.style.filter = 'brightness(1.4)';
                setTimeout(()=>{
                    htmlElement.style.transform = 'scale(1)';
                    htmlElement.style.filter = 'brightness(1)';
                }, 200);
            }, 600); // Increased from 500ms to 600ms to let slide-in finish
        }
        Logger.debug('[KillFeed] HTML element added with fireworks!');
    }
    /**
     * Create fireworks particles (OPTIMIZED with pooling and transform)
     */ _createKillFireworks(element, isHeadshot = false) {
        if (!element) return;
        // AGGRESSIVE throttling - reduced from 30 to 15
        if (this._activeParticles > 15) {
            Logger.debug('[KillFeed] Skipping fireworks - too many active particles');
            return;
        }
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        // Adaptive particle count based on performance
        const particleCount = this._getParticleCount(isHeadshot);
        const colors = isHeadshot ? [
            '#FFD700',
            '#FF0000',
            '#FF1493',
            '#FFFF00'
        ] : [
            '#00FF00',
            '#00FF88',
            '#88FF00',
            '#FFFF00'
        ];
        for(let i = 0; i < particleCount; i++){
            const particle = this._getParticle();
            const angle = i / particleCount * Math.PI * 2;
            const velocity = 100 + Math.random() * 80;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 4 + Math.random() * 6;
            // Use transform instead of left/top for better performance
            particle.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border-radius: 50%;
                pointer-events: none;
                z-index: 10003;
                box-shadow: 0 0 15px ${color}, 0 0 25px ${color};
                transform: translate3d(${centerX}px, ${centerY}px, 0);
            `;
            document.body.appendChild(particle);
            this._activeParticles++;
            // Animate particle with transform (hardware accelerated)
            const startTime = performance.now();
            const duration = 1200;
            const animate = ()=>{
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const x = centerX + Math.cos(angle) * velocity * progress;
                const y = centerY + Math.sin(angle) * velocity * progress + progress * progress * 300; // Gravity
                // Use transform3d for GPU acceleration
                particle.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${1 - progress * 0.3}) rotate(${progress * 360}deg)`;
                particle.style.opacity = 1 - progress;
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    document.body.removeChild(particle);
                    this._returnParticle(particle);
                    this._activeParticles--;
                }
            };
            animate();
        }
        // Add sparkles with adaptive count
        this._createSparkles(centerX, centerY, isHeadshot);
    }
    /**
     * Create sparkle effects (OPTIMIZED)
     */ _createSparkles(x, y, intense = false) {
        const sparkleCount = this._getSparkleCount(intense);
        for(let i = 0; i < sparkleCount; i++){
            setTimeout(()=>{
                const sparkle = this._getParticle();
                const offsetX = (Math.random() - 0.5) * 100;
                const offsetY = (Math.random() - 0.5) * 100;
                sparkle.style.cssText = `
                    position: fixed;
                    left: 0;
                    top: 0;
                    width: 3px;
                    height: 3px;
                    background: white;
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 10004;
                    box-shadow: 0 0 10px white, 0 0 20px white;
                    transform: translate3d(${x + offsetX}px, ${y + offsetY}px, 0);
                `;
                document.body.appendChild(sparkle);
                this._activeParticles++;
                // Quick flash with transform
                const startTime = performance.now();
                const duration = 400;
                const animate = ()=>{
                    const elapsed = performance.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    sparkle.style.opacity = 1 - progress;
                    sparkle.style.transform = `translate3d(${x + offsetX}px, ${y + offsetY}px, 0) scale(${1 + progress * 2})`;
                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        document.body.removeChild(sparkle);
                        this._returnParticle(sparkle);
                        this._activeParticles--;
                    }
                };
                animate();
            }, i * 50);
        }
    }
    /**
     * Create headshot explosion effect (OPTIMIZED with transform)
     */ _createHeadshotExplosion(element) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        // Create explosion ring
        const ring = document.createElement('div');
        ring.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 10px;
            height: 10px;
            border: 4px solid #FF0000;
            border-radius: 50%;
            pointer-events: none;
            z-index: 10002;
            box-shadow: 0 0 30px #FF0000, inset 0 0 20px #FF0000;
            transform: translate3d(${centerX - 5}px, ${centerY - 5}px, 0);
        `;
        document.body.appendChild(ring);
        // Animate explosion with transform
        const startTime = performance.now();
        const duration = 600;
        const animate = ()=>{
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const size = 10 + progress * 150;
            // Use transform for scaling
            ring.style.width = '10px';
            ring.style.height = '10px';
            ring.style.transform = `translate3d(${centerX - 5}px, ${centerY - 5}px, 0) scale(${size / 10})`;
            ring.style.opacity = 1 - progress;
            ring.style.borderWidth = 4 - progress * 3 + 'px';
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                document.body.removeChild(ring);
            }
        };
        animate();
    }
    /**
     * Shake element violently (OPTIMIZED with transform3d)
     */ _shakeElement(element) {
        if (!element) return;
        const duration = 400;
        const startTime = performance.now();
        const intensity = 8;
        const shake = ()=>{
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            if (progress < 1) {
                const offsetX = (Math.random() - 0.5) * intensity * (1 - progress);
                const offsetY = (Math.random() - 0.5) * intensity * (1 - progress);
                // Use transform3d for GPU acceleration
                element.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
                requestAnimationFrame(shake);
            } else {
                element.style.transform = 'translate3d(0, 0, 0)';
            }
        };
        shake();
    }
    /**
     * Remove HTML element
     */ _removeHTMLElement(entry) {
        if (entry && entry.htmlElement && entry.htmlElement.parentNode) {
            entry.htmlElement.parentNode.removeChild(entry.htmlElement);
        }
    }
    /**
     * Update loop - handle fading and removal
     */ _startUpdateLoop() {
        this.app.on('update', this._update, this);
    }
    /**
     * Update kill feed (HTML overlay with performance detection)
     */ _update(dt) {
        const now = Date.now();
        // Detect performance every frame
        this._detectPerformance();
        // Check each entry for expiration
        for(let i = this.entries.length - 1; i >= 0; i--){
            const entry = this.entries[i];
            const age = now - entry.timestamp;
            // Start fading out
            if (age > this.entryLifetime - this.fadeOutDuration) {
                const fadeProgress = (age - (this.entryLifetime - this.fadeOutDuration)) / this.fadeOutDuration;
                if (entry.htmlElement) {
                    const opacity = 1 - fadeProgress;
                    entry.htmlElement.style.opacity = Math.max(0, opacity);
                    // Use transform3d for GPU acceleration
                    entry.htmlElement.style.transform = `translate3d(${fadeProgress * 50}px, 0, 0) scale(${1 - fadeProgress * 0.2})`;
                }
            }
            // Remove expired entries
            if (age > this.entryLifetime) {
                Logger.debug(`[KillFeed] Removing entry after ${(age / 1000).toFixed(1)}s`);
                this._removeHTMLElement(entry);
                this.entries.splice(i, 1);
            }
        }
    }
    /**
     * Clear all entries
     */ clear() {
        this.entries.forEach((entry)=>{
            this._removeHTMLElement(entry);
        });
        this.entries = [];
    }
    /**
     * Show large elimination announcement with SIMPLIFIED styling (PERFORMANCE OPTIMIZED)
     */ _showEliminationAnnouncement(victimName, isHeadshot, weapon) {
        // Skip in LOW performance mode
        if (this._performanceMode === 'low') {
            Logger.debug('[KillFeed] Skipping elimination announcement in LOW mode');
            return;
        }
        // Get current kill streak from ProgressionMetrics
        let currentStreak = 0;
        if (window.progressionMetrics) {
            currentStreak = window.progressionMetrics.getCurrentProgression().currentStreak;
        }
        // Create overlay div
        const announcement = document.createElement('div');
        announcement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            z-index: 10000;
            text-align: center;
            pointer-events: none;
        `;
        // Choose message based on type - PRIORITY: Streak > Headshot > Weapon
        let mainText = '';
        let subText = victimName;
        let color = '#FFD700'; // Gold
        let glowColor = 'rgba(255, 215, 0, 0.8)'; // Gold glow
        // Check for kill streak milestones first (highest priority)
        if (currentStreak >= 10) {
            mainText = '👑 UNSTOPPABLE! 👑';
            subText = `${currentStreak} KILL STREAK!`;
            color = '#FF00FF'; // Magenta
            glowColor = 'rgba(255, 0, 255, 0.9)'; // Magenta glow
        } else if (currentStreak >= 7) {
            mainText = '💀 DOMINATING! 💀';
            subText = `${currentStreak} KILL STREAK!`;
            color = '#8B00FF'; // Purple
            glowColor = 'rgba(139, 0, 255, 0.9)'; // Purple glow
        } else if (currentStreak >= 5) {
            mainText = '🔥 RAMPAGE! 🔥';
            subText = `${currentStreak} KILL STREAK!`;
            color = '#FF4500'; // Orange-red
            glowColor = 'rgba(255, 69, 0, 0.9)'; // Orange-red glow
        } else if (currentStreak >= 3) {
            mainText = '⚡ KILLING SPREE! ⚡';
            subText = `${currentStreak} KILL STREAK!`;
            color = '#FFD700'; // Gold
            glowColor = 'rgba(255, 215, 0, 0.9)'; // Gold glow
        } else if (isHeadshot) {
            // Headshot takes priority over normal kills
            mainText = '💀 HEADSHOT! 💀';
            color = '#FF0000'; // Bright red
            glowColor = 'rgba(255, 0, 0, 0.8)'; // Red glow
        } else if (weapon === 'shotgun') {
            mainText = '💥 ELIMINATED! 💥';
            color = '#FF6600'; // Orange
            glowColor = 'rgba(255, 102, 0, 0.8)'; // Orange glow
        } else {
            mainText = '✨ ELIMINATED ✨';
            color = '#00FF00'; // Green
            glowColor = 'rgba(0, 255, 0, 0.8)'; // Green glow
        }
        // SIMPLIFIED HTML - fewer effects
        announcement.innerHTML = `
            <div style="
                font-size: 64px;
                font-weight: 900;
                font-family: 'Impact', 'Arial Black', sans-serif;
                color: ${color};
                margin-bottom: 8px;
                letter-spacing: 6px;
                text-shadow: 
                    0 0 20px ${glowColor},
                    0 0 40px ${glowColor},
                    4px 4px 8px rgba(0, 0, 0, 0.9);
                filter: brightness(1.3);
            ">${mainText}</div>
            <div style="
                font-size: 36px;
                font-weight: 700;
                font-family: 'Impact', 'Arial Black', sans-serif;
                color: #FFFFFF;
                text-shadow: 
                    0 0 10px rgba(255, 255, 255, 0.8),
                    3px 3px 6px rgba(0, 0, 0, 0.9);
                letter-spacing: 2px;
            ">${subText}</div>
        `;
        document.body.appendChild(announcement);
        // SIMPLIFIED animation - NO flicker, NO shake
        const duration = 500; // Faster
        const startTime = performance.now();
        const animateIn = ()=>{
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Simple scale with ease-out
            const scale = progress * 1.3;
            announcement.style.transform = `translate(-50%, -50%) scale(${scale})`;
            announcement.style.opacity = progress;
            if (progress < 1) {
                requestAnimationFrame(animateIn);
            } else {
                // Quick hold, then simple fade
                setTimeout(()=>{
                    const fadeStart = performance.now();
                    const fadeDuration = 400;
                    const fadeOut = ()=>{
                        const fadeElapsed = performance.now() - fadeStart;
                        const fadeProgress = Math.min(fadeElapsed / fadeDuration, 1);
                        announcement.style.opacity = 1 - fadeProgress;
                        announcement.style.transform = `translate(-50%, -50%) scale(${1.3 + fadeProgress * 0.2})`;
                        if (fadeProgress < 1) {
                            requestAnimationFrame(fadeOut);
                        } else {
                            document.body.removeChild(announcement);
                        }
                    };
                    fadeOut();
                }, 700); // Shorter hold
            }
        };
        animateIn();
    }
    /**
     * Cleanup with style removal and particle pool cleanup
     */ destroy() {
        if (!this._initialized) return;
        this.app.off('update', this._update, this);
        this.app.off('entity:died', this._onEntityDied, this);
        this.app.off('entity:damaged', this._onEntityDamaged, this);
        this.app.off('killfeed:add', this._onCustomFeedEntry, this);
        this.app.off('ui:killstreak_milestone', this._onKillStreakMilestone, this);
        this.app.off('menu:opened', this._onMenuOpened, this);
        this.app.off('menu:closed', this._onMenuClosed, this);
        this.clear();
        // Clean up particle pool
        this._particlePool = [];
        this._activeParticles = 0;
        // Remove HTML container
        if (this.htmlContainer && this.htmlContainer.parentNode) {
            this.htmlContainer.parentNode.removeChild(this.htmlContainer);
        }
        // Remove injected CSS
        const styleElement = document.getElementById('killfeed-styles');
        if (styleElement && styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
        }
        this._initialized = false;
        this._eventsBound = false;
        Logger.debug('[KillFeed] HTML overlay system destroyed (Performance Optimized) 🎆');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // Kill feed entries
        this.entries = [];
        this.maxEntries = 6;
        this.entryLifetime = 15000; // 15 seconds (extra long for visibility)
        this.fadeOutDuration = 3000; // 3 second fade (smoother)
        // HTML container
        this.htmlContainer = null;
        // State
        this._initialized = false;
        this._eventsBound = false;
        this._wasVisibleBeforeMenu = true; // Track visibility for menu handling;
        // Multi-kill tracking
        this.lastKillTime = 0;
        this.multiKillCount = 0;
        this.multiKillWindow = 4000; // 4 seconds for multi-kill
        // Performance optimization
        this._particlePool = [];
        this._maxPoolSize = 50;
        this._activeParticles = 0;
        this._performanceMode = 'high'; // high, medium, low
        this._lastFrameTime = performance.now();
        this._fpsHistory = [];
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🎯 [KillFeed] SYSTEM CREATED - HTML Overlay Mode');
        console.log('═══════════════════════════════════════════════════════════');
        Logger.debug('[KillFeed] System created (HTML Overlay Mode - Performance Optimized)');
    }
}
/**
 * PlayCanvas Script Adapter
 */ class KillFeedSystemScript extends Script {
    initialize() {
        this.killFeed = new KillFeedSystem(this.app, this.entity);
        this.killFeed.initialize();
        // Make available globally for debugging
        window.killFeed = this.killFeed;
        Logger.debug('[KillFeed] Script initialized');
    }
    destroy() {
        if (this.killFeed) {
            this.killFeed.destroy();
            this.killFeed = null;
        }
    }
}
_define_property(KillFeedSystemScript, "scriptName", 'killFeedSystem');

export { KillFeedSystemScript };
