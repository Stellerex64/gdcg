import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

/**
 * Simple in-memory lobby+game server (single room demo).
 * For production, persist to a DB and support multiple rooms.
 */

const app = express();
const server = http.createServer(app);

const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED.length === 0 || ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.get('/', (_req, res) => res.send('GDCG Server OK'));

const io = new Server(server, {
  cors: {
    origin: ALLOWED.length ? ALLOWED : true,
    credentials: true
  }
});

// ---- Game State (single-room demo) ----
const state = {
  hostSocketId: null,
  maxPlayers: null, // 3..7 decided by host
  players: [],      // { id, name }
  spectators: [],   // { id }
  started: false,
  turnIndex: 0,
  decks: {
    Audience: [], Theme: [], Tone: [], Genre: [], Fiction: [], Action: []
  },
  tableaus: {},     // socketId -> [{type,title,meta}]
  hands: {},        // socketId -> [{type,title,meta}]
};

function broadcast() {
  io.emit('state:public', {
    started: state.started,
    maxPlayers: state.maxPlayers,
    players: state.players.map(p => ({ id: p.id, name: p.name })),
    spectators: state.spectators.map(s => s.id),
    currentTurn: state.players[state.turnIndex]?.id || null,
    tableaus: state.tableaus,
    deckSizes: Object.fromEntries(Object.entries(state.decks).map(([k,v]) => [k, v.length]))
  });
}

// send private hand to a player
function sendPrivate(socket) {
  socket.emit('state:private', {
    you: {
      id: socket.id,
      name: state.players.find(p=>p.id===socket.id)?.name || null
    },
    hand: state.hands[socket.id] || []
  });
}

io.on('connection', (socket) => {
  // initial ping
  socket.emit('server:hello', { ok: true });

  socket.on('host:create', ({ maxPlayers, name }) => {
    if (state.hostSocketId && state.hostSocketId !== socket.id) {
      socket.emit('error:toast', 'Host already exists.');
      return;
    }
    if (!(Number(maxPlayers) >= 3 && Number(maxPlayers) <= 7)) {
      socket.emit('error:toast', 'maxPlayers must be between 3 and 7');
      return;
    }
    state.hostSocketId = socket.id;
    state.maxPlayers = Number(maxPlayers);
    // add host as first player
    if (!state.players.find(p => p.id === socket.id)) {
      state.players.push({ id: socket.id, name: name?.slice(0,40) || 'Host' });
      state.hands[socket.id] = [];
      state.tableaus[socket.id] = [];
    }
    broadcast();
    sendPrivate(socket);
  });

  socket.on('player:join', ({ name }) => {
    if (!state.maxPlayers) {
      socket.emit('error:toast', 'Host has not created a match yet.');
      return;
    }
    if (state.started) {
      socket.emit('error:toast', 'Game already started. Viewing as spectator.');
      state.spectators.push({ id: socket.id });
      broadcast();
      return;
    }
    if (state.players.length >= state.maxPlayers) {
      // join as spectator
      state.spectators.push({ id: socket.id });
      broadcast();
      return;
    }
    // join as player
    state.players.push({ id: socket.id, name: name?.slice(0,40) || 'Player' });
    state.hands[socket.id] = [];
    state.tableaus[socket.id] = [];
    broadcast();
    sendPrivate(socket);
  });

  socket.on('host:start', () => {
    if (socket.id !== state.hostSocketId) {
      socket.emit('error:toast', 'Only host can start.');
      return;
    }
    if (state.players.length !== state.maxPlayers) {
      socket.emit('error:toast', 'Need full lobby to start.');
      return;
    }
    // initialize decks minimally (placeholder shuffles)
    const genCards = (type, n) => Array.from({length:n}, (_,i)=>({type, title:`${type} ${i+1}`}));
    state.decks.Audience = genCards('Audience', 32);
    state.decks.Theme    = genCards('Theme', 32);
    state.decks.Tone     = genCards('Tone', 32);
    state.decks.Genre    = genCards('Genre', 32);
    state.decks.Fiction  = genCards('Fiction', 32);
    state.decks.Action   = genCards('Action', 32);

    // deal 5 constraint cards to each player (no Actions)
    const drawFrom = (deckName) => state.decks[deckName].pop();
    const constraintDecks = ['Audience','Theme','Tone','Genre','Fiction'];
    const pickRandomConstraint = () => {
      const name = constraintDecks[Math.floor(Math.random()*constraintDecks.length)];
      return drawFrom(name);
    };

    state.players.forEach(p => {
      state.hands[p.id] = [];
      for (let i=0; i<5; i++) {
        state.hands[p.id].push(pickRandomConstraint());
      }
      state.tableaus[p.id] = [];
    });

    // pick random starting player
    state.turnIndex = Math.floor(Math.random()*state.players.length);
    state.started = true;
    broadcast();
    // send private hands
    state.players.forEach(p => {
      const sock = io.sockets.sockets.get(p.id);
      if (sock) sendPrivate(sock);
    });
  });

  socket.on('turn:draw', ({ deck }) => {
    if (!state.started) return;
    const current = state.players[state.turnIndex]?.id;
    if (socket.id !== current) return;
    if (!state.decks[deck] || state.decks[deck].length === 0) return;
    const card = state.decks[deck].pop();
    state.hands[socket.id] = state.hands[socket.id] || [];
    state.hands[socket.id].push(card);
    sendPrivate(socket);
    broadcast();
  });

  socket.on('turn:playConstraint', ({ index }) => {
    if (!state.started) return;
    const current = state.players[state.turnIndex]?.id;
    if (socket.id !== current) return;
    const hand = state.hands[socket.id] || [];
    if (index < 0 || index >= hand.length) return;
    const card = hand[index];
    // simple validation: only constraint types allowed here
    if (!['Audience','Theme','Tone','Genre','Fiction'].includes(card.type)) return;
    state.tableaus[socket.id] = state.tableaus[socket.id] || [];
    // prevent duplicate type in tableau
    if (state.tableaus[socket.id].some(c => c.type === card.type)) return;
    state.tableaus[socket.id].push(card);
    hand.splice(index,1);
    sendPrivate(socket);
    broadcast();
  });

  socket.on('turn:discard', ({ index }) => {
    if (!state.started) return;
    const current = state.players[state.turnIndex]?.id;
    if (socket.id !== current) return;
    const hand = state.hands[socket.id] || [];
    if (index < 0 || index >= hand.length) return;
    const card = hand.splice(index,1)[0];
    // recycle to bottom of the correct deck
    state.decks[card.type].unshift(card);
    sendPrivate(socket);
    broadcast();
  });

  socket.on('turn:end', () => {
    if (!state.started) return;
    const current = state.players[state.turnIndex]?.id;
    if (socket.id !== current) return;
    state.turnIndex = (state.turnIndex + 1) % state.players.length;
    broadcast();
  });

  socket.on('commit:try', () => {
    // Start-of-turn check + 5 constraints check would go here (not fully implemented)
    // For demo, we just acknowledge.
    socket.emit('info:toast', 'Commit attempt received (demo).');
  });

  socket.on('disconnect', () => {
    // Remove from players/spectators. If host leaves, game persists in demo.
    state.players = state.players.filter(p => p.id !== socket.id);
    delete state.hands[socket.id];
    delete state.tableaus[socket.id];
    state.spectators = state.spectators.filter(s => s.id !== socket.id);
    if (state.hostSocketId === socket.id) state.hostSocketId = null;
    broadcast();
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log('GDCG server listening on', PORT);
});
