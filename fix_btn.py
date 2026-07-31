import re

with open(r'static\js\main.js', 'r', encoding='utf-8') as f:
    text = f.read()

search_str = r"""    async function updateDropoffButtonVisibility\(\) \{
        const dropoffBtn = document\.getElementById\('action-dropoff'\);
        try \{
            const response = await fetch\('/api/active-trips'\);
            if \(\!response\.ok\) return;
            const data = await response\.json\(\);
            if \(data\.counts && data\.counts\.active === 0\) \{
                dropoffBtn\.disabled = true;
                dropoffBtn\.style\.opacity = '0\.4';
                dropoffBtn\.style\.cursor = 'not-allowed';
            \} else \{
                dropoffBtn\.disabled = false;
                dropoffBtn\.style\.opacity = '1';
                dropoffBtn\.style\.cursor = 'pointer';
            \}
        \} catch \(error\) \{
            console\.error\('Error updating dropoff visibility:', error\);
        \}
    \}"""

replace_str = r"""    async function updateActionButtonsVisibility() {
        const dropoffBtn = document.getElementById('action-dropoff');
        const pickupBtn = document.getElementById('action-pickup');
        try {
            const activeRes = await fetch('/api/active-trips');
            if (!activeRes.ok) return;
            const data = await activeRes.json();
            
            const activeCount = (data.counts && data.counts.active) ? data.counts.active : 0;
            
            if (dropoffBtn) {
                if (activeCount === 0) {
                    dropoffBtn.disabled = true;
                    dropoffBtn.style.opacity = '0.4';
                    dropoffBtn.style.cursor = 'not-allowed';
                } else {
                    dropoffBtn.disabled = false;
                    dropoffBtn.style.opacity = '1';
                    dropoffBtn.style.cursor = 'pointer';
                }
            }
            
            if (pickupBtn) {
                const vehicles = await fetchPlatesAPI();
                const totalVehicles = vehicles.length;
                
                const pickupDesc = pickupBtn.querySelector('p');
                
                if (totalVehicles <= activeCount) {
                    pickupBtn.disabled = true;
                    pickupBtn.style.opacity = '0.4';
                    pickupBtn.style.cursor = 'not-allowed';
                    if (pickupDesc) pickupDesc.textContent = 'Çıkışa uygun araç yoktur.';
                } else {
                    pickupBtn.disabled = false;
                    pickupBtn.style.opacity = '1';
                    pickupBtn.style.cursor = 'pointer';
                    if (pickupDesc) pickupDesc.textContent = 'Sürücünün / Müşterinin aracı filodan alması';
                }
            }
        } catch (error) {
            console.error('Error updating action buttons visibility:', error);
        }
    }"""

new_text = re.sub(search_str, replace_str, text, count=1)
if new_text == text:
    print('Failed to replace updateDropoffButtonVisibility')
else:
    new_text = new_text.replace('updateDropoffButtonVisibility();', 'updateActionButtonsVisibility();')
    with open(r'static\js\main.js', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('Replaced main.js successfully.')
