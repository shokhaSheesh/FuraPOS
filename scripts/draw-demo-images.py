"""
Draws the demo catalogue pictures in public/images — flat illustrations standing
in for real product photos. Run: python3 scripts/draw-demo-images.py
"""
import os, math
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "images")

def frame(body, tint=("#F5F8FC", "#E4EBF4"), shadow=True):
    sh = '<ellipse cx="200" cy="338" rx="120" ry="16" fill="#0F1B2D" opacity="0.10"/>' if shadow else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{tint[0]}"/><stop offset="1" stop-color="{tint[1]}"/></linearGradient>
<linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E3E8EF"/><stop offset="0.5" stop-color="#AEB8C5"/><stop offset="1" stop-color="#7D8898"/></linearGradient>
<linearGradient id="dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A5566"/><stop offset="1" stop-color="#1F2733"/></linearGradient>
<linearGradient id="blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B9BE0"/><stop offset="1" stop-color="#0A5E9C"/></linearGradient>
<linearGradient id="red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0625A"/><stop offset="1" stop-color="#B42A22"/></linearGradient>
<linearGradient id="amber" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD166"/><stop offset="1" stop-color="#E09B1A"/></linearGradient>
<linearGradient id="green" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5FD08E"/><stop offset="1" stop-color="#1E8A52"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.45" r="0.55"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
</defs>
<rect width="400" height="400" fill="url(#bg)"/>
<circle cx="200" cy="190" r="170" fill="url(#glow)"/>
{sh}
{body}
</svg>
'''

parts = {}

# Brake disc
holes = "".join(f'<circle cx="{200+95*math.cos(a):.1f}" cy="{190+95*math.sin(a):.1f}" r="7" fill="#6B7684"/>' for a in [i*math.pi/6 for i in range(12)])
bolts = "".join(f'<circle cx="{200+38*math.cos(a):.1f}" cy="{190+38*math.sin(a):.1f}" r="8" fill="#39414D"/>' for a in [i*2*math.pi/5 for i in range(5)])
parts["brake-disc"] = f'''<circle cx="200" cy="190" r="140" fill="url(#steel)" stroke="#6B7684" stroke-width="4"/>
<circle cx="200" cy="190" r="118" fill="none" stroke="#C7CFD9" stroke-width="3"/>
{holes}
<circle cx="200" cy="190" r="62" fill="url(#dark)"/>
<circle cx="200" cy="190" r="22" fill="#12171F"/>
{bolts}'''

# Brake pad set
parts["brake-pad-set"] = '''<g transform="rotate(-8 200 200)">
<path d="M70 150 Q200 70 330 150 L318 200 Q200 130 82 200 Z" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/>
<path d="M90 170 Q200 110 310 170 L302 205 Q200 150 98 205 Z" fill="url(#dark)"/>
</g>
<g transform="rotate(-8 200 260) translate(0 70)">
<path d="M70 150 Q200 70 330 150 L318 200 Q200 130 82 200 Z" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/>
<path d="M90 170 Q200 110 310 170 L302 205 Q200 150 98 205 Z" fill="url(#dark)"/>
</g>
<circle cx="120" cy="150" r="7" fill="#F0625A"/><circle cx="120" cy="220" r="7" fill="#F0625A"/>'''

# Oil filter
ribs = "".join(f'<rect x="{128+i*16}" y="122" width="6" height="176" rx="3" fill="#0A4E80" opacity="0.35"/>' for i in range(10))
parts["oil-filter"] = f'''<rect x="118" y="112" width="164" height="196" rx="26" fill="url(#blue)"/>
{ribs}
<rect x="130" y="176" width="140" height="56" rx="8" fill="#FFFFFF" opacity="0.92"/>
<text x="200" y="212" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#0A5E9C" text-anchor="middle">OIL</text>
<rect x="128" y="88" width="144" height="32" rx="10" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/>
<circle cx="200" cy="96" r="14" fill="#39414D"/>'''

# Air filter
pleats = "".join(f'<path d="M{90+i*22} 130 L{101+i*22} 250 L{112+i*22} 130" fill="none" stroke="#C98A12" stroke-width="3"/>' for i in range(10))
parts["air-filter"] = f'''<rect x="72" y="112" width="256" height="156" rx="16" fill="url(#dark)"/>
<rect x="88" y="126" width="224" height="128" rx="8" fill="url(#amber)"/>
{pleats}
<rect x="72" y="258" width="256" height="18" rx="8" fill="#39414D"/>'''

# Spark plug
threads = "".join(f'<line x1="176" y1="{244+i*12}" x2="224" y2="{250+i*12}" stroke="#8B96A5" stroke-width="4"/>' for i in range(5))
parts["spark-plug"] = f'''<g transform="rotate(-18 200 200)">
<rect x="186" y="40" width="28" height="30" rx="6" fill="url(#steel)"/>
<path d="M170 70 H230 L240 170 H160 Z" fill="#F3F5F8" stroke="#C7CFD9" stroke-width="3"/>
<rect x="166" y="96" width="68" height="10" rx="4" fill="#DDE3EA"/>
<rect x="166" y="120" width="68" height="10" rx="4" fill="#DDE3EA"/>
<path d="M150 170 H250 L260 200 L250 232 H150 L140 200 Z" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/>
<rect x="172" y="232" width="56" height="72" fill="#B7C0CC"/>
{threads}
<rect x="194" y="304" width="12" height="24" fill="#6B7684"/>
<path d="M200 328 h26 v-10" fill="none" stroke="#6B7684" stroke-width="6"/>
</g>'''

# Timing belt
teeth = []
for i in range(40):
    t = i/40*2*math.pi
    x = 200 + 130*math.cos(t); y = 190 + 85*math.sin(t)
    teeth.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="#12171F"/>')
parts["timing-belt"] = f'''<ellipse cx="200" cy="190" rx="138" ry="93" fill="none" stroke="url(#dark)" stroke-width="22"/>
{''.join(teeth)}
<circle cx="120" cy="190" r="46" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/><circle cx="120" cy="190" r="12" fill="#39414D"/>
<circle cx="285" cy="190" r="32" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/><circle cx="285" cy="190" r="9" fill="#39414D"/>
<rect x="250" y="116" width="34" height="18" rx="6" fill="#F0625A"/>'''

# Alternator
fins = "".join(f'<rect x="{126+i*18}" y="130" width="8" height="120" rx="3" fill="#6B7684" opacity="0.5"/>' for i in range(9))
parts["alternator"] = f'''<circle cx="200" cy="190" r="112" fill="url(#steel)" stroke="#6B7684" stroke-width="4"/>
{fins}
<circle cx="200" cy="190" r="56" fill="url(#dark)"/>
<circle cx="200" cy="190" r="36" fill="url(#steel)"/>
<circle cx="200" cy="190" r="10" fill="#12171F"/>
<rect x="298" y="150" width="44" height="26" rx="6" fill="#39414D"/>
<circle cx="112" cy="104" r="14" fill="#39414D"/><circle cx="288" cy="276" r="14" fill="#39414D"/>'''

# Starter motor
parts["starter-motor"] = '''<rect x="70" y="170" width="200" height="110" rx="40" fill="url(#dark)"/>
<rect x="90" y="180" width="160" height="12" rx="6" fill="#FFFFFF" opacity="0.15"/>
<rect x="110" y="104" width="150" height="66" rx="30" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/>
<circle cx="130" cy="112" r="10" fill="#F0625A"/>
<rect x="268" y="196" width="48" height="58" rx="10" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/>
<circle cx="330" cy="225" r="26" fill="#8B96A5" stroke="#39414D" stroke-width="6" stroke-dasharray="6 5"/>'''

# Wiper blade
parts["wiper-blade"] = '''<g transform="rotate(-28 200 200)">
<rect x="40" y="188" width="320" height="16" rx="8" fill="url(#dark)"/>
<rect x="46" y="204" width="308" height="10" rx="4" fill="#12171F"/>
<path d="M60 188 L140 160 L260 160 L340 188" fill="none" stroke="#39414D" stroke-width="8" stroke-linejoin="round"/>
<rect x="180" y="146" width="40" height="22" rx="6" fill="#39414D"/>
<rect x="196" y="100" width="10" height="50" rx="4" fill="#6B7684"/>
</g>'''

def jug(fill, label, sub):
    return f'''<path d="M120 120 Q120 96 150 96 H230 L250 70 H280 V110 Q300 120 300 150 V310 Q300 330 280 330 H140 Q120 330 120 310 Z" fill="{fill}"/>
<rect x="250" y="56" width="34" height="22" rx="5" fill="#12171F"/>
<path d="M150 96 v-16 h40 v16" fill="none" stroke="#FFFFFF" stroke-width="10" opacity="0.4"/>
<rect x="140" y="170" width="140" height="110" rx="10" fill="#FFFFFF" opacity="0.93"/>
<text x="210" y="220" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#1F2733" text-anchor="middle">{label}</text>
<text x="210" y="254" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#5B6778" text-anchor="middle">{sub}</text>'''

parts["engine-oil"] = jug("url(#amber)", "5W-30", "Engine oil")
parts["coolant"] = jug("url(#green)", "−40°C", "Coolant")

# Battery
parts["battery"] = '''<rect x="80" y="130" width="240" height="170" rx="16" fill="url(#dark)"/>
<rect x="80" y="130" width="240" height="40" rx="14" fill="#39414D"/>
<rect x="112" y="104" width="34" height="30" rx="4" fill="#F0625A"/><rect x="254" y="104" width="34" height="30" rx="4" fill="#8B96A5"/>
<text x="129" y="160" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#F0625A" text-anchor="middle">+</text>
<text x="271" y="160" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#DDE3EA" text-anchor="middle">−</text>
<rect x="110" y="196" width="180" height="70" rx="8" fill="url(#blue)"/>
<text x="200" y="242" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#FFFFFF" text-anchor="middle">225Ah</text>'''

# Fuel pump
parts["fuel-pump"] = '''<rect x="140" y="110" width="120" height="200" rx="28" fill="url(#steel)" stroke="#6B7684" stroke-width="4"/>
<rect x="140" y="170" width="120" height="16" fill="#8B96A5"/>
<rect x="140" y="232" width="120" height="16" fill="#8B96A5"/>
<rect x="120" y="84" width="160" height="36" rx="12" fill="url(#dark)"/>
<path d="M180 84 V50 H110 V90" fill="none" stroke="#39414D" stroke-width="14" stroke-linecap="round"/>
<path d="M230 84 V60 H300" fill="none" stroke="#1F2733" stroke-width="14" stroke-linecap="round"/>
<rect x="176" y="310" width="48" height="26" rx="6" fill="url(#dark)"/>
<circle cx="200" cy="208" r="10" fill="#F0625A"/>'''

# Clutch kit
springs = "".join(f'<rect x="{200+52*math.cos(a)-9:.1f}" y="{190+52*math.sin(a)-14:.1f}" width="18" height="28" rx="4" fill="#E09B1A" transform="rotate({math.degrees(a)+90:.0f} {200+52*math.cos(a):.1f} {190+52*math.sin(a):.1f})"/>' for a in [i*2*math.pi/6 for i in range(6)])
parts["clutch-kit"] = f'''<circle cx="200" cy="190" r="140" fill="url(#dark)"/>
<circle cx="200" cy="190" r="128" fill="none" stroke="#8B96A5" stroke-width="6" stroke-dasharray="14 10"/>
<circle cx="200" cy="190" r="96" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/>
{springs}
<circle cx="200" cy="190" r="26" fill="#39414D"/>
<circle cx="200" cy="190" r="12" fill="#12171F"/>'''

# Shock absorber
coil = "".join(f'<ellipse cx="200" cy="{120+i*22}" rx="54" ry="10" fill="none" stroke="#F0625A" stroke-width="9"/>' for i in range(8))
parts["shock-absorber"] = f'''<rect x="186" y="40" width="28" height="90" rx="6" fill="url(#steel)"/>
<circle cx="200" cy="44" r="20" fill="none" stroke="#39414D" stroke-width="10"/>
<rect x="166" y="130" width="68" height="190" rx="14" fill="url(#dark)"/>
{coil}
<circle cx="200" cy="332" r="20" fill="none" stroke="#39414D" stroke-width="10"/>'''

for name, body in parts.items():
    open(os.path.join(ROOT, "parts", f"{name}.svg"), "w").write(frame(body))

# Category groups
cats = {}
cats["engine"] = '''<rect x="90" y="140" width="220" height="150" rx="14" fill="url(#dark)"/>
<rect x="110" y="100" width="180" height="50" rx="10" fill="url(#steel)" stroke="#6B7684" stroke-width="3"/>
<circle cx="140" cy="125" r="10" fill="#39414D"/><circle cx="180" cy="125" r="10" fill="#39414D"/><circle cx="220" cy="125" r="10" fill="#39414D"/><circle cx="260" cy="125" r="10" fill="#39414D"/>
<rect x="60" y="180" width="30" height="70" rx="6" fill="#39414D"/><rect x="310" y="180" width="30" height="70" rx="6" fill="#39414D"/>
<circle cx="200" cy="215" r="40" fill="url(#steel)"/><circle cx="200" cy="215" r="14" fill="#12171F"/>
<rect x="150" y="290" width="100" height="20" rx="6" fill="#F0625A"/>'''
cats["chassis"] = '''<rect x="60" y="182" width="280" height="22" rx="10" fill="url(#dark)"/>
<circle cx="110" cy="193" r="70" fill="url(#dark)"/><circle cx="110" cy="193" r="40" fill="url(#steel)"/><circle cx="110" cy="193" r="12" fill="#12171F"/>
<circle cx="290" cy="193" r="70" fill="url(#dark)"/><circle cx="290" cy="193" r="40" fill="url(#steel)"/><circle cx="290" cy="193" r="12" fill="#12171F"/>
<rect x="175" y="165" width="50" height="56" rx="10" fill="#F0625A"/>'''
cats["electrics"] = '''<circle cx="200" cy="190" r="120" fill="url(#blue)"/>
<path d="M215 80 L140 205 H195 L180 300 L265 170 H208 Z" fill="#FFD166" stroke="#E09B1A" stroke-width="6" stroke-linejoin="round"/>'''
cats["consumables"] = parts["engine-oil"]
cats["body"] = '''<rect x="96" y="96" width="150" height="176" rx="18" fill="url(#blue)"/>
<rect x="112" y="112" width="118" height="66" rx="8" fill="#DDEEFB"/>
<rect x="246" y="170" width="96" height="102" rx="12" fill="url(#blue)"/>
<rect x="258" y="182" width="56" height="40" rx="6" fill="#DDEEFB"/>
<rect x="112" y="196" width="118" height="10" rx="4" fill="#0A4E80" opacity="0.5"/>
<rect x="112" y="214" width="118" height="10" rx="4" fill="#0A4E80" opacity="0.5"/>
<rect x="84" y="266" width="270" height="22" rx="8" fill="url(#dark)"/>
<circle cx="150" cy="298" r="32" fill="url(#dark)"/><circle cx="150" cy="298" r="13" fill="url(#steel)"/>
<circle cx="300" cy="298" r="32" fill="url(#dark)"/><circle cx="300" cy="298" r="13" fill="url(#steel)"/>
<rect x="330" y="232" width="18" height="14" rx="4" fill="#FFD166"/>'''
for name, body in cats.items():
    open(os.path.join(ROOT, "categories", f"{name}.svg"), "w").write(frame(body))
print(len(parts), len(cats))
