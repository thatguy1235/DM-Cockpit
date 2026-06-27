const assert = require('assert');
const { state, createProposal, applyProposal, search, cloneToDestination, cardsFor } = require('../server/state');

assert(search('grapple').some(card => card.id === 'srd-grapple' && card.kind === 'rule'));
assert(state.cards.every(card => card.id && card.kind && card.title && card.destination));

const sent = cloneToDestination('srd-grapple', 'tv');
assert(sent);
assert.equal(sent.destination, 'tv');
assert(cardsFor('tv').some(card => card.id === sent.id));

const playerSent = cloneToDestination('srd-grapple', 'player', 'all');
assert.equal(playerSent.destination, 'player:all');

const logSent = cloneToDestination('srd-grapple', 'campaign-log');
assert.equal(logSent.destination, 'campaign-log');

const featureProposal = createProposal('Give Duran an ability that adds 4 beams to Eldritch Blast once per short rest.', 'MODIFY');
assert.equal(featureProposal.kind, 'proposal');
assert.equal(featureProposal.data.mode, 'MODIFY');
assert.equal(featureProposal.data.proposalType, 'character_feature');
assert.equal(featureProposal.data.status, 'pending');
applyProposal(featureProposal);
assert.equal(featureProposal.data.status, 'approved');
assert(state.cards.find(card => card.id === 'pc-duran').data.abilities.some(ability => ability.includes('Eldritch Barrage')));

const itemProposal = createProposal('Create a cursed sword for a level 5 barbarian.', 'CREATE');
assert.equal(itemProposal.data.proposalType, 'item');
applyProposal(itemProposal);
assert(state.cards.some(card => card.kind === 'item' && card.title.includes('Cursed Sword')));

const monsterProposal = createProposal('Make a CR 4 shadow wolf monster.', 'CREATE');
assert.equal(monsterProposal.data.proposalType, 'monster');
applyProposal(monsterProposal);
assert(state.cards.some(card => card.kind === 'monster' && card.title.includes('Shadow Wolf')));

const imageProposal = createProposal('Create a scene image prompt for a ruined moon cathedral.', 'IMAGE PROMPT');
assert.equal(imageProposal.data.proposalType, 'scene_image_prompt');
applyProposal(imageProposal);
assert(state.cards.some(card => card.kind === 'scene_image_prompt'));

const ruleProposal = createProposal('Summarize what the stunned condition does.', 'CREATE');
assert.equal(ruleProposal.data.proposalType, 'rule_summary');
assert(state.cardHistory.length > 0);
console.log('AI command center smoke tests passed');
