///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * 🎯 Enhanced Game Logger v2.0 - OPTIMIZED ANTI-FLOOD EDITION
 * Advanced debugging with anti-flooding, performance monitoring, and smart filtering
 * ESM Module Version for PlayCanvas
 */ // ============================================================================
// CONFIGURATION
// ============================================================================
const LoggerConfig = {
    LEVELS: {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3,
        DETAIL: 4
    },
    CATEGORIES: {
        // Core system
        debug: {
            level: 'DEBUG',
            color: '#9CA3AF',
            emoji: '🔍',
            enabled: true
        },
        info: {
            level: 'INFO',
            color: '#60A5FA',
            emoji: 'ℹ️',
            enabled: true
        },
        warn: {
            level: 'WARN',
            color: '#FBBF24',
            emoji: '⚠️',
            enabled: true
        },
        error: {
            level: 'ERROR',
            color: '#EF4444',
            emoji: '❌',
            enabled: true
        },
        // AI & Goals - Keep important ones
        aiState: {
            level: 'DEBUG',
            color: '#8B5CF6',
            emoji: '🤖',
            enabled: true
        },
        aiDetail: {
            level: 'DETAIL',
            color: '#A78BFA',
            emoji: '🧠',
            enabled: false
        },
        goal: {
            level: 'DEBUG',
            color: '#10B981',
            emoji: '🎯',
            enabled: true
        },
        tactic: {
            level: 'DEBUG',
            color: '#F59E0B',
            emoji: '⚔️',
            enabled: true
        },
        // Combat & Health - Keep important ones
        combat: {
            level: 'INFO',
            color: '#DC2626',
            emoji: '💥',
            enabled: true
        },
        health: {
            level: 'DEBUG',
            color: '#EC4899',
            emoji: '❤️',
            enabled: true
        },
        weaponDetail: {
            level: 'DETAIL',
            color: '#F97316',
            emoji: '🔫',
            enabled: false
        },
        // Navigation & Movement - Keep important ones
        nav: {
            level: 'DEBUG',
            color: '#14B8A6',
            emoji: '🧭',
            enabled: true
        },
        navDetail: {
            level: 'DETAIL',
            color: '#06B6D4',
            emoji: '📍',
            enabled: false
        },
        // Items & Pickups
        pickup: {
            level: 'DEBUG',
            color: '#84CC16',
            emoji: '📦',
            enabled: true
        },
        itemDetail: {
            level: 'DETAIL',
            color: '#22C55E',
            emoji: '🎁',
            enabled: false
        },
        // Game State
        gameState: {
            level: 'INFO',
            color: '#6366F1',
            emoji: '🎮',
            enabled: true
        },
        ui: {
            level: 'DEBUG',
            color: '#8B5CF6',
            emoji: '🖥️',
            enabled: true
        },
        table: {
            level: 'DEBUG',
            color: '#D946EF',
            emoji: '📊',
            enabled: true
        },
        // Performance
        perf: {
            level: 'WARN',
            color: '#FF6B6B',
            emoji: '⚡',
            enabled: false
        }
    },
    // Anti-flooding settings - IMPROVED
    DEDUPLICATION: {
        enabled: true,
        timeWindow: 500,
        minCount: 3,
        maxBuffer: 100 // ✅ Increased from 50
    },
    // Performance monitoring
    PERFORMANCE: {
        enabled: true,
        warnThreshold: 16,
        criticalThreshold: 50,
        trackCategories: true
    },
    // Smart filtering
    FILTERS: {
        excludePatterns: [],
        includePatterns: [],
        smartGroup: true // group related sequential logs
    },
    // THROTTLE - IMPROVED with more patterns
    THROTTLE: {
        enabled: true,
        patterns: [
            // ✅ PERFORMANCE FIX: More aggressive throttling patterns
            {
                pattern: /FOV check for/i,
                maxPerSecond: 1
            },
            {
                pattern: /Raycast/i,
                maxPerSecond: 2
            },
            {
                pattern: /Vision.*targets/i,
                maxPerSecond: 1
            },
            {
                pattern: /Target.*confidence/i,
                maxPerSecond: 1
            },
            {
                pattern: /Processing \d+ potential targets/i,
                maxPerSecond: 1
            },
            {
                pattern: /Vision processed/i,
                maxPerSecond: 1
            },
            {
                pattern: /Current target invalid/i,
                maxPerSecond: 1
            },
            {
                pattern: /target is dead/i,
                maxPerSecond: 1
            },
            {
                pattern: /checking if entity/i,
                maxPerSecond: 1
            },
            {
                pattern: /WEAPON SETGOAL/i,
                maxPerSecond: 3
            },
            {
                pattern: /Exhausted all random position/i,
                maxPerSecond: 1
            },
            {
                pattern: /WEAPON GOAL DEBUG/i,
                maxPerSecond: 5
            },
            {
                pattern: /path.*found/i,
                maxPerSecond: 2
            },
            {
                pattern: /steering.*update/i,
                maxPerSecond: 1
            } // ✅ Reduced from 2
        ]
    },
    GLOBAL_LEVEL: 'DEBUG',
    MAX_HISTORY: 2000,
    ENABLE_TIMESTAMPS: true,
    ENABLE_EMOJIS: true,
    COLLAPSED_GROUPS: false
};
// ============================================================================
// THROTTLE SYSTEM
// ============================================================================
class MessageThrottler {
    shouldThrottle(args) {
        if (!this.config.enabled) return false;
        const message = args.join(' ');
        const now = Date.now();
        for (const rule of this.config.patterns){
            if (rule.pattern.test(message)) {
                const key = rule.pattern.toString();
                if (!this.messageCounts.has(key)) {
                    this.messageCounts.set(key, []);
                }
                const timestamps = this.messageCounts.get(key);
                // Remove timestamps older than 1 second
                const recentTimestamps = timestamps.filter((t)=>now - t < 1000);
                if (recentTimestamps.length >= rule.maxPerSecond) {
                    return true; // Throttle this message
                }
                recentTimestamps.push(now);
                this.messageCounts.set(key, recentTimestamps);
                return false;
            }
        }
        return false;
    }
    clear() {
        this.messageCounts.clear();
    }
    constructor(config){
        this.config = config;
        this.messageCounts = new Map();
    }
}
// ============================================================================
// DEBUG SYSTEM INTEGRATION
// ============================================================================
// Add integration with EventBus for debug events
function emitDebugEvent(level, category, message, data) {
    // Only emit significant events to avoid spam
    const significantLevels = [
        'ERROR',
        'WARN'
    ];
    const significantCategories = [
        'error',
        'warn',
        'gameState',
        'aiState'
    ];
    if (significantLevels.includes(level) || significantCategories.includes(category)) {
        // Try to find eventBus and emit debug event
        if (typeof window !== 'undefined' && window.app && window.app.eventBus) {
            window.app.eventBus.emitDebugEvent(category, message, level.toLowerCase(), data);
        } else if (typeof globalThis !== 'undefined' && globalThis.app && globalThis.app.eventBus) {
            globalThis.app.eventBus.emitDebugEvent(category, message, level.toLowerCase(), data);
        }
    }
}
// Add performance monitoring integration
function emitPerformanceEvent(metric, value, unit) {
    if (typeof window !== 'undefined' && window.app && window.app.eventBus) {
        window.app.eventBus.emitPerformanceMetric(metric, value, unit);
    }
}
// ============================================================================
// DEDUPLICATION SYSTEM
// ============================================================================
class MessageDeduplicator {
    shouldDedupe(category, args) {
        if (!this.config.enabled) return false;
        const key = this.getKey(category, args);
        const now = performance.now();
        if (!this.buffer.has(key)) {
            this.buffer.set(key, {
                count: 1,
                firstTime: now,
                lastTime: now,
                category,
                args: [
                    ...args
                ]
            });
            this.setFlushTimer(key);
            return false;
        }
        const entry = this.buffer.get(key);
        const timeDiff = now - entry.lastTime;
        if (timeDiff <= this.config.timeWindow) {
            entry.count++;
            entry.lastTime = now;
            this.setFlushTimer(key);
            return entry.count > this.config.minCount;
        } else {
            this.flush(key);
            this.buffer.set(key, {
                count: 1,
                firstTime: now,
                lastTime: now,
                category,
                args: [
                    ...args
                ]
            });
            this.setFlushTimer(key);
            return false;
        }
    }
    getKey(category, args) {
        const simpleArgs = args.map((arg)=>{
            if (typeof arg === 'string') return arg.replace(/[\d.]+/g, 'N');
            if (typeof arg === 'number') return 'N';
            return typeof arg;
        });
        return `${category}:${simpleArgs.join(':')}`;
    }
    setFlushTimer(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        const timer = setTimeout(()=>{
            this.flush(key);
        }, this.config.timeWindow * 2);
        this.timers.set(key, timer);
    }
    flush(key) {
        const entry = this.buffer.get(key);
        if (!entry || entry.count <= this.config.minCount) {
            this.buffer.delete(key);
            this.timers.delete(key);
            return null;
        }
        this.buffer.delete(key);
        this.timers.delete(key);
        return entry;
    }
    flushAll() {
        const results = [];
        for (const [key, entry] of this.buffer.entries()){
            if (entry.count > 1) {
                results.push(entry);
            }
        }
        this.buffer.clear();
        for (const timer of this.timers.values()){
            clearTimeout(timer);
        }
        this.timers.clear();
        return results;
    }
    constructor(config){
        this.config = config;
        this.buffer = new Map();
        this.timers = new Map();
    }
}
// ============================================================================
// PERFORMANCE MONITOR
// ============================================================================
class PerformanceMonitor {
    startLog() {
        if (!this.config.enabled) return;
        this.logsThisFrame++;
        return performance.now();
    }
    endLog(startTime, category) {
        if (!this.config.enabled || !startTime) return;
        const duration = performance.now() - startTime;
        this.metrics.totalLogTime += duration;
        if (!this.metrics.logCounts[category]) {
            this.metrics.logCounts[category] = {
                count: 0,
                totalTime: 0
            };
        }
        this.metrics.logCounts[category].count++;
        this.metrics.logCounts[category].totalTime += duration;
        if (duration > this.config.warnThreshold) {
            this.metrics.slowLogs.push({
                category,
                duration,
                timestamp: performance.now()
            });
            if (this.metrics.slowLogs.length > 100) {
                this.metrics.slowLogs.shift();
            }
            return {
                slow: true,
                critical: duration > this.config.criticalThreshold,
                duration
            };
        }
        return null;
    }
    onFrameStart() {
        this.frameStartTime = performance.now();
        this.logsThisFrame = 0;
    }
    onFrameEnd() {
        if (this.frameStartTime) {
            const frameDuration = performance.now() - this.frameStartTime;
            this.metrics.frameTimes.push({
                duration: frameDuration,
                logCount: this.logsThisFrame
            });
            if (this.metrics.frameTimes.length > 60) {
                this.metrics.frameTimes.shift();
            }
        }
    }
    getReport() {
        const avgFrameTime = this.metrics.frameTimes.reduce((sum, f)=>sum + f.duration, 0) / (this.metrics.frameTimes.length || 1);
        return {
            avgFrameTime,
            totalLogTime: this.metrics.totalLogTime,
            slowLogs: this.metrics.slowLogs.length,
            categoryCosts: Object.entries(this.metrics.logCounts).map(([cat, data])=>({
                    category: cat,
                    count: data.count,
                    avgTime: data.totalTime / data.count
                })).sort((a, b)=>b.avgTime - a.avgTime)
        };
    }
    constructor(config){
        this.config = config;
        this.metrics = {
            totalLogTime: 0,
            logCounts: {},
            slowLogs: [],
            frameTimes: []
        };
        this.frameStartTime = 0;
        this.logsThisFrame = 0;
    }
}
// ============================================================================
// ENHANCED LOGGER CLASS
// ============================================================================
class GameLogger {
    // ============================================================================
    // CORE LOGGING WITH DEDUPLICATION & THROTTLING
    // ============================================================================
    _log(category, level, args) {
        if (!this.enabled) return;
        const categoryConfig = this.config.CATEGORIES[category];
        if (!categoryConfig || !categoryConfig.enabled) return;
        const levelNum = this.config.LEVELS[level];
        const globalLevelNum = this.config.LEVELS[this.config.GLOBAL_LEVEL];
        if (levelNum > globalLevelNum) return;
        // ✅ Check throttling FIRST (before filters and dedup)
        if (this.throttler.shouldThrottle(args)) {
            this.stats.throttledCount++;
            return;
        }
        // Check filters
        if (this._shouldFilter(category, args)) return;
        // Check deduplication
        if (this.deduplicator.shouldDedupe(category, args)) {
            this.stats.dedupedCount++;
            return;
        }
        // Performance monitoring
        const perfStart = this.perfMonitor.startLog();
        const timestamp = performance.now();
        const logEntry = {
            timestamp,
            category,
            level,
            args: [
                ...args
            ],
            color: categoryConfig.color,
            emoji: categoryConfig.emoji
        };
        this._updateStats(category, level);
        this._addToHistory(logEntry);
        this._outputToConsole(logEntry);
        // Check performance
        const perfResult = this.perfMonitor.endLog(perfStart, category);
        if (perfResult && perfResult.critical) {
            this._performanceWarning(category, perfResult.duration);
            // Emit performance event for debug system
            emitPerformanceEvent('log_performance', perfResult.duration, 'ms');
        }
        // Emit debug event for debug system integration
        emitDebugEvent(level, category, args.join(' '), {
            timestamp: timestamp,
            perfResult: perfResult
        });
        return logEntry;
    }
    _shouldFilter(category, args) {
        const { excludePatterns, includePatterns } = this.config.FILTERS;
        const message = args.join(' ');
        for (const pattern of excludePatterns){
            if (pattern.test(message)) return true;
        }
        if (includePatterns.length > 0) {
            for (const pattern of includePatterns){
                if (pattern.test(message)) return false;
            }
            return true;
        }
        return false;
    }
    _outputToConsole(entry, dedupInfo = null) {
        const emoji = this.config.ENABLE_EMOJIS ? `${entry.emoji} ` : '';
        const time = this.config.ENABLE_TIMESTAMPS ? `[${(entry.timestamp / 1000).toFixed(1)}s]` : '';
        let prefix = `${emoji}${time}[${entry.category.toUpperCase()}]`;
        if (dedupInfo && dedupInfo.count > 1) {
            prefix += ` (×${dedupInfo.count} in ${((dedupInfo.lastTime - dedupInfo.firstTime) / 1000).toFixed(1)}s)`;
        }
        const style = `color: ${entry.color}; font-weight: bold;`;
        try {
            if (entry.level === 'ERROR') {
                this.originalConsole.error(`%c${prefix}`, style, ...entry.args);
            } else if (entry.level === 'WARN') {
                this.originalConsole.warn(`%c${prefix}`, style, ...entry.args);
            } else {
                this.originalConsole.log(`%c${prefix}`, style, ...entry.args);
            }
        } catch (e) {
            this.originalConsole.log(`${prefix}`, ...entry.args);
        }
    }
    _performanceWarning(category, duration) {
        this.originalConsole.warn(`%c⚡ PERF WARNING: ${category} took ${duration.toFixed(2)}ms`, 'color: #FF6B6B; font-weight: bold;');
    }
    // ============================================================================
    // PERIODIC FLUSH FOR DEDUPLICATION
    // ============================================================================
    setupPeriodicFlush() {
        setInterval(()=>{
            const deferredEntries = this.deduplicator.flushAll();
            for (const entry of deferredEntries){
                const logEntry = {
                    timestamp: entry.lastTime,
                    category: entry.category,
                    level: this.config.CATEGORIES[entry.category]?.level || 'INFO',
                    args: entry.args,
                    color: this.config.CATEGORIES[entry.category]?.color || '#999999',
                    emoji: this.config.CATEGORIES[entry.category]?.emoji || '📝'
                };
                this._addToHistory(logEntry);
                this._outputToConsole(logEntry, entry);
            }
        }, this.config.DEDUPLICATION.timeWindow * 3);
    }
    setupFrameMonitoring() {
        const frameLoop = ()=>{
            this.perfMonitor.onFrameStart();
            requestAnimationFrame(()=>{
                this.perfMonitor.onFrameEnd();
                requestAnimationFrame(frameLoop);
            });
        };
        frameLoop();
    }
    // ============================================================================
    // PUBLIC LOGGING METHODS
    // ============================================================================
    // Primary logging methods
    debug(...args) {
        return this._log('debug', 'DEBUG', args);
    }
    info(...args) {
        return this._log('info', 'INFO', args);
    }
    warn(...args) {
        return this._log('warn', 'WARN', args);
    }
    error(...args) {
        return this._log('error', 'ERROR', args);
    }
    // AI & Goals
    aiState(...args) {
        return this._log('aiState', 'DEBUG', args);
    }
    aiDetail(...args) {
        return this._log('aiDetail', 'DETAIL', args);
    }
    goal(...args) {
        return this._log('goal', 'DEBUG', args);
    }
    tactic(...args) {
        return this._log('tactic', 'DEBUG', args);
    }
    // Combat & Health
    combat(...args) {
        return this._log('combat', 'INFO', args);
    }
    health(...args) {
        return this._log('health', 'DEBUG', args);
    }
    weaponDetail(...args) {
        return this._log('weaponDetail', 'DETAIL', args);
    }
    // Navigation
    nav(...args) {
        return this._log('nav', 'DEBUG', args);
    }
    navDetail(...args) {
        return this._log('navDetail', 'DETAIL', args);
    }
    // Items & Pickups
    pickup(...args) {
        return this._log('pickup', 'DEBUG', args);
    }
    itemDetail(...args) {
        return this._log('itemDetail', 'DETAIL', args);
    }
    // Game State
    gameState(...args) {
        return this._log('gameState', 'INFO', args);
    }
    ui(...args) {
        return this._log('ui', 'DEBUG', args);
    }
    table(...args) {
        return this._log('table', 'DEBUG', args);
    }
    // Performance
    perf(...args) {
        return this._log('perf', 'WARN', args);
    }
    // ============================================================================
    // CONSOLE GROUPING
    // ============================================================================
    group(label, category = 'debug') {
        if (!this.config.CATEGORIES[category]?.enabled) return;
        if (this.originalConsole.group) {
            this.originalConsole.group(`🔍 ${label}`);
        }
        return this;
    }
    groupCollapsed(label, category = 'debug') {
        if (!this.config.CATEGORIES[category]?.enabled) return;
        if (this.originalConsole.groupCollapsed) {
            this.originalConsole.groupCollapsed(`🔍 ${label}`);
        }
        return this;
    }
    groupEnd() {
        if (this.originalConsole.groupEnd) {
            this.originalConsole.groupEnd();
        }
        return this;
    }
    // ============================================================================
    // CONFIGURATION METHODS
    // ============================================================================
    addExcludeFilter(pattern) {
        if (pattern instanceof RegExp || typeof pattern === 'string') {
            this.config.FILTERS.excludePatterns.push(new RegExp(pattern));
        }
        return this;
    }
    addIncludeFilter(pattern) {
        if (pattern instanceof RegExp || typeof pattern === 'string') {
            this.config.FILTERS.includePatterns.push(new RegExp(pattern));
        }
        return this;
    }
    clearFilters() {
        this.config.FILTERS.excludePatterns = [];
        this.config.FILTERS.includePatterns = [];
        return this;
    }
    setQuickFilter(preset) {
        this.clearFilters();
        const presets = {
            'combat': [
                /combat|weapon|health|damage/i
            ],
            'nav': [
                /nav|path|position|move/i
            ],
            'ai': [
                /ai|goal|tactic|decision/i
            ],
            'perf': [
                /performance|slow|lag|fps/i
            ]
        };
        if (presets[preset]) {
            presets[preset].forEach((p)=>this.addIncludeFilter(p));
        }
        return this;
    }
    // ============================================================================
    // CONTROL METHODS
    // ============================================================================
    isEnabled(categoryOrLevel) {
        if (this.config.CATEGORIES[categoryOrLevel]) {
            return this.config.CATEGORIES[categoryOrLevel].enabled;
        }
        if (this.config.LEVELS[categoryOrLevel] !== undefined) {
            return this.config.LEVELS[categoryOrLevel] <= this.config.LEVELS[this.config.GLOBAL_LEVEL];
        }
        return false;
    }
    enableCategory(category) {
        if (this.config.CATEGORIES[category]) {
            this.config.CATEGORIES[category].enabled = true;
        }
        return this;
    }
    disableCategory(category) {
        if (this.config.CATEGORIES[category]) {
            this.config.CATEGORIES[category].enabled = false;
        }
        return this;
    }
    setLevel(level) {
        if (this.config.LEVELS[level] !== undefined) {
            this.config.GLOBAL_LEVEL = level;
        }
        return this;
    }
    enable() {
        this.enabled = true;
        return this;
    }
    disable() {
        this.enabled = false;
        return this;
    }
    // ============================================================================
    // STATISTICS AND REPORTING
    // ============================================================================
    _updateStats(category, level) {
        this.stats.totalLogs++;
        this.stats.logsByCategory[category] = (this.stats.logsByCategory[category] || 0) + 1;
        this.stats.logsByLevel[level] = (this.stats.logsByLevel[level] || 0) + 1;
        if (level === 'ERROR') this.stats.errorCount++;
        if (level === 'WARN') this.stats.warnCount++;
    }
    getStats() {
        return {
            ...this.stats,
            sessionDuration: performance.now() - this.stats.sessionStart,
            averageLogsPerSecond: this.stats.totalLogs / ((performance.now() - this.stats.sessionStart) / 1000),
            dedupEfficiency: this.stats.dedupedCount / (this.stats.totalLogs + this.stats.dedupedCount) * 100,
            throttleEfficiency: this.stats.throttledCount / (this.stats.totalLogs + this.stats.throttledCount) * 100
        };
    }
    _addToHistory(entry) {
        this.history.push(entry);
        if (this.history.length > this.config.MAX_HISTORY) {
            this.history.shift();
        }
    }
    getHistory(filter = null) {
        if (!filter) return this.history;
        return this.history.filter((entry)=>{
            if (filter.category && entry.category !== filter.category) return false;
            if (filter.level && entry.level !== filter.level) return false;
            if (filter.since && entry.timestamp < filter.since) return false;
            if (filter.pattern && !filter.pattern.test(entry.args.join(' '))) return false;
            return true;
        });
    }
    clearHistory() {
        this.history = [];
        return this;
    }
    // ============================================================================
    // EXPORT FUNCTIONALITY
    // ============================================================================
    downloadLogs(filename = 'game-logs.json', format = 'json') {
        const data = {
            metadata: {
                exportDate: new Date().toISOString(),
                sessionStart: this.stats.sessionStart,
                stats: this.getStats(),
                config: {
                    level: this.config.GLOBAL_LEVEL,
                    categories: Object.keys(this.config.CATEGORIES).filter((cat)=>this.config.CATEGORIES[cat].enabled)
                }
            },
            logs: this.history
        };
        let content, mimeType;
        if (format === 'csv') {
            content = this._toCSV(this.history);
            mimeType = 'text/csv';
            filename = filename.replace(/\.json$/, '.csv');
        } else {
            content = JSON.stringify(data, null, 2);
            mimeType = 'application/json';
        }
        const blob = new Blob([
            content
        ], {
            type: mimeType
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return this;
    }
    _toCSV(logs) {
        const headers = [
            'timestamp',
            'category',
            'level',
            'message'
        ];
        const rows = logs.map((log)=>[
                new Date(log.timestamp).toISOString(),
                log.category,
                log.level,
                log.args.join(' ')
            ]);
        const csvContent = [
            headers.join(','),
            ...rows.map((row)=>row.map((field)=>`"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        return csvContent;
    }
    // ============================================================================
    // DEVELOPMENT UTILITIES
    // ============================================================================
    printStats() {
        this.originalConsole.log('%c📊 Logger Statistics', 'font-size: 16px; font-weight: bold;');
        console.table({
            'Total Logs': this.stats.totalLogs,
            'Errors': this.stats.errorCount,
            'Warnings': this.stats.warnCount,
            'Deduped': this.stats.dedupedCount,
            'Throttled': this.stats.throttledCount,
            'Session Duration (s)': ((performance.now() - this.stats.sessionStart) / 1000).toFixed(1)
        });
        return this;
    }
    printCategories() {
        this.originalConsole.log('%c🏷️ Category Status', 'font-size: 14px; font-weight: bold;');
        const categoryTable = {};
        Object.entries(this.config.CATEGORIES).forEach(([name, config])=>{
            categoryTable[name] = {
                enabled: config.enabled ? '✅' : '❌',
                level: config.level,
                count: this.stats.logsByCategory[name] || 0
            };
        });
        console.table(categoryTable);
        return this;
    }
    analyzePerformance() {
        const report = this.perfMonitor.getReport();
        this.originalConsole.log('%c⚡ Performance Analysis', 'font-size: 16px; font-weight: bold;');
        console.table({
            'Avg Frame Time (ms)': report.avgFrameTime.toFixed(2),
            'Total Log Time (ms)': report.totalLogTime.toFixed(2),
            'Slow Logs': report.slowLogs,
            'Most Expensive Category': report.categoryCosts[0]?.category || 'None'
        });
        if (report.categoryCosts.length > 0) {
            this.originalConsole.log('📈 Category Performance:');
            console.table(report.categoryCosts.slice(0, 10));
        }
        return this;
    }
    constructor(){
        this.config = LoggerConfig;
        this.history = [];
        this.stats = {
            totalLogs: 0,
            logsByCategory: {},
            logsByLevel: {},
            sessionStart: performance.now(),
            errorCount: 0,
            warnCount: 0,
            dedupedCount: 0,
            throttledCount: 0 // ✅ Track throttled messages
        };
        this.originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            info: console.info.bind(console),
            debug: console.debug.bind(console),
            group: console.group ? console.group.bind(console) : null,
            groupCollapsed: console.groupCollapsed ? console.groupCollapsed.bind(console) : null,
            groupEnd: console.groupEnd ? console.groupEnd.bind(console) : null
        };
        this.enabled = true;
        this.deduplicator = new MessageDeduplicator(this.config.DEDUPLICATION);
        this.throttler = new MessageThrottler(this.config.THROTTLE); // ✅ Add throttler
        this.perfMonitor = new PerformanceMonitor(this.config.PERFORMANCE);
        // Initialize stats
        Object.keys(this.config.CATEGORIES).forEach((cat)=>{
            this.stats.logsByCategory[cat] = 0;
        });
        Object.keys(this.config.LEVELS).forEach((lvl)=>{
            this.stats.logsByLevel[lvl] = 0;
        });
        this.setupPeriodicFlush();
        if (typeof requestAnimationFrame !== 'undefined') {
            this.setupFrameMonitoring();
        }
    }
}
// ============================================================================
// CONVENIENCE FUNCTIONS FOR KEYBOARD SHORTCUTS
// ============================================================================
function setupKeyboardShortcuts(logger) {
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', (e)=>{
        // Ctrl+Shift+L combinations
        if (e.ctrlKey && e.shiftKey) {
            switch(e.key){
                case 'S':
                    e.preventDefault();
                    logger.printStats();
                    break;
                case 'C':
                    e.preventDefault();
                    logger.printCategories();
                    break;
                case 'P':
                    e.preventDefault();
                    logger.analyzePerformance();
                    break;
                case 'H':
                    e.preventDefault();
                    logger.clearHistory();
                    logger.info('History cleared');
                    break;
                case 'D':
                    e.preventDefault();
                    logger.downloadLogs();
                    break;
            }
        }
    });
}
// ============================================================================
// EXPORTS AND INITIALIZATION
// ============================================================================
// Create and export global logger instance
const Logger = new GameLogger();
// Setup keyboard shortcuts
setupKeyboardShortcuts(Logger);
// Make globally available for compatibility
if (typeof window !== 'undefined') {
    window.Logger = Logger;
}
console.log('🎯 Logger v2.0 ESM Module initialized - Enhanced debugging ready');

export { GameLogger, Logger, LoggerConfig };
