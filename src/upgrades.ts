import { pick, type Rarity } from "./core";

export type CharId = "bonklet" | "zipper" | "brick";

export type Character = {
  id: CharId;
  name: string;
  blurb: string;
  weapon: WeaponId;
  hp: number;
  speed: number;
  pickup: number;
};

export const CHARACTERS: Record<CharId, Character> = {
  bonklet: {
    id: "bonklet",
    name: "BONKLET",
    blurb: "A mustard lump with a stick. Finds shiny rocks. Starts with Bonk Bat.",
    weapon: "bat",
    hp: 110,
    speed: 8.2,
    pickup: 1.2,
  },
  zipper: {
    id: "zipper",
    name: "ZIPPER",
    blurb: "All knees, no patience. Starts with Knives and extra scoot.",
    weapon: "knives",
    hp: 84,
    speed: 10.1,
    pickup: 1,
  },
  brick: {
    id: "brick",
    name: "BRICK",
    blurb: "A walking wall. Starts with Thunder Aura and leftover lunch.",
    weapon: "aura",
    hp: 168,
    speed: 7.1,
    pickup: 1,
  },
};

export type WeaponId =
  | "bat"
  | "fireball"
  | "knives"
  | "aura"
  | "bolt"
  | "boulder"
  | "crossbow";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  desc: string;
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bat: { id: "bat", name: "BONK BAT", desc: "Orbiting sticks. Intimate violence." },
  fireball: { id: "fireball", name: "SPITFIRE", desc: "Homing gobs of rude heat." },
  knives: { id: "knives", name: "KNIVES", desc: "A polite circle of stab." },
  aura: { id: "aura", name: "THUNDER AURA", desc: "A pulse that hates personal space." },
  bolt: { id: "bolt", name: "CHAIN JOLT", desc: "Lightning that gossips between bodies." },
  boulder: { id: "boulder", name: "BOULDER", desc: "A rock with a grudge. Slow, huge." },
  crossbow: { id: "crossbow", name: "PIKE BOW", desc: "A bolt that keeps going." },
};

export type TomeId =
  | "might"
  | "haste"
  | "bulk"
  | "swarm"
  | "vitality"
  | "regen"
  | "boots"
  | "scholar"
  | "magnet"
  | "luck"
  | "iron"
  | "fury";

export type TomeDef = {
  id: TomeId;
  name: string;
  desc: string;
  max: number;
};

export const TOMES: Record<TomeId, TomeDef> = {
  might: { id: "might", name: "MIGHT", desc: "+18% damage", max: 6 },
  haste: { id: "haste", name: "HASTE", desc: "+14% attack speed", max: 6 },
  bulk: { id: "bulk", name: "BULK", desc: "+14% area / projectile size", max: 6 },
  swarm: { id: "swarm", name: "SWARM", desc: "+1 projectile / orb", max: 5 },
  vitality: { id: "vitality", name: "VITALITY", desc: "+28 max meat", max: 6 },
  regen: { id: "regen", name: "REGEN", desc: "+0.45 meat / sec", max: 5 },
  boots: { id: "boots", name: "BOOTS", desc: "+11% move speed", max: 6 },
  scholar: { id: "scholar", name: "SCHOLAR", desc: "+18% XP", max: 5 },
  magnet: { id: "magnet", name: "MAGNET", desc: "+28% pickup radius", max: 5 },
  luck: { id: "luck", name: "CLOVER", desc: "+12 luck (better rolls)", max: 5 },
  iron: { id: "iron", name: "IRON", desc: "+8% damage resist", max: 5 },
  fury: { id: "fury", name: "FURY", desc: "+8% crit chance", max: 5 },
};

export type ItemId =
  | "thorns"
  | "leech"
  | "wings"
  | "spicy"
  | "coil"
  | "glass"
  | "spikeboots"
  | "heart"
  | "golden"
  | "clover";

export type ItemDef = {
  id: ItemId;
  name: string;
  desc: string;
  rarity: Rarity;
};

export const ITEMS: Record<ItemId, ItemDef> = {
  thorns: {
    id: "thorns",
    name: "BURR HIDE",
    desc: "Return 25% contact damage.",
    rarity: "rare",
  },
  leech: {
    id: "leech",
    name: "LEECH TOOTH",
    desc: "3% of damage heals you.",
    rarity: "epic",
  },
  wings: {
    id: "wings",
    name: "BAT WINGS",
    desc: "One extra jump.",
    rarity: "rare",
  },
  spicy: {
    id: "spicy",
    name: "HOT JAM",
    desc: "+30% damage.",
    rarity: "epic",
  },
  coil: {
    id: "coil",
    name: "HUNGRY COIL",
    desc: "Huge magnet.",
    rarity: "rare",
  },
  glass: {
    id: "glass",
    name: "GLASS CANNON",
    desc: "+55% damage, −20% max meat.",
    rarity: "legendary",
  },
  spikeboots: {
    id: "spikeboots",
    name: "SPIKE BOOTS",
    desc: "Sliding hurts nearby foes.",
    rarity: "rare",
  },
  heart: {
    id: "heart",
    name: "LUNCH BOX",
    desc: "+40 max meat and a full heal.",
    rarity: "common",
  },
  golden: {
    id: "golden",
    name: "GREEDY TOOTH",
    desc: "+50% gold from kills.",
    rarity: "rare",
  },
  clover: {
    id: "clover",
    name: "FOURLEAF",
    desc: "+25 luck.",
    rarity: "epic",
  },
};

export type OfferKind = "weapon" | "tome" | "item";

export type Offer = {
  kind: OfferKind;
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  price?: number;
};

export function weaponLevelText(id: WeaponId, nextLevel: number): string {
  const base = WEAPONS[id];
  return `${base.desc}  →  Lv ${nextLevel}`;
}

export function randomItem(owned: Set<ItemId>): ItemDef | null {
  const pool = (Object.values(ITEMS) as ItemDef[]).filter((i) => !owned.has(i.id));
  return pool.length ? pick(pool) : null;
}

export function xpToNext(level: number): number {
  return Math.floor(10 * level ** 1.32 + 6);
}
