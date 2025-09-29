// Different bowling ball definitions
// Masses approx en kilogrammes (conversion réaliste des livres -> kg) :
// Légère ~7 lb (3.2 kg), Standard ~15 lb (6.8 kg), Lourde 16 lb (7.26 kg)
// Rayon réel d'une boule ~0.1085 m (diamètre 8.5" ≈ 0.216 m). On garde de légères variations pour ressentis différents.
export const BallTypes = [
  {
    id: 'light',
    label: 'Légère',
    mass: 3.2,          // kg
    radius: 0.105,      // un peu plus petite
    surfaceFriction: 0.07, // plus d'accroche (tend à dévier légèrement)
    color: 0x44aaee
  },
  {
    id: 'standard',
    label: 'Standard',
    mass: 6.8,
    radius: 0.1085,
    surfaceFriction: 0.05,
    color: 0x3366ff
  },
  {
    id: 'heavy',
    label: 'Lourde',
    mass: 7.26,
    radius: 0.1095,       // quasi taille réelle
    surfaceFriction: 0.04, // un peu plus de glisse (inertie plus droite)
    color: 0x2222aa
  }
];

export function getBallType(id) { return BallTypes.find(b=>b.id===id) || BallTypes[1]; }
