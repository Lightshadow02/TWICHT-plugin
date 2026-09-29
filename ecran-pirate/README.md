# Écran Pirate 🏴‍☠️

Page plein écran pour l'écran derrière moi en stream (Android TV / Freebox), pensée pour Gamers4Pets 2026.
Une scène de mer de nuit avec un coffre au trésor qui se remplit avec les dons, les emotes du chat qui tombent dans la mer, les messages des viewers sur un parchemin et le chrono du 24h.

Look repris de la maquette Claude Design « Écran Pirate » (au repos, alerte don, message `!ecran`).

## Ce que ça fait

- **Coffre au trésor** : l'or monte au fil des dons (échelle log, pour que ça bouge même loin de l'objectif). Le montant s'affiche sur un panneau en bois.
- **Alertes** : don, sub ou bits → le décor s'assombrit, un parchemin tombe avec le pseudo et le montant dans un sceau de cire, et des pièces jaillissent du coffre.
- **Pluie d'emotes** : chaque emote Twitch du chat tombe dans la mer.
- **Messages viewers** : `!ecran` affiche le message sur un parchemin qui se déroule.
- **Chrono** : compte à rebours du 24h (ou l'heure s'il n'y a pas de date de début).
- **Dernier butin** : carte avec le dernier donateur.
- **Follows** : une carte « Nouveau matelot » glisse sur le côté.
- **Bandeau** : fait tourner les commandes et infos en bas de l'écran.
- **Décor animé** : vagues, bateau qui passe, drapeau et palmier au vent, étoiles, reflet de la lune.

Le total du trésor, le dernier butin et les bannis sont gardés dans le navigateur de la TV : ils survivent à un rechargement.

## Installation

1. Déposer le dossier `ecran-pirate/` sur l'hébergement web (FTP ou gestionnaire de fichiers) → `https://ton-domaine/ecran-pirate/`.
   Le fichier ne contient aucun secret : le token Streamlabs se met seulement dans l'URL ouverte sur la TV.
2. Sur la Freebox, installer **Fully Kiosk Browser** depuis le Play Store.
3. Start URL → `https://ton-domaine/ecran-pirate/?token=XXX&debut=2026-10-10T18:00`, puis activer le lancement au démarrage et « garder l'écran allumé ».
4. Au démarrage, une carte **« Chat connecté #burri_tv »** confirme que le chat est bien lu.
5. Pour vérifier le rendu à la cam sans attendre de vrais dons : ajouter `&demo`.

La page s'adapte à toutes les résolutions et tous les formats (720p, 1366×768, 16:10, 4:3, ultra-large…) sans bandes noires : le décor s'étire (plus de ciel ou plus de mer) et les panneaux restent collés aux bords.

## Paramètres d'URL

| Paramètre | Défaut | Rôle |
|---|---|---|
| `chaine` | `burri_tv` | chaîne Twitch lue : le pseudo ou directement le lien du chat (`https://www.twitch.tv/popout/burri_tv/chat` marche) |
| `token` | — | Socket API token Streamlabs (Paramètres → API Settings → API Tokens) |
| `debut` | — | début du 24h, active le compte à rebours (ex. `2026-10-10T18:00`) |
| `duree` | `24` | durée du stream en heures |
| `objectif` | `2000` | objectif du trésor en € |
| `total` | dernier connu | force le total de départ |
| `marge` | `0` | marge de sécurité en % (ex. `4`) si la télé coupe les bords de l'image |
| `couleur` | `bleu` | ambiance de départ : `bleu`, `vert`, `violet`, `rouge`, `or`, `rose` |
| `ecran` | `tous` | qui peut utiliser `!ecran` : `tous`, `subs`, `vip`, `mods`, `off` |
| `validation` | — | `1` pour démarrer en mode validation par les modos |
| `titre` / `sous` | `Burri` / `Gamers4Pets 2026` | textes en haut à gauche |
| `msgdons` | `1` | `0` pour ne pas afficher le message des donateurs |
| `demo` | — | faux dons, emotes et messages pour tester le rendu |

⚠️ Le token Streamlabs ne doit jamais être commité : il se met uniquement dans l'URL ouverte sur la TV.

## Commandes chat

| Commande | Qui | Effet |
|---|---|---|
| `!ecran <message>` | selon `ecran=` | affiche le message sur un parchemin (80 caractères max) |
| `!couleur bleu\|vert\|violet\|rouge\|or\|rose` | tout le monde | change l'ambiance du ciel et de la mer (cooldown 15 s) |

**Réservées aux modos (et à moi)**

| Commande | Effet |
|---|---|
| `!don <pseudo> <montant> [message]` | déclenche un don à la main (dons qui ne passent pas par Streamlabs) |
| `!tresor <montant>` | recale le total affiché |
| `!testalerte` | alerte de test, ne touche pas au total |
| `!skip` | retire le message affiché |
| `!clear` | vide la file d'attente des messages |
| `!ecranoff` / `!ecranon` | coupe / rouvre `!ecran` |
| `!validation on\|off` | chaque `!ecran` attend un `!ok` (ou `!non`) d'un modo, expire après 2 min |
| `!ecranban <pseudo>` / `!ecranunban <pseudo>` | bannit de l'écran (gardé même après rechargement) |
| `!panique` / `!calme` | coupe d'un coup tout ce qui vient du chat (messages, emotes, textes des dons) |

## Anti-abus

Tout ce qui s'affiche derrière moi passe à la cam, donc :

**Filtre automatique**, appliqué à `!ecran`, aux pseudos affichés et aux messages des donateurs :
- liste d'insultes et de propos haineux FR/EN, qui résiste aux contournements (`C0NN4RD`, `c.o.n.n.a.r.d`, `s a l o p e`, `connnnnard`, accents)
- mots perso à ajouter dans `motsInterdits`, en haut du script (`'mot*'` = tout ce qui commence par ça)
- bloqués : liens (même « point tv »), @mentions, mails, numéros de téléphone, ASCII art, spam d'emojis
- nettoyés : texte zalgo, caractères invisibles, messages en MAJUSCULES, lettres répétées
- un pseudo ou un message de don refusé s'affiche en « Un matelot », sans message

**Règles de `!ecran`** : pas pour un tout premier message sur la chaîne, 3 messages dans le chat avant d'y avoir droit (sauf VIP et modos), cooldown de 60 s, 3 s de délai avant affichage, 2 messages refusés = bloqué 30 min. Le message disparaît si un modo le supprime ou timeout/ban son auteur.

**Pluie d'emotes** : 12 max par personne toutes les 10 s, rien pour les premiers messages.

AutoMod de Twitch reste la première barrière : un message retenu par AutoMod n'arrive jamais jusqu'à l'écran.

## Dépannage

| Problème | Solution |
|---|---|
| Carte « Chat injoignable » | vérifier la connexion internet de la box ; la page réessaie toute seule |
| Rien ne se passe avec `!ecran` | il faut avoir écrit 3 messages avant (sauf modos/VIP) ; vérifier que `ecran=` n'est pas sur `off` |
| Les bords de l'image sont coupés | ajouter `&marge=4` (ou plus) à l'URL |
| Pas d'alerte de don | vérifier le `token` Streamlabs dans l'URL ; en dépannage, les modos ont `!don` |
| Le total est faux | `!tresor <montant>` pour le recaler |
| Les emotes BTTV / 7TV ne tombent pas | normal : seules les emotes Twitch sont prises en charge |

## Technique

- Un seul fichier `index.html`, sans build.
- Chat lu en direct via la connexion officielle de Twitch (anonyme, lecture seule), sans compte ni librairie externe.
- Dons, subs, bits et follows via la Socket API Streamlabs.
- Scène dessinée en 1920×1080 puis étirée selon le format de l'écran.
