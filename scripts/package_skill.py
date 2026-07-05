#!/usr/bin/env python3
"""Regenerate the Claude Desktop skill bundle from THIS folder.

Claude Desktop is the one runtime that can't read a local folder live — it wants an
uploaded .zip. Rather than maintain a second copy, we *regenerate* the bundle from the
single source of truth on demand. Never hand-edit the zip; re-run this after any change.

    python3 scripts/package_skill.py            # -> dist/trading-desk.zip
    python3 scripts/package_skill.py --out /tmp # custom output dir

The zip contains SKILL.md, skills/, scripts/, AGENTS.md, PORTABILITY.md — everything the
skill needs — and excludes .git, __pycache__, dist/, reports/ (run artifacts), and dotfiles.
Upload dist/trading-desk.zip in Claude Desktop → Settings → Capabilities → Skills.
"""
import argparse
import fnmatch
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Only these top-level entries ship in the bundle (the skill, not the run artifacts).
INCLUDE_TOP = ["SKILL.md", "AGENTS.md", "PORTABILITY.md", "README.md", "LICENSE",
               "references", "scripts"]
# Never bundle these, at any depth.
EXCLUDE_GLOBS = ["*.pyc", "__pycache__", ".DS_Store", "*.zip"]


def excluded(rel):
    parts = rel.split(os.sep)
    return any(fnmatch.fnmatch(p, g) for p in parts for g in EXCLUDE_GLOBS)


def iter_files():
    for top in INCLUDE_TOP:
        path = os.path.join(ROOT, top)
        if not os.path.exists(path):
            continue
        if os.path.isfile(path):
            yield path, top
            continue
        for dirpath, dirnames, filenames in os.walk(path):
            dirnames[:] = [d for d in dirnames if not excluded(d)]
            for fn in filenames:
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, ROOT)
                if not excluded(rel):
                    yield full, rel


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=os.path.join(ROOT, "dist"),
                    help="output directory (default: dist/)")
    ap.add_argument("--name", default="trading-desk", help="bundle basename")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    zip_path = os.path.join(args.out, f"{args.name}.zip")

    n = 0
    # arcname is prefixed with the skill name so it unzips into a single named folder.
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for full, rel in sorted(iter_files(), key=lambda t: t[1]):
            zf.write(full, os.path.join(args.name, rel))
            n += 1

    size_kb = os.path.getsize(zip_path) / 1024
    print(f"Wrote {zip_path} ({n} files, {size_kb:.0f} KB)")
    print("Upload it in Claude Desktop → Settings → Capabilities → Skills.")
    print("Re-run this after any edit to the source folder — the zip is a mirror, not a copy to maintain.")


if __name__ == "__main__":
    main()
