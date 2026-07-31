import re

with open('templates/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('static/js/main.js', 'r', encoding='utf-8') as f:
    js = f.read()

js_ids = re.findall(r'document\.getElementById\([\'\"](.*?)[\'\"]\)', js)
html_ids = re.findall(r'id=[\'\"](.*?)[\'\"]', html)

missing_ids = [js_id for js_id in set(js_ids) if js_id not in html_ids]

if missing_ids:
    print('IDs in JS but missing in HTML:', missing_ids)
else:
    print('All IDs from JS are present in HTML.')
