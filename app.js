const API_ROOT = 'http://localhost:8080';
const API_BASE = `${API_ROOT}/api`;

const adoptBtn    = document.getElementById('adopt-btn');
const nameInput   = document.getElementById('pet-name');
const statusSec   = document.getElementById('status-section');
const petTitle    = document.getElementById('pet-title');
const stateNameEl = document.getElementById('state-name');
const hungerBar   = document.getElementById('hunger-bar');
const happyBar    = document.getElementById('happy-bar');
const healthBar   = document.getElementById('health-bar');
const historyList = document.getElementById('history-list');
const invListCon  = document.getElementById('inventory-list');
const undoBtn     = document.getElementById('undo-btn');
const actionBtns  = document.querySelectorAll('.actions button[data-action]');

let actionHistory = [];
let invMap = {};

adoptBtn.addEventListener('click', adoptPet);
undoBtn.addEventListener('click', () => performAction('undo'));
actionBtns.forEach(btn =>
  btn.addEventListener('click', () => performAction(btn.dataset.action))
);

async function adoptPet() {
  const name = nameInput.value.trim();
  if (!name) return alert('Please enter a pet name.');

  const res = await fetch(`${API_BASE}/pet/adopt`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({name})
  });
  if (!res.ok) return alert('Adopt failed');
  const pet = await res.json();
  nameInput.value = '';
  resetHistory();
  await loadInventory();
  showStatus(pet);
}

async function performAction(action) {
  const url = `${API_BASE}/pet/${action==='undo'?'undo':'action'}`;
  const opts = action==='undo'
    ? { method: 'POST' }
    : {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({action})
      };

  const res = await fetch(url, opts);
  if (!res.ok) return alert(`${action} failed`);
  const pet = await res.json();
  await loadInventory();
  showStatus(pet);
  if (action !== 'undo') addHistory(action);
}

function showStatus(pet) {
  statusSec.classList.remove('hidden');
  petTitle.textContent    = pet.name.toUpperCase();
  stateNameEl.textContent = pet.state;
  hungerBar.value         = pet.hunger;
  happyBar.value          = pet.happiness;
  healthBar.value         = pet.health;

  // disable feed if no Pet Food stock
  // now disable each action if its stock is zero
    document.querySelector('[data-action="feed"]').disabled  = (invMap['Pet Food']   || 0) <= 0;
    document.querySelector('[data-action="play"]').disabled  = ((invMap['Ball']       || 0) + + (invMap['Chew Toy'] || 0)) <= 0;
    document.querySelector('[data-action="clean"]').disabled = (invMap['Treat']      || 0) <= 0;
    document.querySelector('[data-action="heal"]').disabled  = (invMap['Med Pack']   || 0) <= 0;
}

function addHistory(action) {
  const entry = `${new Date().toLocaleTimeString()}: ${action}`;
  actionHistory.unshift(entry);
  if (actionHistory.length > 10) actionHistory.pop();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  actionHistory.forEach(e => {
    const li = document.createElement('li');
    li.textContent = e;
    historyList.appendChild(li);
  });
}

function resetHistory() {
  actionHistory = [];
  renderHistory();
}

async function loadInventory() {
  const res = await fetch(`${API_BASE}/inventory`);
  if (!res.ok) {
    invListCon.textContent = 'Could not load inventory';
    return;
  }
  const inv = await res.json();

  // build name→qty map
  invMap = {};
  inv.children.forEach(cat =>
    cat.children.forEach(item => {
      invMap[item.name] = item.quantity;
    })
  );

  // render tree
  invListCon.innerHTML = '';
  renderInventory(inv, invListCon);
}

function renderInventory(node, container) {
  // create a <details> for each node
  const details = document.createElement('details');
  details.open = true;

  const summary = document.createElement('summary');
  summary.textContent = `${node.name} (${node.quantity})`;
  details.appendChild(summary);

  if (node.children) {
    node.children.forEach(child => {
      renderInventory(child, details);
    });
  }
  container.appendChild(details);
}

// initial load (if page refreshed mid‐session)
loadInventory();
