import math, random, os
random.seed(7)
CPU='#22E5FF'; GPU='#B65CFF'; WARM='#FFB020'; HOT='#FF3B4E'
OUT='/workspace/hw_widget/html'

def wallpaper(w,h):
    return f'''<div style="position:absolute;left:0;top:0;width:{w}px;height:{h}px;background:#070A12;overflow:hidden">
<div style="position:absolute;left:{int(w*-0.1)}px;top:{int(h*-0.2)}px;width:{int(w*0.7)}px;height:{int(h*0.9)}px;border-radius:999px;background:#123A5E;opacity:0.85;filter:blur(70px)"></div>
<div style="position:absolute;left:{int(w*0.5)}px;top:{int(h*0.35)}px;width:{int(w*0.65)}px;height:{int(h*0.8)}px;border-radius:999px;background:#3A1257;opacity:0.85;filter:blur(80px)"></div>
<div style="position:absolute;left:{int(w*0.35)}px;top:{int(h*-0.1)}px;width:{int(w*0.35)}px;height:{int(h*0.45)}px;border-radius:999px;background:#0C4D57;opacity:0.7;filter:blur(60px)"></div>
<div style="position:absolute;left:0;top:0;width:{w}px;height:{h}px;background-image:linear-gradient(180deg, rgba(5,7,12,0) 0%, rgba(5,7,12,0.55) 100%)"></div>
</div>'''

def taskbar(w,h):
    icons=''.join(f'<div style="width:24px;height:24px;border-radius:6px;background:{c}"></div>' for c in ['rgba(255,255,255,0.16)','rgba(255,255,255,0.10)','rgba(255,255,255,0.10)','rgba(255,255,255,0.10)'])
    start='<div style="width:24px;height:24px;display:grid;grid-template-columns:11px 11px;gap:2px">'+''.join('<div style="width:11px;height:11px;border-radius:2px;background:#5FC8FF"></div>' for _ in range(4))+'</div>'
    start='<div style="display:flex;flex-wrap:wrap;width:24px;height:24px;gap:2px">'+''.join('<div style="width:11px;height:11px;border-radius:2px;background:#5FC8FF"></div>' for _ in range(4))+'</div>'
    return f'''<div style="position:absolute;left:0;top:{h-44}px;width:{w}px;height:44px;background:rgba(18,21,29,0.86);border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;gap:12px">
{start}{icons}
<div style="position:absolute;right:14px;top:8px;display:flex;flex-direction:column;align-items:flex-end;gap:1px">
<div style="font-family:Inter;font-size:11px;line-height:14px;color:#EAF2F8">14:32</div>
<div style="font-family:Inter;font-size:11px;line-height:14px;color:#93A3B5">19/11/2026</div></div></div>'''

def note(text='Sample values for an i7-3770K + GTX 980 Ti · design-ahead mockup, not live sensor data'):
    return f'<div style="position:absolute;left:14px;top:12px;font-family:Inter;font-size:10px;line-height:12px;letter-spacing:0.04em;color:rgba(234,242,248,0.55)">{text}</div>'

def polar(cx,cy,r,a):
    a=math.radians(a); return cx+r*math.cos(a), cy+r*math.sin(a)
def arc(cx,cy,r,a0,a1):
    x0,y0=polar(cx,cy,r,a0); x1,y1=polar(cx,cy,r,a1)
    large=1 if (a1-a0)>180 else 0
    return f'M {x0:.2f} {y0:.2f} A {r} {r} 0 {large} 1 {x1:.2f} {y1:.2f}'

def gauge(size,sw,pct,color,big,small,bigsize=20):
    c=size/2; r=c-sw/2-3
    a0=135; a1=135+270*pct/100
    ticks=''
    for t in (0,50,100):
        a=135+270*t/100; x0,y0=polar(c,c,r+sw/2+1,a); x1,y1=polar(c,c,r+sw/2+3.5,a)
        ticks+=f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#56637A" stroke-width="1"/>'
    svg=f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" style="position:absolute;left:0;top:0">
<path d="{arc(c,c,r,135,405)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="{sw}" stroke-linecap="round"/>
<path d="{arc(c,c,r,a0,a1)}" fill="none" stroke="{color}" stroke-opacity="0.25" stroke-width="{sw+5}" stroke-linecap="round"/>
<path d="{arc(c,c,r,a0,a1)}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>{ticks}</svg>'''
    return f'''<div style="position:relative;width:{size}px;height:{size}px;flex-shrink:0">{svg}
<div style="position:absolute;left:0;top:0;width:{size}px;height:{size}px;display:flex;flex-direction:column;align-items:center;justify-content:center">
<div style="font-family:'JetBrains Mono';font-weight:700;font-size:{bigsize}px;line-height:{bigsize+2}px;letter-spacing:-0.02em;color:#EAF2F8">{big}<span style="font-size:{int(bigsize*0.55)}px;color:#93A3B5">%</span></div>
<div style="font-family:Rajdhani;font-weight:600;font-size:10px;line-height:12px;letter-spacing:0.16em;color:#93A3B5">{small}</div></div></div>'''

def tempbar(w,t,color,warm=85,hot=90,maxt=100):
    fill=w*t/maxt
    col=color if t<warm else (WARM if t<hot else HOT)
    tick=lambda v,c: f'<div style="position:absolute;left:{w*v/maxt:.0f}px;top:-3px;width:1px;height:10px;background:{c}"></div>'
    return f'''<div style="position:relative;width:{w}px;height:4px;border-radius:999px;background:rgba(255,255,255,0.08);flex-shrink:0">
<div style="position:absolute;left:0;top:0;width:{fill:.0f}px;height:4px;border-radius:999px;background:{col};box-shadow:0 0 8px {col}"></div>
{tick(warm,WARM)}{tick(hot,HOT)}</div>'''

def series(n,base,amp,seed):
    random.seed(seed); v=base; out=[]
    for i in range(n):
        v+= random.uniform(-amp,amp); v=max(5,min(95,v)); out.append(v)
    return out

def spark(w,h,vals,color,label):
    pts=[(i*(w/(len(vals)-1)), h-(v/100)*h) for i,v in enumerate(vals)]
    line=' '.join(f'{x:.1f},{y:.1f}' for x,y in pts)
    area=f'0,{h} '+line+f' {w},{h}'
    lx,ly=pts[-1]
    return f'''<div style="position:relative;width:{w}px;height:{h+14}px;flex-shrink:0">
<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="position:absolute;left:0;top:0">
<line x1="0" y1="{h/2}" x2="{w}" y2="{h/2}" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="2 3"/>
<polygon points="{area}" fill="{color}" fill-opacity="0.12"/>
<polyline points="{line}" fill="none" stroke="{color}" stroke-width="1.5" stroke-linejoin="round"/>
<circle cx="{lx:.1f}" cy="{ly:.1f}" r="2.5" fill="{color}"/></svg>
<div style="position:absolute;left:0;top:{h+2}px;width:{w}px;display:flex;justify-content:space-between;font-family:'JetBrains Mono';font-size:9px;line-height:11px;color:#56637A"><span>-60s</span><span>{label}</span><span>now</span></div></div>'''

ICON={
 'grip':'<svg width="10" height="14" viewBox="0 0 10 14">'+''.join(f'<circle cx="{x}" cy="{y}" r="1.2" fill="#56637A"/>' for x in (2,8) for y in (2,7,12))+'</svg>',
 'pin':'<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" fill="none" stroke="#22E5FF" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
 'gear':'<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="#93A3B5" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="#93A3B5" stroke-width="2" stroke-linecap="round"/></svg>',
 'close':'<svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#93A3B5" stroke-width="2.2" stroke-linecap="round"/></svg>',
 'collapse':'<svg width="14" height="14" viewBox="0 0 24 24"><path d="M4 14h6v6M20 10h-6V4" fill="none" stroke="#93A3B5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 'expand':'<svg width="14" height="14" viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6" fill="none" stroke="#93A3B5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
}
def btn(i,active=False):
    bg='rgba(34,229,255,0.12)' if active else 'transparent'
    return f'<div style="width:24px;height:24px;border-radius:4px;background:{bg};display:flex;align-items:center;justify-content:center">{ICON[i]}</div>'

MICA_BG='background-color:#1D1F25;background-image:linear-gradient(135deg, rgba(38,92,140,0.24) 0%, rgba(29,31,37,0) 55%, rgba(92,40,130,0.22) 100%)'
DWM_SHADOW='0 8px 24px rgba(0,0,0,0.45)'
def panel(x,y,w,h,inner,glow=CPU,hot=False,pad=14,radius=8,unfocused=False):
    border = '1px solid rgba(255,255,255,0.16)' if unfocused else '1px solid rgba(255,255,255,0.10)'
    fill = 'background-color:#1D1F25' if unfocused else MICA_BG
    sh = ('inset 0 0 0 1px rgba(255,59,78,0.55), ' if hot else '') + DWM_SHADOW
    hotline = f'<div style="position:absolute;left:0;top:0;width:{w}px;height:2px;background:#FF3B4E"></div>' if hot else ''
    return f'''<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;box-sizing:border-box;padding:{pad}px;border-radius:{radius}px;{fill};border:{border};box-shadow:{sh};display:flex;flex-direction:column;overflow:hidden">
<div style="position:absolute;left:0;top:0;width:{w}px;height:{h}px;background-image:repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px)"></div>
{hotline}{inner}</div>'''

def header(title='PC-TEMP', right=('gear','expand','pin','close'), extra=''):
    btns=''.join(btn(i, i=='pin') for i in right)
    return f'''<div style="position:relative;display:flex;align-items:center;justify-content:space-between;height:24px;flex-shrink:0">
<div style="display:flex;align-items:center;gap:8px">{ICON['grip']}<div style="font-family:Rajdhani;font-weight:700;font-size:12px;line-height:14px;letter-spacing:0.22em;color:#EAF2F8">{title}</div>{extra}</div>
<div style="display:flex;align-items:center;gap:2px">{btns}</div></div>'''

def compact_col(name,color,load,temp,model,hot=False,w=140):
    tcol = HOT if temp>=90 else (WARM if temp>=85 else '#EAF2F8')
    return f'''<div style="display:flex;flex-direction:column;gap:12px;width:{w}px">
<div style="display:flex;align-items:center;gap:10px">{gauge(62,5,load, HOT if hot else color, load,'LOAD',18)}
<div style="display:flex;flex-direction:column;gap:2px">
<div style="font-family:Rajdhani;font-weight:700;font-size:13px;line-height:14px;letter-spacing:0.18em;color:{color}">{name}</div>
<div style="font-family:'JetBrains Mono';font-weight:700;font-size:28px;line-height:30px;letter-spacing:-0.03em;color:{tcol}">{temp}<span style="font-size:14px;color:#93A3B5">°C</span></div>
<div style="font-family:Inter;font-size:10px;line-height:12px;color:#56637A">{model}</div></div></div>
{tempbar(w,temp,color)}</div>'''

def compact(x,y,cpu=(34,52),gpu=(58,64),hot=False,gear=False,gclk='1.15 GHz',unfocused=False):
    warn=''
    if hot:
        warn='<div style="position:relative;display:flex;align-items:center;gap:6px;height:18px;padding:0 8px;border-radius:999px;background:rgba(255,59,78,0.16);border:1px solid rgba(255,59,78,0.5);font-family:Rajdhani;font-weight:700;font-size:10px;line-height:12px;letter-spacing:0.14em;color:#FF6B7A"><div style="width:6px;height:6px;border-radius:999px;background:#FF3B4E;box-shadow:0 0 6px #FF3B4E"></div>GPU HOT</div>'
    body=f'''{header(extra=warn)}
<div style="position:relative;display:flex;justify-content:space-between;margin-top:14px">{compact_col('CPU',CPU,cpu[0],cpu[1],'i7-3770K')}{compact_col('GPU',GPU,gpu[0],gpu[1],'GTX 980 Ti',hot)}</div>
<div style="position:relative;display:flex;justify-content:space-between;align-items:center;margin-top:auto;font-family:'JetBrains Mono';font-size:9px;line-height:11px;color:#56637A"><span>{'TEMP LIMIT · '+gclk+' · FAN 78%' if hot else 'UPDATE 1s · 3.90 / '+gclk}</span><span>14:32:07</span></div>'''
    return panel(x,y,320,200,body,hot=hot,unfocused=unfocused)

def artboard(name,w,h,content,caption=None):
    return f'<div style="position:relative;width:{w}px;height:{h}px;overflow:hidden">{wallpaper(w,h)}{content}{taskbar(w,h)}{note() if caption is None else note(caption)}</div>'

def write(fn,html):
    open(os.path.join(OUT,fn),'w').write(html)

# 1 compact
write('01_compact.html', artboard('c',640,400, compact(160,82)))
# 4 hot
hotglow='<div style="position:absolute;left:180px;top:110px;width:300px;height:160px;border-radius:999px;background:#FF3B4E;opacity:0.18;filter:blur(60px)"></div>'
write('04_hot.html', artboard('h',640,400, compact(160,82,cpu=(61,68),gpu=(98,92),hot=True,gclk='1.02 GHz')))

# 2 expanded
def stat(label,val,unit,color='#EAF2F8'):
    return f'''<div style="display:flex;flex-direction:column;gap:2px;width:80px">
<div style="font-family:Rajdhani;font-weight:600;font-size:10px;line-height:12px;letter-spacing:0.16em;color:#93A3B5">{label}</div>
<div style="font-family:'JetBrains Mono';font-weight:700;font-size:20px;line-height:22px;letter-spacing:-0.02em;color:{color}">{val}<span style="font-size:11px;color:#93A3B5">{unit}</span></div></div>'''
def sect_title(name,color,model,right):
    return f'''<div style="display:flex;align-items:baseline;justify-content:space-between">
<div style="display:flex;align-items:baseline;gap:10px"><div style="font-family:Rajdhani;font-weight:700;font-size:15px;line-height:16px;letter-spacing:0.2em;color:{color}">{name}</div><div style="font-family:Inter;font-size:11px;line-height:14px;color:#93A3B5">{model}</div></div>
<div style="font-family:'JetBrains Mono';font-size:11px;line-height:14px;color:#EAF2F8">{right}</div></div>'''
cores=[(52,31),(55,42),(50,28),(54,36)]
def corecell(i,t,l):
    return f'''<div style="display:flex;flex-direction:column;gap:5px;width:84px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-family:Rajdhani;font-weight:600;font-size:10px;line-height:12px;letter-spacing:0.16em;color:#93A3B5">CORE {i}</span><span style="font-family:'JetBrains Mono';font-weight:700;font-size:13px;line-height:14px;color:#EAF2F8">{t}°</span></div><div style="display:flex;align-items:center;gap:6px"><div style="position:relative;width:56px;height:3px;border-radius:999px;background:rgba(255,255,255,0.08)"><div style="position:absolute;left:0;top:0;width:{56*l/100:.0f}px;height:3px;border-radius:999px;background:{CPU};box-shadow:0 0 6px {CPU}"></div></div><span style="font-family:'JetBrains Mono';font-size:9px;line-height:10px;color:#93A3B5">{l}%</span></div></div>'''
corebars=''.join(corecell(i,t,l) for i,(t,l) in enumerate(cores))
W=384
cpu_sec=f'''<div style="position:relative;display:flex;flex-direction:column;gap:12px">{sect_title('CPU',CPU,'Intel Core i7-3770K · 4C/8T','3.90 GHz')}
<div style="display:flex;align-items:center;gap:16px">{gauge(84,6,34,CPU,34,'LOAD',22)}
<div style="display:flex;flex-direction:column;gap:10px;flex:1"><div style="display:flex;gap:12px">{stat('PACKAGE','52','°C')}{stat('POWER','41','W')}{stat('BASE','3.5','GHz')}</div>{tempbar(W-100,52,CPU)}</div></div>
<div style="display:flex;justify-content:space-between">{corebars}</div>
{spark(W,30,series(60,34,7,3),CPU,'LOAD %')}</div>'''
vram=f'''<div style="display:flex;flex-direction:column;gap:5px;width:{W-100}px"><div style="display:flex;justify-content:space-between;font-family:Rajdhani;font-weight:600;font-size:10px;line-height:12px;letter-spacing:0.16em;color:#93A3B5"><span>VRAM</span><span style="font-family:'JetBrains Mono';letter-spacing:0;color:#EAF2F8">3.4 / 6.0 GB</span></div><div style="position:relative;width:{W-100}px;height:4px;border-radius:999px;background:rgba(255,255,255,0.08)"><div style="position:absolute;left:0;top:0;width:{(W-100)*3.4/6:.0f}px;height:4px;border-radius:999px;background:{GPU};box-shadow:0 0 8px {GPU}"></div></div></div>'''
gpu_sec=f'''<div style="position:relative;display:flex;flex-direction:column;gap:12px">{sect_title('GPU',GPU,'NVIDIA GeForce GTX 980 Ti','1.15 GHz')}
<div style="display:flex;align-items:center;gap:16px">{gauge(84,6,58,GPU,58,'LOAD',22)}
<div style="display:flex;flex-direction:column;gap:10px;flex:1"><div style="display:flex;gap:12px">{stat('CORE','64','°C')}{stat('FAN','48','%')}</div>{vram}</div></div>
{spark(W,30,series(60,58,8,11),GPU,'LOAD %')}</div>'''
exp_body=f'''{header(right=('gear','collapse','pin','close'))}
<div style="position:relative;display:flex;flex-direction:column;gap:16px;margin-top:14px">{cpu_sec}<div style="height:1px;background:rgba(255,255,255,0.09)"></div>{gpu_sec}</div>
<div style="position:relative;display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)">
<div style="display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono';font-size:10px;line-height:12px;color:#93A3B5"><div style="width:6px;height:6px;border-radius:999px;background:#3DFFA8;box-shadow:0 0 6px #3DFFA8"></div>LIVE · updates every 1s</div>
<div style="font-family:'JetBrains Mono';font-size:10px;line-height:12px;color:#56637A">°C · 60s window</div></div>'''
write('02_expanded.html', artboard('e',720,640, panel(150,40,420,540,exp_body,pad=18)))

# 3 pill
def pillpart(name,color,t,load):
    return f'''<div style="display:flex;align-items:center;gap:7px"><div style="font-family:Rajdhani;font-weight:700;font-size:11px;line-height:12px;letter-spacing:0.16em;color:{color}">{name}</div>
<div style="display:flex;flex-direction:column;gap:3px"><div style="font-family:'JetBrains Mono';font-weight:700;font-size:15px;line-height:16px;color:#EAF2F8">{t}°</div>
<div style="position:relative;width:30px;height:3px;border-radius:999px;background:rgba(255,255,255,0.1)"><div style="position:absolute;left:0;top:0;width:{30*load/100:.0f}px;height:3px;border-radius:999px;background:{color};box-shadow:0 0 6px {color}"></div></div></div></div>'''
pill=f'''<div style="position:absolute;left:420px;top:70px;width:220px;height:44px;box-sizing:border-box;padding:0 14px 0 12px;border-radius:8px;{MICA_BG};border:1px solid rgba(255,255,255,0.10);box-shadow:{DWM_SHADOW};display:flex;align-items:center;gap:12px">
{ICON['grip']}{pillpart('CPU',CPU,52,34)}<div style="width:1px;height:20px;background:rgba(255,255,255,0.12)"></div>{pillpart('GPU',GPU,64,58)}</div>
<div style="position:absolute;left:420px;top:124px;width:200px;font-family:Inter;font-size:11px;line-height:15px;color:rgba(234,242,248,0.6)">Docked to the right edge. Drag out to undock.</div>
'''
write('03_pill.html', artboard('p',640,240, pill))

# 5 settings
def toggle(on):
    bg = 'rgba(34,229,255,0.9)' if on else 'rgba(255,255,255,0.12)'
    knob = 'left:18px;background:#05070C' if on else 'left:2px;background:#93A3B5'
    return f'<div style="position:relative;width:34px;height:18px;border-radius:999px;background:{bg};{"box-shadow:0 0 10px rgba(34,229,255,0.45);" if on else ""}flex-shrink:0"><div style="position:absolute;top:2px;{knob};width:14px;height:14px;border-radius:999px"></div></div>'
def seg(opts,sel):
    return '<div style="display:flex;padding:2px;border-radius:4px;background:rgba(255,255,255,0.06)">'+''.join(f'<div style="padding:3px 9px;border-radius:3px;font-family:\'JetBrains Mono\';font-size:11px;line-height:14px;{"background:rgba(34,229,255,0.16);color:#22E5FF" if o==sel else "color:#93A3B5"}">{o}</div>' for o in opts)+'</div>'
def row(label,ctrl,sub=''):
    s=f'<div style="font-family:Inter;font-size:11px;line-height:14px;color:#56637A">{sub}</div>' if sub else ''
    return f'<div style="display:flex;align-items:center;justify-content:space-between;min-height:40px;border-bottom:1px solid rgba(255,255,255,0.06)"><div style="display:flex;flex-direction:column;gap:2px"><div style="font-family:Inter;font-weight:500;font-size:13px;line-height:16px;color:#EAF2F8">{label}</div>{s}</div>{ctrl}</div>'
slider='''<div style="display:flex;align-items:center;gap:10px"><div style="position:relative;width:110px;height:4px;border-radius:999px;background:rgba(255,255,255,0.1)"><div style="position:absolute;left:0;top:0;width:79px;height:4px;border-radius:999px;background:#22E5FF;box-shadow:0 0 8px #22E5FF"></div><div style="position:absolute;left:73px;top:-5px;width:14px;height:14px;border-radius:999px;background:#EAF2F8;box-shadow:0 0 0 3px rgba(34,229,255,0.3)"></div></div><div style="font-family:'JetBrains Mono';font-size:11px;line-height:14px;color:#EAF2F8;width:30px;text-align:right">72%</div></div>'''
sw=lambda c,s: f'<div style="width:18px;height:18px;border-radius:999px;background:{c};{"box-shadow:0 0 0 2px #05070C, 0 0 0 3.5px "+c+", 0 0 10px "+c if s else ""}"></div>'
swatches='<div style="display:flex;gap:10px;align-items:center">'+sw(CPU,True)+sw(GPU,False)+sw('#3DFFA8',False)+sw(WARM,False)+'</div>'
pop_body=f'''<div style="position:relative;display:flex;align-items:center;justify-content:space-between;height:24px"><div style="font-family:Rajdhani;font-weight:700;font-size:13px;line-height:14px;letter-spacing:0.22em;color:#EAF2F8">SETTINGS</div>{btn('close')}</div>
<div style="position:relative;display:flex;flex-direction:column;margin-top:8px">
{row('Opacity',slider)}
{row('Click-through',toggle(False),'Clicks pass through · turn off from tray')}
{row('Always on top',toggle(True))}
{row('Units',seg(['°C','°F'],'°C'))}
{row('Update interval',seg(['1s','2s','5s'],'1s'))}
{row('Start with Windows',toggle(True),'Runs at sign-in via Task Scheduler (admin)')}
<div style="display:flex;align-items:center;justify-content:space-between;min-height:44px"><div style="font-family:Inter;font-weight:500;font-size:13px;line-height:16px;color:#EAF2F8">Theme accent</div>{swatches}</div></div>'''
dim=compact(30,70).replace('position:absolute;left:30px;top:70px;','position:absolute;left:30px;top:70px;opacity:0.55;',1)
caret='<div style="position:absolute;left:356px;top:84px;width:12px;height:12px;background:rgba(12,17,26,0.9);border-left:1px solid rgba(120,225,255,0.32);border-bottom:1px solid rgba(120,225,255,0.32);transform:rotate(45deg)"></div>'
write('05_settings.html', artboard('s',720,520, dim+panel(362,40,320,358,pop_body,pad=16)))
# 6 unfocused (inactive Mica fallback) — Compact layout, solid fill, slightly stronger border
write('06_unfocused.html', artboard('u',640,400, compact(160,82, unfocused=True),
    caption='Unfocused Mica fallback · solid #1D1F25, no wallpaper tint · samples match Compact'))
print('ok')
