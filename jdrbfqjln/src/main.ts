import { currentGameState, setGameState, activeEnemies, activePlayer, currentTargetIndex, combatSubState, CombatSystem, isIntroAnimating, gracePeriodTimer, currentGameOverMessage } from './combat';
import { weaponsDB } from './weapons'; 
import { armorsDB } from './armors';   
import { skillsDB } from './skills'; 
import { itemsDB } from './items'; 
import { InventorySystem, DebugLogics, playerBag, getWeaponBoost, getArmorDefBoost, type EquipmentItem, type ManuscriptItem } from './inventory';
import { UIManager, debugOptions, elementColors } from './ui'; 
import { LevelGenerator, type EntitySize, type MapType } from './generator';
import { EnemyAI, type BehaviorType, type AIState } from './ai';

// @ts-ignore
import Rom from './earthbound/src/rom/rom';
// @ts-ignore
import BackgroundLayer from './earthbound/src/rom/background_layer';
// @ts-ignore
import Engine from './earthbound/src/engine';
// @ts-ignore
import backgroundData from './earthbound/data/truncated_backgrounds.dat?uint8array';

const ROM = new Rom(backgroundData);
const bgCanvas = document.createElement('canvas'); bgCanvas.width = 256; bgCanvas.height = 224; let bgEngine: any = null;

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas(); 
const TILE_SIZE = 64; 

let cameraX = 0; let cameraY = 0; let alertMessage = ""; let alertTimer = 0;
export let currentFloor = 0; let gameMap: Tile[][] = []; export let enemies: Enemy[] = []; export let currentMapType: MapType = 'Départ'; 
let currentLoot: { type: 'weapon'|'armor'|'manuscript'|'item', item: any }[] | null = null;
export let mandatoryEnemiesTotal = 0; export let mandatoryEnemiesKilled = 0;
let currentCombatGangId: number | null = null; let wasInCombat = false; 
let debugNextMapType: MapType = 'Labyrinthe'; let debugSelectedIndex = 0;

const keys: { [key: string]: boolean } = {};

window.addEventListener('keydown', (e) => { 
    keys[e.key] = true; 
    
    if (e.key.toLowerCase() === 'c') {
        // @ts-ignore
        if (currentGameState === 'EXPLORE') setGameState('DEBUG' as any); else if (currentGameState === 'DEBUG') setGameState('EXPLORE');
    }

    if (currentGameState === 'COMBAT') CombatSystem.handleInput(e.key);
    else if (currentGameState === 'EXPLORE') {
        if (e.key === 'w' || e.key === 'W') setGameState('INVENTORY');
        else if (e.key === 'x' || e.key === 'X') {
            const distChest = Math.hypot((player.x + player.width/2) - (chest.x + chest.width/2), (player.y + player.height/2) - (chest.y + chest.height/2));
            if (distChest < 80 && !chest.isOpen) {
                if (currentFloor === 0) {
                    chest.isOpen = true;
                    const wIds = Object.keys(weaponsDB); playerBag.weapons.push({ id: wIds[Math.floor(Math.random() * wIds.length)], grade: 'C', level: 1 });
                    const aIds = Object.keys(armorsDB); playerBag.armors.push({ id: aIds[Math.floor(Math.random() * aIds.length)], grade: 'C', level: 1 });
                    const sIds = Object.keys(skillsDB); playerBag.manuscripts.push({ skillId: sIds[Math.floor(Math.random() * sIds.length)], level: 1 });
                    playerBag.items.push('potion_soin', 'potion_soin', 'ether', 'proteine', 'fer'); alertMessage = `Coffre de départ ouvert ! Kit de survie reçu.`;
                } 
                else if (currentLoot) {
                    chest.isOpen = true; 
                    currentLoot.forEach(loot => {
                        if (loot.type === 'weapon') playerBag.weapons.push(loot.item as EquipmentItem);
                        else if (loot.type === 'armor') playerBag.armors.push(loot.item as EquipmentItem);
                        else if (loot.type === 'manuscript') playerBag.manuscripts.push(loot.item as ManuscriptItem);
                        else if (loot.type === 'item') playerBag.items.push(loot.item as string);
                    });
                    if (currentLoot.length === 1) { const loot = currentLoot[0]; if (loot.type === 'item') alertMessage = `Coffre ouvert ! Reçu: ${itemsDB[loot.item].name}`; else if (loot.type === 'manuscript') alertMessage = `Coffre ouvert ! Reçu: Manuscrit Niv.${loot.item.level}`; else alertMessage = `Coffre ouvert ! Reçu: Rang ${loot.item.grade} Niv.${loot.item.level}`; } else { alertMessage = `Coffre ouvert ! ${currentLoot.length} objets trouvés !`; }
                }
                if (chest.isOpen) { playerBag.weapons.sort((a, b) => getWeaponBoost(b) - getWeaponBoost(a)); playerBag.armors.sort((a, b) => getArmorDefBoost(b) - getArmorDefBoost(a)); playerBag.manuscripts.sort((a, b) => b.level - a.level); alertTimer = 180; }
            }
            const distStairs = Math.hypot((player.x + player.width/2) - (stairs.x + stairs.width/2), (player.y + player.height/2) - (stairs.y + stairs.height/2));
            if (distStairs < 80 && stairs.isOpen) { currentFloor++; loadNextFloor(); }
        }
    }
    else if (currentGameState === 'INVENTORY') InventorySystem.handleInput(e.key, player);
    else if (currentGameState === 'DEBUG') {
        const types: MapType[] = ['Labyrinthe', 'Arène', 'Manoir'];
        if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'z') { debugSelectedIndex--; if (debugSelectedIndex < 0) debugSelectedIndex = debugOptions.length - 1; }
        if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') { debugSelectedIndex++; if (debugSelectedIndex >= debugOptions.length) debugSelectedIndex = 0; }
        if (e.key === 'Enter' || e.key === ' ') {
            if (debugSelectedIndex === 0) { player.gainXp(Math.pow(player.level + 1, 3)); alertMessage = "Niveau +1"; alertTimer = 60; }
            if (debugSelectedIndex === 1) { player.level = Math.max(1, player.level - 1); player.xp = Math.pow(player.level, 3); alertMessage = "Niveau -1"; alertTimer = 60; }
            if (debugSelectedIndex === 2) { currentFloor++; loadNextFloor(); alertMessage = "Étage +1"; alertTimer = 60; }
            if (debugSelectedIndex === 3) { currentFloor = Math.max(0, currentFloor - 1); loadNextFloor(); alertMessage = "Étage -1"; alertTimer = 60; }
            if (debugSelectedIndex === 4) { const currIdx = types.indexOf(debugNextMapType); debugNextMapType = types[(currIdx + 1) % types.length]; }
            if (debugSelectedIndex === 5) {
                const originalGen = LevelGenerator.generateMap;
                LevelGenerator.generateMap = (f) => { const res = originalGen(f); res.mapType = debugNextMapType; if(debugNextMapType === 'Arène') res.size = Math.min(30, 15 + Math.floor(currentFloor * 1.5)); return res; };
                loadNextFloor(); LevelGenerator.generateMap = originalGen; alertMessage = `Map régénérée en ${debugNextMapType}`; alertTimer = 60;
            }
            if (debugSelectedIndex === 6) { DebugLogics.giveAllEquipment(); alertMessage = "Tous les équipements (Lv.100) reçus !"; alertTimer = 60; }
            if (debugSelectedIndex === 7) { DebugLogics.giveAllItems(); alertMessage = "Tous les objets (x5) reçus !"; alertTimer = 60; }
            if (debugSelectedIndex === 8) { DebugLogics.giveAllManuscripts(); alertMessage = "Toutes les Spés (Lv.100) reçues !"; alertTimer = 60; }
        }
    }
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

abstract class Tile { x: number; y: number; size: number; isSolid: boolean; constructor(x: number, y: number, size: number, isSolid: boolean) { this.x = x; this.y = y; this.size = size; this.isSolid = isSolid; } abstract draw(ctx: CanvasRenderingContext2D): void; }
class Floor extends Tile { constructor(x: number, y: number, size: number) { super(x, y, size, false); } draw(ctx: CanvasRenderingContext2D) { ctx.fillStyle = '#2a2a2a'; ctx.fillRect(this.x, this.y, this.size, this.size); ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(this.x, this.y, this.size, this.size); } }
class Wall extends Tile { constructor(x: number, y: number, size: number) { super(x, y, size, true); } draw(ctx: CanvasRenderingContext2D) { ctx.fillStyle = '#555'; ctx.fillRect(this.x, this.y, this.size, this.size); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.strokeRect(this.x, this.y, this.size, this.size); } }
class Chest {
    x: number = 0; y: number = 0; width: number = 40; height: number = 30; isOpen: boolean = false;
    setPosition(tileX: number, tileY: number) { this.x = (tileX * TILE_SIZE) + (TILE_SIZE / 2) - (this.width / 2); this.y = (tileY * TILE_SIZE) + (TILE_SIZE / 2) - (this.height / 2); this.isOpen = false; }
    draw(ctx: CanvasRenderingContext2D) { ctx.save(); ctx.fillStyle = this.isOpen ? '#8e44ad' : '#f1c40f'; ctx.fillRect(this.x, this.y, this.width, this.height); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(this.x, this.y, this.width, this.height); if (!this.isOpen) { ctx.fillStyle = '#333'; ctx.fillRect(this.x + this.width / 2 - 4, this.y + this.height / 2 - 2, 8, 8); } else { ctx.fillStyle = '#9b59b6'; ctx.fillRect(this.x, this.y - 10, this.width, 10); ctx.strokeRect(this.x, this.y - 10, this.width, 10); } ctx.restore(); }
}
class Stairs {
    x: number = 0; y: number = 0; width: number = 50; height: number = 50; isOpen: boolean = false;
    setPosition(tileX: number, tileY: number) { this.x = (tileX * TILE_SIZE) + (TILE_SIZE / 2) - (this.width / 2); this.y = (tileY * TILE_SIZE) + (TILE_SIZE / 2) - (this.height / 2); this.isOpen = false; }
    draw(ctx: CanvasRenderingContext2D) { ctx.save(); ctx.fillStyle = this.isOpen ? '#000' : '#7f8c8d'; ctx.fillRect(this.x, this.y, this.width, this.height); ctx.strokeStyle = this.isOpen ? '#2ecc71' : '#e74c3c'; ctx.lineWidth = 3; ctx.strokeRect(this.x, this.y, this.width, this.height); if (this.isOpen) { ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fillRect(this.x + 10, this.y + 10, this.width - 20, this.height - 20); } ctx.restore(); }
}
function drawMap(ctx: CanvasRenderingContext2D) { for (let row = 0; row < gameMap.length; row++) for (let col = 0; col < gameMap[row].length; col++) gameMap[row][col].draw(ctx); }

export class Entity {
    x: number; y: number; width: number; height: number; level: number; xp: number; sizeType: EntitySize;
    baseMaxHp: number; baseMaxPp: number; baseAtk: number; baseDef: number;
    evHp: number = 0; evPp: number = 0; evAtk: number = 0; evDef: number = 0;
    hp: number; pp: number; skills: { id: string, level: number }[]; activeModifiers: string[]; 
    atkElement: string; defElement: string; equippedWeapon: EquipmentItem | null; equippedArmor: EquipmentItem | null;
    floatingTexts: { text: string, color: string, yOffset: number, life: number, xOffset: number, isText: boolean }[] = [];
    isDefending: boolean = false; name: string = "Entité"; isActing: boolean = false; currentActionName: { text: string, color: string, timer: number } | null = null; floorsToSkip: number = 0;

    constructor(x: number, y: number, width: number, height: number, sizeType: EntitySize, level: number, baseMaxHp: number, baseMaxPp: number, baseAtk: number, baseDef: number, skills: { id: string, level: number }[] = [], atkElement: string = 'normal', defElement: string = 'normal') {
        this.x = x; this.y = y; this.width = width; this.height = height; this.sizeType = sizeType; this.level = level; this.xp = Math.pow(level, 3); 
        this.baseMaxHp = baseMaxHp; this.baseMaxPp = baseMaxPp; this.baseAtk = baseAtk; this.baseDef = baseDef;
        this.hp = this.maxHp; this.pp = this.maxPp; this.skills = skills; this.activeModifiers = []; this.atkElement = atkElement; this.defElement = defElement; this.equippedWeapon = null; this.equippedArmor = null; 
    }

    checkWallCollision(newX: number, newY: number): boolean { 
        const leftCol = Math.floor(newX / TILE_SIZE); const rightCol = Math.floor((newX + this.width - 0.1) / TILE_SIZE);
        const topRow = Math.floor(newY / TILE_SIZE); const bottomRow = Math.floor((newY + this.height - 0.1) / TILE_SIZE);
        for (let row = topRow; row <= bottomRow; row++) { for (let col = leftCol; col <= rightCol; col++) { if (row < 0 || row >= gameMap.length || col < 0 || col >= gameMap[0].length) return true; if (gameMap[row][col].isSolid) return true; } } return false;
    }

    get maxHp(): number { return this.baseMaxHp + Math.floor(this.evHp / 4); }
    get maxPp(): number { return this.baseMaxPp + Math.floor(this.evPp / 4); }
    get atk(): number { return this.baseAtk + Math.floor(this.evAtk / 4); }
    get def(): number { return Math.max(1, this.baseDef + Math.floor(this.evDef / 4)); }
    get totalEvs(): number { return this.evHp + this.evPp + this.evAtk + this.evDef; }
    
    get totalAtk(): number { 
        const boost = this.equippedWeapon ? getWeaponBoost(this.equippedWeapon) : 0; 
        const armorItem = this.equippedArmor; const armorPenalty = armorItem && armorsDB[armorItem.id].atkPenalty ? armorsDB[armorItem.id].atkPenalty! : 0;
        const armorBonus = armorItem && armorsDB[armorItem.id].atkBonus ? armorsDB[armorItem.id].atkBonus! : 0; // NOUVEAUTÉ
        let total = this.atk + boost + armorBonus - armorPenalty;
        const weaponItem = this.equippedWeapon; if (weaponItem && weaponsDB[weaponItem.id].atkMultiplier) total += Math.floor(total * weaponsDB[weaponItem.id].atkMultiplier!);
        return Math.max(1, total); 
    }
    get totalDef(): number { 
        const boost = this.equippedArmor ? getArmorDefBoost(this.equippedArmor) : 0; 
        let total = this.def + boost;
        const weaponItem = this.equippedWeapon; if (weaponItem && weaponsDB[weaponItem.id].defMultiplier) total += Math.floor(total * weaponsDB[weaponItem.id].defMultiplier!);
        if (this.activeModifiers.includes('tenderized')) total = Math.max(1, Math.floor(total * 0.85)); // NOUVEAUTÉ
        return Math.max(1, total); 
    }

    gainXp(amount: number): boolean { this.xp += amount; const nextLevelXp = Math.pow(this.level + 1, 3); if (this.xp >= nextLevelXp) { this.level++; this.baseMaxHp += Math.floor(Math.random() * 4) + 3; this.baseMaxPp += Math.floor(Math.random() * 3) + 1; this.baseAtk += Math.floor(Math.random() * 3) + 1; this.baseDef += Math.floor(Math.random() * 2) + 1; this.hp = this.maxHp; this.pp = this.maxPp; this.addFloatingText("LEVEL UP!", "#f1c40f", true); return true; } return false; }
    takeDamage(amount: number) { this.hp -= amount; if (this.hp < 0) this.hp = 0; }
    isCollidingWith(other: Entity, nextX: number, nextY: number): boolean { return (nextX < other.x + other.width && nextX + this.width > other.x && nextY < other.y + other.height && nextY + this.height > other.y); }

    addFloatingText(text: string, color: string, isText: boolean = false) { const xOffset = isText ? 0 : (Math.random() - 0.5) * 40; let targetYOffset = isText ? -50 : -15; this.floatingTexts.forEach(ft => { if (Math.abs(ft.yOffset - targetYOffset) < 25) targetYOffset -= 25; }); this.floatingTexts.push({ text, color, yOffset: targetYOffset, life: 60, xOffset, isText }); }
    updateFloatingTexts() { for (let i = this.floatingTexts.length - 1; i >= 0; i--) { this.floatingTexts[i].life--; this.floatingTexts[i].yOffset -= (this.floatingTexts[i].life / 40); if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1); } if (this.currentActionName) { this.currentActionName.timer--; if (this.currentActionName.timer <= 0) this.currentActionName = null; } }
    drawFloatingTexts(ctx: CanvasRenderingContext2D) { if (this.floatingTexts.length === 0) return; ctx.save(); ctx.textAlign = 'center'; for (const ft of this.floatingTexts) { ctx.globalAlpha = Math.min(1, ft.life / 20); ctx.font = ft.isText ? 'bold 24px Arial' : 'bold 30px Arial'; ctx.fillStyle = ft.color; ctx.strokeStyle = 'black'; ctx.lineWidth = 4; const px = this.x + this.width / 2 + ft.xOffset; const py = this.y + ft.yOffset; ctx.strokeText(ft.text, px, py); ctx.fillText(ft.text, px, py); } ctx.restore(); }
    drawStatsBars(ctx: CanvasRenderingContext2D) { const barWidth = this.width; const barX = this.x; let barY = this.y - 20; ctx.fillStyle = '#333'; ctx.fillRect(barX, barY, barWidth, 6); ctx.fillStyle = '#2ecc71'; ctx.fillRect(barX, barY, barWidth * Math.max(0, this.hp / this.maxHp), 6); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barWidth, 6); ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.fillText(`Lv.${this.level}`, barX - 35, barY + 7); if (this.maxPp > 0) { barY += 8; ctx.fillStyle = '#333'; ctx.fillRect(barX, barY, barWidth, 4); ctx.fillStyle = '#9b59b6'; ctx.fillRect(barX, barY, barWidth * Math.max(0, this.pp / this.maxPp), 4); ctx.strokeRect(barX, barY, barWidth, 4); } }

    drawActionAndIcons(ctx: CanvasRenderingContext2D, inCombat: boolean, isMandatory: boolean = false, behavior?: string) {
        if (!inCombat) return;
        const cx = this.x + this.width / 2; let currentY = this.y - 28; ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText(this.name, cx, currentY); currentY -= 18;

        const icons: any[] = [];
        if (behavior) icons.push({ type: 'class', val: behavior }); if (isMandatory) icons.push({ type: 'mandatory' }); if (this.isDefending) icons.push({ type: 'emoji', val: '🛡️' });
        if (this.activeModifiers.includes('burning')) icons.push({ type: 'emoji', val: '🔥' }); if (this.activeModifiers.includes('poisoned')) icons.push({ type: 'emoji', val: '☠️' }); if (this.activeModifiers.includes('muddy')) icons.push({ type: 'emoji', val: '💧' }); if (this.activeModifiers.includes('feared')) icons.push({ type: 'emoji', val: '😨' });
        
        // --- NOUVEAUTÉ : Emojis Spéciaux ---
        if (this.activeModifiers.includes('cloned')) icons.push({ type: 'emoji', val: '👥' });
        if (this.activeModifiers.includes('ragebait')) icons.push({ type: 'emoji', val: '🤬' });
        if (this.activeModifiers.includes('brainrot')) icons.push({ type: 'emoji', val: '🧟' });
        if (this.activeModifiers.includes('tenderized')) icons.push({ type: 'emoji', val: '🥩' });

        const iconWidth = 16; const gap = 4; const totalWidth = icons.length * iconWidth + (icons.length - 1) * gap; let startX = cx - totalWidth / 2 + (iconWidth / 2);
        icons.forEach(icon => { if (icon.type === 'emoji') { ctx.font = '14px Arial'; ctx.fillText(icon.val, startX, currentY + 5); } else if (icon.type === 'class') { ctx.fillStyle = elementColors[this.defElement] || 'white'; ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.beginPath(); if (icon.val === 'Tank') ctx.rect(startX - 7, currentY - 7, 14, 14); else if (icon.val === 'Mage') ctx.arc(startX, currentY, 7, 0, Math.PI * 2); else if (icon.val === 'Berserker') { ctx.moveTo(startX, currentY - 9); ctx.lineTo(startX + 9, currentY + 7); ctx.lineTo(startX - 9, currentY + 7); } else { ctx.moveTo(startX, currentY - 9); ctx.lineTo(startX + 9, currentY); ctx.lineTo(startX, currentY + 9); ctx.lineTo(startX - 9, currentY); } ctx.fill(); ctx.stroke(); } else if (icon.type === 'mandatory') { ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(startX - 7, currentY - 7); ctx.lineTo(startX + 7, currentY - 7); ctx.lineTo(startX, currentY + 7); ctx.fill(); } startX += iconWidth + gap; });
        currentY -= 25;
        if (this.currentActionName) { ctx.fillStyle = this.currentActionName.color; ctx.font = 'bold 16px Arial'; ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.strokeText(this.currentActionName.text, cx, currentY); ctx.fillText(this.currentActionName.text, cx, currentY); }
        if (this.isActing) { ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 24px Arial'; if (this.name === "Joueur") ctx.fillText(">", this.x - 20, this.y + this.height/2 + 8); else ctx.fillText("<", this.x + this.width + 20, this.y + this.height/2 + 8); }
        ctx.textAlign = 'left';
    }
}

export class Player extends Entity {
    vx: number = 0; vy: number = 0; acceleration: number = 1.0; friction: number = 0.82;    
    constructor(startX: number, startY: number) { super(startX, startY, 40, 40, 'M', 1, 100, 50, 15, 5, [], 'normal', 'normal'); this.name = "Joueur"; }
    update() {
        if (currentGameState !== 'EXPLORE') return;
        if (keys['ArrowUp'] || keys['z'] || keys['Z']) this.vy -= this.acceleration; if (keys['ArrowDown'] || keys['s'] || keys['S']) this.vy += this.acceleration; if (keys['ArrowLeft'] || keys['q'] || keys['Q']) this.vx -= this.acceleration; if (keys['ArrowRight'] || keys['d'] || keys['D']) this.vx += this.acceleration;
        this.vx *= this.friction; this.vy *= this.friction; if (Math.abs(this.vx) < 0.01) this.vx = 0; if (Math.abs(this.vy) < 0.01) this.vy = 0; const nextX = this.x + this.vx; const nextY = this.y + this.vy;
        if (gracePeriodTimer <= 0) { for (const enemy of enemies) { if (this.isCollidingWith(enemy, nextX, nextY)) { currentCombatGangId = enemy.gangId; const aggroList = enemies.filter(e => e.gangId === enemy.gangId); CombatSystem.start(this, aggroList); return; } } }
        if (!this.checkWallCollision(nextX, this.y)) this.x += this.vx; else this.vx = 0; if (!this.checkWallCollision(this.x, nextY)) this.y += this.vy; else this.vy = 0;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); if (gracePeriodTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0) ctx.globalAlpha = 0.5; 
        ctx.fillStyle = '#3498db'; ctx.fillRect(this.x, this.y, this.width, this.height); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(this.x, this.y, this.width, this.height);
        if (this.activeModifiers.includes('burning')) { ctx.fillStyle = 'rgba(255, 100, 0, 0.4)'; ctx.fillRect(this.x, this.y, this.width, this.height); } else if (this.activeModifiers.includes('poisoned')) { ctx.fillStyle = 'rgba(128, 0, 128, 0.4)'; ctx.fillRect(this.x, this.y, this.width, this.height); } else if (this.activeModifiers.includes('muddy')) { ctx.fillStyle = 'rgba(139, 69, 19, 0.6)'; ctx.fillRect(this.x, this.y, this.width, this.height); }
        ctx.restore(); this.drawActionAndIcons(ctx, currentGameState === 'COMBAT');
    }
}

export class Enemy extends Entity {
    gangId: number; isMandatory: boolean; behavior: BehaviorType; aiState: AIState = 'PATROL'; spawnX: number; spawnY: number; patrolAngle: number = Math.random() * Math.PI * 2;
    constructor(startX: number, startY: number, level: number, size: EntitySize, gangId: number, isMandatory: boolean) { 
        const behaviors: BehaviorType[] = ['Berserker', 'Tank', 'Mage', 'Moyen']; const behavior = behaviors[Math.floor(Math.random() * behaviors.length)]; const mults = EnemyAI.getStatMultipliers(behavior); 
        const baseHp = (30 + (level * 15)) * mults.hp; const basePp = (15 + (level * 5)) * mults.pp; const baseAtk = (20 + (level * 10)) * mults.atk; const baseDef = (10 + (level * 6)) * mults.def;
        const sizePx = size === 'S' ? 30 : (size === 'M' ? 40 : 60); const elements = ['feu', 'eau', 'plante', 'normal', 'poison']; const randomElem = elements[Math.floor(Math.random() * elements.length)];
        super(startX, startY, sizePx, sizePx, size, level, baseHp, basePp, baseAtk, baseDef, [], randomElem, randomElem); 
        this.gangId = gangId; this.isMandatory = isMandatory; this.behavior = behavior; this.spawnX = startX; this.spawnY = startY; this.skills = EnemyAI.assignSkills(behavior, level, randomElem); this.name = behavior;
    }
    update() { if (currentGameState !== 'EXPLORE' || gracePeriodTimer > 0) return; EnemyAI.updateExploration(this, player); }
    drawStatsBars(ctx: CanvasRenderingContext2D) { const barWidth = this.width; const barX = this.x; const barY = this.y - 20; ctx.fillStyle = '#333'; ctx.fillRect(barX, barY, barWidth, 6); ctx.fillStyle = '#2ecc71'; ctx.fillRect(barX, barY, barWidth * Math.max(0, this.hp / this.maxHp), 6); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barWidth, 6); ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.fillText(`Lv.${this.level}`, barX - 35, barY + 7); }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.fillStyle = '#e74c3c'; ctx.fillRect(this.x, this.y, this.width, this.height); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(this.x, this.y, this.width, this.height);
        if (this.activeModifiers.includes('burning')) { ctx.fillStyle = 'rgba(255, 100, 0, 0.4)'; ctx.fillRect(this.x, this.y, this.width, this.height); } else if (this.activeModifiers.includes('poisoned')) { ctx.fillStyle = 'rgba(128, 0, 128, 0.4)'; ctx.fillRect(this.x, this.y, this.width, this.height); } else if (this.activeModifiers.includes('muddy')) { ctx.fillStyle = 'rgba(139, 69, 19, 0.6)'; ctx.fillRect(this.x, this.y, this.width, this.height); }
        ctx.restore(); this.drawActionAndIcons(ctx, currentGameState === 'COMBAT', this.isMandatory, this.behavior); 
    }
}

export const player = new Player(0, 0); export const chest = new Chest(); export const stairs = new Stairs();

function loadNextFloor() {
    mandatoryEnemiesTotal = 0; mandatoryEnemiesKilled = 0; enemies = []; stairs.isOpen = false; const { mapBlueprint, size, mapType } = LevelGenerator.generateMap(currentFloor); currentMapType = mapType; 
    const layer1Id = Math.floor(Math.random() * 327); const layer2Id = Math.floor(Math.random() * 327); const layer1 = new BackgroundLayer(layer1Id, ROM); const layer2 = new BackgroundLayer(layer2Id, ROM);
    bgEngine = new Engine([layer1, layer2], { fps: 12, aspectRatio: 0, frameSkip: 1, alpha: [0.5, 0.5], canvas: bgCanvas }); bgEngine.animate(false);

    if (currentFloor === 0) { alertMessage = `Le Donjon vous attend...`; alertTimer = 180; } else if (currentMapType === 'Arène') { alertMessage = `⚔️ ARÈNE : Éliminez tout le monde ! ⚔️`; alertTimer = 240; } else { alertMessage = `Bienvenue à l'étage ${currentFloor}`; alertTimer = 120; }
    gameMap = [];
    for (let row = 0; row < size; row++) { const newRow: Tile[] = []; for (let col = 0; col < size; col++) { if (mapBlueprint[row][col] === 1) newRow.push(new Wall(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE)); else newRow.push(new Floor(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE)); } gameMap.push(newRow); }

    const smallSpawns = LevelGenerator.getValidSpawns(mapBlueprint, 'S'); const largeSpawns = LevelGenerator.getValidSpawns(mapBlueprint, 'M');
    function pickRandomSpawn(spawns: {x: number, y: number}[], avoid: {x: number, y: number}[], minGridDist: number) { spawns.sort(() => Math.random() - 0.5); for (let i = 0; i < spawns.length; i++) { const sp = spawns[i]; let isFarEnough = true; for (const pt of avoid) { if (Math.hypot(sp.x - pt.x, sp.y - pt.y) < minGridDist) { isFarEnough = false; break; } } if (isFarEnough) return spawns.splice(i, 1)[0]; } return spawns.pop(); }
    function pickNearbySpawn(spawns: {x: number, y: number}[], center: {x: number, y: number}, maxDist: number, avoid: {x: number, y: number}[]) { spawns.sort(() => Math.random() - 0.5); for (let i = 0; i < spawns.length; i++) { const sp = spawns[i]; const distToCenter = Math.hypot(sp.x - center.x, sp.y - center.y); if (distToCenter <= maxDist) { let isOccupied = false; for (const pt of avoid) { if (pt.x === sp.x && pt.y === sp.y) { isOccupied = true; break; } } if (!isOccupied) return spawns.splice(i, 1)[0]; } } return null; }

    const occupiedSpaces: {x: number, y: number}[] = []; const pSpawn = pickRandomSpawn(largeSpawns, [], 0) || {x: 2, y: 2}; player.x = pSpawn.x * TILE_SIZE + 12; player.y = pSpawn.y * TILE_SIZE + 12; occupiedSpaces.push(pSpawn);
    const sSpawn = pickRandomSpawn(smallSpawns, occupiedSpaces, 10) || pickRandomSpawn(smallSpawns, [], 0) || {x: 3, y: 3}; stairs.setPosition(sSpawn.x, sSpawn.y); occupiedSpaces.push(sSpawn);
    const cSpawn = pickRandomSpawn(smallSpawns, occupiedSpaces, 5) || {x: 3, y: 3}; chest.setPosition(cSpawn.x, cSpawn.y); currentLoot = LevelGenerator.getRandomLoot(currentFloor, currentMapType === 'Arène'); occupiedSpaces.push(cSpawn);

    if (currentFloor > 0) {
        let numGangs = Math.min(6, 2 + Math.floor(currentFloor / 2)); if (currentMapType === 'Arène') numGangs = Math.min(3, 1 + Math.floor(currentFloor / 4)); 
        const mandatoryGangId = Math.floor(Math.random() * numGangs); 
        for (let g = 0; g < numGangs; g++) {
            let gangSlots = 1; if (currentFloor <= 2) gangSlots = Math.floor(Math.random() * 2) + 1; else gangSlots = Math.min(4, 2 + Math.floor(Math.random() * 3)); if (currentMapType === 'Arène') gangSlots = Math.max(2, gangSlots); 
            const isMandatory = (currentMapType === 'Arène') ? true : (g === mandatoryGangId); let gangCenter: {x: number, y: number} | null = null;
            while (gangSlots > 0 && (smallSpawns.length > 0 || largeSpawns.length > 0)) {
                const isBig = (currentMapType === 'Arène') ? (Math.random() > 0.4 && largeSpawns.length > 0) : (gangSlots >= 2 && Math.random() > 0.8 && largeSpawns.length > 0);
                const list = isBig ? largeSpawns : (smallSpawns.length > 0 ? smallSpawns : largeSpawns); let spawn;
                if (!gangCenter) { spawn = pickRandomSpawn(list, occupiedSpaces, 4); if (spawn) gangCenter = spawn; } else { spawn = pickNearbySpawn(list, gangCenter, 2, occupiedSpaces); if (!spawn) spawn = pickRandomSpawn(list, occupiedSpaces, 1); }
                if (!spawn) break; occupiedSpaces.push(spawn); let enemyLvl = currentFloor + Math.floor(Math.random() * 2); if (currentMapType === 'Arène') enemyLvl += 3 + Math.floor(Math.random() * 3); 
                enemies.push(new Enemy(spawn.x * TILE_SIZE + 10, spawn.y * TILE_SIZE + 10, enemyLvl, isBig ? 'L' : 'M', g, isMandatory)); gangSlots -= isBig ? 2 : 1; if (isMandatory) mandatoryEnemiesTotal++;
            }
        }
    }
}
loadNextFloor();

function gameLoop() {
    if (player.floorsToSkip > 0) { currentFloor += player.floorsToSkip; player.floorsToSkip = 0; loadNextFloor(); setGameState('EXPLORE'); }
    if (currentGameState === 'EXPLORE') EnemyAI.updateGangAggro(enemies, player);
    player.update(); enemies.forEach(enemy => enemy.update()); CombatSystem.update(); player.updateFloatingTexts(); enemies.forEach(enemy => enemy.updateFloatingTexts());
    if (alertTimer > 0) alertTimer--;

    for (let i = enemies.length - 1; i >= 0; i--) { if (enemies[i].hp <= 0) { if (enemies[i].isMandatory) mandatoryEnemiesKilled++; enemies.splice(i, 1); } }
    if (currentFloor === 0 && !stairs.isOpen) stairs.isOpen = true; else if (currentFloor > 0 && mandatoryEnemiesTotal > 0 && mandatoryEnemiesKilled >= mandatoryEnemiesTotal && !stairs.isOpen) { stairs.isOpen = true; alertMessage = "L'escalier vers la suite est déverrouillé !"; alertTimer = 180; }

    if (currentGameState === 'COMBAT') wasInCombat = true;
    else if (currentGameState === 'EXPLORE' && wasInCombat) {
        wasInCombat = false;
        if (currentCombatGangId !== null) {
            const gangStillAlive = enemies.some(e => e.gangId === currentCombatGangId);
            if (!gangStillAlive) {
                const lootArray = LevelGenerator.getRandomLoot(currentFloor, currentMapType === 'Arène');
                lootArray.forEach(loot => { if (loot.type === 'weapon') playerBag.weapons.push(loot.item as EquipmentItem); else if (loot.type === 'armor') playerBag.armors.push(loot.item as EquipmentItem); else if (loot.type === 'manuscript') playerBag.manuscripts.push(loot.item as ManuscriptItem); else if (loot.type === 'item') playerBag.items.push(loot.item as string); });
                playerBag.weapons.sort((a, b) => getWeaponBoost(b) - getWeaponBoost(a)); playerBag.armors.sort((a, b) => getArmorDefBoost(b) - getArmorDefBoost(a)); playerBag.manuscripts.sort((a, b) => b.level - a.level);
                if (lootArray.length === 1) { const loot = lootArray[0]; if (loot.type === 'item') alertMessage = `Gang vaincu ! Butin: ${itemsDB[loot.item].name}`; else if (loot.type === 'manuscript') alertMessage = `Gang vaincu ! Butin: Manuscrit Niv.${loot.item.level}`; else alertMessage = `Gang vaincu ! Butin: Rang ${loot.item.grade} Niv.${loot.item.level}`; } else { alertMessage = `Gang vaincu ! ${lootArray.length} objets trouvés !`; }
                alertTimer = 180;
            }
        } currentCombatGangId = null;
    }

    let targetCameraX = player.x + (player.width / 2) - (canvas.width / 2); let targetCameraY = player.y + (player.height / 2) - (canvas.height / 2);
    if (currentGameState === 'COMBAT' && activeEnemies.length > 0) { const midEnemiesX = activeEnemies.reduce((sum, e) => sum + e.x, 0) / activeEnemies.length; const midEnemiesY = activeEnemies.reduce((sum, e) => sum + e.y, 0) / activeEnemies.length; targetCameraX = ((player.x + midEnemiesX) / 2) - (canvas.width / 2); targetCameraY = ((player.y + midEnemiesY) / 2) - (canvas.height / 2); }
    cameraX += (targetCameraX - cameraX) * 0.1; cameraY += (targetCameraY - cameraY) * 0.1;

    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'black'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (currentGameState !== 'COMBAT') { ctx.imageSmoothingEnabled = false; ctx.drawImage(bgCanvas, 0, 0, canvas.width, canvas.height); }
    ctx.save(); ctx.translate(-cameraX, -cameraY); drawMap(ctx); stairs.draw(ctx); chest.draw(ctx); enemies.forEach(enemy => { if (!activeEnemies.includes(enemy)) enemy.draw(ctx); }); ctx.restore(); 

    if (currentGameState === 'COMBAT') { 
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save(); ctx.globalAlpha = 0.45; ctx.imageSmoothingEnabled = false; ctx.drawImage(bgCanvas, 0, 0, canvas.width, canvas.height); ctx.restore();
    }

    ctx.save(); ctx.translate(-cameraX, -cameraY); player.draw(ctx); 
    
    if (currentGameState === 'EXPLORE') {
        UIManager.drawInteraction(ctx, player, chest);
        if (stairs.isOpen) { const distStairs = Math.hypot((player.x + player.width/2) - (stairs.x + stairs.width/2), (player.y + player.height/2) - (stairs.y + stairs.height/2)); if (distStairs < 80) { ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(player.x - 30, player.y - 45, 100, 25); ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 12px Arial'; ctx.fillText("[X] Descendre", player.x - 20, player.y - 28); } }
    }

    if (currentGameState === 'COMBAT' && activeEnemies.length > 0) {
        activeEnemies.forEach(e => { e.draw(ctx); if (!isIntroAnimating) e.drawStatsBars(ctx); }); if (!isIntroAnimating) player.drawStatsBars(ctx);
        if (combatSubState === 'TARGET_SELECT' && activeEnemies[currentTargetIndex]) { const target = activeEnemies[currentTargetIndex]; ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(target.x - 30, target.y + target.height/2); ctx.lineTo(target.x - 10, target.y + target.height/2 - 15); ctx.lineTo(target.x - 10, target.y + target.height/2 + 15); ctx.fill(); }
    }
    
    player.drawFloatingTexts(ctx); activeEnemies.forEach(e => e.drawFloatingTexts(ctx)); ctx.restore(); 

    if (currentGameState === 'EXPLORE') { UIManager.drawExplorationHUD(ctx, canvas.width, player, alertMessage, alertTimer, currentFloor, Math.max(0, mandatoryEnemiesTotal - mandatoryEnemiesKilled), enemies.length); }
    if (currentGameState === 'COMBAT') UIManager.drawCombatMenu(ctx, canvas.width, canvas.height, activePlayer, currentTargetIndex);
    UIManager.drawCombatIntro(ctx, canvas.width, canvas.height);
    if (currentGameState === 'INVENTORY') UIManager.drawInventory(ctx, canvas.width, canvas.height, player);
    if (currentGameState === 'DEBUG') UIManager.drawDebugMenu(ctx, canvas.width, canvas.height, player, currentFloor, debugNextMapType, debugSelectedIndex);
    if (currentGameState === 'GAME_OVER') UIManager.drawGameOver(ctx, canvas.width, canvas.height, currentGameOverMessage);

    requestAnimationFrame(gameLoop);
}
gameLoop();