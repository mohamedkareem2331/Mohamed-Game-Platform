import math, random, json, os
import pygame
from settings import *
from entities import Player, Zombie, Projectile, Particle, FloatingText, Pickup
from ui import draw_text, panel, bar

pygame.init()
pygame.display.set_caption(TITLE)
screen = pygame.display.set_mode((WIDTH, HEIGHT))
clock = pygame.time.Clock()
font = pygame.font.SysFont("consolas", 20)
small = pygame.font.SysFont("consolas", 15)
big = pygame.font.SysFont("consolas", 58, bold=True)
medium = pygame.font.SysFont("consolas", 28, bold=True)
SAVE_FILE = "save_data.json"

def load_highscore():
    try:
        with open(SAVE_FILE, "r") as f: return int(json.load(f).get("highscore", 0))
    except (OSError, ValueError, TypeError): return 0

def save_highscore(value):
    try:
        with open(SAVE_FILE, "w") as f: json.dump({"highscore": value}, f)
    except OSError: pass

class Game:
    def __init__(self):
        self.highscore = load_highscore()
        self.state = "menu"
        self.reset()

    def reset(self):
        self.player = Player()
        self.zombies, self.projectiles, self.particles = [], [], []
        self.pickups, self.floaters = [], []
        self.wave = 0
        self.spawn_left = 0
        self.spawn_timer = 0
        self.wave_break = 1.5
        self.shake = 0
        self.upgrade_choices = []
        self.message = ""
        self.message_time = 0
        self.start_wave()

    def start_wave(self):
        self.wave += 1
        self.spawn_left = 5 + self.wave * 3
        self.spawn_timer = .5
        if self.wave % 5 == 0:
            self.zombies.append(Zombie(self.random_edge(), "boss", self.wave))
            self.message = "BOSS WAVE"
        else:
            self.message = f"WAVE {self.wave}"
        self.message_time = 2

    def random_edge(self):
        side = random.randrange(4)
        if side == 0: return (random.randrange(WIDTH), -25)
        if side == 1: return (WIDTH+25, random.randrange(HEIGHT))
        if side == 2: return (random.randrange(WIDTH), HEIGHT+25)
        return (-25, random.randrange(HEIGHT))

    def spawn_zombie(self):
        r = random.random()
        if self.wave >= 4 and r < .16: kind = "brute"
        elif self.wave >= 2 and r < .42: kind = "runner"
        else: kind = "walker"
        self.zombies.append(Zombie(self.random_edge(), kind, self.wave))

    def shoot(self, target):
        p = self.player
        direction = pygame.Vector2(target) - p.pos
        if direction.length_squared() == 0: return
        direction = direction.normalize()
        self.projectiles.append(Projectile(p.pos + direction*22, direction, p.damage, p.projectile_speed))
        p.fire_timer = p.fire_rate * (.48 if p.rapid_time > 0 else 1)
        for _ in range(3):
            self.particles.append(Particle(p.pos + direction*22, CYAN, -direction*random.uniform(40,100), .18, 2))

    def damage_player(self, amount):
        p = self.player
        if p.invuln > 0: return
        p.hp -= amount
        p.invuln = .65
        self.shake = 9
        self.message = f"-{amount} HP"
        self.message_time = .55
        for _ in range(12): self.particles.append(Particle(p.pos, RED, life=.35, radius=4))
        if p.hp <= 0:
            p.hp = 0
            self.state = "gameover"
            self.highscore = max(self.highscore, p.score)
            save_highscore(self.highscore)

    def kill_zombie(self, z):
        self.player.score += z.score
        leveled = self.player.add_xp(z.xp)
        self.floaters.append(FloatingText(z.pos, f"+{z.score}", GOLD))
        for _ in range(13 if z.kind == "boss" else 7):
            self.particles.append(Particle(z.pos, z.color, life=.55, radius=4))
        if random.random() < (.85 if z.kind == "boss" else .10):
            self.pickups.append(Pickup(z.pos, random.choice(["heal", "rapid"])))
        if leveled: self.open_upgrades()

    def open_upgrades(self):
        pool = [
            ("Power Core", "+8 projectile damage", lambda p: setattr(p, "damage", p.damage+8)),
            ("Quick Trigger", "Fire 12% faster", lambda p: setattr(p, "fire_rate", max(.075,p.fire_rate*.88))),
            ("Reinforced Suit", "+20 maximum health", lambda p: (setattr(p,"max_hp",p.max_hp+20),setattr(p,"hp",min(p.max_hp,p.hp+20)))),
            ("Running Shoes", "+8% movement speed", lambda p: setattr(p,"speed",p.speed*1.08)),
            ("Energy Cell", "+15 projectile speed", lambda p: setattr(p,"projectile_speed",p.projectile_speed+15)),
            ("Field Medic", "Restore 35 health", lambda p: setattr(p,"hp",min(p.max_hp,p.hp+35))),
        ]
        self.upgrade_choices = random.sample(pool, 3)
        self.state = "upgrade"

    def choose_upgrade(self, index):
        if 0 <= index < len(self.upgrade_choices):
            name, desc, action = self.upgrade_choices[index]
            action(self.player)
            self.message = name.upper()
            self.message_time = 1.3
            self.state = "playing"
            self.upgrade_choices = []

    def update(self, dt):
        if self.state != "playing": return
        p = self.player
        keys = pygame.key.get_pressed()
        p.update(dt, keys)
        if pygame.mouse.get_pressed()[0] and p.fire_timer <= 0:
            self.shoot(pygame.mouse.get_pos())
        if self.spawn_left > 0:
            self.spawn_timer -= dt
            if self.spawn_timer <= 0:
                self.spawn_zombie()
                self.spawn_left -= 1
                self.spawn_timer = max(.22, .85 - self.wave*.025)
        elif not self.zombies:
            self.wave_break -= dt
            if self.wave_break <= 0:
                self.wave_break = 2.2
                self.start_wave()

        for z in self.zombies[:]:
            z.update(dt, p, self.zombies)
            if z.pos.distance_to(p.pos) < z.radius + p.radius:
                if z.attack_cd <= 0:
                    self.damage_player(z.damage)
                    z.attack_cd = .8 if z.kind != "boss" else .65

        for bullet in self.projectiles[:]:
            bullet.update(dt)
            if bullet.life <= 0:
                self.projectiles.remove(bullet); continue
            hit = None
            for z in self.zombies:
                if bullet.pos.distance_squared_to(z.pos) < (z.radius+bullet.radius)**2:
                    hit = z; break
            if hit:
                hit.hp -= bullet.damage
                hit.flash = .09
                self.projectiles.remove(bullet)
                self.floaters.append(FloatingText(hit.pos, str(int(bullet.damage)), WHITE))
                if hit.hp <= 0:
                    self.zombies.remove(hit)
                    self.kill_zombie(hit)

        for item in self.pickups[:]:
            item.update(dt)
            if item.life <= 0:
                self.pickups.remove(item)
            elif item.pos.distance_to(p.pos) < 28:
                if item.kind == "heal": p.hp = min(p.max_hp, p.hp+30)
                else: p.rapid_time = 7
                self.message = "HEALTH RESTORED" if item.kind == "heal" else "RAPID FIRE!"
                self.message_time = 1.1
                self.pickups.remove(item)

        for collection in (self.particles, self.floaters):
            for obj in collection[:]:
                obj.update(dt)
                if obj.life <= 0: collection.remove(obj)
        self.message_time = max(0, self.message_time-dt)
        self.shake = max(0, self.shake-30*dt)

    def draw_background(self):
        screen.fill(BG)
        for x in range(0, WIDTH, 48):
            pygame.draw.line(screen, GRID, (x,0), (x,HEIGHT), 1)
        for y in range(0, HEIGHT, 48):
            pygame.draw.line(screen, GRID, (0,y), (WIDTH,y), 1)
        # Subtle arena boundary.
        pygame.draw.rect(screen, (34,45,61), (8,8,WIDTH-16,HEIGHT-16), 2, border_radius=8)

    def draw_hud(self):
        p = self.player
        panel(screen, pygame.Rect(18, 16, 280, 91))
        draw_text(screen, small, "HEALTH", (32,26), MUTED)
        draw_text(screen, small, f"{int(p.hp)}/{int(p.max_hp)}", (235,26), WHITE)
        bar(screen, 32, 49, 250, 13, p.hp, p.max_hp, GREEN if p.hp>35 else RED)
        draw_text(screen, small, f"LVL {p.level}", (32,72), CYAN)
        draw_text(screen, small, f"XP {p.xp}/{p.next_xp}", (110,72), MUTED)
        panel(screen, pygame.Rect(WIDTH-245, 16, 227, 91))
        draw_text(screen, small, "SCORE", (WIDTH-228,26), MUTED)
        draw_text(screen, medium, f"{p.score:,}", (WIDTH-228,47), GOLD)
        draw_text(screen, small, f"WAVE {self.wave}   BEST {self.highscore:,}", (WIDTH-228,80), WHITE)
        # Dash cooldown
        draw_text(screen, small, "DASH", (20, HEIGHT-34), MUTED)
        bar(screen, 75, HEIGHT-31, 110, 9, 2.2-p.dash_cd, 2.2, CYAN)
        if p.rapid_time > 0:
            draw_text(screen, small, f"RAPID FIRE {p.rapid_time:.1f}s", (WIDTH//2, 24), GOLD, True)

    def draw(self):
        self.draw_background()
        offset = pygame.Vector2(0,0)
        if self.shake > 0:
            offset = pygame.Vector2(random.uniform(-self.shake,self.shake), random.uniform(-self.shake,self.shake))
        for item in self.pickups: item.draw(screen, offset, small)
        for bullet in self.projectiles: bullet.draw(screen, offset)
        for z in self.zombies: z.draw(screen, offset)
        for part in self.particles: part.draw(screen, offset)
        self.player.draw(screen, offset, pygame.mouse.get_pos())
        for f in self.floaters: f.draw(screen, small, offset)
        self.draw_hud()

        if self.message_time > 0:
            draw_text(screen, medium, self.message, (WIDTH//2, 125), GOLD, True)

        if self.state == "menu":
            self.overlay("NIGHTFALL", ["ZOMBIE SURVIVAL", "WASD move   •   Mouse aim + fire", "SPACE dash   •   P pause", "Press ENTER to begin", f"PERSONAL BEST  {self.highscore:,}"])
        elif self.state == "paused":
            self.overlay("PAUSED", ["Press P or ESC to continue"])
        elif self.state == "upgrade":
            self.overlay("LEVEL UP!", ["Choose an upgrade with key 1, 2 or 3"] + [
                f"{i+1}. {item[0]} — {item[1]}" for i,item in enumerate(self.upgrade_choices)])
        elif self.state == "gameover":
            self.overlay("RUN OVER", [f"Final score: {self.player.score:,}", f"Wave reached: {self.wave}", f"Best score: {self.highscore:,}", "Press ENTER to play again"])

    def overlay(self, title, lines):
        shade = pygame.Surface((WIDTH,HEIGHT), pygame.SRCALPHA)
        shade.fill((4,7,13,205))
        screen.blit(shade,(0,0))
        panel(screen, pygame.Rect(WIDTH//2-330, HEIGHT//2-190, 660, 380), (17,24,36,250), (65,91,120))
        draw_text(screen, big, title, (WIDTH//2, HEIGHT//2-115), CYAN, True)
        for i,line in enumerate(lines):
            draw_text(screen, font if i else medium, line, (WIDTH//2, HEIGHT//2-35+i*43), WHITE if i else GOLD, True)

    def run(self):
        running = True
        while running:
            dt = min(clock.tick(FPS)/1000, .035)
            for event in pygame.event.get():
                if event.type == pygame.QUIT: running = False
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_RETURN and self.state in ("menu","gameover"):
                        self.reset(); self.state = "playing"
                    elif event.key in (pygame.K_p, pygame.K_ESCAPE):
                        if self.state == "playing": self.state = "paused"
                        elif self.state == "paused": self.state = "playing"
                    elif event.key == pygame.K_SPACE and self.state == "playing" and self.player.dash_cd <= 0:
                        keys = pygame.key.get_pressed()
                        move = pygame.Vector2(keys[pygame.K_d]-keys[pygame.K_a], keys[pygame.K_s]-keys[pygame.K_w])
                        if move.length_squared() == 0: move = pygame.Vector2(pygame.mouse.get_pos())-self.player.pos
                        if move.length_squared(): self.player.pos += move.normalize()*115
                        self.player.dash_cd = 2.2
                        self.player.dash_time = .18
                        self.player.invuln = max(self.player.invuln,.22)
                        for _ in range(16): self.particles.append(Particle(self.player.pos, CYAN, life=.3, radius=3))
                    elif self.state == "upgrade" and event.key in (pygame.K_1,pygame.K_2,pygame.K_3):
                        self.choose_upgrade(event.key-pygame.K_1)
            self.update(dt)
            self.draw()
            pygame.display.flip()
        pygame.quit()

if __name__ == "__main__":
    Game().run()
