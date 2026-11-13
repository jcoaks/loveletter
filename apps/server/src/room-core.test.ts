import { type PlayerView, seededRandom } from '@loveletter/engine';
import { type ClientMessage, HOST_CAN_END_AFTER_MS, tableMoment } from '@loveletter/protocol';
import { describe, expect, it } from 'vitest';
import {
  addSeat,
  BOT_HOLD_MAX_MS,
  connectSeat,
  createRoom,
  disconnectSeat,
  findSeatByTokenHash,
  handleMessage,
  momentOf,
  pendingBot,
  planBotMove,
  playBot,
  type RoomContext,
  type RoomData,
  roomInfo,
  roomStatus,
  roomView,
} from './room-core';

const NAMES = ['Ana', 'Beto', 'Carla', 'Dani', 'Eva', 'Fede', 'Gala'];

function ctx(connected: Iterable<string>, now = 1_000, seed = 5): RoomContext {
  return { now, connected: new Set(connected), random: seededRandom(seed) };
}

/** A lobby with `n` connected seats s1..sn; s1 is the host. */
function lobby(n: number): { data: RoomData; all: string[] } {
  const data = createRoom('KX7QM2', 0);
  const all: string[] = [];
  for (let i = 0; i < n; i++) {
    const result = addSeat(data, NAMES[i] as string, `hash${i}`, ctx(all));
    if (!result.ok) throw new Error(result.message);
    all.push(result.seat?.id as string);
    connectSeat(data, all[i] as string, ctx(all));
  }
  return { data, all };
}

function expectOk(result: ReturnType<typeof handleMessage>): void {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
}

function codeOf(result: ReturnType<typeof handleMessage>): string | null {
  return result.ok ? null : result.code;
}

/** `humans` connected people plus `bots` computer players, everybody ready and playing. */
function started(humans: number, bots = 0, seed = 5): { data: RoomData; all: string[] } {
  const room = lobby(humans);
  if (bots > 0) {
    expectOk(
      handleMessage(room.data, 's1', { type: 'configure', config: { bots } }, ctx(room.all)),
    );
  }
  for (const id of room.all) {
    expectOk(handleMessage(room.data, id, { type: 'set_ready', ready: true }, ctx(room.all)));
  }
  expectOk(handleMessage(room.data, 's1', { type: 'start' }, ctx(room.all, 1_000, seed)));
  return room;
}

/** What a simple human would do with this view, or null when it is not their move. */
function humanMove(view: PlayerView): ClientMessage | null {
  if (view.phase === 'round_over') {
    return view.roundOver?.youReady ? null : { type: 'action', action: { type: 'continue_round' } };
  }
  if (!view.isMyTurn) return null;
  if (view.phase === 'chancellor' && view.chancellor) {
    const [keep, ...rest] = view.chancellor.hand;
    return {
      type: 'action',
      action: { type: 'chancellor_keep', keep: keep as number, bottomOrder: rest },
    };
  }
  const options = view.legalPlays.filter((p) => p.playable);
  const play = options.find((p) => p.card !== 9) ?? options[0];
  if (!play) return null;
  return {
    type: 'action',
    action: {
      type: 'play_card',
      card: play.card,
      ...(play.needsTarget ? { targetId: play.targets[0] } : {}),
      ...(play.needsGuess ? { guess: play.guesses[0] } : {}),
    },
  };
}

/** Plays the whole game: bots through `playBot`, humans through `humanMove`. */
function playOut(data: RoomData, humans: string[], all: string[], maxSteps = 4000): void {
  for (let step = 0; step < maxSteps && roomStatus(data) === 'playing'; step++) {
    if (pendingBot(data)) {
      expect(playBot(data, ctx(all, 1_000 + step, step))).toBe(true);
      continue;
    }
    let moved = false;
    for (const id of humans) {
      const view = roomView(data, id, ctx(all)).game;
      const message = view && humanMove(view);
      if (!message) continue;
      expectOk(handleMessage(data, id, message, ctx(all, 1_000 + step, step)));
      moved = true;
      break;
    }
    if (!moved) throw new Error(`Nadie puede mover en ${data.game?.phase}`);
  }
}

describe('asientos', () => {
  it('el primero en sentarse es el anfitrión', () => {
    const { data } = lobby(3);
    expect(data.hostId).toBe('s1');
    expect(data.seats.map((s) => s.name)).toEqual(['Ana', 'Beto', 'Carla']);
    expect(roomView(data, 's2', ctx(['s1', 's2', 's3'])).players.map((p) => p.host)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('no permite nombres repetidos, aunque cambien tildes o mayúsculas', () => {
    const { data, all } = lobby(1);
    expect(addSeat(data, 'Ines', 'h', ctx(all)).ok).toBe(true);
    const repeated = addSeat(data, 'INÉS', 'h2', ctx(all));
    expect(repeated.ok || repeated.code).toBe('name_taken');
  });

  it('valida el largo del nombre', () => {
    const { data, all } = lobby(1);
    const short = addSeat(data, ' a ', 'h', ctx(all));
    expect(short.ok || short.code).toBe('bad_message');
    const long = addSeat(data, 'x'.repeat(21), 'h', ctx(all));
    expect(long.ok || long.code).toBe('bad_message');
  });

  it('no admite más de 6 jugadores', () => {
    const { data, all } = lobby(6);
    const extra = addSeat(data, 'Karla', 'h', ctx(all));
    expect(extra.ok || extra.code).toBe('room_full');
    expect(roomInfo(data).joinable).toBe(false);
  });

  it('no admite jugadores nuevos con la partida empezada', () => {
    const { data, all } = started(3);
    const late = addSeat(data, 'Karla', 'h', ctx(all));
    expect(late.ok || late.code).toBe('game_in_progress');
  });

  it('reconoce el asiento por el hash del token y no admite hashes vacíos', () => {
    const { data } = lobby(2);
    expect(findSeatByTokenHash(data, 'hash1')?.id).toBe('s2');
    expect(findSeatByTokenHash(data, 'nope')).toBeUndefined();
    handleMessage(data, 's1', { type: 'configure', config: { bots: 1 } }, ctx(['s1', 's2']));
    expect(findSeatByTokenHash(data, '')).toBeUndefined();
  });

  it('reconectar devuelve el asiento y quita la marca de abandono', () => {
    const { data, all } = started(3);
    disconnectSeat(data, 's2', ctx(['s1', 's3'], 2_000));
    expect(roomStatus(data)).toBe('paused');
    connectSeat(data, 's2', ctx(all, 3_000));
    expect(roomStatus(data)).toBe('playing');
  });

  it('la sala informa de sus jugadores', () => {
    const { data } = lobby(3);
    expect(roomInfo(data)).toMatchObject({
      code: 'KX7QM2',
      status: 'lobby',
      playerCount: 3,
      joinable: true,
      hostName: 'Ana',
      playerNames: ['Ana', 'Beto', 'Carla'],
    });
  });
});

describe('sala de espera', () => {
  it('solo el anfitrión configura, expulsa y empieza', () => {
    const { data, all } = lobby(3);
    const c = ctx(all);
    expect(codeOf(handleMessage(data, 's2', { type: 'configure', config: { bots: 1 } }, c))).toBe(
      'not_host',
    );
    expect(codeOf(handleMessage(data, 's2', { type: 'kick', playerId: 's3' }, c))).toBe('not_host');
    expect(codeOf(handleMessage(data, 's2', { type: 'start' }, c))).toBe('not_host');
  });

  it('un mensaje de un asiento inexistente se rechaza', () => {
    const { data, all } = lobby(2);
    expect(codeOf(handleMessage(data, 'zz', { type: 'start' }, ctx(all)))).toBe('invalid_seat');
  });

  it('expulsar quita el asiento; no se puede expulsar a uno mismo ni a un bot', () => {
    const { data, all } = lobby(4);
    const result = handleMessage(data, 's1', { type: 'kick', playerId: 's3' }, ctx(all));
    expect(result).toEqual({ ok: true, kicked: 's3' });
    expect(data.seats.map((s) => s.id)).not.toContain('s3');
    expect(codeOf(handleMessage(data, 's1', { type: 'kick', playerId: 's1' }, ctx(all)))).toBe(
      'invalid_seat',
    );
    expect(codeOf(handleMessage(data, 's1', { type: 'kick', playerId: 'zz' }, ctx(all)))).toBe(
      'invalid_seat',
    );
  });

  it('configura 0 a 5 bots según el espacio, con nombres libres y sin repetirse', () => {
    const { data, all } = lobby(2);
    expectOk(handleMessage(data, 's1', { type: 'configure', config: { bots: 4 } }, ctx(all)));
    expect(data.seats).toHaveLength(6);
    expect(data.config.bots).toBe(4);
    const names = data.seats.filter((s) => s.bot).map((s) => s.name);
    expect(new Set(names).size).toBe(4);
    expect(names).not.toContain('Ana');
    const view = roomView(data, 's2', ctx(all));
    expect(view.players.filter((p) => p.bot).every((p) => p.ready && p.connected)).toBe(true);
    expect(view.config.bots).toBe(4);

    expect(
      codeOf(handleMessage(data, 's1', { type: 'configure', config: { bots: 5 } }, ctx(all))),
    ).toBe('invalid_config');
    expect(data.config.bots).toBe(4);
    expectOk(handleMessage(data, 's1', { type: 'configure', config: { bots: 1 } }, ctx(all)));
    expect(data.seats).toHaveLength(3);
    expectOk(handleMessage(data, 's1', { type: 'configure', config: {} }, ctx(all)));
    expectOk(handleMessage(data, 's1', { type: 'configure', config: { bots: 0 } }, ctx(all)));
    expect(data.seats.every((s) => !s.bot)).toBe(true);
  });

  it('una persona que llega a una mesa llena de bots ocupa el lugar de uno', () => {
    const { data, all } = lobby(1);
    expectOk(handleMessage(data, 's1', { type: 'configure', config: { bots: 5 } }, ctx(all)));
    expect(roomInfo(data).joinable).toBe(true);
    expect(addSeat(data, 'Beto', 'h', ctx(all)).ok).toBe(true);
    expect(data.seats).toHaveLength(6);
    expect(data.config.bots).toBe(4);
    expect(roomInfo(data).joinable).toBe(true);
  });

  it('los bots no son anfitriones ni pueden enviar mensajes', () => {
    const { data, all } = lobby(2);
    expectOk(handleMessage(data, 's1', { type: 'configure', config: { bots: 1 } }, ctx(all)));
    const bot = data.seats.find((s) => s.bot)?.id as string;
    expect(codeOf(handleMessage(data, bot, { type: 'start' }, ctx(all)))).toBe('invalid_seat');
    handleMessage(data, 's1', { type: 'leave' }, ctx(all));
    expect(data.hostId).toBe('s2');
    handleMessage(data, 's2', { type: 'leave' }, ctx(all));
    expect(data.hostId).toBeNull();
  });

  it('no empieza con menos de 2 jugadores, ni sin todos listos y conectados', () => {
    const solo = lobby(1);
    handleMessage(solo.data, 's1', { type: 'set_ready', ready: true }, ctx(solo.all));
    expect(codeOf(handleMessage(solo.data, 's1', { type: 'start' }, ctx(solo.all)))).toBe(
      'not_enough_players',
    );
    expect(roomView(solo.data, 's1', ctx(solo.all)).canStart).toBe(false);

    const { data, all } = lobby(3);
    expect(codeOf(handleMessage(data, 's1', { type: 'start' }, ctx(all)))).toBe(
      'not_everyone_ready',
    );
    for (const id of all) handleMessage(data, id, { type: 'set_ready', ready: true }, ctx(all));
    expect(codeOf(handleMessage(data, 's1', { type: 'start' }, ctx(all.slice(1))))).toBe(
      'not_everyone_ready',
    );
    expect(roomView(data, 's1', ctx(all)).canStart).toBe(true);
    expectOk(handleMessage(data, 's1', { type: 'start' }, ctx(all)));
    expect(roomStatus(data)).toBe('playing');
    expect(data.seats.every((s) => !s.ready)).toBe(true);
    expect(codeOf(handleMessage(data, 's1', { type: 'start' }, ctx(all)))).toBe('not_in_lobby');
    expect(codeOf(handleMessage(data, 's2', { type: 'set_ready', ready: true }, ctx(all)))).toBe(
      'not_in_lobby',
    );
  });

  it.each([2, 3, 4, 5, 6])('empieza con %i jugadores en total (humanos y bots)', (total) => {
    const { data } = started(1, total - 1);
    expect(data.game?.players).toHaveLength(total);
    expect(data.game?.players.filter((p) => p.bot)).toHaveLength(total - 1);
  });

  it('abandonar la sala de espera quita el asiento y traspasa el anfitrión', () => {
    const { data, all } = lobby(3);
    expect(handleMessage(data, 's1', { type: 'leave' }, ctx(all))).toEqual({
      ok: true,
      left: 's1',
    });
    expect(data.seats).toHaveLength(2);
    expect(data.hostId).toBe('s2');
  });
});

describe('partida', () => {
  it('cada jugador recibe solo su propia vista', () => {
    const { data, all } = started(4);
    const game = data.game;
    const serialized = JSON.stringify(roomView(data, 's1', ctx(all)));
    expect(serialized).not.toContain('"deck":');
    expect(serialized).not.toContain('"setAside":');
    for (const id of all) {
      const view = roomView(data, id, ctx(all));
      expect(view.game?.you.id).toBe(id);
      expect(view.game?.you.hand).toEqual(game?.hands[id]);
      for (const other of all.filter((o) => o !== id)) {
        expect(view.game?.players.find((p) => p.id === other)).not.toHaveProperty('hand');
      }
    }
    expect(roomView(data, 's1', ctx(all)).status).toBe('playing');
  });

  it('las acciones se firman con el asiento de quien las envía', () => {
    const { data, all } = started(3);
    const active = data.game?.activeId as string;
    const other = all.find((id) => id !== active) as string;
    const card = data.game?.hands[other]?.[0] as number;
    expect(
      codeOf(
        handleMessage(
          data,
          other,
          { type: 'action', action: { type: 'play_card', card } },
          ctx(all),
        ),
      ),
    ).toBe('not_your_turn');
    const view = roomView(data, active, ctx(all)).game as PlayerView;
    const message = humanMove(view) as ClientMessage;
    expectOk(handleMessage(data, active, message, ctx(all)));
    expect(data.game?.activeId).not.toBe(active);
  });

  it('el motor rechaza acciones inválidas con su código', () => {
    const { data, all } = started(3);
    const active = data.game?.activeId as string;
    const hand = data.game?.hands[active] ?? [];
    const missing = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find(
      (v) => !hand.includes(v as never),
    ) as number;
    expect(
      codeOf(
        handleMessage(
          data,
          active,
          { type: 'action', action: { type: 'play_card', card: missing } },
          ctx(all),
        ),
      ),
    ).toBe('card_not_in_hand');
    expect(
      codeOf(
        handleMessage(
          data,
          active,
          { type: 'action', action: { type: 'continue_round' } },
          ctx(all),
        ),
      ),
    ).toBe('wrong_phase');
  });

  it('no hay acciones en la sala de espera', () => {
    const { data, all } = lobby(2);
    expect(
      codeOf(
        handleMessage(data, 's1', { type: 'action', action: { type: 'continue_round' } }, ctx(all)),
      ),
    ).toBe('not_playing');
  });

  it('una desconexión pausa la partida y pasa el anfitrión al siguiente conectado', () => {
    const { data, all } = started(3);
    const rest = all.filter((id) => id !== 's1');
    disconnectSeat(data, 's1', ctx(rest, 5_000));
    expect(data.pausedSince).toBe(5_000);
    expect(data.hostId).toBe('s2');
    const view = roomView(data, 's2', ctx(rest));
    expect(view.status).toBe('paused');
    expect(view.pause).toEqual({
      disconnectedIds: ['s1'],
      since: 5_000,
      hostCanEndAt: 5_000 + HOST_CAN_END_AFTER_MS,
    });
    const active = data.game?.activeId as string;
    const message = humanMove(roomView(data, active, ctx(rest)).game as PlayerView);
    if (message && active !== 's1') {
      expect(codeOf(handleMessage(data, active, message, ctx(rest)))).toBe('game_paused');
    }

    connectSeat(data, 's1', ctx(all, 6_000));
    expect(data.pausedSince).toBeNull();
    expect(roomView(data, 's2', ctx(all)).pause).toBeNull();
    expect(data.hostId).toBe('s2');
  });

  it('el anfitrión solo puede terminar tras esperar el tiempo mínimo', () => {
    const { data, all } = started(3);
    const rest = all.filter((id) => id !== 's3');
    expect(codeOf(handleMessage(data, 's1', { type: 'end_game' }, ctx(all)))).toBe(
      'not_paused_long_enough',
    );
    disconnectSeat(data, 's3', ctx(rest, 10_000));
    expect(
      codeOf(
        handleMessage(
          data,
          's1',
          { type: 'end_game' },
          ctx(rest, 10_000 + HOST_CAN_END_AFTER_MS - 1),
        ),
      ),
    ).toBe('not_paused_long_enough');
    expect(
      codeOf(
        handleMessage(data, 's2', { type: 'end_game' }, ctx(rest, 10_000 + HOST_CAN_END_AFTER_MS)),
      ),
    ).toBe('not_host');
    expectOk(
      handleMessage(data, 's1', { type: 'end_game' }, ctx(rest, 10_000 + HOST_CAN_END_AFTER_MS)),
    );
    expect(roomStatus(data)).toBe('lobby');
    expect(data.seats).toHaveLength(3);
  });

  it('abandonar a mitad de partida deja el asiento hasta que la partida termina', () => {
    const { data, all } = started(4);
    const result = handleMessage(data, 's4', { type: 'leave' }, ctx(all));
    expect(result).toEqual({ ok: true, left: 's4' });
    const rest = all.filter((id) => id !== 's4');
    disconnectSeat(data, 's4', ctx(rest, 2_000));
    expect(data.seats.find((s) => s.id === 's4')?.left).toBe(true);
    expect(roomStatus(data)).toBe('paused');

    expectOk(
      handleMessage(data, 's1', { type: 'end_game' }, ctx(rest, 2_000 + HOST_CAN_END_AFTER_MS)),
    );
    expect(data.seats.map((s) => s.id)).not.toContain('s4');
    expect(roomInfo(data)).toMatchObject({ status: 'lobby', playerCount: 3, joinable: true });
  });

  it('una partida completa de humanos simulados llega al final y permite otra', () => {
    for (const n of [2, 3, 6]) {
      const { data, all } = started(n, 0, n);
      playOut(data, all, all);
      expect(roomStatus(data)).toBe('finished');
      for (const id of all) {
        const game = roomView(data, id, ctx(all)).game;
        expect(game?.phase).toBe('game_over');
        expect(game?.winnerIds.length).toBeGreaterThan(0);
      }
      expect(codeOf(handleMessage(data, 's2', { type: 'new_game' }, ctx(all)))).toBe('not_host');
      expectOk(handleMessage(data, 's1', { type: 'new_game' }, ctx(all)));
      expect(roomStatus(data)).toBe('lobby');
      expect(data.game).toBeNull();
      expect(data.seats.every((s) => !s.ready)).toBe(true);
      expect(data.seats).toHaveLength(n);
    }
  });

  it('new_game y end_game solo valen en su momento', () => {
    const { data, all } = started(2);
    expect(codeOf(handleMessage(data, 's1', { type: 'new_game' }, ctx(all)))).toBe('not_playing');
    const lob = lobby(2);
    expect(codeOf(handleMessage(lob.data, 's1', { type: 'end_game' }, ctx(lob.all)))).toBe(
      'not_playing',
    );
  });
});

describe('jugada declarada', () => {
  function turn() {
    const { data, all } = started(3);
    const active = data.game?.activeId as string;
    const game = data.game as NonNullable<RoomData['game']>;
    game.hands[active] = [1, 2];
    game.protectedIds = [];
    const rivals = all.filter((id) => id !== active);
    const send = (id: string, message: ClientMessage) => handleMessage(data, id, message, ctx(all));
    return { data, all, active, rivals, send };
  }

  it('todos ven la carta declarada y quien juega no puede cambiarla', () => {
    const { data, all, active, rivals, send } = turn();
    expectOk(send(active, { type: 'declare_play', card: 1 }));
    for (const id of all) {
      expect(roomView(data, id, ctx(all)).pending).toEqual({
        playerId: active,
        card: 1,
        targetId: null,
      });
    }
    expect(codeOf(send(active, { type: 'declare_play', card: 2 }))).toBe('already_declared');
    expect(
      codeOf(
        send(active, {
          type: 'action',
          action: { type: 'play_card', card: 2, targetId: rivals[0] },
        }),
      ),
    ).toBe('already_declared');
  });

  it('el objetivo del Guardia se anuncia y queda fijo', () => {
    const { data, all, active, rivals, send } = turn();
    const [first, second] = rivals as [string, string];
    expect(codeOf(send(active, { type: 'declare_target', targetId: first }))).toBe('not_declared');
    expectOk(send(active, { type: 'declare_play', card: 1 }));
    expect(codeOf(send(active, { type: 'declare_target', targetId: active }))).toBe(
      'invalid_target',
    );
    expectOk(send(active, { type: 'declare_target', targetId: first }));
    expect(roomView(data, second, ctx(all)).pending?.targetId).toBe(first);
    expect(codeOf(send(active, { type: 'declare_target', targetId: second }))).toBe(
      'already_declared',
    );
    expect(
      codeOf(
        send(active, {
          type: 'action',
          action: { type: 'play_card', card: 1, targetId: second, guess: 3 },
        }),
      ),
    ).toBe('already_declared');
    expectOk(
      send(active, {
        type: 'action',
        action: { type: 'play_card', card: 1, targetId: first, guess: 3 },
      }),
    );
    expect(roomView(data, second, ctx(all)).pending).toBeNull();
  });

  it('solo declara quien tiene el turno, con una carta que pide objetivo', () => {
    const { active, rivals, send } = turn();
    expect(codeOf(send(rivals[0] as string, { type: 'declare_play', card: 1 }))).toBe(
      'not_your_turn',
    );
    expect(codeOf(send(active, { type: 'declare_play', card: 6 }))).toBe('card_not_in_hand');
    expectOk(send(active, { type: 'declare_play', card: 2 }));
    expect(codeOf(send(active, { type: 'declare_target', targetId: rivals[0] as string }))).toBe(
      'invalid_target',
    );
  });
});

describe('bots', () => {
  it('cuentan como listos y conectados para empezar, y nunca pausan la partida', () => {
    const { data } = started(1, 3);
    expect(roomStatus(data)).toBe('playing');
    expect(data.pausedSince).toBeNull();
    disconnectSeat(data, 's1', ctx([]));
    expect(data.hostId).toBe('s1');
    expect(data.pausedSince).not.toBeNull();
    expect(roomView(data, 's1', ctx([])).pause?.disconnectedIds).toEqual(['s1']);
  });

  it('no juegan mientras la partida está en pausa', () => {
    const { data } = started(1, 3);
    data.pausedSince = 1_000;
    expect(pendingBot(data)).toBeNull();
  });

  describe('esperan a la mesa antes de decidir', () => {
    /** A started game against one bot whose turn it is, planned at t=0. */
    function botTurn(): { data: RoomData; all: string[] } {
      const room = started(1, 1);
      const game = room.data.game;
      if (!game) throw new Error('sin partida');
      room.data.game = { ...game, activeId: 's2' };
      room.data.botSeenMoment = undefined;
      room.data.botDueAt = null;
      planBotMove(room.data, ctx(room.all, 0));
      return room;
    }
    const moment = (d: RoomData) => (d.game ? momentOf(d.game) : '');

    it('el momento es el último suceso de la crónica', () => {
      const { data } = botTurn();
      expect(data.game && moment(data)).toBe(tableMoment(data.game as never));
    });

    it('no mueven hasta que cada humano conectado avisa, y entonces lo hacen enseguida', () => {
      const { data, all } = botTurn();
      expect(data.hold).not.toBeNull();
      expect(data.botDueAt).toBe(BOT_HOLD_MAX_MS);

      expectOk(
        handleMessage(data, 's1', { type: 'table_ready', moment: moment(data) }, ctx(all, 100)),
      );
      planBotMove(data, ctx(all, 100));
      expect(data.hold).toBeNull();
      expect(data.botDueAt).toBeLessThan(100 + 3000);
    });

    it('ignoran un aviso de otro momento', () => {
      const { data, all } = botTurn();
      handleMessage(data, 's1', { type: 'table_ready', moment: 'ev-999' }, ctx(all));
      planBotMove(data, ctx(all, 100));
      expect(data.hold).not.toBeNull();
      expect(data.botDueAt).toBe(BOT_HOLD_MAX_MS);
    });

    it('no esperan a quien está desconectado (esperan el ritmo normal)', () => {
      const { data } = botTurn();
      data.botSeenMoment = undefined;
      data.botDueAt = null;
      data.hold = null;
      planBotMove(data, ctx([], 100));
      expect(data.hold).toBeNull();
      expect(data.botDueAt).toBeGreaterThan(100);
    });

    it('si nadie avisa, el plazo máximo sigue vigente', () => {
      const { data, all } = botTurn();
      planBotMove(data, ctx(all, 5000));
      expect(data.hold).not.toBeNull();
      expect(data.botDueAt).toBe(BOT_HOLD_MAX_MS);
    });
  });

  it('juegan la partida con un humano hasta el final y comentan en la mesa', () => {
    for (const bots of [1, 3, 5]) {
      const { data, all } = started(1, bots, 20 + bots);
      playOut(data, ['s1'], all);
      expect(roomStatus(data)).toBe('finished');
      const chat = roomView(data, 's1', ctx(all)).chat;
      expect(chat.length).toBeGreaterThan(0);
      expect(chat.some((line) => line.final)).toBe(true);
      expect(chat.every((line) => data.seats.some((s) => s.id === line.playerId && s.bot))).toBe(
        true,
      );
      // Nobody repeats a line another bot said under the same event.
      const perMoment = new Map<string, Set<string>>();
      for (const line of chat) {
        if (line.final || !line.after) continue;
        const seen = perMoment.get(line.after) ?? new Set<string>();
        expect(seen.has(line.text), `«${line.text}» repetida en ${line.after}`).toBe(false);
        seen.add(line.text);
        perMoment.set(line.after, seen);
      }
    }
  });

  it('una mesa solo de bots confirma sola la siguiente ronda', () => {
    const { data, all } = started(1, 2, 3);
    // Humans out of the way: turn the human seat into a bot so only bots remain.
    for (const s of data.seats) s.bot = true;
    for (const p of data.game?.players ?? []) p.bot = true;
    data.game = data.game && { ...data.game, ready: data.game.players.map((p) => p.id) };
    data.botNotes = {};
    let rounds = 0;
    for (let step = 0; step < 4000 && roomStatus(data) === 'playing'; step++) {
      if (data.game?.phase === 'round_over') rounds++;
      expect(playBot(data, ctx(all, 1_000 + step, step))).toBe(true);
    }
    expect(roomStatus(data)).toBe('finished');
    expect(rounds).toBeGreaterThan(0);
  });

  it('nueva partida conserva a los bots y limpia el chat', () => {
    const { data, all } = started(1, 2, 9);
    playOut(data, ['s1'], all);
    expectOk(handleMessage(data, 's1', { type: 'new_game' }, ctx(all)));
    expect(data.chat).toEqual([]);
    expect(data.seats.filter((s) => s.bot)).toHaveLength(2);
    expect(data.config.bots).toBe(2);
    expectOk(handleMessage(data, 's1', { type: 'set_ready', ready: true }, ctx(all)));
    expectOk(handleMessage(data, 's1', { type: 'start' }, ctx(all)));
    expect(roomStatus(data)).toBe('playing');
  });
});
