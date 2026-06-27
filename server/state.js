const now = () => new Date().toISOString();
const makeCard = ({ id, kind, title, body, owner = 'dm', destination = 'dm-private', data = {} }) => ({
  id,
  kind,
  title,
  body,
  owner,
  destination,
  data,
  createdAt: now(),
  updatedAt: now(),
});

const state = {
  cards: [
    makeCard({ id: 'pc-duran', kind: 'player', title: 'Duran', body: 'Warlock 5 • HP 34/38 • AC 15', data: { className: 'Warlock', level: 5, hp: 34, maxHp: 38, ac: 15, conditions: [], resources: { spellSlots: 2 }, abilities: ['Eldritch Blast'], inventory: ['Arcane focus'] } }),
    makeCard({ id: 'pc-bonnie', kind: 'player', title: 'Bonnie', body: 'Bard 5 • HP 31/35 • AC 14', data: { className: 'Bard', level: 5, hp: 31, maxHp: 35, ac: 14, conditions: [], resources: { bardicInspiration: 4 }, abilities: ['Bardic Inspiration'], inventory: ['Lute'] } }),
    makeCard({ id: 'pc-trent', kind: 'player', title: 'Trent', body: 'Fighter 5 • HP 44/48 • AC 18', data: { className: 'Fighter', level: 5, hp: 44, maxHp: 48, ac: 18, conditions: [], resources: { secondWind: 1 }, abilities: ['Action Surge'], inventory: ['Grappling hook'] } }),
    makeCard({ id: 'srd-grapple', kind: 'rule', title: 'Grappled (SRD)', body: 'A grappled creature has speed 0. The condition ends if the grappler is incapacitated or an effect removes the creature from reach.' }),
    makeCard({ id: 'npc-mira', kind: 'npc', title: 'Mira Vell', body: 'Moon-cult archivist with private campaign notes. User-authored homebrew slot.' }),
    makeCard({ id: 'spell-eb', kind: 'spell', title: 'Eldritch Blast (SRD reference)', body: 'A ranged spell attack can create more beams at higher levels. Keep proprietary text out; add private notes manually.' }),
    makeCard({ id: 'tok-duran', kind: 'token', title: 'Duran Token', body: 'Battlemap token • HP 34/38', destination: 'battlemap', data: { name: 'Duran', x: 1, y: 1, hp: 34, maxHp: 38, status: [], tokenKind: 'pc' } }),
    makeCard({ id: 'tok-goblin', kind: 'token', title: 'Goblin Token', body: 'Battlemap token • HP 7/7', destination: 'battlemap', data: { name: 'Goblin', x: 5, y: 4, hp: 7, maxHp: 7, status: [], tokenKind: 'monster' } }),
  ],
  cardHistory: [{ at: now(), message: 'Session started in local-first card mode.' }],
  initiative: ['Duran', 'Bonnie', 'Trent'],
};

const addHistory = message => state.cardHistory.unshift({ at: now(), message });
const cardsFor = destination => state.cards.filter(card => card.destination === destination);
const findCard = id => state.cards.find(card => card.id === id);
const playerCards = () => state.cards.filter(card => card.kind === 'player');
const tokenCards = () => state.cards.filter(card => card.kind === 'token');

function cloneToDestination(cardId, destination, playerId = 'all') {
  const card = findCard(cardId);
  if (!card) return null;
  const target = destination === 'player' ? `player:${playerId}` : destination;
  const copy = { ...card, id: `${card.id}-${Date.now()}`, destination: target, updatedAt: now() };
  state.cards.unshift(copy);
  addHistory(`Sent "${card.title}" to ${target}.`);
  return copy;
}

function createProposal(prompt, mode = 'CREATE') {
  const text = String(prompt || '');
  const p = text.toLowerCase();
  const id = `proposal-${Date.now()}`;
  const proposalMode = String(mode || 'CREATE').toUpperCase();
  let proposalType = 'rule_summary';
  let summary = `Summarize rule or table question: ${text}`;
  let targetCardId = 'campaign-log';
  let patch = { createCard: { kind: 'rule_summary', title: 'Rule Summary', body: `Mock AI summary: ${text}`, destination: 'dm-private', data: { source: 'mock-ai', mode: proposalMode } } };

  if (proposalMode === 'IMAGE PROMPT' || p.includes('image') || p.includes('scene')) {
    proposalType = 'scene_image_prompt';
    targetCardId = 'tv';
    summary = 'Create a scene image prompt card.';
    patch = { createCard: { kind: 'scene_image_prompt', title: 'Ruined Moon Cathedral Image Prompt', body: `Cinematic fantasy image prompt: ${text}`, destination: 'dm-private', data: { source: 'mock-ai', mode: proposalMode } } };
  } else if (p.includes('duran') && p.includes('eldritch')) {
    proposalType = 'character_feature';
    targetCardId = 'pc-duran';
    summary = 'Give Duran a once-per-short-rest Eldritch Blast beam feature.';
    patch = { abilitiesAdd: ['Homebrew Feature: Eldritch Barrage — once per short rest, add 4 beams to Eldritch Blast.'] };
  } else if (p.includes('sword')) {
    proposalType = 'item';
    summary = 'Create a cursed sword item card.';
    patch = { createCard: { kind: 'item', title: 'Cursed Sword of Hungry Echoes', body: 'Level 5 magic weapon concept: a shadowed blade with a tempting damage boon and a narrative curse for DM review.', destination: 'dm-private', data: { source: 'mock-ai', mode: proposalMode, rarity: 'uncommon', curse: true } } };
  } else if (p.includes('monster') || p.includes('wolf')) {
    proposalType = 'monster';
    summary = 'Create a CR 4 shadow wolf monster card.';
    patch = { createCard: { kind: 'monster', title: 'CR 4 Shadow Wolf', body: 'Large shadow-touched wolf concept with pack tactics, dim-light ambush flavor, and fear-forward encounter hooks for DM review.', destination: 'dm-private', data: { source: 'mock-ai', mode: proposalMode, cr: 4, hp: 75, ac: 14 } } };
  }

  const proposal = makeCard({
    id,
    kind: 'proposal',
    title: `AI ${proposalMode} Proposal`,
    body: summary,
    data: { prompt: text, mode: proposalMode, proposalType, targetCardId, patch, status: 'pending' },
  });
  state.cards.unshift(proposal);
  addHistory(`Mock AI created ${proposalType} proposal card: ${summary}`);
  return proposal;
}
function createProposalFromAIObject(aiProposal, { mode = 'CREATE', command = '', provider = 'openai', model = '', fallbackNote = '' } = {}) {
  const proposalType = aiProposal.proposalType || 'note';
  const patch = aiProposal.patch || { log: aiProposal.body || command };
  const proposal = makeCard({
    id: `proposal-${Date.now()}`,
    kind: 'proposal',
    title: aiProposal.title || `AI ${mode} Proposal`,
    body: aiProposal.body || 'AI-created proposal for DM review.',
    data: {
      prompt: command,
      mode: String(mode || 'CREATE').toUpperCase(),
      proposalType,
      targetCardId: aiProposal.targetCardId || 'campaign-log',
      patch,
      status: 'pending',
      provider,
      model,
      fallbackNote,
    },
  });
  state.cards.unshift(proposal);
  addHistory(`${provider === 'mock' ? 'Mock AI fallback' : 'OpenAI'} created ${proposalType} proposal card: ${proposal.body}`);
  return proposal;
}

function summarizeState() {
  return state.cards.map(card => `${card.id} [${card.kind}] ${card.title}: ${card.body}`).join('\n').slice(0, 6000);
}

function applyProposal(proposalCard) {
  if (!proposalCard || proposalCard.kind !== 'proposal') return null;
  const { patch, targetCardId } = proposalCard.data;
  proposalCard.data.status = 'approved';
  proposalCard.updatedAt = now();
  const target = findCard(targetCardId);
  if (target && target.kind === 'player') {
    if (patch.abilitiesAdd) target.data.abilities.push(...patch.abilitiesAdd);
    if (patch.inventoryAdd) target.data.inventory.push(...patch.inventoryAdd);
    target.body = `${target.data.className} ${target.data.level} • HP ${target.data.hp}/${target.data.maxHp} • AC ${target.data.ac}`;
    target.updatedAt = now();
  }
  if (patch.statusAdd) {
    tokenCards().filter(card => card.data.name.toLowerCase().includes(String(patch.tokenNameIncludes))).forEach(card => {
      card.data.status.push(patch.statusAdd);
      card.updatedAt = now();
    });
  }
  if (patch.createCard) {
    const created = makeCard({ id: `card-${Date.now()}`, ...patch.createCard });
    state.cards.unshift(created);
    addHistory(`Approved proposal created ${created.kind} card: ${created.title}`);
  }
  if (patch.log) addHistory(patch.log);
  addHistory(`Approved proposal card: ${proposalCard.body}`);
  return proposalCard;
}

function discardProposal(proposalCard) {
  if (!proposalCard || proposalCard.kind !== 'proposal') return null;
  proposalCard.data.status = 'discarded';
  proposalCard.updatedAt = now();
  addHistory(`Discarded proposal card: ${proposalCard.body}`);
  return proposalCard;
}

function search(query) {
  const q = String(query || '').toLowerCase();
  return state.cards.filter(card => `${card.kind} ${card.title} ${card.body}`.toLowerCase().includes(q));
}

module.exports = { state, makeCard, addHistory, cardsFor, findCard, playerCards, tokenCards, cloneToDestination, createProposal, createProposalFromAIObject, summarizeState, applyProposal, discardProposal, search };
