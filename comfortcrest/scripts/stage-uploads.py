#!/usr/bin/env python3
"""Upload theme files to Shopify staged targets and emit themeFilesUpsert vars.

Why this exists: the only write path available here is the Admin GraphQL
themeFilesUpsert mutation, and inlining 240KB of Liquid into a mutation body is
both slow and easy to corrupt. Staged uploads let the bytes go straight from
disk to Shopify's bucket over HTTP, leaving only a short list of URLs to pass
through the mutation.

Flow:
  1. stagedUploadsCreate for each file (basename + mime), response saved to disk
  2. this script POSTs each local file to its signed target
  3. it prints themeFilesUpsert variables using body {type: URL}

Usage: stage-uploads.py <staged-response.json> [--root theme] [--theme-id ID]
"""
import argparse, json, os, subprocess, sys

MIME = {'.css': 'text/css', '.js': 'text/javascript',
        '.json': 'application/json', '.liquid': 'text/plain'}


def staging_input(root):
    """Print the stagedUploadsCreate input for every file under root."""
    items = []
    for dirpath, _, files in os.walk(root):
        for fn in sorted(files):
            items.append({"resource": "FILE", "filename": fn,
                          "mimeType": MIME[os.path.splitext(fn)[1]],
                          "httpMethod": "POST"})
    items.sort(key=lambda i: i["filename"])
    return {"input": items}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('staged', nargs='?', help='saved stagedUploadsCreate response')
    ap.add_argument('--root', default='theme')
    ap.add_argument('--theme-id', default=os.environ.get('CC_THEME_GID', ''))
    ap.add_argument('--print-input', action='store_true',
                    help='emit the stagedUploadsCreate input and exit')
    a = ap.parse_args()

    if a.print_input or not a.staged:
        json.dump(staging_input(a.root), sys.stdout, separators=(',', ':'))
        return

    targets = json.load(open(a.staged))["data"]["stagedUploadsCreate"]["stagedTargets"]

    # Basenames are unique across the theme, so one map resolves every target.
    paths = {fn: os.path.join(d, fn)
             for d, _, fs in os.walk(a.root) for fn in fs}

    upserts, failed = [], []
    for t in targets:
        key = next(p["value"] for p in t["parameters"] if p["name"] == "key")
        base = key.rsplit("/", 1)[-1]
        src = paths.get(base)
        if not src:
            failed.append((base, "no local file")); continue

        cmd = ["curl", "-sS", "--max-time", "120", "-X", "POST", t["url"],
               "-o", "/dev/null", "-w", "%{http_code}"]
        for p in t["parameters"]:
            cmd += ["-F", f'{p["name"]}={p["value"]}']
        cmd += ["-F", f"file=@{src}"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.stdout.strip() != "201":
            failed.append((base, f"HTTP {r.stdout.strip()}")); continue

        upserts.append({"filename": os.path.relpath(src, a.root).replace(os.sep, "/"),
                        "body": {"type": "URL", "value": t["resourceUrl"]}})

    for b, why in failed:
        print(f"FAIL {b}: {why}", file=sys.stderr)
    print(f"uploaded {len(upserts)}/{len(targets)}", file=sys.stderr)

    upserts.sort(key=lambda u: u["filename"])
    json.dump({"themeId": a.theme_id, "files": upserts}, sys.stdout, separators=(',', ':'))


if __name__ == '__main__':
    main()
