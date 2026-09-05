import * as THREE from "three";
import { ARENA, SpatialHash, chance, rand, terrainHeight } from "./core";
import type { Player } from "./player";
import type { World } from "./world";

export type EnemyKind = "slime" | "bat" | "spiker" | "brute";

type Slot = {
  alive: boolean;
  kind: EnemyKind;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  dmg: number;
  xp: number;
  gold: number;
  elite: boolean;
  flash: number;
  charge: number;
};

const CAP: Record<EnemyKind, number> = {
  slime: 130,
  bat: 70,
  spiker: 46,
  brute: 18,
};

const COLORS: Record<EnemyKind, number> = {
  slime: 0x3cb86a,
  bat: 0x7b3fa0,
  spiker: 0xe23d3d,
  brute: 0x5a3a22,
};

export class EnemySystem {
  readonly hash = new SpatialHash(6);
  readonly slots: Slot[] = [];
  private meshes = new Map<EnemyKind, THREE.InstancedMesh>();
  private dummy = new THREE.Object3D();
  private scratch: number[] = [];
  miniboss: THREE.Group | null = null;
  minibossHp = 0;
  minibossMax = 0;
  minibossX = 0;
  minibossZ = 0;
  boss: THREE.Group | null = null;
  bossHp = 0;
  bossMax = 0;
  bossX = 0;
  bossZ = 0;
  spawnAcc = 0;
  spawnedMinis = 0;
  spawnedBoss = false;

  constructor(private scene: THREE.Scene) {
    this.makePool("slime", new THREE.IcosahedronGeometry(0.55, 0), CAP.slime);
    this.makePool("bat", new THREE.ConeGeometry(0.38, 0.7, 5), CAP.bat);
    this.makePool("spiker", new THREE.OctahedronGeometry(0.52), CAP.spiker);
    this.makePool(
      "brute",
      new THREE.BoxGeometry(1.05, 1.15, 0.8),
      CAP.brute,
    );
  }

  private makePool(kind: EnemyKind, geo: THREE.BufferGeometry, n: number): void {
    const mat = new THREE.MeshLambertMaterial({ color: COLORS[kind] });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = n;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.meshes.set(kind, mesh);
    for (let i = 0; i < n; i++) {
      this.slots.push({
        alive: false,
        kind,
        x: 0,
        y: 0,
        z: 0,
        hp: 0,
        maxHp: 0,
        r: 0.5,
        speed: 0,
        dmg: 0,
        xp: 0,
        gold: 0,
        elite: false,
        flash: 0,
        charge: 0,
      });
      this.hide(kind, this.indexOf(kind, i));
    }
  }

  private indexOf(kind: EnemyKind, local: number): number {
    let off = 0;
    for (const k of ["slime", "bat", "spiker", "brute"] as EnemyKind[]) {
      if (k === kind) return off + local;
      off += CAP[k];
    }
    return local;
  }

  private hide(kind: EnemyKind, slotIndex: number): void {
    const mesh = this.meshes.get(kind)!;
    const local = this.localIndex(kind, slotIndex);
    this.dummy.position.set(0, -40, 0);
    this.dummy.scale.setScalar(0.0001);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(local, this.dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  private localIndex(kind: EnemyKind, slotIndex: number): number {
    let off = 0;
    for (const k of ["slime", "bat", "spiker", "brute"] as EnemyKind[]) {
      if (k === kind) return slotIndex - off;
      off += CAP[k];
    }
    return 0;
  }

  count(): number {
    let n = 0;
    for (const s of this.slots) if (s.alive) n++;
    if (this.miniboss) n++;
    if (this.boss) n++;
    return n;
  }

  private take(kind: EnemyKind): Slot | null {
    let off = 0;
    for (const k of ["slime", "bat", "spiker", "brute"] as EnemyKind[]) {
      if (k === kind) {
        for (let i = 0; i < CAP[k]; i++) {
          const s = this.slots[off + i];
          if (!s.alive) return s;
        }
        return null;
      }
      off += CAP[k];
    }
    return null;
  }

  spawnAround(px: number, pz: number, t: number): void {
    let kind: EnemyKind = "slime";
    if (t > 70 && chance(0.28)) kind = "bat";
    if (t > 140 && chance(0.22)) kind = "spiker";
    if (t > 260 && chance(0.1)) kind = "brute";
    const slot = this.take(kind);
    if (!slot) return;
    const a = rand(0, Math.PI * 2);
      const d = rand(30, 42);
    let x = px + Math.cos(a) * d;
    let z = pz + Math.sin(a) * d;
    const m = Math.hypot(x, z);
    if (m > ARENA - 3) {
      x = (x / m) * (ARENA - 3);
      z = (z / m) * (ARENA - 3);
    }
    const scale = 1 + t / 220;
    const elite = chance(0.035 + t / 8000);
    slot.alive = true;
    slot.x = x;
    slot.z = z;
    slot.y = terrainHeight(x, z);
    slot.elite = elite;
    const hpBase =
      kind === "slime"
        ? 14
        : kind === "bat"
          ? 10
          : kind === "spiker"
            ? 22
            : 90;
    slot.maxHp = hpBase * scale * (elite ? 4.2 : 1);
    slot.hp = slot.maxHp;
    slot.r =
      (kind === "brute" ? 0.85 : kind === "bat" ? 0.42 : 0.5) * (elite ? 1.55 : 1);
    slot.speed =
      (kind === "slime"
        ? 3.15
        : kind === "bat"
          ? 5.6
          : kind === "spiker"
            ? 4.6
            : 2.5) * (elite ? 1.15 : 1);
    slot.dmg =
      (kind === "brute" ? 12 : kind === "spiker" ? 8 : 5) * (elite ? 1.5 : 1);
    slot.xp = (kind === "brute" ? 8 : kind === "spiker" ? 3 : 1) * (elite ? 5 : 1);
    slot.gold = (chance(0.22) ? 1 : 0) + (elite ? 4 : 0);
    slot.flash = 0;
    slot.charge = 0;
  }

  spawnSpecial(
    scene: THREE.Scene,
    kind: "mini" | "boss",
    px: number,
    pz: number,
    t: number,
  ): void {
    const a = rand(0, Math.PI * 2);
    const x = px + Math.cos(a) * 18;
    const z = pz + Math.sin(a) * 18;
    if (kind === "mini") {
      if (this.miniboss) return;
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.5),
        new THREE.MeshLambertMaterial({ color: 0xffcc33 }),
      );
      body.position.y = 1.4;
      g.add(body);
      g.position.set(x, terrainHeight(x, z), z);
      scene.add(g);
      this.miniboss = g;
      this.minibossMax = 320 + t * 1.6;
      this.minibossHp = this.minibossMax;
      this.minibossX = x;
      this.minibossZ = z;
    } else {
      if (this.boss) return;
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 2.6, 2.4),
        new THREE.MeshLambertMaterial({ color: 0x140e18 }),
      );
      body.position.y = 2.1;
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1.6, 5),
        new THREE.MeshLambertMaterial({ color: 0xe23d3d }),
      );
      horn.position.set(0, 3.8, 0);
      g.add(body, horn);
      g.position.set(x, terrainHeight(x, z), z);
      scene.add(g);
      this.boss = g;
      this.bossMax = 1400 + t * 2;
      this.bossHp = this.bossMax;
      this.bossX = x;
      this.bossZ = z;
    }
  }

  update(dt: number, player: Player, world: World, t: number): void {
    const cap = t > 360 ? 200 : 150;
    if (t > 2.4) this.spawnAcc += dt * (0.75 + t / 95);
    while (this.spawnAcc > 1 && this.count() < cap) {
      this.spawnAcc -= 1;
      this.spawnAround(player.x, player.z, t);
    }
    if (t >= 180 && this.spawnedMinis < 1) {
      this.spawnSpecial(this.scene, "mini", player.x, player.z, t);
      this.spawnedMinis = 1;
    }
    if (t >= 390 && this.spawnedMinis < 2) {
      this.spawnSpecial(this.scene, "mini", player.x, player.z, t);
      this.spawnedMinis = 2;
    }
    if (t >= 600 && !this.spawnedBoss) {
      this.spawnSpecial(this.scene, "boss", player.x, player.z, t);
      this.spawnedBoss = true;
    }

    this.hash.clear();
    const dirty = new Set<EnemyKind>();
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.alive) continue;
      s.flash = Math.max(0, s.flash - dt);
      const dx = player.x - s.x;
      const dz = player.z - s.z;
      const dist = Math.hypot(dx, dz) || 1;
      let spd = s.speed;
      if (s.kind === "spiker") {
        s.charge += dt;
        if (s.charge > 2.2) {
          spd *= 2.6;
          if (s.charge > 2.55) s.charge = 0;
        }
      }
      s.x += (dx / dist) * spd * dt;
      s.z += (dz / dist) * spd * dt;
      const p = world.resolve(s.x, s.z, s.r * 0.6);
      s.x = p.x;
      s.z = p.z;
      const hover = s.kind === "bat" ? 1.3 + Math.sin(t * 4 + i) * 0.25 : 0;
      s.y = terrainHeight(s.x, s.z) + hover;
      this.hash.insert(i, s.x, s.z);
      dirty.add(s.kind);
    }
    for (const kind of dirty) this.writeMesh(kind);

    this.tickSpecial(this.miniboss, "mini", player, dt, 3.6, 18);
    this.tickSpecial(this.boss, "boss", player, dt, 3.1, 22);
  }

  private tickSpecial(
    g: THREE.Group | null,
    which: "mini" | "boss",
    player: Player,
    dt: number,
    speed: number,
    dmg: number,
  ): void {
    if (!g) return;
    const x = which === "mini" ? this.minibossX : this.bossX;
    const z = which === "mini" ? this.minibossZ : this.bossZ;
    const dx = player.x - x;
    const dz = player.z - z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = x + (dx / dist) * speed * dt;
    const nz = z + (dz / dist) * speed * dt;
    if (which === "mini") {
      this.minibossX = nx;
      this.minibossZ = nz;
    } else {
      this.bossX = nx;
      this.bossZ = nz;
    }
    g.position.set(nx, terrainHeight(nx, nz), nz);
    g.rotation.y += dt * 0.8;
    const r = which === "boss" ? 2.1 : 1.5;
    if (dist < r + 0.5) player.hurt(dmg);
  }

  private writeMesh(kind: EnemyKind): void {
    const mesh = this.meshes.get(kind)!;
    let off = 0;
    for (const k of ["slime", "bat", "spiker", "brute"] as EnemyKind[]) {
      if (k === kind) break;
      off += CAP[k];
    }
    for (let i = 0; i < CAP[kind]; i++) {
      const s = this.slots[off + i];
      if (!s.alive) {
        this.dummy.position.set(0, -40, 0);
        this.dummy.scale.setScalar(0.0001);
      } else {
        const sc = (s.elite ? 1.55 : 1) * (s.flash > 0 ? 1.12 : 1);
        this.dummy.position.set(s.x, s.y + (kind === "brute" ? 0.55 : 0.45), s.z);
        this.dummy.scale.setScalar(sc);
        this.dummy.rotation.set(0, s.x * 0.2, 0);
      }
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  query(x: number, z: number, r: number): number[] {
    this.hash.query(x, z, r, this.scratch);
    return this.scratch;
  }

  damage(
    i: number,
    amount: number,
    fromX?: number,
    fromZ?: number,
  ): { killed: boolean; slot: Slot } | null {
    const s = this.slots[i];
    if (!s?.alive) return null;
    s.hp -= amount;
    s.flash = 0.08;
    if (fromX != null && fromZ != null) {
      const dx = s.x - fromX;
      const dz = s.z - fromZ;
      const away = Math.hypot(dx, dz) || 1;
      s.x += (dx / away) * 0.55;
      s.z += (dz / away) * 0.55;
    }
    if (s.hp <= 0) {
      s.alive = false;
      this.hide(s.kind, i);
      return { killed: true, slot: s };
    }
    return { killed: false, slot: s };
  }

  damageSpecial(
    which: "mini" | "boss",
    amount: number,
  ): "hit" | "dead" | null {
    if (which === "mini") {
      if (!this.miniboss) return null;
      this.minibossHp -= amount;
      if (this.minibossHp <= 0) {
        this.scene.remove(this.miniboss);
        this.miniboss = null;
        return "dead";
      }
      return "hit";
    }
    if (!this.boss) return null;
    this.bossHp -= amount;
    if (this.bossHp <= 0) {
      this.scene.remove(this.boss);
      this.boss = null;
      return "dead";
    }
    return "hit";
  }

  contactPlayer(player: Player): { dmg: number; thorns: number } {
    let dmg = 0;
    let thorns = 0;
    for (const s of this.slots) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - player.x, s.z - player.z);
      if (d < s.r + 0.45) {
        dmg = Math.max(dmg, s.dmg);
        thorns += s.dmg;
      }
    }
    return { dmg, thorns };
  }
}
