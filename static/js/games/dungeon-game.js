/**
 * MOHAMED KAREEM GAMES - DUNGEON: THE HOLLOW CROWN
 * 
 * Native HTML5 Canvas Engine ported 1:1 from engine.py and main.py
 */

// Safe polyfill for roundRect across all browsers
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    if (!radii) radii = 0;
    const r = typeof radii === "number" ? radii : (Array.isArray(radii) ? (radii[0] || 0) : 0);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    return this;
  };
}

class DungeonGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");

    this.WIDTH = 49;
    this.HEIGHT = 35;
    this.FLOOR_NAMES = [
      "The Forgotten Gate",
      "Mossbound Halls",
      "The Sunken Keep",
      "Ember Vault",
      "The Hollow Throne"
    ];

    // Colors matching main.py
    this.C = {
      bg: "#080c13",
      panel: "#141b25",
      edge: "#303c49",
      text: "#e0e3da",
      muted: "#8999a0",
      gold: "#f5ba42",
      teal: "#5effeb",
      red: "#d75f5b",
      green: "#76a74d"
    };

    // Canvas internal logical resolution
    this.canvas.width = 1280;
    this.canvas.height = 800;

    this.time = 0;
    this.flash = 0;
    this.facing = 0; // 0=down, 1=up, 2=left, 3=right
    this.mode = "game"; // "game", "paused", "guide", "gameover", "victory"
    this.paused = false;

    // Audio synthesizer
    this.initAudio();

    // Check for saved run or start fresh
    this.initRun();

    // Setup input listeners
    this.setupControls();

    // Start render loop
    this.lastFrameTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // --- Synthesized Web Audio API ---
  initAudio() {
    this.audioCtx = null;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  }

  ensureAudio() {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  beep(type) {
    if (!this.audioCtx) return;
    this.ensureAudio();

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === "step") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(160, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === "hit") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(95, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === "loot") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.setValueAtTime(880, now + 0.06);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === "heal") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.2);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "stairs") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.1);
        osc.frequency.setValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "bow") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    } catch (e) {}
  }

  // --- Procedural Generation & Run State ---
  initRun(seed = null) {
    const saved = this.loadSave();
    if (saved && !seed) {
      this.restoreRun(saved);
      return;
    }

    this.seed = seed !== null ? seed : Math.floor(Math.random() * 1000000);
    this.floor = 1;
    this.hp = 80;
    this.max_hp = 80;
    this.gold = 0;
    this.xp = 0;
    this.kills = 0;
    this.turns = 0;
    this.level = 1;
    this.weapon = 0;
    this.armor = 0;
    this.potions = 3;
    this.food = 2;
    this.arrows = 12;
    this.hunger = 100;
    this.dead = false;
    this.won = false;
    this.messages = ["Find the stairs. Survive five floors. Claim the crown."];

    this.generateFloor();
    this.saveGame();
  }

  // Seeded Pseudo-Random Number Generator (Mulberry32)
  createRng(seedVal) {
    let s = (seedVal >>> 0) || 1;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  say(msg) {
    this.messages.push(msg);
    if (this.messages.length > 6) {
      this.messages.shift();
    }
  }

  generateFloor() {
    const rng = this.createRng(this.seed + this.floor * 1009);
    this.rng = rng;

    // 0 = wall, 1 = floor
    this.tiles = Array.from({ length: this.HEIGHT }, () => new Array(this.WIDTH).fill(0));
    this.rooms = [];

    // Attempt 110 room placements (matching engine.py)
    for (let i = 0; i < 110; i++) {
      const w = Math.floor(rng() * 6) + 5; // 5..10
      const h = Math.floor(rng() * 4) + 5; // 5..8
      const x = Math.floor(rng() * (this.WIDTH - w - 4)) + 2;
      const y = Math.floor(rng() * (this.HEIGHT - h - 4)) + 2;

      // Overlap check
      const overlaps = this.rooms.some(([rx, ry, rw, rh]) => 
        x < rx + rw + 2 && x + w + 2 > rx && y < ry + rh + 2 && y + h + 2 > ry
      );
      if (overlaps) continue;

      // Carve room
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          this.tiles[yy][xx] = 1;
        }
      }

      // Connect to previous room via L-corridor
      if (this.rooms.length > 0) {
        const [px, py, pw, ph] = this.rooms[this.rooms.length - 1];
        const prevCenter = [px + Math.floor(pw / 2), py + Math.floor(ph / 2)];
        const center = [x + Math.floor(w / 2), y + Math.floor(h / 2)];

        const minX = Math.min(prevCenter[0], center[0]);
        const maxX = Math.max(prevCenter[0], center[0]);
        for (let xx = minX; xx <= maxX; xx++) {
          this.tiles[prevCenter[1]][xx] = 1;
        }

        const minY = Math.min(prevCenter[1], center[1]);
        const maxY = Math.max(prevCenter[1], center[1]);
        for (let yy = minY; yy <= maxY; yy++) {
          this.tiles[yy][center[0]] = 1;
        }
      }

      this.rooms.push([x, y, w, h]);
    }

    // Player start in room 0
    const [startRx, startRy, startRw, startRh] = this.rooms[0];
    this.x = startRx + Math.floor(startRw / 2);
    this.y = startRy + Math.floor(startRh / 2);

    // Stairs in last room
    const [exitRx, exitRy, exitRw, exitRh] = this.rooms[this.rooms.length - 1];
    this.stairs = [exitRx + Math.floor(exitRw / 2), exitRy + Math.floor(exitRh / 2)];

    // Collect available floor cells for enemies & loot
    const cells = [];
    for (let y = 0; y < this.HEIGHT; y++) {
      for (let x = 0; x < this.WIDTH; x++) {
        if (this.walkable(x, y)) {
          const distToPlayer = Math.abs(x - this.x) + Math.abs(y - this.y);
          if (distToPlayer > 5 && !(x === this.stairs[0] && y === this.stairs[1])) {
            cells.push([x, y]);
          }
        }
      }
    }

    // Shuffle cells
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    // Spawn Enemies
    this.enemies = [];
    const enemyCount = 6 + this.floor * 2;
    for (let i = 0; i < enemyCount && cells.length > 0; i++) {
      const [ex, ey] = cells.pop();
      const kind = Math.floor(rng() * Math.min(3, this.floor + 1));
      const hp = 13 + kind * 6 + this.floor * 3;
      this.enemies.push({
        x: ex,
        y: ey,
        kind: kind,
        hp: hp,
        maximum: hp,
        boss: false
      });
    }

    // Floor 5 Guardian Boss at stairs
    if (this.floor === 5) {
      this.enemies.push({
        x: this.stairs[0],
        y: this.stairs[1],
        kind: 2,
        hp: 110,
        maximum: 110,
        boss: true
      });
    }

    // Spawn Loot Items
    this.loot = {};
    const lootList = [
      "chest", "chest", "chest", "chest", "chest",
      "potion", "potion", "potion",
      "food", "food", "food",
      "gold", "gold", "gold", "gold", "gold", "gold", "gold",
      "arrows", "arrows"
    ];
    for (const item of lootList) {
      if (cells.length > 0) {
        const [lx, ly] = cells.pop();
        this.loot[`${lx},${ly}`] = item;
      }
    }

    // Spawn Traps
    this.traps = new Set();
    const trapCount = 3 + this.floor;
    for (let i = 0; i < trapCount && cells.length > 0; i++) {
      const [tx, ty] = cells.pop();
      this.traps.add(`${tx},${ty}`);
    }

    this.seen = new Set();
    this.visible = new Set();
    this.reveal();
  }

  walkable(x, y) {
    return x >= 0 && x < this.WIDTH && y >= 0 && y < this.HEIGHT && this.tiles[y][x] === 1;
  }

  // Bresenham line-of-sight
  line(a, b) {
    let x = a[0], y = a[1];
    const tx = b[0], ty = b[1];
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;

    while (x !== tx || y !== ty) {
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if (!this.walkable(x, y) && !(x === tx && y === ty)) {
        return false;
      }
    }
    return true;
  }

  reveal() {
    this.visible = new Set();
    const radius = 8;
    const r2 = radius * radius;

    const minY = Math.max(0, this.y - radius);
    const maxY = Math.min(this.HEIGHT - 1, this.y + radius);
    const minX = Math.max(0, this.x - radius);
    const maxX = Math.min(this.WIDTH - 1, this.x + radius);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d2 = (x - this.x) * (x - this.x) + (y - this.y) * (y - this.y);
        if (d2 <= r2) {
          if (this.line([this.x, this.y], [x, y])) {
            const key = `${x},${y}`;
            this.visible.add(key);
            this.seen.add(key);
          } else {
            // Check cardinal neighbors for wall sightlines
            const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dy] of neighbors) {
              const nx = x + dx, ny = y + dy;
              if (this.walkable(nx, ny) && this.line([this.x, this.y], [nx, ny])) {
                const key = `${x},${y}`;
                this.visible.add(key);
                this.seen.add(key);
                break;
              }
            }
          }
        }
      }
    }
  }

  get attack() {
    return 8 + this.weapon * 3 + this.level * 2;
  }

  hurtEnemy(enemy, damage) {
    enemy.hp -= damage;
    this.beep("hit");
    this.say(`${enemy.boss ? "Guardian" : "Orc"} takes ${damage} damage.`);

    if (enemy.hp <= 0) {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) this.enemies.splice(idx, 1);
      this.kills += 1;
      this.gold += 7 + this.floor * 3;
      this.xp += enemy.boss ? 75 : 14;

      if (enemy.boss) {
        this.say("The guardian falls! The Hollow Crown is yours!");
      } else {
        this.say("Enemy defeated. Gold recovered.");
      }

      // Level progression check
      const nextXp = this.level * 35;
      if (this.xp >= nextXp) {
        this.xp -= nextXp;
        this.level += 1;
        this.max_hp += 10;
        this.hp = Math.min(this.max_hp, this.hp + 25);
        this.beep("stairs");
        this.say(`Level ${this.level}! Strength and vitality increased.`);
      }
    }
  }

  pickup() {
    const key = `${this.x},${this.y}`;
    const item = this.loot[key];
    if (!item) return;

    delete this.loot[key];
    this.beep("loot");

    if (item === "gold") {
      const n = Math.floor(Math.random() * 15) + 8;
      this.gold += n;
      this.say(`Found ${n} gold coins.`);
    } else if (item === "potion") {
      this.potions += 1;
      this.say("Healing potion collected. [Q] to drink.");
    } else if (item === "food") {
      this.food += 1;
      this.say("Rations collected. [F] to eat.");
    } else if (item === "arrows") {
      this.arrows += 6;
      this.say("Six arrows collected. [B] to shoot.");
    } else if (item === "chest") {
      this.gold += 20;
      if (Math.random() < 0.6) {
        this.weapon += 1;
        this.say(`Chest: Weapon upgraded to +${this.weapon}, and 20 gold!`);
      } else {
        this.armor += 1;
        this.say(`Chest: Armor upgraded to +${this.armor}, and 20 gold!`);
      }
    }
  }

  // Act on turn
  act(action, dx = 0, dy = 0) {
    if (this.dead || this.won) return false;
    this.ensureAudio();

    if (action === "move") {
      const tx = this.x + dx;
      const ty = this.y + dy;

      if (dx === 1) this.facing = 3;
      else if (dx === -1) this.facing = 2;
      else if (dy === 1) this.facing = 0;
      else if (dy === -1) this.facing = 1;

      if (!this.walkable(tx, ty)) return false;

      // Enemy in tile -> melee combat
      const enemy = this.enemies.find(e => e.x === tx && e.y === ty);
      if (enemy) {
        const variance = Math.floor(Math.random() * 6) - 2;
        this.hurtEnemy(enemy, this.attack + variance);
      } else {
        this.x = tx;
        this.y = ty;
        this.beep("step");
        this.pickup();

        const key = `${tx},${ty}`;
        if (this.traps.has(key)) {
          this.hp -= 7;
          this.traps.delete(key);
          this.flash = 0.8;
          this.beep("hit");
          this.say("A hidden spike trap! -7 health.");
        }
      }
    } else if (action === "potion") {
      if (this.potions <= 0 || this.hp >= this.max_hp) {
        this.say(this.hp >= this.max_hp ? "Vitality already full." : "No potions left.");
        return false;
      }
      this.potions -= 1;
      this.hp = Math.min(this.max_hp, this.hp + 40);
      this.beep("heal");
      this.say("Potion consumed: +40 health restored.");
    } else if (action === "food") {
      if (this.food <= 0) {
        this.say("No rations left in pack.");
        return false;
      }
      this.food -= 1;
      this.hunger = 100;
      this.hp = Math.min(this.max_hp, this.hp + 12);
      this.beep("heal");
      this.say("Rations eaten: hunger satisfied, +12 health.");
    } else if (action === "bow") {
      const targets = this.enemies.filter(e => 
        this.visible.has(`${e.x},${e.y}`) && this.line([this.x, this.y], [e.x, e.y])
      );
      if (targets.length === 0 || this.arrows <= 0) {
        this.say(this.arrows <= 0 ? "Out of arrows!" : "No visible targets with clear line of sight.");
        return false;
      }
      // Target nearest enemy
      targets.sort((a, b) => 
        (Math.abs(a.x - this.x) + Math.abs(a.y - this.y)) - (Math.abs(b.x - this.x) + Math.abs(b.y - this.y))
      );
      const target = targets[0];
      this.arrows -= 1;
      this.beep("bow");
      this.hurtEnemy(target, this.attack + 5);
    } else if (action === "descend") {
      if (this.x !== this.stairs[0] || this.y !== this.stairs[1]) {
        this.say("You must stand on the stairs to descend.");
        return false;
      }
      if (this.floor === 5) {
        if (this.enemies.some(e => e.boss)) {
          this.say("Defeat the Guardian before claiming the Hollow Crown!");
          return false;
        }
        this.won = true;
        this.beep("stairs");
        this.say("You conquered the dungeon and claimed the Hollow Crown!");
        this.saveGame();
        return true;
      }
      this.floor += 1;
      this.hp = Math.min(this.max_hp, this.hp + 15);
      this.beep("stairs");
      this.generateFloor();
      this.say(`Floor ${this.floor}: ${this.FLOOR_NAMES[this.floor - 1]}. +15 health.`);
      this.saveGame();
      return true;
    } else if (action !== "wait") {
      return false;
    }

    // Turn resolution
    this.turns += 1;
    if (this.turns % 8 === 0) {
      this.hunger = Math.max(0, this.hunger - 1);
    }
    if (this.hunger === 0) {
      this.hp -= 1;
      this.flash = 0.4;
      this.say("Starvation drains 1 vitality.");
    }

    this.enemyTurn();

    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.beep("hit");
      this.say("Your journey ends here. A new expedition awaits.");
      this.clearSave();
    } else {
      this.saveGame();
    }

    this.reveal();
    return true;
  }

  // Reverse BFS enemy pathfinding & attack
  enemyTurn() {
    const queue = [[this.x, this.y]];
    const distance = { [`${this.x},${this.y}`]: 0 };

    while (queue.length > 0) {
      const [qx, qy] = queue.shift();
      const currentDist = distance[`${qx},${qy}`];
      if (currentDist >= 12) continue;

      const cardinals = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of cardinals) {
        const nx = qx + dx, ny = qy + dy;
        const key = `${nx},${ny}`;
        if (this.walkable(nx, ny) && distance[key] === undefined) {
          distance[key] = currentDist + 1;
          queue.push([nx, ny]);
        }
      }
    }

    const occupied = new Set(this.enemies.map(e => `${e.x},${e.y}`));

    for (const e of this.enemies) {
      const eKey = `${e.x},${e.y}`;
      const d = distance[eKey] !== undefined ? distance[eKey] : 99;

      if (d === 1) {
        // Melee attack player
        const randDmg = Math.floor(Math.random() * 4) + 1;
        let damage = Math.max(1, this.floor + e.kind + randDmg - this.armor);
        if (e.boss) damage += 4;
        this.hp -= damage;
        this.flash = 0.9;
        this.beep("hit");
        this.say(`${e.boss ? "Guardian" : "Orc"} strikes you for ${damage} damage.`);
      } else if (d <= 9) {
        // Step towards player along shortest distance
        const cardinals = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const options = [];

        for (const [dx, dy] of cardinals) {
          const nx = e.x + dx, ny = e.y + dy;
          const nKey = `${nx},${ny}`;
          const nDist = distance[nKey] !== undefined ? distance[nKey] : 99;
          if (nDist < d && !occupied.has(nKey) && !(nx === this.x && ny === this.y)) {
            options.push({ pos: [nx, ny], dist: nDist });
          }
        }

        if (options.length > 0) {
          options.sort((a, b) => a.dist - b.dist);
          occupied.delete(eKey);
          e.x = options[0].pos[0];
          e.y = options[0].pos[1];
          occupied.add(`${e.x},${e.y}`);
        }
      }
    }
  }

  // --- LocalStorage Save / Restore ---
  saveGame() {
    if (this.dead || this.won) return;
    try {
      const state = {
        seed: this.seed,
        floor: this.floor,
        hp: this.hp,
        max_hp: this.max_hp,
        gold: this.gold,
        xp: this.xp,
        kills: this.kills,
        turns: this.turns,
        level: this.level,
        weapon: this.weapon,
        armor: this.armor,
        potions: this.potions,
        food: this.food,
        arrows: this.arrows,
        hunger: this.hunger,
        dead: this.dead,
        won: this.won,
        x: this.x,
        y: this.y,
        messages: this.messages,
        enemies: this.enemies,
        loot: Object.entries(this.loot).map(([k, v]) => {
          const [lx, ly] = k.split(",").map(Number);
          return [lx, ly, v];
        }),
        traps: Array.from(this.traps),
        seen: Array.from(this.seen),
        savedAt: new Date().toISOString()
      };
      localStorage.setItem("dungeon-hollow-crown-v1", JSON.stringify(state));
    } catch (e) {}
  }

  loadSave() {
    try {
      const raw = localStorage.getItem("dungeon-hollow-crown-v1");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  clearSave() {
    try {
      localStorage.removeItem("dungeon-hollow-crown-v1");
    } catch (e) {}
  }

  restoreRun(data) {
    try {
      if (!data || isNaN(Number(data.seed)) || isNaN(Number(data.floor)) || isNaN(Number(data.hp))) {
        this.clearSave();
        this.initRun(Math.floor(Math.random() * 1000000));
        return;
      }

      this.seed = Number(data.seed);
      this.floor = Number(data.floor) || 1;
      this.generateFloor();

      this.hp = Number(data.hp) || 80;
      this.max_hp = Number(data.max_hp) || 80;
      this.gold = Number(data.gold) || 0;
      this.xp = Number(data.xp) || 0;
      this.kills = Number(data.kills) || 0;
      this.turns = Number(data.turns) || 0;
      this.level = Number(data.level) || 1;
      this.weapon = Number(data.weapon) || 0;
      this.armor = Number(data.armor) || 0;
      this.potions = Number(data.potions) || 3;
      this.food = Number(data.food) || 2;
      this.arrows = Number(data.arrows) || 12;
      this.hunger = Number(data.hunger) !== undefined ? Number(data.hunger) : 100;
      this.dead = Boolean(data.dead);
      this.won = Boolean(data.won);
      if (!isNaN(Number(data.x)) && !isNaN(Number(data.y))) {
        this.x = Number(data.x);
        this.y = Number(data.y);
      }
      this.messages = Array.isArray(data.messages) ? data.messages : [];
      if (Array.isArray(data.enemies) && data.enemies.length > 0) {
        this.enemies = data.enemies;
      }

      this.loot = {};
      if (Array.isArray(data.loot)) {
        for (const entry of data.loot) {
          if (Array.isArray(entry) && entry.length >= 3) {
            this.loot[`${entry[0]},${entry[1]}`] = entry[2];
          }
        }
      } else if (data.loot && typeof data.loot === "object") {
        this.loot = data.loot;
      }

      if (Array.isArray(data.traps)) {
        this.traps = new Set(data.traps);
      }
      if (Array.isArray(data.seen)) {
        this.seen = new Set(data.seen);
      }
      this.reveal();
    } catch (err) {
      console.warn("Failed to restore save, resetting run:", err);
      this.clearSave();
      this.initRun(Math.floor(Math.random() * 1000000));
    }
  }

  // --- Keyboard Controls ---
  setupControls() {
    window.addEventListener("keydown", (e) => {
      // Prevent browser scroll on arrows / space
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }

      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        this.paused = !this.paused;
        return;
      }

      if (e.key === "i" || e.key === "I") {
        this.mode = this.mode === "guide" ? "game" : "guide";
        return;
      }

      if (this.dead || this.won) {
        if (e.key === "Enter" || e.key === "r" || e.key === "R") {
          this.clearSave();
          this.initRun(Math.floor(Math.random() * 1000000));
        }
        return;
      }

      if (this.paused || this.mode === "guide") return;

      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          this.act("move", 0, -1);
          break;
        case "s":
        case "arrowdown":
          this.act("move", 0, 1);
          break;
        case "a":
        case "arrowleft":
          this.act("move", -1, 0);
          break;
        case "d":
        case "arrowright":
          this.act("move", 1, 0);
          break;
        case "b":
          this.act("bow");
          break;
        case "q":
          this.act("potion");
          break;
        case "f":
          this.act("food");
          break;
        case " ":
          this.act("wait");
          break;
        case "e":
          this.act("descend");
          break;
      }
    });

    // Mouse click handling for HUD buttons
    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      // Pause button at (1090, 27, 166, 48)
      if (mx >= 1090 && mx <= 1256 && my >= 27 && my <= 75) {
        this.paused = !this.paused;
        return;
      }

      // If gameover/victory, click restarts
      if (this.dead || this.won) {
        if (my >= 480 && my <= 550) {
          this.clearSave();
          this.initRun(Math.floor(Math.random() * 1000000));
        }
      }
    });
  }

  // --- Render Loop ---
  loop(timestamp) {
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;
    this.time += dt;

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.5);
    }

    this.render();
    requestAnimationFrame(this.loop);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Deep background fill
    ctx.fillStyle = this.C.bg;
    ctx.fillRect(0, 0, 1280, 800);

    // Render Components
    this.renderHeader();
    this.renderWorld();
    this.renderSidebar();

    // Flash Overlay when damaged
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(180, 35, 40, ${this.flash * 0.4})`;
      ctx.fillRect(24, 110, 928, 576);
    }

    // Modal Overlays
    if (this.paused) {
      this.renderPauseOverlay();
    } else if (this.mode === "guide") {
      this.renderGuideOverlay();
    } else if (this.dead) {
      this.renderDeathOverlay();
    } else if (this.won) {
      this.renderVictoryOverlay();
    }
  }

  // --- HUD Header ---
  renderHeader() {
    const ctx = this.ctx;

    // Title
    ctx.fillStyle = this.C.gold;
    ctx.font = "bold 38px 'Orbitron', 'Segoe UI', sans-serif";
    ctx.fillText("DUNGEON", 26, 52);

    ctx.fillStyle = this.C.muted;
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillText("T H E   H O L L O W   C R O W N", 28, 76);
    ctx.letterSpacing = "0px";

    // Depth & Seed
    ctx.fillStyle = this.C.text;
    ctx.font = "bold 22px 'Orbitron', sans-serif";
    ctx.fillText(`DEPTH  0${this.floor} / 05`, 660, 48);

    ctx.fillStyle = this.C.muted;
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.fillText(`SEED ${this.seed.toString().padStart(6, "0")}`, 662, 72);

    // Pause Button
    ctx.fillStyle = this.C.panel;
    ctx.strokeStyle = this.C.edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(1090, 27, 166, 48, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.C.gold;
    ctx.font = "bold 16px 'Segoe UI', sans-serif";
    ctx.fillText("Pause  [Esc]", 1130, 58);
  }

  // --- World Viewport (928 x 576 px at 24, 110) ---
  renderWorld() {
    const ctx = this.ctx;
    const ox = 24, oy = 110;
    const cols = 29, rows = 18;
    const tileSize = 32;

    // Camera centered on player
    const camX = Math.max(0, Math.min(this.WIDTH - cols, this.x - Math.floor(cols / 2)));
    const camY = Math.max(0, Math.min(this.HEIGHT - rows, this.y - Math.floor(rows / 2)));

    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, cols * tileSize, rows * tileSize);
    ctx.clip();

    // Base dark pit
    ctx.fillStyle = "#06090e";
    ctx.fillRect(ox, oy, cols * tileSize, rows * tileSize);

    // Tiles
    for (let sy = 0; sy < rows; sy++) {
      for (let sx = 0; sx < cols; sx++) {
        const wx = camX + sx;
        const wy = camY + sy;
        const px = ox + sx * tileSize;
        const py = oy + sy * tileSize;
        const key = `${wx},${wy}`;

        if (!this.seen.has(key)) continue;

        const isVis = this.visible.has(key);

        if (this.walkable(wx, wy)) {
          // Stone Floor Tile
          const checker = (wx + wy) % 2;
          ctx.fillStyle = checker ? "#2a3442" : "#242d3a";
          ctx.fillRect(px, py, tileSize, tileSize);

          ctx.strokeStyle = "rgba(40, 55, 75, 0.4)";
          ctx.strokeRect(px, py, tileSize, tileSize);

          // Floor cracks / moss
          if ((wx * 17 + wy * 13) % 41 === 0) {
            ctx.fillStyle = "rgba(42, 74, 68, 0.6)";
            ctx.fillRect(px + 4, py + 18, 8, 2);
          }

          // Traps (if visible and player nearby)
          if (this.traps.has(key) && isVis && (Math.abs(wx - this.x) + Math.abs(wy - this.y) <= 2)) {
            ctx.fillStyle = "#96877d";
            for (let n = 0; n < 3; n++) {
              ctx.beginPath();
              ctx.moveTo(px + 6 + n * 8, py + 24);
              ctx.lineTo(px + 9 + n * 8, py + 15);
              ctx.lineTo(px + 12 + n * 8, py + 24);
              ctx.fill();
            }
          }

          // Stairs
          if (wx === this.stairs[0] && wy === this.stairs[1]) {
            ctx.fillStyle = "#1b4248";
            ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);

            // Glowing teal steps
            ctx.strokeStyle = this.C.teal;
            ctx.lineWidth = 2;
            for (let n = 0; n < 4; n++) {
              ctx.beginPath();
              ctx.moveTo(px + 6, py + 8 + n * 5);
              ctx.lineTo(px + 14 + n * 3, py + 8 + n * 5);
              ctx.stroke();
            }

            // Pulsing aura on stairs
            const pulse = (Math.sin(this.time * 4) + 1) * 0.15 + 0.1;
            ctx.fillStyle = `rgba(94, 255, 235, ${pulse})`;
            ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
          }

          // Loot
          if (this.loot[key] && isVis) {
            this.drawLoot(this.loot[key], px, py);
          }
        } else {
          // Solid Stone Wall
          ctx.fillStyle = "#434553";
          ctx.fillRect(px, py, tileSize, tileSize);

          ctx.fillStyle = "#595a63";
          ctx.fillRect(px, py + 2, tileSize, 2);

          ctx.fillStyle = "#1f222e";
          ctx.fillRect(px, py + tileSize - 3, tileSize, 3);

          // Wall torch sconces
          if ((wx * 7 + wy) % 7 === 0 && this.walkable(wx, wy + 1)) {
            ctx.fillStyle = "#4d3728";
            ctx.fillRect(px + 14, py + 14, 4, 12);

            const r = 5 + Math.sin(this.time * 12 + wx) * 1.5;
            ctx.fillStyle = "rgba(255, 140, 40, 0.9)";
            ctx.beginPath();
            ctx.arc(px + 16, py + 12, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#ffe29a";
            ctx.beginPath();
            ctx.arc(px + 16, py + 11, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Fog of War Shading
        if (!isVis) {
          ctx.fillStyle = "rgba(4, 8, 17, 0.72)";
          ctx.fillRect(px, py, tileSize, tileSize);
        } else {
          // Slight distance falloff darkness
          const dist = Math.hypot(wx - this.x, wy - this.y);
          const falloff = Math.min(1, dist / 8);
          ctx.fillStyle = `rgba(4, 8, 17, ${falloff * 0.35})`;
          ctx.fillRect(px, py, tileSize, tileSize);
        }
      }
    }

    // Render Enemies
    for (const e of this.enemies) {
      const eKey = `${e.x},${e.y}`;
      if (this.visible.has(eKey)) {
        const epx = ox + (e.x - camX) * tileSize;
        const epy = oy + (e.y - camY) * tileSize;
        this.drawEnemy(e, epx, epy);
      }
    }

    // Render Player Knight
    const ppx = ox + (this.x - camX) * tileSize;
    const ppy = oy + (this.y - camY) * tileSize;
    this.drawHero(ppx, ppy);

    ctx.restore();

    // Viewport Border Frame
    ctx.strokeStyle = this.C.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 1, oy - 1, cols * tileSize + 2, rows * tileSize + 2);

    // Floor Subtitle
    ctx.fillStyle = this.C.muted;
    ctx.font = "bold 13px 'Orbitron', sans-serif";
    ctx.fillText(`EXPLORE  /  ${this.FLOOR_NAMES[this.floor - 1].toUpperCase()}`, 40, 134);
  }

  // Draw Loot Item
  drawLoot(kind, x, y) {
    const ctx = this.ctx;
    const bob = Math.sin(this.time * 3 + x) * 2.5;

    if (kind === "chest") {
      ctx.fillStyle = "#89562b";
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 8, 24, 18, 3);
      ctx.fill();

      ctx.fillStyle = this.C.gold;
      ctx.fillRect(x + 13, y + 11, 6, 12);
      ctx.fillStyle = "#ffe29a";
      ctx.fillRect(x + 15, y + 15, 2, 3);
    } else if (kind === "potion") {
      ctx.fillStyle = "#c0ceca";
      ctx.fillRect(x + 12, y + 5 + bob, 8, 5);

      ctx.fillStyle = "#d75970";
      ctx.beginPath();
      ctx.roundRect(x + 9, y + 10 + bob, 14, 14, 4);
      ctx.fill();

      ctx.fillStyle = "#ffb2ba";
      ctx.fillRect(x + 12, y + 12 + bob, 3, 7);
    } else if (kind === "food") {
      ctx.fillStyle = "#be8b4b";
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 18 + bob, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#f1cb82";
      ctx.lineWidth = 1.5;
      for (let n = 0; n < 3; n++) {
        ctx.beginPath();
        ctx.moveTo(x + 11 + n * 5, y + 15 + bob);
        ctx.lineTo(x + 13 + n * 5, y + 21 + bob);
        ctx.stroke();
      }
    } else if (kind === "gold") {
      ctx.fillStyle = "#936a30";
      ctx.beginPath();
      ctx.arc(x + 12, y + 20 + bob, 5, 0, Math.PI * 2);
      ctx.arc(x + 20, y + 15 + bob, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.C.gold;
      ctx.beginPath();
      ctx.arc(x + 12, y + 18 + bob, 4.5, 0, Math.PI * 2);
      ctx.arc(x + 20, y + 13 + bob, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "arrows") {
      ctx.strokeStyle = this.C.gold;
      ctx.lineWidth = 2;
      for (const dx of [10, 16, 22]) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + 24);
        ctx.lineTo(x + dx + 4, y + 9);
        ctx.stroke();
      }
    }
  }

  // Draw Enemy Orc
  drawEnemy(e, x, y) {
    const ctx = this.ctx;
    const isBoss = e.boss;

    // Sprite silhouette
    ctx.fillStyle = isBoss ? "#e11d48" : (e.kind === 0 ? "#76a74d" : (e.kind === 1 ? "#5e8a38" : "#8a4f2e"));
    ctx.beginPath();
    ctx.arc(x + 16, y + 14, isBoss ? 16 : 11, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#080c13";
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 20, y + 12, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Tusks / Horns
    ctx.fillStyle = "#e0e3da";
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 17);
    ctx.lineTo(x + 11, y + 21);
    ctx.lineTo(x + 13, y + 18);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 23, y + 17);
    ctx.lineTo(x + 21, y + 21);
    ctx.lineTo(x + 19, y + 18);
    ctx.fill();

    // Boss Crown / Spikes
    if (isBoss) {
      ctx.fillStyle = this.C.gold;
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 2);
      ctx.lineTo(x + 11, y + 4);
      ctx.lineTo(x + 16, y - 6);
      ctx.lineTo(x + 21, y + 4);
      ctx.lineTo(x + 26, y - 2);
      ctx.lineTo(x + 24, y + 6);
      ctx.lineTo(x + 8, y + 6);
      ctx.closePath();
      ctx.fill();
    }

    // Health Bar
    if (e.hp < e.maximum || isBoss) {
      const barW = isBoss ? 40 : 28;
      const bx = isBoss ? x - 4 : x + 2;
      ctx.fillStyle = "#27191e";
      ctx.fillRect(bx, y - 8, barW, 4);

      const fillW = Math.max(0, Math.floor((barW * e.hp) / e.maximum));
      ctx.fillStyle = isBoss ? "#ff0055" : this.C.red;
      ctx.fillRect(bx, y - 8, fillW, 4);
    }
  }

  // Draw Hero Knight
  drawHero(x, y) {
    const ctx = this.ctx;

    // Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(x + 16, y + 28, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body Armor
    ctx.fillStyle = "#4a949c"; // Teal tunic
    ctx.fillRect(x + 10, y + 10, 12, 12);

    // Steel Plate Armor
    ctx.fillStyle = "#a9bcc4";
    ctx.fillRect(x + 12, y + 11, 8, 8);

    // Helmet
    ctx.fillStyle = "#d6e1df";
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 2, 12, 10, [4, 4, 1, 1]);
    ctx.fill();

    // Helmet Visor Slit
    ctx.fillStyle = "#212b36";
    ctx.fillRect(x + 12, y + 6, 8, 2);

    // Golden Plume on Helmet
    ctx.fillStyle = this.C.gold;
    ctx.fillRect(x + 15, y - 2, 3, 5);

    // Golden Cape / Shoulders
    ctx.fillStyle = "#bc924d";
    ctx.fillRect(x + 8, y + 11, 3, 10);
    ctx.fillRect(x + 21, y + 11, 3, 10);
  }

  // --- Right Sidebar (Stats & Minimap) ---
  renderSidebar() {
    const ctx = this.ctx;
    const px = 974, py = 110;
    const pw = 282, ph = 577;

    // Outer Panel
    ctx.fillStyle = this.C.panel;
    ctx.strokeStyle = this.C.edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.stroke();

    // Character Header
    ctx.fillStyle = this.C.gold;
    ctx.font = "bold 24px 'Orbitron', sans-serif";
    ctx.fillText("THE WANDERER", px + 20, py + 36);

    ctx.fillStyle = this.C.muted;
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.fillText(`Level ${this.level}   •   ${this.xp} / ${this.level * 35} XP`, px + 20, py + 62);

    // Vitality (HP) Bar
    this.renderBar("VITALITY", this.hp, this.max_hp, py + 86, this.C.red);

    // Hunger Bar
    this.renderBar("HUNGER", this.hunger, 100, py + 142, this.C.gold);

    // Stats Grid
    ctx.fillStyle = this.C.text;
    ctx.font = "bold 14px 'Segoe UI', sans-serif";

    ctx.fillText(`⚔️ Weapon: +${this.weapon}`, px + 20, py + 215);
    ctx.fillText(`🛡️ Armor: +${this.armor}`, px + 150, py + 215);

    ctx.fillText(`🧪 Potions [Q]: ${this.potions}`, px + 20, py + 242);
    ctx.fillText(`🍗 Food [F]: ${this.food}`, px + 150, py + 242);

    ctx.fillText(`🏹 Arrows [B]: ${this.arrows}`, px + 20, py + 269);
    ctx.fillText(`💰 Gold: ${this.gold}`, px + 150, py + 269);

    // Minimap Header
    ctx.fillStyle = this.C.muted;
    ctx.font = "bold 13px 'Orbitron', sans-serif";
    ctx.fillText("THE KNOWN DEPTHS", px + 20, py + 312);

    // Minimap Canvas (49 x 35 cells at 4px per cell = 196 x 140)
    const mx = px + 42, my = py + 328;
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(mx - 4, my - 4, this.WIDTH * 4 + 8, this.HEIGHT * 4 + 8);
    ctx.strokeStyle = this.C.edge;
    ctx.strokeRect(mx - 4, my - 4, this.WIDTH * 4 + 8, this.HEIGHT * 4 + 8);

    for (let y = 0; y < this.HEIGHT; y++) {
      for (let x = 0; x < this.WIDTH; x++) {
        const key = `${x},${y}`;
        if (this.seen.has(key)) {
          if (this.walkable(x, y)) {
            ctx.fillStyle = this.visible.has(key) ? "#5c7377" : "#2b3943";
            ctx.fillRect(mx + x * 4, my + y * 4, 3, 3);
          }
        }
      }
    }

    // Minimap Stairs
    const [sx, sy] = this.stairs;
    if (this.seen.has(`${sx},${sy}`)) {
      ctx.fillStyle = this.C.teal;
      ctx.fillRect(mx + sx * 4, my + sy * 4, 4, 4);
    }

    // Minimap Player
    ctx.fillStyle = this.C.gold;
    ctx.fillRect(mx + this.x * 4 - 1, my + this.y * 4 - 1, 5, 5);

    // Expedition Log
    ctx.fillStyle = this.C.muted;
    ctx.font = "bold 12px 'Orbitron', sans-serif";
    ctx.fillText("EXPEDITION LOG", px + 20, py + 494);

    ctx.font = "12px 'Segoe UI', sans-serif";
    let logY = py + 514;
    for (let i = Math.max(0, this.messages.length - 3); i < this.messages.length; i++) {
      ctx.fillStyle = i === this.messages.length - 1 ? "#fff" : this.C.muted;
      const text = this.messages[i];
      const truncated = text.length > 34 ? text.substring(0, 32) + "..." : text;
      ctx.fillText(truncated, px + 20, logY);
      logY += 19;
    }
  }

  // Progress Bar Helper
  renderBar(label, val, total, y, color) {
    const ctx = this.ctx;
    const px = 974;

    ctx.fillStyle = this.C.muted;
    ctx.font = "bold 13px 'Orbitron', sans-serif";
    ctx.fillText(label, px + 20, y);

    ctx.fillStyle = this.C.text;
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(`${val} / ${total}`, px + 215, y);

    ctx.fillStyle = "#232b35";
    ctx.beginPath();
    ctx.roundRect(px + 20, y + 10, 240, 8, 4);
    ctx.fill();

    const w = Math.max(0, Math.min(240, Math.floor((240 * val) / total)));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(px + 20, y + 10, w, 8, 4);
    ctx.fill();
  }

  // --- Overlays ---
  renderPauseOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(8, 12, 19, 0.88)";
    ctx.fillRect(0, 0, 1280, 800);

    ctx.fillStyle = this.C.gold;
    ctx.font = "bold 44px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME PAUSED", 640, 320);

    ctx.fillStyle = this.C.text;
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.fillText("Press [Escape] to resume expedition", 640, 380);
    ctx.fillText("Press [I] to open Field Guide & Bestiary", 640, 420);
    ctx.fillText("Press [R] to abandon and restart a new run", 640, 460);
    ctx.textAlign = "left";
  }

  renderGuideOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(10, 14, 22, 0.94)";
    ctx.fillRect(100, 80, 1080, 640);

    ctx.strokeStyle = this.C.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 80, 1080, 640);

    ctx.fillStyle = this.C.gold;
    ctx.font = "bold 32px 'Orbitron', sans-serif";
    ctx.fillText("FIELD GUIDE & BESTIARY", 140, 140);

    ctx.fillStyle = this.C.text;
    ctx.font = "16px 'Segoe UI', sans-serif";
    const guideLines = [
      "• WASD / Arrows: Move Wanderer or bump into an enemy to strike with melee weapon.",
      "• B: Fire an arrow at nearest enemy in line of sight (deals Weapon + 5 damage).",
      "• Q: Drink healing potion to restore up to 40 vitality.",
      "• F: Eat ration to satisfy hunger and heal up to 12 vitality.",
      "• Spacebar: Rest / Wait 1 turn.",
      "• E: Descend stairs once located in the final room.",
      "• Chests automatically upgrade either your weapon or armor durability tier.",
      "• Enemies only move when you act! Plan tactical steps with patience.",
      "",
      "Press [I] or [Escape] to close Field Guide."
    ];

    let gy = 200;
    for (const line of guideLines) {
      ctx.fillText(line, 140, gy);
      gy += 32;
    }
  }

  renderDeathOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(20, 5, 10, 0.92)";
    ctx.fillRect(0, 0, 1280, 800);

    ctx.fillStyle = this.C.red;
    ctx.font = "bold 52px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("EXPEDITION FAILED", 640, 280);

    ctx.fillStyle = this.C.text;
    ctx.font = "22px 'Segoe UI', sans-serif";
    ctx.fillText(`You fell on Depth 0${this.floor} (${this.FLOOR_NAMES[this.floor - 1]})`, 640, 350);
    ctx.fillText(`Defeated ${this.kills} enemies • Amassed ${this.gold} gold • Level ${this.level}`, 640, 390);

    ctx.fillStyle = this.C.gold;
    ctx.font = "bold 20px 'Orbitron', sans-serif";
    ctx.fillText("▶ CLICK OR PRESS [ENTER] TO EMBARK ON A NEW EXPEDITION", 640, 510);
    ctx.textAlign = "left";
  }

  renderVictoryOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(10, 22, 18, 0.94)";
    ctx.fillRect(0, 0, 1280, 800);

    ctx.fillStyle = this.C.teal;
    ctx.font = "bold 54px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VICTORY!", 640, 260);

    ctx.fillStyle = this.C.gold;
    ctx.font = "bold 26px 'Orbitron', sans-serif";
    ctx.fillText("THE HOLLOW CROWN IS RECLAIMED", 640, 320);

    ctx.fillStyle = this.C.text;
    ctx.font = "20px 'Segoe UI', sans-serif";
    ctx.fillText(`All 5 Depths Conquered • Total Kills: ${this.kills} • Wealth: ${this.gold} Gold`, 640, 390);

    ctx.fillStyle = this.C.teal;
    ctx.font = "bold 20px 'Orbitron', sans-serif";
    ctx.fillText("▶ CLICK OR PRESS [ENTER] TO PLAY AGAIN", 640, 510);
    ctx.textAlign = "left";
  }
}

// Make globally available
window.DungeonGame = DungeonGame;
