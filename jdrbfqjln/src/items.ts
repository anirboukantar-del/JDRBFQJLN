// src/items.ts

export interface Item {
    id: string;
    name: string;
    description: string;
    healHp?: number;
    healPp?: number;
    addEvAtk?: number;
    addEvDef?: number;
    addEvHp?: number;
    addEvPp?: number;
    // --- NOUVEAUTÉS ---
    cureStatus?: boolean; 
    skipFloors?: boolean; 
}

export const itemsDB: Record<string, Item> = {
    potion_soin: { id: 'potion_soin', name: 'Potion de Soin', description: 'Rend 50 HP.', healHp: 50 },
    ether: { id: 'ether', name: 'Éther', description: 'Rend 30 PP.', healPp: 30 },
    proteine: { id: 'proteine', name: 'Protéine', description: 'Augmente l\'ATK (EV).', addEvAtk: 10 },
    fer: { id: 'fer', name: 'Fer', description: 'Augmente la DEF (EV).', addEvDef: 10 },
    
    // --- NOUVEAUX OBJETS ---
    remede: { 
        id: 'remede', name: 'Remède Universel', description: 'Soigne tous les statuts (Poison, Brûlure...).', 
        cureStatus: true 
    },
    cristal_spatial: { 
        id: 'cristal_spatial', name: 'Cristal Spatial', description: 'Objet très rare ! Fait sauter de 1 à 5 étages.', 
        skipFloors: true 
    }
};