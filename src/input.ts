export class Input {
  readonly keys = new Set<string>();
  mx = 0;
  my = 0;
  locked = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (["Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mx += e.movementX;
      this.my += e.movementY;
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  consume(code: string): boolean {
    if (!this.keys.has(code)) return false;
    this.keys.delete(code);
    return true;
  }

  axis(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.down("KeyA") || this.down("ArrowLeft")) x -= 1;
    if (this.down("KeyD") || this.down("ArrowRight")) x += 1;
    if (this.down("KeyW") || this.down("ArrowUp")) z -= 1;
    if (this.down("KeyS") || this.down("ArrowDown")) z += 1;
    const m = Math.hypot(x, z);
    if (m > 0) {
      x /= m;
      z /= m;
    }
    return { x, z };
  }

  pullMouse(): { x: number; y: number } {
    const x = this.mx;
    const y = this.my;
    this.mx = 0;
    this.my = 0;
    return { x, y };
  }

  lock(): void {
    try {
      void this.canvas.requestPointerLock();
    } catch {
      /* some browsers refuse pointer lock */
    }
  }

  unlock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
