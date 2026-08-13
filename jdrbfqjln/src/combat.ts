// src/combat.ts
import { getDynamicSkill, type Skill } from './skills'; 
import { modifiersDB } from './modifiers'; 
import { getEffectiveness, type ElementType } from './elements'; 
import { weaponsDB } from './weapons';
import { armorsDB } from './armors';
import { elementColors } from './ui'; 
import { getWeaponBoost, getArmorPpBoost, type EquipmentItem, getGradeMultiplier, calculatePpMult } from './inventory';
import { EnemyAI } from './ai'; 

export type GameState = 'EXPLORE' | 'COMBAT' | 'GAME_OVER' | 'INVENTORY' | 'DEBUG';
export let currentGameState: GameState = 'EXPLORE';
export function setGameState(newState: GameState) { currentGameState = newState; }

export let activeEnemies: any[] = []; 
export let activeParty: any[] = []; // NOUVEAUTÉ : Le groupe complet en combat
export let activePlayer: any = null; // Pointeur vers le perso qui choisit/agit
export let currentTargetIndex = 0; 
let currentEnemyActionIndex = 0; 

export let isIntroAnimating: boolean = false;
export let introAnimationTimer: number = 0;
export const INTRO_ANIMATION_DURATION = 60;

export let gracePeriodTimer = 0; 
export const combatMenuOptions = ['Attaque', 'Spé', 'Défendre', 'Fuite'];
export let currentMenuIndex = 0; 

export type CombatSubState = 'ACTION_SELECT' | 'SKILL_SELECT' | 'TARGET_SELECT' | 'EXECUTION_PHASE';
export let combatSubState: CombatSubState = 'ACTION_SELECT';

export let currentSkillIndex = 0;
export let pendingSkill: Skill | null = null; 

// NOUVEAUTÉS : Gestion de la file d'attente des actions
export let currentPlayerSelectIndex = 0; 
export let queuedPartyActions: { player: any, type: string, skill: Skill | null, targetIndex: number }[] = [];
let currentExecutingPlayerIndex = 0;

let executionStep = 0; let executionTimer = 0;

let preCombatPlayerX = 0; let preCombatPlayerY = 0;
let preCombatEnemies: { enemy: any, x: number, y: number }[] = [];
export const gameOverMessages = ["Tu as glissé sur un pixel mal codé.", "Le groupe a été décimé.", "Le Tank n'a pas fait son job."];
export let currentGameOverMessage = "";

function positionEntitiesForCombat(party: any[], enemies: any[]) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    
    // Le Groupe à gauche
    const pStartX = cx - 250;
    const pStartY = cy - ((party.length * 60) / 2);
    party.forEach((p, idx) => {
        p.x = pStartX - (idx % 2 === 0 ? 0 : 40); // Zigzag
        p.y = pStartY + (idx * 60);
    });

    // Ennemis à droite
    const eStartX = cx + 150;
    const eStartY = cy - ((enemies.length * 70) / 2);
    enemies.forEach((e, idx) => {
        e.x = eStartX + (idx % 2 === 0 ? 0 : 40); // Zigzag
        e.y = eStartY + (idx * 70);
    });
}

function applyTurnEndModifiersWithMessages(entity: any) {
    if (entity.hp <= 0) return; // Ne pas appliquer aux morts
    entity.activeModifiers.forEach((modId: string) => {
        const modifier = modifiersDB[modId];
        if (modifier && modifier.onTurnEnd) {
            const oldHp = entity.hp; modifier.onTurnEnd(entity); const dmg = oldHp - entity.hp;
            if (dmg > 0) { const color = modId === 'burning' ? '#e74c3c' : (modId === 'poisoned' ? '#9b59b6' : 'white'); entity.addFloatingText(dmg.toString(), color); }
        }
    }); 
    
    const decayChance = 0.33; 
    if (entity.activeModifiers.includes('cloned') && Math.random() < decayChance) { entity.activeModifiers.splice(entity.activeModifiers.indexOf('cloned'), 1); entity.addFloatingText("Clones dissipés", "#bdc3c7"); }
    if (entity.activeModifiers.includes('ragebait') && Math.random() < decayChance) { entity.activeModifiers.splice(entity.activeModifiers.indexOf('ragebait'), 1); entity.addFloatingText("Calmé", "#bdc3c7"); }
    if (entity.activeModifiers.includes('brainrot') && Math.random() < decayChance) { entity.activeModifiers.splice(entity.activeModifiers.indexOf('brainrot'), 1); entity.addFloatingText("Lucide", "#bdc3c7"); }
}

function checkDeath() {
    // Si TOUS les héros sont morts
    const allDead = activeParty.every(p => p.hp <= 0);
    if (allDead) { currentGameState = 'GAME_OVER'; currentGameOverMessage = gameOverMessages[Math.floor(Math.random() * gameOverMessages.length)]; return true; }
    
    // Gérer la mort des ennemis
    for (let i = activeEnemies.length - 1; i >= 0; i--) {
        if (activeEnemies[i].hp <= 0) {
            const deadEnemy = activeEnemies[i]; 
            const xpGained = Math.max(1, Math.floor((deadEnemy.maxHp * deadEnemy.level) / 4));
            
            // Tout le monde gagne de l'XP !
            activeParty.filter(p => p.hp > 0).forEach(p => {
                p.addFloatingText(`+${xpGained} XP`, '#f1c40f', true); 
                p.gainXp(xpGained);
            });
            
            activeEnemies.splice(i, 1);
            if (currentTargetIndex >= activeEnemies.length) currentTargetIndex = Math.max(0, activeEnemies.length - 1);
        }
    }
    if (activeEnemies.length === 0) { CombatSystem.end(false); return true; }
    return false;
}

// ... (Garde la fonction calculateDamage intacte comme avant) ...
function calculateDamage(attacker: any, defender: any, skill: Skill | null, isDefenderGuarding: boolean) {
    let effectMsg = ""; let splits: { damage: number, element: string }[] = [];
    const armorItem = defender.equippedArmor as EquipmentItem | null; const armor = armorItem ? armorsDB[armorItem.id] : null;
    const weaponItem = attacker.equippedWeapon as EquipmentItem | null; const weapon = weaponItem ? weaponsDB[weaponItem.id] : null;

    let totalAtk = attacker.totalAtk; const totalDef = defender.totalDef;
    const defElement = (armor ? armor.element : defender.defElement) as ElementType;

    if (attacker.activeModifiers.includes('muddy')) totalAtk *= 0.8; 
    const variance = () => 0.85 + (Math.random() * 0.3); 
    const hasUltraGarde = defender.activeModifiers.includes('ultra_garde');
    const baseDamageScale = 4 + (attacker.level * 0.5); 

    if (skill) {
        let coefficient = 1.0; 
        if (weaponItem && weapon && weapon.spAtkBonus) coefficient *= (1 + (weapon.spAtkBonus * getGradeMultiplier(weaponItem.grade)));
        if (skill.element === attacker.atkElement) coefficient *= 1.2; 
        if (skill.id === 'tranche_poison' && defender.activeModifiers.includes('poisoned')) coefficient *= 2.0;

        let effectiveness = getEffectiveness(skill.element, defElement);
        if (armor && armor.forceResist) effectiveness = 0.7;
        coefficient *= effectiveness;
        if (effectiveness > 1) effectMsg = "Efficace !"; else if (effectiveness < 1) effectMsg = "Pas efficace...";

        let rawDmg = ((totalAtk * Math.max(0.1, skill.pwr)) / totalDef) * coefficient * baseDamageScale; 
        if (isDefenderGuarding || hasUltraGarde) rawDmg *= hasUltraGarde ? 0.5 : 0.8; 
        if (attacker.activeModifiers.includes('cloned')) { rawDmg *= 2; effectMsg = effectMsg ? effectMsg + " (x2 Clone)" : "x2 Clone!"; }
        
        rawDmg *= variance();
        splits.push({ damage: Math.max(1, Math.floor(rawDmg)), element: skill.element });
    } else {
        if (weapon && weapon.element !== 'normal') {
            const percentElem = weapon.elementPercent; const percentNormal = 1.0 - percentElem;
            const effNormal = (armor && armor.forceResist) ? 0.7 : getEffectiveness('normal', defElement);
            let dmgNormal = ((totalAtk * 1.0) / totalDef) * effNormal * percentNormal * baseDamageScale; 
            if (isDefenderGuarding || hasUltraGarde) dmgNormal *= hasUltraGarde ? 0.5 : 0.8; dmgNormal *= variance();
            
            const effElem = (armor && armor.forceResist) ? 0.7 : getEffectiveness(weapon.element, defElement);
            let dmgElem = ((totalAtk * 1.0) / totalDef) * effElem * percentElem * baseDamageScale; 
            if (isDefenderGuarding || hasUltraGarde) dmgElem *= hasUltraGarde ? 0.5 : 0.8; dmgElem *= variance();
            
            if (attacker.activeModifiers.includes('cloned')) { dmgNormal *= 2; dmgElem *= 2; effectMsg = effectMsg ? effectMsg + " (x2 Clone)" : "x2 Clone!"; }
            splits.push({ damage: Math.max(1, Math.floor(dmgNormal)), element: 'normal' }); splits.push({ damage: Math.max(1, Math.floor(dmgElem)), element: weapon.element });
            if (effElem > 1) effectMsg = "Efficace !"; else if (effElem < 1) effectMsg = "Pas efficace...";
        } else {
            const atkElem = weapon ? weapon.element : attacker.atkElement;
            const effectiveness = (armor && armor.forceResist) ? 0.7 : getEffectiveness(atkElem as ElementType, defElement);
            let totalRawDmg = ((totalAtk * 1.0) / totalDef) * effectiveness * baseDamageScale; 
            if (isDefenderGuarding || hasUltraGarde) totalRawDmg *= hasUltraGarde ? 0.5 : 0.8; totalRawDmg *= variance();
            
            if (attacker.activeModifiers.includes('cloned')) { totalRawDmg *= 2; effectMsg = effectMsg ? effectMsg + " (x2 Clone)" : "x2 Clone!"; }
            splits.push({ damage: Math.max(1, Math.floor(totalRawDmg)), element: atkElem });
            if (effectiveness > 1) effectMsg = "Efficace !"; else if (effectiveness < 1) effectMsg = "Pas efficace...";
        }
    }
    const totalDamage = splits.reduce((acc, curr) => acc + curr.damage, 0); return { totalDamage, splits, effectMsg };
}

function applyElementalEffects(attacker: any, defender: any, damage: number, skill: Skill | null) {
    const weaponItem = attacker.equippedWeapon as EquipmentItem | null; const weapon = weaponItem ? weaponsDB[weaponItem.id] : null;
    const attackerArmorItem = attacker.equippedArmor as EquipmentItem | null; const attackerArmor = attackerArmorItem ? armorsDB[attackerArmorItem.id] : null;
    const defenderArmorItem = defender.equippedArmor as EquipmentItem | null; const defenderArmor = defenderArmorItem ? armorsDB[defenderArmorItem.id] : null;
    const element = skill ? skill.element : (weapon ? weapon.element : 'normal');

    if (skill && skill.id === 'ragebait') { if (!defender.activeModifiers.includes('ragebait')) defender.activeModifiers.push('ragebait'); return " 🤬 Enragé !"; }
    if (skill && skill.id === 'brainrot') { if (!defender.activeModifiers.includes('brainrot')) defender.activeModifiers.push('brainrot'); return " 🧟 Cerveau pourri !"; }
    if (skill && skill.id === 'attendrissement') { if (!defender.activeModifiers.includes('tenderized')) defender.activeModifiers.push('tenderized'); return " 🥩 Attendri !"; }
    if (skill && skill.id === 'attaque_clone') { if (!attacker.activeModifiers.includes('cloned')) attacker.activeModifiers.push('cloned'); }

    if (element === 'normal' && !skill && !weapon?.fearChanceBonus && !attackerArmor?.fearChanceBonus) return "";

    let chance = 0;
    if (skill) { chance = Math.min(1.0, 0.1 + (skill.pwr * 0.1) + (skill.level * 0.02)); if (skill.id === 'tranche_poison') chance = 0.20 + (skill.level * 0.02); } 
    else if (weaponItem && weapon) { chance = Math.min(1.0, (0.1 + (getWeaponBoost(weaponItem) * 0.015)) * weapon.elementPercent + (attacker.level * 0.01)); }
    if (weapon && weapon.poisonChanceBonus) chance += weapon.poisonChanceBonus; 

    let fearChance = 0;
    if (skill && skill.id === 'cri') fearChance = 0.35 + (skill.level * 0.02);
    if (skill && skill.id === 'frappe_terreur') fearChance = 0.50 + (skill.level * 0.02);
    if (weaponItem && weapon && weapon.fearChanceBonus) fearChance += weapon.fearChanceBonus * getGradeMultiplier(weaponItem.grade);
    if (attackerArmorItem && attackerArmor && attackerArmor.fearChanceBonus) fearChance += attackerArmor.fearChanceBonus * getGradeMultiplier(attackerArmorItem.grade);

    if (Math.random() < fearChance && !defender.activeModifiers.includes('feared')) { defender.activeModifiers.push('feared'); return " 😨 Terrorisé !"; }

    if (element === 'plante') {
        let heal = Math.max(1, Math.floor(damage * 0.4)); if (weapon && weapon.healBonus) heal = Math.floor(heal * (1 + weapon.healBonus));
        if (defenderArmor && defenderArmor.invertLifesteal) { attacker.takeDamage(heal); attacker.addFloatingText(`${heal}`, '#e74c3c'); return ` 🌿 Épines Poison ! (${heal} Dégâts subis)`; } 
        else { attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal); attacker.addFloatingText(`+${heal}`, '#2ecc71'); return ` 🌿 Vol-Vie (+${heal} PV) !`; }
    }

    if (Math.random() < chance) {
        if (element === 'feu' && !defender.activeModifiers.includes('burning')) { defender.activeModifiers.push('burning'); return " 🔥 Brûlure !"; }
        if (element === 'eau' && !defender.activeModifiers.includes('muddy')) { defender.activeModifiers.push('muddy'); return " 💧 Embourbé !"; }
        if (element === 'poison' && !defender.activeModifiers.includes('poisoned')) { defender.activeModifiers.push('poisoned'); return " ☠️ Empoisonné !"; }
    }
    return "";
}

function advanceToNextAlivePlayerForSelection() {
    while (currentPlayerSelectIndex < activeParty.length && activeParty[currentPlayerSelectIndex].hp <= 0) {
        currentPlayerSelectIndex++;
    }
    if (currentPlayerSelectIndex >= activeParty.length) {
        CombatSystem.startExecutionPhase();
    } else {
        activePlayer = activeParty[currentPlayerSelectIndex];
        combatSubState = 'ACTION_SELECT';
        currentMenuIndex = 0;
        currentSkillIndex = 0;
        pendingSkill = null;
    }
}

export const CombatSystem = {
    start(party: any[], encounteredEnemies: any[]) {
        currentGameState = 'COMBAT'; 
        activeParty = [...party]; 
        activeEnemies = [...encounteredEnemies];
        
        // --- NOUVEAUTÉ : On enregistre une position parfaitement sécurisée ---
        // On demande au Général (party[0]) de nous donner le centre d'une case valide
        const safePos = party[0].getSafeFloorPosition();
        preCombatPlayerX = safePos.x; 
        preCombatPlayerY = safePos.y; 
        // ---------------------------------------------------------------------

        preCombatEnemies = activeEnemies.map(e => ({ enemy: e, x: e.x, y: e.y }));
        
        activeParty.forEach(hero => { hero.vx = 0; hero.vy = 0; hero.isDefending = false; hero.isActing = false; });
        activeEnemies.forEach(e => { e.isDefending = false; e.isActing = false; });

        queuedPartyActions = [];
        currentPlayerSelectIndex = 0;
        advanceToNextAlivePlayerForSelection(); 

        positionEntitiesForCombat(activeParty, activeEnemies); 
        isIntroAnimating = true; introAnimationTimer = 0;
    },
    
    update() {
        if (isIntroAnimating) { introAnimationTimer++; if (introAnimationTimer >= INTRO_ANIMATION_DURATION) { isIntroAnimating = false; introAnimationTimer = 0; } }
        if (gracePeriodTimer > 0) gracePeriodTimer--;
        if (combatSubState === 'EXECUTION_PHASE') { if (executionTimer > 0) { executionTimer--; if (executionTimer === 0) this.executeNextStep(); } }
    },
    
    startExecutionPhase() { 
        combatSubState = 'EXECUTION_PHASE'; 
        executionStep = 0; executionTimer = 10; 
        currentExecutingPlayerIndex = 0;
        currentEnemyActionIndex = 0; 
    },

    executeNextStep() {
        if (checkDeath()) return;

        // PHASE 1 : Les Héros attaquent
        if (executionStep === 0) {
            if (currentExecutingPlayerIndex > 0) {
                // Fin de l'animation du joueur précédent
                activeParty.forEach(p => p.isActing = false);
            }

            if (currentExecutingPlayerIndex < queuedPartyActions.length) {
                const action = queuedPartyActions[currentExecutingPlayerIndex];
                activePlayer = action.player;
                
                // Si le joueur est mort avant son tour
                if (activePlayer.hp <= 0) {
                    currentExecutingPlayerIndex++; executionTimer = 1; return;
                }

                activePlayer.isDefending = false; 
                activePlayer.isActing = true;

                const fearIdx = activePlayer.activeModifiers.indexOf('feared');
                if (fearIdx !== -1) {
                    activePlayer.activeModifiers.splice(fearIdx, 1);
                    activePlayer.currentActionName = { text: "Terrorisé !", color: "#bdc3c7", timer: 80 };
                }
                else if (action.type === 'FLEE') { 
                    this.end(true); return; 
                } 
                else if (action.type === 'DEFEND') {
                    activePlayer.isDefending = true; 
                    activePlayer.currentActionName = { text: "Garde", color: "white", timer: 80 };
                    const burnIndex = activePlayer.activeModifiers.indexOf('burning'); if (burnIndex !== -1) activePlayer.activeModifiers.splice(burnIndex, 1); 
                    const muddyIndex = activePlayer.activeModifiers.indexOf('muddy'); if (muddyIndex !== -1) activePlayer.activeModifiers.splice(muddyIndex, 1); 
                    const tenderIdx = activePlayer.activeModifiers.indexOf('tenderized'); if (tenderIdx !== -1) activePlayer.activeModifiers.splice(tenderIdx, 1); 
                } 
                else {
                    let PWR = action.skill ? action.skill.pwr : 1;
                    let actionName = action.skill ? action.skill.name : "Attaque";
                    const skill = action.skill;
                    const weaponItem = activePlayer.equippedWeapon as EquipmentItem | null; const weapon = weaponItem ? weaponsDB[weaponItem.id] : null;

                    const actionColor = elementColors[skill ? skill.element : (weapon ? weapon.element : activePlayer.atkElement)] || 'white';
                    activePlayer.currentActionName = { text: actionName, color: actionColor, timer: 80 };

                    // Vérifier si la cible est toujours en vie, sinon cibler le prochain
                    let targetEnemies = [];
                    if (skill && (skill.targetType === 'all_enemies')) {
                        targetEnemies = activeEnemies.filter(e => e.hp > 0);
                    } else if (skill && (skill.targetType === 'all_allies' || skill.targetType === 'self')) {
                        targetEnemies = skill.targetType === 'self' ? [activePlayer] : activeParty.filter(p => p.hp > 0);
                    } else {
                        let tIndex = action.targetIndex;
                        if (activeEnemies[tIndex] && activeEnemies[tIndex].hp <= 0) {
                            tIndex = activeEnemies.findIndex(e => e.hp > 0);
                        }
                        if (tIndex !== -1) targetEnemies.push(activeEnemies[tIndex]);
                    }

                    if (skill) activePlayer.pp -= Math.floor(skill.ppCost * calculatePpMult(activePlayer));

                    if (skill && skill.id === 'meditation') {
                        const heal = Math.floor(activePlayer.totalMaxPp * (0.20 + skill.level * 0.01));
                        activePlayer.pp = Math.min(activePlayer.totalMaxPp, activePlayer.pp + heal);
                        activePlayer.addFloatingText(`+${heal} PP`, '#9b59b6');
                    }
                    else if (PWR < 0) { 
                        targetEnemies.forEach(t => {
                            let heal = Math.floor(activePlayer.totalAtk * Math.abs(PWR));
                            if (weapon && weapon.healBonus) heal = Math.floor(heal * (1 + weapon.healBonus)); 
                            t.hp = Math.min(t.maxHp, t.hp + heal); t.addFloatingText(`+${heal}`, '#2ecc71');
                        });
                    } 
                    else if (PWR === 0) { 
                        targetEnemies.forEach(t => {
                            if (skill) skill.modifiers.forEach((modId: string) => { if (!t.activeModifiers.includes(modId)) t.activeModifiers.push(modId); });
                            if (skill && skill.id === 'cri' && Math.random() < 0.35 + (skill.level * 0.02)) {
                                if (!t.activeModifiers.includes('feared')) t.activeModifiers.push('feared'); t.addFloatingText("Terrorisé!", "#bdc3c7");
                            }
                        });
                    } 
                    else { 
                        targetEnemies.forEach(t => {
                            const result = calculateDamage(activePlayer, t, skill, t.isDefending);
                            if (PWR > 0 || result.totalDamage > 1) {
                                t.takeDamage(result.totalDamage); result.splits.forEach((split: any) => t.addFloatingText(split.damage.toString(), elementColors[split.element]));
                                if (result.effectMsg) t.addFloatingText(result.effectMsg, '#f1c40f', true);
                            }
                            const effectTxt = applyElementalEffects(activePlayer, t, result.totalDamage, skill);
                            if (effectTxt) t.addFloatingText(effectTxt, '#f1c40f', true);
                        });
                    }
                }
                currentExecutingPlayerIndex++; executionTimer = 80; 
            } else {
                // Fin du tour des héros, au tour des ennemis
                activeParty.forEach(p => p.isActing = false);
                executionStep = 1; executionTimer = 10;
            }
        }
        // PHASE 2 : Les Ennemis attaquent
        else if (executionStep === 1) {
            if (checkDeath()) return; 
            if (currentEnemyActionIndex > 0) activeEnemies[currentEnemyActionIndex - 1].isActing = false; 

            if (currentEnemyActionIndex < activeEnemies.length) {
                const currentEnemy = activeEnemies[currentEnemyActionIndex];
                currentEnemy.isDefending = false; 
                currentEnemy.isActing = true;

                const fearIdx = currentEnemy.activeModifiers.indexOf('feared');
                if (fearIdx !== -1) {
                    currentEnemy.activeModifiers.splice(fearIdx, 1);
                    currentEnemy.currentActionName = { text: "Terrorisé !", color: "#bdc3c7", timer: 100 };
                    currentEnemyActionIndex++; executionTimer = 100; return;
                }

                let action = EnemyAI.decideAction(currentEnemy, calculatePpMult(currentEnemy));
                
                if (currentEnemy.activeModifiers.includes('brainrot') && action.type === 'SKILL') action = { type: 'ATTACK', skill: null };
                if (currentEnemy.activeModifiers.includes('ragebait') && action.type === 'DEFEND') action = { type: 'ATTACK', skill: null };

                if (action.type === 'DEFEND') {
                    currentEnemy.isDefending = true; 
                    currentEnemy.currentActionName = { text: "Garde", color: "white", timer: 100 };
                    const bIdx = currentEnemy.activeModifiers.indexOf('burning'); if (bIdx !== -1) currentEnemy.activeModifiers.splice(bIdx, 1);
                    const mIdx = currentEnemy.activeModifiers.indexOf('muddy'); if (mIdx !== -1) currentEnemy.activeModifiers.splice(mIdx, 1);
                    const tenderIdx = currentEnemy.activeModifiers.indexOf('tenderized'); if (tenderIdx !== -1) currentEnemy.activeModifiers.splice(tenderIdx, 1); 
                } 
                else {
                    const enemySkill = action.skill || null;
                    let PWR = enemySkill ? enemySkill.pwr : 1;
                    const weaponItem = currentEnemy.equippedWeapon as EquipmentItem | null; const weapon = weaponItem ? weaponsDB[weaponItem.id] : null;
                    const actionColor = elementColors[enemySkill ? enemySkill.element : (weapon ? weapon.element : currentEnemy.atkElement)] || 'white';
                    currentEnemy.currentActionName = { text: enemySkill ? enemySkill.name : "Attaque", color: actionColor, timer: 100 };

                    // Les ennemis ciblent un héros VIVANT au hasard
                    const aliveHeros = activeParty.filter(p => p.hp > 0);
                    if (aliveHeros.length === 0) return; // GAME OVER handled elsewhere
                    const randomTarget = aliveHeros[Math.floor(Math.random() * aliveHeros.length)];

                    let targets = [randomTarget]; 
                    if (enemySkill) {
                        if (enemySkill.targetType === 'all_allies') targets = [...activeEnemies];
                        else if (enemySkill.targetType === 'self') targets = [currentEnemy];
                        // 'all_enemies' pour un ennemi = cible tout le groupe joueur
                        else if (enemySkill.targetType === 'all_enemies') targets = [...aliveHeros];
                    }

                    if (enemySkill) currentEnemy.pp -= Math.floor(enemySkill.ppCost * calculatePpMult(currentEnemy));

                    if (enemySkill && enemySkill.id === 'meditation') {
                        const heal = Math.floor(currentEnemy.totalMaxPp * (0.20 + enemySkill.level * 0.01));
                        currentEnemy.pp = Math.min(currentEnemy.totalMaxPp, currentEnemy.pp + heal);
                        currentEnemy.addFloatingText(`+${heal} PP`, '#9b59b6');
                    }
                    else if (PWR < 0) { 
                        targets.forEach(t => {
                            let heal = Math.floor(currentEnemy.totalAtk * Math.abs(PWR));
                            if (weapon && weapon.healBonus) heal = Math.floor(heal * (1 + weapon.healBonus));
                            t.hp = Math.min(t.maxHp, t.hp + heal); t.addFloatingText(`+${heal}`, '#2ecc71'); 
                        });
                    } 
                    else if (PWR === 0) { 
                        targets.forEach(t => {
                            if (enemySkill) enemySkill.modifiers.forEach((modId: string) => { if (!t.activeModifiers.includes(modId)) t.activeModifiers.push(modId); });
                            if (enemySkill && enemySkill.id === 'cri' && Math.random() < 0.35 + (enemySkill.level * 0.02)) {
                                if (!t.activeModifiers.includes('feared')) t.activeModifiers.push('feared'); t.addFloatingText("Terrorisé!", "#bdc3c7");
                            }
                        });
                    }
                    else { 
                        targets.forEach(t => {
                            const result = calculateDamage(currentEnemy, t, enemySkill, t.isDefending); 
                            if (PWR > 0 || result.totalDamage > 1) {
                                t.takeDamage(result.totalDamage); result.splits.forEach((split: any) => t.addFloatingText(split.damage.toString(), elementColors[split.element]));
                                if (result.effectMsg) t.addFloatingText(result.effectMsg, '#f1c40f', true);
                            }
                            const effectTxt = applyElementalEffects(currentEnemy, t, result.totalDamage, enemySkill);
                            if (effectTxt) t.addFloatingText(effectTxt, '#f1c40f', true);

                            if (t.isDefending || t.activeModifiers.includes('ultra_garde')) {
                                const regenRate = t.activeModifiers.includes('ultra_garde') ? 0.10 : 0.05;
                                const armorItem = t.equippedArmor as EquipmentItem | null; const totalMaxPp = t.maxPp + (armorItem ? getArmorPpBoost(armorItem) : 0);
                                const ppRegen = Math.ceil(result.totalDamage * regenRate); t.pp = Math.min(totalMaxPp, t.pp + ppRegen); t.addFloatingText(`+${ppRegen} PP`, '#9b59b6'); 
                            }
                        });
                    }
                }
                currentEnemyActionIndex++; executionTimer = 100; 
            } else { executionStep = 2; executionTimer = 1; }
        }
        else if (executionStep === 2) {
            if (checkDeath()) return; 
            if (activeEnemies.length > 0) activeEnemies[activeEnemies.length - 1].isActing = false; 

            activeParty.forEach((p) => applyTurnEndModifiersWithMessages(p));
            activeEnemies.forEach((e) => applyTurnEndModifiersWithMessages(e));
            executionStep = 3; executionTimer = 30; 
        }
        else if (executionStep === 3) {
            if (checkDeath()) return; 
            // Fin du tour, on recommence la file d'attente
            queuedPartyActions = [];
            currentPlayerSelectIndex = 0;
            advanceToNextAlivePlayerForSelection();
        }
    },

    handleInput(key: string) {
        if (isIntroAnimating || combatSubState === 'EXECUTION_PHASE' || currentGameState === 'GAME_OVER') return; 

        const hasBrainrot = activePlayer.activeModifiers.includes('brainrot');
        const hasRagebait = activePlayer.activeModifiers.includes('ragebait');
        
        if (combatSubState === 'ACTION_SELECT') {
            // NOUVEAUTÉ : Annuler le choix précédent (Style Deltarune !)
            if ((key === 'Escape' || key === 'Backspace') && currentPlayerSelectIndex > 0) {
                do {
                    currentPlayerSelectIndex--;
                } while (currentPlayerSelectIndex > 0 && activeParty[currentPlayerSelectIndex].hp <= 0);
                
                queuedPartyActions.pop(); // Retire l'action du perso d'avant
                activePlayer = activeParty[currentPlayerSelectIndex];
                return;
            }

            if (key === 'ArrowUp' || key === 'z' || key === 'Z') { currentMenuIndex--; if (currentMenuIndex < 0) currentMenuIndex = combatMenuOptions.length - 1; } 
            else if (key === 'ArrowDown' || key === 's' || key === 'S') { currentMenuIndex++; if (currentMenuIndex >= combatMenuOptions.length) currentMenuIndex = 0; } 
            else if (key === 'Enter' || key === ' ') {
                if (currentMenuIndex === 1 && hasBrainrot) return; 
                if (currentMenuIndex === 2 && hasRagebait) return;

                if (currentMenuIndex === 0) { pendingSkill = null; combatSubState = 'TARGET_SELECT'; currentTargetIndex = 0; } 
                else if (currentMenuIndex === 1) { currentSkillIndex = 0; combatSubState = 'SKILL_SELECT'; }
                else if (currentMenuIndex === 2) { 
                    queuedPartyActions.push({ player: activePlayer, type: 'DEFEND', skill: null, targetIndex: 0 });
                    currentPlayerSelectIndex++; advanceToNextAlivePlayerForSelection();
                }
                else if (currentMenuIndex === 3) { 
                    queuedPartyActions.push({ player: activePlayer, type: 'FLEE', skill: null, targetIndex: 0 });
                    currentPlayerSelectIndex++; advanceToNextAlivePlayerForSelection();
                }
            }
        } 
        else if (combatSubState === 'SKILL_SELECT') {
            const skills = activePlayer.skills;
            if (key === 'ArrowUp' || key === 'z' || key === 'Z') { currentSkillIndex--; if (currentSkillIndex < 0) currentSkillIndex = Math.max(0, skills.length - 1); } 
            else if (key === 'ArrowDown' || key === 's' || key === 'S') { currentSkillIndex++; if (currentSkillIndex >= skills.length) currentSkillIndex = 0; } 
            else if (key === 'Enter' || key === ' ') {
                if (skills.length > 0) {
                    const sObj = skills[currentSkillIndex];
                    const dSkill = getDynamicSkill(sObj.id, sObj.level);
                    const actualCost = Math.floor(dSkill.ppCost * calculatePpMult(activePlayer));

                    if (activePlayer.pp >= actualCost) {
                        pendingSkill = dSkill; 
                        if (dSkill.targetType !== 'single') {
                            queuedPartyActions.push({ player: activePlayer, type: 'SKILL', skill: pendingSkill, targetIndex: 0 });
                            currentPlayerSelectIndex++; advanceToNextAlivePlayerForSelection();
                        } else {
                            combatSubState = 'TARGET_SELECT'; currentTargetIndex = 0;
                        }
                    }
                }
            } else if (key === 'Escape' || key === 'Backspace') { combatSubState = 'ACTION_SELECT'; }
        }
        else if (combatSubState === 'TARGET_SELECT') {
            if (key === 'ArrowUp' || key === 'z' || key === 'Z') { currentTargetIndex--; if (currentTargetIndex < 0) currentTargetIndex = activeEnemies.length - 1; } 
            else if (key === 'ArrowDown' || key === 's' || key === 'S') { currentTargetIndex++; if (currentTargetIndex >= activeEnemies.length) currentTargetIndex = 0; } 
            else if (key === 'Enter' || key === ' ') {
                queuedPartyActions.push({ player: activePlayer, type: pendingSkill ? 'SKILL' : 'ATTACK', skill: pendingSkill, targetIndex: currentTargetIndex });
                currentPlayerSelectIndex++; advanceToNextAlivePlayerForSelection();
            } else if (key === 'Escape' || key === 'Backspace') {
                if (pendingSkill) combatSubState = 'SKILL_SELECT'; else combatSubState = 'ACTION_SELECT'; pendingSkill = null;
            }
        }
    },

    end(isFleeing: boolean = false) {
        // Retour à la formation "Exploration"
        activeParty.forEach(p => { p.isDefending = false; p.isActing = false; });
        preCombatEnemies.forEach(pe => { if (activeEnemies.includes(pe.enemy)) { pe.enemy.x = pe.x; pe.enemy.y = pe.y; pe.enemy.isDefending = false; pe.enemy.isActing = false; } });
        currentGameState = 'EXPLORE'; activeEnemies = []; activePlayer = null;
        if (isFleeing) gracePeriodTimer = 120;
    }
};