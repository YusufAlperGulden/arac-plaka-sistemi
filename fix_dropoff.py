import re

with open(r'static\js\main.js', 'r', encoding='utf-8') as f:
    text = f.read()

search_str = r"""            if \(dropoffBtn\) \{
                if \(activeCount === 0\) \{
                    dropoffBtn\.disabled = true;
                    dropoffBtn\.style\.opacity = '0\.4';
                    dropoffBtn\.style\.cursor = 'not-allowed';
                \} else \{
                    dropoffBtn\.disabled = false;
                    dropoffBtn\.style\.opacity = '1';
                    dropoffBtn\.style\.cursor = 'pointer';
                \}
            \}"""

replace_str = r"""            if (dropoffBtn) {
                const dropoffDesc = dropoffBtn.querySelector('p');
                if (activeCount === 0) {
                    dropoffBtn.disabled = true;
                    dropoffBtn.style.opacity = '0.4';
                    dropoffBtn.style.cursor = 'not-allowed';
                    if (dropoffDesc) dropoffDesc.textContent = 'Teslim edilecek araç yoktur.';
                } else {
                    dropoffBtn.disabled = false;
                    dropoffBtn.style.opacity = '1';
                    dropoffBtn.style.cursor = 'pointer';
                    if (dropoffDesc) dropoffDesc.textContent = 'Kullanılan aracın filoya geri getirilmesi';
                }
            }"""

new_text = re.sub(search_str, replace_str, text, count=1)
if new_text == text:
    print('Failed to replace.')
else:
    with open(r'static\js\main.js', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('Replaced main.js successfully.')
