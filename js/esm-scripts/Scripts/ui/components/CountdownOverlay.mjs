import { Logger } from '../../core/engine/logger.mjs';

class CountdownOverlay {
    /**
     * Start countdown sequence
     * @param {number} startCount - Starting number (e.g., 3)
     * @param {Function} onComplete - Callback when countdown finishes
     */ startCountdown(startCount = 3, onComplete = null) {
        if (this.isActive) {
            // Silently ignore duplicate countdown requests (normal during game start)
            return;
        }
        this.isActive = true;
        Logger.info(`[CountdownOverlay] Starting countdown from ${startCount}`);
        let currentCount = startCount;
        const showNext = ()=>{
            if (currentCount > 0) {
                this._showNumber(currentCount);
                currentCount--;
                setTimeout(showNext, 1000); // 1 second between numbers
            } else {
                // Show "GO!"
                this._showGo();
                setTimeout(()=>{
                    this.isActive = false;
                    if (onComplete) {
                        onComplete();
                    }
                }, 1200); // Show GO for 1.2 seconds
            }
        };
        showNext();
    }
    /**
     * Show a number with dramatic animation
     * @private
     */ _showNumber(number) {
        // Clean up previous element
        this._cleanup();
        // Create dramatic number overlay
        const countdown = document.createElement('div');
        countdown.className = 'countdown-number-overlay';
        countdown.textContent = number;
        // Styling
        countdown.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            font-size: 200px;
            font-weight: 900;
            color: #ff0000;
            text-shadow: 
                0 0 20px rgba(255, 0, 0, 0.8),
                0 0 40px rgba(255, 0, 0, 0.6),
                0 0 60px rgba(255, 0, 0, 0.4),
                0 0 80px rgba(255, 0, 0, 0.2),
                4px 4px 8px rgba(0, 0, 0, 0.9);
            z-index: 10000;
            pointer-events: none;
            font-family: 'Impact', 'Arial Black', sans-serif;
            letter-spacing: 10px;
            opacity: 0;
            filter: brightness(1.5);
        `;
        document.body.appendChild(countdown);
        this.currentCountdownElement = countdown;
        // Dramatic entrance animation with flickering
        const duration = 800; // ms
        const startTime = Date.now();
        const animate = ()=>{
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Explosive scale animation (ease-out-back)
            const scaleProgress = progress * (1 + 0.3 * Math.sin(progress * Math.PI));
            const scale = scaleProgress * 2.5;
            // Flickering effect
            const flickerSpeed = 10;
            const flicker = Math.sin(elapsed * flickerSpeed * 0.001) * 0.15 + 0.85;
            // Opacity fade in
            const opacity = Math.min(progress * 1.5, 1);
            // Apply transformations
            countdown.style.transform = `translate(-50%, -50%) scale(${scale})`;
            countdown.style.opacity = opacity * flicker;
            // Random subtle position shake
            const shakeX = (Math.random() - 0.5) * 4;
            const shakeY = (Math.random() - 0.5) * 4;
            countdown.style.left = `calc(50% + ${shakeX}px)`;
            countdown.style.top = `calc(50% + ${shakeY}px)`;
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Hold for a moment, then fade out
                setTimeout(()=>{
                    countdown.style.transition = 'all 0.3s ease-out';
                    countdown.style.opacity = '0';
                    countdown.style.transform = 'translate(-50%, -50%) scale(3.5)';
                    countdown.style.filter = 'brightness(2) blur(20px)';
                }, 100);
            }
        };
        animate();
        Logger.debug(`[CountdownOverlay] Showing number: ${number}`);
    }
    /**
     * Show "GO!" with extra drama
     * @private
     */ _showGo() {
        // Clean up previous element
        this._cleanup();
        // Create dramatic GO! overlay
        const goText = document.createElement('div');
        goText.className = 'countdown-go-overlay';
        goText.textContent = 'GO!';
        // Styling - Green for GO!
        goText.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            font-size: 250px;
            font-weight: 900;
            color: #00ff00;
            text-shadow: 
                0 0 30px rgba(0, 255, 0, 1),
                0 0 60px rgba(0, 255, 0, 0.8),
                0 0 90px rgba(0, 255, 0, 0.6),
                0 0 120px rgba(0, 255, 0, 0.4),
                6px 6px 12px rgba(0, 0, 0, 0.9);
            z-index: 10000;
            pointer-events: none;
            font-family: 'Impact', 'Arial Black', sans-serif;
            letter-spacing: 20px;
            opacity: 0;
            filter: brightness(2);
        `;
        document.body.appendChild(goText);
        this.currentCountdownElement = goText;
        // Extra dramatic entrance for GO!
        const duration = 600; // ms
        const startTime = Date.now();
        const animate = ()=>{
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Super explosive scale
            const scaleProgress = progress * (1 + 0.5 * Math.sin(progress * Math.PI));
            const scale = scaleProgress * 3;
            // Intense flickering
            const flickerSpeed = 15;
            const flicker = Math.sin(elapsed * flickerSpeed * 0.001) * 0.2 + 0.8;
            // Opacity
            const opacity = Math.min(progress * 2, 1);
            // Apply transformations
            goText.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${progress * 5}deg)`;
            goText.style.opacity = opacity * flicker;
            // Stronger shake
            const shakeX = (Math.random() - 0.5) * 8;
            const shakeY = (Math.random() - 0.5) * 8;
            goText.style.left = `calc(50% + ${shakeX}px)`;
            goText.style.top = `calc(50% + ${shakeY}px)`;
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Explosive exit
                setTimeout(()=>{
                    goText.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    goText.style.opacity = '0';
                    goText.style.transform = 'translate(-50%, -50%) scale(5) rotate(15deg)';
                    goText.style.filter = 'brightness(3) blur(30px)';
                    setTimeout(()=>{
                        this._cleanup();
                    }, 400);
                }, 600);
            }
        };
        animate();
        Logger.info('[CountdownOverlay] Showing GO!');
    }
    /**
     * Clean up current countdown element
     * @private
     */ _cleanup() {
        if (this.currentCountdownElement && this.currentCountdownElement.parentNode) {
            try {
                document.body.removeChild(this.currentCountdownElement);
            } catch (error) {
            // Element might already be removed
            }
            this.currentCountdownElement = null;
        }
    }
    /**
     * Cancel active countdown
     */ cancel() {
        if (this.isActive) {
            this.isActive = false;
            this._cleanup();
            Logger.info('[CountdownOverlay] Countdown cancelled');
        }
    }
    /**
     * Cleanup on destroy
     */ destroy() {
        this.cancel();
        Logger.info('[CountdownOverlay] Countdown overlay destroyed');
    }
    constructor(app){
        this.app = app;
        this.currentCountdownElement = null;
        this.isActive = false;
        Logger.info('[CountdownOverlay] Countdown overlay system initialized');
    }
}

export { CountdownOverlay };
