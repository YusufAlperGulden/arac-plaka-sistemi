import re

with open(r'static\js\main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Clean up showMaintenanceReminders()
old_show = r'function showMaintenanceReminders\(\) \{[\s\S]*?loadMaintenanceReminders\(\);\s*if \(state\.isAdmin\) \{\s*populateVehicleSelect\(\'maintenance-vehicle-select\'\);\s*\}.*?\}'
new_show = '''function showMaintenanceReminders() {
        hideAllSections();
        maintenanceRemindersSection.classList.remove('hidden');
        maintenanceRemindersSection.classList.add('active');
        maintenanceStatusFilter.value = 'all';
        resetMaintenanceReminderForm();
        loadMaintenanceReminders();
        if (state.isAdmin) {
            populateVehicleSelect('maintenance-vehicle-select');
        }
    }'''
text = re.sub(old_show, new_show, text)

# 2. Remove switchMaintenanceCenterTab function entirely
switch_func_pattern = r'window\.switchMaintenanceCenterTab = async function\(tab\) \{.*?\};\s*'
text = re.sub(switch_func_pattern, '', text, flags=re.DOTALL)

# 3. Add new JS logic
new_js_logic = '''
    const mainMaintenanceSection = document.getElementById('main-maintenance-section');
    const mainMaintenanceBtn = document.getElementById('action-maintenance-btn');
    const backFromMainMaintenanceBtn = document.getElementById('back-from-main-maintenance-btn');

    // Make sure we include mainMaintenanceSection in hideAllSections
    // Since hideAllSections uses an array, we will just add logic directly, or we can append it dynamically.
    
    function showMainMaintenanceSection() {
        hideAllSections();
        if (mainMaintenanceSection) {
            mainMaintenanceSection.classList.remove('hidden');
            mainMaintenanceSection.classList.add('active');
        }
        window.switchMainMaintenanceTab('add');
    }

    if (mainMaintenanceBtn) {
        mainMaintenanceBtn.addEventListener('click', showMainMaintenanceSection);
    }
    if (backFromMainMaintenanceBtn) {
        backFromMainMaintenanceBtn.addEventListener('click', showActionSelection);
    }

    window.switchMainMaintenanceTab = async function(tab) {
        const addView = document.getElementById('main-maintenance-add-view');
        const listView = document.getElementById('main-maintenance-list-view');
        const btnAdd = document.getElementById('tab-btn-add');
        const btnList = document.getElementById('tab-btn-list');
        
        if (addView) {
            if (tab === 'add') {
                addView.classList.add('active');
                addView.classList.remove('hidden');
                listView.classList.remove('active');
                listView.classList.add('hidden');
                btnAdd.classList.add('active');
                btnList.classList.remove('active');
                await loadMaintenanceVehicles();
            } else {
                addView.classList.remove('active');
                addView.classList.add('hidden');
                listView.classList.add('active');
                listView.classList.remove('hidden');
                btnAdd.classList.remove('active');
                btnList.classList.add('active');
                window.fetchMaintenanceList();
            }
        }
    };
'''

# We will inject this before the fetchMaintenanceList function.
text = text.replace('window.fetchMaintenanceList = async function', new_js_logic + '\n    window.fetchMaintenanceList = async function')

# Wait, `hideAllSections` loops through sections. Let's see if we need to add `main-maintenance-section` to the array.
# Let's just do it cleanly via regex if possible, or `document.getElementById('main-maintenance-section').classList.add('hidden')` inside `hideAllSections`.
# `hideAllSections` has an array of IDs. Let's inject into that array.
text = text.replace("'maintenance-reminders-section',", "'maintenance-reminders-section',\n        'main-maintenance-section',")

# Update `submitMaintenanceForm` to call `switchMainMaintenanceTab('list')` instead of `switchMaintenanceCenterTab('list')`
text = text.replace("window.switchMaintenanceCenterTab('list');", "window.switchMainMaintenanceTab('list');")

with open(r'static\js\main.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("JS refactor completed.")
