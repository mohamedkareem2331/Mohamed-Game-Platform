/**
 * MOHAMED KAREEM GAMES - LOCAL STORAGE & PROGRESSION ENGINE
 * 
 * Safely persists all platform data:
 * - Chess board positions & match history
 * - High scores for Zombie Survival and Space Invaders
 * - Favorites list
 * - Recently played games log
 * - Player settings (audio, theme, difficulty)
 */

const MK_STORAGE_KEY = "MK_GAMES_PLATFORM_DATA_V1";

class MKStorageManager {
  constructor() {
    this.data = this.loadAll();
  }

  loadAll() {
    try {
      const raw = localStorage.getItem(MK_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Could not read local storage, initializing default profile:", e);
    }
    return {
      favorites: ["chess", "space-invaders"],
      recentlyPlayed: [],
      lastPlayedId: null,
      chessSave: null,
      spaceInvadersSave: {
        highScores: { "NORMAL": 0, "HARD": 0, "EXPERT": 0 },
        lastDifficulty: "NORMAL"
      },
      zombieSurvivalSave: {
        highScore: 0,
        maxWave: 1,
        totalKills: 0
      },
      preferences: {
        soundVolume: 80,
        highContrast: false,
        theme: "cyber-neon"
      }
    };
  }

  saveAll() {
    try {
      localStorage.setItem(MK_STORAGE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.error("Local storage save failed:", e);
      return false;
    }
  }

  // --- Favorites Management ---
  isFavorite(gameId) {
    return this.data.favorites.includes(gameId);
  }

  toggleFavorite(gameId) {
    if (this.isFavorite(gameId)) {
      this.data.favorites = this.data.favorites.filter(id => id !== gameId);
    } else {
      this.data.favorites.push(gameId);
    }
    this.saveAll();
    this.dispatchUpdate("favorites");
    return this.isFavorite(gameId);
  }

  getFavorites() {
    return this.data.favorites;
  }

  // --- Recently Played Management ---
  recordPlayed(gameId) {
    this.data.lastPlayedId = gameId;
    // Remove if existing, then prepend
    this.data.recentlyPlayed = this.data.recentlyPlayed.filter(item => item.id !== gameId);
    this.data.recentlyPlayed.unshift({
      id: gameId,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    });
    // Keep max 10
    if (this.data.recentlyPlayed.length > 10) {
      this.data.recentlyPlayed = this.data.recentlyPlayed.slice(0, 10);
    }
    this.saveAll();
    this.dispatchUpdate("recentlyPlayed");
  }

  getRecentlyPlayed() {
    return this.data.recentlyPlayed;
  }

  getLastPlayed() {
    return this.data.lastPlayedId;
  }

  // --- Chess Position Save / Resume ---
  saveChessState(stateObj) {
    if (!stateObj || !stateObj.board) {
      console.warn("Invalid chess state submitted to storage.");
      return false;
    }
    this.data.chessSave = {
      ...stateObj,
      savedAt: Date.now(),
      savedAtStr: new Date().toLocaleString()
    };
    const success = this.saveAll();
    this.dispatchUpdate("chessSave");
    return success;
  }

  getChessSave() {
    return this.data.chessSave;
  }

  clearChessSave() {
    this.data.chessSave = null;
    this.saveAll();
    this.dispatchUpdate("chessSave");
  }

  // --- Space Invaders Save / Resume ---
  saveSpaceScore(difficulty, score) {
    if (!this.data.spaceInvadersSave) {
      this.data.spaceInvadersSave = { highScores: {} };
    }
    const current = this.data.spaceInvadersSave.highScores[difficulty] || 0;
    if (score > current) {
      this.data.spaceInvadersSave.highScores[difficulty] = score;
      this.saveAll();
      this.dispatchUpdate("spaceSave");
      return true; // New record!
    }
    return false;
  }

  getSpaceScores() {
    return this.data.spaceInvadersSave?.highScores || {};
  }

  // --- Zombie Survival Save / Resume ---
  saveZombieScore(score, wave, kills = 0) {
    if (!this.data.zombieSurvivalSave) {
      this.data.zombieSurvivalSave = { highScore: 0, maxWave: 1, totalKills: 0 };
    }
    let newBest = false;
    if (score > this.data.zombieSurvivalSave.highScore) {
      this.data.zombieSurvivalSave.highScore = score;
      newBest = true;
    }
    if (wave > this.data.zombieSurvivalSave.maxWave) {
      this.data.zombieSurvivalSave.maxWave = wave;
    }
    this.data.zombieSurvivalSave.totalKills += kills;
    this.saveAll();
    this.dispatchUpdate("zombieSave");
    return newBest;
  }

  getZombieSave() {
    return this.data.zombieSurvivalSave || { highScore: 0, maxWave: 1, totalKills: 0 };
  }

  dispatchUpdate(type) {
    window.dispatchEvent(new CustomEvent("mk-storage-updated", { detail: { type, data: this.data } }));
  }
}

window.mkStorage = new MKStorageManager();
