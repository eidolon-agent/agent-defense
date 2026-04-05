// Shared ability definitions
export const ABILITY_DB: Record<string, { name: string; icon: string; label: string; cd: number; duration?: number }[]> = {
  knight: [
    { name: "shield_wall", icon: "🛡️", label: "Shield Wall", cd: 12000, duration: 3000 },
    { name: "battle_cry", icon: "📢", label: "Battle Cry", cd: 18000, duration: 5000 },
    { name: "cleave", icon: "⚔️", label: "Cleave", cd: 15000 },
  ],
  archer: [
    { name: "rapid_fire", icon: "⚡", label: "Rapid Fire", cd: 14000, duration: 5000 },
    { name: "snipe", icon: "🎯", label: "Snipe", cd: 10000 },
    { name: "multishot", icon: "🔥", label: "Multishot", cd: 20000, duration: 5000 },
  ],
  mage: [
    { name: "fireball", icon: "💥", label: "Fireball", cd: 8000 },
    { name: "heal_aura", icon: "💚", label: "Heal Aura", cd: 20000, duration: 5000 },
    { name: "frost_nova", icon: "❄️", label: "Frost Nova", cd: 14000, duration: 4000 },
  ],
  rogue: [
    { name: "backstab", icon: "🗡️", label: "Backstab", cd: 8000 },
    { name: "shadow_step", icon: "👤", label: "Shadow Step", cd: 12000 },
    { name: "poison_blade", icon: "☠️", label: "Poison Blade", cd: 14000, duration: 5000 },
  ],
};

export const WAVE_ABILITIES = [
  { name: "upgrade_damage", label: "+25% Damage", icon: "⚔️", description: "Permanent +25% damage", effect: "damage" },
  { name: "upgrade_hp", label: "+30% Max HP", icon: "❤️", description: "Permanent +30% max HP", effect: "hp" },
  { name: "upgrade_speed", label: "+20% Atk Speed", icon: "⚡", description: "Permanent -20% attack cooldown", effect: "speed" },
  { name: "upgrade_range", label: "+15% Range", icon: "📏", description: "Permanent +15% attack range", effect: "range" },
  { name: "upgrade_regen", label: "HP Regen +1/s", icon: "💚", description: "Passive HP regen", effect: "regen" },
  { name: "upgrade_crit", label: "+15% Crit", icon: "💥", description: "+15% critical hit chance", effect: "crit" },
];

export const ABILITY_ICONS: Record<string, {icon:string; label:string}> = {
  shield_wall: { icon: "🛡️", label: "Shield Wall" },
  battle_cry: { icon: "📢", label: "Battle Cry" },
  cleave: { icon: "⚔️", label: "Cleave" },
  rapid_fire: { icon: "⚡", label: "Rapid Fire" },
  snipe: { icon: "🎯", label: "Snipe" },
  multishot: { icon: "🔥", label: "Multishot" },
  fireball: { icon: "💥", label: "Fireball" },
  heal_aura: { icon: "💚", label: "Heal Aura" },
  frost_nova: { icon: "❄️", label: "Frost Nova" },
  backstab: { icon: "🗡️", label: "Backstab" },
  shadow_step: { icon: "👤", label: "Shadow Step" },
  poison_blade: { icon: "☠️", label: "Poison Blade" },
};
