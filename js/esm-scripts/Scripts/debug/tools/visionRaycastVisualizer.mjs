import { Vec3, Color, Entity, StandardMaterial, BLEND_NORMAL } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

class VisionRaycastVisualizer {
    _setupKeyboardControl() {
        if (typeof window === 'undefined') return;
        window.addEventListener('keydown', (e)=>{
            if (e.key === 'v' || e.key === 'V') {
                this.toggle();
            }
        });
    }
    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            Logger.info('[VisionRaycastVisualizer] ✅ Vision raycast visualization ENABLED');
            this._showNotification('Vision Debug: ON', '#4CAF50');
        } else {
            Logger.info('[VisionRaycastVisualizer] ❌ Vision raycast visualization DISABLED');
            this._clearAllLines();
            this._showNotification('Vision Debug: OFF', '#F44336');
        }
    }
    _showNotification(message, color) {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
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
        // Remove after 2 seconds
        setTimeout(()=>{
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(()=>{
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }
    update(dt) {
        if (!this.enabled) return;
        // Throttle updates for performance
        const now = performance.now();
        if (now - this.lastUpdate < this.updateInterval) {
            return;
        }
        this.lastUpdate = now;
        // Clear old lines
        this._clearAllLines();
        // Find all AI agents
        const agents = this._findAllAIAgents();
        // Visualize each agent's vision
        agents.forEach((agent)=>{
            this._visualizeAgentVision(agent);
        });
    }
    _findAllAIAgents() {
        const agents = [];
        // Find by tag
        const enemyEntities = this.app.root.findByTag('enemy') || [];
        enemyEntities.forEach((entity)=>{
            if (entity.script?.aiAgent && entity.enabled) {
                agents.push(entity.script.aiAgent);
            }
        });
        // Fallback: search all entities
        if (agents.length === 0) {
            const allEntities = [];
            const traverse = (entity)=>{
                allEntities.push(entity);
                entity.children.forEach(traverse);
            };
            traverse(this.app.root);
            allEntities.forEach((entity)=>{
                if (entity.script?.aiAgent && entity.enabled) {
                    agents.push(entity.script.aiAgent);
                }
            });
        }
        return agents;
    }
    _visualizeAgentVision(agent) {
        try {
            const visionSystem = agent.agentBehavior?.visionSystem || agent.visionSystem;
            const targetingSystem = agent.agentBehavior?.targetingSystem || agent.targetSystem;
            if (!visionSystem) return;
            const agentEntity = agent.entity;
            const agentPos = agentEntity.getPosition().clone();
            agentPos.y += 1.6; // Eye height
            const vision = agent.vision;
            if (!vision) return;
            const range = vision.range || 50;
            const fov = vision.fieldOfView || Math.PI / 2;
            // Draw FOV cone
            this._drawFOVCone(agentEntity, agentPos, range, fov);
            // Get potential targets
            const entityManager = agent.app.navigation?.entityManager;
            if (!entityManager) return;
            const potentialTargets = this._gatherPotentialTargets(agent, entityManager);
            // Visualize raycast to each potential target
            potentialTargets.forEach((target)=>{
                this._visualizeRaycastToTarget(agent, agentPos, target, targetingSystem);
            });
        } catch (error) {
            Logger.warn('[VisionRaycastVisualizer] Error visualizing agent:', error);
        }
    }
    _drawFOVCone(agentEntity, agentPos, range, fov) {
        const forward = agentEntity.forward.clone();
        agentEntity.right.clone();
        // Calculate cone edges
        const halfFov = fov / 2;
        const numRays = 8; // Number of rays to draw the cone
        for(let i = 0; i <= numRays; i++){
            const angle = -halfFov + fov * i / numRays;
            // Rotate forward vector by angle
            const direction = new Vec3();
            direction.copy(forward);
            // Simple rotation around Y axis
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            direction.set(forward.x * cosA + forward.z * sinA, forward.y, -forward.x * sinA + forward.z * cosA);
            const endPos = new Vec3();
            endPos.copy(agentPos);
            endPos.add(direction.mulScalar(range));
            // Draw FOV boundary line
            this._drawLine(agentPos, endPos, this.fovColor, 0.5);
        }
        // Draw arc at the end
        for(let i = 0; i < numRays; i++){
            const angle1 = -halfFov + fov * i / numRays;
            const angle2 = -halfFov + fov * (i + 1) / numRays;
            const dir1 = new Vec3();
            dir1.copy(forward);
            const cosA1 = Math.cos(angle1);
            const sinA1 = Math.sin(angle1);
            dir1.set(forward.x * cosA1 + forward.z * sinA1, forward.y, -forward.x * sinA1 + forward.z * cosA1);
            const dir2 = new Vec3();
            dir2.copy(forward);
            const cosA2 = Math.cos(angle2);
            const sinA2 = Math.sin(angle2);
            dir2.set(forward.x * cosA2 + forward.z * sinA2, forward.y, -forward.x * cosA2 + forward.z * cosA2);
            const pos1 = new Vec3();
            pos1.copy(agentPos).add(dir1.mulScalar(range));
            const pos2 = new Vec3();
            pos2.copy(agentPos).add(dir2.mulScalar(range));
            this._drawLine(pos1, pos2, this.fovColor, 0.3);
        }
    }
    _gatherPotentialTargets(agent, entityManager) {
        const targets = [];
        // From entity manager
        if (entityManager && entityManager.entities) {
            for (const entity of entityManager.entities){
                if (entity === agent.entity) continue;
                if (!entity.enabled || entity.destroyed) continue;
                if (this._isValidTarget(entity)) {
                    targets.push({
                        entity: entity
                    });
                }
            }
        }
        // Fallback: find player by tag
        if (targets.length === 0) {
            const playerByTag = this.app.root.findByTag('player');
            if (playerByTag && playerByTag.length > 0) {
                for (const playerEntity of playerByTag){
                    if (playerEntity.enabled && !playerEntity.destroyed) {
                        targets.push({
                            entity: playerEntity
                        });
                    }
                }
            }
        }
        // Fallback: find via script
        if (targets.length === 0) {
            const allEntities = this.app.root.findComponents('script');
            for (const entity of allEntities){
                if (entity === agent.entity) continue;
                if (!entity.enabled || entity.destroyed) continue;
                if (entity.script && (entity.script.player || entity.script.playerController)) {
                    targets.push({
                        entity: entity
                    });
                    break;
                }
            }
        }
        return targets;
    }
    _isValidTarget(entity) {
        if (entity.tags && entity.tags.has('player')) return true;
        if (entity.script && (entity.script.player || entity.script.playerController)) return true;
        if (entity.tags && entity.tags.has('ai_agent')) return true;
        return false;
    }
    _visualizeRaycastToTarget(agent, agentPos, target, targetingSystem) {
        try {
            const targetEntity = target.entity;
            const targetPos = targetEntity.getPosition().clone();
            targetPos.y += 1.6; // Eye height
            // Check distance
            const distance = agentPos.distance(targetPos);
            const visionRange = agent.vision?.range || 50;
            if (distance > visionRange) {
                // Out of range - don't draw
                return;
            }
            // Check FOV
            const forward = agent.entity.forward;
            const toTarget = new Vec3();
            toTarget.sub2(targetPos, agentPos).normalize();
            const dot = forward.dot(toTarget);
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            const fov = agent.vision?.fieldOfView || Math.PI / 2;
            const inFOV = angle <= fov / 2;
            // Perform raycast
            const result = this.app.systems.rigidbody.raycastFirst(agentPos, targetPos);
            let color;
            let lineWidth = 1.0;
            let isVisible = false;
            if (!result) {
                // No hit - clear line of sight
                if (inFOV) {
                    color = this.targetVisibleColor;
                    lineWidth = 2.0;
                    isVisible = true;
                } else {
                    color = this.clearColor;
                }
            } else if (result.entity === targetEntity) {
                // Hit the target - visible!
                if (inFOV) {
                    color = this.targetVisibleColor;
                    lineWidth = 2.0;
                    isVisible = true;
                } else {
                    color = this.clearColor;
                }
            } else {
                // Hit something else - blocked
                color = this.blockedColor;
                // Draw only to the hit point
                targetPos.copy(result.point);
            }
            // Draw the raycast line
            this._drawLine(agentPos, targetPos, color, lineWidth);
            // If target is visible and current target, draw extra indicator
            if (isVisible && targetingSystem?.hasTarget()) {
                const currentTarget = targetingSystem.getTargetEntity();
                if (currentTarget === targetEntity) {
                    // Draw pulsing circle around target
                    this._drawTargetIndicator(targetPos);
                }
            }
        } catch (error) {
            Logger.warn('[VisionRaycastVisualizer] Error visualizing raycast:', error);
        }
    }
    _drawTargetIndicator(position) {
        // Draw a circle/cross at the target position
        const size = 0.5;
        const color = new Color(1, 0, 0, 1); // Bright red
        // Draw X
        const p1 = new Vec3(position.x - size, position.y, position.z - size);
        const p2 = new Vec3(position.x + size, position.y, position.z + size);
        const p3 = new Vec3(position.x + size, position.y, position.z - size);
        const p4 = new Vec3(position.x - size, position.y, position.z + size);
        this._drawLine(p1, p2, color, 2.0);
        this._drawLine(p3, p4, color, 2.0);
        // Draw vertical line
        const p5 = new Vec3(position.x, position.y - size, position.z);
        const p6 = new Vec3(position.x, position.y + size, position.z);
        this._drawLine(p5, p6, color, 2.0);
    }
    _drawLine(from, to, color, width = 1.0) {
        if (this.lineEntities.length >= this.maxDebugLines) {
            return; // Prevent too many lines
        }
        try {
            // Use PlayCanvas immediate rendering if available
            if (this.app.renderLine) {
                this.app.renderLine(from, to, color);
                return;
            }
            // Alternative: Create a line using pc.app.renderLine or custom mesh
            // For now, we'll use the drawLine method if available
            if (this.app.drawLine) {
                this.app.drawLine(from, to, color);
                return;
            }
            // Fallback: Create actual line entity (more expensive but works)
            this._createLineEntity(from, to, color, width);
        } catch (error) {
        // Silently fail - debug rendering is not critical
        }
    }
    _createLineEntity(from, to, color, width) {
        // Create a thin box to represent the line
        const lineEntity = new Entity('debug-line');
        // Calculate line direction and length
        const direction = new Vec3().sub2(to, from);
        const length = direction.length();
        direction.normalize();
        // Calculate midpoint
        const midpoint = new Vec3().add2(from, to).mulScalar(0.5);
        // Add render component
        lineEntity.addComponent('render', {
            type: 'box',
            castShadows: false,
            receiveShadows: false
        });
        // Create material
        const material = new StandardMaterial();
        material.diffuse = color;
        material.opacity = color.a;
        material.blendType = BLEND_NORMAL;
        material.update();
        lineEntity.render.material = material;
        // Set position
        lineEntity.setPosition(midpoint);
        // Set scale (thin line)
        const thickness = width * 0.02;
        lineEntity.setLocalScale(thickness, thickness, length);
        // Rotate to point from 'from' to 'to'
        lineEntity.lookAt(to);
        lineEntity.rotateLocal(90, 0, 0); // Rotate to align with Z axis
        // Add to scene
        this.app.root.addChild(lineEntity);
        this.lineEntities.push(lineEntity);
    }
    _clearAllLines() {
        // Destroy all line entities
        this.lineEntities.forEach((entity)=>{
            if (entity && entity.destroy) {
                entity.destroy();
            }
        });
        this.lineEntities.length = 0;
        this.fovConeEntities.forEach((entity)=>{
            if (entity && entity.destroy) {
                entity.destroy();
            }
        });
        this.fovConeEntities.length = 0;
    }
    destroy() {
        this._clearAllLines();
        Logger.info('[VisionRaycastVisualizer] Destroyed');
    }
    constructor(app){
        this.app = app;
        this.enabled = false;
        this.debugLines = [];
        this.maxDebugLines = 100;
        // Visual settings
        this.clearColor = new Color(0, 1, 0, 0.5); // Green - clear line of sight
        this.blockedColor = new Color(1, 0, 0, 0.5); // Red - blocked
        this.targetVisibleColor = new Color(1, 1, 0, 0.8); // Yellow - target visible
        this.fovColor = new Color(0, 0.5, 1, 0.3); // Blue - FOV cone
        // Performance throttling
        this.updateInterval = 100; // ms
        this.lastUpdate = 0;
        // Line rendering
        this.lineEntities = [];
        this.fovConeEntities = [];
        // Keyboard control
        this._setupKeyboardControl();
        Logger.info('[VisionRaycastVisualizer] Initialized - Press V to toggle');
    }
}

export { VisionRaycastVisualizer, VisionRaycastVisualizer as default };
