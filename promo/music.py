"""CodeBud 宣传片配乐：原创 8-bit 芯片音乐，纯代码合成（方波 / 三角波 / 噪声），无外部素材。
120 BPM、4/4、27 小节 = 54 秒，段落与 film.html 的场景切点（6/10/18/28/38/46 秒）逐小节对齐。
用法：python promo/music.py  →  promo/assets/bgm.wav
"""
import os, wave
import numpy as np

SR, BPM = 44100, 120
BEAT = 60 / BPM; BAR = 4 * BEAT; BARS = 27
N = int(SR * BARS * BAR) + SR
mix = np.zeros(N)
rng = np.random.default_rng(7)
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def hz(name):  # 'C4' / 'Bb3' / 'F#5'
    n = NOTE[name[0]] + (name[1] == '#') - (name[1] == 'b'); o = int(name[-1])
    return 440 * 2 ** ((n + (o - 4) * 12 - 9) / 12)

def put(t, sig, vol):
    i = int(t * SR); mix[i:i + len(sig)] += sig[:max(0, N - i)] * vol

def tone(f, dur, kind='sq', duty=0.5, a=0.004, r=0.03, decay=0.0, slide=0.0):
    n = int(dur * SR); x = np.arange(n) / SR
    ph = np.cumsum(f * (1 + slide * x / max(dur, 1e-6)) / SR * np.ones(n))
    if kind == 'sq': w = np.where(ph % 1 < duty, 1.0, -1.0)
    elif kind == 'tri': w = 2 * np.abs(2 * (ph % 1) - 1) - 1
    else: w = rng.uniform(-1, 1, n)
    env = np.minimum(1, x / a) * np.minimum(1, (dur - x) / r)
    if decay: env = env * np.exp(-x * decay)
    return w * env

def kick(t, v=0.5):
    n = int(0.16 * SR); x = np.arange(n) / SR
    put(t, np.sin(2 * np.pi * np.cumsum(150 * np.exp(-x * 28) + 42) / SR) * np.exp(-x * 20), v)
def snare(t, v=0.22): put(t, tone(0, 0.13, 'noise', decay=30), v)
def hat(t, v=0.07): put(t, tone(0, 0.04, 'noise', decay=90), v)

CH = {  # 和弦内音（低→高）
    'C': ['C', 'E', 'G'], 'G': ['G', 'B', 'D'], 'Am': ['A', 'C', 'E'], 'F': ['F', 'A', 'C'],
    'Dm': ['D', 'F', 'A'], 'Bb': ['Bb', 'D', 'F'], 'Em': ['E', 'G', 'B'],
}
def chord(name, octave):
    out, o, last = [], octave, -1
    for n in CH[name]:
        v = NOTE[n[0]] - (len(n) > 1)
        if v < last: o += 1
        last = v; out.append(f'{n}{o}')
    return out

def bass(bar, ch, pat):  # pat: 每个八分音符 0=休 1=根音 2=高八度
    root = chord(ch, 2)[0]
    for i, k in enumerate(pat):
        if k: put(bar * BAR + i * BEAT / 2, tone(hz(root) * k, BEAT / 2 * 0.9, 'tri'), 0.5)
def arp(bar, ch, vol=0.11, step=4, octave=4, duty=0.25):  # step: 每拍几个音
    ns = chord(ch, octave) + [chord(ch, octave + 1)[0]]
    order = [0, 1, 2, 3, 2, 1, 0, 2]
    for i in range(4 * step):
        put(bar * BAR + i * BEAT / step, tone(hz(ns[order[i % 8]]), BEAT / step * 0.85, 'sq', duty, decay=6), vol)
def lead(bar, notes, vol=0.2, duty=0.5):  # notes: [(起拍, 时值拍, 音名)]
    for b, d, n in notes:
        put(bar * BAR + b * BEAT, tone(hz(n), d * BEAT * 0.94, 'sq', duty, r=0.05), vol)
        put(bar * BAR + b * BEAT + 0.18, tone(hz(n), d * BEAT * 0.94, 'sq', duty, r=0.05), vol * 0.22)  # 回声
def drums(bar, level):
    t = bar * BAR
    if level >= 1:
        for b in (0, 2): kick(t + b * BEAT)
    if level >= 2:
        for b in (1, 3): snare(t + b * BEAT)
        for i in range(8): hat(t + i * BEAT / 2, 0.07 if i % 2 else 0.04)
    if level >= 3:
        kick(t + 2.5 * BEAT, 0.4)
        for i in range(16): hat(t + i * BEAT / 4, 0.03)
def fill(bar):  # 小节末尾的过门
    for i in range(4): snare(bar * BAR + (3 + i / 4) * BEAT, 0.14 + i * 0.04)
def coin(t, v=0.16): put(t, tone(hz('B5'), 0.07), v); put(t + 0.07, tone(hz('E6'), 0.22, decay=9), v)
def rise(t, dur, v=0.1): put(t, tone(220, dur, 'sq', 0.25, slide=3.0) * np.linspace(0.2, 1, int(dur * SR)), v)

DRIVE, HALF, WALK = [1, 0, 2, 1, 1, 0, 2, 1], [1, 0, 0, 0, 1, 0, 0, 0], [1, 1, 2, 1, 1, 1, 2, 1]

# ── 小节 0–2（0–6s）开机：稀疏的琶音，逐步加厚；第 3 小节头（4s）主角成形 ──
for b, ch in zip(range(3), ['Am', 'F', 'G']):
    arp(b, ch, vol=0.07 + b * 0.02, step=2, octave=4)
    if b: bass(b, ch, HALF)
put(4.0, tone(hz('E5'), 0.5, 'sq', 0.5, slide=1.0, decay=4), 0.16)  # 成形音效
kick(4.0, 0.6); rise(5.0, 1.0); fill(2)

# ── 小节 3–4（6–10s）片名：号角式主题 ──
THEME = [(0, 0.5, 'E5'), (0.5, 0.5, 'G5'), (1, 1, 'C6'), (2, 0.5, 'B5'), (2.5, 0.5, 'G5'), (3, 1, 'A5')]
THEME2 = [(0, 0.5, 'G5'), (0.5, 0.5, 'B5'), (1, 1, 'D6'), (2, 0.5, 'C6'), (2.5, 0.5, 'B5'), (3, 1, 'G5')]
for b, ch, mel in [(3, 'C', THEME), (4, 'G', THEME2)]:
    bass(b, ch, DRIVE); arp(b, ch); lead(b, mel); drums(b, 2)
fill(4)

# ── 小节 5–8（10–18s）闯关：最有冲劲的一段；方块在 11..16 秒整拍被撞开 ──
RUN = {
    'C': [(0, 0.5, 'C5'), (0.5, 0.5, 'E5'), (1, 0.5, 'G5'), (1.5, 0.5, 'E5'), (2, 1, 'C6'), (3, 0.5, 'B5'), (3.5, 0.5, 'G5')],
    'G': [(0, 0.5, 'D5'), (0.5, 0.5, 'G5'), (1, 0.5, 'B5'), (1.5, 0.5, 'G5'), (2, 1, 'D6'), (3, 0.5, 'B5'), (3.5, 0.5, 'A5')],
    'Am': [(0, 0.5, 'E5'), (0.5, 0.5, 'A5'), (1, 0.5, 'C6'), (1.5, 0.5, 'A5'), (2, 1, 'E6'), (3, 0.5, 'D6'), (3.5, 0.5, 'C6')],
    'F': [(0, 0.5, 'F5'), (0.5, 0.5, 'A5'), (1, 0.5, 'C6'), (1.5, 0.5, 'A5'), (2, 1, 'F5'), (3, 0.5, 'G5'), (3.5, 0.5, 'B5')],
}
for b, ch in zip(range(5, 9), ['C', 'G', 'Am', 'F']):
    bass(b, ch, WALK); arp(b, ch); lead(b, RUN[ch]); drums(b, 3)
for i in range(6): coin(11.0 + i)
fill(8)

# ── 小节 9–13（18–28s）真实界面：律动收一点，旋律换成对答句；每 2.5 秒一个镜头 ──
UI = {
    'F': [(0, 1, 'A5'), (1, 0.5, 'C6'), (1.5, 1.5, 'F5'), (3, 1, 'A5')],
    'C': [(0, 1, 'G5'), (1, 0.5, 'E5'), (1.5, 1.5, 'C5'), (3, 1, 'E5')],
    'G': [(0, 1, 'B5'), (1, 0.5, 'D6'), (1.5, 1.5, 'G5'), (3, 1, 'B5')],
    'Am': [(0, 1, 'C6'), (1, 0.5, 'A5'), (1.5, 1.5, 'E5'), (3, 1, 'A5')],
}
for b, ch in zip(range(9, 14), ['F', 'C', 'G', 'Am', 'F']):
    bass(b, ch, DRIVE); arp(b, ch, vol=0.09, duty=0.125); lead(b, UI[ch], vol=0.17, duty=0.25); drums(b, 2)
for k in range(4): coin(18.0 + k * 2.5 + 1.35, 0.1)  # 每个镜头的落点
rise(27.0, 1.0); fill(13)

# ── 小节 14–18（28–38s）个人学习助手：转到 F 大调，半速、温暖，像在说话 ──
TALK = {
    'F': [(0, 2, 'A4'), (2, 1, 'C5'), (3, 1, 'F5')],
    'Bb': [(0, 2, 'D5'), (2, 1, 'F5'), (3, 1, 'D5')],
    'Dm': [(0, 2, 'F5'), (2, 1, 'A5'), (3, 1, 'F5')],
    'C': [(0, 2, 'E5'), (2, 1, 'G5'), (3, 1, 'C6')],
}
for b, ch in zip(range(14, 19), ['F', 'Bb', 'Dm', 'C', 'F']):
    bass(b, ch, HALF); arp(b, ch, vol=0.085, step=2, duty=0.5)
    lead(b, TALK[ch], vol=0.17, duty=0.5); drums(b, 1 if b < 16 else 2)
for i in range(4): coin(28 + 5.6 + 2.3 + i * 0.3, 0.09)  # 计划逐项打勾
rise(37.0, 1.0); fill(18)

# ── 小节 19–22（38–46s）间隔重复：回到 C，上行推进；6 个复习节点各一声 ──
for b, ch in zip(range(19, 23), ['Am', 'F', 'C', 'G']):
    bass(b, ch, WALK); arp(b, ch, octave=4 + (b > 20)); drums(b, 2 if b < 21 else 3)
    lead(b, [(i, 0.5, n) for i, n in zip([0, 1, 2, 3], chord(ch, 5) + [chord(ch, 6)[0]])], vol=0.15, duty=0.25)
for i in range(6): coin(38 + 0.5 + 3.1 * (90 + 1300 * i / 6) / 1440, 0.1)
fill(22)

# ── 小节 23–26（46–54s）片尾：主题再现、全编制，最后一小节收在 C 上 ──
for b, ch, mel in [(23, 'C', THEME), (24, 'G', THEME2), (25, 'F', RUN['F'])]:
    bass(b, ch, WALK); arp(b, ch); arp(b, ch, vol=0.05, octave=5); lead(b, mel, vol=0.22); drums(b, 3)
kick(26 * BAR, 0.7); snare(26 * BAR, 0.2)
for n, v in zip(chord('C', 4) + ['C6'], [0.14, 0.12, 0.12, 0.16]): put(26 * BAR, tone(hz(n), 3.2, 'sq', 0.5, decay=1.1), v)
put(26 * BAR, tone(hz('C2'), 3.2, 'tri', decay=0.9), 0.5)

mix = np.tanh(mix[:int(SR * BARS * BAR)] * 1.1)  # 软限幅
mix *= 0.6 / np.max(np.abs(mix))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'bgm.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print(out, round(len(mix) / SR, 2), 's')
