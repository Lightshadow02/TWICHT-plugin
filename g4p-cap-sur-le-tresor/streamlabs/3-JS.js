/* ============================================================
   G4P · TEAM CHIEN — "Cap sur le trésor" (widget Objectif Streamlabs)
   Montant + objectif : viennent de Streamlabs.
   Paliers, gages récurrents, devise… : onglet "Champs personnalisés".
   ============================================================ */

const $ = id => document.getElementById(id);

// Lecture des champs personnalisés (un champ non rempli reste "{nom}" → ignoré)
const CFG = {};
document.querySelectorAll("#config [data-k]").forEach(el => {
  const v = el.textContent.trim();
  CFG[el.dataset.k] = /^\{\w+\}$/.test(v) ? "" : v;
});

const DEVISE = CFG.devise || "€";
// Objectif forcé : s'il est rempli, il remplace celui envoyé par Streamlabs
const OBJ_FORCE = parseFloat(String(CFG.objectif || "").replace(/\s/g, "").replace(",", ".")) || 0;
const REGULIERE = (CFG.echelle || "reguliere") !== "proportionnelle";
const fmt = n => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

// "100 = Texte" ou "100€ - Texte", séparés par |
function parser(txt) {
  return String(txt || "").split(/\||\n/).map(l => {
    const m = l.match(/^\s*(\d+(?:[.,]\d+)?)\s*€?\s*[:=\-–]\s*(.+?)\s*$/);
    return m ? { montant: parseFloat(m[1].replace(",", ".")), texte: m[2] } : null;
  }).filter(Boolean).sort((a, b) => a.montant - b.montant);
}
const PALIERS = parser(CFG.paliers);
const RECURRENTS = parser(CFG.recurrents).filter(r => r.montant > 0);

let etat = { titre: "", actuel: 0, objectif: OBJ_FORCE || 1 };
let affiche = 0, anim = null, nbAvant = null, compteAvant = {};

function compter(cible) {
  cancelAnimationFrame(anim);
  const depart = affiche, t0 = performance.now(), duree = 1400;
  const pas = t => {
    const k = Math.min(1, (t - t0) / duree), e = 1 - Math.pow(1 - k, 3);
    affiche = depart + (cible - depart) * e;
    $("actuel").textContent = fmt(Math.round(affiche * 100) / 100) + " " + DEVISE;
    if (k < 1) anim = requestAnimationFrame(pas);
  };
  anim = requestAnimationFrame(pas);
}

// Position (0-100 %) d'un montant sur la route
function position(v, obj, visibles) {
  v = Math.max(0, Math.min(v, obj));
  if (!REGULIERE) return v / obj * 100;
  const n = [0, ...visibles.map(p => p.montant), obj];   // escales espacées régulièrement
  for (let i = 0; i < n.length - 1; i++) {
    if (v <= n[i + 1]) return (i + (v - n[i]) / (n[i + 1] - n[i])) / (n.length - 1) * 100;
  }
  return 100;
}

const drapeau = '<svg viewBox="0 0 26 40"><line x1="6" y1="2" x2="6" y2="34" stroke="#c9d9c9" stroke-width="2"/>' +
  '<path class="fanion" d="M7 3 L24 9 L7 15 Z"/><ellipse cx="6" cy="34" rx="6" ry="4" fill="#c0392b"/>' +
  '<rect x="0" y="32" width="12" height="2.5" fill="#fff"/></svg>';

function rendre() {
  const obj = Math.max(1, etat.objectif);
  const complet = etat.actuel >= obj;
  const visibles = PALIERS.filter(p => p.montant > 0 && p.montant < obj);
  const pct = position(etat.actuel, obj, visibles);

  $("titre").textContent = etat.titre || CFG.titre || "Cap sur le trésor";
  $("total").textContent = fmt(obj) + " " + DEVISE;
  $("navire").style.left = pct + "%";
  $("parcouru").style.width = pct + "%";
  compter(etat.actuel);

  // Bouées : on met en avant le dernier palier atteint et les 3 suivants
  const iSuivant = visibles.findIndex(p => p.montant > etat.actuel);
  const debut = iSuivant === -1 ? visibles.length - 1 : iSuivant - 1;
  const b = $("bouees"), et = $("etiquettes");
  b.innerHTML = ""; et.innerHTML = "";
  visibles.forEach((p, i) => {
    const pos = position(p.montant, obj, visibles), ok = etat.actuel >= p.montant;
    const proche = visibles.length <= 6 || (i >= debut && i <= debut + 3);
    const d = document.createElement("div");
    d.className = "bouee" + (ok ? " atteint" : "") + (proche ? "" : " mini");
    d.style.left = pos + "%";
    d.style.animationDelay = (-i * 0.7) + "s";
    d.innerHTML = drapeau;
    b.appendChild(d);
    const e = document.createElement("span");
    e.className = "etiquette" + (ok ? " atteint" : "") + (proche ? "" : " cachee");
    e.style.left = pos + "%";
    e.textContent = fmt(p.montant) + " " + DEVISE;
    et.appendChild(e);
  });

  // Texte du bas
  const suivant = PALIERS.find(p => p.montant > etat.actuel && p.montant <= obj);
  const txt = $("prochain");
  txt.textContent = "";
  const gold = s => { const g = document.createElement("span"); g.className = "gold"; g.textContent = s; return g; };
  if (complet) {
    txt.append(gold("Trésor trouvé ! "), CFG.fin || "Merci à tout l'équipage 🐾");
  } else if (suivant) {
    txt.append("Prochaine escale · ", gold(fmt(suivant.montant) + " " + DEVISE), " — " + suivant.texte);
  } else {
    txt.append("Plus que ", gold(fmt(obj - etat.actuel) + " " + DEVISE), " avant le trésor");
  }

  // Compteurs de gages récurrents ("tous les 10 €…")
  const zone = $("compteurs");
  zone.innerHTML = "";
  RECURRENTS.forEach(r => {
    const n = Math.floor(etat.actuel / r.montant);
    const c = document.createElement("span");
    c.className = "compteur";
    c.append(r.texte + " ");
    const v = document.createElement("b"); v.textContent = "×" + n; c.append(v);
    if (compteAvant[r.texte] !== undefined && n > compteAvant[r.texte]) c.classList.add("pop");
    compteAvant[r.texte] = n;
    zone.appendChild(c);
  });

  const cadre = $("cadre");
  cadre.classList.toggle("complet", complet);
  const nb = PALIERS.filter(p => etat.actuel >= p.montant).length + (complet ? 1 : 0);
  if (nbAvant !== null && nb > nbAvant) {
    cadre.style.setProperty("--fx", (5 + pct * 0.8) + "%");
    cadre.classList.remove("flash"); void cadre.offsetWidth; cadre.classList.add("flash");
  }
  nbAvant = nb;
}

function lire(d) {
  if (!d) return;
  if (d.title !== undefined) etat.titre = d.title;
  if (d.amount) {
    if (d.amount.current !== undefined) etat.actuel = parseFloat(d.amount.current) || 0;
    if (d.amount.target !== undefined) etat.objectif = parseFloat(d.amount.target) || 1;
  }
  if (OBJ_FORCE > 0) etat.objectif = OBJ_FORCE;
  rendre();
}

document.addEventListener("goalLoad", e => lire(e.detail));   // chargement du widget
document.addEventListener("goalEvent", e => lire(e.detail));  // nouveau don

rendre();
