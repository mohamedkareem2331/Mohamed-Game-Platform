/**
 * MOHAMED KAREEM GAMES — NIGHTFALL: ZOMBIE SURVIVAL WEB ENGINE
 * 
 * 1-to-1 Faithful HTML5 Canvas Arcade Engine preserving 100% of the original
 * Python + Pygame mechanics, entity speeds, upgrade system, wave progression,
 * boss encounters, particles, screen shake, and controls.
 */

(function() {
  const WIDTH = 1100;
  const HEIGHT = 700;
  const FPS = 60;

  // Exact Pygame Settings
  const COLORS = {
    bg: "#0d1119",
    grid: "#171e2a",
    white: "#ebf1fa",
    muted: "#8795a9",
    cyan: "#46dce6",
    green: "#5adc91",
    red: "#ee555f",
    gold: "#ffc450",
    purple: "#af7dff"
  };

  const ZOMBIE_TYPES = {
    walker: { hp: 38, speed: 68, radius: 15, color: "#68b470", damage: 10, xp: 12, score: 10 },
    runner: { hp: 24, speed: 125, radius: 11, color: "#dcaa55", damage: 8, xp: 15, score: 16 },
    brute:  { hp: 125, speed: 43, radius: 22, color: "#aa5f69", damage: 22, xp: 30, score: 35 },
    boss:   { hp: 650, speed: 52, radius: 34, color: "#a05adc", damage: 30, xp: 150, score: 250 }
  };

  // Synthesized Web Audio for arcade retro sounds
  class SoundFX {
    constructor() {
      this.ctx = null;
    }
    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }
    playTone(freq, type, duration, vol = 0.15) {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }
    shoot() { this.playTone(520, "square", 0.08, 0.08); }
    hit() { this.playTone(180, "sawtooth", 0.1, 0.12); }
    hurt() { this.playTone(110, "sawtooth", 0.25, 0.2); }
    pickup() { this.playTone(880, "sine", 0.15, 0.15); }
    upgrade() {
      this.playTone(440, "sine", 0.1, 0.15);
      setTimeout(() => this.playTone(660, "sine", 0.15, 0.15), 100);
      setTimeout(() => this.playTone(880, "sine", 0.25, 0.15), 200);
    }
    dash() { this.playTone(320, "triangle", 0.12, 0.12); }
  }

  const sfx = new SoundFX();

  class ZombieGame {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext("2d");
      this.canvas.width = WIDTH;
      this.canvas.height = HEIGHT;

      this.keys = {};
      this.mouse = { x: WIDTH / 2, y: HEIGHT / 2, down: false };

      this.highscore = 0;
      if (window.mkStorage) {
        const save = window.mkStorage.getZombieSave();
        this.highscore = save.highScore || 0;
      }

      this.state = "menu"; // "menu", "playing", "paused", "upgrade", "gameover"
      this.initEvents();
      this.reset();

      this.lastTime = performance.now();
      requestAnimationFrame(this.loop.bind(this));
    }

    reset() {
      this.player = {
        x: WIDTH / 2,
        y: HEIGHT / 2,
        radius: 16,
        speed: 270,
        max_hp: 100,
        hp: 100,
        damage: 25,
        fire_rate: 0.22,
        fire_timer: 0,
        projectile_speed: 620,
        xp: 0,
        level: 1,
        next_xp: 55,
        score: 0,
        kills: 0,
        dash_cd: 0,
        dash_time: 0,
        invuln: 0,
        rapid_time: 0
      };

      this.zombies = [];
      this.projectiles = [];
      this.particles = [];
      this.pickups = [];
      this.floaters = [];

      this.wave = 0;
      this.spawn_left = 0;
      this.spawn_timer = 0;
      this.wave_break = 1.5;
      this.shake = 0;
      this.upgrade_choices = [];
      this.message = "";
      this.message_time = 0;

      this.start_wave();
    }

    start_wave() {
      this.wave += 1;
      this.spawn_left = 5 + this.wave * 3;
      this.spawn_timer = 0.5;

      if (this.wave % 5 === 0) {
        this.zombies.push(this.createZombie(this.randomEdge(), "boss", this.wave));
        this.message = "BOSS WAVE";
      } else {
        this.message = `WAVE ${this.wave}`;
      }
      this.message_time = 2.0;
    }

    randomEdge() {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) return { x: Math.random() * WIDTH, y: -25 };
      if (side === 1) return { x: WIDTH + 25, y: Math.random() * HEIGHT };
      if (side === 2) return { x: Math.random() * WIDTH, y: HEIGHT + 25 };
      return { x: -25, y: Math.random() * HEIGHT };
    }

    createZombie(pos, kind, wave) {
      const data = ZOMBIE_TYPES[kind];
      const scale = 1 + Math.max(0, wave - 1) * 0.095;
      const speedScale = 1 + Math.max(0, wave - 1) * 0.018;
      return {
        x: pos.x,
        y: pos.y,
        kind: kind,
        max_hp: data.hp * scale,
        hp: data.hp * scale,
        speed: data.speed * speedScale,
        radius: data.radius,
        color: data.color,
        damage: data.damage,
        xp: data.xp,
        score: data.score,
        attack_cd: 0,
        flash: 0
      };
    }

    spawnZombie() {
      const r = Math.random();
      let kind = "walker";
      if (this.wave >= 4 && r < 0.16) kind = "brute";
      else if (this.wave >= 2 && r < 0.42) kind = "runner";
      this.zombies.push(this.createZombie(this.randomEdge(), kind, this.wave));
    }

    shoot(target) {
      const p = this.player;
      let dx = target.x - p.x;
      let dy = target.y - p.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;
      dx /= len;
      dy /= len;

      this.projectiles.push({
        x: p.x + dx * 22,
        y: p.y + dy * 22,
        vx: dx * p.projectile_speed,
        vy: dy * p.projectile_speed,
        damage: p.damage,
        life: 1.25,
        radius: 5,
        color: COLORS.cyan
      });

      p.fire_timer = p.fire_rate * (p.rapid_time > 0 ? 0.48 : 1);
      sfx.shoot();

      for (let i = 0; i < 3; i++) {
        const spread = (Math.random() - 0.5) * 60;
        this.particles.push({
          x: p.x + dx * 22,
          y: p.y + dy * 22,
          vx: -dx * (40 + Math.random() * 60) + spread,
          vy: -dy * (40 + Math.random() * 60) + spread,
          life: 0.18,
          max_life: 0.18,
          radius: 2,
          color: COLORS.cyan
        });
      }
    }

    damagePlayer(amount) {
      const p = this.player;
      if (p.invuln > 0) return;
      p.hp -= amount;
      p.invuln = 0.65;
      this.shake = 9;
      this.message = `-${amount} HP`;
      this.message_time = 0.55;
      sfx.hurt();

      for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 50 + Math.random() * 120;
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.35,
          max_life: 0.35,
          radius: 4,
          color: COLORS.red
        });
      }

      if (p.hp <= 0) {
        p.hp = 0;
        this.state = "gameover";
        if (p.score > this.highscore) {
          this.highscore = p.score;
        }
        if (window.mkStorage) {
          window.mkStorage.saveZombieScore(p.score, this.wave, p.kills);
        }
      }
    }

    killZombie(z) {
      this.player.score += z.score;
      this.player.kills += 1;
      sfx.hit();

      // Floater
      this.floaters.push({
        x: z.x,
        y: z.y,
        text: `+${z.score}`,
        color: COLORS.gold,
        life: 0.8
      });

      // Particles
      const count = z.kind === "boss" ? 18 : 8;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 140;
        this.particles.push({
          x: z.x,
          y: z.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.55,
          max_life: 0.55,
          radius: 4,
          color: z.color
        });
      }

      // Pickups
      const dropChance = z.kind === "boss" ? 0.85 : 0.10;
      if (Math.random() < dropChance) {
        this.pickups.push({
          x: z.x,
          y: z.y,
          kind: Math.random() < 0.5 ? "heal" : "rapid",
          life: 12.0,
          phase: Math.random() * 6
        });
      }

      // Add XP & Check Level Up
      this.player.xp += z.xp;
      if (this.player.xp >= this.player.next_xp) {
        this.player.xp -= this.player.next_xp;
        this.player.level += 1;
        this.player.next_xp = Math.floor(this.player.next_xp * 1.32 + 18);
        this.openUpgrades();
      }
    }

    openUpgrades() {
      sfx.upgrade();
      const pool = [
        { name: "Power Core", desc: "+8 projectile damage", action: p => p.damage += 8 },
        { name: "Quick Trigger", desc: "Fire 12% faster", action: p => p.fire_rate = Math.max(0.075, p.fire_rate * 0.88) },
        { name: "Reinforced Suit", desc: "+20 maximum health", action: p => { p.max_hp += 20; p.hp = Math.min(p.max_hp, p.hp + 20); } },
        { name: "Running Shoes", desc: "+8% movement speed", action: p => p.speed *= 1.08 },
        { name: "Energy Cell", desc: "+15 projectile speed", action: p => p.projectile_speed += 15 },
        { name: "Field Medic", desc: "Restore 35 health", action: p => p.hp = Math.min(p.max_hp, p.hp + 35) }
      ];

      // Sample 3 random perks
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      this.upgrade_choices = shuffled.slice(0, 3);
      this.state = "upgrade";
    }

    chooseUpgrade(index) {
      if (index >= 0 && index < this.upgrade_choices.length) {
        const choice = this.upgrade_choices[index];
        choice.action(this.player);
        this.message = choice.name.toUpperCase();
        this.message_time = 1.3;
        this.state = "playing";
        this.upgrade_choices = [];
      }
    }

    dash() {
      const p = this.player;
      if (p.dash_cd > 0 || this.state !== "playing") return;

      let dx = 0, dy = 0;
      if (this.keys["KeyD"] || this.keys["ArrowRight"]) dx += 1;
      if (this.keys["KeyA"] || this.keys["ArrowLeft"]) dx -= 1;
      if (this.keys["KeyS"] || this.keys["ArrowDown"]) dy += 1;
      if (this.keys["KeyW"] || this.keys["ArrowUp"]) dy -= 1;

      if (dx === 0 && dy === 0) {
        dx = this.mouse.x - p.x;
        dy = this.mouse.y - p.y;
      }
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        dx /= len;
        dy /= len;
        p.x += dx * 115;
        p.y += dy * 115;
      }

      p.dash_cd = 2.2;
      p.dash_time = 0.18;
      p.invuln = Math.max(p.invuln, 0.22);
      sfx.dash();

      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * (30 + Math.random() * 80),
          vy: Math.sin(ang) * (30 + Math.random() * 80),
          life: 0.3,
          max_life: 0.3,
          radius: 3,
          color: COLORS.cyan
        });
      }
    }

    update(dt) {
      if (this.state !== "playing") return;

      const p = this.player;

      // Player Movement
      let mx = 0, my = 0;
      if (this.keys["KeyD"] || this.keys["ArrowRight"]) mx += 1;
      if (this.keys["KeyA"] || this.keys["ArrowLeft"]) mx -= 1;
      if (this.keys["KeyS"] || this.keys["ArrowDown"]) my += 1;
      if (this.keys["KeyW"] || this.keys["ArrowUp"]) my -= 1;

      const mlen = Math.sqrt(mx * mx + my * my);
      if (mlen > 0) {
        mx /= mlen;
        my /= mlen;
      }

      const curSpeed = p.speed * (p.dash_time > 0 ? 2.35 : 1);
      p.x += mx * curSpeed * dt;
      p.y += my * curSpeed * dt;

      // Clamp within boundaries
      p.x = Math.max(p.radius, Math.min(WIDTH - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(HEIGHT - p.radius, p.y));

      p.fire_timer = Math.max(0, p.fire_timer - dt);
      p.dash_cd = Math.max(0, p.dash_cd - dt);
      p.dash_time = Math.max(0, p.dash_time - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      p.rapid_time = Math.max(0, p.rapid_time - dt);

      // Auto Fire on holding mouse
      if (this.mouse.down && p.fire_timer <= 0) {
        this.shoot(this.mouse);
      }

      // Spawning
      if (this.spawn_left > 0) {
        this.spawn_timer -= dt;
        if (this.spawn_timer <= 0) {
          this.spawnZombie();
          this.spawn_left -= 1;
          this.spawn_timer = Math.max(0.22, 0.85 - this.wave * 0.025);
        }
      } else if (this.zombies.length === 0) {
        this.wave_break -= dt;
        if (this.wave_break <= 0) {
          this.wave_break = 2.2;
          this.start_wave();
        }
      }

      // Update Projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.life -= dt;

        let hit = false;
        for (let j = this.zombies.length - 1; j >= 0; j--) {
          const z = this.zombies[j];
          const dist = Math.hypot(pr.x - z.x, pr.y - z.y);
          if (dist < pr.radius + z.radius) {
            z.hp -= pr.damage;
            z.flash = 0.08;
            hit = true;
            if (z.hp <= 0) {
              this.killZombie(z);
              this.zombies.splice(j, 1);
            }
            break;
          }
        }

        if (hit || pr.life <= 0 || pr.x < 0 || pr.x > WIDTH || pr.y < 0 || pr.y > HEIGHT) {
          this.projectiles.splice(i, 1);
        }
      }

      // Update Zombies
      for (let i = 0; i < this.zombies.length; i++) {
        const z = this.zombies[i];
        let dx = p.x - z.x;
        let dy = p.y - z.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          dx /= dist;
          dy /= dist;
        }

        // Separation from peers
        let sx = 0, sy = 0;
        for (let j = 0; j < this.zombies.length; j++) {
          if (i === j) continue;
          const other = this.zombies[j];
          const odx = z.x - other.x;
          const ody = z.y - other.y;
          const odist2 = odx * odx + ody * ody;
          if (odist2 > 0 && odist2 < 34 * 34) {
            const odist = Math.sqrt(odist2);
            sx += (odx / odist) * (34 - odist) * 2.2;
            sy += (ody / odist) * (34 - odist) * 2.2;
          }
        }

        let vx = dx * z.speed + sx;
        let vy = dy * z.speed + sy;
        const vlen = Math.hypot(vx, vy);
        if (vlen > 0) {
          const capSpeed = Math.min(vlen, z.speed + 45);
          z.x += (vx / vlen) * capSpeed * dt;
          z.y += (vy / vlen) * capSpeed * dt;
        }

        z.attack_cd = Math.max(0, z.attack_cd - dt);
        z.flash = Math.max(0, z.flash - dt);

        // Player Collision
        if (dist < z.radius + p.radius) {
          if (z.attack_cd <= 0) {
            this.damagePlayer(z.damage);
            z.attack_cd = 0.75;
          }
        }
      }

      // Update Pickups
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        pk.life -= dt;
        pk.phase += dt * 4;

        if (Math.hypot(pk.x - p.x, pk.y - p.y) < p.radius + 18) {
          sfx.pickup();
          if (pk.kind === "heal") {
            p.hp = Math.min(p.max_hp, p.hp + 35);
            this.message = "+35 HEALTH";
            this.message_time = 0.9;
          } else {
            p.rapid_time = 6.0;
            this.message = "RAPID FIRE!";
            this.message_time = 0.9;
          }
          this.pickups.splice(i, 1);
        } else if (pk.life <= 0) {
          this.pickups.splice(i, 1);
        }
      }

      // Update Floatings
      for (let i = this.floaters.length - 1; i >= 0; i--) {
        const fl = this.floaters[i];
        fl.life -= dt;
        fl.y -= 35 * dt;
        if (fl.life <= 0) this.floaters.splice(i, 1);
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= Math.max(0, 1 - 3.2 * dt);
        pt.vy *= Math.max(0, 1 - 3.2 * dt);
        if (pt.life <= 0) this.particles.splice(i, 1);
      }

      // Update Messages & Shake
      this.message_time = Math.max(0, this.message_time - dt);
      this.shake = Math.max(0, this.shake - dt * 18);
    }

    draw() {
      const ctx = this.ctx;

      // Screen Shake
      ctx.save();
      if (this.shake > 0) {
        const ox = (Math.random() - 0.5) * this.shake;
        const oy = (Math.random() - 0.5) * this.shake;
        ctx.translate(ox, oy);
      }

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Arena Grid
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      const step = 45;
      for (let x = 0; x < WIDTH; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < HEIGHT; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }

      // Pickups
      this.pickups.forEach(pk => {
        const pulse = Math.sin(pk.phase) * 2;
        const col = pk.kind === "heal" ? COLORS.green : COLORS.gold;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, 12 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.font = "bold 13px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pk.kind === "heal" ? "+" : "R", pk.x, pk.y);
      });

      // Projectiles
      this.projectiles.forEach(pr => {
        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COLORS.white;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Zombies
      this.zombies.forEach(z => {
        // Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.arc(z.x + 3, z.y + 4, z.radius + 2, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = z.flash > 0 ? COLORS.white : z.color;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#232a30";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Eyes
        ctx.fillStyle = "#ffe696";
        ctx.beginPath();
        ctx.arc(z.x - 5, z.y - 3, 2, 0, Math.PI * 2);
        ctx.arc(z.x + 5, z.y - 3, 2, 0, Math.PI * 2);
        ctx.fill();

        // Boss Health Bar
        if (z.kind === "boss") {
          const bw = 58;
          ctx.fillStyle = "#2d2337";
          ctx.fillRect(z.x - bw / 2, z.y - z.radius - 14, bw, 5);
          ctx.fillStyle = COLORS.purple;
          ctx.fillRect(z.x - bw / 2, z.y - z.radius - 14, bw * (z.hp / z.max_hp), 5);
        }
      });

      // Particles
      this.particles.forEach(pt => {
        const r = Math.max(1, pt.radius * (pt.life / pt.max_life));
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Player
      const p = this.player;
      let aimX = this.mouse.x - p.x;
      let aimY = this.mouse.y - p.y;
      const aimLen = Math.hypot(aimX, aimY);
      if (aimLen > 0) {
        aimX /= aimLen;
        aimY /= aimLen;
      }

      // Player Shadow
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.arc(p.x + 3, p.y + 5, p.radius + 3, 0, Math.PI * 2);
      ctx.fill();

      // Gun Barrel
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + aimX * 25, p.y + aimY * 25);
      ctx.stroke();

      // Player Body
      ctx.fillStyle = p.invuln > 0 ? COLORS.white : COLORS.cyan;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#193241";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = COLORS.white;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Floating Numbers
      this.floaters.forEach(fl => {
        ctx.fillStyle = fl.color;
        ctx.globalAlpha = Math.min(1, fl.life * 2);
        ctx.font = "bold 15px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText(fl.text, fl.x, fl.y);
        ctx.globalAlpha = 1;
      });

      ctx.restore();

      // HUD Overlay (Fixed position)
      this.drawHUD();

      // Messages
      if (this.message_time > 0) {
        ctx.fillStyle = COLORS.gold;
        ctx.font = "bold 26px Orbitron, Rajdhani, monospace";
        ctx.textAlign = "center";
        ctx.fillText(this.message, WIDTH / 2, 125);
      }

      // State Overlays
      if (this.state === "menu") {
        this.drawOverlay("NIGHTFALL", [
          "ZOMBIE SURVIVAL",
          "WASD Move   •   Mouse Aim + Fire",
          "SPACE Dash   •   P Pause",
          "Press ENTER to Begin",
          `PERSONAL BEST: ${this.highscore.toLocaleString()} PTS`
        ]);
      } else if (this.state === "paused") {
        this.drawOverlay("PAUSED", ["Press P or ESC to Resume"]);
      } else if (this.state === "upgrade") {
        const lines = ["Choose an upgrade with key 1, 2 or 3:"].concat(
          this.upgrade_choices.map((c, i) => `${i + 1}. ${c.name} — ${c.desc}`)
        );
        this.drawOverlay("LEVEL UP!", lines);
      } else if (this.state === "gameover") {
        this.drawOverlay("RUN OVER", [
          `Final Score: ${p.score.toLocaleString()}`,
          `Wave Reached: ${this.wave}`,
          `Best Score: ${this.highscore.toLocaleString()}`,
          "Press ENTER to Play Again"
        ]);
      }
    }

    drawHUD() {
      const ctx = this.ctx;
      const p = this.player;

      // Health Bar
      const hw = 220;
      ctx.fillStyle = "#111824";
      ctx.fillRect(25, 25, hw, 18);
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(25, 25, hw * (p.hp / p.max_hp), 18);
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.strokeRect(25, 25, hw, 18);

      ctx.fillStyle = COLORS.white;
      ctx.font = "bold 12px Consolas, monospace";
      ctx.textAlign = "left";
      ctx.fillText(`HP ${Math.ceil(p.hp)}/${p.max_hp}`, 30, 39);

      // Dash Bar
      const dw = 110;
      const dashRatio = Math.max(0, 1 - p.dash_cd / 2.2);
      ctx.fillStyle = "#111824";
      ctx.fillRect(260, 25, dw, 18);
      ctx.fillStyle = COLORS.cyan;
      ctx.fillRect(260, 25, dw * dashRatio, 18);
      ctx.strokeRect(260, 25, dw, 18);
      ctx.fillStyle = COLORS.white;
      ctx.fillText(p.dash_cd <= 0 ? "DASH READY" : "DASH CD", 265, 39);

      // Score, Wave & Level
      ctx.fillStyle = COLORS.gold;
      ctx.font = "bold 18px Orbitron, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`SCORE ${p.score.toLocaleString()}`, WIDTH - 30, 40);

      ctx.fillStyle = COLORS.cyan;
      ctx.font = "bold 15px Rajdhani, Consolas, monospace";
      ctx.fillText(`WAVE ${this.wave}  |  LVL ${p.level}  |  XP ${p.xp}/${p.next_xp}`, WIDTH - 30, 65);
    }

    drawOverlay(title, lines) {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(4, 7, 13, 0.82)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Card
      const pw = 660, ph = 380;
      const px = WIDTH / 2 - pw / 2, py = HEIGHT / 2 - ph / 2;
      ctx.fillStyle = "rgba(17, 24, 36, 0.96)";
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = "#415b78";
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);

      // Title
      ctx.fillStyle = COLORS.cyan;
      ctx.font = "900 48px Orbitron, Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(title, WIDTH / 2, py + 75);

      // Lines
      lines.forEach((line, i) => {
        ctx.fillStyle = i === 0 ? COLORS.gold : COLORS.white;
        ctx.font = i === 0 ? "bold 22px Rajdhani, sans-serif" : "16px Inter, Consolas, sans-serif";
        ctx.fillText(line, WIDTH / 2, py + 140 + i * 42);
      });
    }

    loop(timestamp) {
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.035);
      this.lastTime = timestamp;

      this.update(dt);
      this.draw();

      requestAnimationFrame(this.loop.bind(this));
    }

    initEvents() {
      window.addEventListener("keydown", e => {
        sfx.init();
        this.keys[e.code] = true;

        if (e.code === "Enter" && (this.state === "menu" || this.state === "gameover")) {
          this.reset();
          this.state = "playing";
        } else if (e.code === "KeyP" || e.code === "Escape") {
          if (this.state === "playing") this.state = "paused";
          else if (this.state === "paused") this.state = "playing";
        } else if (e.code === "Space" && this.state === "playing") {
          this.dash();
        } else if (this.state === "upgrade") {
          if (e.code === "Digit1") this.chooseUpgrade(0);
          else if (e.code === "Digit2") this.chooseUpgrade(1);
          else if (e.code === "Digit3") this.chooseUpgrade(2);
        }
      });

      window.addEventListener("keyup", e => {
        this.keys[e.code] = false;
      });

      this.canvas.addEventListener("mousemove", e => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.mouse.x = (e.clientX - rect.left) * scaleX;
        this.mouse.y = (e.clientY - rect.top) * scaleY;
      });

      this.canvas.addEventListener("mousedown", e => {
        sfx.init();
        if (e.button === 0) {
          this.mouse.down = true;
          if (this.state === "menu" || this.state === "gameover") {
            this.reset();
            this.state = "playing";
          }
        }
      });

      window.addEventListener("mouseup", e => {
        if (e.button === 0) this.mouse.down = false;
      });
    }
  }

  window.ZombieGame = ZombieGame;
})();
