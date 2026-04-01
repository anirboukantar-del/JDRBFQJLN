// src/weapons.ts
import type { ElementType } from './elements';

export interface Weapon {
    id: string;
    name: string;
    description: string;
    atkBoost: number;
    element: ElementType;
    elementPercent: number; 
    fixedPpPenalty?: number;    
    poisonChanceBonus?: number; 
    healBonus?: number;         
    spAtkBonus?: number;        
    spCostPenalty?: number;     
    atkMultiplier?: number;
    defMultiplier?: number;
    fearChanceBonus?: number; // NOUVEAUTÉ
}

export const weaponsDB: Record<string, Weapon> = {
    epee_en_bois: { id: 'epee_en_bois', name: 'Épée en Bois', description: 'Une arme basique.', atkBoost: 5, element: 'normal', elementPercent: 1.0 },
    lame_de_feu: { id: 'lame_de_feu', name: 'Lame de Feu', description: 'Une épée ardente.', atkBoost: 12, element: 'feu', elementPercent: 0.6 },
    lame_feuille: { id: 'lame_feuille', name: 'Lame Feuille', description: 'Épée verte et tranchante.', atkBoost: 20, element: 'plante', elementPercent: 0.8 },
    couteau_poison: { id: 'couteau_poison', name: 'Couteau Poison', description: 'Lame empoisonnée.', atkBoost: 10, element: 'poison', elementPercent: 0.3 },
    
    lame_coquillage: {
        id: 'lame_coquillage', name: 'Lame Coquillage', description: 'Tranchante et humide.',
        atkBoost: 5, element: 'eau', elementPercent: 0.5
    },
    massue_sauvage: {
        id: 'massue_sauvage', name: 'Massue Sauvage', description: 'Force pure (+20% ATK, -25% DEF, -95% PP).',
        atkBoost: 70, element: 'normal', elementPercent: 1.0,
        fixedPpPenalty: 0.95, atkMultiplier: 0.20, defMultiplier: -0.25 
    },
    poings_lave: { id: 'poings_lave', name: 'Poings Lave', description: 'Brûlent tout ce qu\'ils touchent.', atkBoost: 12, element: 'feu', elementPercent: 1.0 },
    lance_tenebre: { id: 'lance_tenebre', name: 'Lance Ténèbre', description: 'Haut risque d\'empoisonnement (+30%).', atkBoost: 20, element: 'poison', elementPercent: 0.6, poisonChanceBonus: 0.30 },
    tournesol: { id: 'tournesol', name: 'Tournesol', description: 'Amplifie les soins de 30%.', atkBoost: 5, element: 'plante', elementPercent: 1.0, healBonus: 0.30 },
    canon_magma: { id: 'canon_magma', name: 'Canon Magma', description: 'Attaques Spé +60% Dégâts, coût en PP +80%.', atkBoost: 25, element: 'feu', elementPercent: 0.7, spAtkBonus: 0.60, spCostPenalty: 0.80 },

    // --- NOUVELLES ARMES ---
    baguette: { 
        id: 'baguette', name: 'Baguette', description: 'ATK -80%, PP Spé -65%, Pwr Spé +15%', 
        atkBoost: 0, element: 'normal', elementPercent: 0, 
        atkMultiplier: -0.80, spCostPenalty: -0.65, spAtkBonus: 0.15 
    },
    baton_tung: { 
        id: 'baton_tung', name: 'Bâton Tung', description: 'Massue sauvage type Plante (30%)', 
        atkBoost: 25, element: 'plante', elementPercent: 0.30 
    },
    pinces_crabe: { 
        id: 'pinces_crabe', name: 'Pinces de Crabe', description: '+23 ATK, 30% Eau', 
        atkBoost: 23, element: 'eau', elementPercent: 0.30 
    },
    chancleta: { 
        id: 'chancleta', name: 'Chancleta', description: '+15 ATK, 8% chance de Terreur', 
        atkBoost: 15, element: 'normal', elementPercent: 0, fearChanceBonus: 0.08 
    }
};