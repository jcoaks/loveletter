// End-to-end smoke test against a running Worker (default: `wrangler dev` on :8787).
// Creates a room, seats 3 players and 1 computer player, plays a full game over WebSockets
// with random legal moves, and checks pause/resume on reconnect, a forged seat token, a
// duplicate name and that views never carry hidden information.
//
//   pnpm --filter @loveletter/server smoke            # local
//   BASE=https://loveletter.example.workers.dev pnpm --filter @loveletter/server smoke

const BASE = process.env.BASE ?? 'http://localhost:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');
const NAMES = ['Ana', 'Beto', 'Carla'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (items) => items[Math.floor(Math.random() * items.length)];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

class Client {
  constructor(name, code) {
    this.name = name;
    this.code = code;
    this.room = null;
    this.errors = [];
    this.busy = false;
    this.acked = null;
  }

  connect(join) {
    // Never act on a view from a previous connection.
    this.room = null;
    this.lastTurn = null;
    this.busy = false;
    this.acked = null;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}/api/rooms/${this.code}/ws`);
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'join', ...join }));
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'welcome') {
          this.id = msg.playerId;
          this.token = msg.seatToken;
          resolve(this);
        } else if (msg.type === 'room') {
          this.room = msg.room;
          this.busy = false;
          this.ackTable();
        } else if (msg.type === 'error') {
          this.errors.push(`${this.name}:${msg.code}@${this.room?.game?.phase ?? 'sin vista'}`);
          this.busy = false;
          if (!this.id) reject(new Error(msg.code));
        }
      };
      ws.onerror = () => reject(new Error(`${this.name}: error de conexión`));
    });
  }

  send(message) {
    this.busy = true;
    this.ws.send(JSON.stringify(message));
  }

  /** Tells the room this screen finished showing the latest event, so bots may move. */
  ackTable() {
    const events = this.room?.game?.events;
    if (!events?.length) return;
    const moment = `ev-${events[events.length - 1].id}`;
    if (moment === this.acked) return;
    this.acked = moment;
    this.ws.send(JSON.stringify({ type: 'table_ready', moment }));
  }

  /** One random legal move if this player has to act, based only on its own view. */
  act() {
    const game = this.room?.game;
    if (!game || this.busy || this.room.pause) return;
    const turn = JSON.stringify([game.phase, game.events.length, game.roundOver?.youReady]);
    if (turn === this.lastTurn) return;
    let action = null;
    if (game.phase === 'round_over') {
      if (!game.roundOver.youReady) action = { type: 'continue_round' };
    } else if (game.phase === 'chancellor' && game.isMyTurn) {
      const c = game.chancellor;
      const keep = pick(c.keepOptions);
      const rest = [...c.hand];
      rest.splice(rest.indexOf(keep), 1);
      action = { type: 'chancellor_keep', keep, bottomOrder: rest };
    } else if (game.phase === 'turn' && game.isMyTurn) {
      const play = pick(game.legalPlays.filter((p) => p.playable));
      action = {
        type: 'play_card',
        card: play.card,
        ...(play.needsTarget ? { targetId: pick(play.targets) } : {}),
        ...(play.needsGuess ? { guess: pick(play.guesses) } : {}),
      };
    }
    if (action) {
      this.lastTurn = turn;
      this.send({ type: 'action', action });
    }
  }
}

async function waitFor(predicate, label, timeout = 10_000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) fail(`tiempo agotado esperando: ${label}`);
    await sleep(20);
  }
}

// 1. Create the room over HTTP.
const created = await fetch(`${BASE}/api/rooms`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: NAMES[0] }),
});
if (created.status !== 201) fail(`crear sala devolvió ${created.status}`);
const { code, seatToken } = await created.json();
console.log(`✓ sala creada ${code}`);

const info = await (await fetch(`${BASE}/api/rooms/${code.toLowerCase()}`)).json();
if (info.playerCount !== 1 || !info.joinable) fail(`info inesperada ${JSON.stringify(info)}`);
const missing = await fetch(`${BASE}/api/rooms/AAA-AAA`);
if (missing.status !== 404) fail('una sala inexistente debería dar 404');
const invalid = await fetch(`${BASE}/api/rooms`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'x' }),
});
if (invalid.status !== 400) fail('un nombre inválido debería dar 400');
console.log('✓ información de sala, 404 y validación de nombre');

// 2. Seat everyone: the host reclaims their seat by token, the rest join by name.
const clients = [await new Client(NAMES[0], code).connect({ seatToken })];
for (const name of NAMES.slice(1)) clients.push(await new Client(name, code).connect({ name }));
const forged = new Client('Intruso', code);
await forged.connect({ seatToken: '0'.repeat(32) }).then(
  () => fail('un token falso no debería entrar'),
  (error) => error.message === 'invalid_seat' || fail(`error inesperado ${error.message}`),
);
const dup = new Client('ana', code);
await dup.connect({ name: 'ANA' }).then(
  () => fail('un nombre repetido no debería entrar'),
  (error) => error.message === 'name_taken' || fail(`error inesperado ${error.message}`),
);
console.log('✓ 3 jugadores sentados; token falso y nombre repetido rechazados');

// 3. Add a computer player, ready up, start.
const [host] = clients;
host.send({ type: 'configure', config: { bots: 1 } });
await waitFor(() => host.room?.players.length === 4, 'el bot en la mesa');
clients[1].send({ type: 'configure', config: { bots: 0 } });
await waitFor(
  () => clients[1].errors.some((e) => e.includes('not_host')),
  'rechazo a no anfitrión',
);
clients[1].errors.length = 0;
for (const c of clients) c.send({ type: 'set_ready', ready: true });
await waitFor(() => host.room?.canStart, 'que todos estén listos');
host.send({ type: 'start' });
await waitFor(() => clients.every((c) => c.room?.status === 'playing'), 'el inicio de la partida');
const raw = JSON.stringify(clients.map((c) => c.room));
if (/"deck":|"setAside":|"hands":/.test(raw.replace(/"secret":\{[^}]*\}/g, ''))) {
  fail('se filtró el mazo, la carta apartada o manos ajenas');
}
for (const c of clients) {
  if (c.room.game.players.some((p) => p.hand)) fail('una vista incluye manos ajenas');
}
console.log('✓ partida empezada con 3 personas y 1 bot');

// 4. Play until the end, dropping and restoring one player after the first round.
let reconnected = false;
const start = Date.now();
while (host.room.status !== 'finished') {
  if (Date.now() - start > 240_000) fail('la partida no terminó en 240 s');
  if (!reconnected && host.room.game.history.length >= 1) {
    reconnected = true;
    const victim = clients[2];
    victim.ws.close();
    await waitFor(
      () => host.room.pause?.disconnectedIds.includes(victim.id),
      'la pausa por desconexión',
    );
    console.log('✓ la desconexión de un jugador pausa la partida');
    await victim.connect({ seatToken: victim.token });
    await waitFor(() => host.room.pause === null, 'que se reanude la partida');
    console.log('✓ el jugador recupera su asiento con su token y la partida sigue');
  }
  for (const c of clients) c.act();
  await sleep(15);
}

await waitFor(() => clients.every((c) => c.room.status === 'finished'), 'que todos vean el final');
const { winnerIds, history, round } = host.room.game;
const unexpected = clients.flatMap((c) => c.errors);
if (unexpected.length) fail(`errores inesperados durante la partida: ${unexpected.join(', ')}`);
if (!reconnected) fail('la partida terminó sin pasar por la desconexión');
const names = winnerIds.map((id) => host.room.players.find((p) => p.id === id)?.name);
console.log(
  `✓ partida terminada en ${round} rondas: gana ${names.join(' y ')} (${history.length + 1} resúmenes); ${host.room.chat.length} frases de bots`,
);

// 5. New game returns everyone to the lobby with the bot still seated.
host.send({ type: 'new_game' });
await waitFor(() => clients.every((c) => c.room.status === 'lobby'), 'volver a la sala');
if (host.room.players.filter((p) => p.bot).length !== 1) fail('el bot debería seguir en la mesa');
console.log('✓ nueva partida: de vuelta en la sala de espera');

for (const c of clients) c.ws.close();
console.log('✓ prueba de humo completa');
process.exit(0);
