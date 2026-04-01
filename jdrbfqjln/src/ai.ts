// src/ai.ts
import { skillsDB, getDynamicSkill } from './skills';

export type BehaviorType = 'Berserker' | 'Tank' | 'Mage' | 'Moyen';
export type AIState = 'PATROL' | 'CHASE' | 'RETURN';

export const EnemyAI = {
    getStatMultipliers(behavior: BehaviorType) {
        switch(behavior) {
            case 'Berserker': return { hp: 1.2, pp: 1.0, atk: 1.6, def: 0.6 }; 
            // CHANGEMENT : Baisse des multiplicateurs du Tank (était 1.6 et 1.6)
            case 'Tank':      return { hp: 1.4, pp: 0.8, atk: 0.8, def: 1.3 }; 
            case 'Mage':      return { hp: 0.7, pp: 1.8, atk: 1.5, def: 0.7 }; 
            case 'Moyen': default: return { hp: 1.0, pp: 1.0, atk: 1.0, def: 1.0 };
        }
    },

    assignSkills(behavior: BehaviorType, level: number, element: string): {id: string, level: number}[] {
        let assigned: {id: string, level: number}[] = [];
        const availableSkills = Object.values(skillsDB).filter(s => s.element === element || s.element === 'normal');
        
        const atkSkills = availableSkills.filter(s => s.category === 'attaque');
        const supSkills = availableSkills.filter(s => s.category === 'soutien');

        assigned.push({ id: 'coup_puissant', level: Math.max(1, level) });

        if (behavior === 'Mage') {
            if (atkSkills.length > 0) assigned.push({ id: atkSkills[Math.floor(Math.random() * atkSkills.length)].id, level: Math.max(1, level) });
            if (supSkills.length > 0) assigned.push({ id: supSkills[Math.floor(Math.random() * supSkills.length)].id, level: Math.max(1, level) });
        } 
        else if (behavior === 'Tank') {
            // CHANGEMENT : Le Tank n'apprend Ultra Garde qu'à partir de l'étage 3 !
            if (level >= 3) {
                assigned.push({ id: 'ultra_garde', level: Math.max(1, level) }); 
            }
            if (atkSkills.length > 0) assigned.push({ id: atkSkills[Math.floor(Math.random() * atkSkills.length)].id, level: Math.max(1, Math.floor(level * 0.7)) });
        }
        else if (behavior === 'Berserker') {
            if (atkSkills.length > 0) assigned.push({ id: atkSkills[Math.floor(Math.random() * atkSkills.length)].id, level: Math.max(1, level) });
            assigned.push({ id: 'frappe_terreur', level: Math.max(1, level) });
        }
        else { 
            if (atkSkills.length > 0) assigned.push({ id: atkSkills[Math.floor(Math.random() * atkSkills.length)].id, level: Math.max(1, Math.floor(level * 0.8)) });
            if (Math.random() > 0.5 && supSkills.length > 0) assigned.push({ id: supSkills[Math.floor(Math.random() * supSkills.length)].id, level: Math.max(1, Math.floor(level * 0.8)) });
        }
        
        return assigned.slice(0, 4);
    },


    decideAction(enemy: any, ppMult: number): { type: 'ATTACK' | 'SKILL' | 'DEFEND', skill?: any } {
        const b = enemy.behavior as BehaviorType;
        const roll = Math.random();

        const affordableSkills = enemy.skills.filter((sObj: any) => {
            const dSkill = getDynamicSkill(sObj.id, sObj.level);
            return Math.floor(dSkill.ppCost * ppMult) <= enemy.pp;
        });

        let chosenSkill = null;
        if (affordableSkills.length > 0) {
            const chosen = affordableSkills[Math.floor(Math.random() * affordableSkills.length)];
            chosenSkill = getDynamicSkill(chosen.id, chosen.level);
        }

        if (b === 'Berserker') {
            if (roll < 0.8 || !chosenSkill) return { type: 'ATTACK' }; 
            return { type: 'SKILL', skill: chosenSkill };
        } else if (b === 'Tank') {
            if (roll < 0.35) return { type: 'DEFEND' }; 
            if (roll < 0.8 || !chosenSkill) return { type: 'ATTACK' };
            return { type: 'SKILL', skill: chosenSkill };
        } else if (b === 'Mage') {
            if (chosenSkill && roll < 0.75) return { type: 'SKILL', skill: chosenSkill }; 
            if (roll < 0.9) return { type: 'DEFEND' }; 
            return { type: 'ATTACK' };
        } else {
            if (roll < 0.15) return { type: 'DEFEND' };
            if (chosenSkill && roll < 0.5) return { type: 'SKILL', skill: chosenSkill };
            return { type: 'ATTACK' };
        }
    },

    updateExploration(enemy: any, player: any) {
        let speed = enemy.sizeType === 'S' ? 1.8 : (enemy.sizeType === 'M' ? 1.2 : 0.8);
        let vx = 0; let vy = 0;

        if (enemy.aiState === 'CHASE') {
            const angle = Math.atan2((player.y + player.height/2) - (enemy.y + enemy.height/2), (player.x + player.width/2) - (enemy.x + enemy.width/2));
            vx = Math.cos(angle) * speed; vy = Math.sin(angle) * speed;
        } else if (enemy.aiState === 'RETURN') {
            const distToSpawn = Math.hypot(enemy.spawnX - enemy.x, enemy.spawnY - enemy.y);
            if (distToSpawn < 10) enemy.aiState = 'PATROL';
            else {
                const angle = Math.atan2(enemy.spawnY - enemy.y, enemy.spawnX - enemy.x);
                vx = Math.cos(angle) * speed; vy = Math.sin(angle) * speed;
            }
        } else { 
            enemy.patrolAngle += (Math.random() - 0.5) * 0.2;
            vx = Math.cos(enemy.patrolAngle) * (speed * 0.4); vy = Math.sin(enemy.patrolAngle) * (speed * 0.4);
            const distToSpawn = Math.hypot(enemy.spawnX - (enemy.x + vx), enemy.spawnY - (enemy.y + vy));
            if (distToSpawn > 100) enemy.patrolAngle += Math.PI; 
        }

        if (!enemy.checkWallCollision(enemy.x + vx, enemy.y)) enemy.x += vx;
        if (!enemy.checkWallCollision(enemy.x, enemy.y + vy)) enemy.y += vy;
    },

    updateGangAggro(enemies: any[], player: any) {
        const aggroGangs = new Set<number>();
        for (const e of enemies) {
            if (Math.hypot(e.x - player.x, e.y - player.y) < 250) aggroGangs.add(e.gangId);
        }
        for (const e of enemies) {
            if (aggroGangs.has(e.gangId)) e.aiState = 'CHASE';
            else if (e.aiState === 'CHASE' && Math.hypot(e.x - player.x, e.y - player.y) > 400) e.aiState = 'RETURN';
        }
    }
};