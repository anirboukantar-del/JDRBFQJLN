// src/modifiers.ts

export interface Modifier {
    id: string;
    name: string;
    description: string;
    onTurnEnd?: (entity: any) => void;
}

export const modifiersDB: Record<string, Modifier> = {
    poisoned: {
        id: 'poisoned', name: 'Empoisonné', description: 'Perd 4% des PV Max à la fin de son tour.',
        onTurnEnd: (entity: any) => { const damage = Math.max(1, Math.floor(entity.maxHp * 0.04)); entity.takeDamage(damage); }
    },
    burning: {
        id: 'burning', name: 'En Feu', description: 'Perd 10% des PV Max à la fin de son tour.',
        onTurnEnd: (entity: any) => { const damage = Math.max(1, Math.floor(entity.maxHp * 0.10)); entity.takeDamage(damage); }
    },
    muddy: { id: 'muddy', name: 'Embourbé', description: 'L\'attaque est réduite de 20%.' },
    
    // --- NOUVEAUTÉS ---
    feared: { 
        id: 'feared', name: 'Appeuré', description: 'Passe son prochain tour.' 
    },
    ultra_garde: {
        id: 'ultra_garde', name: 'Ultra Garde', description: 'Dégâts subis -50%, PP restaurés augmentés.',
        onTurnEnd: (entity: any) => {
            // L'Ultra Garde se dissipe à la fin du tour !
            const idx = entity.activeModifiers.indexOf('ultra_garde');
            if (idx !== -1) entity.activeModifiers.splice(idx, 1);
        }
    }
};