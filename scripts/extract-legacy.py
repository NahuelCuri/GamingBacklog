"""Unpacks the legacy Claude Design bundle (public/legacy/index.html) into
legacy-src/ as readable reference files. Vendor libs and fonts are skipped."""
import base64, gzip, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE = os.path.join(ROOT, 'public', 'legacy', 'index.html')
OUT = os.path.join(ROOT, 'legacy-src')

# Unnamed script uuids → the file names used in MIGRATION_PLAN.md.
NAMES = {
    'd3634a0b-a981-4fe2-bc9d-256f473644be': 'spending.js',
    '9d741160-dc4e-4009-b1b8-a9d2a16534d6': 'collection-lib.js',
    'cca6005b-a034-4451-a726-9bc394cd1dc9': 'games-config.js',
    '1f53b3f2-7ee0-4744-9cb9-b4ca5e724108': 'books-config.js',
    'f4abc200-8107-4a01-b3a5-97d466f80168': 'wines-config.js',
    'd193ede6-dc70-4b02-affa-434a64f412b5': 'movies-config.js',
    '2f6df631-8ed3-4394-a09c-e34e6fcf59d5': 'expenses-config.js',
    'b4e847fd-3156-4fc4-ac6d-49f8fe24962f': 'games-seed.js',
    '9f72c247-c564-4748-b5f9-1ca47c2da2ff': 'books-seed.js',
    '6ac3f7c3-2dbd-465f-9268-60ddb3f80e36': 'wines-seed.js',
    '189bbe37-bc9e-4cc4-a97a-e54848186ae1': 'movies-seed.js',
    '006b1e30-a3f1-4010-943d-f6a0c19e4308': 'expenses-seed.js',
    'ba8291ec-c613-461d-a3cd-4b31c38e41e2': 'i18n.js',
}


def block(src, kind):
    return re.search(r'__bundler/%s">\s*(.*?)\s*</script>' % kind, src, re.S).group(1)


def main():
    src = open(BUNDLE, encoding='utf-8').read()
    manifest = json.loads(block(src, 'manifest'))
    ext = {e['uuid']: e['id'] for e in json.loads(block(src, 'ext_resources'))}
    os.makedirs(OUT, exist_ok=True)

    for uuid, entry in manifest.items():
        name = NAMES.get(uuid)
        if not name and ext.get(uuid, '').startswith('./'):
            name = ext[uuid][2:].replace('%20', ' ')
        if not name:
            continue  # vendor libs (react, supabase, dc-runtime) and fonts
        data = base64.b64decode(entry['data'])
        if entry.get('compressed'):
            data = gzip.decompress(data)
        open(os.path.join(OUT, name), 'wb').write(data)

    # The root template is the home page (Backlog.dc.html); drop inlined fonts.
    home = json.loads(block(src, 'template'))
    home = re.sub(r'@font-face\s*\{[^}]*\}\s*', '', home)
    open(os.path.join(OUT, 'Backlog.dc.html'), 'w', encoding='utf-8').write(home)
    print('\n'.join(sorted(os.listdir(OUT))))


if __name__ == '__main__':
    main()
