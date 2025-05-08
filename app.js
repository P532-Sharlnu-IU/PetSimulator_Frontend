const API_ROOT   = 'http://localhost:8080';
const PET_BASE   = `${API_ROOT}/api/pet`;
const PET_INV    = `${API_ROOT}/api/inventory`;
const PET_ADMIN   = `${API_ROOT}/api/admin`;

let selectedTypeId = null,
    actionHistory  = [],
    invMap         = {};

// screens
const welcomeScreen = document.getElementById('welcome-screen');
const selectScreen  = document.getElementById('select-screen');
const simScreen     = document.getElementById('sim-screen');

// select‐screen elems
const petTypesCon = document.getElementById('pet-types');
const nameInput   = document.getElementById('pet-name');
const adoptBtn    = document.getElementById('adopt-btn');

// simulator elems
const petTitle     = document.getElementById('pet-title');
const petImg       = document.getElementById('pet-img');
const stateNameEl  = document.getElementById('state-name');
const hungerBar    = document.getElementById('hunger-bar');
const happyBar     = document.getElementById('happy-bar');
const healthBar    = document.getElementById('health-bar');
const historyList  = document.getElementById('history-list');
const invListCon   = document.getElementById('inventory-list');
const undoBtn      = document.getElementById('undo-btn');
const resetBtn     = document.getElementById('reset-btn');
const actionBtns   = document.querySelectorAll('.action-btn');

// restock elems
const restockItem  = document.getElementById('restock-item');
const restockQty   = document.getElementById('restock-qty');
const restockBtn   = document.getElementById('restock-btn');

// wire up
document.getElementById('start-btn').addEventListener('click', enterSelect);
adoptBtn.addEventListener('click', adoptPet);
undoBtn.addEventListener('click', () => performAction('undo'));
resetBtn.addEventListener('click', resetGame);
actionBtns.forEach(b => b.addEventListener('click', () => performAction(b.dataset.action)));
restockBtn.addEventListener('click', doRestock);

// 1) Welcome → Select
async function enterSelect() {

  const res = await fetch(`${PET_ADMIN}/reset`, {
    method: 'POST'
  });
  if (!res.ok) {
    return alert('Could not reset game');
  }
  // blow away frontend state
  selectedTypeId = null;
  actionHistory  = [];
  invMap         = {};

  welcomeScreen.classList.add('hidden');
  selectScreen.classList.remove('hidden');
  loadPetTypes();
}

// 2) load pet‐types
async function loadPetTypes() {
  petTypesCon.textContent = 'Loading…';
  const res   = await fetch(`${PET_BASE}/types`);
  const types = await res.json();

  petTypesCon.innerHTML = '';
  types.forEach(({ id, name, imageUrl }) => {
    const c = document.createElement('div');
    c.className = 'pet-card';
    c.innerHTML = `
      <img src="${API_ROOT}${imageUrl}" alt="${name}">
      <div>${name}</div>
    `;
    c.addEventListener('click', () => {
      document.querySelectorAll('.pet-card')
              .forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      selectedTypeId = id;
    });
    petTypesCon.append(c);
  });
}

// 3) Adopt → Simulator
async function adoptPet() {
  const name = nameInput.value.trim();
  if (!selectedTypeId) return alert('Pick a pet type!');
  if (!name)            return alert('Enter a name!');

  const res = await fetch(`${PET_BASE}/adopt`, {
    method: 'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ name, typeId: selectedTypeId })
  });
  if (!res.ok) return alert('Adopt failed');
  const pet = await res.json();

  selectScreen.classList.add('hidden');
  simScreen.classList.remove('hidden');

  resetHistory();
  await loadInventory();
  showStatus(pet);
}

// show current pet status
function showStatus(p) {
  petTitle.textContent    = p.name.toUpperCase();
  petImg.src              = `${API_ROOT}${p.imageUrl}`;
  stateNameEl.textContent = p.state;
  hungerBar.value         = p.hunger;
  happyBar.value          = p.happiness;
  healthBar.value         = p.health;

  // disable feed if no food
  actionBtns.forEach(btn => {
    if (btn.dataset.action==='feed') {
      btn.disabled = (invMap['Pet Food']||0) <= 0;
    }
  });
}

// perform action / undo
async function performAction(action) {
  const url  = action==='undo' ? `${PET_BASE}/undo` : `${PET_BASE}/action`;
  const opts = action==='undo' ? { method:'POST' }
    : {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ action })
    };

  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = `${action} failed`;
    try { const err = await res.json(); if (err.error) msg = err.error; }
    catch(_) { /* ignore */ }
    return alert(msg);
  }
  const pet = await res.json();
  await loadInventory();
  showStatus(pet);
  if (action!=='undo') addHistory(action);
}

async function resetGame() {
  if (!confirm('Start a new game? This will erase all progress. Continue?')) {
    return;
  }
  // call backend to wipe & re‐seed everything
  const res = await fetch(`${PET_ADMIN}/reset`, {
    method: 'POST'
  });
  if (!res.ok) {
    return alert('Could not reset game');
  }
  // blow away frontend state
  selectedTypeId = null;
  actionHistory  = [];
  invMap         = {};

  // swap screens: go back to welcome
  simScreen.classList.add('hidden');
  selectScreen.classList.add('hidden');
  welcomeScreen.classList.remove('hidden');

  // clear any UI placeholders
  petTypesCon.innerHTML = '';
  historyList.innerHTML = '';
  invListCon.innerHTML  = '';
  nameInput.value       = '';
}

// history helpers
function addHistory(act) {
  actionHistory.unshift(`${new Date().toLocaleTimeString()}: ${act}`);
  if (actionHistory.length>10) actionHistory.pop();
  renderHistory();
}
function renderHistory() {
  historyList.innerHTML = '';
  actionHistory.forEach(txt => {
    const li = document.createElement('li');
    li.textContent = txt;
    historyList.append(li);
  });
}
function resetHistory() {
  actionHistory = [];
  renderHistory();
}

// load and render inventory + restock form
async function loadInventory() {
  invListCon.textContent = 'Loading…';
  const res = await fetch(`${PET_INV}`);
  if (!res.ok) {
    invListCon.textContent = 'Error';
    return;
  }
  const inv = await res.json();

  // build invMap
  invMap = {};
  inv.children.forEach(cat =>
    cat.children.forEach(item => invMap[item.name] = item.quantity)
  );

  // render tree
  invListCon.innerHTML = '';
  const build = (node, parent) => {
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.textContent = `${node.name} (${node.quantity})`;
    ul.append(li);
    parent.append(ul);
    if (node.children) node.children.forEach(c=>build(c, li));
  };
  build(inv, invListCon);

  // populate restock dropdown
  restockItem.innerHTML = `<option value="">-- select item --</option>`;
  Object.keys(invMap).forEach(name => {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = `${name} (${invMap[name]})`;
    restockItem.append(o);
  });
  restockQty.value = '';
}

// send restock request
async function doRestock() {
  const name = restockItem.value;
  const qty  = parseInt(restockQty.value, 10);
  if (!name || isNaN(qty) || qty <= 0) {
    return alert('Choose item and positive qty');
  }

  const res = await fetch(`${PET_INV}/restock`, {
    method: 'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ name, quantity: qty })
  });
  if (!res.ok) {
    return alert('Restock failed');
  }

  await loadInventory();
  restockQty.value = '';
}
