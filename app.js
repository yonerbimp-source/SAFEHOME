// SAFE HOME – app.js
// Soporta monto fijo O cálculo por horas (opcional, por trabajo)

const $ = (id) => document.getElementById(id);

const JOBS_KEY = "safehome_jobs_base";
const VILLAS_KEY = "safehome_villas";

const state = {
  jobs: [],
  villas: [],
  villaFilter: "ALL",
  currency: "RD$",
};

function money(n){
  return Number(n||0).toLocaleString("es-DO",{minimumFractionDigits:2});
}
function monthISO(d){ return d.toISOString().slice(0,7); }

function load(){
  state.jobs = JSON.parse(localStorage.getItem(JOBS_KEY) || "[]");
  state.villas = JSON.parse(localStorage.getItem(VILLAS_KEY) || "[]");
}
function saveJobs(){
  localStorage.setItem(JOBS_KEY, JSON.stringify(state.jobs));
}

// ---------- TIEMPO ----------
function toMinutes(hhmm){
  const [h,m] = hhmm.split(":").map(Number);
  return h*60 + m;
}
function hoursBetween(start, end){
  const s = toMinutes(start);
  let e = toMinutes(end);

  // Si la salida es menor, asumimos que es en la tarde
  if (e <= s) {
    e += 12 * 60;
  }

  return (e - s) / 60;
}

// ---------- TOTAL DEL TRABAJO ----------
function jobLabor(j){
  // Si tiene horas válidas → usar cálculo por tiempo
  if(j.start && j.end && j.rate){
    const h = hoursBetween(j.start,j.end);
    if(h === null) return 0;
    return Number((h * Number(j.rate)).toFixed(2));
  }
  // Si no, usar monto manual
  return Number(j.labor || 0);
}

function jobTotal(j){
  const labor = jobLabor(j);
  const exp = (j.expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
  return labor + exp;
}

// ---------- FILTRO VILLAS ----------
function setupVillaFilter(){
  const sel = $("villaFilter");
  if(!sel) return;

  if(sel.dataset.bound !== "1"){
    sel.addEventListener("change",()=>{
      state.villaFilter = sel.value;
      refreshJobs();
    });
    sel.dataset.bound = "1";
  }

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
}

// ---------- PICK VILLA ----------
function pickVilla(){
  if(!state.villas.length){
    alert("Primero debes agregar villas");
    return null;
  }
  const list = state.villas
    .map((v,i)=>`${i+1}) ${v.owner} – Villa ${v.number}`)
    .join("\n");
  const p = Number(prompt("Elige la villa:\n\n"+list)) - 1;
  if(isNaN(p) || !state.villas[p]) return null;
  return `${state.villas[p].owner} – Villa ${state.villas[p].number}`;
}

// ---------- AGREGAR / EDITAR ----------
function addJob(){
  const villa = pickVilla();
  if(!villa) return;

  const desc = prompt("Descripción del trabajo:");
  if(!desc) return;

  const useHours = confirm("¿Quieres calcular este trabajo por horas?");
  let labor = 0, start=null, end=null, rate=null;

  if(useHours){
    start = prompt("Hora inicio (HH:MM)");
    end   = prompt("Hora salida (HH:MM)");
    rate  = prompt("Precio por hora");

    if(!start || !end || !rate){
      alert("Datos incompletos");
      return;
    }
    const h = hoursBetween(start,end);
    if(h === null){
      alert("Horario inválido");
      return;
    }
  }else{
    labor = prompt("Monto fijo del trabajo:");
    if(labor === null || labor==="") return;
  }

  state.jobs.push({
    desc,
    villa,
    labor:Number(labor||0),
    start, end, rate,
    date:new Date().toISOString().slice(0,10),
    expenses:[]
  });

  saveJobs();
  refreshJobs();
}

function editJob(i){
  const j = state.jobs[i];
  if(!j) return;

  const desc = prompt("Descripción:", j.desc);
  if(!desc) return;

  const recalc = confirm("¿Recalcular por horas?");
  let labor=j.labor, start=j.start, end=j.end, rate=j.rate;

  if(recalc){
    start = prompt("Hora inicio (HH:MM)", start||"");
    end   = prompt("Hora salida (HH:MM)", end||"");
    rate  = prompt("Precio por hora", rate||"");

    if(!start || !end || !rate){
      alert("Datos incompletos");
      return;
    }
    if(hoursBetween(start,end)===null){
      alert("Horario inválido");
      return;
    }
    labor = 0;
  }

  j.desc=desc;
  j.labor=Number(labor||0);
  j.start=start; j.end=end; j.rate=rate;

  saveJobs();
  refreshJobs();
}

// ---------- GASTOS ----------
function addExpense(i){
  const j = state.jobs[i];
  if(!j) return;
  const d = prompt("Descripción del gasto:");
  if(!d) return;
  const a = prompt("Monto:");
  if(a===null||a==="") return;
  j.expenses.push({desc:d,amount:Number(a)});
  saveJobs(); refreshJobs();
}
function deleteExpense(i,ei){
  state.jobs[i].expenses.splice(ei,1);
  saveJobs(); refreshJobs();
}
function deleteJob(i){
  if(!confirm("¿Eliminar trabajo?")) return;
  state.jobs.splice(i,1);
  saveJobs(); refreshJobs();
}
function changeVilla(i){
  const v = pickVilla();
  if(!v) return;
  state.jobs[i].villa=v;
  saveJobs(); refreshJobs();
}

// ---------- RENDER ----------
function refreshJobs(){
  const list=$("jobsList");
  const m=$("monthPick");
  const t=$("monthTotal");
  if(!list||!m||!t) return;

  setupVillaFilter();

  const month=m.value;
  list.innerHTML="";
  let sum=0;

  let arr=state.jobs.map((j,i)=>({...j,_i:i}))
    .filter(j=>(j.date||"").startsWith(month));

  if(state.villaFilter!=="ALL"){
    arr=arr.filter(j=>j.villa===state.villaFilter);
  }

  if(!arr.length){
    list.innerHTML="<div>No hay trabajos</div>";
    t.textContent=`${state.currency} ${money(0)}`;
    return;
  }

  arr.forEach(j=>{
    const tot=jobTotal(j); sum+=tot;
    const hours = (j.start&&j.end&&j.rate)
      ? `${hoursBetween(j.start,j.end).toFixed(2)} h × ${money(j.rate)}`
      : "Monto fijo";

    const d=document.createElement("div");
    d.className="item";
    d.innerHTML=`
      <div class="title">${j.desc}</div>
      <div class="sub">${j.date}</div>
      <div class="sub">🏡 ${j.villa}</div>
      <div class="amount">${state.currency} ${money(tot)}</div>
      <div class="muted">${hours}</div>
      ${(j.expenses||[]).map((e,ei)=>`
        <div class="expense">
          <span>${e.desc} – ${money(e.amount)}</span>
          <button class="danger" onclick="deleteExpense(${j._i},${ei})">x</button>
        </div>`).join("")}
      <div class="actions">
        <button onclick="addExpense(${j._i})">+ Gasto</button>
        <button onclick="changeVilla(${j._i})">Cambiar villa</button>
        <button onclick="editJob(${j._i})">Editar</button>
        <button class="danger" onclick="deleteJob(${j._i})">Eliminar</button>
      </div>
    `;
    list.appendChild(d);
  });

  t.textContent=`${state.currency} ${money(sum)}`;
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded",()=>{
  load();
  const m=$("monthPick");
  if(m){
    m.value=monthISO(new Date());
    m.addEventListener("change",refreshJobs);
  }
  $("btnAddJob")?.addEventListener("click",addJob);
  setupVillaFilter();
  refreshJobs();
});

// Exponer
window.addExpense=addExpense;
window.deleteExpense=deleteExpense;
window.editJob=editJob;
window.deleteJob=deleteJob;
window.changeVilla=changeVilla;
