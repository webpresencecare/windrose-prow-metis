#!/bin/bash
# Builds the installable zip dist/<slug>.zip with a <slug>/ root folder (never GitHub's source archive, whose folder
# name differs). Everything except what .distignore lists. Checks that theme.json and every style parse and that the tag (when
# given) matches the Version header of style.css.
# Usage: bin/build-zip.sh [vX.Y.Z]
set -euo pipefail
cd "$(dirname "$0")/.."
slug=$(basename "$PWD")
version=$(grep -m1 -E '^Version:' style.css | awk '{print $NF}')
if [ "${1:-}" != "" ] && [ "v$version" != "$1" ]; then
	echo "Tag $1 does not match the Version header ($version)." >&2
	exit 1
fi
for f in theme.json styles/*.json; do
	python3 -c 'import json, sys; json.load(open(sys.argv[1]))' "$f" || { echo "$f is not valid JSON." >&2; exit 1; }
done

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' -e 's#^/*#/#' .distignore > "$work/exclude.txt"
mkdir -p "$work/$slug" dist
rsync -a --exclude-from="$work/exclude.txt" ./ "$work/$slug/"
rm -f "dist/$slug.zip"
(cd "$work" && zip -qrX "$OLDPWD/dist/$slug.zip" "$slug")
echo "dist/$slug.zip ($version): $(unzip -Z1 "dist/$slug.zip" | wc -l) entries, sha256 $(sha256sum "dist/$slug.zip" | cut -d' ' -f1)"
