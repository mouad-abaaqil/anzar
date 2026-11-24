#!/bin/sh
# Verrou global : un seul Chrome/WebGL à la fois sur la machine (le rendu 3D logiciel est très gourmand en CPU).
# Usage : sh scripts/with-capture-lock.sh <commande...>
LOCK=/tmp/anzar-capture.lock
n=0
until mkdir "$LOCK" 2>/dev/null; do
  # verrou périmé (> 3 min) : on le reprend
  if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +3 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null; continue; fi
  n=$((n+1)); [ $n -gt 120 ] && { echo "verrou occupé trop longtemps" >&2; exit 1; }
  sleep 2
done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM
nice -n 10 "$@"
rc=$?
pkill -f "Google Chrome.*--headless" 2>/dev/null
exit $rc
