// src/ui.ts
import { weaponsDB } from './weapons';
import { armorsDB } from './armors';
import { itemsDB } from './items';
import { skillsDB, getDynamicSkill } from './skills';
import { playerBag, currentTab, selectedIndex, getGroupedItems, getWeaponBoost, getArmorDefBoost, calculatePpMult, inventorySubState, replaceTargetIndex, type EquipmentItem, getGradeMultiplier } from './inventory'; 
import { combatSubState, currentMenuIndex, combatMenuOptions, currentSkillIndex, pendingSkill, isIntroAnimating, introAnimationTimer, INTRO_ANIMATION_DURATION } from './combat';

export const elementColors: Record<string, string> = { 'normal': '#bdc3c7', 'feu': '#e74c3c', 'eau': '#3498db', 'plante': '#2ecc71', 'poison': '#9b59b6' };

// Options du Menu Debug
export const debugOptions = [
    "Niveau Joueur +1",
    "Niveau Joueur -1",
    "Étage +1",
    "Étage -1",
    "Changer Type Map",
    "REGEN MAP (Appliquer)",
    "TOUT EQUIPEMENT (Lv.100)",
    "TOUS LES OBJETS (x5)",
    "TOUTES LES SPES (Lv.100)"
];

export const UIManager = {
    drawExplorationHUD(ctx: CanvasRenderingContext2D, canvasWidth: number, player: any, alertMessage: string, alertTimer: number, currentFloor: number, mandatoryRemaining: number, totalEnemies: number) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(10, 10, 280, 145); 
        ctx.fillStyle = 'white'; ctx.font = 'bold 20px Arial'; ctx.fillText(`Niv. ${player.level}`, 20, 40);
        ctx.fillStyle = '#2ecc71'; ctx.fillText(`HP : ${player.hp} / ${player.maxHp}`, 20, 65);
        ctx.fillStyle = '#9b59b6'; ctx.fillText(`PP : ${player.pp} / ${player.totalMaxPp}`, 20, 90);

        const wpnItem = player.equippedWeapon as EquipmentItem | null; const weapon = wpnItem ? weaponsDB[wpnItem.id] : null;
        ctx.font = '16px Arial'; ctx.fillStyle = 'white'; ctx.fillText(`Arme: `, 20, 115);
        if (weapon && wpnItem) { ctx.fillStyle = elementColors[weapon.element] || 'white'; ctx.fillText(`${weapon.name} [${wpnItem.grade}] +${wpnItem.level}`, 75, 115); } 
        else { ctx.fillStyle = '#7f8c8d'; ctx.fillText('Aucune', 75, 115); }

        const armItem = player.equippedArmor as EquipmentItem | null; const armor = armItem ? armorsDB[armItem.id] : null;
        ctx.fillStyle = 'white'; ctx.fillText(`Armure: `, 20, 140);
        if (armor && armItem) { ctx.fillStyle = elementColors[armor.element] || 'white'; ctx.fillText(`${armor.name} [${armItem.grade}] +${armItem.level}`, 85, 140); } 
        else { ctx.fillStyle = '#7f8c8d'; ctx.fillText('Aucune', 85, 140); }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(canvasWidth / 2 - 100, 10, 200, 75); 
        ctx.fillStyle = 'white'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText(`Étage ${currentFloor}`, canvasWidth / 2, 35); 
        
        if (currentFloor > 0) {
            const triSize = 8; const gap = 10;
            const totalTriWidth = mandatoryRemaining * (triSize * 2) + Math.max(0, mandatoryRemaining - 1) * gap;
            let startX = canvasWidth / 2 - totalTriWidth / 2 + triSize;
            
            ctx.fillStyle = '#f1c40f';
            for(let i = 0; i < mandatoryRemaining; i++) {
                ctx.beginPath();
                ctx.moveTo(startX - triSize, 55 - triSize); ctx.lineTo(startX + triSize, 55 - triSize); ctx.lineTo(startX, 55 + triSize); ctx.fill();
                startX += (triSize * 2) + gap;
            }
            if (mandatoryRemaining === 0) { ctx.font = '16px Arial'; ctx.fillStyle = '#2ecc71'; ctx.fillText(`Escalier déverrouillé !`, canvasWidth / 2, 55); }

            ctx.font = '14px Arial'; ctx.fillStyle = '#bdc3c7';
            ctx.fillText(`${totalEnemies} ennemis restants`, canvasWidth / 2, 75);
        } else { ctx.font = 'italic 18px Arial'; ctx.fillStyle = '#bdc3c7'; ctx.fillText(`Zone Sûre`, canvasWidth / 2, 68); }
        ctx.textAlign = 'left';

        if (alertTimer > 0) {
            ctx.fillStyle = 'rgba(46, 204, 113, 0.9)'; ctx.fillRect(canvasWidth / 2 - 150, 95, 300, 50);
            ctx.fillStyle = 'white'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center'; ctx.fillText(alertMessage, canvasWidth / 2, 128); ctx.textAlign = 'left';
        }
    },

    drawInteraction(ctx: CanvasRenderingContext2D, player: any, chest: any) {
        if (!chest.isOpen) {
            const dist = Math.hypot((player.x + player.width/2) - (chest.x + chest.width/2), (player.y + player.height/2) - (chest.y + chest.height/2));
            if (dist < 80) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(player.x - 20, player.y - 45, 80, 25);
                ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.fillText("[X] Ouvrir", player.x - 10, player.y - 28);
            }
        }
    },

    drawInventory(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, player: any) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        const margin = 50; const width = canvasWidth - margin * 2; const height = canvasHeight - margin * 2;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(margin, margin, width, height);

        const leftWidth = width * 0.35; const leftX = margin + 20; const rightEdgeX = margin + leftWidth - 20; 
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(margin, margin, leftWidth, height); ctx.strokeRect(margin, margin, leftWidth, height);
        ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center'; ctx.fillText("PERSONNAGE", margin + leftWidth / 2, margin + 40);

        ctx.textAlign = 'left'; ctx.font = 'bold 20px Arial'; let currentY = margin + 80;
        
        ctx.fillStyle = '#2ecc71'; ctx.fillText("HP :", leftX, currentY); ctx.fillStyle = 'white'; ctx.fillText(`${player.hp} / ${player.maxHp}`, leftX + 60, currentY);
        ctx.fillStyle = '#7f8c8d'; ctx.font = 'italic 18px Arial'; ctx.textAlign = 'right'; ctx.fillText(`(${player.baseMaxHp})`, rightEdgeX, currentY);
        ctx.textAlign = 'left'; ctx.font = 'bold 20px Arial'; currentY += 35;

        ctx.fillStyle = '#9b59b6'; ctx.fillText("PP :", leftX, currentY); ctx.fillStyle = 'white'; ctx.fillText(`${player.pp} / ${player.totalMaxPp}`, leftX + 60, currentY);
        ctx.fillStyle = '#7f8c8d'; ctx.font = 'italic 18px Arial'; ctx.textAlign = 'right'; ctx.fillText(`(${player.baseMaxPp})`, rightEdgeX, currentY);
        ctx.textAlign = 'left'; ctx.font = 'bold 20px Arial'; currentY += 45; 

        ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#e74c3c'; ctx.fillText(`ATK : ${player.totalAtk}`, leftX, currentY); 
        ctx.fillStyle = '#7f8c8d'; ctx.font = 'italic 18px Arial'; ctx.textAlign = 'right'; ctx.fillText(`(${player.baseAtk})`, rightEdgeX, currentY);
        ctx.textAlign = 'left'; ctx.font = 'bold 22px Arial'; currentY += 22;

        ctx.font = 'italic 16px Arial'; 
        const wpnItem = player.equippedWeapon as EquipmentItem | null; const wpn = wpnItem ? weaponsDB[wpnItem.id] : null;
        if (wpn && wpn.element !== 'normal') {
            const pctElem = Math.round(wpn.elementPercent * 100); const pctNorm = 100 - pctElem;
            ctx.fillStyle = elementColors['normal']; ctx.fillText(`${pctNorm}% Normal`, leftX + 15, currentY);
            const offset = leftX + 15 + ctx.measureText(`${pctNorm}% Normal`).width;
            ctx.fillStyle = 'white'; ctx.fillText(` / `, offset, currentY);
            ctx.fillStyle = elementColors[wpn.element]; ctx.fillText(`${pctElem}% ${wpn.element.toUpperCase()}`, offset + 15, currentY);
        } else { ctx.fillStyle = elementColors['normal']; ctx.fillText(`100% Normal`, leftX + 15, currentY); }
        currentY += 40; 

        ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#3498db'; ctx.fillText(`DEF : ${player.totalDef}`, leftX, currentY); 
        ctx.fillStyle = '#7f8c8d'; ctx.font = 'italic 18px Arial'; ctx.textAlign = 'right'; ctx.fillText(`(${player.baseDef})`, rightEdgeX, currentY);
        ctx.textAlign = 'left'; ctx.font = 'bold 22px Arial'; currentY += 60; 

        ctx.font = '18px Arial'; ctx.fillStyle = 'white'; ctx.fillText("ARME ÉQUIPÉE :", leftX, currentY); currentY += 25;
        ctx.fillStyle = wpn ? elementColors[wpn.element] : '#7f8c8d'; 
        ctx.fillText(wpn && wpnItem ? `${wpn.name} [${wpnItem.grade}] +${wpnItem.level}` : "Aucune", leftX + 15, currentY); currentY += 45;

        ctx.fillStyle = 'white'; ctx.fillText("ARMURE ÉQUIPÉE :", leftX, currentY); currentY += 25;
        const armItem = player.equippedArmor as EquipmentItem | null; const arm = armItem ? armorsDB[armItem.id] : null;
        ctx.fillStyle = arm ? elementColors[arm.element] : '#7f8c8d'; 
        ctx.fillText(arm && armItem ? `${arm.name} [${armItem.grade}] +${armItem.level}` : "Aucune", leftX + 15, currentY);

        currentY += 45; ctx.fillStyle = 'white'; ctx.fillText("CAPACITÉS (4 MAX) :", leftX, currentY); currentY += 25;
        if (player.skills.length === 0) { ctx.fillStyle = '#7f8c8d'; ctx.fillText("Aucune", leftX + 15, currentY); } 
        else {
            player.skills.forEach((sObj: any, idx: number) => {
                const dSkill = getDynamicSkill(sObj.id, sObj.level); ctx.fillStyle = elementColors[dSkill.element] || 'white';
                ctx.fillText(`- ${dSkill.name} [Lv.${sObj.level}]`, leftX + 15, currentY + (idx * 25));
            });
        }

        const rightX = margin + leftWidth; ctx.font = 'bold 20px Arial'; const tabY = margin + 40;
        ctx.fillStyle = currentTab === 'weapons' ? '#f1c40f' : 'white'; ctx.fillText("ARMES", rightX + 20, tabY);
        ctx.fillStyle = currentTab === 'armors' ? '#f1c40f' : 'white'; ctx.fillText("ARMURES", rightX + 120, tabY);
        ctx.fillStyle = currentTab === 'items' ? '#f1c40f' : 'white'; ctx.fillText("OBJETS", rightX + 240, tabY);
        ctx.fillStyle = currentTab === 'manuscripts' ? '#f1c40f' : 'white'; ctx.fillText("MANUSCRITS", rightX + 345, tabY); 
        ctx.beginPath(); ctx.moveTo(rightX, margin + 60); ctx.lineTo(margin + width, margin + 60); ctx.stroke();

        ctx.font = '20px Arial';
        
        let actualList: any[] = [];
        if (currentTab === 'items') actualList = getGroupedItems();
        else actualList = playerBag[currentTab];
        
        const listLength = actualList.length;

        if (listLength === 0) { ctx.fillStyle = '#7f8c8d'; ctx.fillText("Vide.", rightX + 30, margin + 100); } 
        else {
            const availableSpaceY = height - 180; 
            const MAX_VISIBLE = Math.max(3, Math.floor(availableSpaceY / 35));

            let startIndex = Math.max(0, selectedIndex - Math.floor(MAX_VISIBLE / 2));
            if (startIndex + MAX_VISIBLE > listLength) startIndex = Math.max(0, listLength - MAX_VISIBLE);
            const endIndex = Math.min(listLength, startIndex + MAX_VISIBLE);

            if (startIndex > 0) { ctx.fillStyle = '#bdc3c7'; ctx.font = 'italic 14px Arial'; ctx.fillText("▲ Haut de la liste", rightX + 30, margin + 85); ctx.font = '20px Arial'; }

            for (let i = startIndex; i < endIndex; i++) {
                const itemObj = actualList[i]; let text = ""; let color = 'white';

                if (currentTab === 'items') {
                    const itemName = itemsDB[itemObj.id].name; text = itemObj.count > 1 ? `${itemName} x${itemObj.count}` : itemName;
                } 
                else if (currentTab === 'weapons') { 
                    const dbItem = weaponsDB[itemObj.id]; text = `${dbItem.name} [${itemObj.grade}] +${itemObj.level}`; color = elementColors[dbItem.element]; 
                }
                else if (currentTab === 'armors') { 
                    const dbItem = armorsDB[itemObj.id]; text = `${dbItem.name} [${itemObj.grade}] +${itemObj.level}`; color = elementColors[dbItem.element]; 
                }
                else if (currentTab === 'manuscripts') {
                    const skillDb = skillsDB[itemObj.skillId]; text = `Manuscrit : ${skillDb.name} [Lvl.${itemObj.level}]`; color = elementColors[skillDb.element];
                }

                const displayIndex = i - startIndex; const y = margin + 115 + (displayIndex * 35);
                if (i === selectedIndex) { ctx.fillStyle = '#f1c40f'; ctx.fillText(`▶  ${text}`, rightX + 30, y); } 
                else { ctx.fillStyle = color; ctx.fillText(`    ${text}`, rightX + 30, y); }
            }

            if (endIndex < listLength) { ctx.fillStyle = '#bdc3c7'; ctx.font = 'italic 14px Arial'; ctx.fillText("▼ Bas de la liste", rightX + 30, margin + 115 + (MAX_VISIBLE * 35) - 15); }
        }

        ctx.beginPath(); ctx.moveTo(rightX, margin + height - 80); ctx.lineTo(margin + width, margin + height - 80); ctx.stroke();

        if (listLength > 0) {
            let desc = ""; let extraInfo = "";
            if (currentTab === 'items') {
                const selectedId = getGroupedItems()[selectedIndex].id; const itm = itemsDB[selectedId];
                desc = itm.description; if (itm.addEvAtk || itm.addEvDef || itm.addEvHp || itm.addEvPp) extraInfo = "Objet de Boost (EV)";
            }
            else if (currentTab === 'manuscripts') {
                const selectedItem = playerBag.manuscripts[selectedIndex];
                const dSkill = getDynamicSkill(selectedItem.skillId, selectedItem.level);
                desc = dSkill.description;
                if (dSkill.pwr < 0) extraInfo = `Puissance Soin: ${Math.abs(dSkill.pwr).toFixed(1)} | Coût: ${dSkill.ppCost} PP`;
                else if (dSkill.pwr === 0) extraInfo = `Statut / Buff | Coût: ${dSkill.ppCost} PP`;
                else extraInfo = `Puissance Atk: ${dSkill.pwr.toFixed(1)} | Coût: ${dSkill.ppCost} PP`;
            }
            else {
                const selectedItem = playerBag[currentTab][selectedIndex] as EquipmentItem;
                if (currentTab === 'weapons') { 
                    const w = weaponsDB[selectedItem.id]; desc = w.description; extraInfo = `+${getWeaponBoost(selectedItem)} ATK`; 
                    if (w.atkMultiplier) extraInfo += ` | ${w.atkMultiplier > 0 ? '+' : ''}${Math.round(w.atkMultiplier * 100)}% ATK`;
                    if (w.defMultiplier) extraInfo += ` | ${w.defMultiplier > 0 ? '+' : ''}${Math.round(w.defMultiplier * 100)}% DEF`;
                    if (w.fixedPpPenalty) extraInfo += ` | -${Math.round(w.fixedPpPenalty * 100)}% PP Max`;
                    if (w.spCostPenalty) extraInfo += ` | Spé Cost ${w.spCostPenalty > 0 ? '+' : ''}${Math.round(w.spCostPenalty * 100)}%`;
                    if (w.spAtkBonus) extraInfo += ` | Magie++`; if (w.poisonChanceBonus) extraInfo += ` | +Poison`; if (w.fearChanceBonus) extraInfo += ` | +Terreur`;
                }
                else if (currentTab === 'armors') { 
                    const a = armorsDB[selectedItem.id]; desc = a.description; extraInfo = `+${getArmorDefBoost(selectedItem)} DEF`; 
                    if (a.atkPenalty) extraInfo += ` | -${a.atkPenalty} ATK`; if (a.atkBonus) extraInfo += ` | +${Math.floor(a.atkBonus * getGradeMultiplier(selectedItem.grade))} ATK`;
                    if (a.spCostPenalty) extraInfo += ` | Spé Cost ${a.spCostPenalty > 0 ? '+' : ''}${Math.round(a.spCostPenalty * 100)}%`;
                    if (a.fearChanceBonus) extraInfo += ` | +Terreur`; if (a.forceResist) extraInfo += ` | Bouclier Lourd`; if (a.invertLifesteal) extraInfo += ` | Épines Sang`;
                }
            }

            ctx.fillStyle = '#bdc3c7'; ctx.font = 'italic 18px Arial'; ctx.fillText(desc, rightX + 30, margin + height - 50);
            ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 18px Arial'; ctx.fillText(extraInfo, rightX + 30, margin + height - 25);
        }

        if (inventorySubState === 'REPLACE_SKILL') {
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0,0,canvasWidth, canvasHeight);
            
            const modalW = 500; const modalH = 320;
            const modalX = canvasWidth/2 - modalW/2; const modalY = canvasHeight/2 - modalH/2;
            ctx.fillStyle = '#2c3e50'; ctx.fillRect(modalX, modalY, modalW, modalH);
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4; ctx.strokeRect(modalX, modalY, modalW, modalH);
            
            ctx.fillStyle = 'white'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
            ctx.fillText("Le Deck (4 max) est plein. Remplacer quelle capacité ?", canvasWidth/2, modalY + 40); ctx.textAlign = 'left';
            
            player.skills.forEach((sObj: any, idx: number) => {
                const dSkill = getDynamicSkill(sObj.id, sObj.level);
                const textY = modalY + 100 + (idx * 45);
                if (idx === replaceTargetIndex) {
                    ctx.fillStyle = '#f1c40f'; ctx.fillText(`▶ ${dSkill.name} [Lv.${sObj.level}]`, modalX + 50, textY);
                } else {
                    ctx.fillStyle = 'white'; ctx.fillText(`  ${dSkill.name} [Lv.${sObj.level}]`, modalX + 50, textY);
                }
            });
            ctx.fillStyle = '#7f8c8d'; ctx.font = '16px Arial'; ctx.textAlign = 'center';
            ctx.fillText("Appuyez sur Entrée pour écraser, Échap pour annuler.", canvasWidth/2, modalY + modalH - 20); ctx.textAlign = 'left';
        }
    },

    drawCombatIntro(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
        if (!isIntroAnimating) return;
        const progress = introAnimationTimer / INTRO_ANIMATION_DURATION;
        const radius = Math.sin(progress * Math.PI) * (canvasWidth / 2);
        
        ctx.save(); ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`; ctx.lineWidth = 10 * (1 - progress);
        ctx.beginPath(); ctx.arc(canvasWidth / 2, canvasHeight / 2, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    },

    drawCombatMenu(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, activePlayer: any, currentTargetIndex: number) {
        if (isIntroAnimating || combatSubState === 'EXECUTION_PHASE') return;

        const menuWidth = 300; const menuHeight = 200; 
        const menuX = canvasWidth / 2 - menuWidth / 2; const menuY = canvasHeight - menuHeight - 30;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);
        ctx.font = '22px Arial';
        
        // --- NOUVEAUTÉ : Menus grisés sous effet de statut ---
        const hasBrainrot = activePlayer.activeModifiers.includes('brainrot');
        const hasRagebait = activePlayer.activeModifiers.includes('ragebait');

        if (combatSubState === 'ACTION_SELECT') {
            combatMenuOptions.forEach((option, index) => {
                const textY = menuY + 40 + (index * 35);
                let color = 'white';
                if (index === 1 && hasBrainrot) color = 'gray'; // Spé grisée si Brainrot
                if (index === 2 && hasRagebait) color = 'gray'; // Garde grisée si Ragebait
                
                if (index === currentMenuIndex) { ctx.fillStyle = '#f1c40f'; ctx.fillText(`▶  ${option}`, menuX + 30, textY); } 
                else { ctx.fillStyle = color; ctx.fillText(`    ${option}`, menuX + 30, textY); }
            });
        } 
        else if (combatSubState === 'SKILL_SELECT') {
            const skills = activePlayer.skills;
            if (skills.length === 0) {
                ctx.fillStyle = 'gray'; ctx.fillText(`Aucune Spé...`, menuX + 30, menuY + 50);
            } else {
                skills.forEach((sObj: any, index: number) => {
                    const dSkill = getDynamicSkill(sObj.id, sObj.level);
                    const textY = menuY + 40 + (index * 40);
                    const actualCost = Math.floor(dSkill.ppCost * calculatePpMult(activePlayer));
                    
                    const isSelected = index === currentSkillIndex; const hasEnoughPP = activePlayer.pp >= actualCost;
                    ctx.fillStyle = isSelected ? '#f1c40f' : (hasEnoughPP ? 'white' : 'gray');
                    ctx.fillText(`${isSelected ? '▶ ' : '   '}${dSkill.name} [Lv.${sObj.level}] (${actualCost} PP)`, menuX + 20, textY);
                });
            }
        }
        else if (combatSubState === 'TARGET_SELECT') {
            ctx.fillStyle = 'white'; ctx.fillText(`Action : ${pendingSkill ? pendingSkill.name : "Attaque de base"}`, menuX + 30, menuY + 40);
            ctx.fillStyle = '#e74c3c'; ctx.fillText(`Cible : Ennemi ${currentTargetIndex + 1}`, menuX + 30, menuY + 70);
            ctx.fillStyle = '#f1c40f'; ctx.font = '16px Arial';
            ctx.fillText(`[Haut/Bas] Changer cible`, menuX + 20, menuY + 110);
            ctx.fillText(`[Entrée] Valider   [Échap] Retour`, menuX + 20, menuY + 130);
        }
    },

    drawGameOver(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, message: string) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.fillRect(0, 0, canvasWidth, canvasHeight); ctx.textAlign = 'center'; 
        ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 80px Arial'; ctx.fillText("GAME OVER", canvasWidth / 2, canvasHeight / 2 - 40);
        ctx.fillStyle = 'white'; ctx.font = '24px Arial'; ctx.fillText(message, canvasWidth / 2, canvasHeight / 2 + 20);
        ctx.fillStyle = '#7f8c8d'; ctx.font = 'italic 18px Arial'; ctx.fillText("Appuyez sur F5 pour ressusciter...", canvasWidth / 2, canvasHeight / 2 + 80); ctx.textAlign = 'left'; 
    },

    drawDebugMenu(ctx: CanvasRenderingContext2D, _canvasWidth: number, _canvasHeight: number, _player: any, _currentFloor: number, nextType: string, selectedIndex: number) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.fillRect(50, 50, 420, 480);
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 4; ctx.strokeRect(50, 50, 420, 480);

        ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
        ctx.fillText("MENU DEBUG", 260, 90);

        ctx.textAlign = 'left'; ctx.font = '20px Arial';
        debugOptions.forEach((opt, i) => {
            let text = opt;
            if (i === 4) text += ` : [${nextType}]`;
            
            if (i === selectedIndex) {
                ctx.fillStyle = '#f1c40f'; ctx.fillText(`▶ ${text}`, 70, 140 + (i * 35));
            } else {
                ctx.fillStyle = 'white'; ctx.fillText(`  ${text}`, 70, 140 + (i * 35));
            }
        });

        ctx.fillStyle = '#7f8c8d'; ctx.font = 'italic 16px Arial';
        ctx.fillText("Z/S: Naviguer | Entrée: Valider | C: Quitter", 70, 500);
    }
};