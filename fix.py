import os, re

for f in ['js/admin.js', 'js/app.js', 'js/display.js']:
    with open(f, 'r') as file:
        content = file.read()
    
    # Ganti kata supabase jadi supabaseClient
    content = re.sub(r'\bsupabase\b', 'supabaseClient', content)
    
    with open(f, 'w') as file:
        file.write(content)
