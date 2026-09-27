"""Contrast audit for the Snoozly palette. Every text/ground pair the theme
actually uses is listed here; the script fails if any drops below its floor."""
import sys

def lum(h):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

# name: (background, surface, text, muted, accent, button, button_label)
SCHEMES = {
    'moonlight': ('#FBF8F3', '#FFFFFF', '#1A1838', '#55527A', '#5B4FC4', '#1A1838', '#FBF8F3'),
    'linen':     ('#F3EDE3', '#FBF8F3', '#1A1838', '#524E6E', '#5B4FC4', '#1A1838', '#FBF8F3'),
    'midnight':  ('#1A1838', '#25224C', '#F7F3EC', '#C2BEDD', '#F5C35C', '#F5C35C', '#1A1838'),
    'moon':      ('#F5C35C', '#FCE3AE', '#1A1838', '#3F3A5E', '#1A1838', '#1A1838', '#F7F3EC'),
    'calm':      ('#EEEBFB', '#FFFFFF', '#1A1838', '#4D4973', '#4A3FB0', '#4A3FB0', '#FFFFFF'),
    'support':   ('#FCF1DC', '#FFFFFF', '#1A1838', '#5A4A2A', '#8A5A0B', '#1A1838', '#FCF1DC'),
    'cool':      ('#E3F1F7', '#FFFFFF', '#1A1838', '#3F5563', '#1C5E7B', '#1C5E7B', '#FFFFFF'),
    'cosy':      ('#FBE9E4', '#FFFFFF', '#1A1838', '#6A4740', '#9A3D2C', '#9A3D2C', '#FFFFFF'),
    'stretch':   ('#E6F0E8', '#FFFFFF', '#1A1838', '#3F5A49', '#2F6247', '#2F6247', '#FFFFFF'),
}
fails = 0
for name, (bg, surf, text, muted, accent, btn, label) in SCHEMES.items():
    checks = [
        ('text/bg', text, bg, 4.5), ('text/surface', text, surf, 4.5),
        ('muted/bg', muted, bg, 4.5), ('muted/surface', muted, surf, 4.5),
        ('accent/bg (small text)', accent, bg, 4.5), ('accent/surface', accent, surf, 4.5),
        ('label/button', label, btn, 4.5), ('button/bg (non-text)', btn, bg, 3.0),
    ]
    out = []
    for label_, fg, g, floor in checks:
        r = ratio(fg, g)
        ok = r >= floor
        fails += not ok
        out.append(f"{label_} {r:.2f}{'' if ok else ' FAIL<' + str(floor)}")
    print(f"{name:10s} " + ' | '.join(out))

# Need badges: deep ink on its own tint, and white-on-deep for solid chips
NEEDS = {
    'calm': ('#EEEBFB', '#4A3FB0'), 'support': ('#FCF1DC', '#8A5A0B'),
    'cool': ('#E3F1F7', '#1C5E7B'), 'cosy': ('#FBE9E4', '#9A3D2C'),
    'stretch': ('#E6F0E8', '#2F6247'),
}
for n, (tint, deep) in NEEDS.items():
    a, b, c = ratio(deep, tint), ratio('#FFFFFF', deep), ratio(deep, '#FBF8F3')
    for v, fl in ((a, 4.5), (b, 4.5), (c, 4.5)):
        fails += v < fl
    print(f"need {n:8s} deep/tint {a:.2f} | white/deep {b:.2f} | deep/cream {c:.2f}")
# sale / stars
for lbl, fg, bg, fl in [('sale on cream', '#B0304A', '#FBF8F3', 4.5), ('sale on white', '#B0304A', '#FFFFFF', 4.5),
                        ('star gold on cream (non-text)', '#BF8212', '#FBF8F3', 3.0), ('moon on midnight', '#F5C35C', '#1A1838', 4.5),
                        ('success', '#2F6247', '#FFFFFF', 4.5), ('focus ring lilac on cream', '#5B4FC4', '#FBF8F3', 3.0)]:
    r = ratio(fg, bg); fails += r < fl
    print(f"{lbl:34s} {r:.2f}{'' if r >= fl else ' FAIL'}")
print('FAILS', fails)
sys.exit(1 if fails else 0)
