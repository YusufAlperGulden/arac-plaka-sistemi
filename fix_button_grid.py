import re

# 1. Update index.html
with open(r'templates\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# The maintenance button is currently:
#                 <button id="action-maintenance-btn" class="action-big-btn glass-panel">...
# And it's located AFTER </div> <!-- end of action-buttons-grid -->
# Let's extract it and put it inside action-buttons-grid.

btn_pattern = r'(\s*<button id="action-maintenance-btn" class="action-big-btn glass-panel">[\s\S]*?</button>)'
match_btn = re.search(btn_pattern, html)
if match_btn:
    btn_html = match_btn.group(1)
    # Remove it from its current position
    html = html.replace(btn_html, '')
    
    # Now find the end of action-buttons-grid
    # It ends right before <!-- Yeni Yönetim / Rapor Butonu -->
    target_pos = r'(\s*</div>\s*<!-- Yeni Yönetim / Rapor Butonu -->)'
    match_target = re.search(target_pos, html)
    if match_target:
        html = html[:match_target.start()] + btn_html + html[match_target.start():]
        with open(r'templates\index.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print("Moved button inside grid in index.html.")
    else:
        print("Could not find the end of action-buttons-grid.")
else:
    print("Could not find action-maintenance-btn.")

# 2. Update style.css
with open(r'static\css\style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# We need to find `repeat(3, 1fr)` for `.action-buttons-grid` and change it to `repeat(4, 1fr)`
if 'repeat(3, 1fr)' in css:
    css = css.replace('repeat(3, 1fr)', 'repeat(4, 1fr)')
    with open(r'static\css\style.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("Updated style.css to repeat(4, 1fr).")
else:
    print("Could not find repeat(3, 1fr) in style.css.")
