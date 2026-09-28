/*
  Carte au trésor — serveur
  ---------------------------------------------------------------
  - sert l'overlay (OBS) et la page d'admin
  - écoute le chat Twitch (lecture anonyme, aucun token nécessaire)
  - reçoit les dons : Streamlabs (socket), webhook générique, ou
    messages d'un bot dans le chat (regex configurable)
  - sauvegarde tout dans data/state.json à chaque changement
  ---------------------------------------------------------------
*/

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const tmi = require('tmi.js');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const DEFAULT_CONFIG_FILE = path.join(__dirname, 'config.default.json');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1'; // 0.0.0.0 pour ouvrir au réseau local

// ---------------------------------------------------------------
// Chargement config / état
// ---------------------------------------------------------------
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

let config = readJson(CONFIG_FILE, null);
if (!config) {
  config = readJson(DEFAULT_CONFIG_FILE, {});
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log('[config] config.json créé depuis config.default.json');
}

function statsVides() { return { dons: 0, nbDons: 0, nbRev: 0, gages: [], tresor: null, piratesDelta: {}, capitaine: [], donateurs: {} }; }
function freshState() {
  return {
    revealed: {},          // "B7": { type, label, value, at, by, how }
    round: null,           // { candidates:[], votes:{user:cell}, bonus:{cell:n}, endsAt, number }
    roundCount: 0,
    totals: { dons: 0, km: 0, doublons: 0, nbDons: 0, kmRemise: 0 },
    effets: { brouillard: false, mancheCourte: false, seuilDoubleJusqu: 0 },
    pirates: {},           // classement : login → { nom, doublons, cases }
    dettes: [],            // gages en attente { id, text, cell, at, by, done, quand }
    dons: [],              // 30 derniers dons
    journal: [],           // 80 derniers événements
    tresorTrouve: false,
    pause: false,
    carte: { numero: 1, depuis: Date.now(), dernierResetJour: null, stats: statsVides() },
    cartesPrecedentes: [],  // archives { numero, depuis, jusqu, nbRevelees, tresorTrouve, doublons }
    createdAt: Date.now()
  };
}

let state = readJson(STATE_FILE, null) || freshState();
// compat : état créé par une version sans cartes multiples
if (!state.pirates) state.pirates = {};
if (state.carte && !state.carte.stats) state.carte.stats = statsVides();
if (!state.effets) state.effets = { brouillard: false, mancheCourte: false, seuilDoubleJusqu: 0 };
if (state.totals.kmRemise == null) state.totals.kmRemise = 0;
if (!state.carte) { state.carte = { numero: 1, depuis: state.createdAt || Date.now(), dernierResetJour: null, stats: statsVides() }; state.cartesPrecedentes = []; }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STATE_FILE);
  }, 150);
}
function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ---------------------------------------------------------------
// Grille : helpers
// ---------------------------------------------------------------
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function colLetter(i) { return LETTERS[i]; }
function allCells() {
  const out = [];
  for (let r = 0; r < config.grille.rows; r++)
    for (let c = 0; c < config.grille.cols; c++)
      out.push(colLetter(c) + (r + 1));
  return out;
}
function cellDef(id) {
  return config.cellules[id] || { type: 'sable' };
}
function parseCell(txt) {
  if (!txt) return null;
  const m = String(txt).toUpperCase().match(/\b([A-Z])\s*-?\s*(\d{1,2})\b/);
  if (!m) return null;
  const col = LETTERS.indexOf(m[1]);
  const row = Number(m[2]);
  if (col < 0 || col >= config.grille.cols || row < 1 || row > config.grille.rows) return null;
  return m[1] + row;
}
function unrevealed() {
  return allCells().filter(c => !state.revealed[c]);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------
// Journal + diffusion WebSocket
// ---------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
}
function log(type, text, extra = {}) {
  const entry = { type, text, at: Date.now(), ...extra };
  state.journal.unshift(entry);
  state.journal = state.journal.slice(0, 80);
  console.log(`[${type}] ${text}`);
  broadcast({ ev: 'journal', entry });
}
function pushState() {
  save();
  broadcast({ ev: 'state', state: publicState(), config: publicConfig() });
}
function publicConfig() {
  // on n'envoie jamais les secrets à l'overlay
  const { streamlabs, bot, ...rest } = config;
  return { ...rest, streamlabs: { connecte: !!streamlabs?.socketToken }, bot: { actif: !!bot?.oauth } };
}
function publicState() {
  const s = JSON.parse(JSON.stringify(state));
  if (s.round) {
    // compte des votes par case (votes chat + bonus dons)
    const counts = {};
    for (const c of s.round.candidates) counts[c] = 0;
    for (const [u, v] of Object.entries(s.round.votes)) counts[v.cell] = (counts[v.cell] || 0) + poidsVote(u);
    for (const [cell, n] of Object.entries(s.round.bonus)) counts[cell] = (counts[cell] || 0) + n;
    s.round.counts = counts;
    s.round.nbVotants = Object.keys(s.round.votes).length;
    if (s.round.brouillard) { s.round.countsCaches = true; for (const k of Object.keys(counts)) counts[k] = '?'; }
    delete s.round.votes; // pas besoin d'envoyer les pseudos
  }
  s.seuilActuel = seuilActuel();
  s.top = classement(5);
  s.second = second() ? state.pirates[second()].nom : null;
  delete s.pirates; // pas besoin du dictionnaire complet côté overlay
  return s;
}

// ---------------------------------------------------------------
// Manches
// ---------------------------------------------------------------
function countsReels() {
  const r = state.round; const counts = {};
  if (!r) return counts;
  for (const c of r.candidates) counts[c] = 0;
  for (const [u, v] of Object.entries(r.votes)) counts[v.cell] = (counts[v.cell] || 0) + poidsVote(u);
  for (const [cell, n] of Object.entries(r.bonus)) counts[cell] = (counts[cell] || 0) + n;
  return counts;
}
function seuilActuel() {
  const base = config.dons.seuilCreuseImmediat;
  return state.roundCount < (state.effets?.seuilDoubleJusqu || 0) ? base * 2 : base;
}
function startRound() {
  const pool = unrevealed();
  if (pool.length === 0) {
    state.round = null;
    log('info', 'Toute la carte est révélée. Fin de la chasse !');
    pushState();
    return;
  }
  const n = Math.min(config.round.candidats, pool.length);
  const candidates = config.round.voteLibre ? pool : shuffle([...pool]).slice(0, n);
  state.roundCount += 1;
  const e = state.effets;
  let duree = config.round.dureeSec;
  if (e.mancheCourte) { duree = Math.max(20, Math.round(duree / 2)); e.mancheCourte = false; }
  const brouillard = !!e.brouillard; e.brouillard = false;
  state.round = {
    number: state.roundCount,
    candidates,
    votes: {},
    bonus: {},
    brouillard,
    dureeSec: duree,
    endsAt: Date.now() + duree * 1000
  };
  log('manche', `Manche ${state.roundCount} — ${config.round.voteLibre ? 'vote libre' : 'cases : ' + candidates.join(', ')}${brouillard ? ' — BROUILLARD' : ''}${duree !== config.round.dureeSec ? ` — manche éclair ${duree}s` : ''}`);
  pushState();
}

function endRound(reason = 'timer') {
  const r = state.round;
  if (!r) return;
  const counts = countsReels();
  const entries = Object.entries(counts).filter(([c]) => !state.revealed[c]);
  const totalVotes = entries.reduce((a, [, n]) => a + n, 0);

  if (totalVotes < config.round.minVotes) {
    if (config.round.autoCreuseSiVide) {
      const cell = shuffle(entries.map(([c]) => c))[0] || shuffle(unrevealed())[0];
      log('info', `Personne à bord… le perroquet creuse en ${cell}`);
      reveal(cell, { by: 'Le perroquet', how: 'auto' });
    } else {
      r.prolongations = (r.prolongations || 0) + 1;
      if (r.prolongations === 1) log('info', 'Personne ne vote : la manche est prolongée, aucune case ne sera creusée sans vote');
      r.endsAt = Date.now() + (r.dureeSec || config.round.dureeSec) * 1000;
      pushState();
      return;
    }
  } else {
    const max = Math.max(...entries.map(([, n]) => n));
    const winners = entries.filter(([, n]) => n === max).map(([c]) => c);
    const cell = shuffle(winners)[0];
    // qui a voté pour cette case ? (pour le crédit à l'écran)
    const voters = [...new Set([...Object.values(r.votes).filter(v => v.cell === cell).map(v => v.nom), ...((r.bonusPar || {})[cell] || [])])];
    reveal(cell, { by: voters.length ? `${voters.length} votant${voters.length > 1 ? 's' : ''}` : 'les dons', how: reason, votes: max, voters });
  }
  // pause entre deux manches (temps de lire la révélation)
  state.round = null;
  pushState();
  setTimeout(() => { if (!state.round && !state.pause) startRound(); }, (config.round.pauseSec || 12) * 1000);
}

// ---------------------------------------------------------------
// Révélation d'une case
// ---------------------------------------------------------------
function reveal(cell, meta = {}) {
  if (state.revealed[cell]) return null;
  const secondAvant = second();
  const def = { ...cellDef(cell) };
  const rec = { ...def, at: Date.now(), by: meta.by || '?', how: meta.how || 'vote' };
  // qui récolte / paie : les votants de la case, ou le donateur qui l'a creusée
  const gagnants = meta.voters?.length ? meta.voters : (meta.how === 'don' && meta.by ? [meta.by] : []);
  if (def.type === 'indice' && !def.label) rec.label = indiceAuto();
  state.revealed[cell] = rec;

  switch (def.type) {
    case 'doublons':
      state.totals.doublons += Number(def.value || 0);
      crediter(gagnants, Number(def.value || 0), cell);
      if (gagnants.length) rec.gagnants = gagnants.slice(0, 6);
      break;
    case 'gage':
      if (def.duo) rec.label = gageDuoTexte(def);
      state.dettes.push({ id: Date.now(), text: rec.label, cell, at: Date.now(), by: rec.by, done: false, quand: def.quand || 'reveil', duo: !!def.duo, mode: def.mode });
      break;
    case 'piege':
      if (def.value) { state.totals.doublons = Math.max(0, state.totals.doublons - Number(def.value)); crediter(gagnants, -Number(def.value), cell); if (gagnants.length) rec.gagnants = gagnants.slice(0, 6); }
      if (def.label) state.dettes.push({ id: Date.now(), text: def.label, cell, at: Date.now(), by: rec.by, done: false, quand: def.quand || 'reveil' });
      break;
    case 'capitaine':
      rec.label = appliquerEffetCapitaine(def, cell) || def.label;
      break;
    case 'tresor':
      state.tresorTrouve = true;
      if (def.label) state.dettes.push({ id: Date.now(), text: def.label, cell, at: Date.now(), by: rec.by, done: false, quand: 'reveil', ultime: true });
      break;
  }
  { const st = state.carte.stats; st.nbRev += 1;
    if (def.type === 'gage') st.gages.push({ cell, text: rec.label, by: rec.by, at: rec.at, duo: !!def.duo });
    if (def.type === 'piege' && def.label) st.gages.push({ cell, text: rec.label, by: rec.by, at: rec.at, piege: true });
    if (def.type === 'tresor') st.tresor = { cell, by: rec.by, at: rec.at, label: def.label };
    if (def.type === 'capitaine') st.capitaine.push({ cell, text: rec.label, at: rec.at }); }
  const secondApres = second();
  if (secondApres && secondApres !== secondAvant) {
    const p = state.pirates[secondApres];
    log('info', `${p.nom} devient Second du navire (son vote compte double)`);
    broadcast({ ev: 'second', nom: p.nom });
    chatSay(`⚓ ${p.nom} prend la place de Second du navire ! Son vote compte double.`);
  }
  log('reveal', `${cell} → ${labelOf(rec)}`, { cell, rec });
  broadcast({ ev: 'reveal', cell, rec });
  chatSay(`⚓ ${cell} creusée : ${labelOf(rec)}`);
  pushState();
  return rec;
}
function labelOf(rec) {
  switch (rec.type) {
    case 'sable': return rec.label || 'rien que du sable…';
    case 'doublons': return `${rec.value} doublons !`;
    case 'gage': return `${rec.duo ? 'GAGE À DEUX 🤝' : 'GAGE'} — ${rec.label}`;
    case 'indice': return `INDICE — ${rec.label}`;
    case 'secret': return `SECRET — ${rec.label}`;
    case 'piege': return `PIÈGE — ${rec.label || ''}${rec.value ? ` (−${rec.value} doublons)` : ''}`;
    case 'tresor': return `LE TRÉSOR !!! ${rec.label || ''}`;
    case 'capitaine': return `CAPITAINE — ${rec.label || ''}`;
    case 'scelle': return 'case scellée';
    default: return rec.label || rec.type;
  }
}
// Effets des cases « Capitaine » : avantage pour le capitaine / petit malus pour le chat
const EFFETS = {
  annuleDette:   { ico: '🧹', nom: 'Amnistie',        txt: 'Le capitaine efface sa dernière dette.' },
  moinsKm:       { ico: '⛵', nom: 'Vent arrière',    txt: 'Le capitaine gagne {v} km : ils sont retirés de la dette de marche.' },
  brouillard:    { ico: '🌫️', nom: 'Brouillard',     txt: 'La prochaine manche se vote à l’aveugle : les compteurs sont cachés.' },
  mancheCourte:  { ico: '⏱️', nom: 'Manche éclair',   txt: 'La prochaine manche dure deux fois moins longtemps.' },
  perteDoublons: { ico: '🐀', nom: 'Rats dans la cale', txt: 'Le chat perd {v} doublons.' },
  seuilDouble:   { ico: '😴', nom: 'Sommeil profond', txt: 'Pendant 2 manches, il faut donner le double pour creuser directement.' },
  scelle:        { ico: '⛓️', nom: 'Marée haute',     txt: '{v} cases sont englouties : impossible de les creuser sur cette carte.' }
};
function appliquerEffetCapitaine(def, cell) {
  const e = def.effet || 'annuleDette';
  const v = Number(def.value || 0);
  const txt = (EFFETS[e]?.txt || '').replace('{v}', v);
  switch (e) {
    case 'annuleDette': {
      const d = [...state.dettes].reverse().find(x => !x.done && !x.ultime);
      if (d) { d.done = true; d.annulee = true; return `${txt} (« ${d.text.slice(0, 50)}… »)`; }
      return 'Le capitaine voulait effacer une dette… mais il n’en a aucune. Ça se paiera plus tard.';
    }
    case 'moinsKm':
      state.totals.kmRemise = (state.totals.kmRemise || 0) + (v || 1);
      recalcKm(); return txt;
    case 'brouillard': state.effets.brouillard = true; return txt;
    case 'mancheCourte': state.effets.mancheCourte = true; return txt;
    case 'perteDoublons': {
      state.totals.doublons = Math.max(0, state.totals.doublons - (v || 10));
      const top = classement()[0];
      if (top) { crediter([top.nom], -(v || 10), cell); return `Les rats pillent le plus riche : ${top.nom} perd ${v || 10} doublons.`; }
      return txt;
    }
    case 'seuilDouble': state.effets.seuilDoubleJusqu = state.roundCount + 2; return txt;
    case 'scelle': {
      const n = v || 2;
      const pool = shuffle(unrevealed().filter(c => c !== cell && cellDef(c).type !== 'tresor')).slice(0, n);
      for (const c of pool) state.revealed[c] = { type: 'scelle', at: Date.now(), by: 'la marée', how: 'effet' };
      if (state.round) state.round.candidates = state.round.candidates.filter(c => !pool.includes(c));
      return txt + ` (${pool.join(', ')})`;
    }
  }
  return txt;
}
function crediter(noms, delta, cell) {
  for (const nom of noms) {
    const k = String(nom).toLowerCase();
    const p = state.pirates[k] || (state.pirates[k] = { nom, doublons: 0, cases: 0 });
    p.nom = nom; p.doublons = Math.max(0, p.doublons + delta); if (delta > 0) p.cases += 1;
    const d = state.carte.stats.piratesDelta; d[k] = (d[k] || 0) + delta;
  }
}
function second() { return classement(1)[0]?.nom?.toLowerCase() || null; }
function poidsVote(login) { return (config.second?.voteDouble !== false && login === second()) ? 2 : 1; }
function classement(n = 5) {
  return Object.values(state.pirates).filter(p => p.doublons > 0).sort((a, b) => b.doublons - a.doublons || b.cases - a.cases).slice(0, n);
}
function recalcKm() {
  state.totals.km = Math.max(0, Math.round((state.totals.dons * config.dons.kmParEuro - (state.totals.kmRemise || 0)) * 100) / 100);
}
function indiceAuto() {
  const t = Object.entries(config.cellules).find(([, d]) => d.type === 'tresor');
  if (!t) return 'Le trésor n’est pas sur cette carte… bizarre.';
  const col = LETTERS.indexOf(t[0][0]);
  const row = Number(t[0].slice(1));
  const opts = [
    `Le trésor est sur une ligne ${row % 2 ? 'impaire' : 'paire'}.`,
    `Le trésor est dans la moitié ${col < config.grille.cols / 2 ? 'ouest (gauche)' : 'est (droite)'} de la carte.`,
    `Le trésor est dans la moitié ${row <= config.grille.rows / 2 ? 'nord (haut)' : 'sud (bas)'} de la carte.`,
    `Le trésor est sur une colonne ${col % 2 ? 'paire' : 'impaire'} (A=1).`,
    `Le trésor n’est pas sur les bords de la carte.`
  ];
  const givenAlready = Object.values(state.revealed).filter(r => r.type === 'indice').map(r => r.label);
  const fresh = opts.filter(o => !givenAlready.includes(o));
  return (fresh.length ? fresh : opts)[Math.floor(Math.random() * (fresh.length || opts.length))];
}

// ---------------------------------------------------------------
// Votes (chat)
// ---------------------------------------------------------------
function vote(user, cell) {
  const r = state.round;
  if (!r || state.pause) return false;
  if (state.revealed[cell]) return false;
  if (!config.round.voteLibre && !r.candidates.includes(cell)) return false;
  r.votes[user.toLowerCase()] = { cell, nom: user }; // un vote par personne, le dernier compte
  broadcast({ ev: 'vote', user, cell, counts: publicState().round.counts });
  save();
  return true;
}

// ---------------------------------------------------------------
// Dons
// ---------------------------------------------------------------
const seen = new Set();
function handleDonation({ nom, montant, message, source, id }) {
  montant = Number(String(montant).replace(',', '.'));
  if (!montant || montant <= 0) return;
  // anti-doublon : par id quand la source en donne un ; sinon même don exact dans une fenêtre de 10 s
  const key = id ? `id:${id}` : `${source}:${nom}:${montant}:${message}:${Math.floor(Date.now() / 10000)}`;
  if (seen.has(key)) return; // doublon (le même don peut arriver par 2 canaux)
  seen.add(key);
  if (seen.size > 500) seen.delete(seen.values().next().value);

  state.totals.dons = Math.round((state.totals.dons + montant) * 100) / 100;
  state.totals.nbDons += 1;
  { const st = state.carte.stats; st.dons = Math.round((st.dons + montant) * 100) / 100; st.nbDons += 1; st.donateurs[nom] = Math.round(((st.donateurs[nom] || 0) + montant) * 100) / 100; }
  recalcKm();
  state.dons.unshift({ nom, montant, message, source, at: Date.now() });
  state.dons = state.dons.slice(0, 30);

  const cell = parseCell(message);
  let effet = '';
  const r = state.round;
  const estCandidate = c => !!r && (config.round.voteLibre || r.candidates.includes(c));
  const seuil = seuilActuel();

  if (cell && !state.revealed[cell] && montant >= seuil && (config.dons.creuseLibre !== false || estCandidate(cell))) {
    // gros don avec une case : on creuse tout de suite
    effet = `creuse immédiatement ${cell}`;
    log('don', `${nom} donne ${montant} € — ${effet}`, { nom, montant });
    reveal(cell, { by: nom, how: 'don' });
    if (state.round && !state.round.candidates.some(c => !state.revealed[c])) endRound('don');
  } else if (r && !state.pause) {
    const votes = Math.max(1, Math.round(montant * config.dons.votesParEuro));
    let cible = null;
    if (cell && !state.revealed[cell]) {
      if (estCandidate(cell)) cible = cell;
      else if (config.dons.ajouteCandidate !== false) { r.candidates.push(cell); cible = cell; effet = `ajoute ${cell} au vote, `; }
    }
    if (!cible) {
      // pas de case (ou case refusée) : on renforce la case en tête, au hasard si égalité
      const counts = countsReels();
      const max = Math.max(...Object.values(counts));
      const top = Object.entries(counts).filter(([, n]) => n === max).map(([c]) => c);
      cible = shuffle(top)[0];
    }
    r.bonus[cible] = (r.bonus[cible] || 0) + votes;
    (r.bonusPar ||= {})[cible] = [...new Set([...(r.bonusPar[cible] || []), nom])]; // le donateur compte comme votant pour le classement
    effet += `+${votes} votes sur ${cible}`;
    log('don', `${nom} donne ${montant} € — ${effet}`, { nom, montant });
  } else {
    log('don', `${nom} donne ${montant} €`, { nom, montant });
  }
  broadcast({ ev: 'don', nom, montant, message, effet, totals: state.totals });
  chatSay(`💛 Merci ${nom} pour ${montant} € ! ${effet}`);
  pushState();
}

// ---------------------------------------------------------------
// Twitch chat (tmi.js)
// ---------------------------------------------------------------
let chat = null;
let chatWriter = null;
function chatSay(text) {
  if (!chatWriter || !config.bot?.annoncerDansLeChat) return;
  chatWriter.say(config.chaine, text).catch(() => {});
}
const cooldowns = {};
function repondreCommande(cmd, user, login) {
  if (!chatWriter) return;
  const now = Date.now();
  const key = cmd === '!moi' ? `moi:${login}` : cmd;
  if (cooldowns[key] && now - cooldowns[key] < (cmd === '!moi' ? 60e3 : 30e3)) return;
  cooldowns[key] = now;
  const c = config.chat.commande || '!creuse';
  switch (cmd) {
    case '!moi': {
      const p = state.pirates[login.toLowerCase()];
      if (!p || !p.doublons) return chatSay(`@${user} tu n'as pas encore de doublons — vote pour une case dorée avec ${c} B7 !`);
      const rang = classement(1000).findIndex(x => x.nom.toLowerCase() === login.toLowerCase()) + 1;
      chatSay(`@${user} : ${p.doublons} doublons, ${rang}${rang === 1 ? 'er' : 'e'} du classement${rang === 1 ? ' ⚓ Second du navire, ton vote compte double' : ''} (${p.cases} case${p.cases > 1 ? 's' : ''}).`);
      break;
    }
    case '!classement': {
      const top = classement(5);
      chatSay(top.length ? `🏴‍☠️ Top pirates : ${top.map((p, i) => `${i + 1}. ${p.nom} ${p.doublons}`).join(' · ')} — ${config.affichage?.recompense || ''}` : 'Personne au classement pour l’instant.');
      break;
    }
    case '!dettes': {
      const d = state.dettes.filter(x => !x.done);
      chatSay(d.length ? `📜 ${d.length} dette${d.length > 1 ? 's' : ''} : ${d.slice(-3).map(x => `${x.cell} ${x.text.slice(0, 60)}`).join(' | ')}` : 'Aucune dette pour le capitaine… pour l’instant.');
      break;
    }
    case '!carte': case '!regles':
      chatSay(`🗺️ Carte n°${state.carte.numero} — ${Object.keys(state.revealed).length}/${allCells().length} cases. Vote avec ${c} B7 · 1 € = ${config.dons.votesParEuro} votes · don ≥ ${seuilActuel()} € + case = creusée direct · les doublons d'une case vont à ses votants · !moi pour ton score.`);
      break;
  }
}
function connectChat() {
  if (chat) { try { chat.disconnect(); } catch {} chat = null; }
  if (chatWriter) { try { chatWriter.disconnect(); } catch {} chatWriter = null; }
  if (!config.chaine) return;

  const cmd = (config.chat.commande || '!creuse').toLowerCase();
  chat = new tmi.Client({ channels: [config.chaine], connection: { reconnect: true, secure: true } });
  chat.on('message', (channel, tags, message, self) => {
    if (self) return;
    const user = tags['display-name'] || tags.username;
    const txt = message.trim();

    const low = txt.toLowerCase();
    // 0) commandes d'info (répondues par le bot s'il est configuré)
    if (low.startsWith('!moi') || low.startsWith('!classement') || low.startsWith('!carte') || low.startsWith('!dettes') || low.startsWith('!regles') || low.startsWith('!règles')) {
      repondreCommande(low.split(/\s/)[0].replace('!règles', '!regles'), user, tags.username);
      return;
    }
    // 1) vote  →  !creuse B7   (ou juste "B7" si autorisé)
    if (low.startsWith(cmd)) {
      const cell = parseCell(txt.slice(cmd.length));
      if (cell) vote(user, cell);
      return;
    }
    if (config.chat.voteSansCommande) {
      const cell = parseCell(txt);
      if (cell && txt.length <= 4) vote(user, cell);
    }

    // 2) don annoncé par un bot dans le chat (regex avec groupes nommés nom / montant)
    if (config.chat.regexDon && (!config.chat.botName || tags.username.toLowerCase() === config.chat.botName.toLowerCase())) {
      try {
        const m = txt.match(new RegExp(config.chat.regexDon, 'i'));
        if (m && m.groups && m.groups.montant) {
          handleDonation({ nom: m.groups.nom || 'Anonyme', montant: m.groups.montant, message: m.groups.message || txt, source: 'chat' });
        }
      } catch (e) { console.log('[chat] regexDon invalide :', e.message); }
    }
  });
  chat.on('connected', () => log('info', `Connecté au chat de ${config.chaine}`));
  chat.on('disconnected', (r) => console.log('[chat] déconnecté :', r));
  chat.connect().catch(e => log('erreur', 'Chat Twitch : ' + e.message));

  if (config.bot?.username && config.bot?.oauth) {
    chatWriter = new tmi.Client({
      identity: { username: config.bot.username, password: config.bot.oauth },
      channels: [config.chaine], connection: { reconnect: true, secure: true }
    });
    chatWriter.connect().then(() => log('info', `Bot ${config.bot.username} prêt à écrire`)).catch(e => log('erreur', 'Bot : ' + e.message));
  }
}

// ---------------------------------------------------------------
// Streamlabs socket (dons + Streamlabs Charity)
// ---------------------------------------------------------------
let slSocket = null;
function connectStreamlabs() {
  if (slSocket) { try { slSocket.close(); } catch {} slSocket = null; }
  const token = config.streamlabs?.socketToken;
  if (!token) return;
  const io = require('socket.io-client');
  slSocket = io(`https://sockets.streamlabs.com?token=${token}`, { transports: ['websocket'], reconnection: true });
  slSocket.on('connect', () => log('info', 'Streamlabs connecté'));
  slSocket.on('disconnect', () => console.log('[streamlabs] déconnecté'));
  slSocket.on('event', (ev) => {
    const type = String(ev.type || '').toLowerCase();
    if (!type.includes('donation') && !type.includes('charity') && !type.includes('tip')) return;
    for (const m of ev.message || []) {
      handleDonation({
        nom: m.from || m.name || m.donator || 'Anonyme',
        montant: m.amount ?? m.formatted_amount,
        message: m.message || '',
        source: 'streamlabs:' + type,
        id: m._id || m.id
      });
    }
  });
}

// ---------------------------------------------------------------
// HTTP + API
// ---------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_, res) => res.redirect('/admin.html'));
app.get('/overlay', (_, res) => res.sendFile(path.join(__dirname, 'public', 'overlay.html')));

app.get('/api/state', (_, res) => res.json({ state: publicState(), config: publicConfig() }));
app.get('/recap', (_, res) => res.sendFile(path.join(__dirname, 'public', 'recap.html')));
app.get('/api/recap', (req, res) => res.json(recap(req.query.carte)));
app.get('/api/recap.txt', (req, res) => { res.type('text/plain; charset=utf-8').send(recapTexte(recap(req.query.carte))); });
function recap(which) {
  let carte = state.carte, archive = false;
  if (which === 'prev' || (which && which !== 'current' && Number(which) !== state.carte.numero)) {
    const n = which === 'prev' ? state.carte.numero - 1 : Number(which);
    const a = state.cartesPrecedentes.find(x => x.numero === n);
    if (a) { carte = { numero: a.numero, depuis: a.depuis, jusqu: a.jusqu, stats: a.stats || statsVides() }; archive = true; }
  }
  const st = carte.stats || statsVides();
  const topNuit = Object.entries(st.piratesDelta || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ nom: state.pirates[k]?.nom || k, doublons: v }));
  const topDonateurs = Object.entries(st.donateurs || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nom, montant]) => ({ nom, montant }));
  return {
    numero: carte.numero, depuis: carte.depuis, jusqu: carte.jusqu || Date.now(), archive,
    dons: st.dons, nbDons: st.nbDons, km: Math.round(st.dons * config.dons.kmParEuro * 100) / 100, nbRev: st.nbRev, total: allCells().length,
    gages: st.gages, tresor: st.tresor, capitaine: st.capitaine, topNuit, topDonateurs,
    topGlobal: classement(3), second: second() ? state.pirates[second()].nom : null,
    totaux: state.totals, dettesEnAttente: state.dettes.filter(d => !d.done).length, recompense: config.affichage?.recompense || ''
  };
}
function recapTexte(r) {
  const h = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const L = [];
  L.push(`⚓ Journal de bord — carte n°${r.numero} (${h(r.depuis)} → ${h(r.jusqu)})`);
  L.push(`💛 ${r.dons} € récoltés en ${r.nbDons} don${r.nbDons > 1 ? 's' : ''} → ${r.km} km de plus à marcher (total : ${r.totaux.km} km, ${r.totaux.dons} € sur l'event)`);
  L.push(`⛏️ ${r.nbRev}/${r.total} cases creusées`);
  if (r.tresor) L.push(`💎 Trésor trouvé en ${r.tresor.cell} par ${r.tresor.by} à ${h(r.tresor.at)} !`);
  if (r.gages.length) { L.push(`📜 ${r.gages.length} gage${r.gages.length > 1 ? 's' : ''} pour le capitaine :`); for (const g of r.gages) L.push(`   • ${g.duo ? '🤝 ' : ''}${g.cell} — ${g.text}`); }
  if (r.capitaine.length) L.push(`🏴‍☠️ Le capitaine a contre-attaqué ${r.capitaine.length} fois (${r.capitaine.map(c => c.cell).join(', ')})`);
  if (r.topNuit.length) L.push(`🪙 Pirates de la nuit : ${r.topNuit.map((p, i) => `${i + 1}. ${p.nom} +${p.doublons}`).join(' · ')}`);
  if (r.topDonateurs.length) L.push(`🙏 Merci à ${r.topDonateurs.map(d => `${d.nom} (${d.montant} €)`).join(', ')}`);
  if (r.second) L.push(`⚓ Second du navire : ${r.second} — ${r.recompense}`);
  return L.join('\n');
}
app.get('/api/config', (_, res) => res.json(config)); // page d'admin (locale) : config complète
app.put('/api/config', (req, res) => {
  const before = JSON.stringify({ c: config.chaine, ch: config.chat, b: config.bot, s: config.streamlabs });
  config = { ...config, ...req.body };
  saveConfig();
  const after = JSON.stringify({ c: config.chaine, ch: config.chat, b: config.bot, s: config.streamlabs });
  if (before !== after) { connectChat(); connectStreamlabs(); }
  log('info', 'Configuration mise à jour');
  pushState();
  res.json({ ok: true });
});
app.put('/api/cellule/:id', (req, res) => {
  const id = req.params.id.toUpperCase();
  if (!req.body || req.body.type === 'sable' && !req.body.label) delete config.cellules[id];
  else config.cellules[id] = req.body;
  saveConfig();
  pushState();
  res.json({ ok: true });
});

// Webhook générique : POST /api/don  { "nom": "X", "montant": 12.5, "message": "B7" }
app.post('/api/don', (req, res) => {
  const b = req.body || {};
  handleDonation({ nom: b.nom || b.name || b.from || 'Anonyme', montant: b.montant ?? b.amount, message: b.message || '', source: b.source || 'webhook', id: b.id });
  res.json({ ok: true });
});

app.post('/api/action/:what', (req, res) => {
  const b = req.body || {};
  switch (req.params.what) {
    case 'nouvelle-manche': state.round = null; startRound(); break;
    case 'terminer-manche': endRound('admin'); break;
    case 'reveler': { const c = parseCell(b.cell); if (c) reveal(c, { by: 'Le capitaine', how: 'admin' }); break; }
    case 'cacher': { const c = parseCell(b.cell); if (c) { delete state.revealed[c]; pushState(); } break; }
    case 'pause': state.pause = !!b.pause; if (!state.pause && !state.round) startRound(); log('info', state.pause ? 'Chasse en pause' : 'Chasse reprise'); pushState(); break;
    case 'dette': { const d = state.dettes.find(d => d.id === b.id); if (d) d.done = !!b.done; pushState(); break; }
    case 'reset-etat': {
      const pirates = b.classementAussi ? {} : state.pirates; // le classement de la semaine survit au reset, sauf demande explicite
      state = freshState(); state.pirates = pirates;
      log('info', `État remis à zéro (config conservée, classement ${b.classementAussi ? 'effacé' : 'conservé'})`); startRound(); break;
    }
    case 'generer-grille': genererGrille(b); break;
    case 'nouvelle-carte': nouvelleCarte('admin'); break;
    case 'melanger': melangerCases(); break;
    case 'injecter-duo': injecterDuo(Number(b.n || config.duo?.nbParCarte || 6)); break;
    case 'reset-classement': state.pirates = {}; log('info', 'Classement remis à zéro'); pushState(); break;
    case 'vider-votes': if (state.round) { state.round.votes = {}; state.round.bonus = {}; pushState(); } break;
    // ---- tests (n'altèrent pas la carte sauf les votes simulés)
    case 'test-vote': if (b.user && b.cell) vote(b.user, parseCell(b.cell)); break;
    case 'test-votes': {
      if (!state.round) startRound();
      const n = Number(b.n || 8), cands = state.round.candidates;
      for (let i = 0; i < n; i++) vote(`Moussaillon${Math.floor(Math.random() * 60)}`, cands[Math.floor(Math.random() * cands.length)]);
      log('test', `${n} votes simulés`); break;
    }
    case 'test-reveal': {
      const type = b.type || 'gage';
      const ex = { sable: { label: 'une vieille botte' }, doublons: { value: 50, gagnants: ['Taiyo', 'Oracio', 'Luxia'] }, gage: b.duo ? { label: gageDuoTexte({ label: 'Duel de pompes avec {pote} : le chat compte à voix haute, le perdant en refait 10.' }), duo: true, mode: 'ensemble' } : { label: 'Petit-déj commenté façon Top Chef, avec notes sur 20.' }, indice: { label: 'Le trésor est dans la moitié nord de la carte.' }, secret: { label: 'Palier caché 50 € débloqué !' }, piege: { label: 'Le perroquet a tout mangé.', value: 20 }, tresor: { label: 'Lignes de punition : 100 fois « Je ne laisserai plus le chat creuser pendant que je dors ».' }, capitaine: { label: EFFETS[b.effet || 'brouillard'].txt.replace('{v}', 2), effet: b.effet || 'brouillard' } }[type] || {};
      broadcast({ ev: 'reveal', cell: b.cell || 'T1', rec: { type, ...ex, by: 'un test', how: 'test' } });
      log('test', `Révélation simulée (${type}) — carte non modifiée`); break;
    }
    case 'test-carte': broadcast({ ev: 'nouvelle-carte', numero: (state.carte?.numero || 1) + 1 }); log('test', 'Annonce nouvelle carte simulée'); break;
    case 'test-toast': broadcast({ ev: 'don', nom: 'Moussaillon', montant: 5, effet: '+10 votes sur B7', totals: state.totals }); break;
    default: return res.status(404).json({ ok: false });
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// Nouvelle carte (chaque nuit) : on archive la carte en cours, on
// regénère la grille, on remet les cases à zéro. Dons, km et dettes
// restent cumulés sur toute la semaine.
// ---------------------------------------------------------------
function nouvelleCarte(how = 'auto') {
  const nbRev = Object.keys(state.revealed).length;
  state.cartesPrecedentes.push({
    numero: state.carte.numero, depuis: state.carte.depuis, jusqu: Date.now(),
    nbRevelees: nbRev, tresorTrouve: state.tresorTrouve, doublons: state.totals.doublons, stats: state.carte.stats
  });
  state.carte = { numero: state.carte.numero + 1, depuis: Date.now(), dernierResetJour: jourLocal(), stats: statsVides() };
  state.revealed = {};
  state.tresorTrouve = false;
  if (config.carte?.resetDoublons !== false) state.totals.doublons = 0;
  state.round = null;
  genererGrille({});
  log('carte', `Nouvelle carte n°${state.carte.numero} (${how === 'auto' ? 'automatique' : 'manuel'}) — la précédente avait ${nbRev} cases retournées`);
  broadcast({ ev: 'nouvelle-carte', numero: state.carte.numero });
  chatSay(`🗺️ Nouvelle carte au trésor n°${state.carte.numero} ! Tout est à re-creuser.`);
  if (!state.pause) startRound(); else pushState();
}
function jourLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function verifierResetAuto() {
  const c = config.carte;
  if (!c?.resetAuto || !c.heureReset) return;
  const [h, m] = String(c.heureReset).split(':').map(Number);
  const now = new Date();
  const passe = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  if (passe && state.carte.dernierResetJour !== jourLocal()) {
    // on ne relance pas une carte qui vient d'être créée à la main il y a moins d'1h
    if (Date.now() - state.carte.depuis < 3600e3) { state.carte.dernierResetJour = jourLocal(); save(); return; }
    nouvelleCarte('auto');
  }
}

// génère une grille aléatoire à partir des proportions + banque de gages
function genererGrille({ garderExistantes = false, proportions, gages, forcerDuo = false } = {}) {
  const p = proportions || config.generation?.proportions || { doublons: 20, gage: 12, indice: 5, secret: 4, piege: 5 };
  const banque = gages || config.generation?.banqueGages || [];
  const cells = allCells();
  const next = garderExistantes ? { ...config.cellules } : {};
  const libres = shuffle(cells.filter(c => !next[c]));
  let i = 0;
  const take = (n) => libres.slice(i, i += n);

  // trésor : jamais sur un bord
  if (!Object.values(next).some(d => d.type === 'tresor')) {
    const inner = libres.filter(c => {
      const col = LETTERS.indexOf(c[0]), row = Number(c.slice(1));
      return col > 0 && col < config.grille.cols - 1 && row > 1 && row < config.grille.rows;
    });
    const t = inner[0] || libres[0];
    next[t] = { type: 'tresor', label: config.generation?.gageUltime || 'Le gage ultime !' };
    libres.splice(libres.indexOf(t), 1);
  }
  for (const c of take(p.doublons || 0)) next[c] = { type: 'doublons', value: [5, 10, 10, 20, 20, 25, 50, 100][Math.floor(Math.random() * 8)] };
  const gagesMelanges = shuffle([...banque]);
  for (const [k, c] of take(p.gage || 0).entries()) {
    const g = gagesMelanges[k % (gagesMelanges.length || 1)];
    next[c] = g ? { type: 'gage', label: typeof g === 'string' ? g : g.label, quand: (typeof g === 'object' && g.quand) || 'reveil' } : { type: 'gage', label: 'Gage à définir', quand: 'reveil' };
  }
  for (const c of take(p.indice || 0)) next[c] = { type: 'indice' };
  for (const [k, c] of take(p.secret || 0).entries()) next[c] = { type: 'secret', label: (config.generation?.secrets || [])[k] || 'Palier caché débloqué !' };
  const effets = config.generation?.effetsCapitaine?.length ? config.generation.effetsCapitaine : Object.keys(EFFETS);
  for (const [k, c] of take(p.capitaine || 0).entries()) {
    const e = effets[k % effets.length];
    next[c] = { type: 'capitaine', effet: e, value: { moinsKm: 1, perteDoublons: 20, scelle: 2 }[e] || 0 };
  }
  for (const c of take(p.piege || 0)) next[c] = { type: 'piege', label: (config.generation?.pieges || [])[Math.floor(Math.random() * (config.generation?.pieges?.length || 1))] || 'Le perroquet a tout mangé', value: [10, 20, 30][Math.floor(Math.random() * 3)] };
  config.cellules = next;
  if (forcerDuo || jourDuo()) injecterDuo(config.duo?.nbParCarte || 6, false);
  saveConfig();
  log('info', 'Grille générée aléatoirement' + ((forcerDuo || jourDuo()) ? ' (avec gages à deux)' : ''));
  pushState();
}
// mélange les contenus des cases non révélées entre elles (les révélées ne bougent pas)
function melangerCases() {
  const libres = unrevealed();
  const defs = libres.map(c => config.cellules[c] || null);
  const positions = shuffle([...libres]);
  const next = { ...config.cellules };
  for (const c of libres) delete next[c];
  // le trésor reste hors des bords
  const estBord = c => { const col = LETTERS.indexOf(c[0]), row = Number(c.slice(1)); return col === 0 || col === config.grille.cols - 1 || row === 1 || row === config.grille.rows; };
  const iT = defs.findIndex(d => d?.type === 'tresor');
  if (iT >= 0) {
    const jT = positions.findIndex(p => !estBord(p));
    if (jT > 0) [positions[0], positions[jT]] = [positions[jT], positions[0]];
    [defs[0], defs[iT]] = [defs[iT], defs[0]];
  }
  defs.forEach((d, i) => { if (d) next[positions[i]] = d; });
  config.cellules = next;
  if (state.round) { // les candidates restent valides (mêmes cases, contenus différents) : on ne touche pas aux votes
  }
  saveConfig();
  log('info', `Emplacement des ${libres.length} cases non révélées mélangé`);
  pushState();
}

// ---------------------------------------------------------------
// Gages à deux (week-end avec le pote)
// ---------------------------------------------------------------
function jourDuo() { return (config.duo?.dates || []).includes(jourLocal()); }
function pote() { return config.duo?.nomPote?.trim() || 'le pote'; }
function gageDuoTexte(g) { return String(g.label).replace(/\{pote\}/g, pote()).replace(/^le pote/, 'Le pote'); }
// remplace n cases non révélées (gages simples d'abord, puis sable) par des gages à deux
function injecterDuo(n, sauver = true) {
  const banque = shuffle([...(config.generation?.banqueGagesDuo || [])]);
  if (!banque.length) return 0;
  const dejaDuo = allCells().filter(c => cellDef(c).duo && !state.revealed[c]).length;
  n = Math.max(0, n - dejaDuo);
  const libres = unrevealed();
  const cibles = [...shuffle(libres.filter(c => cellDef(c).type === 'gage' && !cellDef(c).duo)), ...shuffle(libres.filter(c => cellDef(c).type === 'sable'))].slice(0, n);
  cibles.forEach((c, i) => {
    const g = banque[i % banque.length];
    config.cellules[c] = { type: 'gage', duo: true, mode: g.mode || 'ensemble', label: g.label, quand: 'reveil' };
  });
  if (sauver) { saveConfig(); log('info', `${cibles.length} gage(s) à deux injecté(s) sur la carte : ${cibles.join(', ')}`); pushState(); }
  return cibles.length;
}

// ---------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------
const server = http.createServer(app);
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.send(JSON.stringify({ ev: 'state', state: publicState(), config: publicConfig() }));
  });
});

// boucle du timer (toutes les secondes)
setInterval(() => {
  if (state.round && !state.pause && Date.now() >= state.round.endsAt) endRound('timer');
}, 1000);
setInterval(verifierResetAuto, 30 * 1000);

server.listen(PORT, HOST, () => {
  console.log(`\n  ⚓ Carte au trésor`);
  console.log(`  Overlay OBS : http://${HOST}:${PORT}/overlay`);
  console.log(`  Admin       : http://${HOST}:${PORT}/admin.html\n`);
  connectChat();
  connectStreamlabs();
  if (!state.round && !state.pause) startRound();
});
