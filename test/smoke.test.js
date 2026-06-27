const assert=require('assert');const {state,createProposal,applyProposal,search}=require('../server/state');
assert(search('grapple').some(r=>r.id==='srd-grapple'));
const p=createProposal('Give the PC Duran an ability that lets him add 4 more beams to his Eldritch Blast.');
assert.equal(p.status,'pending');assert.equal(p.target,'duran');state.proposals.unshift(p);applyProposal(p);assert.equal(p.status,'approved');assert(state.characters.find(c=>c.id==='duran').abilities.some(a=>a.includes('Eldritch Barrage')));
console.log('smoke tests passed');
