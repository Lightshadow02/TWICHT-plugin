# Écran Pirate 🏴‍☠️

Page plein écran pour l'écran derrière moi en stream (Android TV / Freebox). Scène de mer de nuit avec un coffre au trésor qui se remplit avec les dons, pluie d'emotes du chat, messages viewers et chrono du 24h.

## Ce que ça fait

- **Coffre au trésor** : se remplit au fil des dons (échelle log, pour que ça bouge même loin de l'objectif). Le total est gardé dans le navigateur, il survit à un rechargement.
- **Grosse alerte** à chaque don / sub / bits : pseudo en énorme + explosion de pièces.
- **Pluie d'emotes** : chaque emote Twitch du chat tombe dans la mer.
- **Chrono** : temps restant du stream 24h (ou l'heure si pas de date de début).
- **Bandeau** qui fait tourner les commandes / infos.
- Petit toast pour les follows.

## Commandes chat

| Commande | Qui | Effet |
|---|---|---|
| `!ecran <message>` | selon `ecran=` | affiche le message sur un parchemin (80 caractères max) |
| `!couleur bleu\|vert\|rouge\|violet\|or\|rose` | tout le monde | change l'ambiance (cooldown 15 s) |
| `!don <pseudo> <montant> [message]` | modos | déclenche un don à la main (dons hors Streamlabs) |
| `!tresor <montant>` | modos | recale le total affiché |
| `!testalerte` | modos | alerte de test, ne touche pas au total |

## Anti-abus

**Filtre automatique**, appliqué à `!ecran`, aux pseudos affichés et aux messages des donateurs :
- liste d'insultes et de propos haineux FR/EN, qui résiste aux contournements (`C0NN4RD`, `c.o.n.n.a.r.d`, `s a l o p e`, `connnnnard`, accents)
- ajoute tes propres mots dans `motsInterdits` (`'mot*'` = tout ce qui commence par ça)
- bloqués aussi : liens (même « point tv »), @mentions, mails, numéros de téléphone, ASCII art, spam d'emojis
- nettoyés : texte zalgo, caractères invisibles, messages en MAJUSCULES, lettres répétées
- un pseudo ou un message de don refusé s'affiche en « Un matelot », sans message

**Règles `!ecran`** : pas de premier message sur la chaîne, 3 messages dans le chat avant d'y avoir droit (sauf VIP/modos), cooldown 60 s, 3 s de délai, 2 messages refusés = bloqué 30 min. Le message disparaît si un modo le supprime ou timeout/ban l'auteur.

**Pluie d'emotes** : 12 max par personne toutes les 10 s, pas pour les premiers messages.

**Commandes modos**

| Commande | Effet |
|---|---|
| `!skip` | retire le message affiché |
| `!clear` | vide la file d'attente |
| `!ecranoff` / `!ecranon` | coupe / rouvre `!ecran` |
| `!validation on\|off` | chaque `!ecran` attend un `!ok` (ou `!non`) d'un modo, expire après 2 min |
| `!ecranban pseudo` / `!ecranunban pseudo` | bannit de l'écran (gardé même après rechargement) |
| `!panique` / `!calme` | coupe d'un coup tout ce qui vient du chat (messages, emotes, textes des dons) |

AutoMod de Twitch reste la première barrière : un message retenu par AutoMod n'arrive jamais jusqu'à l'écran.

## Paramètres d'URL

```
index.html?token=XXX&debut=2026-10-10T18:00&objectif=100000
```

| Paramètre | Défaut | Rôle |
|---|---|---|
| `chaine` | `burri_tv` | chaîne Twitch lue |
| `token` | — | Socket API token Streamlabs (Paramètres → API Settings → API Tokens) |
| `debut` | — | début du 24h, active le compte à rebours |
| `duree` | `24` | durée en heures |
| `objectif` | `100000` | objectif du trésor en € |
| `total` | dernier connu | force le total de départ |
| `ecran` | `tous` | accès à `!ecran` : `tous`, `subs`, `vip`, `mods`, `off` |
| `validation` | — | `1` pour démarrer en mode validation par les modos |
| `titre` / `sous` | `Burri` / `Gamers4Pets 2026` | textes en haut à gauche |
| `msgdons` | `1` | `0` pour ne pas afficher le message des donateurs |
| `demo` | — | faux dons / emotes pour tester le rendu |

⚠️ Le token Streamlabs ne doit jamais être commité : il se met uniquement dans l'URL ouverte sur la TV.

## Installation

1. Déposer le dossier `ecran-pirate/` sur ton hébergement web (FTP ou gestionnaire de fichiers) → `https://ton-domaine/ecran-pirate/`.
   Le fichier ne contient aucun secret : le token Streamlabs se met seulement dans l'URL ouverte sur la TV.
2. Sur la Freebox, installer **Fully Kiosk Browser** depuis le Play Store.
3. Start URL → `https://ton-domaine/ecran-pirate/?token=XXX&debut=2026-10-10T18:00`, activer le lancement au démarrage et « garder l'écran allumé ».
4. Tester avec `?demo` pour vérifier le rendu à la cam.

La page est dessinée en 1920×1080 et s'adapte à n'importe quel écran (bandes noires si le format diffère). Le total du trésor, le dernier butin et les bannis sont gardés dans le navigateur de la TV.

Look : maquette Claude Design « Écran Pirate » (au repos, alerte don, message `!ecran`). `?couleur=vert` pour démarrer dans une autre ambiance (bleu, vert, violet, rouge, or, rose).
