export const TAU = Math.PI * 2;
export const ARENA = 86;
export const RUN_SECONDS = 600;

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function rand(a = 0, b = 1): number {
  return a + Math.random() * (b - a);
}

export function pick<T>(arr: readonly T[]): T {
  return arr[(Math.random() * arr.length) | 0];
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

export function formatTime(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const r = t % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function terrainHeight(x: number, z: number): number {
  const n1 = Math.sin(x * 0.055) * Math.cos(z * 0.048) * 2.05;
  const n2 = Math.sin((x + 40) * 0.02 + z * 0.018) * 2.4;
  const n3 = Math.sin(x * 0.12) * Math.sin(z * 0.11) * 0.4;
  const d = Math.hypot(x, z);
  const flatten = clamp((d - 10) / 22, 0, 1);
  return (n1 + n2 + n3) * flatten;
}

export class SpatialHash {
  private map = new Map<string, number[]>();
  constructor(private cell = 7) {}

  clear(): void {
    this.map.clear();
  }

  private key(x: number, z: number): string {
    return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
  }

  insert(i: number, x: number, z: number): void {
    const k = this.key(x, z);
    let bucket = this.map.get(k);
    if (!bucket) {
      bucket = [];
      this.map.set(k, bucket);
    }
    bucket.push(i);
  }

  query(x: number, z: number, r: number, out: number[]): void {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c);
    const x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c);
    const z1 = Math.floor((z + r) / c);
    const seen = new Set<number>();
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const bucket = this.map.get(`${ix},${iz}`);
        if (!bucket) continue;
        for (const i of bucket) {
          if (!seen.has(i)) {
            seen.add(i);
            out.push(i);
          }
        }
      }
    }
  }
}

export type Rarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 64,
  rare: 26,
  epic: 8,
  legendary: 2,
};

export function rollRarity(luck: number): Rarity {
  const boost = 1 + luck * 0.012;
  const bag: { r: Rarity; w: number }[] = [
    { r: "common", w: RARITY_WEIGHT.common },
    { r: "rare", w: RARITY_WEIGHT.rare * boost },
    { r: "epic", w: RARITY_WEIGHT.epic * boost },
    { r: "legendary", w: RARITY_WEIGHT.legendary * boost * boost },
  ];
  let t = 0;
  for (const x of bag) t += x.w;
  let n = Math.random() * t;
  for (const x of bag) {
    n -= x.w;
    if (n <= 0) return x.r;
  }
  return "common";
}

export type Meta = {
  kills: number;
  bestTime: number;
  bestLevel: number;
  zipper: boolean;
  brick: boolean;
  runs: number;
};

const META_KEY = "megabonk-meta-v1";

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return { ...blankMeta(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return blankMeta();
}

export function saveMeta(m: Meta): void {
  localStorage.setItem(META_KEY, JSON.stringify(m));
}

export function blankMeta(): Meta {
  return {
    kills: 0,
    bestTime: 0,
    bestLevel: 1,
    zipper: false,
    brick: false,
    runs: 0,
  };
}

export type FloaterFn = (
  x: number,
  y: number,
  z: number,
  text: string,
  kind?: "dmg" | "hp" | "hurt",
) => void;
