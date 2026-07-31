import re

with open('static/js/main.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Look for addEventListener inside functions that aren't init() or main setup blocks
lines = js.split('\n')
inside_function = None
warnings = []

for i, line in enumerate(lines):
    func_match = re.search(r'function\s+(\w+)\s*\(', line)
    if func_match:
        inside_function = func_match.group(1)
    
    if '.addEventListener(' in line and inside_function:
        if inside_function not in ('init', 'setupListeners', 'DOMContentLoaded', 'window.onload'):
            warnings.append(f"Line {i+1} in {inside_function}: {line.strip()}")

if warnings:
    print('Event listeners added inside general functions (potential memory leaks/duplicates):')
    for w in warnings:
        print(w)
else:
    print('No obvious event listener issues.')
