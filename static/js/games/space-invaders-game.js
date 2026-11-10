/**
 * MOHAMED KAREEM GAMES — SPACE INVASION INVADERS WEB ENGINE
 * 
 * 1-to-1 Faithful HTML5 Canvas Engine preserving 100% of the original
 * Python + Pygame artwork, 50-round auto-recharging magazine, 4-tier
 * green laser weapon evolution, 7 selectable difficulty modes,
 * procedural starfields, and synthesized 8-bit sound effects.
 */

(function() {
  const WIDTH = 1280;
  const HEIGHT = 720;
  const FPS = 60;
  const MAX_WEAPON_LEVEL = 4;

  const COLORS = {
    white: "#f5f8ff",
    cyan: "#44e8ff",
    magenta: "#e252ff",
    yellow: "#ffe84b",
    red: "#ff4c50",
    green: "#53f290",
    dark: "#080b18"
  };

  const DIFFICULTIES = [
    { name: "VERY EASY", desc: "Gentle pace for learning.", color: "#53f290", enemy_speed: 0.7, enemy_health: 0.65, enemy_damage: 5, proj_speed: 175, proj_count: 1, fire_rate: 0.65, aggression: 0.55, boss_health: 0.55, drop_chance: 0.65 },
    { name: "EASY", desc: "Forgiving waves with frequent drops.", color: "#44e8ff", enemy_speed: 0.85, enemy_health: 0.8, enemy_damage: 7, proj_speed: 210, proj_count: 1, fire_rate: 0.8, aggression: 0.75, boss_health: 0.75, drop_chance: 0.55 },
    { name: "NORMAL", desc: "Balanced arcade gameplay.", color: "#ffe84b", enemy_speed: 1.0, enemy_health: 1.0, enemy_damage: 9, proj_speed: 240, proj_count: 1, fire_rate: 1.0, aggression: 1.0, boss_health: 1.0, drop_chance: 0.42 },
    { name: "HARD", desc: "Aggressive enemies and faster bullets.", color: "#ff9641", enemy_speed: 1.15, enemy_health: 1.25, enemy_damage: 12, proj_speed: 280, proj_count: 2, fire_rate: 1.2, aggression: 1.25, boss_health: 1.25, drop_chance: 0.32 },
    { name: "EXPERT", desc: "Fast formations and strong bosses.", color: "#ff4c50", enemy_speed: 1.3, enemy_health: 1.5, enemy_damage: 15, proj_speed: 320, proj_count: 2, fire_rate: 1.35, aggression: 1.5, boss_health: 1.5, drop_chance: 0.24 },
    { name: "INSANE", desc: "Overwhelming enemy fire and speed.", color: "#e252ff", enemy_speed: 1.45, enemy_health: 1.85, enemy_damage: 18, proj_speed: 360, proj_count: 3, fire_rate: 1.5, aggression: 1.8, boss_health: 1.8, drop_chance: 0.18 },
    { name: "ULTRA EXTREME", desc: "Maximum intensity bullet hell.", color: "#ff2d78", enemy_speed: 1.6, enemy_health: 2.2, enemy_damage: 22, proj_speed: 400, proj_count: 3, fire_rate: 1.7, aggression: 2.2, boss_health: 2.2, drop_chance: 0.12 }
  ];

  const ENEMY_PROFILES = [
    { name: "RED", color: COLORS.red, attack: "direct" },
    { name: "PURPLE", color: COLORS.magenta, attack: "spread" },
    { name: "GREEN", color: COLORS.green, attack: "heavy" },
    { name: "YELLOW", color: COLORS.yellow, attack: "burst" },
    { name: "BLUE", color: COLORS.cyan, attack: "rapid" },
    { name: "ORANGE", color: "#ff9641", attack: "explosive" }
  ];

  // Synthesized 8-Bit Retro Audio Engine
  class SpaceAudio {
    constructor() {
      this.ctx = null;
    }
    init() {
      try {
        if (!this.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume();
        }
      } catch (e) {}
    }
    tone(freq, type, dur, vol = 0.12) {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    }
    laser() {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      } catch (e) {}
    }
    explode() { this.tone(90, "sawtooth", 0.35, 0.2); }
    powerup() {
      this.tone(330, "sine", 0.08, 0.15);
      setTimeout(() => this.tone(440, "sine", 0.08, 0.15), 60);
      setTimeout(() => this.tone(550, "sine", 0.08, 0.15), 120);
      setTimeout(() => this.tone(660, "sine", 0.18, 0.15), 180);
    }
    evolve() {
      this.tone(520, "square", 0.1, 0.15);
      setTimeout(() => this.tone(780, "square", 0.12, 0.15), 80);
      setTimeout(() => this.tone(1040, "square", 0.25, 0.18), 160);
    }
  }

  const audio = new SpaceAudio();

  class SpaceInvadersGame {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext("2d");
      this.canvas.width = WIDTH;
      this.canvas.height = HEIGHT;

      this.keys = {};
      this.selectedDifficultyIndex = 2; // NORMAL
      this.diff = DIFFICULTIES[this.selectedDifficultyIndex];
      this.state = "menu"; // "menu", "difficulty", "playing", "paused", "gameover", "victory"

      this.score = 0;
      this.wave = 1;
      this.destroyed = 0;

      // Initialize all collections safely to avoid any undefined errors
      this.enemies = [];
      this.boss = null;
      this.playerBullets = [];
      this.enemyBullets = [];
      this.particles = [];
      this.drops = [];
      this.formationOffset = 0;
      this.formationDir = 1;
      this.enemySprites = [];
      this.playerSprite = null;

      // High scores from storage
      this.highScores = {};
      if (window.mkStorage) {
        this.highScores = window.mkStorage.getSpaceScores() || {};
      }

      this.starfield = this.initStarfield();
      this.loadAssets();
      this.initEvents();

      // Start player state
      this.initPlayer();

      this.lastTime = performance.now();
      requestAnimationFrame(this.loop.bind(this));
    }

    initPlayer() {
      this.player = {
        x: WIDTH / 2,
        y: HEIGHT - 85,
        width: 140,
        height: 70,
        speed: 420.0,
        maxHealth: this.diff.name === "VERY EASY" ? 130 : 100,
        health: this.diff.name === "VERY EASY" ? 130 : 100,
        lives: this.diff.name === "VERY EASY" ? 4 : 3,
        weapon: 0,
        rapid_timer: 0.0,
        fire_timer: 0.0,
        current_ammo: 50.0,
        max_ammo: 50.0,
        ammo_recharge_rate: 5.0,
        invulnerable: 0.0,
        upgrade_anim: 0.0
      };
    }

    initStarfield() {
      const stars = [];
      for (let i = 0; i < 90; i++) {
        stars.push({
          x: Math.random() * WIDTH,
          y: Math.random() * HEIGHT,
          speed: 8 + Math.random() * 20,
          size: Math.random() > 0.8 ? 2 : 1,
          alpha: 0.4 + Math.random() * 0.5
        });
      }
      return stars;
    }

    loadAssets() {
      this.assetsLoaded = false;
      this.bgImg = new Image();
      this.shipImg = new Image();
      this.enemiesImg = new Image();

      let loadedCount = 0;
      const onAssetLoad = () => {
        loadedCount++;
        if (loadedCount >= 3) {
          try {
            this.processSprites();
          } catch (e) {
            console.warn("Sprite cutout notice:", e);
          }
          this.assetsLoaded = true;
        }
      };

      this.bgImg.onload = onAssetLoad;
      this.shipImg.onload = onAssetLoad;
      this.enemiesImg.onload = onAssetLoad;

      this.bgImg.onerror = () => { loadedCount++; this.assetsLoaded = true; };
      this.shipImg.onerror = () => { loadedCount++; this.assetsLoaded = true; };
      this.enemiesImg.onerror = () => { loadedCount++; this.assetsLoaded = true; };

      this.bgImg.src = "../static/assets/space/background.png";
      this.shipImg.src = "../static/assets/space/player_ship.png";
      this.enemiesImg.src = "../static/assets/space/enemies.png";
    }

    processSprites() {
      if (this.shipImg && this.shipImg.width > 0) {
        this.playerSprite = this.createTransparentCutout(this.shipImg, [255, 255, 255], 18);
      }

      if (this.enemiesImg && this.enemiesImg.width > 0) {
        this.enemySprites = [];
        const cw = Math.max(1, Math.floor(this.enemiesImg.width / 5));
        const ch = Math.max(1, Math.floor(this.enemiesImg.height / 3));

        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 5; col++) {
            const offCanvas = document.createElement("canvas");
            offCanvas.width = cw;
            offCanvas.height = ch;
            const offCtx = offCanvas.getContext("2d");
            offCtx.drawImage(this.enemiesImg, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
            this.enemySprites.push(this.createTransparentCutout(offCanvas, [17, 24, 32], 25));
          }
        }
      }
    }

    createTransparentCutout(imgSource, targetRgb, tolerance = 20) {
      try {
        const c = document.createElement("canvas");
        c.width = imgSource.width || 64;
        c.height = imgSource.height || 64;
        const ctx = c.getContext("2d");
        ctx.drawImage(imgSource, 0, 0);

        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (Math.abs(r - targetRgb[0]) <= tolerance &&
              Math.abs(g - targetRgb[1]) <= tolerance &&
              Math.abs(b - targetRgb[2]) <= tolerance) {
            data[i + 3] = 0; // Alpha 0
          }
        }
        ctx.putImageData(imgData, 0, 0);
        return c;
      } catch (e) {
        return imgSource;
      }
    }

    startNewGame() {
      this.diff = DIFFICULTIES[this.selectedDifficultyIndex];
      this.initPlayer();

      this.score = 0;
      this.wave = 1;
      this.destroyed = 0;
      this.playerBullets = [];
      this.enemyBullets = [];
      this.particles = [];
      this.drops = [];
      this.formationOffset = 0;
      this.formationDir = 1;

      this.buildWave();
      this.state = "playing";
    }

    buildWave() {
      this.enemies = [];
      this.boss = null;

      if (this.wave % 5 === 0) {
        // Boss Wave
        const bossSprite = (this.enemySprites && this.enemySprites.length > 0) ? this.enemySprites[1] : null;
        this.boss = {
          x: WIDTH / 2,
          y: 80,
          width: 220,
          height: 140,
          max_hp: Math.floor((1800 + this.wave * 350) * this.diff.boss_health),
          hp: Math.floor((1800 + this.wave * 350) * this.diff.boss_health),
          fire_timer: 1.0,
          sprite: bossSprite,
          angle: 0
        };
      } else {
        // Formation Grid: 5 columns x 4 rows
        const startX = 260;
        const startY = 85;
        const spacingX = 175;
        const spacingY = 70;

        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 5; col++) {
            const idx = row * 5 + col;
            const profile = ENEMY_PROFILES[idx % ENEMY_PROFILES.length];
            const sprite = (this.enemySprites && this.enemySprites.length > 0) ? this.enemySprites[idx % this.enemySprites.length] : null;

            this.enemies.push({
              baseX: startX + col * spacingX,
              baseY: startY + row * spacingY,
              x: startX + col * spacingX,
              y: startY + row * spacingY,
              width: 55,
              height: 45,
              health: Math.floor((12 + this.wave * 3 + idx * 2) * this.diff.enemy_health),
              maxHealth: Math.floor((12 + this.wave * 3 + idx * 2) * this.diff.enemy_health),
              score: 50 + this.wave * 15 + idx * 5,
              fireTimer: 1.0 + Math.random() * 3.0 / this.diff.aggression,
              profile: profile,
              sprite: sprite
            });
          }
        }
      }
    }

    firePlayer() {
      const p = this.player;
      if (!p || p.fire_timer > 0 || p.current_ammo < 1.0) return;

      const offsetsByLevel = {
        0: [0],
        1: [0],
        2: [-24, 24],
        3: [-38, 0, 38],
        4: [-48, -16, 16, 48]
      };

      const offsets = offsetsByLevel[Math.min(p.weapon, MAX_WEAPON_LEVEL)] || [0];
      const damage = 14 + Math.max(0, p.weapon - 1) * 4;

      offsets.forEach(off => {
        this.playerBullets.push({
          x: p.x + off,
          y: p.y - 25,
          vy: -620,
          color: p.weapon > 0 ? COLORS.green : COLORS.cyan,
          damage: damage
        });
      });

      p.current_ammo = Math.max(0.0, p.current_ammo - 1.0);
      p.fire_timer = p.rapid_timer > 0 ? 0.08 : (p.weapon > 0 ? 0.10 : 0.18);
      audio.laser();
    }

    update(dt) {
      // Starfield parallax
      this.starfield.forEach(s => {
        s.y += s.speed * dt;
        if (s.y > HEIGHT) {
          s.y = 0;
          s.x = Math.random() * WIDTH;
        }
      });

      if (this.state !== "playing") return;

      const p = this.player;
      if (!p) return;

      // Player Movement
      let dx = 0, dy = 0;
      if (this.keys["KeyD"] || this.keys["ArrowRight"]) dx += 1;
      if (this.keys["KeyA"] || this.keys["ArrowLeft"]) dx -= 1;
      if (this.keys["KeyS"] || this.keys["ArrowDown"]) dy += 1;
      if (this.keys["KeyW"] || this.keys["ArrowUp"]) dy -= 1;

      const dlen = Math.hypot(dx, dy);
      if (dlen > 0) {
        dx /= dlen;
        dy /= dlen;
        p.x += dx * p.speed * dt;
        p.y += dy * p.speed * dt;
      }

      // Clamp Player inside screen
      p.x = Math.max(80, Math.min(WIDTH - 80, p.x));
      p.y = Math.max(80, Math.min(HEIGHT - 45, p.y));

      p.fire_timer = Math.max(0, p.fire_timer - dt);
      p.rapid_timer = Math.max(0, p.rapid_timer - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.upgrade_anim = Math.max(0, p.upgrade_anim - dt);

      // Auto Fire when Space is held
      const wantsFire = this.keys["Space"];
      if (wantsFire) {
        this.firePlayer();
      }

      // 50-round Magazine Recharge (5 shots/sec when not firing)
      const shouldRecharge = !wantsFire || p.current_ammo <= 0;
      if (shouldRecharge && p.current_ammo < p.max_ammo) {
        p.current_ammo = Math.min(p.max_ammo, p.current_ammo + p.ammo_recharge_rate * dt);
      }

      // Update Player Bullets
      for (let i = this.playerBullets.length - 1; i >= 0; i--) {
        const b = this.playerBullets[i];
        b.y += b.vy * dt;

        let hit = false;

        // Check Boss
        if (this.boss) {
          if (Math.abs(b.x - this.boss.x) < this.boss.width / 2 && Math.abs(b.y - this.boss.y) < this.boss.height / 2) {
            this.boss.hp -= b.damage;
            hit = true;
            if (this.boss.hp <= 0) {
              audio.explode();
              this.score += 2500 * this.wave;
              this.wave += 1;
              this.boss = null;
              this.buildWave();
            }
          }
        }

        // Check Formation Enemies
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (Math.abs(b.x - e.x) < e.width / 2 && Math.abs(b.y - e.y) < e.height / 2) {
            e.health -= b.damage;
            hit = true;
            if (e.health <= 0) {
              this.destroyEnemy(e);
              this.enemies.splice(j, 1);
            }
            break;
          }
        }

        if (hit || b.y < -20) {
          this.playerBullets.splice(i, 1);
        }
      }

      // Wave Progression (Enemies Cleared)
      if (!this.boss && this.enemies.length === 0) {
        this.wave += 1;
        this.buildWave();
      }

      // Update Formation Motion
      this.formationOffset += 45 * this.formationDir * this.diff.enemy_speed * dt;
      if (Math.abs(this.formationOffset) > 130) {
        this.formationDir *= -1;
      }

      // Update Formation Enemies
      this.enemies.forEach(e => {
        e.x = e.baseX + this.formationOffset;
        e.fireTimer -= dt;

        if (e.fireTimer <= 0) {
          this.enemyBullets.push({
            x: e.x,
            y: e.y + 20,
            vy: this.diff.proj_speed,
            color: e.profile.color,
            damage: this.diff.enemy_damage
          });
          e.fireTimer = (1.8 + Math.random() * 2.5) / this.diff.aggression;
        }
      });

      // Update Boss
      if (this.boss) {
        this.boss.angle += dt * 1.5;
        this.boss.x = WIDTH / 2 + Math.sin(this.boss.angle) * 220;
        this.boss.fire_timer -= dt;

        if (this.boss.fire_timer <= 0) {
          for (let ang = -0.4; ang <= 0.4; ang += 0.2) {
            this.enemyBullets.push({
              x: this.boss.x,
              y: this.boss.y + 60,
              vx: Math.sin(ang) * 120,
              vy: this.diff.proj_speed * 0.9,
              color: COLORS.magenta,
              damage: this.diff.enemy_damage + 4
            });
          }
          this.boss.fire_timer = 1.2;
        }
      }

      // Update Enemy Bullets
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        b.y += b.vy * dt;
        if (b.vx) b.x += b.vx * dt;

        // Player Collision
        if (p.invulnerable <= 0 && Math.abs(b.x - p.x) < 45 && Math.abs(b.y - p.y) < 30) {
          p.health -= b.damage;
          p.invulnerable = 1.2;
          audio.explode();
          this.enemyBullets.splice(i, 1);

          if (p.health <= 0) {
            p.lives -= 1;
            if (p.lives > 0) {
              p.health = p.maxHealth;
              p.weapon = 0;
              p.current_ammo = p.max_ammo;
              p.x = WIDTH / 2;
              p.y = HEIGHT - 85;
            } else {
              this.state = "gameover";
              if (window.mkStorage) {
                window.mkStorage.saveSpaceScore(this.diff.name, this.score);
              }
            }
          }
        } else if (b.y > HEIGHT + 20) {
          this.enemyBullets.splice(i, 1);
        }
      }

      // Update Drops
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.y += 110 * dt;

        if (Math.hypot(d.x - p.x, d.y - p.y) < 55) {
          if (d.kind === "HEALTH") {
            p.health = Math.min(p.maxHealth, p.health + 30);
            audio.powerup();
          } else if (d.kind === "AMMO") {
            p.rapid_timer = 12.0;
            audio.powerup();
          } else if (d.kind === "LASER") {
            p.weapon = Math.min(MAX_WEAPON_LEVEL, p.weapon + 1);
            p.upgrade_anim = 1.0;
            audio.evolve();
          }
          this.drops.splice(i, 1);
        } else if (d.y > HEIGHT + 30) {
          this.drops.splice(i, 1);
        }
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }
    }

    destroyEnemy(e) {
      this.score += e.score;
      this.destroyed += 1;
      audio.explode();

      for (let i = 0; i < 10; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 100;
        this.particles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.4,
          max_life: 0.4,
          color: e.profile.color
        });
      }

      // Power-up Drop Chance
      if (Math.random() < this.diff.drop_chance) {
        const kinds = ["HEALTH", "AMMO", "LASER"];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        this.drops.push({
          x: e.x,
          y: e.y,
          kind: kind,
          color: kind === "HEALTH" ? COLORS.red : (kind === "AMMO" ? COLORS.cyan : COLORS.green)
        });
      }
    }

    draw() {
      const ctx = this.ctx;

      // Draw Background
      if (this.assetsLoaded && this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth > 0) {
        ctx.drawImage(this.bgImg, 0, 0, WIDTH, HEIGHT);
      } else {
        ctx.fillStyle = COLORS.dark;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      // Draw Starfield
      ctx.fillStyle = COLORS.white;
      this.starfield.forEach(s => {
        ctx.globalAlpha = s.alpha;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      ctx.globalAlpha = 1;

      // In-game entities
      if (this.state === "playing" || this.state === "paused" || this.state === "gameover" || this.state === "victory") {
        // Drops
        this.drops.forEach(d => {
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = COLORS.white;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = COLORS.white;
          ctx.font = "bold 10px Consolas, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(d.kind[0], d.x, d.y);
        });

        // Formation Enemies
        this.enemies.forEach(e => {
          if (e.sprite) {
            ctx.drawImage(e.sprite, e.x - e.width / 2, e.y - e.height / 2, e.width, e.height);
          } else {
            ctx.fillStyle = e.profile.color;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = COLORS.white;
            ctx.fillRect(e.x - 12, e.y - 4, 8, 8);
            ctx.fillRect(e.x + 4, e.y - 4, 8, 8);
          }
        });

        // Boss
        if (this.boss) {
          if (this.boss.sprite) {
            ctx.drawImage(this.boss.sprite, this.boss.x - this.boss.width / 2, this.boss.y, this.boss.width, this.boss.height);
          } else {
            ctx.fillStyle = COLORS.magenta;
            ctx.fillRect(this.boss.x - this.boss.width / 2, this.boss.y, this.boss.width, this.boss.height);
          }

          // Boss Health Bar
          const bw = 400;
          ctx.fillStyle = "#1e1429";
          ctx.fillRect(WIDTH / 2 - bw / 2, 20, bw, 12);
          ctx.fillStyle = COLORS.magenta;
          ctx.fillRect(WIDTH / 2 - bw / 2, 20, bw * (this.boss.hp / this.boss.max_hp), 12);
          ctx.strokeStyle = COLORS.white;
          ctx.strokeRect(WIDTH / 2 - bw / 2, 20, bw, 12);
        }

        // Player Bullets
        this.playerBullets.forEach(b => {
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x - 3, b.y, 6, 20);
        });

        // Enemy Bullets
        this.enemyBullets.forEach(b => {
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Particles
        this.particles.forEach(pt => {
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x, pt.y, 3, 3);
        });

        // Player Ship
        if (this.player) {
          const p = this.player;

          // Thruster Flames
          ctx.fillStyle = COLORS.magenta;
          ctx.beginPath();
          ctx.moveTo(p.x - 12, p.y + 25);
          ctx.lineTo(p.x + 12, p.y + 25);
          ctx.lineTo(p.x, p.y + 45 + Math.random() * 15);
          ctx.fill();

          if (this.playerSprite) {
            ctx.drawImage(this.playerSprite, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
          } else {
            // High-detail vector starship fallback
            ctx.fillStyle = COLORS.cyan;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 35);
            ctx.lineTo(p.x + 35, p.y + 25);
            ctx.lineTo(p.x + 15, p.y + 25);
            ctx.lineTo(p.x, p.y + 15);
            ctx.lineTo(p.x - 15, p.y + 25);
            ctx.lineTo(p.x - 35, p.y + 25);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = COLORS.white;
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Upgrade Halo Animation
          if (p.upgrade_anim > 0) {
            ctx.strokeStyle = COLORS.green;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 75 * (1 - p.upgrade_anim), 0, Math.PI * 2);
            ctx.stroke();
          }

          // HUD
          this.drawHUD();
        }
      }

      // Menus & State Overlays
      if (this.state === "menu") {
        this.drawMenu();
      } else if (this.state === "difficulty") {
        this.drawDifficulty();
      } else if (this.state === "paused") {
        this.drawOverlay("PAUSED", ["ESC / P: RESUME", "R: RESTART", "M: MAIN MENU"]);
      } else if (this.state === "gameover") {
        this.drawOverlay("GAME OVER", [
          `Final Score: ${this.score.toLocaleString()} PTS`,
          `Sector Wave: ${this.wave}`,
          `Enemies Annihilated: ${this.destroyed}`,
          "Press ENTER or R to Play Again"
        ]);
      }
    }

    drawHUD() {
      const ctx = this.ctx;
      const p = this.player;
      if (!p) return;

      // Health Bar
      const hw = 200;
      ctx.fillStyle = "#111824";
      ctx.fillRect(30, 25, hw, 16);
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(30, 25, hw * (p.health / p.maxHealth), 16);
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 25, hw, 16);
      ctx.fillStyle = COLORS.white;
      ctx.font = "bold 11px Consolas, monospace";
      ctx.textAlign = "left";
      ctx.fillText(`HULL ${Math.max(0, Math.ceil(p.health))}/${p.maxHealth}  |  LIVES x${p.lives}`, 35, 37);

      // Ammo Magazine (50 rounds)
      const aw = 140;
      ctx.fillStyle = "#111824";
      ctx.fillRect(250, 25, aw, 16);
      ctx.fillStyle = p.current_ammo > 0 ? COLORS.cyan : COLORS.red;
      ctx.fillRect(250, 25, aw * (p.current_ammo / p.max_ammo), 16);
      ctx.strokeRect(250, 25, aw, 16);
      ctx.fillStyle = COLORS.white;
      ctx.fillText(`ENERGY ${Math.floor(p.current_ammo)}/50`, 255, 37);

      // Laser Level
      ctx.fillStyle = COLORS.green;
      ctx.font = "bold 14px Orbitron, monospace";
      ctx.fillText(`WEAPON LVL ${p.weapon + 1}/5`, 410, 38);

      // Score & Wave
      ctx.fillStyle = COLORS.yellow;
      ctx.font = "bold 18px Orbitron, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`SCORE: ${this.score.toLocaleString()}`, WIDTH - 30, 38);

      ctx.fillStyle = COLORS.cyan;
      ctx.font = "14px Rajdhani, monospace";
      ctx.fillText(`WAVE ${this.wave}  •  ${this.diff.name}`, WIDTH - 30, 60);
    }

    drawMenu() {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(8, 11, 24, 0.88)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = COLORS.cyan;
      ctx.font = "900 52px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPACE INVASION INVADERS", WIDTH / 2, 220);

      ctx.fillStyle = COLORS.yellow;
      ctx.font = "bold 22px Rajdhani, sans-serif";
      ctx.fillText("PERSONAL ARCADE PLATFORM BY MOHAMED KAREEM", WIDTH / 2, 280);

      // Play Button Card
      ctx.fillStyle = "rgba(0, 240, 255, 0.15)";
      ctx.fillRect(WIDTH / 2 - 220, 350, 440, 65);
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 2;
      ctx.strokeRect(WIDTH / 2 - 220, 350, 440, 65);

      ctx.fillStyle = COLORS.white;
      ctx.font = "bold 24px Orbitron, sans-serif";
      ctx.fillText("▶ CLICK OR PRESS ENTER TO PLAY", WIDTH / 2, 392);

      ctx.fillStyle = "#8a99ad";
      ctx.font = "16px Inter, sans-serif";
      ctx.fillText("WASD / Arrows: Maneuver   •   Space: Fire Plasma   •   Esc: Pause", WIDTH / 2, 460);
    }

    drawDifficulty() {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(8, 11, 24, 0.94)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = COLORS.cyan;
      ctx.font = "900 38px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SELECT DIFFICULTY SECTOR", WIDTH / 2, 110);

      DIFFICULTIES.forEach((diff, i) => {
        const y = 185 + i * 58;
        const isSelected = i === this.selectedDifficultyIndex;

        if (isSelected) {
          ctx.fillStyle = "rgba(0, 240, 255, 0.2)";
          ctx.fillRect(WIDTH / 2 - 320, y - 28, 640, 48);
          ctx.strokeStyle = diff.color;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(WIDTH / 2 - 320, y - 28, 640, 48);
        }

        ctx.fillStyle = diff.color;
        ctx.font = isSelected ? "bold 22px Orbitron, sans-serif" : "18px Orbitron, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(diff.name, WIDTH / 2 - 290, y + 2);

        ctx.fillStyle = COLORS.white;
        ctx.font = "14px Inter, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(diff.desc, WIDTH / 2 + 290, y + 2);
      });

      ctx.fillStyle = COLORS.yellow;
      ctx.font = "bold 18px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Use UP/DOWN Arrows to Select  •  PRESS ENTER OR CLICK TO LAUNCH", WIDTH / 2, 635);
    }

    drawOverlay(title, lines) {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(8, 11, 24, 0.88)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = COLORS.cyan;
      ctx.font = "900 48px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(title, WIDTH / 2, 260);

      lines.forEach((line, i) => {
        ctx.fillStyle = i === 0 ? COLORS.yellow : COLORS.white;
        ctx.font = i === 0 ? "bold 22px Rajdhani, sans-serif" : "18px Inter, monospace";
        ctx.fillText(line, WIDTH / 2, 340 + i * 45);
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
        audio.init();
        this.keys[e.code] = true;

        if (this.state === "menu") {
          if (e.code === "Enter" || e.code === "Space") {
            this.state = "difficulty";
          }
        } else if (this.state === "difficulty") {
          if (e.code === "ArrowDown" || e.code === "KeyS") {
            this.selectedDifficultyIndex = (this.selectedDifficultyIndex + 1) % DIFFICULTIES.length;
          } else if (e.code === "ArrowUp" || e.code === "KeyW") {
            this.selectedDifficultyIndex = (this.selectedDifficultyIndex - 1 + DIFFICULTIES.length) % DIFFICULTIES.length;
          } else if (e.code === "Enter" || e.code === "Space") {
            this.startNewGame();
          } else if (e.code === "Escape") {
            this.state = "menu";
          }
        } else if (this.state === "playing") {
          if (e.code === "Escape" || e.code === "KeyP") {
            this.state = "paused";
          }
        } else if (this.state === "paused") {
          if (e.code === "Escape" || e.code === "KeyP") {
            this.state = "playing";
          } else if (e.code === "KeyR") {
            this.startNewGame();
          } else if (e.code === "KeyM") {
            this.state = "menu";
          }
        } else if (this.state === "gameover" || this.state === "victory") {
          if (e.code === "KeyR" || e.code === "Enter" || e.code === "Space") {
            this.startNewGame();
          } else if (e.code === "Escape") {
            this.state = "menu";
          }
        }
      });

      window.addEventListener("keyup", e => {
        this.keys[e.code] = false;
      });

      this.canvas.addEventListener("click", e => {
        audio.init();
        if (this.state === "menu") {
          this.state = "difficulty";
        } else if (this.state === "difficulty") {
          const rect = this.canvas.getBoundingClientRect();
          const scaleY = this.canvas.height / rect.height;
          const my = (e.clientY - rect.top) * scaleY;

          DIFFICULTIES.forEach((d, i) => {
            const y = 185 + i * 58;
            if (my >= y - 28 && my <= y + 20) {
              this.selectedDifficultyIndex = i;
            }
          });
          this.startNewGame();
        } else if (this.state === "gameover") {
          this.startNewGame();
        }
      });
    }
  }

  window.SpaceInvadersGame = SpaceInvadersGame;
})();
