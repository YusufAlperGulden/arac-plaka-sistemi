import re

with open(r'static\js\main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# The tool corrupted the async function declaration. 
# We need to find the try block that starts loadMaintenanceVehicles.
match = re.search(r'try \{\s*const res = await fetch\(\'/api/vehicles\'\);[\s\S]*?console\.error\(\'Araçlar yüklenemedi:\', e\);\s*\}\s*\}', text)
if match:
    old_text = match.group(0)
    new_text = '''    function loadMaintenanceVehicles() {
        const select = document.getElementById('maintenance-vehicle');
        select.innerHTML = '<option value="" disabled selected>Araç Seçiniz</option>';
        const vehicles = Array.from(registeredVehiclesByPlate.values());
        vehicles.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.displayLabel || v.plate;
            select.appendChild(opt);
        });
    }'''
    text = text.replace(old_text, new_text)
    with open(r'static\js\main.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed corrupted function")
else:
    print("Could not find corrupted block")
