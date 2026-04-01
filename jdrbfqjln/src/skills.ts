// src/skills.ts
import type { ElementType } from './elements';

export interface Skill {
    id: string;          
    name: string;        
    description: string; 
    pwr: number;         
    ppCost: number;      
    modifiers: string[]; 
    element: ElementType;
    level: number;
    category: 'attaque' | 'soutien';
    targetType: 'single' | 'all_enemies' | 'all_allies' | 'self';
}

export const skillsDB: Record<string, Skill> = {
    coup_puissant: { id: "coup_puissant", name: "Coup Puissant", description: "Une frappe lourde.", pwr: 1.5, ppCost: 5, modifiers: [], element: 'normal', level: 1, category: 'attaque', targetType: 'single' },
    boule_de_feu: { id: "boule_de_feu", name: "Boule de Feu", description: "Lance une boule de feu brûlante.", pwr: 2.0, ppCost: 10, modifiers: [], element: 'feu', level: 1, category: 'attaque', targetType: 'single' },
    soin_leger: { id: "soin_leger", name: "Soin Léger", description: "Restaure quelques Points de Vie.", pwr: -1.0, ppCost: 8, modifiers: [], element: 'normal', level: 1, category: 'soutien', targetType: 'self' },
    soin_general: { id: "soin_general", name: "Soin Général", description: "Soigne tous les alliés.", pwr: -0.8, ppCost: 15, modifiers: [], element: 'normal', level: 1, category: 'soutien', targetType: 'all_allies' },
    drainage: { id: "drainage", name: "Drainage", description: "Vole la vie de l'ennemi.", pwr: 1.2, ppCost: 15, modifiers: [], element: 'plante', level: 1, category: 'attaque', targetType: 'single' },
    tsunami: { id: "tsunami", name: "Tsunami", description: "Frappe tous les ennemis. Peut embourber.", pwr: 1.8, ppCost: 25, modifiers: [], element: 'eau', level: 1, category: 'attaque', targetType: 'all_enemies' },
    volcan: { id: "volcan", name: "Volcan", description: "Frappe tous les ennemis. Peut brûler.", pwr: 1.8, ppCost: 25, modifiers: [], element: 'feu', level: 1, category: 'attaque', targetType: 'all_enemies' },
    tranche_poison: { id: "tranche_poison", name: "Tranche Poison", description: "Dégâts x2 sur cible empoisonnée. 20% chance poison.", pwr: 1.5, ppCost: 12, modifiers: [], element: 'poison', level: 1, category: 'attaque', targetType: 'single' },
    ultra_garde: { id: "ultra_garde", name: "Ultra Garde", description: "Dégâts subis -50%, grosse régénération de PP.", pwr: 0, ppCost: 10, modifiers: ['ultra_garde'], element: 'normal', level: 1, category: 'soutien', targetType: 'self' },
    cri: { id: "cri", name: "Cri", description: "35% chance de terroriser chaque ennemi.", pwr: 0, ppCost: 15, modifiers: [], element: 'normal', level: 1, category: 'attaque', targetType: 'all_enemies' },
    frappe_terreur: { id: "frappe_terreur", name: "Frappe Terreur", description: "Gros dégâts. 50% chance de terroriser la cible.", pwr: 2.2, ppCost: 18, modifiers: [], element: 'normal', level: 1, category: 'attaque', targetType: 'single' },

    // --- NOUVELLES SPÉS ---
    meditation: { id: 'meditation', name: 'Méditation', description: 'Restaure 20% des PP max.', pwr: 0, ppCost: 0, element: 'normal', targetType: 'self', modifiers: [], level: 1, category: 'soutien' },
    attaque_clone: { id: 'attaque_clone', name: 'Attaque Clone', description: 'Dégâts x2 pendant 3 tours.', pwr: 0.8, ppCost: 15, element: 'normal', targetType: 'single', modifiers: ['cloned'], level: 1, category: 'attaque' },
    ragebait: { id: 'ragebait', name: 'Ragebait', description: 'Empêche la cible de défendre.', pwr: 0, ppCost: 12, element: 'normal', targetType: 'single', modifiers: ['ragebait'], level: 1, category: 'attaque' },
    brainrot: { id: 'brainrot', name: 'Brainrot', description: 'Empêche la cible d\'utiliser des Spés.', pwr: 0, ppCost: 15, element: 'poison', targetType: 'single', modifiers: ['brainrot'], level: 1, category: 'attaque' },
    attendrissement: { id: 'attendrissement', name: 'Attendrissement', description: 'Faibles dégâts. -15% DEF (Jusqu\'à Garde).', pwr: 0.4, ppCost: 18, element: 'normal', targetType: 'single', modifiers: ['tenderized'], level: 1, category: 'attaque' }
};

export function getDynamicSkill(skillId: string, level: number): Skill {
    const base = skillsDB[skillId];
    return { ...base, pwr: base.pwr * (1 + level * 0.1), ppCost: Math.max(1, Math.floor(base.ppCost * (1 + level * 0.1))), level: level };
}