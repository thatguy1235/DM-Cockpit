let state = { cards: [], cardHistory: [], initiative: [] };
let mode = 'SEARCH';
const modes = ['SEARCH', 'CREATE', 'MODIFY', 'IMAGE PROMPT'];
const $ = id => document.getElementById(id);
const api = (url, body) => fetch(url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }).then(r => r.json());
const cardsFor = destination => state.cards.filter(card => card.destination === destination);
const playerCards = () => state.cards.filter(card => card.kind === 'player' && card.destination === 'dm-private');
const tokenCards = () => state.cards.filter(card => card.kind === 'token' && card.destination === 'battlemap');

function card(card) {
  const status = card.kind === 'proposal' ? `<span class="status ${card.data.status}">${card.data.status}</span>${card.data.fallbackNote ? `<p class="fallback">${card.data.fallbackNote}</p>` : ''}` : '';
  const proposalActions = card.kind === 'proposal' && card.data.status === 'pending'
    ? `<div class="actions"><button data-approve="${card.id}">Approve</button><button data-edit="${card.id}">Edit</button><button data-discard="${card.id}">Discard</button></div>`
    : '';
  return `<article class="card ${card.kind}" draggable="true" data-card="${card.id}">
    <small>${card.kind} • ${card.destination}</small>
    <h3>${card.title}</h3>
    <p>${card.body}</p>
    ${status}
    ${card.kind === 'proposal' ? `<pre>${JSON.stringify(card.data.patch, null, 2)}</pre>` : ''}
    <div class="actions"><button data-send-tv="${card.id}">Send to TV</button><button data-send-player="${card.id}">Send to Player</button><button data-add-log="${card.id}">Add to Campaign Log</button></div>
    ${proposalActions}
  </article>`;
}

function wireCards() {
  document.querySelectorAll('[data-card]').forEach(el => el.ondragstart = e => e.dataTransfer.setData('cardId', el.dataset.card));
  document.querySelectorAll('[data-send-tv]').forEach(button => button.onclick = () => api('/api/send', { cardId: button.dataset.sendTv, destination: 'tv' }));
  document.querySelectorAll('[data-send-player]').forEach(button => button.onclick = () => api('/api/send', { cardId: button.dataset.sendPlayer, destination: 'player', playerId: 'all' }));
  document.querySelectorAll('[data-add-log]').forEach(button => button.onclick = () => api('/api/send', { cardId: button.dataset.addLog, destination: 'campaign-log' }));
  document.querySelectorAll('[data-approve]').forEach(button => button.onclick = () => api(`/api/proposals/${button.dataset.approve}/approve`, {}));
  document.querySelectorAll('[data-discard]').forEach(button => button.onclick = () => api(`/api/proposals/${button.dataset.discard}/discard`, {}));
  document.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => editProposal(button.dataset.edit));
}

function render() {
  $('cards').innerHTML = cardsFor('dm-private').map(card).join('');
  $('pcs').innerHTML = playerCards().map(card).join('');
  $('initiative').innerHTML = state.initiative.map(name => `<li>${name}</li>`).join('');
  $('hud').innerHTML = state.cards.filter(card => card.destination === 'player:all' || card.kind === 'player').map(card).join('');
  $('spotlight').innerHTML = cardsFor('tv')[0] ? card(cardsFor('tv')[0]) : '<p>Drop a card here from the DM Cockpit for a cinematic reveal.</p>';
  $('tvInit').textContent = state.initiative.join(' → ');
  $('visibleTokens').textContent = 'Visible token cards: ' + tokenCards().map(token => token.data.name).join(', ');
  $('log').innerHTML = state.cardHistory.map(entry => `<p><small>${new Date(entry.at).toLocaleTimeString()}</small> ${entry.message}</p>`).join('');
  $('proposals').innerHTML = state.cards.filter(card => card.kind === 'proposal').map(card).join('');
  renderBoard();
  wireCards();
}

function renderBoard() {
  let html = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const tokens = tokenCards().filter(card => card.data.x === x && card.data.y === y).map(token => `<div class="token ${token.data.tokenKind}" draggable="true" data-token="${token.id}" title="${token.body} ${token.data.status.join(', ')}">${token.data.name[0]}<small>${token.data.status[0] || ''}</small></div>`).join('');
    html += `<div class="cell" data-x="${x}" data-y="${y}">${tokens}</div>`;
  }
  $('board').innerHTML = html;
  document.querySelectorAll('[data-token]').forEach(el => el.ondragstart = e => e.dataTransfer.setData('tokenId', el.dataset.token));
  document.querySelectorAll('.cell').forEach(cell => {
    cell.ondragover = e => e.preventDefault();
    cell.ondrop = e => {
      const tokenId = e.dataTransfer.getData('tokenId');
      if (tokenId) api(`/api/tokens/${tokenId}`, { x: +cell.dataset.x, y: +cell.dataset.y });
    };
  });
}

function dropZone(id, destination) {
  const el = $(id);
  el.ondragover = e => { e.preventDefault(); el.classList.add('over'); };
  el.ondragleave = () => el.classList.remove('over');
  el.ondrop = e => {
    e.preventDefault();
    el.classList.remove('over');
    const cardId = e.dataTransfer.getData('cardId');
    if (cardId) api('/api/send', { cardId, destination });
  };
}

function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  $('run').textContent = mode === 'SEARCH' ? 'Search card library' : 'Generate proposal card';
  $('command').placeholder = mode === 'SEARCH'
    ? 'Search every card: rules, notes, NPCs, items, monsters, spells, PCs, tokens, proposals…'
    : 'Ask mock AI for a safe structured proposal card…';
}
function editProposal(cardId) {
  const proposal = state.cards.find(card => card.id === cardId);
  if (!proposal) return;
  const body = prompt('Edit proposal summary:', proposal.body);
  if (body === null) return;
  const patchText = prompt('Edit structured JSON patch:', JSON.stringify(proposal.data.patch, null, 2));
  if (patchText === null) return;
  try { api(`/api/proposals/${cardId}/edit`, { body, patch: JSON.parse(patchText) }); }
  catch { alert('That JSON was invalid. Edit cancelled.'); }
}
$('run').onclick = async () => {
  const query = $('command').value;
  if (!query.trim()) return;
  const apiMode = mode === 'IMAGE PROMPT' ? 'IMAGE_PROMPT' : mode;
  const res = await api(mode === 'SEARCH' ? '/api/command' : '/api/ai/command', { mode: apiMode, query, command: query });
  if (mode === 'SEARCH') {
    $('results').innerHTML = res.results.map(card).join('');
    wireCards();
  } else {
    $('command').value = '';
    $('aiStatus').textContent = res.fallbackUsed ? 'Mock AI fallback used — add OPENAI_API_KEY to .env for real OpenAI responses.' : `OpenAI provider used${res.model ? ` (${res.model})` : ''}.`;
  }
};

document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => setMode(button.dataset.mode));
setMode('SEARCH');

dropZone('tvDrop', 'tv');
dropZone('battleDrop', 'battlemap');
dropZone('logDrop', 'campaign-log');
api('/api/state').then(next => { state = next; render(); });
const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
ws.onmessage = event => { const msg = JSON.parse(event.data); if (msg.type === 'state') { state = msg.state; render(); } };
