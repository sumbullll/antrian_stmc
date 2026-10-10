import os

files_to_check = [
    'index.html', 
    'admin.html', 
    'display.html', 
    'daftar.html',
    'schema.sql',
    'js/app.js',
    'js/admin.js',
    'js/display.js'
]

for f in files_to_check:
    if not os.path.exists(f): continue
    
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    new_content = content.replace('Medical Center Pangkep', 'Semen Tonasa Medical Center')
    
    if new_content != content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print(f"Updated {f}")
