import re

with open('templates/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

ids = re.findall(r'id=[\'\"](.*?)[\'\"]', html)
duplicates = set([x for x in ids if ids.count(x) > 1])
if duplicates:
    print('Duplicate IDs found:', duplicates)
else:
    print('No duplicate IDs.')
