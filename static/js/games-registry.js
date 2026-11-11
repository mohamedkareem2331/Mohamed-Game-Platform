/**
 * MOHAMED KAREEM GAMES - CENTRALIZED GAME REGISTRY
 * 
 * Future Game Expansion System:
 * Adding a new game simply requires adding an entry to this registry
 * and placing the game assets/executables in the corresponding directories.
 */

const MK_GAMES_CATALOG = [
  {
    id: "chess",
    slug: "chess",
    title: "Python Chess: Local Arena",
    shortName: "Chess Arena",
    category: "Strategy",
    badge: "Minimax AI",
    tagline: "Master the board with tactical depth, legal move validation, and 4 AI difficulty tiers.",
    description: "A complete, tournament-grade local chess experience built by Mohamed Kareem. Features full legal move generation including castling, en passant, and pawn promotion. Challenge the multi-depth Minimax AI or battle a friend in local 2-Player mode with 7 customizable board themes, real-time check/checkmate detection, full move history notation, and instant undo.",
    version: "1.0.0",
    releaseDate: "November 2026",
    developer: "Mohamed Kareem",
    framework: "Python Standard Library (Pure Engine) / Canvas Web Player",
    featured: true,
    status: "published",
    rating: 4.9,
    players: "1 - 2 Players",
    thumbnail: "static/assets/thumbnails/chess_thumb.svg",
    playUrl: "games/chess.html",
    downloadUrl: "builds/MohamedKareemChess-v1.0.exe",
    fileSize: "10.4 MB",
    compatibility: "Windows 10 / 11 (64-bit)",
    controls: [
      { key: "Left Click", action: "Select piece / Move to highlighted destination" },
      { key: "Mode Menu", action: "Toggle 2 Players vs Play vs AI" },
      { key: "AI Level", action: "Easy, Medium, Hard, Extreme" },
      { key: "Theme Menu", action: "Switch between 7 board color palettes" },
      { key: "Undo Button", action: "Step back move (supports AI re-sync)" },
      { key: "F11 / ESC", action: "Toggle Fullscreen mode" }
    ],
    features: [
      "Rigorous legal move generation (no invalid moves)",
      "Smart Minimax AI with Alpha-Beta pruning",
      "7 Distinct Board Themes: Classic, Ocean, Forest, Rose, Midnight, Amethyst, Sunset",
      "Full algebraic move notation and captured piece graveyard",
      "Dynamic pawn promotion dialog (Queen, Rook, Bishop, Knight)",
      "Instant Save & Resume using browser local storage"
    ],
    saveSupported: true,
    saveType: "Board state matrix, turn, castling rights, history & theme"
  },
  {
    id: "zombie",
    slug: "zombie",
    title: "NIGHTFALL: Zombie Survival",
    shortName: "Zombie Survival",
    category: "Survival",
    badge: "Arcade 360°",
    tagline: "Survive escalating undead waves, execute tactical dashes, and level up your arsenal.",
    description: "An adrenaline-fueled top-down arcade survival shooter created by Mohamed Kareem. Battle relentless waves of infected variants with unique speeds and health pools, culminating in colossal boss encounters every 5th wave. Collect XP crystals to trigger 3-choice rogue-lite upgrades, manage tactical dashes, grab health and rapid-fire crates, and push for the ultimate high score.",
    version: "1.0.0",
    releaseDate: "November 2026",
    developer: "Mohamed Kareem",
    framework: "Python 3 + Pygame 2.6 / WebAssembly Pygbag Player",
    featured: true,
    status: "published",
    rating: 4.8,
    players: "Single Player",
    thumbnail: "static/assets/thumbnails/zombie_thumb.svg",
    playUrl: "games/zombie.html",
    downloadUrl: "builds/NightfallZombieSurvival-v1.0.exe",
    fileSize: "14.0 MB",
    compatibility: "Windows 10 / 11 (64-bit)",
    controls: [
      { key: "W, A, S, D", action: "Move Survivor in 8 directions" },
      { key: "Mouse Pointer", action: "360-degree aiming" },
      { key: "Left Mouse Button", action: "Fire primary weapon" },
      { key: "Spacebar", action: "Dash / Dodge roll (with cooldown)" },
      { key: "1, 2, 3", action: "Select upgrade upon level up" },
      { key: "P / Escape", action: "Pause game" },
      { key: "Enter", action: "Start / Restart game" }
    ],
    features: [
      "Escalating wave difficulty and dynamic enemy horde spawning",
      "Massive Boss encounters every 5 waves with heavy health pools",
      "Roguelike 3-choice level-up upgrades (Damage, Fire Rate, Speed, Health)",
      "Kinetic screen shake, particle splatters, and floating damage numbers",
      "Health and Rapid-Fire tactical field pickups",
      "High score tracking and personal best record persistence"
    ],
    saveSupported: true,
    saveType: "Local storage high score, wave records and player stats"
  },
  {
    id: "space-invaders",
    slug: "space-invaders",
    title: "SPACE INVASION INVADERS",
    shortName: "Space Invaders",
    category: "Arcade",
    badge: "Asset-Driven",
    tagline: "Defend Earth against alien swarms with 4-tier laser evolution and 7 difficulty modes.",
    description: "A visually stunning, high-octane retro pixel shooter crafted by Mohamed Kareem. Powered by custom handcrafted starship and alien artwork, layered parallax starfields, and real-time synthesized 8-bit sound effects. Features an authentic 50-round recharging ammo magazine, green laser evolution pickups unlocking up to 4 simultaneous plasma beams, and 7 hardcore difficulty settings from Very Easy to Ultra Extreme.",
    version: "1.0.0",
    releaseDate: "November 2026",
    developer: "Mohamed Kareem",
    framework: "Python 3 + Pygame 2.6 / WebAssembly Pygbag Player",
    featured: true,
    status: "published",
    rating: 5.0,
    players: "Single Player",
    thumbnail: "static/assets/thumbnails/space_thumb.svg",
    playUrl: "games/space-invaders.html",
    downloadUrl: "builds/SpaceInvasionInvaders-v1.0.exe",
    fileSize: "15.7 MB",
    compatibility: "Windows 10 / 11 (64-bit)",
    controls: [
      { key: "W, A, S, D / Arrows", action: "Maneuver Starship across the battle sector" },
      { key: "Spacebar", action: "Fire plasma laser (Hold for continuous fire)" },
      { key: "Escape", action: "Pause game / Return to previous menu" },
      { key: "R", action: "Instant restart while paused" },
      { key: "M", action: "Return to Main Menu while paused" },
      { key: "F11 / Alt + Enter", action: "Toggle Fullscreen mode" }
    ],
    features: [
      "Custom pixel starship, alien armada, and deep space nebula backdrops",
      "Procedurally synthesized retro SFX directly generated in memory",
      "50-round energy magazine with real-time 5 shots/sec auto-recharge",
      "4-Tier Weapon Evolution (Single, Dual, Triple, Quadruple Green Lasers)",
      "7 Selectable Difficulty Tiers with distinct enemy attack styles & boss health",
      "Persistent High Scores and personal bests via browser local storage"
    ],
    saveSupported: true,
    saveType: "Local high scores, chosen difficulty preference, weapon stats"
  },
  {
    id: "dungeon",
    slug: "dungeon",
    title: "Dungeon: The Hollow Crown",
    shortName: "Dungeon Crawler",
    category: "RPG",
    badge: "Roguelike RPG",
    tagline: "Descend 5 floors of procedural dungeons, manage hunger & potions, and recover the Hollow Crown.",
    description: "A complete, turn-based roguelike dungeon crawler created by Mohamed Kareem. Descend through 5 procedurally generated floors with dynamic fog of war, explored-area minimap, animated Craftpix orc mobs, melee and bow combat, hidden traps, loot chests, weapon/armor upgrades, synthesized sound effects, and the ultimate Guardian boss encounter. Features automatic saving to browser local storage and native Windows executable.",
    version: "1.0.0",
    releaseDate: "November 2026",
    developer: "Mohamed Kareem",
    framework: "Python 3.12 + Pygame-CE / Canvas Web Player",
    featured: true,
    status: "published",
    rating: 5.0,
    players: "Single Player",
    thumbnail: "static/assets/thumbnails/dungeon_thumb.svg",
    playUrl: "games/dungeon.html",
    downloadUrl: "builds/DungeonTheHollowCrown-v1.0.exe",
    fileSize: "24.0 MB",
    compatibility: "Windows 10 / 11 (64-bit)",
    controls: [
      { key: "WASD / Arrows", action: "Move Hero / Walk into enemy to melee attack" },
      { key: "B", action: "Fire Bow arrow at nearest enemy with clear line of sight" },
      { key: "Q", action: "Drink Healing Potion (restores up to 40 HP)" },
      { key: "F", action: "Eat Ration (refills hunger & restores up to 12 HP)" },
      { key: "Spacebar", action: "Wait a turn / Rest" },
      { key: "E", action: "Descend stairs / Claim the Crown after Guardian" },
      { key: "ESC", action: "Pause / Resume game" },
      { key: "I", action: "Open Field Guide & Bestiary" }
    ],
    features: [
      "5 Procedurally generated dungeon floors with fog of war & dynamic minimap",
      "Animated Craftpix orc tribes, melee combat, and ranged bow combat",
      "Chests with automatic weapon & armor tier upgrades",
      "Hunger system with food management and healing potions",
      "Hidden traps, experience leveling, and synthesized audio effects",
      "Automatic expedition progress saving via browser LocalStorage"
    ],
    saveSupported: true,
    saveType: "Expedition floor, player stats, inventory, equipment & seed"
  }
];

// Helper methods for the platform
window.MKGames = {
  catalog: MK_GAMES_CATALOG,
  getGame: function(id) {
    return this.catalog.find(g => g.id === id || g.slug === id);
  },
  getCategories: function() {
    return ["All", "Arcade", "Strategy", "Survival", "RPG"];
  },
  getFeatured: function() {
    return this.catalog.filter(g => g.featured);
  }
};
