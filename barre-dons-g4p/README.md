# Barre de dons G4P 2026 — Team Chat (Burri_TV)

Barre d'objectifs de dons pour l'event **Gamers4Pets 2026** (29 sept → 4 oct), thème pirate, jaune Team Chat.
Branchée sur les dons **Streamlabs Charity**.

## Contenu

```
barre-dons-g4p/
├── streamlabs/          ← version à utiliser pendant l'event
│   ├── goal.html        onglet HTML du widget
│   ├── goal.css         onglet CSS
│   ├── goal.js          onglet JS (paliers + config)
│   └── test-barre.html  page de test avec simulateur de dons
├── obs-local/           ← plan B sans Streamlabs (montant à la main)
│   ├── barre-dons-g4p.html
│   └── montant.txt
└── apercus/             captures du rendu
```

## Installation (Streamlabs Charity)

1. Dashboard Streamlabs → **All Widgets** → section Goals → **Streamlabs Charity Donation Goal**.
2. Active le code perso (Custom HTML/CSS) et colle :
   - `goal.html` → onglet **HTML**
   - `goal.css` → onglet **CSS**
   - `goal.js` → onglet **JS**
3. Enregistre, copie l'URL du widget.
4. OBS → Sources → **Navigateur** → colle l'URL. Taille : **1640 × 280**.

## Tester avant le live

Double-clique sur `streamlabs/test-barre.html`. La barre de contrôle en bas simule Streamlabs :

| Bouton | Effet |
|---|---|
| Charger (goalLoad) | met la barre au montant tapé, sans animation (= ouverture du widget) |
| +1 / +5 / +10 / +50 / +100 | simule un don |
| Champ € + Envoyer | don d'un montant précis |
| Palier suivant | envoie pile ce qu'il faut pour débloquer le prochain palier |
| Objectif atteint | monte au montant de l'objectif |
| Remise à zéro | repart de 0 € |

⚠️ La page de test embarque une copie du code. Si tu modifies `goal.js`, la page de test ne suit pas : il faut la régénérer.

## Modifier les paliers

Tout est dans le bloc `CONFIG` en haut de `goal.js` :

```js
{ m: 1150, t: "Je fais un stream une nuit seul en forêt" },
{ m: 1500, cache: true, revele: "" },
```

- `m` : montant du palier
- `t` : texte affiché
- `cache: true` : palier caché (« Palier caché… surprise ! »)
- `revele` : texte montré au déblocage d'un palier caché (vide = « Palier caché débloqué ! »)

Autres réglages : `kmTousLes` (1 km tous les 10 €), `dureeCelebration` (8 s), `paliersVisibles` (2 paliers à venir sur la barre).

## Ce que fait la barre

- Montant qui défile à chaque don
- Barre du dernier palier atteint aux 2 suivants, prochain palier en jaune
- Texte du prochain palier (défile s'il est trop long)
- Compteur « X km à marcher »
- Bandeau « Palier débloqué » + pluie de pièces quand un palier est franchi (3 max d'affilée si un gros don en passe plusieurs)

## Dépannage

**La barre reste à 0 € alors qu'il y a des dons** : dans OBS, clic droit sur la source → **Interagir** → F12 → onglet Console. Récupère la ligne `[G4P] goalLoad` : elle montre le format exact envoyé par Streamlabs, il suffit d'adapter la fonction `lireMontant` dans `goal.js`.

**Les polices ne s'affichent pas** : elles viennent de Google Fonts (Germania One + Montserrat), il faut que le PC ait internet.

## Plan B : obs-local (sans Streamlabs)

Si Streamlabs pose problème, `obs-local/barre-dons-g4p.html` marche seul :

1. OBS → Navigateur → coche **Fichier local** → choisis le `.html`. Taille 1640 × 280.
2. Pour changer le montant :
   - écris le montant dans `montant.txt` (ex. `347.50`), relu toutes les 5 s ;
   - ou clic droit sur la source → **Interagir** → clic sur le montant → tape → Entrée.

Options d'URL (dans un navigateur) : `?demo=1` (dons aléatoires), `?test=400` (affiche le bandeau d'un palier), `?montant=250`.

Attention : les paliers de cette version sont dans son propre bloc `CONFIG`, séparé de `goal.js`.
