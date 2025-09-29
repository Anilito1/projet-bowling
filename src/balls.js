// Different bowling ball definitions
export const BallTypes = [
  {
    id: 'light',
    label: 'Légère',
    mass: 4.5,
    radius: 0.10,
    surfaceFriction: 0.08,
    color: 0x44aaee
  },
  {
    id: 'standard',
    label: 'Standard',
    mass: 6.0,
    radius: 0.108,
    surfaceFriction: 0.05,
    color: 0x3366ff
  },
  {
    id: 'heavy',
    label: 'Lourde',
    mass: 7.2,
    radius: 0.112,
    surfaceFriction: 0.035,
    color: 0x2222aa
  }
];

export function getBallType(id) { return BallTypes.find(b=>b.id===id) || BallTypes[1]; }
