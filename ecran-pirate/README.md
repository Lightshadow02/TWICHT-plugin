# Écran Pirate 🏴‍☠️

Page plein écran pour l'écran derrière moi en stream (Android TV / Freebox), pensée pour Gamers4Pets 2026.
Une scène de mer de nuit avec un coffre au trésor qui se remplit avec les dons, les emotes du chat qui tombent dans la mer, les messages des viewers sur un parchemin et le chrono du 24h.

Look repris de la maquette Claude Design « Écran Pirate » (au repos, alerte don, message `!ecran`).

## Ce que ça fait

- **Ma cagnotte G4P en direct** : lue sur l'API officielle Gamers4Pets toutes les 10 s. L'or du coffre monte vers l'objectif (2 000 € par défaut).
- **Alertes** : don G4P, sub, subs offerts, bits ou raid → le décor s'assombrit, un parchemin tombe avec le pseudo et le montant dans un sceau de cire, et des pièces jaillissent du coffre.
- **Pluie d'emotes** : chaque emote Twitch du chat tombe dans la mer.
- **Messages viewers** : `!ecran` affiche le message sur un parchemin qui se déroule.
- **Chrono** : compte à rebours du 24h (ou l'heure s'il n'y a pas de date de début).
- **Dernier butin** : carte avec le dernier donateur G4P.
- **Bandeau G4P** : le prochain palier et la cagnotte globale G4P (avec celle de la team) passent dans le bandeau du bas.
- **Follows** (si token Streamlabs) : une carte « Nouveau matelot » glisse sur le côté.
- **Bandeau** : fait tourner les commandes et infos en bas de l'écran.
- **Décor animé** : vagues, bateau qui passe, drapeau et palmier au vent, étoiles, reflet de la lune.

Le dernier butin, les dons déjà annoncés et les bannis sont gardés dans le navigateur de la TV : ils survivent à un rechargement.

## D'où viennent les infos

| Info | Source | Réglage |
|---|---|---|
| Cagnotte, paliers, total G4P | [API Gamers4Pets](https://streamers.gamers4pets.fr/api-doc) (officielle, sans clé) | rien à faire |
| Alertes de dons | derniers dons de l'API Gamers4Pets | rien à faire (quelques secondes de décalage) |
| Subs, subs offerts, bits, raids | chat Twitch | rien à faire |
| Messages `!ecran`, emotes, commandes | chat Twitch | rien à faire |
| Follows | Streamlabs | `&token=` (facultatif) |

Le lien de l'alert box Streamlabs (`streamlabs.com/alert-box/v3/…`) ne peut pas servir ici : Streamlabs refuse que sa connexion soit lue depuis un autre site. C'est pour ça que les dons passent par l'API Gamers4Pets. Ce lien contient un token privé, il ne doit pas être mis sur GitHub.

## Installation

1. Déposer le dossier `ecran-pirate/` sur l'hébergement web (FTP ou gestionnaire de fichiers) → `https://ton-domaine/ecran-pirate/`.
   Le fichier ne contient aucun secret : le token Streamlabs se met seulement dans l'URL ouverte sur la TV.
2. Sur la Freebox, installer **Fully Kiosk Browser** depuis le Play Store.
3. Start URL → `https://ton-domaine/ecran-pirate/`, puis activer le lancement au démarrage et « garder l'écran allumé ». Aucun paramètre n'est obligatoire.
4. Au démarrage, deux cartes confirment que tout est branché : **« Chat connecté #burri_tv »** et **« Gamers4Pets connecté »**.
5. Pour vérifier le rendu à la cam sans attendre de vrais dons : ajouter `&demo`.

La page s'adapte à toutes les résolutions et tous les formats (720p, 1366×768, 16:10, 4:3, ultra-large…) sans bandes noires : le décor s'étire (plus de ciel ou plus de mer) et les panneaux restent collés aux bords.

## Paramètres d'URL

| Paramètre | Défaut | Rôle |
|---|---|---|
| `chaine` | `burri_tv` | chaîne Twitch lue : le pseudo ou directement le lien du chat (`https://www.twitch.tv/popout/burri_tv/chat` marche) |
| `cagnotte` | `perso` | `perso` = ma cagnotte · `global` = toute la cagnotte Gamers4Pets |
| `g4p` | = `chaine` | pseudo Twitch lu sur l'API Gamers4Pets ; `0` pour couper l'API et revenir au comptage local |
| `token` | — | facultatif : Socket API token Streamlabs (Paramètres → API Settings → API Tokens → *Socket API Token*), pour les follows |
| `debut` | — | début du 24h, active le compte à rebours (ex. `2026-10-10T18:00`) |
| `duree` | `24` | durée du stream en heures |
| `objectif` | `2000` | objectif du coffre en € (`0` pour le masquer ; en mode `global`, masqué par défaut et remplacé par le score des teams) |
| `total` | dernier connu | total de départ en comptage local (`g4p=0`) |
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
| `!don <pseudo> <montant> [message]` | déclenche une alerte de don à la main (la cagnotte, elle, vient de l'API G4P) |
| `!tresor <montant>` | force le montant affiché jusqu'au prochain changement de la cagnotte G4P |
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
| Carte « Cagnotte injoignable » | le site streamers.gamers4pets.fr ne répond pas ; la page réessaie toute seule |
| Carte « Inconnu sur Gamers4Pets » | le pseudo n'est pas inscrit à l'événement : vérifier `g4p=` |
| Pas d'alerte de don | les dons arrivent avec quelques secondes de décalage (le temps que le site G4P les enregistre) ; en dépannage, les modos ont `!don` |
| Le montant est faux | c'est celui de la page streamers.gamers4pets.fr/streamer/burri_tv ; au pire `!tresor <montant>` |
| Les emotes BTTV / 7TV ne tombent pas | normal : seules les emotes Twitch sont prises en charge |

## Technique

- Un seul fichier `index.html`, sans build.
- Chat lu en direct via la connexion officielle de Twitch (anonyme, lecture seule), sans compte ni librairie externe.
- Cagnotte, paliers et dons via l'API Gamers4Pets (`/api/v1`), interrogée toutes les 10 s en respectant son quota.
- Subs, bits et raids via le chat Twitch ; follows via la Socket API Streamlabs (facultatif).
- Scène dessinée en 1920×1080 puis étirée selon le format de l'écran.
