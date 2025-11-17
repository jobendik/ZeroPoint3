/**
 * AI Player Profile
 * Generates realistic player names and profiles for AI agents to blend in
 * Used for cosmetic disguise in UI, scoreboards, and killfeed
 */ class AIPlayerProfile {
    /**
     * Generate realistic gamer-style names
     * Mimics common naming patterns seen in FPS games
     */ generateRealisticName() {
        const style = Math.random();
        if (style < 0.25) {
            // Edgy gamer style: xXDarkSniperXx
            return this._generateEdgyName();
        } else if (style < 0.5) {
            // Simple combo: ProKiller, ShadowNinja
            return this._generateSimpleName();
        } else if (style < 0.75) {
            // Word + Numbers: Warrior7382, Ghost420
            return this._generateWordNumberName();
        } else {
            // Generic: Player_1234
            return this._generateGenericName();
        }
    }
    _generateEdgyName() {
        const prefixes = [
            'xX',
            'Xx',
            'oo',
            'll',
            '–',
            '—'
        ];
        const middles = [
            'Dark',
            'Shadow',
            'Silent',
            'Ghost',
            'Phantom',
            'Stealth',
            'Pro',
            'Elite',
            'Alpha',
            'Omega',
            'Legend',
            'Master',
            'Sniper',
            'Killer',
            'Hunter',
            'Reaper',
            'Demon',
            'Assassin',
            'Wolf',
            'Dragon',
            'Viper',
            'Hawk',
            'Raven',
            'Phoenix'
        ];
        const suffixes = [
            'Xx',
            'xX',
            'oo',
            'll',
            '420',
            '69',
            '2024',
            '2025',
            'YT',
            'TTV',
            'TV'
        ];
        const prefix = this._random(prefixes);
        const middle1 = this._random(middles);
        const middle2 = Math.random() > 0.6 ? this._random(middles) : '';
        const suffix = this._random(suffixes);
        return `${prefix}${middle1}${middle2}${suffix}`;
    }
    _generateSimpleName() {
        const adjectives = [
            'Pro',
            'Epic',
            'Dark',
            'Silent',
            'Ghost',
            'Shadow',
            'Elite',
            'Alpha',
            'Omega',
            'Swift',
            'Deadly',
            'Fatal',
            'Toxic',
            'Savage'
        ];
        const nouns = [
            'Sniper',
            'Killer',
            'Hunter',
            'Warrior',
            'Ninja',
            'Assassin',
            'Wolf',
            'Dragon',
            'Viper',
            'Hawk',
            'Reaper',
            'Soldier',
            'Fighter',
            'Striker',
            'Ranger',
            'Agent',
            'Operator'
        ];
        return `${this._random(adjectives)}${this._random(nouns)}`;
    }
    _generateWordNumberName() {
        const words = [
            'Warrior',
            'Ghost',
            'Shadow',
            'Hunter',
            'Killer',
            'Sniper',
            'Dragon',
            'Wolf',
            'Viper',
            'Phoenix',
            'Reaper',
            'Soldier',
            'Ninja',
            'Assassin',
            'Phantom',
            'Demon',
            'Player',
            'Gamer'
        ];
        const word = this._random(words);
        const number = Math.floor(Math.random() * 10000);
        return `${word}${number}`;
    }
    _generateGenericName() {
        const prefixes = [
            'Player',
            'Gamer',
            'User',
            'Warrior',
            'Agent'
        ];
        const number = Math.floor(1000 + Math.random() * 9000);
        return `${this._random(prefixes)}_${number}`;
    }
    randomPlatform() {
        const platforms = [
            'PC',
            'PC',
            'PC',
            'PS5',
            'Xbox'
        ]; // PC weighted higher
        return this._random(platforms);
    }
    randomClan() {
        const clans = [
            'ELITE',
            'PRO',
            'NOOB',
            'TRYHARD',
            'RAGE',
            'GG',
            'APEX',
            'VOID',
            'ZERO',
            'FURY',
            'TOXIC',
            'SAVAGE'
        ];
        return this._random(clans);
    }
    /**
     * Get display name with optional clan tag
     */ getDisplayName() {
        return this.clan ? `[${this.clan}] ${this.name}` : this.name;
    }
    /**
     * Update ping to simulate network fluctuation
     */ updatePing() {
        this.ping += Math.floor(Math.random() * 11) - 5; // ±5ms
        this.ping = Math.max(15, Math.min(100, this.ping)); // Clamp 15-100ms
    }
    /**
     * Get a random element from an array
     */ _random(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    constructor(){
        this.name = this.generateRealisticName();
        this.platform = this.randomPlatform();
        this.ping = 15 + Math.floor(Math.random() * 85); // 15-100ms
        this.level = 5 + Math.floor(Math.random() * 45); // 5-50
        this.clan = Math.random() > 0.7 ? this.randomClan() : null; // 30% have clan tags
    }
}

export { AIPlayerProfile, AIPlayerProfile as default };
