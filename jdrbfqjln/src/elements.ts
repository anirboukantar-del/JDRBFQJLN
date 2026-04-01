// src/elements.ts

export type ElementType = 'normal' | 'feu' | 'eau' | 'plante' | 'poison';

// Tableau des affinités (qui bat qui)
export const ElementChart: Record<ElementType, { strongAgainst: ElementType[], weakAgainst: ElementType[] }> = {
    normal: { strongAgainst: [], weakAgainst: [] },
    feu: { strongAgainst: ['plante'], weakAgainst: ['eau'] },
    eau: { strongAgainst: ['feu'], weakAgainst: ['plante'] },
    plante: { strongAgainst: ['eau'], weakAgainst: ['feu'] },
    poison: {strongAgainst: [], weakAgainst: []},
};

// Fonction qui renvoie le multiplicateur (1.3 pour super efficace, 0.7 pour pas efficace, 1.0 neutre)
export function getEffectiveness(attackElement: ElementType, defenseElement: ElementType): number {
    if (ElementChart[attackElement].strongAgainst.includes(defenseElement)) return 1.3;
    if (ElementChart[attackElement].weakAgainst.includes(defenseElement)) return 0.7;
    return 1.0;
}