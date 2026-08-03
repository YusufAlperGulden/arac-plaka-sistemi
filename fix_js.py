import re

with open(r'static\js\main.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_js = '''    window.showMaintenanceSection = async function() {
        hideAllSections();
        const section = document.getElementById('maintenance-section');
        if (section) {
            section.classList.remove('hidden');
            section.classList.add('active');
        }
        
        await loadMaintenanceVehicles();
        window.switchMaintenanceTab('add');
    };

    window.switchMaintenanceTab = function(tab) {
        const addView = document.getElementById('maintenance-add-view');
        const listView = document.getElementById('maintenance-list-view');
        const btnAdd = document.getElementById('tab-maintenance-add');
        const btnList = document.getElementById('tab-maintenance-list');
        
        if (tab === 'add') {
            addView.classList.remove('hidden');
            listView.classList.add('hidden');
            btnAdd.style.color = 'var(--primary-color)';
            btnList.style.color = 'var(--text-secondary)';
        } else {
            addView.classList.add('hidden');
            listView.classList.remove('hidden');
            btnAdd.style.color = 'var(--text-secondary)';
            btnList.style.color = 'var(--primary-color)';
            window.fetchMaintenanceList();
        }
    };'''

new_js = '''    window.switchMaintenanceCenterTab = async function(tab) {
        const remindersView = document.getElementById('maintenance-reminders-view');
        const addView = document.getElementById('maintenance-add-view');
        const listView = document.getElementById('maintenance-list-view');
        
        const btnReminders = document.getElementById('tab-maintenance-reminders');
        const btnAdd = document.getElementById('tab-maintenance-add');
        const btnList = document.getElementById('tab-maintenance-list');
        
        // Önce hepsini gizle
        if(remindersView) remindersView.classList.add('hidden');
        if(addView) addView.classList.add('hidden');
        if(listView) listView.classList.add('hidden');
        
        // Buton renklerini sıfırla
        if(btnReminders) btnReminders.style.color = 'var(--text-secondary)';
        if(btnAdd) btnAdd.style.color = 'var(--text-secondary)';
        if(btnList) btnList.style.color = 'var(--text-secondary)';

        if (tab === 'reminders') {
            if(remindersView) remindersView.classList.remove('hidden');
            if(btnReminders) btnReminders.style.color = 'var(--primary-color)';
        } else if (tab === 'add') {
            if(addView) addView.classList.remove('hidden');
            if(btnAdd) btnAdd.style.color = 'var(--primary-color)';
            await loadMaintenanceVehicles();
        } else if (tab === 'list') {
            if(listView) listView.classList.remove('hidden');
            if(btnList) btnList.style.color = 'var(--primary-color)';
            window.fetchMaintenanceList();
        }
    };'''

text = text.replace(old_js, new_js)
text = text.replace("window.switchMaintenanceTab('list');", "window.switchMaintenanceCenterTab('list');")

# Remove hideAllSections logic if needed. wait, `#maintenance-reminders-section` is opened using standard logic via button clicks in the management UI.
# In management UI: document.getElementById('maintenance-reminders-btn').addEventListener('click', ...
# The event listener in main.js needs to open 'reminders' tab by default.
# Let's see how it's opened. It just calls: `document.getElementById('maintenance-reminders-section').classList.remove('hidden');`
# I should inject `window.switchMaintenanceCenterTab('reminders');` where this section is opened.
# I'll search for `maintenance-reminders-btn` click event.

with open(r'static\js\main.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('JS updated.')
