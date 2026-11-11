# Dungeon — The Hollow Crown

A complete, single-player Python dungeon crawler. Descend through five
procedurally generated floors, collect equipment, manage food and potions,
and defeat the guardian to recover the Hollow Crown.

Includes fog of war, an explored-area minimap, animated Craftpix orcs,
melee combat, a bow, hidden traps, chests, weapon and armor upgrades,
experience levels, synthesized sound effects, automatic saves, pause/help
screens, and victory/death screens. Enemies move only when you take a turn.
Designed for a desktop keyboard, including when embedded on a website.

## Play immediately on Windows

Open **dist/Dungeon.exe**. No Python installation is required for the built
application. The executable includes the selected runtime artwork.

## Run and edit in VS Code

1. Install Python 3.12 from https://www.python.org/downloads/ if necessary.
   Enable its PATH option. The existing Python launcher on this machine did
   not find an installed Python during development; Codex's bundled runtime
   was used for the initial build.
2. Open this entire folder in VS Code and install the recommended Python extension.
3. In VS Code's terminal, run:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe main.py
```

Choose `.venv\Scripts\python.exe` using **Python: Select Interpreter**.
Then **F5 → Play Dungeon** launches the game with debugging.

The local `assets.pak` is already prepared. If you need to regenerate it
from the original folders, run:

```powershell
.venv\Scripts\python.exe tools/prepare_assets.py
```

A clean public source checkout works without assets.pak, using original
drawn-art fallback graphics. Preserve the original folder names if you
want to rebuild the Craftpix artwork bundle locally.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move; walk into an enemy to attack |
| B | Fire an arrow at the nearest enemy with a clear line of sight |
| Q | Drink a healing potion: up to 40 health |
| F | Eat a ration: refill hunger and restore up to 12 health |
| Space | Wait a turn |
| E | Descend while on stairs; claim the crown after the final guardian |
| Esc | Pause / resume |
| I | Field guide |

Walk onto loot to collect it. Chests automatically upgrade your weapon or
armor. Descending heals 15 health. Healing, eating, shooting, waiting, and
successful moves/attacks consume a turn. Walking into walls does not.

Windows saves live in `%LOCALAPPDATA%\DungeonHollowCrown\save.json`.
Browser saves use local storage for the current website. Only one
expedition is stored; **Begin descent** replaces it. Death ends that run.
Browser saves require local storage to be allowed by the browser.

## Build a Windows application

Run on Windows:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements-build.txt
.venv\Scripts\python.exe tools/build.py desktop
```

Result: **dist/Dungeon.exe**, a single-file desktop application. This is a
Windows build, not an Android or iPhone application. Mac/Linux builds need
to be packaged on the matching operating system.

## Put the game on your website

The first browser package is in **dist/web/**. Rebuild after code changes:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements-build.txt
.venv\Scripts\python.exe tools/build.py web
```

Upload the **contents** of dist/web to a folder such as `/games/dungeon/`
on your static web host. Serve it over HTTP/HTTPS; opening index.html
directly from disk is not supported. The initial load downloads the
Pygbag Python/WebAssembly runtime from pygame-web.github.io, so an internet
connection is needed. This is not an offline web build.

For a local preview:

```powershell
.venv\Scripts\python.exe -m http.server 8000 --directory dist/web
```

Visit http://localhost:8000. Click the game canvas before using the keyboard.
To embed it in your existing game website:

```html
<iframe src="/games/dungeon/" title="Dungeon: The Hollow Crown"
        width="1280" height="800" allow="autoplay; fullscreen"
        style="width:100%;aspect-ratio:8/5;border:0;" allowfullscreen></iframe>
```

Use a desktop browser and keyboard. Touch controls are not included.
The browser package was generated successfully; interactive browser testing
was blocked by the preview service being unavailable in this environment.
Test it on your actual host before publishing it to players.

Pygbag documentation: https://pygame-web.github.io/wiki/pygbag/

## GitHub

Create a repository, then upload/commit the source files in this folder:
main.py, engine.py, requirements files, tools, tests, .vscode, .github,
README.md, LICENSE, CREDITS.md, and .gitignore. The ignore file excludes the
original art folders, runtime art pack, local dependencies, saves and build
output. The Python code is MIT licensed; third-party art has separate terms.

Do not upload this entire Downloads folder with the raw art packs.
See CREDITS.md and your Craftpix licenses. A public code checkout is playable
with the original drawn-art fallback. Add the finished executable as a
GitHub Release attachment; upload dist/web to your website separately.
No repository or website has been published automatically.

## Checks

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -v
.venv\Scripts\python.exe tools/verify_render.py
```

The tests cover 500 generated floors, connected staircases and loot,
save/load with deterministic random state, consumables, combat, the final
guardian, floor transitions, death, and victory. The graphical check runs
headlessly, checks overlays and saving, and writes screenshots to docs/.
GitHub Actions runs the tests and the fallback graphics check on pushes.

## Project files

| File | Purpose |
| --- | --- |
| main.py | Window, controls, artwork, sound, menus, persistence |
| engine.py | Dungeon generation, combat, inventory, enemy navigation |
| tools/prepare_assets.py | Packs selected supplied images |
| tools/build.py | Windows and browser packaging |
| tests/test_engine.py | Rules and generated-map tests |
| tools/verify_render.py | Headless rendering and input checks |

To tune difficulty, edit health, enemy counts and damage in engine.py.
To change presentation, edit the colors and drawing code in main.py.
