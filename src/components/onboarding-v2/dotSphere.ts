/**
 * The Travel DNA dot sphere from the approved onboarding prototype ("Travel DNA Sphere Transitions"): thousands of small glowing dots are pulled in from
 * all sides, settle onto a slowly spinning sphere from the bottom up, and slosh at the surface of the fill. Dark and light palettes follow the theme.
 * Ported from the prototype's canvas code with the options that were never used there (swarm patterns, continents, restart cycles) left out.
 * The settings are the ones chosen in the prototype: 5,000 dots, dot size 20, sloshiness 0.9, pulled in from the sides, rim clumping 0.8.
 */

type V3 = [number, number, number];

export interface SpherePalette {
  core: V3;
  glow: V3;
}

export const LIGHT_PALETTE: SpherePalette = { core: [28, 104, 150], glow: [58, 150, 205] };
export const DARK_PALETTE: SpherePalette = { core: [212, 248, 240], glow: [95, 225, 205] };

/** The palette for the page's current theme (an explicit choice on the page wins over the device setting). */
export function themePalette(): SpherePalette {
  const th = document.documentElement.getAttribute('data-theme');
  const light = th === 'dark' ? false : th === 'light' ? true : !window.matchMedia('(prefers-color-scheme: dark)').matches;
  return light ? LIGHT_PALETTE : DARK_PALETTE;
}

export interface SphereOptions {
  maxDots?: number;
  /** Percent of the original dot size (the prototype used 20). */
  dotSize?: number;
  sloshiness?: number;
  /** 0 holds the sphere still. */
  spin?: number;
  /** Where the sphere's middle sits from the top of the canvas, 0 to 1. */
  centerY?: number;
}

interface Dot {
  axis: V3;
  suckDir: V3;
  speed: number;
  birth: number;
  seed: number;
  restY: number;
  orbit: number | null;
}

const ENTRY_SECONDS = 0.65;
const CAMERA = 4;

export class DotSphere {
  private dots: Dot[] = [];
  private byRank: Dot[] = [];
  private used = 0;
  private t = 0;
  private spin = 0;
  private raf = 0;
  private last = 0;
  private dpr = 1;
  private still = false;
  palette: SpherePalette;
  private readonly total: number;
  private readonly dotSize: number;
  private readonly sloshiness: number;
  private readonly spinSpeed: number;
  private readonly centerY: number;

  constructor(private readonly canvas: HTMLCanvasElement, opts: SphereOptions = {}) {
    this.total = opts.maxDots ?? 5000;
    this.dotSize = (opts.dotSize ?? 20) / 100;
    this.sloshiness = opts.sloshiness ?? 0.9;
    this.spinSpeed = opts.spin ?? 1;
    this.centerY = opts.centerY ?? 0.5;
    this.palette = themePalette();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.build();
  }

  /** Share of the sphere that has been filled (or is on its way), 0 to 100. */
  get fillPercent(): number {
    return (this.used / this.total) * 100;
  }

  start(): void {
    this.still = this.spinSpeed === 0;
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      if (!this.still) this.t += dt;
      this.draw(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  /** The first `pct` percent of the sphere is there already. */
  instant(pct: number): void {
    const target = Math.min(this.total, Math.round((pct * this.total) / 100));
    for (let i = this.used; i < target; i++) this.byRank[i].birth = -10;
    this.used = Math.max(this.used, target);
  }

  /** `pct` more percent of the sphere arrives, spread over `spread` seconds starting `delay` seconds from now. */
  add(pct: number, spread: number, delay = 0): void {
    const n = Math.min(this.total - this.used, Math.round((pct * this.total) / 100));
    const start = this.t + delay;
    for (let i = 0; i < n; i++) this.byRank[this.used + i].birth = this.still ? -10 : start + (i / Math.max(1, n)) * spread + Math.random() * 0.06;
    this.used += n;
  }

  private build(): void {
    const total = this.total;
    const order = Array.from({ length: total }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const dots: Dot[] = [];
    for (let i = 0; i < total; i++) {
      const rank = order[i];
      // rank 0 lands first and sits at the bottom (y points down here), the last rank sits at the top
      const restY = total > 1 ? Math.max(-0.98, Math.min(0.98, 1 - (rank / (total - 1)) * 2)) : 0;
      // early dots are pulled in from near the bottom of the sphere; as it fills they come from every side
      const fillFrac = total > 1 ? rank / (total - 1) : 1;
      const baseSpread = 0.28;
      const center = restY * (1 - fillFrac);
      const spread = baseSpread + fillFrac * (1 - baseSpread);
      const su = Math.max(-0.98, Math.min(0.98, center + (Math.random() * 2 - 1) * spread));
      const sth = Math.random() * Math.PI * 2;
      const sr = Math.sqrt(1 - su * su);
      const suckDir: V3 = [sr * Math.cos(sth), su, sr * Math.sin(sth)];
      // the orbit axis leans toward vertical (rim clumping 0.8), never to a razor-thin ring
      const au = Math.random() * 2 - 1;
      const ath = Math.random() * Math.PI * 2;
      const ar = Math.sqrt(1 - au * au);
      const f = 0.6;
      const raw: V3 = [ar * Math.cos(ath), ar * Math.sin(ath), au];
      let axis: V3 = [raw[0] * (1 - f), raw[1] * (1 - f) + f, raw[2] * (1 - f)];
      const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
      axis = [axis[0] / len, axis[1] / len, axis[2] / len];
      dots.push({ axis, suckDir, speed: 0.28 * (Math.random() < 0.5 ? 1 : -1), birth: Infinity, seed: Math.random() * 1000, restY, orbit: null });
    }
    this.dots = dots;
    this.byRank = dots.slice().sort((a, b) => b.restY - a.restY);
  }

  private rotate(v: V3, axis: V3, angle: number): V3 {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dot = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
    const cross: V3 = [axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2], axis[0] * v[1] - axis[1] * v[0]];
    return [v[0] * cos + cross[0] * sin + axis[0] * dot * (1 - cos), v[1] * cos + cross[1] * sin + axis[1] * dot * (1 - cos), v[2] * cos + cross[2] * sin + axis[2] * dot * (1 - cos)];
  }

  /** A dot's slightly wobbly outline, so the dots read as soft living specks and not perfect circles. */
  private blob(ctx: CanvasRenderingContext2D, sx: number, sy: number, r: number, seed: number, intensity: number): void {
    const segs = 16;
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const wobble = 1 + intensity * (0.035 * Math.sin(a * 5 + seed + this.t * 2.2) + 0.025 * Math.sin(a * 9 - seed * 1.7 + this.t * 3.6) + 0.02 * Math.sin(a * 13 + seed * 3.3 - this.t * 5.1) + 0.02 * Math.sin(a * 21 + seed * 5.2 + this.t * 8.4));
      const rr = r * wobble;
      const x = sx + Math.cos(a) * rr, y = sy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  private aurora(t: number): V3 {
    const a = [255, 65, 75], b = [70, 140, 255];
    const k = Math.max(0, Math.min(1, t));
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  private draw(dt: number): void {
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = this.dpr;
    const cw = Math.max(1, Math.round(canvas.clientWidth * dpr)), ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const W = canvas.width, H = canvas.height;
    const R = Math.min(canvas.clientWidth * 0.25, 105) * dpr;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * this.centerY;
    this.spin += dt * this.spinSpeed * 0.18;
    const gcos = Math.cos(this.spin), gsin = Math.sin(this.spin);
    const t = this.t;
    const pal = this.palette;

    // the surface of the fill so far: the highest landed dot (y points down, so the smallest restY)
    let surfaceY = 1;
    for (const d of this.dots) {
      if (d.birth > t) continue;
      if (t - d.birth >= ENTRY_SECONDS && d.restY < surfaceY) surfaceY = d.restY;
    }

    const projected: { sx: number; sy: number; viewZ: number; colorAge: number; pop: number; seed: number }[] = [];
    for (const d of this.dots) {
      if (d.birth > t) continue;
      const age = t - d.birth;
      let pos: V3;
      let pop: number;
      let colorAge = 999;
      const anchor = d.suckDir;
      if (age < ENTRY_SECONDS) {
        // pulled in from outside the sphere, slow at first and gathering speed
        const eased = Math.pow(Math.max(0, Math.min(1, age / ENTRY_SECONDS)), 2.4);
        const start: V3 = [d.suckDir[0] * 2.6, d.suckDir[1] * 2.6, d.suckDir[2] * 2.6];
        pos = [start[0] + (anchor[0] - start[0]) * eased, start[1] + (anchor[1] - start[1]) * eased, start[2] + (anchor[2] - start[2]) * eased];
        pop = 0.4 + 0.6 * eased;
      } else {
        const settle = age - ENTRY_SECONDS;
        colorAge = settle;
        if (d.orbit === null) d.orbit = settle * d.speed;
        if (!this.still) d.orbit += dt * d.speed;
        pos = this.rotate(anchor, d.axis, d.orbit);
        // dots near the surface of the fill ripple along the sphere
        const proximity = Math.max(0, 1 - Math.abs(surfaceY - d.restY) / 0.35);
        if (this.sloshiness > 0 && proximity > 0) {
          let t1: V3 = [-pos[2], 0, pos[0]];
          const l1 = Math.hypot(t1[0], t1[1], t1[2]);
          t1 = l1 < 1e-4 ? [1, 0, 0] : [t1[0] / l1, t1[1] / l1, t1[2] / l1];
          const t2: V3 = [pos[1] * t1[2] - pos[2] * t1[1], pos[2] * t1[0] - pos[0] * t1[2], pos[0] * t1[1] - pos[1] * t1[0]];
          const amp = 0.09 * this.sloshiness * proximity;
          const d1 = Math.sin(t * 1.6 + d.seed * 0.3) * amp;
          const d2 = Math.sin(t * 1.3 + d.seed * 0.7 + 2) * amp;
          const np: V3 = [pos[0] + t1[0] * d1 + t2[0] * d2, pos[1] + t1[1] * d1 + t2[1] * d2, pos[2] + t1[2] * d1 + t2[2] * d2];
          const nl = Math.hypot(np[0], np[1], np[2]) || 1;
          pos = [np[0] / nl, np[1] / nl, np[2] / nl];
        }
        pop = 1 + (settle < 0.3 ? Math.sin(Math.PI * (settle / 0.3)) * 0.22 : 0);
      }
      const x = pos[0] * gcos + pos[2] * gsin;
      const z = -pos[0] * gsin + pos[2] * gcos;
      const viewZ = CAMERA - z;
      const scale = CAMERA / viewZ;
      projected.push({ sx: cx + x * scale * R, sy: cy + pos[1] * scale * R, viewZ, colorAge, pop: Math.max(0, pop), seed: d.seed });
    }
    projected.sort((a, b) => b.viewZ - a.viewZ);

    for (const p of projected) {
      const depthT = Math.pow(Math.max(0, Math.min(1, (CAMERA + 1 - p.viewZ) / 2)), 1.8);
      const twinkle = 0.82 + 0.18 * Math.sin(t * 2.4 + p.seed) * Math.sin(t * 1.1 + p.seed * 0.7);
      let opacity = 0.12 + depthT * 0.75;
      const radius = (1.0 + depthT * 3.8 * this.dotSize) * dpr * p.pop;
      const glow = radius * (1.5 + depthT * 1.1);
      const haloOpacity = opacity * 0.85 * twinkle;
      let core: V3 = pal.core;
      let glowColor: V3 = pal.glow;
      // a dot flashes red to blue as it lands, then takes the sphere's own colour
      if (p.colorAge < 0.16) {
        const c = this.aurora(p.colorAge / 0.16);
        core = c; glowColor = c;
        opacity = Math.min(1, opacity + 0.2);
      } else if (p.colorAge < 0.3) {
        const k = (p.colorAge - 0.16) / 0.14;
        const e = this.aurora(1);
        core = [e[0] + (pal.core[0] - e[0]) * k, e[1] + (pal.core[1] - e[1]) * k, e[2] + (pal.core[2] - e[2]) * k];
        glowColor = [e[0] + (pal.glow[0] - e[0]) * k, e[1] + (pal.glow[1] - e[1]) * k, e[2] + (pal.glow[2] - e[2]) * k];
      }
      if (radius <= 0 || opacity <= 0) continue;
      if (haloOpacity > 0.12) {
        ctx.fillStyle = `rgba(${glowColor[0] | 0},${glowColor[1] | 0},${glowColor[2] | 0},${(haloOpacity * 0.32).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, glow * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${core[0] | 0},${core[1] | 0},${core[2] | 0},${Math.min(1, opacity + 0.15).toFixed(3)})`;
      if (radius > 1.6 * dpr) this.blob(ctx, p.sx, p.sy, radius, p.seed + 500, (0.4 + depthT * 1.1) * 0.7);
      else { ctx.beginPath(); ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2); }
      ctx.fill();
    }
  }
}
