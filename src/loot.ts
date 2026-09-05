import * as THREE from "three";
import { terrainHeight } from "./core";
import type { Player } from "./player";

type Gem = {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  value: number;
  gold: boolean;
};

const MAX = 280;
const xpC = new THREE.Color(0x7dffc3);
const goldC = new THREE.Color(0xffcc33);

export class Loot {
  private gems: Gem[] = [];
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.OctahedronGeometry(0.22);
    const mat = new THREE.MeshLambertMaterial({ color: 0x7dffc3 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    for (let i = 0; i < MAX; i++) {
      this.gems.push({
        alive: false,
        x: 0,
        y: 0,
        z: 0,
        value: 1,
        gold: false,
      });
    }
    this.sync(true);
  }

  drop(x: number, z: number, y: number, xp: number, gold: number): void {
    if (xp > 0) this.take(x + (Math.random() - 0.5) * 0.6, z, y, xp, false);
    if (gold > 0) this.take(x + 0.4, z + 0.3, y, gold, true);
  }

  private take(x: number, z: number, y: number, value: number, gold: boolean): void {
    for (const g of this.gems) {
      if (g.alive) continue;
      g.alive = true;
      g.x = x;
      g.z = z;
      g.y = Math.max(y, terrainHeight(x, z)) + 0.35;
      g.value = value;
      g.gold = gold;
      return;
    }
    for (const g of this.gems) {
      if (!g.gold && !gold) {
        g.value += value;
        return;
      }
    }
  }

  update(dt: number, player: Player, onXp: (n: number) => void, onGold: (n: number) => void): boolean {
    let got = false;
    let dirty = false;
    const magnet = player.pickup;
    for (const g of this.gems) {
      if (!g.alive) continue;
      const dx = player.x - g.x;
      const dz = player.z - g.z;
      const d = Math.hypot(dx, dz);
      if (d < magnet) {
        const pull = 18 * dt;
        g.x += (dx / (d || 1)) * pull;
        g.z += (dz / (d || 1)) * pull;
        g.y = terrainHeight(g.x, g.z) + 0.4 + Math.sin(performance.now() * 0.01) * 0.1;
      }
      if (d < 0.85) {
        g.alive = false;
        if (g.gold) onGold(g.value);
        else onXp(g.value);
        got = true;
        dirty = true;
        continue;
      }
      dirty = true;
    }
    if (dirty) this.sync();
    return got;
  }

  private sync(force = false): void {
    for (let i = 0; i < MAX; i++) {
      const g = this.gems[i];
      if (!g.alive) {
        this.dummy.position.set(0, -40, 0);
        this.dummy.scale.setScalar(0.0001);
      } else {
        this.dummy.position.set(g.x, g.y, g.z);
        this.dummy.scale.setScalar(g.gold ? 0.7 : 1);
        this.dummy.rotation.y = i;
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, g.gold ? goldC : xpC);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    void force;
  }
}
