// SAFE HOME – app.js (Moneda por trabajo, formularios visuales)
const $ = (id) => document.getElementById(id);

const JOBS_KEY = "safehome_jobs_base";
const VILLAS_KEY = "safehome_villas";

const state = {
  jobs: [],
  villas: [],
  villaFilter: "ALL",
};

let editingJobIndex = null;
let expenseJobIndex = null;

// ---------- Helpers ----------
function money(n){
  return Number(n||0).toLocaleString("es-DO",{minimumFractionDigits:2});
}
function monthISO(d){ return d.toISOString().slice(0,7); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

function toMinutes(hhmm){
  const [h,m] = String(hhmm||"0:0").split(":").map(Number);
  return (h||0)*60 + (m||0);
}
function hoursBetween(start, end){
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 12 * 60; // asumir tarde
  return (e - s) / 60;
}

function jobLabor(j){
  if(j.type === "hours" && j.start && j.end && j.rate){
    const h = hoursBetween(j.start,j.end);
    return Number((h * Number(j.rate)).toFixed(2));
  }
  return Number(j.labor || 0);
}
function jobTotal(j){
  const labor = jobLabor(j);
  const exp = (j.expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
  return labor + exp;
}

function ensureJobDefaults(j){
  if(!j.currency) j.currency = "RD$";
  if(!j.status) j.status = "pendiente";
  if(!j.type) j.type = (j.start && j.end && j.rate) ? "hours" : "fixed";
  if(!Array.isArray(j.expenses)) j.expenses = [];
  return j;
}

// ---------- Storage ----------
function load(){
  state.jobs = JSON.parse(localStorage.getItem(JOBS_KEY) || "[]").map(ensureJobDefaults);
  state.villas = JSON.parse(localStorage.getItem(VILLAS_KEY) || "[]");
}
function saveJobs(){
  localStorage.setItem(JOBS_KEY, JSON.stringify(state.jobs));
}

// ---------- UI: Villa filter ----------
function setupVillaFilter(){
  const sel = $("villaFilter");
  if(!sel) return;

  const keep = sel.value || "ALL";
  sel.innerHTML = `<option value="ALL">Todas las villas</option>`;
  state.villas.forEach(v=>{
    const name = `${v.owner} – Villa ${v.number}`;
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    sel.appendChild(o);
  });
  sel.value = keep;
  state.villaFilter = sel.value;

  if(sel.dataset.bound !== "1"){
    sel.addEventListener("change",()=>{
      state.villaFilter = sel.value;
      refreshJobs();
    });
    sel.dataset.bound = "1";
  }
}

// ---------- UI: Job modal ----------
function openJobModal(mode, index=null){
  editingJobIndex = (mode==="edit") ? index : null;

  const backdrop = $("jobModalBackdrop");
  const title = $("jobModalTitle");
  const villaSel = $("jobVilla");

  // villas dropdown
  villaSel.innerHTML = "";
  if(!state.villas.length){
    villaSel.innerHTML = `<option value="">(Primero agrega villas)</option>`;
  }else{
    state.villas.forEach(v=>{
      const name = `${v.owner} – Villa ${v.number}`;
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      villaSel.appendChild(o);
    });
  }

  // defaults
  $("jobDate").value = todayISO();
  $("jobDesc").value = "";
  $("jobCurrency").value = "RD$";
  $("jobType").value = "fixed";
  $("jobLabor").value = "";
  $("jobStart").value = "";
  $("jobEnd").value = "";
  $("jobRate").value = "";
  $("jobStatus").value = "pendiente";
  $("jobStatus2").value = "pendiente";

  if(mode==="edit" && state.jobs[index]){
    const j = ensureJobDefaults({...state.jobs[index]});
    title.textContent = "Editar trabajo";
    villaSel.value = j.villa || "";
    $("jobDate").value = j.date || todayISO();
    $("jobDesc").value = j.desc || "";
    $("jobCurrency").value = j.currency || "RD$";
    $("jobType").value = j.type || ((j.start&&j.end&&j.rate)?"hours":"fixed");
    if($("jobType").value === "hours"){
      $("jobStart").value = j.start || "";
      $("jobEnd").value = j.end || "";
      $("jobRate").value = j.rate || "";
      $("jobStatus2").value = j.status || "pendiente";
    }else{
      $("jobLabor").value = j.labor ?? "";
      $("jobStatus").value = j.status || "pendiente";
    }
  }else{
    title.textContent = "Agregar trabajo";
  }

  syncJobTypeUI();
  backdrop.style.display = "flex";
}

function closeJobModal(){
  $("jobModalBackdrop").style.display = "none";
  editingJobIndex = null;
}

function syncJobTypeUI(){
  const type = $("jobType").value;
  const fixedBox = $("fixedBox");
  const hoursBox = $("hoursBox");
  fixedBox.style.display = (type==="fixed") ? "grid" : "none";
  hoursBox.style.display = (type==="hours") ? "grid" : "none";
}

function saveJobFromModal(){
  if(!state.villas.length){
    alert("Primero debes agregar villas");
    return;
  }

  const villa = $("jobVilla").value;
  const date = $("jobDate").value || todayISO();
  const desc = $("jobDesc").value.trim();
  const currency = $("jobCurrency").value;
  const type = $("jobType").value;

  if(!villa){ alert("Selecciona una villa"); return; }
  if(!desc){ alert("Escribe una descripción"); return; }

  let job = null;
  if(editingJobIndex !== null && state.jobs[editingJobIndex]){
    job = {...state.jobs[editingJobIndex]};
  }else{
    job = { expenses:[] };
  }

  job.villa = villa;
  job.date = date;
  job.desc = desc;
  job.currency = currency;
  job.type = type;

  if(type==="hours"){
    const start = $("jobStart").value;
    const end = $("jobEnd").value;
    const rate = Number($("jobRate").value || 0);
    const status = $("jobStatus2").value;

    if(!start || !end || !rate){ alert("Completa horario y precio por hora"); return; }
    if(hoursBetween(start,end) <= 0){ alert("Horario inválido"); return; }

    job.start = start; job.end = end; job.rate = rate;
    job.labor = 0;
    job.status = status;
  }else{
    const labor = Number($("jobLabor").value || 0);
    const status = $("jobStatus").value;
    if(!labor){ alert("Coloca el monto"); return; }
    job.labor = labor;
    job.start = null; job.end = null; job.rate = null;
    job.status = status;
  }

  ensureJobDefaults(job);

  if(editingJobIndex !== null){
    state.jobs[editingJobIndex] = job;
  }else{
    state.jobs.push(job);
  }

  saveJobs();
  closeJobModal();
  refreshJobs();
}

// ---------- Expenses modal ----------
function openExpModal(jobIndex){
  expenseJobIndex = jobIndex;
  $("expDesc").value = "";
  $("expAmount").value = "";
  $("expModalBackdrop").style.display = "flex";
}
function closeExpModal(){
  $("expModalBackdrop").style.display = "none";
  expenseJobIndex = null;
}
function saveExpenseFromModal(){
  const i = expenseJobIndex;
  if(i === null || !state.jobs[i]) return;

  const d = $("expDesc").value.trim();
  const a = Number($("expAmount").value || 0);
  if(!d || !a){ alert("Completa descripción y monto"); return; }

  state.jobs[i].expenses = state.jobs[i].expenses || [];
  state.jobs[i].expenses.push({desc:d, amount:a});
  saveJobs();
  closeExpModal();
  refreshJobs();
}

function deleteExpense(jobIndex, expIndex){
  if(!state.jobs[jobIndex]) return;
  state.jobs[jobIndex].expenses.splice(expIndex,1);
  saveJobs();
  refreshJobs();
}

// ---------- Other actions ----------
function deleteJob(i){
  if(!confirm("¿Eliminar trabajo?")) return;
  state.jobs.splice(i,1);
  saveJobs();
  refreshJobs();
}
function toggleStatus(i){
  const j = state.jobs[i];
  j.status = (j.status === "realizado") ? "pendiente" : "realizado";
  saveJobs();
  refreshJobs();
}
function changeVilla(i){
  if(!state.villas.length) return alert("Primero agrega villas");
  const list = state.villas.map((v,idx)=>`${idx+1}) ${v.owner} – Villa ${v.number}`).join("\n");
  const p = Number(prompt("Elige la villa:\n\n"+list)) - 1;
  if(isNaN(p) || !state.villas[p]) return;
  state.jobs[i].villa = `${state.villas[p].owner} – Villa ${state.villas[p].number}`;
  saveJobs();
  refreshJobs();
}

// ---------- Render ----------
function refreshJobs(){
  const list = $("jobsList");
  const mPick = $("monthPick");
  const tRD = $("monthTotalRD");
  const tUSD = $("monthTotalUSD");
  if(!list || !mPick || !tRD || !tUSD) return;

  setupVillaFilter();

  const month = mPick.value;
  list.innerHTML = "";

  let sumRD = 0;
  let sumUSD = 0;

  let arr = state.jobs.map((j,i)=>({...ensureJobDefaults(j), _i:i}))
    .filter(j => (j.date||"").startsWith(month));

  if(state.villaFilter !== "ALL"){
    arr = arr.filter(j => j.villa === state.villaFilter);
  }

  if(!arr.length){
    list.innerHTML = "<div class='muted'>No hay trabajos en este mes</div>";
    tRD.textContent = `RD$ ${money(0)}`;
    tUSD.textContent = `US$ ${money(0)}`;
    return;
  }

  arr.forEach(j=>{
    const total = jobTotal(j);
    if((j.currency||"RD$")==="US$") sumUSD += total;
    else sumRD += total;

    const hoursLine = (j.type==="hours" && j.start && j.end && j.rate)
      ? `${hoursBetween(j.start,j.end).toFixed(2)} h × ${money(j.rate)}`
      : "Monto fijo";

    const statusBadge = (j.status==="realizado")
      ? `<span class="badge ok">REALIZADO</span>`
      : `<span class="badge warn">PENDIENTE</span>`;

    const expHtml = (j.expenses||[]).map((e,ei)=>`
      <div class="expense">
        <span>• ${e.desc} – ${j.currency} ${money(e.amount)}</span>
        <button class="danger smallbtn" onclick="deleteExpense(${j._i},${ei})">x</button>
      </div>
    `).join("");

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="job-title">${j.desc}</div>
      <div class="muted">${j.date} · 🏡 ${j.villa}</div>

      <div class="amountline">
        <div class="money">${j.currency} ${money(total)}</div>
        <div>${statusBadge}</div>
      </div>

      <div class="muted">${hoursLine} · Moneda: ${j.currency}</div>

      ${expHtml}

      <div class="job-actions">
        <button class="smallbtn" onclick="openExpModal(${j._i})">+ Gasto</button>
        <button class="smallbtn" onclick="changeVilla(${j._i})">Cambiar villa</button>
        <button class="smallbtn" onclick="openJobModal('edit', ${j._i})">Editar</button>
        <button class="smallbtn" onclick="toggleStatus(${j._i})">Estado</button>
        <button class="danger smallbtn" onclick="deleteJob(${j._i})">Eliminar</button>
      </div>
    `;
    list.appendChild(card);
  });

  tRD.textContent = `RD$ ${money(sumRD)}`;
  tUSD.textContent = `US$ ${money(sumUSD)}`;
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded",()=>{
  load();

  const m = $("monthPick");
  if(m){
    m.value = monthISO(new Date());
    m.addEventListener("change", refreshJobs);
  }

  $("btnOpenAddJob")?.addEventListener("click", ()=>openJobModal("add"));
  $("jobType")?.addEventListener("change", syncJobTypeUI);

  setupVillaFilter();
  refreshJobs();
});

// Exponer para onclick
window.openJobModal = openJobModal;
window.closeJobModal = closeJobModal;
window.saveJobFromModal = saveJobFromModal;
window.openExpModal = openExpModal;
window.closeExpModal = closeExpModal;
window.saveExpenseFromModal = saveExpenseFromModal;
window.deleteExpense = deleteExpense;
window.deleteJob = deleteJob;
window.toggleStatus = toggleStatus;
window.changeVilla = changeVilla;
