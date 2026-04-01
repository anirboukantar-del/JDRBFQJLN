// src/armors.ts
import type { ElementType } from './elements';

export interface Armor {
    id: string;
    name: string;
    description: string;
    defBoost: number; 
    ppBoost: number; 
    element: ElementType; 
    atkPenalty?: number;       
    invertLifesteal?: boolean; 
    forceResist?: boolean;     
}

export const armorsDB: Record<string, Armor> = {
    tunique_cuir: { id: 'tunique_cuir', name: 'Tunique en Cuir', description: 'Protection classique.', defBoost: 2, ppBoost: 0, element: 'normal' },
    manteau_feuilles: { id: 'manteau_feuilles', name: 'Manteau de Feuilles', description: 'Donne +15 PP Max.', defBoost: 5, ppBoost: 15, element: 'plante' },

    carapace_tortue: {
        id: 'carapace_tortue', name: 'Carapace Tortue', description: 'Solide, mais lourde (-5 PP).',
        defBoost: 15, ppBoost: -5, element: 'eau'
    },
    cote_poison: {
        id: 'cote_poison', name: 'Côte Poison', description: 'Le Vol-Vie des ennemis les blesse au lieu de les soigner.',
        defBoost: 10, ppBoost: 0, element: 'poison',
        invertLifesteal: true
    },
    cape_mirroir: {
        id: 'cape_mirroir', name: 'Cape Miroir', description: '-20 ATK. Réduit tous les dégâts subis.',
        defBoost: 30, ppBoost: 0, element: 'normal',
        atkPenalty: 20, forceResist: true
    }
};