# NIGHTFALL: Zombie Survival

A top-down arcade survival game built with Python + Pygame.

## Features
- WASD movement with mouse aiming and arcade projectiles
- Multiple zombie types with different speed, health and score values
- Wave progression and escalating difficulty
- Boss enemy every fifth wave
- XP, leveling and three-choice upgrades
- Health and rapid-fire pickups
- Dash ability, screen shake, particles and floating damage numbers
- Pause, game-over, restart and persistent high score

## Run in VS Code
1. Install Python 3.10+.
2. Open this folder in VS Code.
3. Open the integrated terminal.
4. Create a virtual environment (recommended):
   - Windows: `py -m venv .venv`
   - Activate: `.venv\Scripts\activate`
5. Install dependencies: `python -m pip install -r requirements.txt`
6. Start: `python main.py`

Controls:
- WASD: move
- Mouse: aim
- Left mouse button: fire
- Space: dash
- P / Escape: pause
- Enter: start / restart
- 1, 2, 3: choose an upgrade

The game uses generated vector-style graphics, so no external image or audio assets are required.
