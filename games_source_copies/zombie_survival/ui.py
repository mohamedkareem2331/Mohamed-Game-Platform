import pygame
from settings import *

def draw_text(surf, font, text, pos, color=WHITE, center=False):
    img = font.render(str(text), True, color)
    rect = img.get_rect()
    if center: rect.center = pos
    else: rect.topleft = pos
    surf.blit(img, rect)
    return rect

def panel(surf, rect, fill=(20,27,39,235), border=(58,75,98)):
    layer = pygame.Surface((rect.width, rect.height), pygame.SRCALPHA)
    pygame.draw.rect(layer, fill, layer.get_rect(), border_radius=14)
    pygame.draw.rect(layer, (*border, 255), layer.get_rect(), 2, border_radius=14)
    surf.blit(layer, rect.topleft)

def bar(surf, x, y, w, h, value, maximum, color, bg=(42,50,64)):
    pygame.draw.rect(surf, bg, (x,y,w,h), border_radius=5)
    ratio = max(0, min(1, value / max(1, maximum)))
    pygame.draw.rect(surf, color, (x,y,w*ratio,h), border_radius=5)
