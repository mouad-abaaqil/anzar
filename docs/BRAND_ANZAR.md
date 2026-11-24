# Anzar — identité

**Nom** : Anzar (Anzar / Anẓar, dieu amazigh de la pluie ; « pluie » en tachelhit). **Tagline** : « L’eau du Maroc, relief par relief. »
**Statut** : prototype indépendant, issu d’un stage à la RAMSA. Pas un portail officiel. SRM-SM garde ses couleurs (#12508F, #FAB61F, #57B24A) dans la vue Souss-Massa.

## Disponibilité (vérifiée le 23 nov. 2026, whois/dig + une recherche web)
- Preuve d'enregistrement (serveurs DNS ou registrar) : anzar.ma (NS genious.net), anzar.io (NameCheap, créé 2021), anzar.app (NS Porkbun). anzar.earth et anzar.eco : mon whois n'a renvoyé que l'enregistrement du TLD (pas de serveur DNS), **statut inconnu**, à tester chez un registrar. Les .water n'ont pas été testés.
- Recherche web : pas de marque d'eau ou d'environnement trouvée sous ce nom. Usages existants non liés à l'eau : Anzart.ma (concept store d'art, 2017) et Anẓaṛ (cosmétiques naturels, anzarcosmetic.com). Pas de recherche INPI/OMPIC : **aucune vérification de dépôt de marque**.
- Collision grave : non constatée. Pas de nom de repli nécessaire ; en cas de besoin, utiliser « Anzar Observatoire » comme nom complet.

## Palette (contrastes AA)
Rapports de contraste approximatifs, calculés à la main.

| Rôle | Hex | Usage |
| --- | --- | --- |
| Nuit | #0A1B2A | fond, texte sur clair (≈ 15:1 sur sable) |
| Nuit profonde | #06121D | scrims, pied de page |
| Cyan glacier | #5FD4E6 | goutte, chiffres, bouton (≈ 10:1 sur nuit) |
| Ocre atlas | #D9A441 | tagline, repères (≈ 8:1 sur nuit) |
| Corail | #FF6B4A | accent (soleil du logo) ; #B9381C sur clair |
| Neige / brume | #EAF2F5 / #9FB4C2 | texte sur sombre (≥ 7:1) |
| Sable | #F3EBDD | sections claires |

## Typographie
Depuis la refonte (23 nov. 2026, `docs/DESIGN_ANZAR.md`) : IBM Plex Sans Condensed (titres, chiffres) et IBM Plex Mono (micro-labels) via @fontsource (OFL), texte en police système. Les anciennes pages utilisent encore titres serif « Iowan Old Style / Palatino / Georgia » et system-ui jusqu'à leur migration.

## Logo (`platform/public/brand/anzar/`)
Goutte cyan dont le bas est taillé par une crête de l’Atlas, avec un soleil corail. `mark.svg` (sur nuit), `mark-on-light.svg`, `mark-mono.svg` (currentColor), `favicon.svg`, `logo.svg` (marque + mot + tagline). Texte du logo en police système (pas converti en tracés).
