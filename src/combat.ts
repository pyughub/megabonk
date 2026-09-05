import * as THREE from "three";
import { chance } from "./core";
import type { AudioBus } from "./audio";
import type { EnemySystem } from "./enemies";
import type { FloaterFn } from "./core";
import type { Player } from "./player";
import type { WeaponId } from "./upgrades";

type Bolt = {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  dmg: number;
  r: number;
  pierce: number;
  homing: number;
  kind: "fire" | "knife" | "rock" | "arrow";
};

const MAX_BOLTS = 220;

export class Combat {
  private bolts: Bolt[] = [];
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private orbGroup = new THREE.Group();
  private orbMeshes: THREE.Mesh[] = [];
  private hitCd = new Map<string, number>();
  private lightning: THREE.LineSegments;
  private lightningPos: THREE.BufferAttribute;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geo = new THREE.SphereGeometry(0.18, 6, 5);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffcc33 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_BOLTS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    for (let i = 0; i < MAX_BOLTS; i++) {
      this.bolts.push({
        alive: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        life: 0,
        dmg: 0,
        r: 0.2,
        pierce: 0,
        homing: 0,
        kind: "fire",
      });
    }
    this.hideAllBolts();
    scene.add(this.orbGroup);
    this.orbGroup.name = "orbs";
    const lgeo = new THREE.BufferGeometry();
    this.lightningPos = new THREE.BufferAttribute(new Float32Array(48), 3);
    lgeo.setAttribute("position", this.lightningPos);
    this.lightning = new THREE.LineSegments(
      lgeo,
      new THREE.LineBasicMaterial({ color: 0xaad4ff }),
    );
    this.lightning.frustumCulled = false;
    scene.add(this.lightning);
  }

  private hideAllBolts(): void {
    for (let i = 0; i < MAX_BOLTS; i++) {
      this.dummy.position.set(0, -50, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private spawnBolt(partial: Omit<Bolt, "alive">): void {
    for (const b of this.bolts) {
      if (b.alive) continue;
      Object.assign(b, partial);
      b.alive = true;
      return;
    }
  }

  private roll(player: Player, base: number): { dmg: number; crit: boolean } {
    let dmg = base * player.dmgMul;
    const crit = chance(player.crit);
    if (crit) dmg *= 2.1;
    return { dmg, crit };
  }

  fire(
    player: Player,
    enemies: EnemySystem,
    dt: number,
    floater: FloaterFn,
    audio: AudioBus,
    onKill: (xp: number, gold: number, x: number, z: number, y: number) => void,
    shake: (n: number) => void,
  ): void {
    const qty = 1 + player.qtyBonus;
    for (const w of player.weapons) {
      w.cd -= dt * player.haste;
      if (w.cd > 0) continue;
      this.cast(w.id, w.level, player, enemies, qty, floater, audio, onKill, shake);
    }
  }

  private nearest(
    enemies: EnemySystem,
    x: number,
    z: number,
    range: number,
  ): { i: number; x: number; z: number; y: number } | null {
    const ids = enemies.query(x, z, range);
    let best = -1;
    let bestD = range;
    for (const i of ids) {
      const s = enemies.slots[i];
      if (!s.alive) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) {
      if (enemies.boss) {
        const d = Math.hypot(enemies.bossX - x, enemies.bossZ - z);
        if (d < range) {
          return { i: -2, x: enemies.bossX, z: enemies.bossZ, y: 2 };
        }
      }
      if (enemies.miniboss) {
        const d = Math.hypot(enemies.minibossX - x, enemies.minibossZ - z);
        if (d < range) {
          return { i: -1, x: enemies.minibossX, z: enemies.minibossZ, y: 1.4 };
        }
      }
      return null;
    }
    const s = enemies.slots[best];
    return { i: best, x: s.x, z: s.z, y: s.y };
  }

  private cdFor(id: WeaponId, level: number): number {
    const table: Record<WeaponId, number> = {
      bat: 0.2,
      fireball: 0.85,
      knives: 1.15,
      aura: 0.7,
      bolt: 0.95,
      boulder: 1.6,
      crossbow: 0.72,
    };
    return table[id] * (1 - (level - 1) * 0.04);
  }

  private cast(
    id: WeaponId,
    level: number,
    player: Player,
    enemies: EnemySystem,
    qty: number,
    floater: FloaterFn,
    audio: AudioBus,
    onKill: (xp: number, gold: number, x: number, z: number, y: number) => void,
    shake: (n: number) => void,
  ): void {
    const w = player.weapons.find((x) => x.id === id);
    if (w) w.cd = this.cdFor(id, level);
    const area = player.area * (1 + (level - 1) * 0.08);

    if (id === "fireball") {
      const n = Math.min(1 + Math.floor((level - 1) / 2) + Math.max(0, qty - 1), 6);
      const tgt = this.nearest(enemies, player.x, player.z, 22);
      for (let i = 0; i < n; i++) {
        const a = tgt
          ? Math.atan2(tgt.x - player.x, tgt.z - player.z) + (i - (n - 1) / 2) * 0.18
          : player.yaw + i * 0.3;
        const { dmg } = this.roll(player, 11 + level * 3);
        this.spawnBolt({
          x: player.x,
          y: player.y + 1.1,
          z: player.z,
          vx: Math.sin(a) * 16,
          vz: Math.cos(a) * 16,
          life: 1.6,
          dmg,
          r: 0.28 * area,
          pierce: 0,
          homing: 10,
          kind: "fire",
        });
      }
    }

    if (id === "knives") {
      const n = 4 + level + qty;
      const { dmg } = this.roll(player, 7 + level * 2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + player.yaw;
        this.spawnBolt({
          x: player.x,
          y: player.y + 1,
          z: player.z,
          vx: Math.sin(a) * 18,
          vz: Math.cos(a) * 18,
          life: 0.7,
          dmg,
          r: 0.18 * area,
          pierce: 1,
          homing: 0,
          kind: "knife",
        });
      }
    }

    if (id === "boulder") {
      const n = 1 + Math.floor((level - 1) / 3) + Math.max(0, qty - 1);
      const { dmg } = this.roll(player, 22 + level * 6);
      for (let i = 0; i < n; i++) {
        const a = player.yaw + i * 0.7;
        this.spawnBolt({
          x: player.x,
          y: player.y + 0.8,
          z: player.z,
          vx: Math.sin(a) * 9,
          vz: Math.cos(a) * 9,
          life: 2.2,
          dmg,
          r: 0.7 * area,
          pierce: 8,
          homing: 0,
          kind: "rock",
        });
      }
    }

    if (id === "crossbow") {
      const tgt = this.nearest(enemies, player.x, player.z, 28);
      const a = tgt
        ? Math.atan2(tgt.x - player.x, tgt.z - player.z)
        : player.yaw;
      const extra = Math.max(0, qty - 1);
      const { dmg } = this.roll(player, 14 + level * 4);
      for (let k = 0; k < 1 + extra; k++) {
        const ang = a + (k - extra / 2) * 0.12;
        this.spawnBolt({
          x: player.x,
          y: player.y + 1.15,
          z: player.z,
          vx: Math.sin(ang) * 28,
          vz: Math.cos(ang) * 28,
          life: 0.9,
          dmg,
          r: 0.16 * area,
          pierce: 2 + level,
          homing: 0,
          kind: "arrow",
        });
      }
    }

    if (id === "aura") {
      const r = (2.3 + level * 0.28) * area;
      const { dmg } = this.roll(player, 8 + level * 2.5);
      this.hurtRadius(
        player,
        enemies,
        player.x,
        player.z,
        r,
        dmg,
        false,
        floater,
        audio,
        onKill,
        shake,
      );
    }

    if (id === "bolt") {
      this.chain(player, enemies, 2 + level + Math.max(0, qty - 1), floater);
    }

    if (id === "bat") {
      // orbs persist; cooldown just refreshes hit windows via updateOrbs
    }
  }

  updateOrbs(player: Player, t: number): void {
    const bat = player.weapons.find((w) => w.id === "bat");
    const need = bat ? 2 + bat.level + player.qtyBonus : 0;
    while (this.orbMeshes.length < need) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.85),
        new THREE.MeshLambertMaterial({ color: 0xffcc33 }),
      );
      this.orbGroup.add(m);
      this.orbMeshes.push(m);
    }
    while (this.orbMeshes.length > need) {
      const m = this.orbMeshes.pop()!;
      this.orbGroup.remove(m);
    }
    const radius = bat ? (2.15 + bat.level * 0.12) * player.area : 2.2;
    for (let i = 0; i < this.orbMeshes.length; i++) {
      const a = t * 3.4 + (i / Math.max(1, need)) * Math.PI * 2;
      const m = this.orbMeshes[i];
      m.position.set(
        player.x + Math.sin(a) * radius,
        player.y + 1.05,
        player.z + Math.cos(a) * radius,
      );
      m.rotation.y = a;
    }
  }

  private hurtRadius(
    player: Player,
    enemies: EnemySystem,
    x: number,
    z: number,
    r: number,
    dmg: number,
    fromOrb: boolean,
    floater?: FloaterFn,
    audio?: AudioBus,
    onKill?: (xp: number, gold: number, x: number, z: number, y: number) => void,
    shake?: (n: number) => void,
  ): number {
    let hits = 0;
    const ids = enemies.query(x, z, r);
    for (const i of ids) {
      const s = enemies.slots[i];
      if (!s.alive) continue;
      if (Math.hypot(s.x - x, s.z - z) > r + s.r) continue;
      if (fromOrb) {
        const key = `orb:${i}:${Math.floor(performance.now() / 280)}`;
        if (this.hitCd.has(key)) continue;
        this.hitCd.set(key, 0.3);
      }
      const res = enemies.damage(i, dmg, x, z);
      if (!res) continue;
      hits++;
      floater?.(s.x, s.y + 1, s.z, `${Math.floor(dmg)}`, "dmg");
      audio?.hit();
      if (player.items.has("leech")) player.heal(dmg * 0.03);
      if (res.killed) {
        onKill?.(res.slot.xp, res.slot.gold, res.slot.x, res.slot.z, res.slot.y);
        if (res.slot.elite) {
          shake?.(0.35);
          audio?.crit();
        }
      }
    }
    this.hitSpecial(player, enemies, x, z, r, dmg, floater, audio, onKill, shake);
    return hits;
  }

  private hitSpecial(
    player: Player,
    enemies: EnemySystem,
    x: number,
    z: number,
    r: number,
    dmg: number,
    floater?: FloaterFn,
    audio?: AudioBus,
    onKill?: (xp: number, gold: number, x: number, z: number, y: number) => void,
    shake?: (n: number) => void,
  ): void {
    if (enemies.miniboss) {
      const d = Math.hypot(enemies.minibossX - x, enemies.minibossZ - z);
      if (d < r + 1.4) {
        const r2 = enemies.damageSpecial("mini", dmg);
        floater?.(enemies.minibossX, 2.2, enemies.minibossZ, `${Math.floor(dmg)}`);
        if (r2 === "dead") {
          onKill?.(40, 12, enemies.minibossX, enemies.minibossZ, 2);
          shake?.(0.5);
          audio?.crit();
        }
        if (player.items.has("leech")) player.heal(dmg * 0.03);
      }
    }
    if (enemies.boss) {
      const d = Math.hypot(enemies.bossX - x, enemies.bossZ - z);
      if (d < r + 2) {
        const r2 = enemies.damageSpecial("boss", dmg);
        floater?.(enemies.bossX, 3, enemies.bossZ, `${Math.floor(dmg)}`);
        if (r2 === "dead") {
          onKill?.(0, 40, enemies.bossX, enemies.bossZ, 3);
          shake?.(0.7);
          audio?.crit();
        }
        if (player.items.has("leech")) player.heal(dmg * 0.03);
      }
    }
  }

  private chain(
    player: Player,
    enemies: EnemySystem,
    jumps: number,
    floater: FloaterFn,
  ): void {
    const { dmg } = this.roll(player, 13 + (player.weapons.find((w) => w.id === "bolt")?.level ?? 1) * 4);
    let x = player.x;
    let z = player.z;
    const used = new Set<number>();
    const pts: number[] = [];
    pts.push(player.x, player.y + 1.2, player.z);
    for (let j = 0; j < jumps; j++) {
      const ids = enemies.query(x, z, 10);
      let best = -1;
      let bestD = 10;
      for (const i of ids) {
        if (used.has(i)) continue;
        const s = enemies.slots[i];
        if (!s.alive) continue;
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) break;
      used.add(best);
      const s = enemies.slots[best];
      pts.push(s.x, s.y + 0.8, s.z);
      const dealt = dmg * (1 - j * 0.12);
      const res = enemies.damage(best, dealt, x, z);
      floater(s.x, s.y + 1, s.z, `${Math.floor(dealt)}`);
      if (res?.killed) {
        this.pendingKills.push({
          xp: res.slot.xp,
          gold: res.slot.gold,
          x: res.slot.x,
          z: res.slot.z,
          y: res.slot.y,
        });
      }
      x = s.x;
      z = s.z;
    }
    const arr = this.lightningPos.array as Float32Array;
    arr.fill(0);
    let k = 0;
    for (let i = 0; i < pts.length - 3; i += 3) {
      arr[k++] = pts[i];
      arr[k++] = pts[i + 1];
      arr[k++] = pts[i + 2];
      arr[k++] = pts[i + 3];
      arr[k++] = pts[i + 4];
      arr[k++] = pts[i + 5];
    }
    this.lightningPos.needsUpdate = true;
    this.lightning.visible = pts.length > 3;
    this.flashUntil = performance.now() + 90;
  }

  private flashUntil = 0;
  pendingKills: { xp: number; gold: number; x: number; z: number; y: number }[] =
    [];

  update(
    dt: number,
    player: Player,
    enemies: EnemySystem,
    floater: FloaterFn,
    audio: AudioBus,
    onKill: (xp: number, gold: number, x: number, z: number, y: number) => void,
    shake: (n: number) => void,
  ): void {
    const t = performance.now() / 1000;
    this.updateOrbs(player, t);
    const bat = player.weapons.find((w) => w.id === "bat");
    if (bat) {
      const { dmg } = this.roll(player, 11 + bat.level * 3);
      for (const m of this.orbMeshes) {
        this.hurtRadius(
          player,
          enemies,
          m.position.x,
          m.position.z,
          0.55 * player.area,
          dmg,
          true,
          floater,
          audio,
          onKill,
          shake,
        );
      }
    }

    if (player.items.has("spikeboots") && player.slideT > 0) {
      const { dmg } = this.roll(player, 10);
      this.hurtRadius(
        player,
        enemies,
        player.x,
        player.z,
        1.6,
        dmg,
        true,
        floater,
        audio,
        onKill,
        shake,
      );
    }

    for (const [k, v] of this.hitCd) {
      const n = v - dt;
      if (n <= 0) this.hitCd.delete(k);
      else this.hitCd.set(k, n);
    }

    let dirty = false;
    for (let i = 0; i < this.bolts.length; i++) {
      const b = this.bolts[i];
      if (!b.alive) continue;
      if (b.homing > 0) {
        const tgt = this.nearest(enemies, b.x, b.z, 16);
        if (tgt) {
          const a = Math.atan2(tgt.x - b.x, tgt.z - b.z);
          const sp = Math.hypot(b.vx, b.vz);
          b.vx += Math.sin(a) * b.homing * dt;
          b.vz += Math.cos(a) * b.homing * dt;
          const m = Math.hypot(b.vx, b.vz) || 1;
          b.vx = (b.vx / m) * sp;
          b.vz = (b.vz / m) * sp;
        }
      }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.life -= dt;
      const ids = enemies.query(b.x, b.z, b.r + 1.2);
      for (const ei of ids) {
        const s = enemies.slots[ei];
        if (!s.alive) continue;
        if (Math.hypot(s.x - b.x, s.z - b.z) > b.r + s.r) continue;
        const res = enemies.damage(ei, b.dmg, b.x, b.z);
        floater(s.x, s.y + 1, s.z, `${Math.floor(b.dmg)}`);
        audio.hit();
        if (player.items.has("leech")) player.heal(b.dmg * 0.03);
        if (res?.killed) {
          onKill(res.slot.xp, res.slot.gold, res.slot.x, res.slot.z, res.slot.y);
          if (res.slot.elite) {
            shake(0.35);
            audio.crit();
          }
        }
        b.pierce -= 1;
        if (b.pierce < 0) {
          b.alive = false;
          break;
        }
      }
      this.hitSpecial(
        player,
        enemies,
        b.x,
        b.z,
        b.r,
        b.dmg,
        floater,
        audio,
        onKill,
        shake,
      );
      if (b.life <= 0) b.alive = false;
      this.dummy.position.set(b.x, b.alive ? b.y : -50, b.z);
      const sc = b.alive ? (b.kind === "rock" ? 2.4 : b.kind === "fire" ? 1.3 : 0.9) : 0.0001;
      this.dummy.scale.setScalar(sc);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
    if (performance.now() > this.flashUntil) this.lightning.visible = false;

    for (const k of this.pendingKills) onKill(k.xp, k.gold, k.x, k.z, k.y);
    this.pendingKills.length = 0;
  }

  dispose(): void {
    this.scene.remove(this.mesh, this.orbGroup, this.lightning);
  }
}
