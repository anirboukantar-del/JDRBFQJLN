// src/generator.ts
import { weaponsDB } from './weapons';
import { armorsDB } from './armors';
import { skillsDB } from './skills';
import type { Grade, EquipmentItem, ManuscriptItem } from './inventory';

export type MapType = 'Labyrinthe' | 'Arène' | 'Manoir' | 'Départ'; 
export type EntitySize = 'S' | 'M' | 'L';

export const LevelGenerator = {
    
    getRandomLoot(floor: number, isArena: boolean = false): { type: 'weapon'|'armor'|'manuscript'|'item', item: any }[] {
        let minLevel = Math.max(1, Math.floor(floor / 2));
        let maxLevel = floor + 5;
        
        // En arène, le butin a un niveau bien plus élevé !
        if (isArena) {
            minLevel += 2;
            maxLevel += 4;
        }

        const levelRoll = Math.pow(Math.random(), 2); 
        const level = minLevel + Math.floor(levelRoll * (maxLevel - minLevel + 1));
        const loot: { type: 'weapon'|'armor'|'manuscript'|'item', item: any }[] = [];

        // 1. Équipement : 50% en normal, 85% en Arène
        const equipChance = isArena ? 0.85 : 0.50;
        if (Math.random() < equipChance) {
            let roll = Math.random() * 100 + (floor * 2); 
            if (isArena) roll += 50; // Boost massif du Grade (plus de A et B)

            let grade: Grade = 'F';
            if (roll > 130) grade = 'A'; else if (roll > 105) grade = 'B'; else if (roll > 80) grade = 'C'; else if (roll > 55) grade = 'D'; else if (roll > 30) grade = 'E';

            if (Math.random() < 0.5) {
                const weaponIds = Object.keys(weaponsDB);
                const id = weaponIds[Math.floor(Math.random() * weaponIds.length)];
                loot.push({ type: 'weapon', item: { id, grade, level } as EquipmentItem });
            } else {
                const armorIds = Object.keys(armorsDB);
                const id = armorIds[Math.floor(Math.random() * armorIds.length)];
                loot.push({ type: 'armor', item: { id, grade, level } as EquipmentItem });
            }
        }

        // 2. Manuscrit : 40% en normal, 75% en Arène
        const manuChance = isArena ? 0.75 : 0.40;
        if (Math.random() < manuChance) {
            const skillIds = Object.keys(skillsDB);
            const id = skillIds[Math.floor(Math.random() * skillIds.length)];
            loot.push({ type: 'manuscript', item: { skillId: id, level } as ManuscriptItem });
        }

        // 3. Consommables (Moins probables en arène car on veut du vrai stuff)
        const itemChance = isArena ? 0.30 : 0.60;
        if (Math.random() < itemChance) {
            const itemRoll = Math.random();
            let itemId = 'potion_soin';
            if (itemRoll > 0.98) itemId = 'cristal_spatial'; 
            else if (itemRoll > 0.90) itemId = Math.random() > 0.5 ? 'proteine' : 'fer'; 
            else if (itemRoll > 0.70) itemId = 'remede'; 
            else if (itemRoll > 0.40) itemId = 'ether'; 
            loot.push({ type: 'item', item: itemId });
        }

        // Garantie anti-frustration
        if (loot.length === 0) loot.push({ type: 'item', item: 'potion_soin' });
        
        return loot;
    },

    generateMap(floor: number) {
        if (floor === 0) {
            const size = 13; let map: number[][] = Array(size).fill(0).map(() => Array(size).fill(1));
            for (let y = 3; y < size - 3; y++) for (let x = 3; x < size - 3; x++) map[y][x] = 0;
            return { mapBlueprint: map, size, mapType: 'Départ' as MapType };
        }

        const rollType = Math.random();
        let mapType: MapType = 'Labyrinthe'; 
        
        // L'arène n'apparaît qu'à partir de l'étage 3
        if (rollType < 0.10 && floor >= 3) mapType = 'Arène'; 
        else if (rollType < 0.40) mapType = 'Manoir'; 

        let size = Math.min(45, 20 + Math.floor(floor * 2));
        
        // L'arène grandit avec l'étage, jusqu'à 30x30 maximum
        if (mapType === 'Arène') {
            size = Math.min(30, 15 + Math.floor(floor * 1.5)); 
        }

        let map: number[][] = Array(size).fill(0).map(() => Array(size).fill(1)); 

        if (mapType === 'Arène') {
            const center = Math.floor(size / 2);
            const radius = Math.floor(size / 2) - 1; 
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (Math.hypot(x - center, y - center) <= radius) {
                        map[y][x] = 0; 
                    }
                }
            }
        } 
        else if (mapType === 'Manoir') {
            const numRooms = Math.floor(Math.random() * 5) + 6; const rooms: {cx: number, cy: number}[] = [];
            for (let i = 0; i < numRooms; i++) {
                const w = Math.floor(Math.random() * 8) + 5; const h = Math.floor(Math.random() * 8) + 5; 
                const px = Math.floor(Math.random() * (size - w - 2)) + 1; const py = Math.floor(Math.random() * (size - h - 2)) + 1;
                for (let y = py; y < py + h; y++) for (let x = px; x < px + w; x++) map[y][x] = 0;
                rooms.push({ cx: Math.floor(px + w/2), cy: Math.floor(py + h/2) });
            }
            for (let i = 1; i < rooms.length; i++) {
                let currX = rooms[i-1].cx; let currY = rooms[i-1].cy; const targetX = rooms[i].cx; const targetY = rooms[i].cy;
                while (currX !== targetX) { map[currY][currX] = 0; if (currY + 1 < size - 1) map[currY + 1][currX] = 0; currX += currX < targetX ? 1 : -1; }
                while (currY !== targetY) { map[currY][currX] = 0; if (currX + 1 < size - 1) map[currY][currX + 1] = 0; currY += currY < targetY ? 1 : -1; }
            }
        }
        else if (mapType === 'Labyrinthe') {
            let px = Math.floor(size / 2); let py = Math.floor(size / 2); const numTunnels = size * 4; 
            for(let i = 0; i < numTunnels; i++) {
                const dir = Math.floor(Math.random() * 4); const tunnelLength = Math.floor(Math.random() * 8) + 4; 
                if (i % 5 === 0) {
                    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                        if (py+oy > 0 && py+oy < size-1 && px+ox > 0 && px+ox < size-1) map[py+oy][px+ox] = 0;
                    }
                }
                for(let j = 0; j < tunnelLength; j++) {
                    map[py][px] = 0;
                    if (dir === 0 && py > 2) py--; else if (dir === 1 && py < size - 3) py++; else if (dir === 2 && px > 2) px--; else if (dir === 3 && px < size - 3) px++;
                }
            }
        }
        return { mapBlueprint: map, size, mapType };
    },

    getValidSpawns(mapBlueprint: number[][], sizeReq: EntitySize): {x: number, y: number}[] {
        const spawns: {x: number, y: number}[] = [];
        for (let y = 1; y < mapBlueprint.length - 1; y++) {
            for (let x = 1; x < mapBlueprint[y].length - 1; x++) {
                if (mapBlueprint[y][x] === 0) {
                    if (sizeReq === 'S') spawns.push({x, y});
                    else { 
                        let isSpacious = true;
                        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                            if (mapBlueprint[y+oy] === undefined || mapBlueprint[y+oy][x+ox] !== 0) isSpacious = false;
                        }
                        if (isSpacious) spawns.push({x, y});
                    }
                }
            }
        }
        return spawns;
    }
};