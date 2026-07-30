// المشهد الإيزومتري — استوديو يكبر مع المراحل، موظفون يعملون ويتمشون،
// دورة نهار وليل، وقصاصات احتفال. Canvas 2D خفيف بلا اعتماديات،
// معزول تماماً عن منطق اللعبة: يقرأ SceneProps فقط.

export interface SceneProps {
  stage: number;
  people: number;
  working: boolean;
  /** 0..1 موقع اليوم في الدورة (يحدد الإضاءة) */
  dayPhase: number;
  celebrate: boolean;
}

interface Person {
  x: number; y: number;
  tx: number; ty: number;
  seat: number;
  state: 'sit' | 'walk' | 'coffee';
  timer: number;
  color: string;
  phase: number;
}

interface Confetto { x: number; y: number; vx: number; vy: number; color: string; life: number; }

// حجم الغرفة وعدد المكاتب لكل مرحلة
const ROOMS = [
  { cols: 5, rows: 5, desks: 1 },
  { cols: 6, rows: 6, desks: 3 },
  { cols: 8, rows: 7, desks: 5 },
  { cols: 10, rows: 8, desks: 8 },
  { cols: 12, rows: 9, desks: 13 },
  { cols: 14, rows: 10, desks: 19 },
];

const FLOORS = ['#8a7460', '#7d7f85', '#6e7b8c', '#5f6e85', '#56647f', '#4d5a78'];
const WALLS = ['#a08a72', '#8f9199', '#7e8ba0', '#6f7e99', '#657493', '#5c6a8c'];
const SKIN = ['#e8b88a', '#d9a06b', '#c98a52', '#a9713f', '#8a5a30'];
const SHIRT = ['#e05561', '#4db6ac', '#7986cb', '#ffb74d', '#9575cd', '#4fc3f7', '#aed581', '#f06292', '#a1887f'];

const TILE_W = 44;
const TILE_H = 22;

export class IsoScene {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private people: Person[] = [];
  private confetti: Confetto[] = [];
  private props: SceneProps = { stage: 0, people: 1, working: false, dayPhase: 0.3, celebrate: false };
  private last = 0;
  private stageCache = -1;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    this.canvas = null;
    this.ctx = null;
  }

  update(p: SceneProps): void {
    if (p.celebrate && !this.props.celebrate) this.burstConfetti();
    this.props = { ...p };
    if (p.stage !== this.stageCache) {
      this.stageCache = p.stage;
      this.people = [];
    }
    this.syncPeople();
  }

  // ---- مواقع الأثاث ----------------------------------------------------------

  private deskSpots(stage: number): { c: number; r: number }[] {
    const room = ROOMS[stage];
    const spots: { c: number; r: number }[] = [];
    // صفوف مكاتب منتظمة تترك ممرات
    for (let r = 1; r < room.rows - 1 && spots.length < room.desks; r += 2) {
      for (let c = 1; c < room.cols - 1 && spots.length < room.desks; c += 2) {
        spots.push({ c, r });
      }
    }
    return spots;
  }

  private coffeeSpot(stage: number): { c: number; r: number } {
    const room = ROOMS[stage];
    return { c: room.cols - 1, r: room.rows - 2 };
  }

  private syncPeople(): void {
    const want = Math.max(1, Math.min(this.props.people, ROOMS[this.props.stage].desks));
    const desks = this.deskSpots(this.props.stage);
    while (this.people.length < want) {
      const seat = this.people.length % desks.length;
      const d = desks[seat];
      this.people.push({
        x: d.c, y: d.r,
        tx: d.c, ty: d.r,
        seat,
        state: 'sit',
        timer: 2 + Math.random() * 6,
        color: SHIRT[this.people.length % SHIRT.length],
        phase: Math.random() * Math.PI * 2,
      });
    }
    if (this.people.length > want) this.people.length = want;
  }

  // ---- المحاكاة --------------------------------------------------------------

  private step(dt: number): void {
    const desks = this.deskSpots(this.props.stage);
    const coffee = this.coffeeSpot(this.props.stage);
    for (const p of this.people) {
      p.phase += dt * 3;
      p.timer -= dt;
      const seatSpot = desks[p.seat % desks.length];
      if (p.state === 'sit' && p.timer <= 0) {
        // أثناء العمل يبقى الجميع على مكاتبهم غالباً
        if (!this.props.working && Math.random() < 0.5) {
          p.state = 'walk';
          p.tx = coffee.c; p.ty = coffee.r;
          p.timer = 30;
        } else p.timer = 3 + Math.random() * 8;
      } else if (p.state === 'walk' || p.state === 'coffee') {
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.05) {
          if (p.state === 'walk' && p.tx === coffee.c) {
            p.state = 'coffee';
            p.timer = 2 + Math.random() * 3;
            p.tx = seatSpot.c; p.ty = seatSpot.r;
          } else if (p.state === 'coffee' && p.timer <= 0) {
            p.state = 'walk';
          } else if (p.state === 'walk') {
            p.state = 'sit';
            p.timer = 4 + Math.random() * 8;
          }
        } else if (p.state === 'walk' || (p.state === 'coffee' && p.timer <= 0)) {
          if (p.state === 'coffee') p.state = 'walk';
          // مشي محاذٍ للمحاور: عمود ثم صف — يوحي بممرات بلا A*
          const speed = 1.6 * dt;
          if (Math.abs(dx) > 0.05) p.x += Math.sign(dx) * Math.min(speed, Math.abs(dx));
          else p.y += Math.sign(dy) * Math.min(speed, Math.abs(dy));
        }
      }
    }
    for (const c of this.confetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 160 * dt;
      c.life -= dt;
    }
    this.confetti = this.confetti.filter((c) => c.life > 0);
  }

  private burstConfetti(): void {
    const cv = this.canvas;
    if (!cv) return;
    const colors = ['#ffd54f', '#4fc3f7', '#f06292', '#aed581', '#ba68c8'];
    for (let i = 0; i < 90; i++) {
      this.confetti.push({
        x: Math.random() * cv.clientWidth,
        y: -10 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 60,
        vy: 40 + Math.random() * 80,
        color: colors[i % colors.length],
        life: 3 + Math.random() * 2,
      });
    }
  }

  // ---- الرسم -----------------------------------------------------------------

  private iso(c: number, r: number, ox: number, oy: number): [number, number] {
    return [ox + (c - r) * (TILE_W / 2), oy + (c + r) * (TILE_H / 2)];
  }

  private draw(): void {
    const cv = this.canvas;
    const g = this.ctx;
    if (!cv || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return;
    const pw = Math.round(w * dpr);
    if (cv.width !== pw) { cv.width = pw; cv.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { stage, dayPhase } = this.props;
    const room = ROOMS[stage];
    const night = this.nightness(dayPhase);

    // سماء متدرجة حسب الوقت + أفق مدينة يكبر مع المرحلة
    this.drawSky(g, w, h, night, stage);

    // مركز الغرفة
    const roomW = (room.cols + room.rows) * (TILE_W / 2);
    const scale = Math.min(1, (w - 24) / roomW);
    g.save();
    g.translate(w / 2, 0);
    g.scale(scale, scale);
    g.translate(-w / 2, 0);
    const ox = w / 2;
    const oy = Math.max(90, h * 0.24) / scale;

    this.drawRoom(g, room, ox, oy, stage, night);
    this.drawFurniture(g, ox, oy, stage, night);
    this.drawPeople(g, ox, oy, night);
    g.restore();

    // تعتيم ليلي لطيف فوق كل شيء عدا القصاصات
    if (night > 0) {
      g.fillStyle = `rgba(10, 14, 40, ${night * 0.25})`;
      g.fillRect(0, 0, w, h);
    }

    for (const c of this.confetti) {
      g.fillStyle = c.color;
      g.globalAlpha = Math.min(1, c.life);
      g.fillRect(c.x, c.y, 5, 8);
      g.globalAlpha = 1;
    }
  }

  private nightness(phase: number): number {
    // 0 صباح، 0.5 مساء، 1 عودة للصباح
    return Math.max(0, Math.sin((phase - 0.25) * Math.PI * 2)) * 0.9;
  }

  private drawSky(g: CanvasRenderingContext2D, w: number, h: number, night: number, stage: number): void {
    const grad = g.createLinearGradient(0, 0, 0, h);
    const day = ['#87b8e0', '#cfe3f2'];
    const nightC = ['#101533', '#2a2f55'];
    grad.addColorStop(0, mix(day[0], nightC[0], night));
    grad.addColorStop(1, mix(day[1], nightC[1], night));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // نجوم ليلاً
    if (night > 0.4) {
      g.fillStyle = `rgba(255,255,255,${(night - 0.4) * 0.9})`;
      for (let i = 0; i < 40; i++) {
        const x = ((i * 137) % w);
        const y = ((i * 89) % (h * 0.5));
        g.fillRect(x, y, 1.5, 1.5);
      }
    }
    // أفق المدينة — يعلو مع تقدمك
    const bh = 30 + stage * 22;
    g.fillStyle = mix('#9db4c8', '#151a3a', night);
    for (let i = 0; i < 14; i++) {
      const bw = 24 + ((i * 53) % 40);
      const x = (i / 14) * w;
      const bhi = bh * (0.5 + ((i * 31) % 50) / 50);
      g.fillRect(x, h * 0.42 - bhi, bw, bhi);
      if (night > 0.3) {
        g.fillStyle = `rgba(255, 215, 130, ${night * 0.5})`;
        for (let wy = 0; wy < bhi - 8; wy += 10) {
          if ((i + wy) % 3 !== 0) g.fillRect(x + 4, h * 0.42 - bhi + 4 + wy, 3, 4);
        }
        g.fillStyle = mix('#9db4c8', '#151a3a', night);
      }
    }
  }

  private tilePath(g: CanvasRenderingContext2D, x: number, y: number): void {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + TILE_W / 2, y + TILE_H / 2);
    g.lineTo(x, y + TILE_H);
    g.lineTo(x - TILE_W / 2, y + TILE_H / 2);
    g.closePath();
  }

  private drawRoom(g: CanvasRenderingContext2D, room: { cols: number; rows: number }, ox: number, oy: number, stage: number, night: number): void {
    const floor = mix(FLOORS[stage], '#1c2140', night * 0.5);
    const floorAlt = mix(FLOORS[stage], '#ffffff', 0.06);
    const wall = mix(WALLS[stage], '#181d3a', night * 0.5);
    const wallDark = mix(wall, '#000000', 0.18);
    const wallH = 64;

    // جداران خلفيان
    const [bx, by] = this.iso(0, 0, ox, oy);
    const [rx, ry] = this.iso(room.cols, 0, ox, oy);
    const [lx, ly] = this.iso(0, room.rows, ox, oy);
    g.fillStyle = wall;
    g.beginPath();
    g.moveTo(bx, by - wallH);
    g.lineTo(rx, ry - wallH);
    g.lineTo(rx, ry);
    g.lineTo(bx, by);
    g.closePath();
    g.fill();
    g.fillStyle = wallDark;
    g.beginPath();
    g.moveTo(bx, by - wallH);
    g.lineTo(lx, ly - wallH);
    g.lineTo(lx, ly);
    g.lineTo(bx, by);
    g.closePath();
    g.fill();

    // نوافذ على الجدار الأيمن تتوهج ليلاً
    g.fillStyle = night > 0.35 ? `rgba(255, 222, 150, ${0.35 + night * 0.4})` : 'rgba(200, 230, 255, 0.8)';
    for (let i = 1; i < room.cols - 1; i += 2) {
      const [wx1, wy1] = this.iso(i, 0, ox, oy);
      const [wx2, wy2] = this.iso(i + 1, 0, ox, oy);
      g.beginPath();
      g.moveTo(wx1, wy1 - wallH + 14);
      g.lineTo(wx2, wy2 - wallH + 14);
      g.lineTo(wx2, wy2 - 22);
      g.lineTo(wx1, wy1 - 22);
      g.closePath();
      g.fill();
    }

    // الأرضية
    for (let c = 0; c < room.cols; c++) {
      for (let r = 0; r < room.rows; r++) {
        const [x, y] = this.iso(c, r, ox, oy);
        this.tilePath(g, x, y);
        g.fillStyle = (c + r) % 2 ? floor : mix(floorAlt, '#1c2140', night * 0.5);
        g.fill();
      }
    }
  }

  private isoBox(g: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, color: string): void {
    // صندوق إيزومتري بسيط: وجه علوي وواجهتان
    const top = mix(color, '#ffffff', 0.25);
    const side = mix(color, '#000000', 0.25);
    g.fillStyle = top;
    g.beginPath();
    g.moveTo(x, y - h);
    g.lineTo(x + w / 2, y - h + d / 4);
    g.lineTo(x, y - h + d / 2);
    g.lineTo(x - w / 2, y - h + d / 4);
    g.closePath();
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x - w / 2, y - h + d / 4);
    g.lineTo(x, y - h + d / 2);
    g.lineTo(x, y + d / 2 - h + h);
    g.lineTo(x - w / 2, y + d / 4);
    g.closePath();
    g.fill();
    g.fillStyle = side;
    g.beginPath();
    g.moveTo(x + w / 2, y - h + d / 4);
    g.lineTo(x, y - h + d / 2);
    g.lineTo(x, y + d / 2);
    g.lineTo(x + w / 2, y + d / 4);
    g.closePath();
    g.fill();
  }

  private drawFurniture(g: CanvasRenderingContext2D, ox: number, oy: number, stage: number, night: number): void {
    const desks = this.deskSpots(stage);
    for (const d of desks) {
      const [x, y] = this.iso(d.c, d.r, ox, oy);
      this.isoBox(g, x, y + TILE_H / 2, 34, 18, 16, mix('#8a5f3c', '#241d33', night * 0.4));
      // شاشة تتوهج أثناء العمل
      const glow = this.props.working ? 0.95 : 0.55;
      g.fillStyle = `rgba(120, 220, 255, ${glow})`;
      g.fillRect(x - 6, y - 16, 12, 8);
    }
    // ركن القهوة
    const c = this.coffeeSpot(stage);
    const [cx, cy] = this.iso(c.c, c.r, ox, oy);
    this.isoBox(g, cx, cy + TILE_H / 2, 30, 16, 20, mix('#5d4a66', '#1c1830', night * 0.4));
    g.fillStyle = '#ff7043';
    g.fillRect(cx - 4, cy - 24, 8, 6);
    // نباتات في الزوايا
    if (stage >= 1) {
      for (const [pc, pr] of [[0, ROOMS[stage].rows - 1], [ROOMS[stage].cols - 1, 0]] as const) {
        const [px, py] = this.iso(pc, pr, ox, oy);
        g.fillStyle = mix('#7a5230', '#20182e', night * 0.4);
        g.fillRect(px - 4, py + 2, 8, 7);
        g.fillStyle = mix('#66bb6a', '#1d3a2a', night * 0.4);
        g.beginPath();
        g.arc(px, py - 4, 8, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  private drawPeople(g: CanvasRenderingContext2D, ox: number, oy: number, night: number): void {
    const sorted = [...this.people].sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const p of sorted) {
      const [x, y] = this.iso(p.x, p.y, ox, oy);
      const bob = p.state === 'walk' ? Math.abs(Math.sin(p.phase * 2.2)) * 3 : 0;
      const typing = this.props.working && p.state === 'sit' ? Math.sin(p.phase * 4) * 1.2 : 0;
      const py = y + TILE_H / 2 - bob;
      const skin = SKIN[(p.seat * 7) % SKIN.length];
      // ظل
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.beginPath();
      g.ellipse(x, y + TILE_H / 2 + 2, 8, 3.5, 0, 0, Math.PI * 2);
      g.fill();
      // جسم
      g.fillStyle = mix(p.color, '#141830', night * 0.35);
      g.fillRect(x - 5, py - 20, 10, 14);
      // ذراعان (تتحرك عند الكتابة)
      g.fillRect(x - 7, py - 18 + typing, 2.5, 8);
      g.fillRect(x + 4.5, py - 18 - typing, 2.5, 8);
      // رأس
      g.fillStyle = mix(skin, '#1a1626', night * 0.3);
      g.beginPath();
      g.arc(x, py - 25, 5.5, 0, Math.PI * 2);
      g.fill();
      // كوب قهوة للعائد من الاستراحة
      if (p.state === 'coffee') {
        g.fillStyle = '#ffcc80';
        g.fillRect(x + 6, py - 14, 4, 5);
      }
    }
  }
}

// مزج لونين بنسبة t — يقبل #hex وكذلك rgb(r,g,b) حتى يصح تداخل النداءات
function chan(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const p = parseInt(c.slice(1), 16);
    return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
  }
  const m = c.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
}

function mix(a: string, b: string, t: number): string {
  const ca = chan(a);
  const cb = chan(b);
  const r = Math.round(ca[0] * (1 - t) + cb[0] * t);
  const gr = Math.round(ca[1] * (1 - t) + cb[1] * t);
  const bl = Math.round(ca[2] * (1 - t) + cb[2] * t);
  return `rgb(${r},${gr},${bl})`;
}
