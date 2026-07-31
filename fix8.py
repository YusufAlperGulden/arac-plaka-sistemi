import re

with open(r'static\js\main.js', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

for i, line in enumerate(lines):
    if 'window.showToast(' in line and 'success' in line and 'kilometre' in line:
        lines[i] = "            window.showToast('PLAKA ONAYLANDI', 'success');"

with open(r'static\js\main.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
