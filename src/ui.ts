import * as THREE from "three";
import { formatTime, type Meta } from "./core";
import {
  CHARACTERS,
  ITEMS,
  WEAPONS,
  type CharId,
  type Offer,
} from "./upgrades";
import type { Player } from "./player";
import type { World } from "./world";
import type { EnemySystem } from "./enemies";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class UI {
  menu = $("menu");
  hud = $("hud");
  levelup = $("levelup");
  shop = $("shop");
  pause = $("pause");
  results = $("results");
  cards = $("cards");
  shopCards = $("shop-cards");
  toastEl = $("toast");
  slam = $("bonk-slam");
  hint = $("interact-hint");
  floaters = $("floaters");
  minimap = $("minimap") as HTMLCanvasElement;
  mmap = this.minimap.getContext("2d")!;
  selected: CharId = "bonklet";
  private toastT = 0;

  constructor(
    private onStart: (id: CharId) => void,
    private onPick: (offer: Offer) => void,
    private onBuy: (offer: Offer) => void,
    private onResume: () => void,
    private onQuit: () => void,
  ) {
    $("start-btn").onclick = () => this.onStart(this.selected);
    $("resume-btn").onclick = () => this.onResume();
    $("quit-btn").onclick = () => this.onQuit();
    $("again-btn").onclick = () => {
      this.results.hidden = true;
      this.menu.hidden = false;
    };
  }

  paintMenu(meta: Meta): void {
    $("best-time").textContent = formatTime(meta.bestTime);
    $("life-kills").textContent = String(meta.kills);
    $("runs").textContent = String(meta.runs);
    const zipperOn = meta.kills >= 250 || meta.zipper;
    const brickOn = meta.bestTime >= 300 || meta.brick;
    const root = $("chars");
    root.innerHTML = "";
    (["bonklet", "zipper", "brick"] as CharId[]).forEach((id) => {
      const c = CHARACTERS[id];
      const locked =
        (id === "zipper" && !zipperOn) || (id === "brick" && !brickOn);
      const b = document.createElement("button");
      b.className = `char${this.selected === id ? " sel" : ""}`;
      b.disabled = locked;
      b.innerHTML = `${c.name}<small>${locked ? this.lockText(id) : c.weapon}</small>`;
      b.onclick = () => {
        this.selected = id;
        this.paintMenu(meta);
      };
      root.appendChild(b);
    });
    $("char-blurb").textContent = CHARACTERS[this.selected].blurb;
    $("start-btn").toggleAttribute("disabled", false);
    $("quests").innerHTML = `
      <li class="${zipperOn ? "done" : ""}">${zipperOn ? "✓" : "○"} 250 lifetime kills — unlock Zipper</li>
      <li class="${brickOn ? "done" : ""}">${brickOn ? "✓" : "○"} survive 5:00 — unlock Brick</li>
    `;
  }

  private lockText(id: CharId): string {
    return id === "zipper" ? "250 kills" : "survive 5:00";
  }

  showPlay(): void {
    this.menu.hidden = true;
    this.results.hidden = true;
    this.pause.hidden = true;
    this.levelup.hidden = true;
    this.shop.hidden = true;
    this.hud.hidden = false;
  }

  showLevelup(offers: Offer[]): void {
    this.levelup.hidden = false;
    this.cards.innerHTML = "";
    offers.forEach((o, i) => this.cards.appendChild(this.card(o, i, () => this.onPick(o))));
  }

  hideLevelup(): void {
    this.levelup.hidden = true;
  }

  showShop(offers: Offer[], gold: number): void {
    this.shop.hidden = false;
    this.shopCards.innerHTML = "";
    offers.forEach((o) => {
      const el = this.card(o, -1, () => this.onBuy(o));
      if ((o.price ?? 0) > gold) el.style.opacity = "0.45";
      this.shopCards.appendChild(el);
    });
  }

  hideShop(): void {
    this.shop.hidden = true;
  }

  showPause(): void {
    this.pause.hidden = false;
  }

  hidePause(): void {
    this.pause.hidden = true;
  }

  showResults(win: boolean, p: Player, time: number): void {
    this.hud.hidden = true;
    this.results.hidden = false;
    $("result-eyebrow").textContent = win ? "the field is quiet" : "you are jam";
    $("result-title").textContent = win ? "BONKED THE BOSS" : "SPLATTED";
    $("result-stats").innerHTML = `
      <div>time <b>${formatTime(time)}</b></div>
      <div>level <b>${p.level}</b></div>
      <div>kills <b>${p.kills}</b></div>
      <div>gold <b>${p.gold}</b></div>
      <div>weapons <b>${p.weapons.map((w) => WEAPONS[w.id].name).join(", ")}</b></div>
      <div>items <b>${[...p.items].map((i) => ITEMS[i].name).join(", ") || "none"}</b></div>
    `;
  }

  private card(o: Offer, index: number, click: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = `card ${o.rarity}`;
    b.innerHTML = `
      <div class="rarity">${index >= 0 ? index + 1 + " · " : ""}${o.rarity}</div>
      <h3>${o.name}</h3>
      <p>${o.desc}</p>
      ${o.price != null ? `<div class="price">${o.price} gold</div>` : ""}
    `;
    b.onclick = click;
    return b;
  }

  toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("show");
    this.toastT = 1.8;
  }

  slamBonk(): void {
    this.slam.classList.remove("go");
    void this.slam.offsetWidth;
    this.slam.classList.add("go");
  }

  floater(
    canvas: HTMLCanvasElement,
    camera: import("three").Camera,
    x: number,
    y: number,
    z: number,
    text: string,
    kind: "dmg" | "hp" | "hurt" = "dmg",
  ): void {
    const el = document.createElement("div");
    el.className = `floater ${kind === "dmg" ? "" : kind}`.trim();
    el.textContent = text;
    this.floaters.appendChild(el);
    const p = new THREE.Vector3(x, y, z).project(camera);
    el.style.left = `${(p.x * 0.5 + 0.5) * canvas.clientWidth}px`;
    el.style.top = `${(-p.y * 0.5 + 0.5) * canvas.clientHeight}px`;
    setTimeout(() => el.remove(), 720);
  }

  tick(dt: number): void {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove("show");
    }
  }

  syncHud(p: Player, time: number, world: World, enemies: EnemySystem): void {
    const hp = $("hp-fill");
    hp.style.width = `${(p.hp / p.maxHp) * 100}%`;
    $("hp-text").textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    $("clock").textContent = formatTime(time);
    $("kills").textContent = String(p.kills);
    $("gold").textContent = String(p.gold);
    $("level").textContent = String(p.level);
    const need = xpNeed(p.level);
    $("xp-fill").style.width = `${(p.xp / need) * 100}%`;
    $("xp-text").textContent = `${Math.floor(p.xp)} / ${need}`;
    $("wave-tag").textContent =
      time < 60
        ? "WARMUP"
        : time < 180
          ? "THE POUR"
          : time < 390
            ? "CROWDED"
            : time < 600
              ? "UGLY MINUTE"
              : "BOSS";
    $("weapons").innerHTML = p.weapons
      .map(
        (w) =>
          `<div class="weapon-chip"><b>${WEAPONS[w.id].name}</b>Lv ${w.level}</div>`,
      )
      .join("");
    const near = world.nearestOpen(p.x, p.z);
    this.hint.hidden = !near;
    if (near) {
      this.hint.textContent =
        near.kind === "shop"
          ? "E — enter tent"
          : near.kind === "chest"
            ? "E — kick chest"
            : near.kind === "shrine"
              ? "E — bleed for power"
              : "E — poke the red cone";
    }
    this.drawMap(p, world, enemies);
  }

  private drawMap(p: Player, world: World, enemies: EnemySystem): void {
    const ctx = this.mmap;
    const s = this.minimap.width;
    ctx.fillStyle = "#102018";
    ctx.fillRect(0, 0, s, s);
    const map = (x: number, z: number) => [
      ((x + 86) / 172) * s,
      ((z + 86) / 172) * s,
    ];
    ctx.fillStyle = "#c9a227";
    for (const l of world.landmarks) {
      const [mx, mz] = map(l.x, l.z);
      ctx.fillRect(mx - 2, mz - 2, 4, 4);
    }
    ctx.fillStyle = "#e23d3d";
    let n = 0;
    for (const e of enemies.slots) {
      if (!e.alive || n++ > 80) continue;
      const [mx, mz] = map(e.x, e.z);
      ctx.fillRect(mx, mz, 2, 2);
    }
    ctx.fillStyle = "#ffcc33";
    const [px, pz] = map(p.x, p.z);
    ctx.fillRect(px - 3, pz - 3, 6, 6);
  }
}

function xpNeed(level: number): number {
  return Math.floor(10 * level ** 1.32 + 6);
}

