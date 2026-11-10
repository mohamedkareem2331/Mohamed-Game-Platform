# MOHAMED KAREEM GAMES — PERSONAL GAMING PLATFORM

Welcome to **MOHAMED KAREEM GAMES**, an independent personal gaming platform designed to showcase, play, save, and download games developed using **Python, Pygame, VS Code, and Google Antigravity**.

---

## 🎮 Game Library

### 1. Python Chess: Local Arena
* **Category:** Strategy & Board Game
* **Technology:** Python Standard Library / Canvas Web Engine
* **Features:**
  * Full tournament legal move generator (Castling, En Passant, Pawn Promotion).
  * Multi-depth Minimax AI with Alpha-Beta pruning (Easy, Medium, Hard, Extreme).
  * 7 Board color themes (Classic, Ocean, Forest, Rose, Midnight, Amethyst, Sunset).
  * Move history notation, captured pieces graveyard, and undo.
  * Browser LocalStorage state save & resume.
* **Windows PC Executable:** `builds/MohamedKareemChess-v1.0.exe` (10.4 MB)

### 2. NIGHTFALL: Zombie Survival
* **Category:** Top-Down Arcade Survival
* **Technology:** Python 3 + Pygame 2.6 / WebAssembly (Pygbag)
* **Features:**
  * WASD 8-direction movement with 360-degree mouse aiming and shooting.
  * Tactical Dash ability with cooldown and invulnerability window.
  * Escalating undead horde waves and colossal Boss encounters every 5th wave.
  * Rogue-lite XP collection and 3-choice upgrade system.
  * Particle splatters, screen shake, and floating damage numbers.
* **Windows PC Executable:** `builds/NightfallZombieSurvival-v1.0.exe` (14.0 MB)

### 3. SPACE INVASION INVADERS
* **Category:** Retro Pixel Arcade Space Shooter
* **Technology:** Python 3 + Pygame 2.6 / WebAssembly (Pygbag)
* **Features:**
  * Handcrafted pixel starship, alien armada, and space backdrops.
  * 50-round energy magazine with real-time 5 shots/sec auto-recharge.
  * 4-Tier Green Laser Evolution (Single, Dual, Triple, Quadruple beams).
  * Procedurally synthesized 8-bit sound effects directly from memory buffers.
  * 7 Selectable difficulty modes with boss encounters and wave scaling.
* **Windows PC Executable:** `builds/SpaceInvasionInvaders-v1.0.exe` (15.7 MB)

---

## 🚀 How to Launch Locally

### Method 1: One-Click Launcher (Windows)
Double-click `run_platform.bat` in the root folder. It will start a local server and open `http://localhost:8080` in your default browser.

### Method 2: Command Line
```powershell
cd C:\Users\moham\.gemini\antigravity\scratch\mohamed_kareem_games
python -m http.server 8080
```
Then navigate to `http://localhost:8080`.

---

## 🌐 Online Publishing Guide (GitHub Pages & Releases)

### 1. Publish the Website to GitHub Pages
1. Initialize git in this directory:
   ```powershell
   git init
   git add .
   git commit -m "Initial release of Mohamed Kareem Games Platform"
   ```
2. Create a new GitHub repository called `mohamed-kareem-games`.
3. Push your repository:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/mohamed-kareem-games.git
   git branch -M main
   git push -u origin main
   ```
4. In GitHub repository settings &rarr; **Pages**, set Source to `Deploy from branch main / (root)`.
5. Your platform will be live at `https://YOUR_USERNAME.github.io/mohamed-kareem-games/`!

### 2. Distribute PC Executables via GitHub Releases
For optimal download speeds, attach the three files in `builds/`:
* `MohamedKareemChess-v1.0.exe`
* `NightfallZombieSurvival-v1.0.exe`
* `SpaceInvasionInvaders-v1.0.exe`
to a new Release tag (e.g. `v1.0.0`) on your GitHub repository.

---

## 📁 Project Architecture

```text
mohamed_kareem_games/
├── index.html                   # Master Platform Homepage
├── library.html                 # Personal Gaming Dashboard ("My Collection")
├── about.html                   # About Mohamed Kareem & PC Guide
├── run_platform.bat             # One-click Windows local launcher
│
├── games/                       # Dedicated Game Pages
│   ├── chess.html
│   ├── zombie.html
│   └── space-invaders.html
│
├── static/
│   ├── css/                     # Cyber-Arcade Dark Visual System
│   │   ├── main.css
│   │   ├── games.css
│   │   └── dashboard.css
│   ├── js/                      # Platform Engine & Storage
│   │   ├── app.js
│   │   ├── storage.js
│   │   ├── games-registry.js    # Future-proof Centralized Catalog
│   │   └── games/chess-engine.js
│   ├── assets/                  # High-Res Logos & Vector Thumbnails
│   └── web_games/               # Pygbag WebAssembly distributions
│       ├── zombie_survival/
│       └── space_invaders/
│
├── builds/                      # Standalone Windows PC Downloads (.EXE)
│   ├── MohamedKareemChess-v1.0.exe
│   ├── NightfallZombieSurvival-v1.0.exe
│   ├── SpaceInvasionInvaders-v1.0.exe
│   └── README_INSTALL.txt
│
└── games_source_copies/         # Verified untouched copies of original code
    ├── chess/
    ├── zombie_survival/
    └── space_invaders/
```

---

&copy; 2026 Mohamed Kareem Games. All rights reserved.
