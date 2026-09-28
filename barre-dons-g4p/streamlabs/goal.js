/* Widget Streamlabs « Objectif de dons » — onglet JS */
/* =====================================================================
   CONFIGURATION — à modifier ici
   ===================================================================== */
const CONFIG = {
  kmTousLes: 10,             // 1 km tous les 10 €
  dureeCelebration: 8000,    // ms d'affichage d'un palier débloqué
  paliersVisibles: 2,        // nb de paliers à venir affichés sur la barre
  paliers: [
    { m: 1,     t: "Je balance un fait random sur les animaux à chaque palier" },
    { m: 11.19, t: "Je joue à STRAY" },
    { m: 20,    t: "J'adopte un chat / 20 € (sur Minecraft)" },
    { m: 35,    t: "Je fais une cover d'une chanson de Goldman" },
    { m: 50,    cache: true, revele: "" },
    { m: 75,    t: "Tier list des chauves" },
    { m: 100,   t: "Je refais gratuitement les photos de profil des animaux d'une SPA" },
    { m: 150,   t: "Je fais une vidéo narration (style EGO etc.)" },
    { m: 250,   t: "Vidéo longue sur les animaux (avec sensibilisation)" },
    { m: 300,   t: "J'offre 1 mug Burri (exclu) aux 2 meilleurs donateurs*" },
    { m: 400,   t: "Je reproduis ma DA en direct sous Paint en 20 min chrono (je la garde 1 semaine / 200 €)" },
    { m: 500,   t: "Je rase à blanc les cheveux de mon frère (en live)" },
    { m: 600,   t: "React docu animalier" },
    { m: 750,   cache: true, revele: "" },
    { m: 1000,  t: "Je reposte mes anciennes vidéos YTB" },
    { m: 1150,  t: "Je fais un stream une nuit seul en forêt" },
    { m: 1300,  t: "Je me fais une teinture de cheveux jaune" },
    { m: 1500,  cache: true, revele: "" },
    { m: 1700,  t: "Je deviens bénévole pour la SPA pendant mes prochaines vacances" },
    { m: 1800,  cache: true, revele: "" },
    { m: 2000,  t: "Je fais Strasbourg – Lure en live à pied" },
    { m: 2500,  t: "Je m'engage à faire les donation goals non respectés des événements précédents" },
    { m: 5000,  t: "Je rase la barbe de mon frère" }
  ]
};
/* ===================================================================== */

const $ = id => document.getElementById(id);
const P = CONFIG.paliers.slice().sort((a,b)=>a.m-b.m);

const fmt = n => n.toLocaleString("fr-FR", {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2}).replace(/[\u202f\u00a0]/g, "\u00a0") + "\u00a0€";
const txtPalier = (p, atteint) => p.cache ? (atteint ? (p.revele || "Palier caché débloqué !") : "Palier caché… surprise !") : p.t;

let montant = null, affiche = 0, anim = null;

function tweenMontant(cible){
  cancelAnimationFrame(anim);
  const debut = affiche, t0 = performance.now(), d = 1400;
  const pas = now => {
    const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3);
    affiche = debut + (cible - debut) * e;
    $("montant").textContent = fmt(Math.round(affiche * 100) / 100);
    if (k < 1) anim = requestAnimationFrame(pas); else { affiche = cible; $("montant").textContent = fmt(cible); }
  };
  anim = requestAnimationFrame(pas);
}

function rendu(){
  const atteints = P.filter(p => montant >= p.m);
  const avenir = P.filter(p => montant < p.m);
  const debut = atteints.length ? atteints[atteints.length - 1].m : 0;
  const fenetre = avenir.slice(0, CONFIG.paliersVisibles);
  const fin = fenetre.length ? fenetre[fenetre.length - 1].m : P[P.length - 1].m;
  const pct = fenetre.length ? Math.max(0, Math.min(1, (montant - debut) / (fin - debut))) : 1;

  $("remplissage").style.width = (pct * 100) + "%";
  $("curseur").style.left = `calc(${pct * 100}% )`;

  const mq = $("marqueurs"), et = $("etiquettes");
  mq.innerHTML = ""; et.innerHTML = "";
  const lab = (txt, cls, left) => { const s = document.createElement("span"); s.className = "etiquette " + cls; s.textContent = txt; if (left != null) s.style.left = left; et.appendChild(s); };
  lab(fmt(debut), "debut");
  fenetre.forEach((p, i) => {
    const x = (p.m - debut) / (fin - debut) * 100;
    if (i < fenetre.length - 1) { const d = document.createElement("div"); d.className = "marqueur"; d.style.left = x + "%"; mq.appendChild(d); }
    lab(fmt(p.m), (i === 0 ? "prochain " : "") + (i === fenetre.length - 1 ? "fin" : ""), i === fenetre.length - 1 ? "100%" : x + "%");
  });

  const obj = $("obj"), lbl = $("lbl");
  let html, cache = false;
  if (fenetre.length) {
    const p = fenetre[0];
    lbl.textContent = "Prochain palier";
    html = `<b>${fmt(p.m)}</b> · ${esc(txtPalier(p, false))}`;
    cache = !!p.cache;
  } else {
    lbl.textContent = "Incroyable";
    html = `<b>Tous les paliers sont débloqués !</b> Merci l'équipage !`;
  }
  if (obj.dataset.h !== html) {
    obj.innerHTML = `<span class="defil">${html}</span>`; obj.dataset.h = html;
    requestAnimationFrame(() => { const sp = obj.firstChild, dx = sp.scrollWidth - obj.clientWidth + 30;
      sp.classList.toggle("anim", dx > 30); sp.style.setProperty("--dx", -dx + "px"); sp.style.setProperty("--d", Math.max(10, dx / 25) + "s"); });
    obj.classList.toggle("cache", cache);
    obj.classList.remove("fondu"); void obj.offsetWidth; obj.classList.add("fondu");
  }
  $("km").textContent = Math.floor(montant / CONFIG.kmTousLes);
}

function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

/* --- célébrations --- */
const file = []; let enCours = false;
function celebrer(p){ file.push(p); if (!enCours) suivante(); }
function suivante(){
  const p = file.shift();
  if (!p) { enCours = false; return; }
  enCours = true;
  $("celebSomme").textContent = fmt(p.m);
  const t = $("celebTexte"); t.textContent = txtPalier(p, true); t.classList.toggle("cache", !!p.cache);
  t.style.fontSize = t.textContent.length > 70 ? "34px" : t.textContent.length > 45 ? "40px" : "46px";
  const c = $("celeb"); c.classList.remove("on"); void c.offsetWidth; c.classList.add("on");
  pluie();
  setTimeout(() => { c.classList.remove("on"); setTimeout(suivante, 700); }, CONFIG.dureeCelebration);
}
function pluie(){
  const z = $("pluie");
  for (let i = 0; i < 34; i++) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("class", "p");
    s.innerHTML = '<use href="#piece"/>';
    const x0 = 180 + Math.random() * 1400, sz = 18 + Math.random() * 20;
    s.style.width = s.style.height = sz + "px";
    s.style.left = x0 + "px"; s.style.top = "-40px";
    z.appendChild(s);
    const dx = (Math.random() - .5) * 160, rot = (Math.random() - .5) * 900;
    s.animate([
      { transform: "translate(0,0) rotate(0)", opacity: 1 },
      { transform: `translate(${dx}px, 340px) rotate(${rot}deg)`, opacity: .9 }
    ], { duration: 1600 + Math.random() * 1400, delay: Math.random() * 900, easing: "cubic-bezier(.4,.1,.7,1)", fill: "both" })
     .onfinish = () => s.remove();
  }
}

/* --- mise à jour du montant --- */
function setMontant(v){
  v = Math.round(parseFloat(String(v).replace(",", ".").replace(/[^\d.\-]/g, "")) * 100) / 100;
  if (!isFinite(v) || v < 0) return;
  if (montant !== null && v > montant) {
    let franchis = P.filter(p => p.m > montant && p.m <= v);
    if (franchis.length > 3) franchis = franchis.slice(-3);
    franchis.forEach(celebrer);
  }
  if (v === montant) return;
  montant = v;
  tweenMontant(v);
  rendu();
}

/* --- branchement Streamlabs ---
   goalLoad  : au chargement du widget (montant actuel, pas d'animation de palier)
   goalEvent : à chaque don                                                   */
// Compatible widget « Objectif de dons » classique ET « Streamlabs Charity Donation Goal »
const lireMontant = d => {
  if (!d) return 0;
  const brut = (d.amount && typeof d.amount === "object") ? d.amount.current
    : d.amount ?? d.current_amount ?? d.current ?? (d.goal && d.goal.current) ?? 0;
  return parseFloat(String(brut).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
};

document.addEventListener("goalLoad", obj => {
  console.log("[G4P] goalLoad", obj.detail);
  montant = null;
  setMontant(lireMontant(obj.detail));
});
document.addEventListener("goalEvent", obj => {
  console.log("[G4P] goalEvent", obj.detail);
  setMontant(lireMontant(obj.detail));
});

setMontant(0);
