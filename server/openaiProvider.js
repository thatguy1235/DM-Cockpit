const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

const SYSTEM_PROMPT = `You are the AI engine inside DM-Cockpit, a private live D&D table operating system. You help the DM search, create, and modify campaign content. You must return only valid JSON. You never directly apply changes. You create structured proposal cards for the DM to approve.

For CREATE: Generate balanced D&D-style content as cards: abilities, items, monsters, NPCs, conditions, feats, spells, encounters, scene prompts, or notes.
For MODIFY: Return a proposed patch/change to an existing character, NPC, item, monster, encounter, or battlemap token.
For SEARCH: Search the provided currentStateSummary and return a concise answer card. If the answer is not in the provided state, say what information is missing instead of inventing.
For IMAGE_PROMPT: Return a cinematic image prompt card suitable for later image generation.`;

const proposalSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'body', 'proposalType', 'targetCardId', 'patch'],
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    proposalType: { type: 'string', enum: ['character_feature', 'item', 'monster', 'scene_image_prompt', 'rule_summary', 'npc', 'condition', 'feat', 'spell', 'encounter', 'note', 'token_update'] },
    targetCardId: { type: 'string' },
    patch: {
      type: 'object',
      additionalProperties: false,
      required: ['abilitiesAdd', 'inventoryAdd', 'statusAdd', 'tokenNameIncludes', 'log', 'createCard'],
      properties: {
        abilitiesAdd: { type: ['array', 'null'], items: { type: 'string' } },
        inventoryAdd: { type: ['array', 'null'], items: { type: 'string' } },
        statusAdd: { type: ['string', 'null'] },
        tokenNameIncludes: { type: ['string', 'null'] },
        log: { type: ['string', 'null'] },
        createCard: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'title', 'body', 'destination'],
              properties: {
                kind: { type: 'string' },
                title: { type: 'string' },
                body: { type: 'string' },
                destination: { type: 'string' }
              }
            }
          ]
        }
      }
    }
  },
}

function extractText(response) {
  if (response.output_text) return response.output_text;
  return (response.output || [])
    .flatMap(item => item.content || [])
    .filter(part => part.type === 'output_text' || part.text)
    .map(part => part.text || '')
    .join('\n');
}

async function callOpenAI({ mode, command, currentStateSummary, focusedEntityId }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const normalizedMode = String(mode || 'CREATE').toUpperCase();
  const userPrompt = JSON.stringify({ mode: normalizedMode, command, currentStateSummary: currentStateSummary || '', focusedEntityId: focusedEntityId || '' }, null, 2);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
        { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'dm_cockpit_card_proposal',
          strict: true,
          schema: proposalSchema,
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
  const json = await response.json();
  return { provider: 'openai', model: DEFAULT_MODEL, proposal: JSON.parse(extractText(json)) };
}

module.exports = { callOpenAI, DEFAULT_MODEL, SYSTEM_PROMPT, proposalSchema };
