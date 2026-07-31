import re

with open(r'static\js\main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# The block to remove is from:
# document.addEventListener('DOMContentLoaded', () => {
#    const profilePhotoInput = document.getElementById('profile-photo-input');
#    ...
#    // Fotoğraf Seçimi ve Canvas ile Küçültme

search_str = r"document\.addEventListener\('DOMContentLoaded', \(\) => \{\n\s+const profilePhotoInput = document\.getElementById\('profile-photo-input'\);\n\s+const profileUpdateForm = document\.getElementById\('profile-update-form'\);\n\s+const profileBtn = document\.getElementById\('header-profile-btn'\);\n\s+const profileModal = document\.getElementById\('profile-modal'\);\n\s+const closeProfileBtn = document\.getElementById\('close-profile-modal'\);\n\s+const cancelProfileBtn = document\.getElementById\('cancel-profile-btn'\);\n\n\s+if \(profileBtn && profileModal\) \{\n\s+profileBtn\.addEventListener\('click', \(e\) => \{\n\s+e\.preventDefault\(\);\n\s+e\.stopPropagation\(\);\n\s+\n\s+const profileFullname = document\.getElementById\('profile-fullname'\);\n\s+const profilePassword = document\.getElementById\('profile-password'\);\n\s+const profileModalImg = document\.getElementById\('profile-modal-img'\);\n\s+const profileModalPlaceholder = document\.getElementById\('profile-modal-placeholder'\);\n\s+\n\s+if \(profileFullname\) profileFullname\.value = state\.fullName \|\| state\.username \|\| '';\n\s+if \(profilePassword\) profilePassword\.value = '';\n\s+currentBase64Photo = state\.profilePhoto \|\| '';\n\s+\n\s+if \(currentBase64Photo && profileModalImg\) \{\n\s+profileModalImg\.src = currentBase64Photo;\n\s+profileModalImg\.style\.display = 'block';\n\s+if \(profileModalPlaceholder\) profileModalPlaceholder\.style\.display = 'none';\n\s+\} else if \(profileModalImg && profileModalPlaceholder\) \{\n\s+profileModalImg\.src = '';\n\s+profileModalImg\.style\.display = 'none';\n\s+profileModalPlaceholder\.style\.display = 'flex';\n\s+const char = \(state\.fullName \|\| state\.username \|\| 'P'\)\.charAt\(0\)\.toUpperCase\(\);\n\s+profileModalPlaceholder\.textContent = char;\n\s+\}\n\s+\n\s+profileModal\.classList\.add\('active'\);\n\s+\}\);\n\s+\}\n\n\s+const closeModalHandler = \(e\) => \{\n\s+if \(e\) \{\n\s+e\.preventDefault\(\);\n\s+e\.stopPropagation\(\);\n\s+\}\n\s+if \(profileModal\) profileModal\.classList\.remove\('active'\);\n\s+\};\n\n\s+if \(closeProfileBtn\) closeProfileBtn\.addEventListener\('click', closeModalHandler\);\n\s+if \(cancelProfileBtn\) cancelProfileBtn\.addEventListener\('click', closeModalHandler\);\n\n\s+//"

replace_str = r"""window.openProfileModal = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const profileModal = document.getElementById('profile-modal');
    const profileFullname = document.getElementById('profile-fullname');
    const profilePassword = document.getElementById('profile-password');
    const profileModalImg = document.getElementById('profile-modal-img');
    const profileModalPlaceholder = document.getElementById('profile-modal-placeholder');
    
    if (profileFullname) profileFullname.value = state.fullName || state.username || '';
    if (profilePassword) profilePassword.value = '';
    currentBase64Photo = state.profilePhoto || '';
    
    if (currentBase64Photo && profileModalImg) {
        profileModalImg.src = currentBase64Photo;
        profileModalImg.style.display = 'block';
        if (profileModalPlaceholder) profileModalPlaceholder.style.display = 'none';
    } else if (profileModalImg && profileModalPlaceholder) {
        profileModalImg.src = '';
        profileModalImg.style.display = 'none';
        profileModalPlaceholder.style.display = 'flex';
        const char = (state.fullName || state.username || 'P').charAt(0).toUpperCase();
        profileModalPlaceholder.textContent = char;
    }
    
    if (profileModal) profileModal.classList.add('active');
};

window.closeProfileModal = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const profileModal = document.getElementById('profile-modal');
    if (profileModal) profileModal.classList.remove('active');
};

document.addEventListener('DOMContentLoaded', () => {
    const profilePhotoInput = document.getElementById('profile-photo-input');
    const profileUpdateForm = document.getElementById('profile-update-form');

    //"""

new_text = re.sub(search_str, replace_str, text, count=1)
if new_text == text:
    print('Failed to replace.')
else:
    with open(r'static\js\main.js', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('Replaced main.js successfully.')
