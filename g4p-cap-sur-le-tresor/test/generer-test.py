"""
Génère une page de test (simulateur Streamlabs) à partir des fichiers du dossier streamlabs/
et d'un fichier de champs personnalisés.

Usage :
  python3 test/generer-test.py <champs.json> <sortie.html> <objectif> "<titre>"
Exemple :
  python3 test/generer-test.py streamers/lexywinchester/4-Champs-personnalises.json test/TEST-lexy.html 2001 "Le trésor de Dame Lexy"
"""
import json, sys, os
BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
champs_file, out, target, titre = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
html=open(os.path.join(BASE,"streamlabs/1-HTML.html")).read(); css=open(os.path.join(BASE,"streamlabs/2-CSS.css")).read(); js=open(os.path.join(BASE,"streamlabs/3-JS.js")).read()
champs=json.load(open(champs_file))
for k,v in champs.items():
    html=html.replace("{"+k+"}",v["value"])
testeur = """
<div id="testeur" style="position:fixed;left:0;right:0;bottom:0;padding:12px 20px;background:#1b1f1b;border-top:2px solid #3dff4f;font:14px system-ui;color:#eee;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
  <b style="color:#3dff4f;margin-right:6px">Simulateur Streamlabs</b>
  Objectif <input id="t-obj" type="number" value="TARGET" style="width:70px">
  <button onclick="tLoad()">Charger</button>
  <span style="margin-left:10px">Don :</span>
  <button onclick="tDon(5)">+5</button><button onclick="tDon(10)">+10</button>
  <button onclick="tDon(50)">+50</button><button onclick="tDon(100)">+100</button><button onclick="tDon(500)">+500</button>
  <button onclick="tCur=0;tLoad()">Remise à zéro</button>
  <button onclick="tCur=Number(document.getElementById('t-obj').value);tDon(0)">Objectif atteint</button>
  <span id="t-info" style="margin-left:auto;color:#aaa"></span>
</div>
<style>#testeur button{font:600 13px system-ui;padding:5px 10px;border-radius:6px;border:1px solid #1fcf3a;background:#143a1a;color:#fff;cursor:pointer}
#testeur input{font:13px system-ui;padding:4px;border-radius:6px;border:1px solid #3a4a3a;background:#0c100c;color:#fff}
body{background:#2a2a2a!important;min-height:100vh}</style>
<script>
let tCur=0;
function det(){return {title:"TITRE",amount:{current:tCur,target:Number(document.getElementById('t-obj').value)||500}}}
function tLoad(){document.dispatchEvent(new CustomEvent('goalLoad',{detail:det()}));info()}
function tDon(n){tCur+=n;document.dispatchEvent(new CustomEvent('goalEvent',{detail:det()}));info()}
function info(){document.getElementById('t-info').textContent='Envoyé : '+tCur+' / '+det().amount.target}
tLoad();
</script>""".replace("TARGET",target).replace("TITRE",titre)
page=("<!doctype html><html lang='fr'><head><meta charset='utf-8'><title>Test widget G4P</title>"
      f"<style>{css}</style></head><body>{html}<script>{js}</script>{testeur}</body></html>")
open(out,"w").write(page)
