#!/bin/sh
# Build statique (sans API Node) puis déploiement sur anzar.abq.capital (Worker Cloudflare, assets seuls).
# Prérequis : npx wrangler login (compte propriétaire de la zone abq.capital).
set -eu
cd "$(dirname "$0")/.."
VITE_STATIC=1 npm run build
npx wrangler deploy
echo "Vérification :"
for p in / /data/regions.json /brand/anzar/favicon.svg; do
  curl -s -o /dev/null -w "https://anzar.abq.capital$p -> %{http_code}\n" "https://anzar.abq.capital$p"
done
# /api/* doit répondre 404 (et non index.html)
curl -s -o /dev/null -w "https://anzar.abq.capital/api/rain -> %{http_code} (attendu 404)\n" https://anzar.abq.capital/api/rain
