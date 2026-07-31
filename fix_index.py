import re

with open(r'templates\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('id="header-profile-btn" class="profile-header-btn" style="', 'id="header-profile-btn" class="profile-header-btn" onclick="window.openProfileModal(event)" style="')
text = text.replace('id="close-profile-modal" class="close-modal"', 'id="close-profile-modal" class="close-modal" onclick="window.closeProfileModal(event)"')
text = text.replace('id="cancel-profile-btn" class="btn-secondary"', 'id="cancel-profile-btn" class="btn-secondary" onclick="window.closeProfileModal(event)"')
text = text.replace('main.js?v=48', 'main.js?v=49')

with open(r'templates\index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print('Modified index.html')
