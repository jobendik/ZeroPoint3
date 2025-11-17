import { aiConfig } from '../../config/ai.config.mjs';

/**
 * ⏱️ CountdownSystem - Pre-Game Countdown Manager
 * 
 * Handles the countdown sequence before gameplay starts:
 * - Countdown timer management
 * - UI countdown display updates
 * - Audio cues for countdown
 * - Session activation on countdown completion
 */ class CountdownSystem {
    /**
     * ✅ Start the countdown sequence
     */ startCountdown() {
        this._log('gameState', '[CountdownSystem] 🎬 Starting countdown...');
        this.isCountingDown = true;
        this.countdownTimer = aiConfig.session.COUNTDOWN_DURATION;
        // Show countdown UI
        if (this.gameManager && this.gameManager.uiManager) {
            const initialCount = Math.ceil(this.countdownTimer);
            this.gameManager.uiManager.showCountdown(initialCount);
            this._log('debug', `[CountdownSystem] ✅ Countdown UI shown with initial count: ${initialCount}`);
        } else {
            this._log('warn', '[CountdownSystem] ⚠️ No UI manager - countdown will run silently');
        }
        this._lastLoggedCount = Math.ceil(this.countdownTimer);
    }
    /**
     * ✅ Update countdown (call every frame during countdown)
     * @returns {boolean} True if countdown finished
     */ updateCountdown(dt) {
        if (!this.isCountingDown) return false;
        this.countdownTimer -= dt;
        const currentCount = Math.ceil(this.countdownTimer);
        // Update UI when count changes
        if (currentCount !== this._lastLoggedCount && currentCount > 0) {
            if (this.gameManager && this.gameManager.uiManager) {
                this.gameManager.uiManager.showCountdown(currentCount);
            }
            this._log('gameState', `[CountdownSystem] ⏱️ Countdown: ${currentCount}`);
            this._lastLoggedCount = currentCount;
        }
        // Check if countdown finished
        if (this.countdownTimer <= 0) {
            this._finishCountdown();
            return true;
        }
        return false;
    }
    /**
     * ✅ Finish countdown and activate session
     */ _finishCountdown() {
        this._log('gameState', '[CountdownSystem] ✅ Countdown complete - activating session');
        this.isCountingDown = false;
        this.countdownTimer = 0;
        // Hide countdown UI
        if (this.gameManager && this.gameManager.uiManager) {
            this.gameManager.uiManager.hideCountdown();
            this._log('debug', '[CountdownSystem] ✅ Countdown UI hidden');
        }
        // Fire countdown complete event
        this.app.fire('session:countdown:complete');
    }
    /**
     * ✅ Reset countdown
     */ reset() {
        this.countdownTimer = aiConfig.session.COUNTDOWN_DURATION;
        this.isCountingDown = false;
        this._lastLoggedCount = null;
    }
    /**
     * ✅ Check if countdown is active
     */ isActive() {
        return this.isCountingDown;
    }
    /**
     * ✅ Get remaining countdown time
     */ getRemainingTime() {
        return this.countdownTimer;
    }
    constructor(app, gameManager, logFunction){
        this.app = app;
        this.gameManager = gameManager;
        // Countdown state
        this.countdownTimer = aiConfig.session.COUNTDOWN_DURATION;
        this.isCountingDown = false;
        this._lastLoggedCount = null;
        this._log = logFunction;
    }
}

export { CountdownSystem };
