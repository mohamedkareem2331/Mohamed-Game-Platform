/**
 * MOHAMED KAREEM GAMES - CORE APPLICATION & UI ENGINE
 */

document.addEventListener("DOMContentLoaded", () => {
  initAmbientCanvas();
  initNavbarScroll();
  initCatalogUI();
  initSearch();
  initStats();
  initFavoritesListener();
});

// --- Ambient Interactive Background Canvas ---
function initAmbientCanvas() {
  const canvas = document.getElementById("ambient-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const count = Math.min(65, Math.floor((width * height) / 18000));
  const colors = ["#00f0ff", "#7928ca", "#ff007a", "#ffbe0b"];

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.5 + 0.2
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    // Draw subtle cyber grid
    ctx.strokeStyle = "rgba(0, 240, 255, 0.035)";
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Connect close particles with neon laser lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 * (1 - dist / 110)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Update and draw particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    requestAnimationFrame(render);
  }

  render();
}

// --- Navbar Sticky Scroll Shadow ---
function initNavbarScroll() {
  const navbar = document.querySelector(".navbar");
  if (!navbar) return;
  window.addEventListener("scroll", () => {
    if (window.scrollY > 30) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  });
}

// --- Dynamic Catalog Rendering & Filtering ---
let currentCategory = "All";
let searchQuery = "";

function initCatalogUI() {
  const container = document.getElementById("games-container");
  if (!container) return;

  renderGames();

  // Setup category pills
  const pills = document.querySelectorAll(".filter-btn");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategory = pill.getAttribute("data-category") || "All";
      renderGames();
    });
  });
}

function renderGames() {
  const container = document.getElementById("games-container");
  if (!container || !window.MKGames) return;

  let games = window.MKGames.catalog;

  // Filter by category
  if (currentCategory !== "All") {
    games = games.filter(g => g.category.toLowerCase().includes(currentCategory.toLowerCase()));
  }

  // Filter by search query
  if (searchQuery.trim() !== "") {
    const q = searchQuery.toLowerCase();
    games = games.filter(g => 
      g.title.toLowerCase().includes(q) ||
      g.tagline.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q)
    );
  }

  if (games.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
        <h3 style="color: var(--neon-cyan); margin-bottom: 0.5rem;">No Games Found</h3>
        <p style="color: var(--text-muted);">Try a different search keyword or category filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = games.map(game => {
    const isFav = window.mkStorage ? window.mkStorage.isFavorite(game.id) : false;
    return `
      <article class="game-card" data-game-id="${game.id}">
        <div class="card-media">
          <img src="${game.thumbnail}" alt="${game.title}" class="card-thumb" loading="lazy" />
          <span class="card-overlay-badge">${game.badge || game.category}</span>
          <button class="card-fav-btn ${isFav ? 'is-fav' : ''}" 
                  onclick="toggleGameFav(event, '${game.id}')" 
                  title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
            ★
          </button>
        </div>
        <div class="card-body">
          <div class="card-header-info">
            <span class="card-category">${game.category}</span>
            <span class="card-version">v${game.version}</span>
          </div>
          <h3 class="card-title">${game.title}</h3>
          <p class="card-desc">${game.tagline}</p>
          <div class="card-feature-chips">
            ${game.features.slice(0, 3).map(f => `<span class="feature-chip">${f}</span>`).join('')}
          </div>
          <div class="card-footer">
            <a href="${game.playUrl}" class="btn btn-primary btn-sm">▶ Play Online</a>
            <a href="${game.downloadUrl}" class="btn btn-download btn-sm" download title="Download ${game.title} for Windows">⭳ Download PC</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// --- Search Filter Functionality ---
function initSearch() {
  const searchInput = document.getElementById("search-input");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderGames();
  });
}

// --- Toggle Favorite Handler ---
window.toggleGameFav = function(event, gameId) {
  event.stopPropagation();
  event.preventDefault();
  if (window.mkStorage) {
    const isFav = window.mkStorage.toggleFavorite(gameId);
    const btn = event.currentTarget;
    if (btn) {
      btn.classList.toggle("is-fav", isFav);
      btn.title = isFav ? "Remove from favorites" : "Add to favorites";
    }
  }
};

// --- Sync UI when favorites update ---
function initFavoritesListener() {
  window.addEventListener("mk-storage-updated", (e) => {
    if (e.detail?.type === "favorites") {
      renderGames();
      initStats();
    }
  });
}

// --- Live Stats Counter ---
function initStats() {
  const favCountEl = document.getElementById("fav-count");
  if (favCountEl && window.mkStorage) {
    favCountEl.textContent = window.mkStorage.getFavorites().length;
  }
  const recentCountEl = document.getElementById("recent-count");
  if (recentCountEl && window.mkStorage) {
    recentCountEl.textContent = window.mkStorage.getRecentlyPlayed().length;
  }
}
