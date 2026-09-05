import * as THREE from "three";
import { AudioBus } from "./audio";
import { Combat } from "./combat";
import {
  RUN_SECONDS,
  chance,
  loadMeta,
  pick,
  rollRarity,
    saveMeta,
    type Meta,
  } from "./core";
import { EnemySystem } from "./enemies";
import { Input } from "./input";
import { Loot } from "./loot";
import { Player } from "./player";
import { UI } from "./ui";
import {
  CHARACTERS,
  ITEMS,
  TOMES,
  WEAPONS,
  randomItem,
  xpToNext,
  type CharId,
  type ItemId,
  type Offer,
  type TomeId,
  type WeaponId,
} from "./upgrades";
import { World } from "./world";

type Mode = "menu" | "play" | "levelup" | "shop" | "pause" | "results";

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private input: Input;
  private audio = new AudioBus();
  private world: World;
  private enemies: EnemySystem;
  private combat: Combat;
  private loot: Loot;
  private ui: UI;
  private player: Player | null = null;
  private mode: Mode = "menu";
  private time = 0;
  private shake = 0;
  private meta: Meta = loadMeta();
  private shopStock: Offer[] = [];
  private levelOffers: Offer[] = [];
  private canvas: HTMLCanvasElement;
  private lastStamp = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.15));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 140);
    this.input = new Input(canvas);
    this.scene.background = new THREE.Color(0x87b5d4);
    this.scene.fog = new THREE.Fog(0x9ec4d4, 58, 130);
    this.scene.add(new THREE.HemisphereLight(0xd8ecff, 0x3d6b45, 1.25));
    const sun = new THREE.DirectionalLight(0xfff1c8, 1.05);
    sun.position.set(30, 48, 12);
    this.scene.add(sun);
    this.world = new World(this.scene);
    this.enemies = new EnemySystem(this.scene);
    this.combat = new Combat(this.scene);
    this.loot = new Loot(this.scene);
    this.ui = new UI(
      (id) => this.start(id),
      (o) => this.pickOffer(o),
      (o) => this.buy(o),
      () => this.resume(),
      () => this.quitToMenu(),
    );
    this.ui.paintMenu(this.meta);
    (window as unknown as { megabonk: Game }).megabonk = this;
    window.addEventListener("resize", () => this.resize());
    canvas.addEventListener("click", () => {
      if (this.mode === "play") {
        try {
          this.input.lock();
        } catch {
          /* pointer lock is optional */
        }
      }
    });
    const pump = (): void => {
      this.step();
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
    window.setInterval(() => {
      if (performance.now() - this.lastStamp > 40) this.step();
    }, 16);
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  private started = false;

  private wipeSceneActors(): void {
    if (this.player) this.scene.remove(this.player.mesh);
    this.player = null;
    if (this.enemies.miniboss) {
      this.scene.remove(this.enemies.miniboss);
      this.enemies.miniboss = null;
    }
    if (this.enemies.boss) {
      this.scene.remove(this.enemies.boss);
      this.enemies.boss = null;
    }
    this.scene.remove(this.world.group);
    this.combat.dispose();
    for (const c of [...this.scene.children]) {
      if (c instanceof THREE.InstancedMesh || c instanceof THREE.LineSegments) {
        this.scene.remove(c);
      }
    }
    this.world = new World(this.scene);
    this.enemies = new EnemySystem(this.scene);
    this.combat = new Combat(this.scene);
    this.loot = new Loot(this.scene);
  }

  private start(id: CharId): void {
    this.audio.resume();
    if (this.started) this.wipeSceneActors();
    this.started = true;
    this.player = new Player(this.scene, id);
    this.player.invuln = 2.2;
    this.time = 0;
    this.mode = "play";
    this.ui.showPlay();
    try {
      this.input.lock();
    } catch {
      /* pointer lock is optional */
    }
    this.ui.toast(`${CHARACTERS[id].name} hits the field`);
  }

  private end(win: boolean): void {
    if (!this.player) return;
    this.mode = "results";
    this.input.unlock();
    this.meta.kills += this.player.kills;
    this.meta.runs += 1;
    this.meta.bestTime = Math.max(this.meta.bestTime, this.time);
    this.meta.bestLevel = Math.max(this.meta.bestLevel, this.player.level);
    if (this.meta.kills >= 250) this.meta.zipper = true;
    if (this.meta.bestTime >= 300) this.meta.brick = true;
    saveMeta(this.meta);
    this.ui.showResults(win, this.player, this.time);
    this.ui.paintMenu(this.meta);
    if (win) this.audio.win();
    else this.audio.dead();
  }

  private quitToMenu(): void {
    this.mode = "menu";
    this.input.unlock();
    this.ui.hidePause();
    this.ui.hud.hidden = true;
    this.ui.menu.hidden = false;
    this.ui.paintMenu(this.meta);
  }

  private resume(): void {
    this.mode = "play";
    this.ui.hidePause();
    this.input.lock();
  }

  private addXp(n: number): void {
    const p = this.player;
    if (!p) return;
    p.xp += n * p.xpMul;
    while (p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level += 1;
      p.pendingLevels += 1;
    }
    if (p.pendingLevels > 0 && this.mode === "play") this.openLevelup();
  }

  private openLevelup(): void {
    const p = this.player;
    if (!p) return;
    this.mode = "levelup";
    this.input.unlock();
    this.levelOffers = this.rollOffers(3);
    this.ui.showLevelup(this.levelOffers);
    this.audio.level();
  }

  private rollOffers(n: number): Offer[] {
    const p = this.player!;
    const out: Offer[] = [];
    const used = new Set<string>();
    let guard = 0;
    while (out.length < n && guard++ < 40) {
      const rarity = rollRarity(p.luck);
      const kindRoll = Math.random();
      let offer: Offer | null = null;
      if (kindRoll < 0.38 && p.weapons.length < 4) {
        const pool = (Object.keys(WEAPONS) as WeaponId[]).filter(
          (id) => !p.weapons.some((w) => w.id === id),
        );
        if (pool.length) {
          const id = pick(pool);
          offer = {
            kind: "weapon",
            id,
            name: WEAPONS[id].name,
            desc: `New weapon. ${WEAPONS[id].desc}`,
            rarity: rarity === "common" ? "rare" : rarity,
          };
        }
      }
      if (!offer && kindRoll < 0.72) {
        const owned = p.weapons.filter((w) => w.level < 8);
        if (owned.length) {
          const w = pick(owned);
          offer = {
            kind: "weapon",
            id: w.id,
            name: `${WEAPONS[w.id].name} +`,
            desc: `Level ${w.level} → ${w.level + 1}. Meaner.`,
            rarity,
          };
        }
      }
      if (!offer) {
        const pool = (Object.keys(TOMES) as TomeId[]).filter(
          (id) => (p.tomes[id] ?? 0) < TOMES[id].max,
        );
        if (pool.length) {
          const id = pick(pool);
          offer = {
            kind: "tome",
            id,
            name: TOMES[id].name,
            desc: `${TOMES[id].desc}  (${(p.tomes[id] ?? 0) + 1}/${TOMES[id].max})`,
            rarity,
          };
        }
      }
      if (offer && !used.has(offer.kind + offer.id + offer.name)) {
        used.add(offer.kind + offer.id + offer.name);
        out.push(offer);
      }
    }
    return out;
  }

  private applyOffer(o: Offer): void {
    const p = this.player!;
    if (o.kind === "weapon") {
      const id = o.id as WeaponId;
      const have = p.weapons.find((w) => w.id === id);
      if (have) have.level = Math.min(8, have.level + 1);
      else p.weapons.push({ id, level: 1, cd: 0 });
    } else if (o.kind === "tome") {
      const id = o.id as TomeId;
      p.tomes[id] = (p.tomes[id] ?? 0) + 1;
      this.recalc(p);
    } else {
      this.grantItem(o.id as ItemId);
    }
  }

  private recalc(p: Player): void {
    p.dmgMul =
      (1 + (p.tomes.might ?? 0) * 0.18) *
      (p.items.has("spicy") ? 1.3 : 1) *
      (p.items.has("glass") ? 1.55 : 1);
    p.haste = 1 + (p.tomes.haste ?? 0) * 0.14;
    p.area = 1 + (p.tomes.bulk ?? 0) * 0.14;
    p.qtyBonus = p.tomes.swarm ?? 0;
    p.xpMul = 1 + (p.tomes.scholar ?? 0) * 0.18;
    p.luck = (p.tomes.luck ?? 0) * 12 + (p.items.has("clover") ? 25 : 0);
    p.armor = (p.tomes.iron ?? 0) * 0.08;
    p.crit = 0.06 + (p.tomes.fury ?? 0) * 0.08;
    p.regen = 0.08 + (p.tomes.regen ?? 0) * 0.45;
    const vit = (p.tomes.vitality ?? 0) * 28 + (p.items.has("heart") ? 40 : 0);
    const glass = p.items.has("glass") ? 0.8 : 1;
    const base = CHARACTERS[p.char].hp;
    const next = Math.floor((base + vit) * glass);
    if (next > p.maxHp) p.hp += next - p.maxHp;
    p.maxHp = next;
    p.maxJumps = (p.char === "brick" ? 1 : 2) + (p.items.has("wings") ? 1 : 0);
  }

  private grantItem(id: ItemId): void {
    const p = this.player!;
    p.items.add(id);
    if (id === "heart") {
      p.maxHp += 40;
      p.hp = p.maxHp;
    }
    this.recalc(p);
    this.ui.toast(ITEMS[id].name);
  }

  private pickOffer(o: Offer): void {
    this.applyOffer(o);
    const p = this.player!;
    p.pendingLevels = Math.max(0, p.pendingLevels - 1);
    this.ui.hideLevelup();
    if (p.pendingLevels > 0) this.openLevelup();
    else {
      this.mode = "play";
      this.input.lock();
    }
  }

  private openShop(): void {
    this.mode = "shop";
    this.input.unlock();
    this.shopStock = this.rollShop();
    this.ui.showShop(this.shopStock, this.player!.gold);
    this.audio.shop();
  }

  private rollShop(): Offer[] {
    const p = this.player!;
    const out: Offer[] = [];
    for (let i = 0; i < 3; i++) {
      const item = randomItem(p.items);
      if (!item) continue;
      const price = item.rarity === "legendary" ? 90 : item.rarity === "epic" ? 65 : 40;
      out.push({
        kind: "item",
        id: item.id,
        name: item.name,
        desc: item.desc,
        rarity: item.rarity,
        price,
      });
    }
    return out;
  }

  private buy(o: Offer): void {
    const p = this.player!;
    if (p.gold < (o.price ?? 0)) {
      this.ui.toast("too broke");
      return;
    }
    p.gold -= o.price ?? 0;
    this.applyOffer(o);
    this.shopStock = this.shopStock.filter((s) => s !== o);
    this.ui.showShop(this.shopStock, p.gold);
  }

  private interact(): void {
    const p = this.player;
    if (!p) return;
    const l = this.world.nearestOpen(p.x, p.z);
    if (!l) return;
    if (l.kind === "shop") {
      this.openShop();
      return;
    }
    if (l.kind === "chest") {
      l.used = true;
      const item = randomItem(p.items);
      if (item) this.grantItem(item.id);
      else {
        const w = pick(p.weapons);
        w.level = Math.min(8, w.level + 1);
        this.ui.toast(`${WEAPONS[w.id].name} grew`);
      }
      this.audio.gold();
    }
    if (l.kind === "shrine") {
      l.used = true;
      p.hurt(p.maxHp * 0.18);
      const id = pick(Object.keys(TOMES) as TomeId[]);
      p.tomes[id] = (p.tomes[id] ?? 0) + 1;
      this.recalc(p);
      this.ui.toast(`shrine: ${TOMES[id].name}`);
      this.audio.level();
    }
    if (l.kind === "greed") {
      l.used = true;
      for (let i = 0; i < 10; i++) this.enemies.spawnAround(p.x, p.z, this.time + 200);
      p.gold += 25;
      this.ui.toast("greed cone: gold + a problem");
    }
  }

  private step = (): void => {
    const now = performance.now();
    let acc = Math.min((now - this.lastStamp) / 1000, 0.22);
    this.lastStamp = now;
    while (acc > 0) {
      const dt = Math.min(acc, 1 / 30);
      acc -= dt;
      this.ui.tick(dt);
      this.shake = Math.max(0, this.shake - dt * 2.4);
      this.world.pulse(this.time);
      if (this.mode === "play" && this.player) {
        this.tickPlay(dt);
      } else if (this.mode === "levelup") {
        if (this.input.consume("Digit1") && this.levelOffers[0]) this.pickOffer(this.levelOffers[0]);
        if (this.input.consume("Digit2") && this.levelOffers[1]) this.pickOffer(this.levelOffers[1]);
        if (this.input.consume("Digit3") && this.levelOffers[2]) this.pickOffer(this.levelOffers[2]);
      } else if (this.mode === "shop") {
        if (this.input.consume("Escape")) {
          this.ui.hideShop();
          this.mode = "play";
          this.input.lock();
        }
      } else if (this.mode === "pause") {
        if (this.input.consume("Escape")) this.resume();
      }
    }

    const p = this.player;
    if (p) {
      p.camera(this.camera, this.shake);
      this.ui.syncHud(p, this.time, this.world, this.enemies);
    } else {
      this.camera.position.set(18, 16, 22);
      this.camera.lookAt(0, 1, 0);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private tickPlay(dt: number): void {
    const p = this.player!;
    if (this.input.consume("Escape")) {
      this.mode = "pause";
      this.input.unlock();
      this.ui.showPause();
      return;
    }
    if (this.input.consume("KeyE")) this.interact();

    this.time += dt;
    p.update(dt, this.input, this.world);
    if (p.slideT > 0.3 && p.slideT - dt <= 0.3) this.audio.slide();
    this.enemies.update(dt, p, this.world, this.time);
    this.combat.fire(
      p,
      this.enemies,
      dt,
      (x, y, z, t, k) => this.float(x, y, z, t, k),
      this.audio,
      (xp, gold, x, z, y) => this.kill(xp, gold, x, z, y),
      (n) => {
        this.shake = Math.max(this.shake, n);
      },
    );
    this.combat.update(
      dt,
      p,
      this.enemies,
      (x, y, z, t, k) => this.float(x, y, z, t, k),
      this.audio,
      (xp, gold, x, z, y) => this.kill(xp, gold, x, z, y),
      (n) => {
        this.shake = Math.max(this.shake, n);
      },
    );
    this.loot.update(
      dt,
      p,
      (n) => this.addXp(n),
      (n) => {
        p.gold += Math.floor(n * (p.items.has("golden") ? 1.5 : 1));
        this.audio.gold();
      },
    );

    const touch = this.enemies.contactPlayer(p);
    if (touch.dmg > 0) {
      const taken = p.hurt(touch.dmg);
      if (taken > 0) {
        this.audio.hurt();
        this.float(p.x, p.y + 1.6, p.z, `-${Math.ceil(taken)}`, "hurt");
        if (p.items.has("thorns")) {
          const bounce = taken * 0.25;
          for (let i = 0; i < this.enemies.slots.length; i++) {
            const s = this.enemies.slots[i];
            if (!s.alive) continue;
            if (Math.hypot(s.x - p.x, s.z - p.z) > s.r + 0.7) continue;
            const res = this.enemies.damage(i, bounce, p.x, p.z);
            if (res?.killed) {
              this.kill(res.slot.xp, res.slot.gold, res.slot.x, res.slot.z, res.slot.y);
            }
          }
        }
      }
    }

    this.audio.tickMusic(this.time, Math.min(1, this.time / RUN_SECONDS));

    if (this.time >= 180 && this.time < 181) this.ui.toast("a yellow bully arrived");
    if (this.time >= 390 && this.time < 391) this.ui.toast("another bully. rude.");
    if (this.time >= 600 && this.time < 601) this.ui.toast("THE BIG ONE");

    if (!p.alive) this.end(false);
    if (this.enemies.spawnedBoss && !this.enemies.boss && p.alive) this.end(true);
  }

  private kill(xp: number, gold: number, x: number, z: number, y: number): void {
    const p = this.player;
    if (!p) return;
    p.kills += 1;
    const g = gold + (chance(0.18) ? 1 : 0);
    this.loot.drop(x, z, y, xp, g * (p.items.has("golden") ? 1 : 1));
    if (p.kills % 40 === 0) {
      this.ui.slamBonk();
      this.shake = 0.45;
      this.audio.crit();
    }
  }

  private float(
    x: number,
    y: number,
    z: number,
    text: string,
    kind: "dmg" | "hp" | "hurt" = "dmg",
  ): void {
    this.ui.floater(this.canvas, this.camera, x, y, z, text, kind);
  }
}
