/**
 * AI Hierarchy Debugger - Check AI agent entity hierarchy for collision/rigidbody placement
 * 
 * This script checks if collision/rigidbody components are on child entities instead of
 * the root AI agent entity, which would cause raycasts to miss.
 * 
 * USAGE: Press F10 to run hierarchy check
 */

var AiHierarchyDebugger = pc.createScript('aiHierarchyDebugger');

AiHierarchyDebugger.prototype.initialize = function() {
    console.log('✅ AI Hierarchy Debugger loaded - Press F10 to check hierarchy');
    
    // Add keyboard shortcut
    this.app.keyboard.on(pc.EVENT_KEYDOWN, (event) => {
        if (event.key === pc.KEY_F10) {
            this.checkAllAIAgents();
        }
    });
    
    // Auto-check on initialization
    setTimeout(() => {
        console.log('🔍 Auto-checking AI hierarchy on startup...');
        this.checkAllAIAgents();
    }, 3000);
};

AiHierarchyDebugger.prototype.checkAllAIAgents = function() {
    console.log('\n========== AI HIERARCHY CHECK ==========');
    
    // Find all AI agents
    const aiAgents = this.app.root.findComponents('script').filter(script => {
        return script.aiAgent && script.aiAgent.enabled;
    }).map(script => script.entity);
    
    console.log(`Found ${aiAgents.length} AI agent(s) to check`);
    
    aiAgents.forEach((agent, index) => {
        console.log(`\n--- AI Agent ${index + 1}: ${agent.name} ---`);
        this.checkEntityHierarchy(agent);
    });
    
    console.log('\n========== END HIERARCHY CHECK ==========\n');
};

AiHierarchyDebugger.prototype.checkEntityHierarchy = function(entity, indent = '') {
    const hasCollision = !!entity.collision;
    const hasRigidbody = !!entity.rigidbody;
    const hasScript = !!entity.script;
    
    let marker = '';
    if (hasCollision || hasRigidbody) {
        marker = ' ⚠️ ';
    }
    
    console.log(`${indent}${marker}${entity.name}`);
    console.log(`${indent}  Position: (${entity.getPosition().x.toFixed(2)}, ${entity.getPosition().y.toFixed(2)}, ${entity.getPosition().z.toFixed(2)})`);
    
    if (hasCollision) {
        console.log(`${indent}  ✅ Collision: type=${entity.collision.type}, enabled=${entity.collision.enabled}, trigger=${entity.collision.trigger}`);
    }
    
    if (hasRigidbody) {
        const typeStr = entity.rigidbody.type === pc.BODYTYPE_STATIC ? 'STATIC' : 
                       entity.rigidbody.type === pc.BODYTYPE_DYNAMIC ? 'DYNAMIC' : 'KINEMATIC';
        console.log(`${indent}  ✅ Rigidbody: type=${typeStr}, kinematic=${entity.rigidbody.kinematic}, enabled=${entity.rigidbody.enabled}`);
        console.log(`${indent}     Physics body exists: ${!!entity.rigidbody.body}`);
        
        if (entity.rigidbody.body) {
            const body = entity.rigidbody.body;
            console.log(`${indent}     Body active: ${body.isActive()}`);
            console.log(`${indent}     Body mass: ${body.getMass()}`);
            console.log(`${indent}     Body kinematic: ${body.isKinematicObject()}`);
            console.log(`${indent}     Body static: ${body.isStaticObject()}`);
        }
    }
    
    if (hasScript) {
        const scriptNames = [];
        for (const scriptName in entity.script) {
            if (entity.script.hasOwnProperty(scriptName) && scriptName !== '__scripts') {
                scriptNames.push(scriptName);
            }
        }
        if (scriptNames.length > 0) {
            console.log(`${indent}  📜 Scripts: ${scriptNames.join(', ')}`);
        }
    }
    
    // Check children
    if (entity.children && entity.children.length > 0) {
        console.log(`${indent}  Children:`);
        entity.children.forEach(child => {
            this.checkEntityHierarchy(child, indent + '    ');
        });
    }
};

AiHierarchyDebugger.prototype.findPhysicsComponents = function(entity, results) {
    results = results || [];
    
    if (entity.collision || entity.rigidbody) {
        results.push({
            entity: entity,
            hasCollision: !!entity.collision,
            hasRigidbody: !!entity.rigidbody,
            path: this.getEntityPath(entity)
        });
    }
    
    if (entity.children) {
        entity.children.forEach(child => {
            this.findPhysicsComponents(child, results);
        });
    }
    
    return results;
};

AiHierarchyDebugger.prototype.getEntityPath = function(entity) {
    const parts = [];
    let current = entity;
    while (current) {
        parts.unshift(current.name);
        current = current.parent;
        if (current && current.name === 'Root') break;
    }
    return parts.join(' > ');
};
