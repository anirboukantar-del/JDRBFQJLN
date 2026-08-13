// src/inventory.ts
import { itemsDB } from './items';
import { weaponsDB } from './weapons';
import { armorsDB } from './armors';
import { skillsDB } from './skills'; 
import { setGameState } from './combat';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface EquipmentItem { id: string; grade: Grade; level: number; }
export interface ManuscriptItem { skillId: string; level: number; }
export let inventoryAlert = { message: "", expire: 0 };
export const playerBag = { weapons: [] as EquipmentItem[], armors: [] as EquipmentItem[], items: [] as string[], manuscripts: [] as ManuscriptItem[] };
export let currentTab: 'weapons' | 'armors' | 'items' | 'manuscripts' = 'weapons';
export let selectedIndex = 0;

export let currentPartyIndex = 0; // Index du personnage sélectionné (0: Général, 1: Mage, 2: Tank, 3: Berserker)
export let inventorySubState: 'NORMAL' | 'REPLACE_SKILL' = 'NORMAL';
export let replaceTargetIndex = 0;

export function getGroupedItems(): { id: string, count: number }[] {
    const counts: Record<string, number> = {}; const order: string[] = []; 
    for (const id of playerBag.items) { if (!counts[id]) { counts[id] = 0; order.push(id); } counts[id]++; }
    return order.map(id => ({ id, count: counts[id] }));
}

export function getGradeMultiplier(grade: Grade): number {
    if(grade === 'A') return 1.5; if(grade === 'B') return 1.3; if(grade === 'C') return 1.0; 
    if(grade === 'D') return 0.8; if(grade === 'E') return 0.6; if(grade === 'F') return 0.5; return 1.0;
}

export function getWeaponBoost(weapon: EquipmentItem): number { return Math.max(1, Math.floor(weaponsDB[weapon.id].atkBoost * getGradeMultiplier(weapon.grade) * (1 + weapon.level * 0.1))); }
export function getArmorDefBoost(armor: EquipmentItem): number { return Math.max(0, Math.floor(armorsDB[armor.id].defBoost * getGradeMultiplier(armor.grade) * (1 + armor.level * 0.1))); }
export function getArmorPpBoost(armor: EquipmentItem): number { return Math.floor(armorsDB[armor.id].ppBoost * getGradeMultiplier(armor.grade) * (1 + armor.level * 0.1)); }

export function calculatePpMult(entity: any): number {
    let ppMult = 1;
    if (entity.equippedWeapon) { const wpn = weaponsDB[entity.equippedWeapon.id]; if (wpn && wpn.spCostPenalty) ppMult += wpn.spCostPenalty * getGradeMultiplier(entity.equippedWeapon.grade); }
    if (entity.equippedArmor) { const arm = armorsDB[entity.equippedArmor.id]; if (arm && arm.spCostPenalty) ppMult += arm.spCostPenalty * getGradeMultiplier(entity.equippedArmor.grade); }
    return Math.max(0.1, ppMult); 
}

export const InventorySystem = {
    handleClick(mouseX: number, mouseY: number, canvasWidth: number, partySize: number) {
        const iconSize = 40; const spacing = 15;
        const startX = canvasWidth / 2 - ((partySize * iconSize + (partySize - 1) * spacing) / 2);
        for (let i = 0; i < partySize; i++) {
            const px = startX + i * (iconSize + spacing);
            // Vérifie si le clic de la souris est dans la zone de l'icône de l'allié
            if (mouseX >= px && mouseX <= px + iconSize && mouseY >= 15 && mouseY <= 15 + iconSize) {
                currentPartyIndex = i;
                inventorySubState = 'NORMAL';
                break;
            }
        }
    },

    handleInput(key: string, party: any[]) {
        // --- SÉLECTION DU PERSONNAGE (1, 2, 3, 4) ---
        if (key === '1' && party.length > 0) { currentPartyIndex = 0; return; }
        if (key === '2' && party.length > 1) { currentPartyIndex = 1; return; }
        if (key === '3' && party.length > 2) { currentPartyIndex = 2; return; }
        if (key === '4' && party.length > 3) { currentPartyIndex = 3; return; }

        const player = party[currentPartyIndex];

        // --- GESTION DU REMPLACEMENT DE COMPÉTENCE ---
        if (inventorySubState === 'REPLACE_SKILL') {
            if (key === 'Escape') { inventorySubState = 'NORMAL'; return; }
            if (key === 'ArrowUp' || key.toLowerCase() === 'z') { replaceTargetIndex--; if (replaceTargetIndex < 0) replaceTargetIndex = player.skills.length - 1; }
            if (key === 'ArrowDown' || key.toLowerCase() === 's') { replaceTargetIndex++; if (replaceTargetIndex >= player.skills.length) replaceTargetIndex = 0; }
            if (key === 'Enter' || key === ' ') {
                const manu = playerBag.manuscripts[selectedIndex]; 
                player.skills[replaceTargetIndex] = { id: manu.skillId, level: manu.level };
                playerBag.manuscripts.splice(selectedIndex, 1); 
                inventorySubState = 'NORMAL'; 
                if (selectedIndex >= playerBag.manuscripts.length) selectedIndex = Math.max(0, playerBag.manuscripts.length - 1);
            } 
            return;
        }

        if (key === 'Escape' || key.toLowerCase() === 'w') { setGameState('EXPLORE'); return; }

        // --- NAVIGATION DANS LES ONGLETS ---
        let listLength = 0;
        if (currentTab === 'items') listLength = getGroupedItems().length; 
        else if (currentTab === 'manuscripts') listLength = playerBag.manuscripts.length; 
        else listLength = playerBag[currentTab].length;

        if (key === 'ArrowRight' || key.toLowerCase() === 'd') { if (currentTab === 'weapons') currentTab = 'armors'; else if (currentTab === 'armors') currentTab = 'items'; else if (currentTab === 'items') currentTab = 'manuscripts'; selectedIndex = 0; }
        else if (key === 'ArrowLeft' || key.toLowerCase() === 'q') { if (currentTab === 'manuscripts') currentTab = 'items'; else if (currentTab === 'items') currentTab = 'armors'; else if (currentTab === 'armors') currentTab = 'weapons'; selectedIndex = 0; }
        else if (key === 'ArrowUp' || key.toLowerCase() === 'z') { selectedIndex--; if (selectedIndex < 0) selectedIndex = Math.max(0, listLength - 1); }
        else if (key === 'ArrowDown' || key.toLowerCase() === 's') { selectedIndex++; if (selectedIndex >= listLength) selectedIndex = 0; }
        
        // --- VALIDATION DE L'ACTION ---
        else if (key === 'Enter' || key === ' ') {
            if (listLength === 0) return;

            if (currentTab === 'weapons') { 
                const weaponItem = playerBag.weapons[selectedIndex];
                const weaponData = weaponsDB[weaponItem.id];
                
                // RÈGLES DES ARMES
                if (player.heroClass === 'Mage' && !weaponData.isMagic) {
                    inventoryAlert = { message: "Le Mage ne peut équiper que des armes magiques !", expire: Date.now() + 2000 };
                    return;
                }
                if ((player.heroClass === 'Tank' || player.heroClass === 'Berserker') && weaponData.isMagic) {
                    inventoryAlert = { message: `Le ${player.heroClass} ne peut pas utiliser de magie !`, expire: Date.now() + 2000 };
                    return;
                }

                player.equippedWeapon = weaponItem; 
                player.hp = Math.min(player.hp, player.maxHp); 
                player.pp = Math.min(player.pp, player.totalMaxPp); 
            }
            else if (currentTab === 'armors') { 
                player.equippedArmor = playerBag.armors[selectedIndex]; 
                player.hp = Math.min(player.hp, player.maxHp); 
                player.pp = Math.min(player.pp, player.totalMaxPp); 
            }
            else if (currentTab === 'items') {
                const grouped = getGroupedItems(); const itemId = grouped[selectedIndex].id; const item = itemsDB[itemId]; let itemUsed = false;
                
                if (item.healHp && player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + item.healHp); itemUsed = true; }
                if (item.healPp && player.pp < player.totalMaxPp) { player.pp = Math.min(player.totalMaxPp, player.pp + item.healPp); itemUsed = true; }
                
                const MAX_TOTAL_EV = 510; const MAX_STAT_EV = 255;
                if (item.addEvAtk && player.totalEvs < MAX_TOTAL_EV && player.evAtk < MAX_STAT_EV) { player.evAtk = Math.min(MAX_STAT_EV, player.evAtk + item.addEvAtk); itemUsed = true; }
                if (item.addEvDef && player.totalEvs < MAX_TOTAL_EV && player.evDef < MAX_STAT_EV) { player.evDef = Math.min(MAX_STAT_EV, player.evDef + item.addEvDef); itemUsed = true; }
                if (item.addEvHp && player.totalEvs < MAX_TOTAL_EV && player.evHp < MAX_STAT_EV) { player.evHp = Math.min(MAX_STAT_EV, player.evHp + item.addEvHp); itemUsed = true; }
                
                if (item.cureStatus && player.activeModifiers.length > 0) { player.activeModifiers = []; itemUsed = true; }
                if (item.skipFloors) { player.floorsToSkip = Math.floor(Math.random() * 5) + 1; itemUsed = true; }

                if (itemUsed) { 
                    const idx = playerBag.items.indexOf(itemId); 
                    if (idx !== -1) playerBag.items.splice(idx, 1); 
                    const newLength = getGroupedItems().length; 
                    if (selectedIndex >= newLength) selectedIndex = Math.max(0, newLength - 1); 
                }
            }
            else if (currentTab === 'manuscripts') {
                // RÈGLES DES MANUSCRITS
                if (player.heroClass === 'Berserker') {
                    inventoryAlert = { message: "Le Berserker refuse de lire un livre !", expire: Date.now() + 2000 };
                    return;
                }

                const manu = playerBag.manuscripts[selectedIndex]; 
                const skillData = skillsDB[manu.skillId];

                if (player.heroClass === 'Tank' && skillData.isAdvanced) {
                    inventoryAlert = { message: "Ce manuscrit est trop complexe pour le Tank !", expire: Date.now() + 2000 };
                    return;
                }

                const existingIndex = player.skills.findIndex((s: any) => s.id === manu.skillId);
                
                if (existingIndex !== -1) { 
                    player.skills[existingIndex] = { id: manu.skillId, level: manu.level }; 
                    playerBag.manuscripts.splice(selectedIndex, 1); 
                    if (selectedIndex >= playerBag.manuscripts.length) selectedIndex = Math.max(0, playerBag.manuscripts.length - 1); 
                } 
                else if (player.skills.length < 4) { 
                    player.skills.push({ id: manu.skillId, level: manu.level }); 
                    playerBag.manuscripts.splice(selectedIndex, 1); 
                    if (selectedIndex >= playerBag.manuscripts.length) selectedIndex = Math.max(0, playerBag.manuscripts.length - 1); 
                } 
                else { 
                    inventorySubState = 'REPLACE_SKILL'; 
                    replaceTargetIndex = 0; 
                }
            }
        }
    }
};

export const DebugLogics = {
    giveAllEquipment() {
        const wIds = Object.keys(weaponsDB);
        wIds.forEach(id => playerBag.weapons.push({ id, grade: 'A', level: 100 }));
        const aIds = Object.keys(armorsDB);
        aIds.forEach(id => playerBag.armors.push({ id, grade: 'A', level: 100 }));
        playerBag.weapons.sort((a, b) => getWeaponBoost(b) - getWeaponBoost(a));
        playerBag.armors.sort((a, b) => getArmorDefBoost(b) - getArmorDefBoost(a));
    },
    giveAllItems() {
        const iIds = Object.keys(itemsDB);
        iIds.forEach(id => { for(let i=0; i<5; i++) playerBag.items.push(id); });
    },
    giveAllManuscripts() {
        const sIds = Object.keys(skillsDB);
        sIds.forEach(id => playerBag.manuscripts.push({ skillId: id, level: 100 }));
        playerBag.manuscripts.sort((a, b) => b.level - a.level);
    }
};