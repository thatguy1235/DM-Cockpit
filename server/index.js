const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { state, createProposal, createProposalFromAIObject, summarizeState, applyProposal, discardProposal, search, cloneToDestination, findCard, addHistory } = require('./state');
const { callOpenAI } = require('./openaiProvider');

function loadEnv() {
  const fs = require('fs');
  const envPath = require('path').join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['\"]|['\"]$/g, '');
  }
}
loadEnv();

const clients = new Set();
function sendFrame(sock, obj) {
  const data = Buffer.from(JSON.stringify(obj));
  let header;
  if (data.length < 126) header = Buffer.from([0x81, data.length]);
  else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(data.length, 2); }
  sock.write(Buffer.concat([header, data]));
}
function broadcast() { for (const client of clients) sendFrame(client, { type: 'state', state }); }
function parseBody(req) { return new Promise(resolve => { let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } }); }); }
function json(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/state') return json(res, 200, state);

  if (url.pathname === '/api/ai/command' && req.method === 'POST') {
    const body = await parseBody(req);
    const mode = String(body.mode || 'CREATE').replace('_', ' ').toUpperCase();
    const command = String(body.command || '');
    try {
      const ai = await callOpenAI({
        mode,
        command,
        currentStateSummary: body.currentStateSummary || summarizeState(),
        focusedEntityId: body.focusedEntityId,
      });
      const proposal = createProposalFromAIObject(ai.proposal, { mode, command, provider: ai.provider, model: ai.model });
      broadcast();
      return json(res, 200, { proposal, provider: ai.provider, model: ai.model, fallbackUsed: false });
    } catch (error) {
      const proposal = createProposal(command, mode);
      proposal.data.provider = 'mock';
      proposal.data.fallbackNote = `Mock AI fallback used: ${error.message}`;
      broadcast();
      return json(res, 200, { proposal, provider: 'mock', fallbackUsed: true, fallbackNote: proposal.data.fallbackNote });
    }
  }
  if (url.pathname === '/api/command' && req.method === 'POST') {
    const body = await parseBody(req);
    if (body.mode !== 'SEARCH') {
      const proposal = createProposal(body.query, body.mode);
      broadcast();
      return json(res, 200, { proposal });
    }
    return json(res, 200, { results: search(body.query) });
  }
  const proposalMatch = url.pathname.match(/^\/api\/proposals\/([^/]+)\/(approve|discard)$/);
  if (proposalMatch && req.method === 'POST') {
    const proposal = findCard(proposalMatch[1]);
    if (!proposal) return json(res, 404, { error: 'proposal card not found' });
    const result = proposalMatch[2] === 'approve' ? applyProposal(proposal) : discardProposal(proposal);
    broadcast();
    return json(res, 200, result);
  }

  const editMatch = url.pathname.match(/^\/api\/proposals\/([^/]+)\/edit$/);
  if (editMatch && req.method === 'POST') {
    const body = await parseBody(req);
    const proposal = findCard(editMatch[1]);
    if (!proposal || proposal.kind !== 'proposal') return json(res, 404, { error: 'proposal card not found' });
    if (body.body) proposal.body = String(body.body);
    if (body.patch) proposal.data.patch = body.patch;
    proposal.updatedAt = new Date().toISOString();
    addHistory(`Edited proposal card: ${proposal.title}.`);
    broadcast();
    return json(res, 200, proposal);
  }
  if (url.pathname === '/api/send' && req.method === 'POST') {
    const body = await parseBody(req);
    const sent = cloneToDestination(body.cardId, body.destination, body.playerId);
    if (!sent) return json(res, 404, { error: 'card not found' });
    broadcast();
    return json(res, 200, sent);
  }
  if (url.pathname === '/api/share' && req.method === 'POST') {
    const body = await parseBody(req);
    const sent = cloneToDestination(body.cardId, body.target, body.playerId);
    if (!sent) return json(res, 404, { error: 'card not found' });
    broadcast();
    return json(res, 200, sent);
  }
  const tokenMatch = url.pathname.match(/^\/api\/tokens\/([^/]+)$/);
  if (tokenMatch && req.method === 'POST') {
    const body = await parseBody(req);
    const token = findCard(tokenMatch[1]);
    if (!token || token.kind !== 'token') return json(res, 404, { error: 'token card not found' });
    token.data.x = body.x;
    token.data.y = body.y;
    token.updatedAt = new Date().toISOString();
    addHistory(`Moved token card "${token.title}" to ${body.x},${body.y}.`);
    broadcast();
    return json(res, 200, token);
  }
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const fp = path.join(__dirname, '..', 'public', file);
  if (!fp.startsWith(path.join(__dirname, '..', 'public'))) return res.end('no');
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); }
    else { res.writeHead(200, { 'content-type': fp.endsWith('.css') ? 'text/css' : fp.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(data); }
  });
});

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  clients.add(socket);
  sendFrame(socket, { type: 'state', state });
  socket.on('close', () => clients.delete(socket));
  socket.on('end', () => clients.delete(socket));
});

if (require.main === module) server.listen(3001, () => console.log('Dungeon Master OS on http://localhost:3001'));
module.exports = { server, broadcast };
