import * as THREE from "three";
import { ARENA, rand, terrainHeight } from "./core";

export type Prop = { x: number; z: number; r: number };
export type Landmark = {
  kind: "chest" | "shrine" | "shop" | "greed";
  x: number;
  z: number;
  used: boolean;
};

export class World {
  readonly group = new THREE.Group();
  readonly blockers: Prop[] = [];
  readonly landmarks: Landmark[] = [];
  private shopGlow: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.buildGround();
    this.scatter();
  }

  private buildGround(): void {
    const geo = new THREE.PlaneGeometry(ARENA * 2.2, ARENA * 2.2, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < 0.25) c.set(0x3f8a52);
      else if (y < 1.6) c.set(0x4f9a5c);
      else c.set(0xd8c48a);
      if (Math.hypot(pos.getX(i), pos.getZ(i)) > ARENA - 2) c.set(0x5a4630);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(geo, mat);
    this.group.add(ground);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA, 1.1, 6, 48),
      new THREE.MeshLambertMaterial({ color: 0x5a3a22 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.4;
    this.group.add(rim);
  }

  private tree(x: number, z: number): void {
    const y = terrainHeight(x, z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.38, 1.6, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a3a22 }),
    );
    trunk.position.set(x, y + 0.8, z);
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 2.1, 7),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(0.33 + rand(-0.03, 0.03), 0.62, 0.28),
      }),
    );
    hat.position.set(x, y + 2.2, z);
    this.group.add(trunk, hat);
    this.blockers.push({ x, z, r: 0.7 });
  }

  private rock(x: number, z: number): void {
    const y = terrainHeight(x, z);
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rand(0.5, 1.1), 0),
      new THREE.MeshLambertMaterial({ color: 0x6d6a63 }),
    );
    mesh.position.set(x, y + 0.4, z);
    mesh.rotation.set(rand(0, 1), rand(0, 3), rand(0, 1));
    this.group.add(mesh);
    this.blockers.push({ x, z, r: 0.55 });
  }

  private mushroom(x: number, z: number): void {
    const y = terrainHeight(x, z);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.5, 6),
      new THREE.MeshLambertMaterial({ color: 0xe8d5a3 }),
    );
    stem.position.set(x, y + 0.25, z);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x7b3fa0 }),
    );
    cap.position.set(x, y + 0.5, z);
    this.group.add(stem, cap);
  }

  private mark(
    kind: Landmark["kind"],
    x: number,
    z: number,
    mesh: THREE.Object3D,
  ): void {
    mesh.position.set(x, terrainHeight(x, z), z);
    this.group.add(mesh);
    this.landmarks.push({ kind, x, z, used: false });
  }

  private scatter(): void {
    for (let i = 0; i < 38; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(16, ARENA - 6);
      this.tree(Math.cos(a) * d, Math.sin(a) * d);
    }
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(10, ARENA - 5);
      this.rock(Math.cos(a) * d, Math.sin(a) * d);
    }
    for (let i = 0; i < 16; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(8, 40);
      this.mushroom(Math.cos(a) * d, Math.sin(a) * d);
    }

    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.7, 0.75),
      new THREE.MeshLambertMaterial({ color: 0x8a5a18 }),
    );
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.18, 0.8),
      new THREE.MeshLambertMaterial({ color: 0xffcc33 }),
    );
    lid.position.y = 0.48;
    const chestG = new THREE.Group();
    chest.position.y = 0.4;
    chestG.add(chest, lid);
    this.mark("chest", 18, -12, chestG);

    const chest2 = chestG.clone();
    this.mark("chest", -22, 16, chest2);

    const shrine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.1, 0.35, 8),
      new THREE.MeshLambertMaterial({ color: 0x7b3fa0 }),
    );
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7),
      new THREE.MeshLambertMaterial({ color: 0xc97bff, emissive: 0x4a2066 }),
    );
    crystal.position.y = 1.2;
    const sg = new THREE.Group();
    shrine.position.y = 0.2;
    sg.add(shrine, crystal);
    this.mark("shrine", -14, -20, sg);

    const greed = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 1.6, 5),
      new THREE.MeshLambertMaterial({ color: 0xe23d3d, emissive: 0x4a1010 }),
    );
    greed.position.y = 0.9;
    this.mark("greed", 24, 20, greed);

    const tent = new THREE.Group();
    const cloth = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 2.2, 4),
      new THREE.MeshLambertMaterial({ color: 0xc43b3b }),
    );
    cloth.position.y = 1.8;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.2, 5),
      new THREE.MeshLambertMaterial({ color: 0x3a2a18 }),
    );
    pole.position.y = 1.1;
    tent.add(cloth, pole);
    this.mark("shop", 6, 26, tent);
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.75, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffcc33,
        side: THREE.DoubleSide,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    this.shopGlow = glow;
    tent.add(glow);
  }

  resolve(x: number, z: number, r: number): { x: number; z: number } {
    let px = x;
    let pz = z;
    for (const b of this.blockers) {
      const dx = px - b.x;
      const dz = pz - b.z;
      const d = Math.hypot(dx, dz);
      const min = r + b.r;
      if (d < min && d > 0.0001) {
        const s = (min - d) / d;
        px += dx * s;
        pz += dz * s;
      }
    }
    const m = Math.hypot(px, pz);
    if (m > ARENA - 1.2) {
      const s = (ARENA - 1.2) / m;
      px *= s;
      pz *= s;
    }
    return { x: px, z: pz };
  }

  nearestOpen(px: number, pz: number): Landmark | null {
    let best: Landmark | null = null;
    let bestD = 2.6;
    for (const l of this.landmarks) {
      if (l.used && l.kind !== "shop") continue;
      const d = Math.hypot(l.x - px, l.z - pz);
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  }

  pulse(t: number): void {
    if (this.shopGlow) {
      const s = 1 + Math.sin(t * 3) * 0.08;
      this.shopGlow.scale.set(s, s, 1);
    }
  }
}

export function makeDude(palette: {
  body: number;
  head: number;
  limb: number;
}): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.85, 0.45),
    new THREE.MeshLambertMaterial({ color: palette.body }),
  );
  body.position.y = 0.95;
  body.name = "body";
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: palette.head }),
  );
  head.position.y = 1.62;
  const eyeL = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x140e18 }),
  );
  eyeL.position.set(-0.12, 1.66, 0.26);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.12;
  const armL = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.62, 0.18),
    new THREE.MeshLambertMaterial({ color: palette.limb }),
  );
  armL.position.set(-0.48, 0.95, 0);
  armL.name = "armL";
  const armR = armL.clone();
  armR.position.x = 0.48;
  armR.name = "armR";
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.55, 0.24),
    new THREE.MeshLambertMaterial({ color: palette.limb }),
  );
  legL.position.set(-0.18, 0.28, 0);
  legL.name = "legL";
  const legR = legL.clone();
  legR.position.x = 0.18;
  legR.name = "legR";
  g.add(body, head, eyeL, eyeR, armL, armR, legL, legR);
  return g;
}
