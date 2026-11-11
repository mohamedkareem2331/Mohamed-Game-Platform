"""Turn-based Dungeon rules. No graphics dependency; deterministic seeded maps."""
from __future__ import annotations
from collections import deque
from dataclasses import dataclass, asdict
import random

WIDTH, HEIGHT = 49, 35
FLOOR_NAMES = ('The Forgotten Gate', 'Mossbound Halls', 'The Sunken Keep', 'Ember Vault', 'The Hollow Throne')

@dataclass
class Enemy:
    x: int
    y: int
    kind: int
    hp: int
    maximum: int
    boss: bool = False

class Run:
    def __init__(self, seed=None):
        self.seed = random.randrange(1_000_000) if seed is None else seed
        self.floor = 1
        self.hp = self.max_hp = 80
        self.gold = self.xp = self.kills = self.turns = 0
        self.level = 1
        self.weapon = self.armor = 0
        self.potions, self.food, self.arrows = 3, 2, 12
        self.hunger = 100
        self.dead = self.won = False
        self.messages = ['Find the stairs. Survive five floors. Claim the crown.']
        self.generate()

    def say(self, message):
        self.messages.append(message)
        self.messages = self.messages[-6:]

    def generate(self):
        self.rng = random.Random(self.seed + self.floor * 1009)
        self.tiles = [[0] * WIDTH for _ in range(HEIGHT)]
        self.rooms = []
        for _ in range(110):
            w, h = self.rng.randint(5, 10), self.rng.randint(5, 8)
            x, y = self.rng.randint(2, WIDTH-w-2), self.rng.randint(2, HEIGHT-h-2)
            if any(x < a+c+2 and x+w+2 > a and y < b+d+2 and y+h+2 > b for a,b,c,d in self.rooms):
                continue
            for yy in range(y,y+h):
                for xx in range(x,x+w): self.tiles[yy][xx] = 1
            center = x+w//2, y+h//2
            if self.rooms:
                a,b,c,d = self.rooms[-1]
                px,py = a+c//2,b+d//2
                for xx in range(min(px,center[0]),max(px,center[0])+1): self.tiles[py][xx] = 1
                for yy in range(min(py,center[1]),max(py,center[1])+1): self.tiles[yy][center[0]] = 1
            self.rooms.append((x,y,w,h))
        x,y,w,h = self.rooms[0]
        self.x,self.y = x+w//2,y+h//2
        x,y,w,h = self.rooms[-1]
        self.stairs = (x+w//2,y+h//2)
        cells = [(x,y) for y in range(HEIGHT) for x in range(WIDTH) if self.walkable(x,y)
                 and abs(x-self.x)+abs(y-self.y)>5 and (x,y)!=self.stairs]
        self.rng.shuffle(cells)
        self.enemies = []
        for i in range(6+self.floor*2):
            x,y = cells.pop()
            kind = self.rng.randrange(min(3,self.floor+1))
            hp = 13+kind*6+self.floor*3
            self.enemies.append(Enemy(x,y,kind,hp,hp))
        if self.floor == 5:
            self.enemies.append(Enemy(*self.stairs,2,110,110,True))
        self.loot = {}
        for kind in ['chest']*5+['potion']*3+['food']*3+['gold']*7+['arrows']*2:
            self.loot[cells.pop()] = kind
        self.traps = set(cells.pop() for _ in range(3+self.floor))
        self.seen = set()
        self.reveal()

    def walkable(self,x,y):
        return 0 <= x < WIDTH and 0 <= y < HEIGHT and self.tiles[y][x] == 1

    def line(self,a,b):
        x,y = a; tx,ty = b
        dx,dy = abs(tx-x),-abs(ty-y)
        sx,sy = (1 if x<tx else -1),(1 if y<ty else -1)
        err = dx+dy
        while (x,y)!=(tx,ty):
            e2=2*err
            if e2>=dy: err+=dy; x+=sx
            if e2<=dx: err+=dx; y+=sy
            if not self.walkable(x,y): return False
        return True

    def reveal(self):
        self.visible = {(x,y) for y in range(max(0,self.y-8),min(HEIGHT,self.y+9))
                        for x in range(max(0,self.x-8),min(WIDTH,self.x+9))
                        if (x-self.x)**2+(y-self.y)**2 <= 64 and
                        (self.line((self.x,self.y),(x,y)) or
                         any(self.walkable(x+dx,y+dy) and self.line((self.x,self.y),(x+dx,y+dy))
                             for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))))}
        self.seen.update(self.visible)

    @property
    def attack(self): return 8+self.weapon*3+self.level*2

    def hurt_enemy(self,enemy,damage):
        enemy.hp -= damage
        self.say(f'{"Guardian" if enemy.boss else "Orc"} takes {damage} damage.')
        if enemy.hp <= 0:
            self.enemies.remove(enemy)
            self.kills += 1
            self.gold += 7+self.floor*3
            self.xp += 14 if not enemy.boss else 75
            self.say('The guardian falls. The crown is yours!' if enemy.boss else 'Enemy defeated. Gold recovered.')
            if self.xp >= self.level*35:
                self.xp -= self.level*35
                self.level += 1
                self.max_hp += 10
                self.hp = min(self.max_hp,self.hp+25)
                self.say(f'Level {self.level}! Strength and vitality increased.')

    def pickup(self):
        item = self.loot.pop((self.x,self.y),None)
        if item == 'gold':
            n=self.rng.randint(8,22); self.gold+=n; self.say(f'Found {n} gold.')
        elif item == 'potion': self.potions+=1; self.say('Healing potion collected. [Q] to drink.')
        elif item == 'food': self.food+=1; self.say('Rations collected. [F] to eat.')
        elif item == 'arrows': self.arrows+=6; self.say('Six arrows collected. [B] to shoot.')
        elif item == 'chest':
            self.gold+=20
            if self.rng.random()<.6:
                self.weapon+=1; self.say(f'Chest: weapon upgraded to +{self.weapon}, and 20 gold.')
            else:
                self.armor+=1; self.say(f'Chest: armor upgraded to +{self.armor}, and 20 gold.')

    def act(self,action,dx=0,dy=0):
        if self.dead or self.won: return False
        if action == 'move':
            tx,ty=self.x+dx,self.y+dy
            if not self.walkable(tx,ty): return False
            enemy=next((e for e in self.enemies if (e.x,e.y)==(tx,ty)),None)
            if enemy: self.hurt_enemy(enemy,self.attack+self.rng.randint(-2,3))
            else:
                self.x,self.y=tx,ty
                self.pickup()
                if (tx,ty) in self.traps:
                    self.hp-=7; self.traps.remove((tx,ty)); self.say('A hidden spike trap! -7 health.')
        elif action == 'potion':
            if not self.potions or self.hp==self.max_hp:
                self.say('No potion needed.' if self.hp==self.max_hp else 'No potions left.'); return False
            self.potions-=1; self.hp=min(self.max_hp,self.hp+40); self.say('Potion restores up to 40 health.')
        elif action == 'food':
            if not self.food: self.say('No rations left.'); return False
            self.food-=1; self.hunger=100; self.hp=min(self.max_hp,self.hp+12); self.say('Rations restore hunger and 12 health.')
        elif action == 'bow':
            targets=[e for e in self.enemies if (e.x,e.y) in self.visible and self.line((self.x,self.y),(e.x,e.y))]
            if not targets or not self.arrows:
                self.say('No clear target.' if not targets else 'No arrows left.'); return False
            target=min(targets,key=lambda e: abs(e.x-self.x)+abs(e.y-self.y))
            self.arrows-=1; self.hurt_enemy(target,self.attack+5)
        elif action == 'descend':
            if (self.x,self.y)!=self.stairs: self.say('Stand on the glowing stairs first.'); return False
            if self.floor==5:
                if any(e.boss for e in self.enemies): self.say('Defeat the guardian to claim the crown.'); return False
                self.won=True; self.say('You escaped with the Hollow Crown!'); return True
            self.floor+=1; self.hp=min(self.max_hp,self.hp+15); self.generate()
            self.say(f'Floor {self.floor}: {FLOOR_NAMES[self.floor-1]}. +15 health.'); return True
        elif action != 'wait': return False
        self.turns+=1
        if self.turns%8==0: self.hunger=max(0,self.hunger-1)
        if self.hunger==0: self.hp-=1
        self.enemy_turn()
        if self.hp<=0: self.hp=0; self.dead=True; self.say('Your journey ends here. A new dungeon awaits.')
        self.reveal()
        return True

    def enemy_turn(self):
        # A reverse breadth-first field routes monsters through doors and corridors.
        distance={(self.x,self.y):0}; queue=deque(distance)
        while queue:
            x,y=queue.popleft()
            if distance[x,y]>=12: continue
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                p=x+dx,y+dy
                if self.walkable(*p) and p not in distance:
                    distance[p]=distance[x,y]+1; queue.append(p)
        occupied={(e.x,e.y) for e in self.enemies}
        for e in self.enemies:
            d=distance.get((e.x,e.y),99)
            if d==1:
                damage=max(1,self.floor+e.kind+ self.rng.randint(1,4)-self.armor)
                if e.boss: damage+=4
                self.hp-=damage; self.say(f'{"Guardian" if e.boss else "Orc"} hits you for {damage}.')
            elif d<=9:
                options=[(e.x+dx,e.y+dy) for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))]
                options=[p for p in options if distance.get(p,99)<d and p not in occupied and p!=(self.x,self.y)]
                if options:
                    occupied.remove((e.x,e.y)); e.x,e.y=min(options,key=lambda p:distance[p]); occupied.add((e.x,e.y))

    def export(self):
        return {k:getattr(self,k) for k in ('seed','floor','hp','max_hp','gold','xp','kills','turns','level','weapon','armor','potions','food','arrows','hunger','dead','won','x','y','messages')} | {
            'enemies':[asdict(e) for e in self.enemies], 'loot':[[x,y,k] for (x,y),k in self.loot.items()],
            'traps':sorted(self.traps),'seen':sorted(self.seen),'rng':self.rng.getstate()}

    @classmethod
    def restore(cls,data):
        run=cls(int(data['seed'])); run.floor=int(data['floor']); run.generate()
        for key in ('hp','max_hp','gold','xp','kills','turns','level','weapon','armor','potions','food','arrows','hunger','dead','won','x','y','messages'):
            setattr(run,key,data[key])
        run.enemies=[Enemy(**e) for e in data['enemies']]
        run.loot={(x,y):k for x,y,k in data['loot']}
        run.traps=set(map(tuple,data['traps'])); run.seen=set(map(tuple,data['seen']))
        def tuples(v): return tuple(map(tuples,v)) if isinstance(v,list) else v
        run.rng.setstate(tuples(data['rng'])); run.reveal(); return run
