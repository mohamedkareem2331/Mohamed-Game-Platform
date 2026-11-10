# SPACE INVASION INVADERS

A complete original pixel-arcade space shooter built with Python and Pygame. It uses the supplied `assets/background.png`, `assets/player_ship.png`, and `assets/enemies.png` files.

## Install and run

```powershell
py -m pip install -r requirements.txt
py space_invaders.py
```

Controls: WASD or arrow keys to move, Space to fire, Escape to pause/back, F11 or Alt+Enter to toggle fullscreen. Select one of seven difficulty modes after choosing START GAME, then press Enter or click a difficulty card to open the YES/NO confirmation; only YES (or Y) starts the game, while NO (or N) returns to selection. Enemy formations move horizontally in fixed rows. While paused, `R` restarts and `M` returns to the main menu.

Enemies can drop three power-ups: red Health (+30 HP), blue Ammo Boost (temporary faster firing), and green Super Laser Evolution. Each green pickup advances the weapon through four levels: one, two, three, then four simultaneous projectiles. The evolution resets when a life is lost and is capped at level 4.

Difficulty modes range from VERY EASY through ULTRA EXTREME. Each mode changes enemy movement, formation, health, attack style, projectile speed/count, boss behavior, and power-up frequency. Enemy types retain distinct red, purple, green, yellow, blue, and orange weapons.

The weapon has a 50-shot magazine. Each firing action consumes exactly one shot, regardless of weapon level or projectile count. Ammunition regenerates at 5 shots per second whenever firing stops, including during a partially spent magazine. At 0/50, firing pauses until ammunition returns; holding fire resumes automatically as soon as a shot becomes available. The blue HUD state shows recharge. The magazine resets when a life is lost or a new game starts. Bosses have substantially larger, wave-scaled health pools.

The presentation includes layered parallax stars, procedural nebulae and planets, animated ship thrusters, emissive projectiles, enemy weapon glows, boss lighting, framed futuristic HUD panels, critical-hull warnings, and animated menu surfaces. The original background, spaceship, and enemy artwork remain unchanged.

The game saves high scores in `space_invaders_save.json`. It has no required audio files, so it runs cleanly without additional downloads.
