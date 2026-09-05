import * as THREE from "three";
import { clamp, terrainHeight } from "./core";
import { Input } from "./input";
import { CHARACTERS, type CharId, type ItemId, type TomeId, type WeaponId } from "./upgrades";
import { makeDude, type World } from "./world";

export type WeaponInst = { id: WeaponId; level: number; cd: number };

const PALETTE: Record<CharId, { body: number; head: number; limb: number }> = {
  bonklet: { body: 0xd4a017, head: 0xe8d5a3, limb: 0x8a5a18 },
  zipper: { body: 0x2f9e8a, head: 0xf2e6c8, limb: 0x1a4a40 },
  brick: { body: 0x6d6a63, head: 0xc9b48a, limb: 0x3a3a38 },
};

export class Player {
  readonly mesh: THREE.Group;
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  yaw = 0;
  camYaw = 0.4;
  camPitch = 0.42;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  pickupMul: number;
  gold = 0;
  xp = 0;
  level = 1;
  kills = 0;
  luck = 0;
  armor = 0;
  crit = 0.06;
  dmgMul = 1;
  haste = 1;
  area = 1;
  qtyBonus = 0;
  xpMul = 1;
  regen = 0.08;
  jumps = 2;
  maxJumps: number;
  jumpLeft: number;
  grounded = true;
  iframe = 0;
  slideT = 0;
  slideCd = 0;
  invuln = 0;
  readonly weapons: WeaponInst[] = [];
  readonly tomes: Partial<Record<TomeId, number>> = {};
  readonly items = new Set<ItemId>();
  pendingLevels = 0;
  alive = true;
  hitFlash = 0;

  constructor(
    scene: THREE.Scene,
    readonly char: CharId,
  ) {
    const c = CHARACTERS[char];
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.baseSpeed = c.speed;
    this.pickupMul = c.pickup;
    this.maxJumps = char === "brick" ? 1 : 2;
    this.jumpLeft = this.maxJumps;
    this.weapons.push({ id: c.weapon, level: 1, cd: 0 });
    this.mesh = makeDude(PALETTE[char]);
    scene.add(this.mesh);
  }

  get speed(): number {
    const stacks = this.tomes.boots ?? 0;
    return this.baseSpeed * (1 + stacks * 0.11);
  }

  get pickup(): number {
    const magnet = 1 + (this.tomes.magnet ?? 0) * 0.28;
    const coil = this.items.has("coil") ? 2.1 : 1;
    return 3.4 * this.pickupMul * magnet * coil;
  }

  update(dt: number, input: Input, world: World): void {
    if (!this.alive) return;
    const mouse = input.pullMouse();
    this.camYaw -= mouse.x * 0.0024;
    this.camPitch = clamp(this.camPitch - mouse.y * 0.0022, 0.12, 1.15);

    this.iframe = Math.max(0, this.iframe - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.slideCd = Math.max(0, this.slideCd - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    const wish = input.axis();
    const cy = Math.cos(this.camYaw);
    const sy = Math.sin(this.camYaw);
    const fx = sy * wish.z + cy * wish.x;
    const fz = cy * wish.z - sy * wish.x;

    if (this.slideT > 0) {
      this.slideT -= dt;
      const sp = 17;
      this.vx = Math.sin(this.yaw) * sp;
      this.vz = Math.cos(this.yaw) * sp;
    } else {
      const accel = this.grounded ? 48 : 18;
      this.vx += fx * accel * dt;
      this.vz += fz * accel * dt;
      const damp = this.grounded ? 10 : 2.2;
      this.vx *= Math.exp(-damp * dt);
      this.vz *= Math.exp(-damp * dt);
      const cap = this.speed;
      const m = Math.hypot(this.vx, this.vz);
      if (m > cap) {
        this.vx = (this.vx / m) * cap;
        this.vz = (this.vz / m) * cap;
      }
      if (fx !== 0 || fz !== 0) this.yaw = Math.atan2(fx, fz);
    }

    if (input.consume("Space")) {
      if (this.grounded || this.jumpLeft > 0) {
        this.vy = this.grounded ? 9.4 : 8.2;
        this.grounded = false;
        this.jumpLeft -= 1;
      }
    }
    if (input.consume("ShiftLeft") || input.consume("ShiftRight")) {
      if (this.slideCd <= 0 && this.grounded) {
        this.slideT = 0.38;
        this.slideCd = 1.05;
        this.invuln = 0.22;
      }
    }

    this.vy -= 26 * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y += this.vy * dt;

    const pushed = world.resolve(this.x, this.z, 0.42);
    this.x = pushed.x;
    this.z = pushed.z;

    const floor = terrainHeight(this.x, this.z);
    if (this.y <= floor) {
      this.y = floor;
      this.vy = 0;
      this.grounded = true;
      this.jumpLeft = this.maxJumps;
    } else {
      this.grounded = false;
    }

    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.yaw;
    const spd = Math.hypot(this.vx, this.vz);
    const swing = Math.sin(performance.now() * 0.012 * (1 + spd * 0.08)) * Math.min(spd, 8) * 0.06;
    const armL = this.mesh.getObjectByName("armL");
    const armR = this.mesh.getObjectByName("armR");
    const legL = this.mesh.getObjectByName("legL");
    const legR = this.mesh.getObjectByName("legR");
    if (armL) armL.rotation.x = swing;
    if (armR) armR.rotation.x = -swing;
    if (legL) legL.rotation.x = -swing;
    if (legR) legR.rotation.x = swing;
    this.mesh.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) {
        o.material.emissive.setHex(this.hitFlash > 0 ? 0x661010 : 0x000000);
      }
    });
  }

  camera(cam: THREE.PerspectiveCamera, shake: number): void {
    const edge = Math.hypot(this.x, this.z);
    const dist = edge > 72 ? 6.4 : 10.4;
    const lookY = this.y + 1.45;
    const ox = Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const oy = Math.sin(this.camPitch) * dist + 1.2;
    const oz = Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    cam.position.set(
      this.x + ox + (Math.random() - 0.5) * shake,
      this.y + oy,
      this.z + oz + (Math.random() - 0.5) * shake,
    );
    cam.lookAt(this.x, lookY, this.z);
  }

  hurt(raw: number): number {
    if (this.invuln > 0 || this.iframe > 0 || !this.alive) return 0;
    const taken = raw * (1 - clamp(this.armor, 0, 0.62));
    this.hp -= taken;
    this.iframe = 0.72;
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return taken;
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }
}
