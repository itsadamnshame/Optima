with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('.isoformat() + "Z"', '.isoformat(timespec="milliseconds") + "Z"')
content = content.replace('.isoformat() + \'Z\'', '.isoformat(timespec="milliseconds") + \'Z\'')
content = content.replace('now.isoformat()', 'now.isoformat(timespec="milliseconds")')
content = content.replace('.isoformat().replace("+00:00", "Z")', '.isoformat(timespec="milliseconds").replace("+00:00", "Z")')
content = content.replace('.isoformat().replace(\'+00:00\', \'Z\')', '.isoformat(timespec="milliseconds").replace(\'+00:00\', \'Z\')')
with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Replaced")
