// ====== main script (moved from index.html) ======

const inputEl = document.getElementById("input");
const renderBtn = document.getElementById("renderBtn");
const clearBtn = document.getElementById("clearBtn");
const dialogueEl = document.getElementById("dialogue");

const myRoleEl = document.getElementById("myRole");
const hideMyLinesEl = document.getElementById("hideMyLines");
const showNotesEl = document.getElementById("showNotes");
const modeAEl = document.getElementById("modeA");
const modeBEl = document.getElementById("modeB");

const floatPrev = document.getElementById("floatPrev");
const floatNext = document.getElementById("floatNext");
const floatModeAEl = document.getElementById("floatModeA");
const floatModeBEl = document.getElementById("floatModeB");

const scriptIdEl = document.getElementById("scriptId");
const resetNotesBtn = document.getElementById("resetNotesBtn");

const summaryEl = document.getElementById("summary");
const refreshSummaryBtn = document.getElementById("refreshSummaryBtn");
const copySummaryBtn = document.getElementById("copySummaryBtn");
const copyMsg = document.getElementById("copyMsg");
const LS_LAST_SCRIPT = "ds_last_script_v1";

// 折りたたみ
const toggleFloatBtn = document.getElementById("toggleFloat");
const floatNavEl = document.getElementById("floatNav");

let turns = [];
let speakerSide = new Map(); // speaker -> "left" | "right"

let focusIndex = 0;
let notes = new Map();
let currentScriptId = "unknown";
let speakerA = "A";
let speakerB = "B";
function updateSpeakerAB(){
  const uniq = [...new Set(turns.map(t => t.speaker))];
  speakerA = uniq[0] ?? "A";
  speakerB = uniq[1] ?? (uniq[0] ?? "B");
}

const LS_PREFIX = "ds_notes_v1:";

function parseTSV(text){
  return text.split(/\r?\n/).filter(l=>l.trim())
    .map(l=>{
      const c = l.split("\t");
      return {
        speaker: (c[0] ?? "").trim(),
        en: (c[1] ?? "").trim(),
        ja: (c[2] ?? "").trim()
      };
    })
    .filter(t => t.speaker && (t.en || t.ja));
}

toggleFloatBtn.onclick = () => {
  floatNavEl.classList.toggle("collapsed");
  toggleFloatBtn.textContent = floatNavEl.classList.contains("collapsed") ? "▸" : "▾";
};

function hashString(str){
  let h = 2166136261;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function getScriptId(){
  const normalized = inputEl.value.replace(/\r/g,"").trim();
  return hashString(normalized);
}

function loadNotes(scriptId){
  const key = LS_PREFIX + scriptId;
  const raw = localStorage.getItem(key);
  const m = new Map();
  if(!raw) return m;
  try{
    const obj = JSON.parse(raw);
    for(const k of Object.keys(obj)){
      m.set(Number(k), String(obj[k]));
    }
  }catch(e){}
  return m;
}

let saveTimer = null;
function saveNotesDebounced(){
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNotesNow, 250);
}

function updateSpeakerSides(){
  speakerSide = new Map();
  const uniq = [...new Set(turns.map(t => t.speaker))];

  if (uniq[0]) speakerSide.set(uniq[0], "left");
  if (uniq[1]) speakerSide.set(uniq[1], "right");

  // 3人目以降が出ても、とりあえず左にする（必要なら後で拡張）
  for (let i = 2; i < uniq.length; i++){
    speakerSide.set(uniq[i], "left");
  }
}


function saveNotesNow(){
  const key = LS_PREFIX + currentScriptId;
  const obj = {};
  for(const [k,v] of notes.entries()){
    const s = (v ?? "").trim();
    if(s) obj[String(k)] = s;
  }
  localStorage.setItem(key, JSON.stringify(obj));
}

function resetNotes(){
  const key = LS_PREFIX + currentScriptId;
  localStorage.removeItem(key);
  notes = new Map();
  render();
  buildSummary();
  flashMsg("この台本のメモを消しました");
}

function syncTopToFloat(){
  floatModeAEl.value = modeAEl.value;
  floatModeBEl.value = modeBEl.value;
}
function syncFloatToTop(){
  modeAEl.value = floatModeAEl.value;
  modeBEl.value = floatModeBEl.value;
}

function rebuildRoles(){
  const set = [...new Set(turns.map(t=>t.speaker))];
  myRoleEl.innerHTML = "";
  set.forEach(s=>{
    const o=document.createElement("option");
    o.value=s; o.textContent=s;
    myRoleEl.appendChild(o);
  });
  if(set.includes("A")) myRoleEl.value="A";
  else if(set.length) myRoleEl.value=set[0];
}
updateSpeakerAB();

function updateSpeakerSides(){
  speakerSide = new Map();
  const uniq = [...new Set(turns.map(t => t.speaker))];

  if (uniq[0]) speakerSide.set(uniq[0], "left");
  if (uniq[1]) speakerSide.set(uniq[1], "right");

  for (let i = 2; i < uniq.length; i++){
    speakerSide.set(uniq[i], "left");
  }
}

let speakerSide = new Map();

function render(){
  dialogueEl.innerHTML="";
  const showNotes = showNotesEl.checked;

  turns.forEach((t,i)=>{
    const div=document.createElement("div");
    div.dataset.index=i;

    const b=document.createElement("div");
    b.className="bubble";

    const meta=document.createElement("div");
    meta.className="meta";
    meta.textContent=`${t.speaker} / ${i+1}`;
    b.appendChild(meta);

    const isB = (t.speaker === speakerB);
    const side = speakerSide.get(t.speaker) || "left";
    const side = speakerSide.get(t.speaker) || "left";
    div.className = "turn " + (side === "right" ? "right" : "left");


    const mode = isB ? modeBEl.value : modeAEl.value;


    if(mode !== "hide"){
      if(!(hideMyLinesEl.checked && t.speaker===myRoleEl.value)){
        if(mode==="en"||mode==="both"){
          const e=document.createElement("div");
          e.className="en";
          e.textContent=t.en;
          b.appendChild(e);
        }
        if(mode==="ja"||mode==="both"){
          const j=document.createElement("div");
          j.className="ja";
          j.textContent=t.ja;
          b.appendChild(j);
        }
      }else{
        const h=document.createElement("div");
        h.className="en";
        h.textContent="（ここで自分が言う）";
        b.appendChild(h);
      }
    }

    if(showNotes){
      const ta=document.createElement("textarea");
      ta.className="noteTa";
      ta.placeholder="気づきメモ（ここは自動保存）";
      ta.value = notes.get(i) ?? "";
      ta.addEventListener("input", () => {
        notes.set(i, ta.value);
        saveNotesDebounced();
        buildSummary();
      });
      b.appendChild(ta);
    }

    div.appendChild(b);
    dialogueEl.appendChild(div);
  });

  applyFocus();
}

function applyFocus(){
  document.querySelectorAll(".bubble").forEach(b=>b.classList.remove("focus"));
  const t=document.querySelector(`.turn[data-index="${focusIndex}"] .bubble`);
  if(t){
    t.classList.add("focus");
    t.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
}

function goPrev(){ if(!turns.length) return; focusIndex=Math.max(0,focusIndex-1); applyFocus(); }
function goNext(){ if(!turns.length) return; focusIndex=Math.min(turns.length-1,focusIndex+1); applyFocus(); }

function buildSummary(){
  const lines = [];
  for(let i=0;i<turns.length;i++){
    const note = (notes.get(i) ?? "").trim();
    if(!note) continue;
    const t = turns[i];
    const en = (t.en ?? "").replace(/\s+/g," ").trim();
    lines.push(`Turn ${i+1} [${t.speaker}]\nEN: ${en}\nNote: ${note}\n`);
  }
  summaryEl.value = lines.join("\n");
}

function flashMsg(text){
  copyMsg.textContent = text;
  setTimeout(()=>{ if(copyMsg.textContent === text) copyMsg.textContent=""; }, 1400);
}

function saveScript(){
  localStorage.setItem(LS_LAST_SCRIPT, inputEl.value);
}

inputEl.addEventListener("input", () => {
  saveScript();
});

async function copySummary(){
  try{
    await navigator.clipboard.writeText(summaryEl.value);
    flashMsg("コピーしました");
  }catch(e){
    summaryEl.focus();
    summaryEl.select();
    document.execCommand("copy");
    flashMsg("コピーしました（互換モード）");
  }
}

function setScriptAndLoad(){
  currentScriptId = getScriptId();
  scriptIdEl.textContent = currentScriptId;
  notes = loadNotes(currentScriptId);
}

renderBtn.onclick = () => {
  turns = parseTSV(inputEl.value);
  focusIndex = 0;

  updateSpeakerSides();   // ← これを追加

  setScriptAndLoad();
  rebuildRoles();
  syncTopToFloat();
  render();
  buildSummary();
};
  setScriptAndLoad();
  rebuildRoles();
  syncTopToFloat();
  render();
  buildSummary();
};

clearBtn.onclick = () => {
  turns = [];
  focusIndex = 0;
  dialogueEl.innerHTML="";
  myRoleEl.innerHTML="";
  buildSummary();
};

resetNotesBtn.onclick = () => resetNotes();

[myRoleEl, hideMyLinesEl, showNotesEl].forEach(e=>e.addEventListener("change", () => { render(); }));

[modeAEl, modeBEl].forEach(e=>e.addEventListener("change", ()=>{
  syncTopToFloat(); render();
}));

[floatModeAEl, floatModeBEl].forEach(e=>e.addEventListener("change", ()=>{
  syncFloatToTop(); render();
}));

floatPrev.onclick = goPrev;
floatNext.onclick = goNext;

refreshSummaryBtn.onclick = buildSummary;
copySummaryBtn.onclick = copySummary;
const last = localStorage.getItem(LS_LAST_SCRIPT);
if (last) inputEl.value = last;

// 初期表示
turns = parseTSV(inputEl.value);
setScriptAndLoad();
rebuildRoles();
syncTopToFloat();
updateSpeakerSides();
render();
buildSummary();