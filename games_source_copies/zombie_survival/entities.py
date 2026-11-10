import math
import random
import pygame
from settings import *

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def vec(x, y):
    return pygame.Vector2(x, y)

class Particle:
    def __init__(self, pos, color, velocity=None, life=.45, radius=3):
        self.pos = vec(*pos)
        angle = random.random() * math.tau
        self.vel = velocity if velocity is not None else vec(math.cos(angle), math.sin(angle)) * random.uniform(45, 190)
        self.life = self.max_life = life
        self.radius = radius
        self.color = color

    def update(self, dt):
        self.life -= dt
        self.pos += self.vel * dt
        self.vel *= max(0, 1 - 3.2 * dt)

    def draw(self, surf, offset):
        if self.life <= 0: return
        r = max(1, int(self.radius * self.life / self.max_life))
        pygame.draw.circle(surf, self.color, self.pos + offset, r)

class FloatingText:
    def __init__(self, pos, text, color=WHITE):
        self.pos = vec(*pos)
        self.text = text
        self.color = color
        self.life = 0.8

    def update(self, dt):
        self.life -= dt
        self.pos.y -= 35 * dt

    def draw(self, surf, font, offset):
        if self.life > 0:
            img = font.render(self.text, True, self.color)
            img.set_alpha(int(255 * min(1, self.life * 2)))
            surf.blit(img, img.get_rect(center=self.pos + offset))

class Projectile:
    def __init__(self, pos, direction, damage, speed, color=CYAN):
        self.pos = vec(*pos)
        self.vel = direction.normalize() * speed
        self.damage = damage
        self.life = 1.25
        self.color = color
        self.radius = 5

    def update(self, dt):
        self.pos += self.vel * dt
        self.life -= dt

    def draw(self, surf, offset):
        p = self.pos + offset
        pygame.draw.circle(surf, self.color, p, self.radius)
        pygame.draw.circle(surf, WHITE, p, 2)

class Pickup:
    def __init__(self, pos, kind):
        self.pos = vec(*pos)
        self.kind = kind
        self.life = 12
        self.phase = random.random() * 6

    def update(self, dt):
        self.life -= dt
        self.phase += dt * 4

    def draw(self, surf, offset, font):
        p = self.pos + offset
        color = GREEN if self.kind == "heal" else GOLD
        pygame.draw.circle(surf, color, p, 12 + int(math.sin(self.phase) * 2), 2)
        label = "+" if self.kind == "heal" else "R"
        img = font.render(label, True, color)
        surf.blit(img, img.get_rect(center=p))

class Zombie:
    TYPES = {
        "walker":  {"hp": 38, "speed": 68,  "radius": 15, "color": (104, 180, 112), "damage": 10, "xp": 12, "score": 10},
        "runner":  {"hp": 24, "speed": 125, "radius": 11, "color": (220, 170, 85), "damage": 8, "xp": 15, "score": 16},
        "brute":   {"hp": 125,"speed": 43,  "radius": 22, "color": (170, 95, 105), "damage": 22, "xp": 30, "score": 35},
        "boss":    {"hp": 650,"speed": 52,  "radius": 34, "color": (160, 90, 220), "damage": 30, "xp": 150,"score": 250},
    }

    def __init__(self, pos, kind="walker", wave=1):
        self.pos = vec(*pos)
        self.kind = kind
        data = self.TYPES[kind]
        scale = 1 + max(0, wave - 1) * .095
        self.max_hp = data["hp"] * scale
        self.hp = self.max_hp
        self.speed = data["speed"] * (1 + max(0, wave - 1) * .018)
        self.radius = data["radius"]
        self.color = data["color"]
        self.damage = data["damage"]
        self.xp = data["xp"]
        self.score = data["score"]
        self.attack_cd = 0
        self.flash = 0

    def update(self, dt, player, zombies):
        direction = player.pos - self.pos
        if direction.length_squared() > 0:
            direction = direction.normalize()
        # Gentle separation prevents enemies stacking into one point.
        separation = vec(0, 0)
        for other in zombies:
            if other is self: continue
            delta = self.pos - other.pos
            d2 = delta.length_squared()
            if 0 < d2 < 34 * 34:
                separation += delta.normalize() * (34 - math.sqrt(d2)) * 2.2
        movement = direction * self.speed + separation
        if movement.length_squared():
            self.pos += movement.normalize() * min(movement.length(), self.speed + 45) * dt
        self.attack_cd = max(0, self.attack_cd - dt)
        self.flash = max(0, self.flash - dt)

    def draw(self, surf, offset):
        p = self.pos + offset
        color = WHITE if self.flash > 0 else self.color
        pygame.draw.circle(surf, (0, 0, 0), p + (3, 4), self.radius + 2)
        pygame.draw.circle(surf, color, p, self.radius)
        pygame.draw.circle(surf, (35, 42, 48), p, self.radius, 2)
        # Simple glowing eyes; deliberately stylized, non-realistic arcade art.
        eye_y = p.y - 3
        pygame.draw.circle(surf, (255, 230, 150), (int(p.x - 5), int(eye_y)), 2)
        pygame.draw.circle(surf, (255, 230, 150), (int(p.x + 5), int(eye_y)), 2)
        if self.kind == "boss":
            w = 58
            pygame.draw.rect(surf, (45, 35, 55), (p.x-w/2, p.y-self.radius-13, w, 5), border_radius=3)
            pygame.draw.rect(surf, PURPLE, (p.x-w/2, p.y-self.radius-13, w*self.hp/self.max_hp, 5), border_radius=3)

class Player:
    def __init__(self):
        self.pos = vec(WIDTH/2, HEIGHT/2)
        self.radius = 16
        self.speed = PLAYER_SPEED
        self.max_hp = 100
        self.hp = self.max_hp
        self.damage = 25
        self.fire_rate = .22
        self.fire_timer = 0
        self.projectile_speed = 620
        self.xp = 0
        self.level = 1
        self.next_xp = 55
        self.score = 0
        self.dash_cd = 0
        self.dash_time = 0
        self.invuln = 0
        self.rapid_time = 0

    def update(self, dt, keys):
        move = vec(keys[pygame.K_d] - keys[pygame.K_a], keys[pygame.K_s] - keys[pygame.K_w])
        if move.length_squared(): move = move.normalize()
        speed = self.speed * (2.35 if self.dash_time > 0 else 1)
        self.pos += move * speed * dt
        self.pos.x = clamp(self.pos.x, self.radius, WIDTH-self.radius)
        self.pos.y = clamp(self.pos.y, self.radius, HEIGHT-self.radius)
        self.fire_timer = max(0, self.fire_timer-dt)
        self.dash_cd = max(0, self.dash_cd-dt)
        self.dash_time = max(0, self.dash_time-dt)
        self.invuln = max(0, self.invuln-dt)
        self.rapid_time = max(0, self.rapid_time-dt)

    def draw(self, surf, offset, mouse):
        p = self.pos + offset
        aim = vec(*mouse) - self.pos
        if aim.length_squared(): aim = aim.normalize()
        pygame.draw.circle(surf, (0,0,0), p+(3,5), self.radius+3)
        pygame.draw.circle(surf, CYAN if self.invuln <= 0 else WHITE, p, self.radius)
        pygame.draw.circle(surf, (25, 50, 65), p, self.radius, 3)
        if aim.length_squared():
            end = p + aim * 25
            pygame.draw.line(surf, WHITE, p, end, 5)
        pygame.draw.circle(surf, WHITE, p, 4)

    def add_xp(self, amount):
        self.xp += amount
        if self.xp >= self.next_xp:
            self.xp -= self.next_xp
            self.level += 1
            self.next_xp = int(self.next_xp * 1.32 + 18)
            return True
        return False
