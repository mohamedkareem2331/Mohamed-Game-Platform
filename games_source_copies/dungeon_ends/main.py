"""Dungeon: The Hollow Crown. Run with Python 3.11+ and pygame-ce."""
import asyncio
import io
import json
import math
import os
from pathlib import Path
import random
import sys
import zipfile
from array import array
import pygame
from engine import Run, WIDTH, HEIGHT, FLOOR_NAMES

BASE = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
WEB = sys.platform == 'emscripten'
SIZE = (1280, 800)
INK = (12, 16, 24)
PANEL = (20, 27, 37)
EDGE = (48, 60, 73)
TEXT = (224, 227, 218)
MUTED = (137, 153, 160)
GOLD = (225, 180, 99)
TEAL = (94, 205, 179)
RED = (215, 95, 91)
MOVES = {pygame.K_w:(0,-1), pygame.K_UP:(0,-1), pygame.K_s:(0,1), pygame.K_DOWN:(0,1),
         pygame.K_a:(-1,0), pygame.K_LEFT:(-1,0), pygame.K_d:(1,0), pygame.K_RIGHT:(1,0)}

def save_read():
    try:
        if WEB:
            from platform import window
            raw = window.localStorage.getItem('dungeon-hollow-crown-v1')
            return json.loads(raw) if raw else None
        path = Path(os.environ.get('LOCALAPPDATA',str(Path.home()))) / 'DungeonHollowCrown' / 'save.json'
        return json.loads(path.read_text()) if path.exists() else None
    except (OSError, ValueError, TypeError):
        return None

def save_write(run):
    payload=json.dumps(run.export())
    try:
        if WEB:
            from platform import window
            window.localStorage.setItem('dungeon-hollow-crown-v1',payload)
        else:
            path=Path(os.environ.get('LOCALAPPDATA',str(Path.home()))) / 'DungeonHollowCrown' / 'save.json'
            path.parent.mkdir(parents=True,exist_ok=True)
            temp=path.with_suffix('.tmp'); temp.write_text(payload); temp.replace(path)
        return True
    except (OSError,ValueError): return False

class Art:
    def __init__(self):
        self.cache={}
        self.pack=zipfile.ZipFile(BASE/'assets.pak') if (BASE/'assets.pak').exists() else None

    def image(self,name):
        if name not in self.cache:
            try:
                self.cache[name]=pygame.image.load(io.BytesIO(self.pack.read(name))).convert_alpha() if self.pack else None
            except (KeyError,pygame.error): self.cache[name]=None
        return self.cache[name]

    def tile(self,name,rect,size):
        key=name,rect,size
        if key not in self.cache:
            src=self.image(name)
            self.cache[key]=pygame.transform.scale(src.subsurface(rect),size) if src else None
        return self.cache[key]

class Game:
    def __init__(self):
        pygame.init()
        self.window=pygame.display.set_mode(SIZE,pygame.RESIZABLE)
        pygame.display.set_caption('Dungeon | The Hollow Crown')
        self.screen=pygame.Surface(SIZE)
        self.clock=pygame.time.Clock()
        self.art=Art()
        self.fonts={}
        self.run=Run()
        self.mode='title'
        self.running=True
        self.buttons=[]
        self.time=0
        self.last_move=0
        self.flash=0
        self.sound=True
        self.sounds={}
        self.saved=save_read()
        self.facing=0
        self.last_save=0
        self.make_sounds()

    def make_sounds(self):
        try:
            pygame.mixer.init(frequency=22050,size=-16,channels=1)
            for name,freq in [('step',160),('hit',95),('loot',660),('heal',440),('stairs',880)]:
                count=2205 if name!='step' else 660
                values=array('h',(int(1900*math.sin(2*math.pi*freq*i/22050)*(1-i/count)) for i in range(count)))
                self.sounds[name]=pygame.mixer.Sound(buffer=values)
        except pygame.error: self.sound=False

    def beep(self,name):
        if self.sound and name in self.sounds: self.sounds[name].play()

    def text(self,string,x,y,size=22,color=TEXT):
        if size not in self.fonts: self.fonts[size]=pygame.font.Font(None,size)
        self.screen.blit(self.fonts[size].render(str(string),True,color),(x,y))

    def panel(self,rect,fill=PANEL,border=EDGE):
        pygame.draw.rect(self.screen,fill,rect,border_radius=8)
        pygame.draw.rect(self.screen,border,rect,1,border_radius=8)

    def button(self,label,rect,action,accent=False):
        rect=pygame.Rect(rect)
        mouse=self.mouse()
        fill=(45,61,65) if rect.collidepoint(mouse) else ((42,48,44) if accent else PANEL)
        self.panel(rect,fill,GOLD if accent else EDGE)
        self.text(label,rect.x+16,rect.y+(rect.h-22)//2,24,GOLD if accent else TEXT)
        self.buttons.append((rect,action))

    def mouse(self):
        x,y=pygame.mouse.get_pos(); w,h=self.window.get_size()
        scale=min(w/SIZE[0],h/SIZE[1]); ox=(w-SIZE[0]*scale)/2; oy=(h-SIZE[1]*scale)/2
        return ((x-ox)/scale,(y-oy)/scale)

    def hero(self,x,y):
        # Original small knight, drawn as pixels; bundled orcs retain their own silhouettes.
        s=pygame.Surface((16,20),pygame.SRCALPHA)
        pygame.draw.ellipse(s,(0,0,0,100),(1,16,14,4))
        for color,r in [((48,65,80),(4,13,3,5)),((48,65,80),(9,13,3,5)),
                        ((188,146,77),(4,8,8,6)),((74,148,156),(5,8,6,6)),
                        ((169,188,196),(4,2,8,7)),((214,225,223),(5,2,6,2)),
                        ((33,43,54),(4,5,8,2)),((107,216,206),(6,5,2,1)),
                        ((100,75,47),(1,9,3,7)),((197,159,85),(1,9,3,2)),
                        ((212,225,220),(13,6,2,8)),((216,175,88),(12,13,4,2)),
                        ((206,103,76),(7,0,3,3))]: pygame.draw.rect(s,color,r)
        self.screen.blit(pygame.transform.scale(s,(32,40)),(x,y-10))

    def icon(self,name,x,y,size=25):
        src=self.art.image(name)
        if src:
            trimmed=src.subsurface(src.get_bounding_rect())
            self.screen.blit(pygame.transform.smoothscale(trimmed,(size,size)),(x,y))

    def enemy_sprite(self,e,x,y):
        frame=int(self.time*5)%4
        sprite=self.art.tile(f'orc{e.kind+1}.png',(frame*64,self.facing*64,64,64),(64,64))
        if sprite:
            if e.boss:
                sprite=pygame.transform.scale(sprite,(88,88)); self.screen.blit(sprite,(x-28,y-43))
            else: self.screen.blit(sprite,(x-16,y-26))
        else:
            pygame.draw.circle(self.screen,(118,167,77) if not e.boss else RED,(x+16,y+13),12 if not e.boss else 18)
            pygame.draw.circle(self.screen,INK,(x+12,y+10),2); pygame.draw.circle(self.screen,INK,(x+20,y+10),2)
        if e.hp<e.maximum or e.boss:
            pygame.draw.rect(self.screen,(39,25,30),(x,y-8,32,4))
            pygame.draw.rect(self.screen,RED,(x,y-8,int(32*e.hp/e.maximum),4))

    def loot_sprite(self,kind,x,y):
        bob=int(math.sin(self.time*3+x)*2)
        if kind=='chest':
            tile=self.art.tile('objects.png',(160,0,32,32),(32,32))
            if tile: self.screen.blit(tile,(x,y-4)); return
            pygame.draw.rect(self.screen,(137,86,43),(x+4,y+8,24,18),border_radius=3)
            pygame.draw.rect(self.screen,GOLD,(x+14,y+11,4,12))
        elif kind=='potion':
            pygame.draw.rect(self.screen,(192,206,202),(x+12,y+5+bob,8,5))
            pygame.draw.rect(self.screen,(215,89,112),(x+9,y+11+bob,14,14),border_radius=4)
            pygame.draw.rect(self.screen,(255,178,186),(x+12,y+12+bob,3,7))
        elif kind=='food':
            pygame.draw.ellipse(self.screen,(190,139,75),(x+6,y+11+bob,22,14))
            for n in range(3): pygame.draw.line(self.screen,(241,203,130),(x+10+n*5,y+14+bob),(x+12+n*5,y+18+bob),2)
        elif kind=='gold':
            for dx,dy in [(8,20),(16,14),(23,21)]:
                pygame.draw.circle(self.screen,(147,106,48),(x+dx,y+dy+bob),5)
                pygame.draw.circle(self.screen,GOLD,(x+dx,y+dy-2+bob),4)
        else:
            for dx in (10,16,22):
                pygame.draw.line(self.screen,GOLD,(x+dx,y+24),(x+dx+4,y+9),2)
                pygame.draw.polygon(self.screen,TEXT,[(x+dx+4,y+6),(x+dx,y+12),(x+dx+7,y+13)])

    def world(self):
        r=self.run; ox,oy=24,110; cols,rows=29,18
        self.camx=max(0,min(WIDTH-cols,r.x-cols//2)); self.camy=max(0,min(HEIGHT-rows,r.y-rows//2))
        self.screen.set_clip((ox,oy,cols*32,rows*32))
        self.screen.fill((8,12,19),(ox,oy,cols*32,rows*32))
        for sy in range(rows):
            for sx in range(cols):
                x,y=self.camx+sx,self.camy+sy; px,py=ox+sx*32,oy+sy*32
                if (x,y) not in r.seen: continue
                if r.walkable(x,y):
                    tile=self.art.tile('tiles.png',((x+y)%2*16,21*16,16,16),(32,32))
                    if tile: self.screen.blit(tile,(px,py))
                    else:
                        pygame.draw.rect(self.screen,(46+(x*7+y*3)%9,53+(x+y)%6,65+(x+y)%6),(px,py,32,32))
                        pygame.draw.rect(self.screen,(38,44,56),(px,py,32,32),1)
                    tint=pygame.Surface((32,32),pygame.SRCALPHA); tint.fill((9,22,34,65)); self.screen.blit(tint,(px,py))
                    if (x*17+y*13)%41==0:
                        pygame.draw.line(self.screen,(42,74,68),(px+3,py+24),(px+10,py+18),2)
                    if (x,y) in r.traps and (x,y) in r.visible and abs(x-r.x)+abs(y-r.y)<3:
                        for n in range(3): pygame.draw.polygon(self.screen,(150,135,125),[(px+6+n*8,py+24),(px+9+n*8,py+15),(px+12+n*8,py+24)])
                    if (x,y)==r.stairs:
                        pygame.draw.rect(self.screen,(27,66,72),(px+1,py+1,30,30),border_radius=3)
                        for n in range(4): pygame.draw.line(self.screen,TEAL,(px+6,py+8+n*5),(px+13+n*4,py+8+n*5),2)
                    if (x,y) in r.loot and (x,y) in r.visible: self.loot_sprite(r.loot[x,y],px,py)
                else:
                    tile=self.art.tile('tiles.png',(4*16,13*16,16,16),(32,32))
                    if tile: self.screen.blit(tile,(px,py))
                    else:
                        pygame.draw.rect(self.screen,(67,69,83),(px,py,32,32))
                        pygame.draw.line(self.screen,(89,90,99),(px,py+2),(px+31,py+2),2)
                        pygame.draw.line(self.screen,(31,34,46),(px,py+29),(px+31,py+29),4)
                    if r.walkable(x,y+1):
                        pygame.draw.rect(self.screen,(16,20,29),(px,py+27,32,5))
                        if (x*7+y)%7==0:
                            pygame.draw.rect(self.screen,(77,55,40),(px+14,py+14,4,12))
                            radius=5+int(math.sin(self.time*13+x)*2)
                            pygame.draw.circle(self.screen,(210,124,53),(px+16,py+12),radius)
                            pygame.draw.circle(self.screen,(255,217,119),(px+16,py+11),3)
                darkness=180 if (x,y) not in r.visible else int(55*min(1,math.hypot(x-r.x,y-r.y)/8))
                shade=pygame.Surface((32,32),pygame.SRCALPHA); shade.fill((4,8,17,darkness)); self.screen.blit(shade,(px,py))
        for e in sorted(r.enemies,key=lambda e:e.y):
            if (e.x,e.y) in r.visible: self.enemy_sprite(e,ox+(e.x-self.camx)*32,oy+(e.y-self.camy)*32)
        px,py=ox+(r.x-self.camx)*32,oy+(r.y-self.camy)*32
        pygame.draw.ellipse(self.screen,(56,108,112),(px+1,py+22,30,9),2)
        self.hero(px,py)
        if self.flash>0:
            overlay=pygame.Surface((928,576),pygame.SRCALPHA); overlay.fill((180,35,40,int(self.flash*90))); self.screen.blit(overlay,(ox,oy))
        self.screen.set_clip(None)
        pygame.draw.rect(self.screen,EDGE,(23,109,930,578),1,border_radius=4)
        self.text('EXPLORE  /  '+FLOOR_NAMES[r.floor-1].upper(),40,124,18,MUTED)

    def bar(self,label,value,total,y,color):
        self.text(label,994,y,19,MUTED); self.text(f'{value} / {total}',1135,y,20,TEXT)
        pygame.draw.rect(self.screen,(35,43,53),(994,y+25,240,8),border_radius=4)
        pygame.draw.rect(self.screen,color,(994,y+25,max(0,int(240*value/total)),8),border_radius=4)

    def minimap(self):
        r=self.run
        self.text('THE KNOWN DEPTHS',994,352,19,MUTED)
        for x,y in r.seen:
            if r.walkable(x,y):
                pygame.draw.rect(self.screen,(92,115,119) if (x,y) in r.visible else (43,57,67),(994+x*4,381+y*4,3,3))
        sx,sy=r.stairs
        if (sx,sy) in r.seen: pygame.draw.rect(self.screen,TEAL,(994+sx*4,381+sy*4,4,4))
        pygame.draw.rect(self.screen,GOLD,(994+r.x*4,381+r.y*4,5,5))

    def hud(self):
        r=self.run
        self.text('DUNGEON',24,24,41,GOLD)
        self.text('T H E   H O L L O W   C R O W N',26,66,17,MUTED)
        self.text(f'DEPTH  {r.floor:02d} / 05',650,32,26,TEXT)
        self.text(f'SEED {r.seed:06d}',651,63,17,MUTED)
        self.button('Pause  [Esc]',(1090,27,166,48),'pause')
        self.panel((974,110,282,577))
        self.text('THE WANDERER',994,130,28,GOLD)
        self.text(f'Level {r.level}   /   {r.xp} of {r.level*35} XP',994,163,21,MUTED)
        self.bar('VITALITY',r.hp,r.max_hp,202,RED)
        self.bar('NOURISHMENT',r.hunger,100,252,TEAL)
        self.text(f'{r.gold} gold    {r.kills} vanquished',994,307,23,GOLD)
        self.minimap()
        self.icon('sword.png',993,531)
        self.text(f'Blade +{r.weapon}   /   Damage {r.attack}',1026,535,21,TEXT)
        self.icon('shield.png',993,561)
        self.text(f'Armor +{r.armor}   /   Arrows {r.arrows}',1026,564,21,TEXT)
        self.text('Goal: find the glowing stairs.',994,613,20,TEAL)
        self.text('[E] Descend / claim the crown',994,641,19,MUTED)
        self.panel((24,703,650,74))
        for i,message in enumerate(r.messages[-3:]): self.text(message,38,712+i*20,19,TEXT if i==2 else MUTED)
        self.button(f'Q  Heal ({r.potions})',(690,703,173,34),'potion')
        self.button(f'F  Eat ({r.food})',(878,703,173,34),'food')
        self.button('B  Shoot',(1067,703,189,34),'bow')
        self.text('WASD / arrows: move + attack     Space: wait     I: field guide',696,752,19,MUTED)

    def overlay(self,title,subtitle):
        veil=pygame.Surface(SIZE,pygame.SRCALPHA); veil.fill((5,9,16,215)); self.screen.blit(veil,(0,0))
        self.panel((320,134,640,536),(18,25,35),(91,83,65))
        self.text('D  U  N  G  E  O  N',366,172,46,GOLD)
        self.text(title,368,230,34,TEXT)
        self.text(subtitle,368,276,22,MUTED)

    def draw(self):
        self.buttons=[]; self.screen.fill(INK); self.world(); self.hud()
        r=self.run
        if self.mode=='title':
            self.overlay('The Hollow Crown','Five floors below. One way back.')
            self.text('Explore forgotten halls. Gather steel and supplies.',368,323,23,TEXT)
            self.text('Defeat the guardian and reclaim the lost crown.',368,353,23,TEXT)
            self.button('Begin descent  [Enter]',(368,410,544,54),'new',True)
            if self.saved and not self.saved.get('dead') and not self.saved.get('won'):
                self.button('Continue saved expedition',(368,480,544,48),'continue')
            self.button('How to play  [I]',(368,545,262,48),'help')
            self.button('Quit',(650,545,262,48),'quit')
            self.text('A turn-based adventure. Every step is a decision.',368,620,20,MUTED)
        elif self.mode=='pause':
            self.overlay('Expedition paused','Take a breath. The depths can wait.')
            for label,y,action in [('Resume  [Esc]',340,'resume'),('Save expedition',402,'save'),('Field guide',464,'help'),('Return to title',526,'title')]:
                self.button(label,(368,y,544,48),action,action=='resume')
            self.button('Sound: '+('on' if self.sound else 'off'),(368,591,260,42),'sound')
            self.button('Quit',(650,591,262,42),'quit')
        elif self.mode=='help':
            self.overlay('Field guide','Monsters act only when you take a turn.')
            for i,line in enumerate(['WASD / Arrow keys    Move; bump enemies to attack',
                                      'B    Shoot the nearest visible enemy with your bow',
                                      'Q    Drink a potion (+40 HP)     F    Eat (+12 HP)',
                                      'Space    Wait one turn     E    Use the stairs',
                                      'Walk over loot to collect it; chests upgrade gear.',
                                      'Food restores hunger. Stairs restore 15 health.',
                                      'Escape pauses. Your expedition saves every turn.',
                                      'Floor 5: slay the guardian, then claim the crown.']):
                self.text(line,366,325+i*31,22,TEXT)
            self.button('Back  [Esc]',(368,596,544,44),'back',True)
        elif self.mode in ('dead','won'):
            won=self.mode=='won'
            self.overlay('The crown returns.' if won else 'Lost to the depths.',
                         'You conquered the Hollow Throne.' if won else 'Every fallen wanderer leaves a story.')
            self.text(f'Depth {r.floor}   /   Level {r.level}   /   {r.kills} enemies defeated',368,344,26,TEXT)
            self.text(f'{r.gold} gold recovered   /   {r.turns} turns survived',368,387,26,GOLD)
            self.button('Another expedition  [Enter]',(368,462,544,54),'new',True)
            self.button('Return to title',(368,535,544,48),'title')
        # Letterbox to preserve the layout when the window changes shape.
        w,h=self.window.get_size(); scale=min(w/1280,h/800)
        image=pygame.transform.smoothscale(self.screen,(max(1,int(1280*scale)),max(1,int(800*scale))))
        self.window.fill(INK); self.window.blit(image,((w-image.get_width())//2,(h-image.get_height())//2))
        pygame.display.flip()

    def action(self,action):
        if action=='quit': self.running=False; return
        if action=='sound': self.sound=not self.sound; return
        if action=='back': self.mode=self.before_help; return
        if action=='help': self.before_help=self.mode; self.mode='help'; return
        if action=='new': self.run=Run(); self.mode='play'; save_write(self.run); return
        if action=='continue':
            try: self.run=Run.restore(self.saved); self.mode='play'
            except (KeyError,ValueError,TypeError,IndexError): self.saved=None; self.run.say('Save unavailable. Begin a new expedition.')
            return
        if action=='title': self.saved=save_read(); self.mode='title'; return
        if action=='pause':
            if self.mode=='play': self.mode='pause'
            return
        if action=='resume': self.mode='play'; return
        if action=='save':
            self.run.say('Expedition saved.' if save_write(self.run) else 'Save unavailable on this device.')
            self.mode='play'; return
        if self.mode!='play': return
        oldhp=self.run.hp; oldgold=self.run.gold; oldfloor=self.run.floor
        if isinstance(action,tuple):
            dx,dy=action; self.facing={(0,1):0,(0,-1):1,(1,0):2,(-1,0):3}[action]
            moved=self.run.act('move',dx,dy)
        else: moved=self.run.act(action)
        if moved:
            self.beep('stairs' if self.run.floor!=oldfloor else 'hit' if self.run.hp<oldhp else 'loot' if self.run.gold>oldgold else 'heal' if self.run.hp>oldhp else 'step')
            if self.run.hp<oldhp: self.flash=1
            save_write(self.run)
        if self.run.dead: self.mode='dead'
        if self.run.won: self.mode='won'

    async def loop(self):
        while self.running:
            dt=self.clock.tick(60)/1000; self.time+=dt; self.flash=max(0,self.flash-dt*3)
            for event in pygame.event.get():
                if event.type==pygame.QUIT: self.running=False
                elif event.type==pygame.MOUSEBUTTONDOWN and event.button==1:
                    for rect,action in reversed(self.buttons):
                        if rect.collidepoint(self.mouse()): self.action(action); break
                elif event.type==pygame.KEYDOWN:
                    key=event.key
                    if key==pygame.K_ESCAPE:
                        if self.mode=='help': self.action('back')
                        elif self.mode=='play': self.action('pause')
                        elif self.mode=='pause': self.action('resume')
                    elif key==pygame.K_i and self.mode in ('play','title','pause'): self.action('help')
                    elif key==pygame.K_RETURN and self.mode in ('title','dead','won'): self.action('new')
                    elif self.mode=='play':
                        action=MOVES.get(key) or {pygame.K_q:'potion',pygame.K_f:'food',pygame.K_b:'bow',pygame.K_e:'descend',pygame.K_SPACE:'wait'}.get(key)
                        if action: self.action(action); self.last_move=self.time
            if self.mode=='play' and self.time-self.last_move>.18:
                keys=pygame.key.get_pressed()
                for key,direction in MOVES.items():
                    if keys[key]: self.action(direction); self.last_move=self.time; break
            self.draw()
            await asyncio.sleep(0)
        pygame.quit()

async def main():
    game=Game()
    if '--smoke-test' in sys.argv:
        game.draw()
        game.action('new')
        game.action('wait')
        game.draw()
        game.running=False
    await game.loop()

if __name__=='__main__':
    asyncio.run(main())
