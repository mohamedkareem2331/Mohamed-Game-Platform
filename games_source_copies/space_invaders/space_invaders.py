"""SPACE INVASION INVADERS - a complete, asset-driven Pygame arcade game."""

from __future__ import annotations

import json
import math
import random
import sys
from array import array
from dataclasses import dataclass
from pathlib import Path

import pygame


TITLE = "SPACE INVASION INVADERS"
WIDTH, HEIGHT = 1280, 720
FPS = 60
MAX_WEAPON_LEVEL = 4
ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
SAVE_FILE = ROOT / "space_invaders_save.json"

WHITE = (245, 248, 255)
CYAN = (68, 232, 255)
MAGENTA = (226, 82, 255)
YELLOW = (255, 232, 75)
RED = (255, 76, 80)
GREEN = (83, 242, 144)
DARK = (8, 11, 24)


@dataclass(frozen=True)
class Difficulty:
    name: str
    description: str
    color: tuple[int, int, int]
    enemy_speed: float
    enemy_health: float
    enemy_damage: int
    projectile_speed: float
    projectile_count: int
    fire_rate: float
    aggression: float
    formation: int
    boss_health: float
    boss_fire_rate: float
    drop_chance: float


DIFFICULTIES = (
    Difficulty("VERY EASY", "Gentle movement, light attacks, and generous survival.", (105, 220, 255), 0.62, 0.65, 5, 170, 1, 1.65, 0.55, 0, 0.72, 1.45, 0.58),
    Difficulty("EASY", "Relaxed arcade action with simple enemy attacks.", (100, 245, 170), 0.82, 0.82, 7, 205, 1, 1.35, 0.75, 0, 0.86, 1.2, 0.52),
    Difficulty("NORMAL", "Balanced arcade gameplay.", (255, 232, 75), 1.0, 1.0, 9, 240, 1, 1.0, 1.0, 1, 1.0, 1.0, 0.42),
    Difficulty("HARD", "Fast enemies, stronger weapons, and aggressive formations.", (255, 170, 75), 1.22, 1.18, 12, 285, 2, 0.82, 1.25, 1, 1.12, 0.82, 0.35),
    Difficulty("EXTREME", "Complicated attacks and relentless enemy pressure.", (255, 100, 130), 1.46, 1.38, 15, 325, 2, 0.68, 1.5, 2, 1.28, 0.68, 0.3),
    Difficulty("ULTRA", "Multiple projectiles, powerful attacks, and little room to recover.", (210, 100, 255), 1.72, 1.7, 19, 370, 3, 0.55, 1.8, 2, 1.5, 0.55, 0.25),
    Difficulty("ULTRA EXTREME", "The hardest mode: advanced attacks and deadly bosses.", (255, 70, 80), 2.0, 2.05, 24, 430, 4, 0.43, 2.15, 3, 1.85, 0.43, 0.2),
)


def difficulty_by_name(name: str) -> Difficulty:
    return next((difficulty for difficulty in DIFFICULTIES if difficulty.name == name), DIFFICULTIES[2])


def load_save() -> dict:
    try:
        return json.loads(SAVE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"high_scores": [], "settings": {"difficulty": "NORMAL"}}


def save_data(data: dict) -> None:
    try:
        SAVE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError:
        pass


def cutout(image: pygame.Surface, background: tuple[int, int, int], tolerance: int = 12) -> pygame.Surface:
    """Make only pixels close to a known flat background transparent."""
    result = image.convert_alpha()
    pixels = pygame.PixelArray(result)
    target = pygame.Color(*background)
    for y in range(result.get_height()):
        for x in range(result.get_width()):
            color = result.unmap_rgb(pixels[x, y])
            if max(abs(color.r - target.r), abs(color.g - target.g), abs(color.b - target.b)) <= tolerance:
                pixels[x, y] = (0, 0, 0, 0)
    del pixels
    return result


def load_assets() -> tuple[pygame.Surface, list[pygame.Surface], pygame.Surface]:
    background = pygame.image.load(ASSETS / "background.png").convert()
    ship = cutout(pygame.image.load(ASSETS / "player_ship.png"), (255, 255, 255), 8)
    sheet = pygame.image.load(ASSETS / "enemies.png").convert()
    # The supplied sheet is a 5 by 3 pixel-art grid.
    sprites: list[pygame.Surface] = []
    cell_w, cell_h = sheet.get_width() // 5, sheet.get_height() // 3
    for row in range(3):
        for column in range(5):
            cell = sheet.subsurface((column * cell_w, row * cell_h, cell_w, cell_h)).copy()
            sprites.append(cutout(cell, (17, 24, 32), 10))
    return background, sprites, ship


class Starfield:
    def __init__(self) -> None:
        self.stars = [
            [random.randrange(WIDTH), random.randrange(HEIGHT), random.choice((24, 38, 58)), random.uniform(8, 28), random.uniform(0, math.tau)]
            for _ in range(90)
        ]
        self.distant_stars = [
            [random.randrange(WIDTH), random.randrange(HEIGHT), random.choice((35, 55, 85)), random.uniform(2, 8), random.uniform(0, math.tau)]
            for _ in range(150)
        ]
        self.cosmic_overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        for _ in range(18):
            x, y = random.randrange(WIDTH), random.randrange(HEIGHT)
            radius = random.randrange(70, 190)
            color = random.choice(((45, 70, 150), (110, 40, 130), (20, 110, 155)))
            for size, alpha in ((radius, 8), (radius // 2, 10), (radius // 5, 18)):
                pygame.draw.circle(self.cosmic_overlay, (*color, alpha), (x, y), size)
        self.planets = [
            (random.randrange(80, WIDTH - 80), random.randrange(80, HEIGHT - 80), random.randrange(12, 30),
             random.choice(((55, 90, 150), (120, 65, 135), (55, 135, 125))))
            for _ in range(3)
        ]

    def update(self, dt: float) -> None:
        for star in self.stars:
            star[1] += star[3] * dt
            star[4] += dt * 3
            if star[1] > HEIGHT:
                star[0], star[1] = random.randrange(WIDTH), -2
        for star in self.distant_stars:
            star[1] += star[3] * dt
            star[4] += dt
            if star[1] > HEIGHT:
                star[0], star[1] = random.randrange(WIDTH), -2

    def draw(self, surface: pygame.Surface) -> None:
        surface.blit(self.cosmic_overlay, (0, 0))
        for x, y, size, _, phase in self.distant_stars:
            alpha = 95 + int(math.sin(phase) * 35)
            pygame.draw.circle(surface, (alpha // 2, alpha // 2, alpha), (int(x), int(y)), 1)
        for x, y, size, _, phase in self.stars:
            brightness = max(25, min(255, size + int(math.sin(phase) * 18)))
            pygame.draw.circle(surface, (brightness, brightness, min(255, brightness + 30)), (int(x), int(y)), 1)
        for x, y, radius, color in self.planets:
            pygame.draw.circle(surface, (*color, 24), (x, y), radius + 16)
            pygame.draw.circle(surface, color, (x, y), radius)
            pygame.draw.circle(surface, (220, 235, 255), (x - radius // 3, y - radius // 3), max(2, radius // 5))


class Particle:
    def __init__(self, pos: tuple[float, float], color: tuple[int, int, int]) -> None:
        self.x, self.y = pos
        angle = random.random() * math.tau
        speed = random.uniform(45, 220)
        self.vx, self.vy = math.cos(angle) * speed, math.sin(angle) * speed
        self.life = self.max_life = random.uniform(0.3, 0.8)
        self.color = color

    def update(self, dt: float) -> None:
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.vx *= 0.96
        self.vy *= 0.96
        self.life -= dt

    def draw(self, surface: pygame.Surface) -> None:
        if self.life > 0:
            radius = max(1, int(4 * self.life / self.max_life))
            pygame.draw.circle(surface, self.color, (int(self.x), int(self.y)), radius)


class Projectile(pygame.sprite.Sprite):
    def __init__(self, x: float, y: float, velocity: float, color: tuple[int, int, int],
                 enemy: bool = False, damage: int = 10, laser: bool = False,
                 explosion_radius: int = 0) -> None:
        super().__init__()
        if laser:
            self.image = pygame.Surface((30, 58), pygame.SRCALPHA)
            pygame.draw.rect(self.image, (*color, 45), (0, 0, 30, 58), border_radius=10)
            pygame.draw.rect(self.image, (*color, 100), (6, 0, 18, 58), border_radius=8)
            pygame.draw.rect(self.image, WHITE, (12, 0, 6, 58), border_radius=3)
        else:
            size = (11, 24) if enemy else (11, 31)
            if enemy and explosion_radius:
                size = (16, 29)
            self.image = pygame.Surface(size, pygame.SRCALPHA)
            pygame.draw.ellipse(self.image, (*color, 45), self.image.get_rect().inflate(4, 4))
            pygame.draw.rect(self.image, color, self.image.get_rect(), border_radius=3)
            pygame.draw.rect(self.image, WHITE, self.image.get_rect().inflate(-6, -8), border_radius=2)
            if enemy and explosion_radius:
                pygame.draw.circle(self.image, YELLOW, self.image.get_rect().center, 4, 1)
        self.rect = self.image.get_rect(center=(x, y))
        self.velocity, self.damage, self.enemy = velocity, damage, enemy
        self.explosion_radius = explosion_radius
        self.vx = 0.0

    def update(self, dt: float) -> None:
        self.rect.x += int(self.vx * dt)
        self.rect.y += int(self.velocity * dt)
        if self.rect.bottom < -30 or self.rect.top > HEIGHT + 30:
            self.kill()


class Drop(pygame.sprite.Sprite):
    TYPES = {
        "HEALTH": (RED, "+30 HP"),
        "AMMO": ((65, 155, 255), "WEAPON UPGRADE"),
        "LASER": ((75, 245, 125), "SUPER LASER"),
    }

    def __init__(self, x: int, y: int, kind: str) -> None:
        super().__init__()
        self.kind, self.angle = kind, 0.0
        self.color, self.label = self.TYPES[kind]
        self.image = pygame.Surface((58, 58), pygame.SRCALPHA)
        self.draw_icon()
        self.rect = self.image.get_rect(center=(x, y))

    def draw_icon(self) -> None:
        center = (29, 29)
        for radius, alpha in ((28, 22), (25, 38), (22, 65)):
            pygame.draw.circle(self.image, (*self.color, alpha), center, radius)
        pygame.draw.circle(self.image, (*self.color, 255), center, 18, 3)
        if self.kind == "HEALTH":
            pygame.draw.rect(self.image, WHITE, (25, 17, 8, 24))
            pygame.draw.rect(self.image, WHITE, (17, 25, 24, 8))
        elif self.kind == "AMMO":
            pygame.draw.polygon(self.image, WHITE, [(19, 16), (39, 16), (33, 25), (39, 25), (19, 43), (25, 30), (19, 30)])
        else:
            pygame.draw.rect(self.image, WHITE, (18, 25, 22, 7), border_radius=3)
            pygame.draw.rect(self.image, WHITE, (36, 18, 5, 21), border_radius=2)

    def update(self, dt: float) -> None:
        self.rect.y += int(95 * dt)
        self.angle += dt * 4
        self.rect.x += int(math.sin(self.angle * 0.8) * 0.7)
        self.image.set_alpha(220 + int(math.sin(self.angle) * 35))
        if self.rect.top > HEIGHT + 20:
            self.kill()


class Enemy(pygame.sprite.Sprite):
    PROFILES = (
        ("RED", RED, "direct"),
        ("PURPLE", MAGENTA, "spread"),
        ("GREEN", GREEN, "heavy"),
        ("YELLOW", YELLOW, "burst"),
        ("BLUE", CYAN, "rapid"),
        ("ORANGE", (255, 150, 65), "explosive"),
    )

    def __init__(self, image: pygame.Surface, x: int, y: int, level: int, index: int,
                 difficulty: Difficulty) -> None:
        super().__init__()
        scale = 0.42 if level < 4 else 0.48
        self.image = pygame.transform.smoothscale(image, (int(image.get_width() * scale), int(image.get_height() * scale)))
        self.rect = self.image.get_rect(center=(x, y))
        self.base_x, self.base_y = x, y
        self.phase = random.random() * math.tau
        self.difficulty = difficulty
        self.weapon_name, self.weapon_color, self.attack = self.PROFILES[index % len(self.PROFILES)]
        self.speed = (35 + level * 4 + index * 2) * difficulty.enemy_speed
        self.health = int((12 + level * 3 + index * 2) * difficulty.enemy_health)
        self.score = 50 + level * 15 + index * 5
        self.pattern = (index + difficulty.formation) % 4
        self.fire_timer = random.uniform(1.0, 3.2) / difficulty.aggression

    def update(self, dt: float, elapsed: float, player_pos: tuple[int, int],
               enemy_bullets: pygame.sprite.Group, formation_offset: float) -> None:
        self.phase += dt
        self.rect.centerx = int(self.base_x + formation_offset)
        self.rect.centery = self.base_y
        self.fire_timer -= dt
        if self.fire_timer <= 0 and self.rect.top > 10:
            self.fire(enemy_bullets, player_pos)
            self.fire_timer = random.uniform(1.8, 3.8) / self.difficulty.aggression

    def fire(self, bullets: pygame.sprite.Group, player_pos: tuple[int, int]) -> None:
        speed = self.difficulty.projectile_speed
        damage = self.difficulty.enemy_damage
        shot_damage = damage + 8 if self.attack == "heavy" else damage
        if self.attack == "rapid":
            shot_damage = max(2, damage - 2)
        elif self.attack == "explosive":
            shot_damage += 4
        shot_count = self.difficulty.projectile_count if self.attack in ("direct", "heavy", "rapid") else 1
        if self.attack in ("spread", "burst"):
            shot_count = 3
        explosion_radius = 38 if self.attack == "explosive" else 0
        for _ in range(shot_count):
            bullet = Projectile(self.rect.centerx, self.rect.bottom, speed, self.weapon_color, True,
                                shot_damage, explosion_radius=explosion_radius)
            bullet.vx = 0.0
            bullet.velocity = speed
            bullets.add(bullet)


class Boss(pygame.sprite.Sprite):
    def __init__(self, image: pygame.Surface, wave: int, difficulty: Difficulty) -> None:
        super().__init__()
        self.image = pygame.transform.smoothscale(image, (220, 150))
        self.rect = self.image.get_rect(midtop=(WIDTH // 2, 55))
        self.difficulty = difficulty
        self.health = int((1800 + wave * 350) * difficulty.boss_health)
        self.max_health = self.health
        self.t = 0.0
        self.fire_timer = 0.7 * self.difficulty.boss_fire_rate
        self.power_timer = 3.5
        self.power_cycle = 0
        self.shield_active = False
        self.dash_velocity = 0.0

    def update(self, dt: float, bullets: pygame.sprite.Group, player_pos: tuple[int, int]) -> None:
        self.t += dt
        if self.power_cycle == 2:
            self.dash_velocity = 520 * math.sin(self.t * 3)
            self.rect.x += int(self.dash_velocity * dt)
            self.rect.y = 70 + int(math.sin(self.t * 4) * 35)
        else:
            self.rect.centerx = WIDTH // 2 + int(math.sin(self.t * 0.85) * 450)
            self.rect.centery = 125 + int(math.sin(self.t * 1.7) * 55)
        self.rect.clamp_ip(pygame.Rect(20, 45, WIDTH - 40, 300))
        self.fire_timer -= dt
        self.power_timer -= dt
        if self.power_timer <= 0:
            self.power_cycle = (self.power_cycle + 1) % 3
            self.shield_active = self.power_cycle == 1
            self.power_timer = (4.5 if self.shield_active else 3.0) * self.difficulty.boss_fire_rate
        if self.fire_timer <= 0:
            if self.power_cycle == 0:
                # Triple aimed burst.
                dx = player_pos[0] - self.rect.centerx
                dy = max(1, player_pos[1] - self.rect.centery)
                angle = math.atan2(dy, dx)
                for spread in (-0.18, 0, 0.18):
                    bullet = Projectile(self.rect.centerx, self.rect.bottom, 300 * self.difficulty.projectile_speed / 240, MAGENTA, True, 22 + self.difficulty.enemy_damage)
                    bullet.vx = math.cos(angle + spread) * 135 * self.difficulty.aggression
                    bullet.velocity = math.sin(angle + spread) * 300 * self.difficulty.projectile_speed / 240
                    bullets.add(bullet)
                self.fire_timer = 0.75 * self.difficulty.boss_fire_rate
            elif self.power_cycle == 1:
                # Shield power: a fast radial projectile burst.
                radial_count = 12 + self.difficulty.projectile_count * 2
                for i in range(radial_count):
                    angle = math.tau * i / radial_count
                    radial_speed = 230 * self.difficulty.projectile_speed / 240
                    bullet = Projectile(self.rect.centerx, self.rect.centery, radial_speed, YELLOW, True, 18 + self.difficulty.enemy_damage)
                    bullet.vx = math.cos(angle) * radial_speed
                    bullet.velocity = math.sin(angle) * radial_speed
                    bullets.add(bullet)
                self.fire_timer = 1.8 * self.difficulty.boss_fire_rate
            else:
                # Dash power: a wide three-shot attack while the boss sweeps the arena.
                offsets = (-95, 0, 95) if self.difficulty.projectile_count < 3 else (-120, -40, 40, 120)
                for offset in offsets:
                    bullet = Projectile(self.rect.centerx + offset, self.rect.bottom, 370 * self.difficulty.projectile_speed / 240, RED, True, 28 + self.difficulty.enemy_damage)
                    bullet.vx = offset * 1.4 * self.difficulty.aggression
                    bullets.add(bullet)
                self.fire_timer = 0.55 * self.difficulty.boss_fire_rate


class Player(pygame.sprite.Sprite):
    MAX_AMMO = 50
    AMMO_RECHARGE_RATE = 5.0

    def __init__(self, image: pygame.Surface) -> None:
        super().__init__()
        player_width = 180
        ratio = player_width / image.get_width()
        self.image = pygame.transform.smoothscale(image, (player_width, int(image.get_height() * ratio)))
        self.rect = self.image.get_rect(midbottom=(WIDTH // 2, HEIGHT - 25))
        self.speed = 420.0
        self.health, self.max_health, self.lives = 100, 100, 3
        self.weapon, self.rapid_timer, self.shield_timer = 0, 0.0, 0.0
        self.upgrade_animation = 0.0
        self.invulnerable = 0.0
        self.fire_timer = 0.0
        self.current_ammo = float(self.MAX_AMMO)
        self.ammo_recharging = False

    def update(self, dt: float, keys: pygame.key.ScancodeWrapper, wants_fire: bool = False) -> None:
        dx = (keys[pygame.K_d] or keys[pygame.K_RIGHT]) - (keys[pygame.K_a] or keys[pygame.K_LEFT])
        dy = (keys[pygame.K_s] or keys[pygame.K_DOWN]) - (keys[pygame.K_w] or keys[pygame.K_UP])
        direction = pygame.Vector2(dx, dy)
        if direction.length_squared():
            direction.normalize_ip()
            self.rect.x += int(direction.x * self.speed * dt)
            self.rect.y += int(direction.y * self.speed * dt)
        self.rect.clamp_ip(pygame.Rect(8, 35, WIDTH - 16, HEIGHT - 45))
        self.fire_timer -= dt
        self.rapid_timer = max(0, self.rapid_timer - dt)
        self.shield_timer = max(0, self.shield_timer - dt)
        self.upgrade_animation = max(0, self.upgrade_animation - dt)
        self.invulnerable = max(0, self.invulnerable - dt)
        should_recharge = not wants_fire or self.current_ammo <= 0
        self.ammo_recharging = should_recharge and self.current_ammo < self.MAX_AMMO
        if should_recharge:
            self.current_ammo = min(
                float(self.MAX_AMMO),
                self.current_ammo + self.AMMO_RECHARGE_RATE * dt,
            )
            if self.current_ammo >= self.MAX_AMMO:
                self.current_ammo = float(self.MAX_AMMO)
                self.ammo_recharging = False

    def shoot(self, bullets: pygame.sprite.Group) -> None:
        if self.fire_timer > 0 or self.current_ammo <= 0:
            return
        offsets_by_level = {
            0: [0],
            1: [0],
            2: [-24, 24],
            3: [-38, 0, 38],
            4: [-48, -16, 16, 48],
        }
        offsets = offsets_by_level[min(self.weapon, MAX_WEAPON_LEVEL)]
        for offset in offsets:
            damage = 14 + max(0, self.weapon - 1) * 4
            bullets.add(Projectile(self.rect.centerx + offset, self.rect.top, -620, CYAN, False, damage))
        self.current_ammo = max(0.0, self.current_ammo - 1.0)
        if self.current_ammo <= 0:
            self.current_ammo = 0.0
            self.ammo_recharging = True
        self.fire_timer = 0.08 if self.rapid_timer else (0.10 if self.weapon else 0.18)

    def evolve_weapon(self) -> int:
        old_level = self.weapon
        self.weapon = min(MAX_WEAPON_LEVEL, self.weapon + 1)
        if self.weapon > old_level:
            self.upgrade_animation = 1.0
        return self.weapon

    def damage(self, amount: int) -> bool:
        if self.invulnerable or self.shield_timer:
            return False
        self.health -= amount
        self.invulnerable = 1.0
        return True


class Game:
    def __init__(self) -> None:
        pygame.init()
        pygame.display.set_caption(TITLE)
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
        self.canvas = pygame.Surface((WIDTH, HEIGHT))
        self.clock = pygame.time.Clock()
        self.background, self.enemy_images, self.ship_image = load_assets()
        self.background = pygame.transform.smoothscale(self.background, (WIDTH, HEIGHT))
        self.stars = Starfield()
        self.font = pygame.font.SysFont("consolas", 24, bold=True)
        self.big_font = pygame.font.SysFont("consolas", 62, bold=True)
        self.small_font = pygame.font.SysFont("consolas", 17)
        self.save = load_save()
        saved_difficulty = self.save.get("settings", {}).get("difficulty", "NORMAL").upper()
        self.difficulty = difficulty_by_name(saved_difficulty)
        self.state, self.menu_index, self.elapsed = "menu", 0, 0.0
        self.difficulty_index = next(i for i, item in enumerate(DIFFICULTIES) if item.name == self.difficulty.name)
        self.difficulty_confirmation = False
        self.menu_items = ["START GAME", "OPTIONS", "HIGH SCORES", "HOW TO PLAY", "ABOUT", "QUIT GAME"]
        self.options = ["Difficulty: Normal", "Fullscreen: Off", "BACK"]
        self.fullscreen = False
        self.mouse_target: tuple[int, int] | None = None
        self.notifications: list[dict[str, object]] = []
        self.sounds: dict[str, pygame.mixer.Sound] = {}
        self.setup_audio()
        self.reset_game()

    def setup_audio(self) -> None:
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init()
            for name, frequency in (("powerup", 760), ("health", 520), ("laser", 980)):
                samples = array("h")
                for index in range(2205):
                    envelope = 1.0 - index / 2205
                    samples.append(int(8000 * envelope * math.sin(math.tau * frequency * index / 44100)))
                self.sounds[name] = pygame.mixer.Sound(buffer=samples)
        except pygame.error:
            self.sounds = {}

    def play_sound(self, name: str) -> None:
        sound = self.sounds.get(name)
        if sound is not None:
            sound.play()

    def notify(self, message: str, color: tuple[int, int, int]) -> None:
        self.notifications.append({"message": message, "color": color, "life": 2.0})

    def reset_game(self) -> None:
        self.player = Player(self.ship_image)
        self.player.max_health = 130 if self.difficulty.name == "VERY EASY" else 100
        self.player.health = self.player.max_health
        self.player.lives = 4 if self.difficulty.name == "VERY EASY" else 3
        self.bullets = pygame.sprite.Group()
        self.enemy_bullets = pygame.sprite.Group()
        self.enemies = pygame.sprite.Group()
        self.drops = pygame.sprite.Group()
        self.particles: list[Particle] = []
        self.boss: Boss | None = None
        self.total_enemies_to_spawn = 0
        self.enemies_spawned = 0
        self.enemies_destroyed = 0
        self.living_enemies = 0
        self.wave, self.score, self.destroyed, self.wave_banner = 1, 0, 0, 2.0
        self.formation_offset = 0.0
        self.formation_direction = 1.0
        self.spawn_wave()

    def spawn_wave(self) -> None:
        if self.wave % 5 == 0:
            self.total_enemies_to_spawn = 0
            self.enemies_spawned = 0
            self.enemies_destroyed = 0
            self.living_enemies = 0
            self.boss = Boss(self.enemy_images[(self.wave // 5) % len(self.enemy_images)], self.wave, self.difficulty)
            return
        self.boss = None
        count = min(25, max(5, int((7 + self.wave * 2) * (1 + self.difficulty.formation * 0.08))))
        self.total_enemies_to_spawn = count
        self.enemies_spawned = 0
        self.enemies_destroyed = 0
        self.living_enemies = 0
        self.formation_offset = 0.0
        self.formation_direction = 1.0
        for i in range(count):
            columns = 6 if self.difficulty.formation >= 2 else 7
            x = 115 + (i % columns) * (WIDTH - 230) // max(1, columns - 1)
            y = 90 + (i // columns) * 80
            self.enemies.add(Enemy(self.enemy_images[i % len(self.enemy_images)], x, y, self.wave, i, self.difficulty))
            self.enemies_spawned += 1
            self.living_enemies += 1

    def text(self, value: str, position: tuple[int, int], color: tuple[int, int, int] = WHITE,
             font: pygame.font.Font | None = None, center: bool = False) -> None:
        rendered = (font or self.font).render(value, True, color)
        rect = rendered.get_rect(center=position) if center else rendered.get_rect(topleft=position)
        self.canvas.blit(rendered, rect)

    def draw_background(self) -> None:
        self.canvas.blit(self.background, (0, 0))
        self.stars.draw(self.canvas)

    def draw_menu(self) -> None:
        self.draw_background()
        pulse = int(10 + math.sin(self.elapsed * 2) * 8)
        title_color = (90 + pulse, 220, 255)
        title_panel = pygame.Rect(160, 25, 960, 145)
        pygame.draw.rect(self.canvas, (5, 10, 30, 190), title_panel, border_radius=18)
        pygame.draw.rect(self.canvas, (*title_color, 160), title_panel, 2, border_radius=18)
        self.text(TITLE, (WIDTH // 2, 80), title_color, self.big_font, True)
        self.text("AN ORIGINAL PIXEL-ARCADE ADVENTURE", (WIDTH // 2, 145), MAGENTA, self.small_font, True)
        for index, item in enumerate(self.menu_items):
            selected = index == self.menu_index
            color = CYAN if selected else (150, 165, 205)
            box = pygame.Rect(WIDTH // 2 - 235, 190 + index * 57, 470, 44)
            pygame.draw.rect(self.canvas, (0, 0, 0, 90), box.move(4, 5), border_radius=10)
            pygame.draw.rect(self.canvas, (20, 30, 65) if selected else (10, 15, 35), box, border_radius=10)
            pygame.draw.rect(self.canvas, color, box, 2 if selected else 1, border_radius=10)
            self.text(item, box.center, color, self.font, True)
        menu_ship_width = 140
        ship = pygame.transform.smoothscale(
            self.ship_image,
            (menu_ship_width, int(self.ship_image.get_height() * menu_ship_width / self.ship_image.get_width())),
        )
        self.canvas.blit(ship, ship.get_rect(midbottom=(WIDTH // 2, HEIGHT - 15)))

    def draw_difficulty(self) -> None:
        self.draw_background()
        difficulty = DIFFICULTIES[self.difficulty_index]
        self.text("SELECT DIFFICULTY", (WIDTH // 2, 55), difficulty.color, self.big_font, True)
        self.text("UP/DOWN OR CLICK TO SELECT    ENTER / CLICK CONFIRM    ESC BACK",
                  (WIDTH // 2, 105), WHITE, self.small_font, True)
        for index, item in enumerate(DIFFICULTIES):
            selected = index == self.difficulty_index
            box = pygame.Rect(90, 135 + index * 64, 1100, 52)
            color = item.color if selected else (75, 85, 120)
            pygame.draw.rect(self.canvas, (22, 28, 58) if selected else (10, 15, 35), box, border_radius=8)
            pygame.draw.rect(self.canvas, color, box, 3 if selected else 1, border_radius=8)
            self.text(f"{index + 1}. {item.name}", (box.x + 18, box.y + 8), color, self.font)
            self.text(item.description, (box.x + 275, box.y + 14), WHITE, self.small_font)
        confirm = pygame.Rect(WIDTH // 2 - 220, 650, 440, 48)
        pygame.draw.rect(self.canvas, difficulty.color, confirm, 2, border_radius=8)
        self.text("PRESS ENTER OR CLICK TO CONTINUE", confirm.center, difficulty.color, self.small_font, True)
        if self.difficulty_confirmation:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((2, 5, 20, 190))
            self.canvas.blit(overlay, (0, 0))
            modal = pygame.Rect(245, 235, 790, 250)
            pygame.draw.rect(self.canvas, (7, 12, 35), modal, border_radius=18)
            pygame.draw.rect(self.canvas, difficulty.color, modal, 3, border_radius=18)
            self.text(f"ARE YOU SURE YOU WANT TO PLAY ON {difficulty.name}?",
                      (WIDTH // 2, 290), difficulty.color, self.font, True)
            yes = pygame.Rect(380, 365, 210, 62)
            no = pygame.Rect(690, 365, 210, 62)
            for button, label in ((yes, "YES"), (no, "NO")):
                pygame.draw.rect(self.canvas, (20, 30, 65), button, border_radius=10)
                pygame.draw.rect(self.canvas, difficulty.color, button, 2, border_radius=10)
                self.text(label, button.center, difficulty.color, self.font, True)

    def mouse_to_canvas(self, position: tuple[int, int]) -> tuple[int, int]:
        """Convert the window mouse position to the fixed 1280x720 game canvas."""
        screen_width, screen_height = self.screen.get_size()
        return (
            int(position[0] * WIDTH / max(1, screen_width)),
            int(position[1] * HEIGHT / max(1, screen_height)),
        )

    def menu_button_at(self, position: tuple[int, int]) -> int | None:
        for index in range(len(self.menu_items)):
            if pygame.Rect(WIDTH // 2 - 190, 205 + index * 57, 380, 44).collidepoint(position):
                return index
        return None

    def draw_game(self) -> None:
        self.draw_background()
        self.drops.draw(self.canvas)
        for enemy in self.enemies:
            pulse = 3 + int((math.sin(self.elapsed * 4 + enemy.phase) + 1) * 2)
            glow = pygame.Surface((enemy.rect.width + 30, enemy.rect.height + 30), pygame.SRCALPHA)
            pygame.draw.ellipse(glow, (*enemy.weapon_color, 28), glow.get_rect().inflate(pulse, pulse))
            self.canvas.blit(glow, glow.get_rect(center=enemy.rect.center))
        self.enemies.draw(self.canvas)
        if self.boss:
            pygame.draw.ellipse(self.canvas, (*MAGENTA, 35), self.boss.rect.inflate(45, 35), 8)
            self.canvas.blit(self.boss.image, self.boss.rect)
            if self.boss.shield_active:
                pygame.draw.ellipse(self.canvas, YELLOW, self.boss.rect.inflate(30, 24), 4)
            bar = pygame.Rect(300, 12, 680, 18)
            pygame.draw.rect(self.canvas, (70, 20, 50), bar)
            boss_ratio = max(0.0, min(1.0, self.boss.health / self.boss.max_health))
            pygame.draw.rect(self.canvas, MAGENTA, (bar.x, bar.y, int(bar.width * boss_ratio), bar.height))
            power = ("AIMED BURST", "ENERGY SHIELD", "DASH ATTACK")[self.boss.power_cycle]
            self.text(f"BOSS - {power}", (WIDTH // 2, 39), YELLOW if self.boss.shield_active else MAGENTA, self.small_font, True)
        self.bullets.draw(self.canvas)
        self.enemy_bullets.draw(self.canvas)
        if self.player.invulnerable <= 0 or int(self.elapsed * 12) % 2:
            engine_y = self.player.rect.bottom - 5
            engine_wave = int(math.sin(self.elapsed * 18) * 5)
            pygame.draw.ellipse(self.canvas, (40, 130, 255, 70),
                                (self.player.rect.centerx - 48, engine_y - 4, 96, 28))
            pygame.draw.polygon(self.canvas, (75, 220, 255),
                                [(self.player.rect.centerx - 28, engine_y),
                                 (self.player.rect.centerx - 9, engine_y),
                                 (self.player.rect.centerx - 18, engine_y + 22 + engine_wave)])
            pygame.draw.polygon(self.canvas, (75, 220, 255),
                                [(self.player.rect.centerx + 9, engine_y),
                                 (self.player.rect.centerx + 28, engine_y),
                                 (self.player.rect.centerx + 18, engine_y + 22 + engine_wave)])
            self.canvas.blit(self.player.image, self.player.rect)
        if self.player.shield_timer:
            pygame.draw.circle(self.canvas, CYAN, self.player.rect.center, self.player.rect.width // 2, 3)
        self.text(f"WEAPON LEVEL {self.player.weapon}/{MAX_WEAPON_LEVEL}", (20, 62), GREEN, self.small_font)
        self.text(f"DIFFICULTY: {self.difficulty.name}", (20, 82), self.difficulty.color, self.small_font)
        if self.player.rapid_timer:
            self.text(f"AMMO BOOST {self.player.rapid_timer:0.1f}s", (270, 82), (65, 155, 255), self.small_font)
        if self.player.upgrade_animation:
            radius = int(self.player.rect.width * (0.65 + (1.0 - self.player.upgrade_animation) * 0.45))
            pygame.draw.circle(self.canvas, GREEN, self.player.rect.center, radius, 4)
        for notification in self.notifications:
            life = float(notification["life"])
            self.text(str(notification["message"]), (WIDTH // 2, 255 - int((2.0 - life) * 25)),
                      notification["color"], self.font, True)
        for particle in self.particles:
            particle.draw(self.canvas)
        pygame.draw.rect(self.canvas, (5, 10, 30), (12, 8, 270, 140), border_radius=12)
        pygame.draw.rect(self.canvas, (45, 75, 125), (12, 8, 270, 140), 1, border_radius=12)
        pygame.draw.rect(self.canvas, (22, 25, 48), (18, 12, 220, 20), border_radius=8)
        pygame.draw.rect(self.canvas, GREEN if self.player.health > 30 else RED,
                         (18, 12, int(220 * max(0, self.player.health) / self.player.max_health), 20))
        self.text(f"HP {max(0, self.player.health)}/{self.player.max_health}   LIVES {self.player.lives}",
                  (20, 38), WHITE, self.small_font)
        ammo_bar = pygame.Rect(18, 105, 220, 14)
        pygame.draw.rect(self.canvas, (22, 25, 48), ammo_bar, border_radius=6)
        if self.player.ammo_recharging:
            ammo_color = (65, 155, 255)
        elif self.player.current_ammo <= 10:
            ammo_color = RED
        elif self.player.current_ammo <= 25:
            ammo_color = (255, 190, 55)
        else:
            ammo_color = GREEN
        pygame.draw.rect(self.canvas, ammo_color,
                         (ammo_bar.x, ammo_bar.y,
                          int(ammo_bar.width * self.player.current_ammo / self.player.MAX_AMMO), ammo_bar.height),
                         border_radius=6)
        self.text(f"AMMO: {int(self.player.current_ammo)}/{self.player.MAX_AMMO}",
                  (20, 122), WHITE, self.small_font)
        if self.player.ammo_recharging:
            self.text("RECHARGING", (150, 122), (65, 155, 255), self.small_font)
        score_panel = pygame.Rect(WIDTH - 445, 8, 433, 38)
        pygame.draw.rect(self.canvas, (5, 10, 30), score_panel, border_radius=10)
        pygame.draw.rect(self.canvas, (45, 75, 125), score_panel, 1, border_radius=10)
        high_score = max([item.get("score", 0) for item in self.save.get("high_scores", [])] + [self.score])
        self.text(f"SCORE {self.score:07d}  HIGH {high_score:07d}  WAVE {self.wave}", (WIDTH - 432, 20), WHITE, self.small_font)
        if self.wave_banner > 0:
            self.text("BOSS INCOMING!" if self.boss else f"WAVE {self.wave}", (WIDTH // 2, 180), YELLOW, self.big_font, True)
        if self.player.health <= self.player.max_health * 0.25:
            warning_alpha = 45 + int((math.sin(self.elapsed * 8) + 1) * 25)
            warning = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            pygame.draw.rect(warning, (RED[0], RED[1], RED[2], warning_alpha), warning.get_rect(), 8)
            self.canvas.blit(warning, (0, 0))
            self.text("HULL CRITICAL", (WIDTH // 2, HEIGHT - 35), RED, self.small_font, True)

    def draw_panel(self, title: str, lines: list[str]) -> None:
        self.draw_background()
        panel = pygame.Rect(190, 55, 900, 610)
        pygame.draw.rect(self.canvas, (0, 0, 0, 110), panel.move(7, 8), border_radius=20)
        pygame.draw.rect(self.canvas, (7, 10, 30), panel, border_radius=20)
        pygame.draw.rect(self.canvas, CYAN, panel, 2, border_radius=20)
        pygame.draw.line(self.canvas, MAGENTA, (panel.x + 40, 160), (panel.right - 40, 160), 2)
        self.text(title, (WIDTH // 2, 120), YELLOW, self.big_font, True)
        for i, line in enumerate(lines):
            self.text(line, (WIDTH // 2, 215 + i * 42), WHITE, self.font, True)
        self.text("ESC / ENTER: Back", (WIDTH // 2, 600), MAGENTA, self.small_font, True)

    def update_formation(self, dt: float) -> None:
        if not self.enemies:
            return
        left_edge = min(enemy.base_x - enemy.rect.width // 2 for enemy in self.enemies)
        right_edge = max(enemy.base_x + enemy.rect.width // 2 for enemy in self.enemies)
        speed = 85.0 * self.difficulty.enemy_speed
        self.formation_offset += self.formation_direction * speed * dt
        if right_edge + self.formation_offset >= WIDTH - 20:
            self.formation_offset = WIDTH - 20 - right_edge
            self.formation_direction = -1.0
        elif left_edge + self.formation_offset <= 20:
            self.formation_offset = 20 - left_edge
            self.formation_direction = 1.0

    def handle_menu_key(self, event: pygame.event.Event) -> None:
        if event.key in (pygame.K_UP, pygame.K_w):
            self.menu_index = (self.menu_index - 1) % len(self.menu_items)
        elif event.key in (pygame.K_DOWN, pygame.K_s):
            self.menu_index = (self.menu_index + 1) % len(self.menu_items)
        elif event.key in (pygame.K_RETURN, pygame.K_SPACE):
            choice = self.menu_items[self.menu_index]
            if choice == "START GAME":
                self.state = "difficulty"
            elif choice == "OPTIONS":
                self.state, self.menu_index = "options", 0
            elif choice == "HIGH SCORES":
                self.state = "scores"
            elif choice == "HOW TO PLAY":
                self.state = "help"
            elif choice == "ABOUT":
                self.state = "about"
            else:
                pygame.event.post(pygame.event.Event(pygame.QUIT))

    def start_selected_difficulty(self) -> None:
        self.difficulty = DIFFICULTIES[self.difficulty_index]
        self.save.setdefault("settings", {})["difficulty"] = self.difficulty.name
        save_data(self.save)
        self.difficulty_confirmation = False
        self.reset_game()
        self.state = "playing"

    def update_playing(self, dt: float) -> None:
        keys = pygame.key.get_pressed()
        wants_fire = bool(keys[pygame.K_SPACE] or pygame.mouse.get_pressed(3)[0])
        self.player.update(dt, keys, wants_fire)
        if self.mouse_target is not None:
            mouse_x, mouse_y = self.mouse_target
            self.player.rect.center = (
                max(self.player.rect.width // 2, min(WIDTH - self.player.rect.width // 2, mouse_x)),
                max(35 + self.player.rect.height // 2, min(HEIGHT - self.player.rect.height // 2, mouse_y)),
            )
            self.mouse_target = None
        if wants_fire:
            self.player.shoot(self.bullets)
        self.bullets.update(dt)
        self.enemy_bullets.update(dt)
        self.drops.update(dt)
        self.update_formation(dt)
        for enemy in self.enemies:
            enemy.update(dt, self.elapsed, self.player.rect.center, self.enemy_bullets, self.formation_offset)
        if self.boss:
            self.boss.update(dt, self.enemy_bullets, self.player.rect.center)
        for bullet in list(self.bullets):
            targets = pygame.sprite.spritecollide(bullet, self.enemies, False)
            if self.boss and self.boss.rect.colliderect(bullet.rect):
                damage = bullet.damage if not self.boss.shield_active else max(1, bullet.damage // 4)
                self.boss.health -= damage
                bullet.kill()
            if targets:
                bullet.kill()
                enemy = targets[0]
                enemy.health -= bullet.damage
                if enemy.health <= 0:
                    self.destroy_enemy(enemy)
        for bullet in pygame.sprite.spritecollide(self.player, self.enemy_bullets, True):
            self.player.damage(bullet.damage)
            if bullet.explosion_radius:
                self.particles.extend(Particle(self.player.rect.center, bullet.image.get_at((0, 0))[:3]) for _ in range(5))
        for enemy in pygame.sprite.spritecollide(self.player, self.enemies, False):
            self.player.damage(self.difficulty.enemy_damage)
        for drop in pygame.sprite.spritecollide(self.player, self.drops, True):
            self.particles.extend(Particle(drop.rect.center, drop.color) for _ in range(10))
            if drop.kind == "HEALTH":
                self.player.health = min(self.player.max_health, self.player.health + 30)
                self.score += 150
                self.notify("+30 HP", RED)
                self.play_sound("health")
            elif drop.kind == "AMMO":
                self.player.rapid_timer = max(self.player.rapid_timer, 12.0)
                self.score += 200
                message = "AMMO BOOST"
                self.notify(message, (65, 155, 255))
                self.play_sound("powerup")
            elif drop.kind == "LASER":
                old_weapon = self.player.weapon
                new_weapon = self.player.evolve_weapon()
                self.score += 250
                if new_weapon > old_weapon:
                    self.particles.extend(Particle(self.player.rect.center, GREEN) for _ in range(18))
                    self.notify(f"WEAPON LEVEL {new_weapon}", GREEN)
                    self.play_sound("laser")
                else:
                    self.notify("MAX WEAPON LEVEL", GREEN)
        for particle in self.particles[:]:
            particle.update(dt)
            if particle.life <= 0:
                self.particles.remove(particle)
        for notification in self.notifications[:]:
            notification["life"] = float(notification["life"]) - dt
            if float(notification["life"]) <= 0:
                self.notifications.remove(notification)
        self.wave_banner = max(0, self.wave_banner - dt)
        if self.player.health <= 0:
            self.player.lives -= 1
            if self.player.lives > 0:
                self.player.health, self.player.rect.center = self.player.max_health, (WIDTH // 2, HEIGHT - 100)
                self.player.weapon = 0
                self.player.current_ammo = float(self.player.MAX_AMMO)
                self.player.ammo_recharging = False
                self.player.invulnerable = 2
            else:
                self.finish_game("game_over")
        wave_complete = (
            self.enemies_spawned == self.total_enemies_to_spawn
            and self.living_enemies == 0
            and not self.boss
        )
        if wave_complete:
            self.score += self.wave * 250
            self.wave += 1
            self.wave_banner = 2.0
            self.spawn_wave()
        if self.boss and self.boss.health <= 0:
            self.score += self.wave * 1000
            self.boss = None
            self.wave += 1
            self.wave_banner = 2.0
            self.spawn_wave()

    def destroy_enemy(self, enemy: pygame.sprite.Sprite, multiplier: int = 1) -> None:
        if not enemy.alive():
            return
        self.score += getattr(enemy, "score", 50) * multiplier
        self.destroyed += 1
        self.enemies_destroyed += 1
        self.living_enemies = max(0, self.living_enemies - 1)
        center = enemy.rect.center
        enemy.kill()
        self.particles.extend(Particle(center, random.choice((CYAN, MAGENTA, YELLOW, RED))) for _ in range(12))
        if random.random() < self.difficulty.drop_chance:
            self.drops.add(Drop(center[0], center[1], random.choice(("HEALTH", "AMMO", "LASER"))))

    def finish_game(self, state: str) -> None:
        self.state = state
        self.save["high_scores"].append({"score": self.score, "wave": self.wave, "destroyed": self.destroyed})
        self.save["high_scores"] = sorted(self.save["high_scores"], key=lambda item: item["score"], reverse=True)[:10]
        save_data(self.save)

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.QUIT:
            self.running = False
        elif event.type == pygame.VIDEORESIZE and not self.fullscreen:
            self.screen = pygame.display.set_mode((max(640, event.w), max(360, event.h)), pygame.RESIZABLE)
        elif event.type == pygame.MOUSEMOTION:
            position = self.mouse_to_canvas(event.pos)
            if self.state == "playing":
                self.mouse_target = position
            elif self.state == "menu":
                hovered = self.menu_button_at(position)
                if hovered is not None:
                    self.menu_index = hovered
            elif self.state == "difficulty":
                if not self.difficulty_confirmation:
                    index = (position[1] - 135) // 64
                    if 0 <= index < len(DIFFICULTIES):
                        self.difficulty_index = index
            elif self.state == "options" and 205 <= position[1] <= 315:
                self.menu_index = 0 if position[1] < 260 else 1
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            position = self.mouse_to_canvas(event.pos)
            if self.state == "menu":
                clicked = self.menu_button_at(position)
                if clicked is not None:
                    self.menu_index = clicked
                    self.handle_menu_key(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_RETURN))
            elif self.state == "difficulty":
                if self.difficulty_confirmation:
                    yes = pygame.Rect(380, 365, 210, 62)
                    no = pygame.Rect(690, 365, 210, 62)
                    if yes.collidepoint(position):
                        self.start_selected_difficulty()
                    elif no.collidepoint(position):
                        self.difficulty_confirmation = False
                else:
                    index = (position[1] - 135) // 64
                    if 0 <= index < len(DIFFICULTIES):
                        self.difficulty_index = index
                        self.difficulty_confirmation = True
                    elif pygame.Rect(WIDTH // 2 - 220, 650, 440, 48).collidepoint(position):
                        self.difficulty_confirmation = True
            elif self.state == "paused":
                if pygame.Rect(WIDTH // 2 - 300, 315, 600, 70).collidepoint(position):
                    self.state = "playing"
                elif pygame.Rect(WIDTH // 2 - 300, 385, 600, 70).collidepoint(position):
                    self.reset_game()
                    self.state = "playing"
                elif pygame.Rect(WIDTH // 2 - 300, 455, 600, 70).collidepoint(position):
                    self.state = "menu"
            elif self.state in ("scores", "help", "about"):
                self.state = "menu"
            elif self.state == "options":
                if 205 <= position[1] < 260:
                    self.menu_index = 0
                    self.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_RETURN))
                elif 260 <= position[1] < 315:
                    self.menu_index = 1
                    self.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_RETURN))
                elif position[1] >= 315:
                    self.menu_index = 2
                    self.state = "menu"
            elif self.state in ("game_over", "victory"):
                if pygame.Rect(WIDTH // 2 - 300, 380, 600, 80).collidepoint(position):
                    self.reset_game()
                    self.state = "playing"
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_F11 or (event.key == pygame.K_RETURN and event.mod & pygame.KMOD_ALT):
                self.fullscreen = not self.fullscreen
                flags = pygame.FULLSCREEN if self.fullscreen else pygame.RESIZABLE
                self.screen = pygame.display.set_mode((WIDTH, HEIGHT), flags)
            elif event.key == pygame.K_ESCAPE:
                if self.state == "playing":
                    self.state = "paused"
                elif self.state == "paused":
                    self.state = "playing"
                elif self.state == "difficulty":
                    if self.difficulty_confirmation:
                        self.difficulty_confirmation = False
                    else:
                        self.state = "menu"
                elif self.state != "menu":
                    self.state = "menu"
            elif self.state == "menu":
                self.handle_menu_key(event)
            elif self.state == "difficulty":
                if self.difficulty_confirmation:
                    if event.key in (pygame.K_y, pygame.K_RETURN, pygame.K_SPACE):
                        self.start_selected_difficulty()
                    elif event.key in (pygame.K_n, pygame.K_ESCAPE):
                        self.difficulty_confirmation = False
                elif event.key in (pygame.K_UP, pygame.K_w):
                    self.difficulty_index = (self.difficulty_index - 1) % len(DIFFICULTIES)
                elif event.key in (pygame.K_DOWN, pygame.K_s):
                    self.difficulty_index = (self.difficulty_index + 1) % len(DIFFICULTIES)
                elif event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    self.difficulty_confirmation = True
            elif self.state in ("scores", "help", "about"):
                if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    self.state = "menu"
            elif self.state == "options":
                if event.key in (pygame.K_UP, pygame.K_DOWN):
                    self.menu_index = (self.menu_index + (1 if event.key == pygame.K_DOWN else -1)) % len(self.options)
                elif event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    if self.menu_index == 0:
                        self.options[0] = "Difficulty: Hard" if "Normal" in self.options[0] else "Difficulty: Normal"
                    elif self.menu_index == 1:
                        self.fullscreen = not self.fullscreen
                        flags = pygame.FULLSCREEN if self.fullscreen else pygame.RESIZABLE
                        self.screen = pygame.display.set_mode((WIDTH, HEIGHT), flags)
                    else:
                        self.state = "menu"
            elif self.state == "paused":
                if event.key == pygame.K_r:
                    self.reset_game()
                    self.state = "playing"
                elif event.key == pygame.K_m:
                    self.state = "menu"
            elif self.state in ("game_over", "victory") and event.key == pygame.K_r:
                self.reset_game()
                self.state = "playing"

    def draw_state(self) -> None:
        if self.state == "menu":
            self.draw_menu()
        elif self.state == "difficulty":
            self.draw_difficulty()
        elif self.state == "playing":
            self.draw_game()
        elif self.state == "paused":
            self.draw_game()
            pygame.draw.rect(self.canvas, (5, 5, 20, 185), (0, 0, WIDTH, HEIGHT))
            self.text("PAUSED", (WIDTH // 2, 260), YELLOW, self.big_font, True)
            self.text("ESC: RESUME    R: RESTART    M: MAIN MENU", (WIDTH // 2, 350), WHITE, self.font, True)
        elif self.state == "options":
            self.draw_panel("OPTIONS", self.options)
        elif self.state == "scores":
            scores = self.save.get("high_scores", [])
            lines = [f"{i + 1:02d}. {item['score']:07d}   WAVE {item['wave']}   KILLS {item['destroyed']}" for i, item in enumerate(scores)]
            self.draw_panel("HIGH SCORES", lines or ["No scores yet - save the galaxy!"])
        elif self.state == "help":
            self.draw_panel("HOW TO PLAY", ["WASD / ARROWS: MOVE", "SPACE: FIRE", "ESC: PAUSE / BACK", "Collect food to restore HP.", "Collect power-ups for stronger weapons.", "Every fifth wave features a boss."])
        elif self.state == "about":
            self.draw_panel("ABOUT", ["An original space-shooter built with Python + Pygame.", "Uses the supplied spaceship, enemy sheet, and space background.", "No external audio files are required.", "Survive. Upgrade. Save the galaxy."])
        else:
            self.draw_background()
            heading = "GAME OVER" if self.state == "game_over" else "YOU SAVED THE GALAXY!"
            self.text(heading, (WIDTH // 2, 220), RED if self.state == "game_over" else GREEN, self.big_font, True)
            self.text(f"Score: {self.score:07d}   Wave: {self.wave}   Destroyed: {self.destroyed}", (WIDTH // 2, 330), WHITE, self.font, True)
            self.text("R: RESTART    ESC: MAIN MENU", (WIDTH // 2, 420), YELLOW, self.font, True)

    def run(self) -> None:
        self.running = True
        while self.running:
            dt = min(self.clock.tick(FPS) / 1000.0, 0.05)
            self.elapsed += dt
            for event in pygame.event.get():
                self.handle_event(event)
            if self.state == "playing":
                self.update_playing(dt)
            if self.state != "paused":
                self.stars.update(dt)
            pygame.mouse.set_visible(self.state != "playing")
            self.draw_state()
            viewport = self.screen.get_rect()
            scaled = pygame.transform.smoothscale(self.canvas, viewport.size)
            self.screen.blit(scaled, (0, 0))
            pygame.display.flip()
        pygame.quit()


if __name__ == "__main__":
    Game().run()