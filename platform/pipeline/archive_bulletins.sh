#!/usr/bin/env bash
# Download-only archiver for the daily dam bulletin PDF (etat_global.pdf, Arabic folder).
# Usage: archive_bulletins.sh                      -> today's bulletin
#        archive_bulletins.sh START END            -> every missing date START..END (YYYY-MM-DD)
# Idempotent: existing non-empty files are skipped. Polite: 1 s between requests.
# Not scheduled. Does no parsing; transcription is a separate manual step.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/../data-raw/bulletins"
BASE="https://maadialna.ma/sites/default/files/barrages"
UA="water-research/1.0"
mkdir -p "$OUT"

next_day() { date -j -v+1d -f %F "$1" +%F 2>/dev/null || date -d "$1 +1 day" +%F; }

START="${1:-$(date +%F)}"
END="${2:-$START}"

d="$START"; got=0; skipped=0; missing=0
while :; do
  f="$OUT/$d.pdf"
  if [ -s "$f" ]; then
    skipped=$((skipped+1))
  else
    tmp="$f.part"
    code=$(curl -sS -m 60 -A "$UA" -o "$tmp" -w '%{http_code}' "$BASE/$d/ar/etat_global.pdf" 2>/dev/null)
    if [ "$code" = "200" ] && head -c 4 "$tmp" | grep -q '%PDF'; then
      mv "$tmp" "$f"; got=$((got+1)); echo "saved   $d"
    else
      rm -f "$tmp"; missing=$((missing+1)); echo "missing $d (HTTP $code)"
    fi
    sleep 1
  fi
  [ "$d" = "$END" ] && break
  d="$(next_day "$d")"
done
echo "done: saved=$got skipped=$skipped missing=$missing"
