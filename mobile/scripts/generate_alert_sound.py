import math
import wave
from pathlib import Path

out = Path(r'c:\dev\zinapp\mobile\assets\sounds\alert.wav')
rate = 44100
duration = 1.8
amp = 0.92

def tone(t, freq, volume=1.0):
    s = math.sin(2 * math.pi * freq * t)
    sq = 1.0 if s >= 0 else -1.0
    return volume * (0.65 * s + 0.35 * sq)

# Urgent multi-beep alarm pattern
segments = [
    (0.00, 0.18, 980),
    (0.22, 0.40, 1320),
    (0.44, 0.62, 980),
    (0.78, 1.00, 1480),
    (1.08, 1.35, 1100),
    (1.42, 1.70, 1600),
]

frames = bytearray()
n = int(rate * duration)
for i in range(n):
    t = i / rate
    sample = 0.0
    for start, end, freq in segments:
        if start <= t < end:
            local = (t - start) / (end - start)
            env = min(1.0, local * 18) * min(1.0, (1.0 - local) * 12)
            f = freq * (1.0 + 0.04 * math.sin(2 * math.pi * 12 * t))
            sample = tone(t, f, env)
            break
    sample = max(-1.0, min(1.0, sample * amp))
    frames += int(sample * 32767).to_bytes(2, 'little', signed=True)

with wave.open(str(out), 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(rate)
    w.writeframes(frames)

print(f'Wrote {out} ({duration}s, {out.stat().st_size} bytes)')
