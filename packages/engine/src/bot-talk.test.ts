import { describe, expect, it } from 'vitest';
import { createBotNotes, emptyBotNotes } from './bot';
import {
  botFarewell,
  botRemark,
  LINES,
  phraseCount,
  remarkCandidates,
  SITUATIONS,
  type Situation,
} from './bot-talk';
import { seededRandom } from './random';
import { cardNames } from './rules';
import { createGame } from './setup';
import { act, makePlayers, play, rig, scramble } from './test-helpers';
import type { Action, GameState } from './types';
import { viewFor } from './view';

const seq = (s: GameState, ...actions: Action[]): GameState => actions.reduce(act, s);
const g = (id: string, target: string, guess: number): Action =>
  play(null as never, id, 1, target, guess as never);
const p = (id: string, card: number, target?: string): Action =>
  play(null as never, id, card as never, target);

/** Every rendering of a pool (placeholders replaced by every name / card). */
function rendered(sit: Situation): Set<string> {
  const out = new Set<string>();
  const names = makePlayers(6).map((x) => x.name);
  for (const line of LINES[sit]) {
    for (const n of names) {
      for (const c of Object.values(cardNames)) {
        out.add(line.replaceAll('{name}', n).replaceAll('{card}', c).replaceAll('{name}', n));
      }
    }
    out.add(line.replaceAll('{name}', 'alguien'));
  }
  return out;
}

/** Finds a (viewer, event) pair of `state` whose candidates include `sit`. */
function find(state: GameState, sit: Situation, viewer?: string) {
  for (const e of state.events) {
    for (const pl of state.players) {
      if (viewer && pl.id !== viewer) continue;
      const view = viewFor(state, pl.id);
      const { secret: _s, ...pub } = e;
      const cands = remarkCandidates(view, pub as typeof e);
      if (cands.some((c) => c.situation === sit)) {
        return { view, event: pub as typeof e, viewerId: pl.id, cands };
      }
    }
  }
  return null;
}

const ended = (
  hands: number[][],
  extra: Parameters<typeof rig>[0] extends infer R ? Partial<R> : never = {},
) => rig({ hands: hands as never, deck: [], ...extra });

function fresh(n: number): GameState {
  const created = createGame({ players: makePlayers(n), starterId: 'p0' }, seededRandom(1));
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
}

const fourGuards = (extra: Action[] = []) =>
  seq(
    rig({ hands: [[1, 5], [1], [1], [1]], deck: [2, 2, 2, 1, 2] }),
    g('p0', 'p1', 6) as Action,
    ...[g('p1', 'p2', 6), g('p2', 'p3', 6), g('p3', 'p0', 7)],
    ...extra,
  );

interface Scenario {
  sit: Situation;
  state: () => GameState;
  viewer?: string;
}

const scenarios: Scenario[] = [
  { sit: 'round_start_mine', state: () => fresh(2), viewer: 'p0' },
  { sit: 'round_start_other', state: () => fresh(2), viewer: 'p1' },
  { sit: 'round_start_two', state: () => fresh(2), viewer: 'p1' },
  {
    sit: 'round_start_later',
    state: () => {
      const s = act(ended([[4, 5], [3]], { bots: 2 }), p('p0', 4));
      const n = act(s, { type: 'continue_round', playerId: 'p0' });
      n.events = n.events.map((e) => ({ ...e }));
      return n;
    },
    viewer: 'p1',
  },
  {
    sit: 'spy_first_mine',
    state: () => act(rig({ hands: [[0, 4], [3], [2]] }), p('p0', 0)),
    viewer: 'p0',
  },
  {
    sit: 'spy_first_other',
    state: () => act(rig({ hands: [[0, 4], [3], [2]] }), p('p0', 0)),
    viewer: 'p1',
  },
  {
    sit: 'spy_second_mine',
    state: () =>
      seq(
        rig({ hands: [[0, 4], [3], [2]], deck: [1, 1, 0, 3] }),
        p('p0', 0),
        g('p1', 'p2', 6),
        g('p2', 'p0', 6),
        p('p0', 0),
      ),
    viewer: 'p0',
  },
  {
    sit: 'spy_second_other',
    state: () =>
      seq(
        rig({ hands: [[0, 4], [3], [2]], deck: [1, 1, 0, 3] }),
        p('p0', 0),
        g('p1', 'p2', 6),
        g('p2', 'p0', 6),
        p('p0', 0),
      ),
    viewer: 'p2',
  },
  {
    sit: 'spy_competition_other',
    state: () => seq(rig({ hands: [[0, 4], [3], [2]], deck: [0, 1, 1] }), p('p0', 0), p('p1', 0)),
    viewer: 'p2',
  },
  {
    sit: 'spy_competition_mine',
    state: () => seq(rig({ hands: [[0, 4], [3], [2]], deck: [0, 1, 1] }), p('p0', 0), p('p1', 0)),
    viewer: 'p1',
  },
  {
    sit: 'spy_sole_other',
    state: () =>
      seq(
        rig({ hands: [[0, 4], [3], [2]], deck: [0, 1, 5, 5] }),
        p('p0', 0),
        p('p1', 0),
        g('p2', 'p1', 3),
      ),
    viewer: 'p2',
  },
  {
    sit: 'spy_sole_mine',
    state: () =>
      seq(
        rig({ hands: [[0, 4], [3], [2]], deck: [0, 1, 5, 5] }),
        p('p0', 0),
        p('p1', 0),
        g('p2', 'p1', 3),
      ),
    viewer: 'p0',
  },
  {
    sit: 'spy_discarded_mine',
    state: () => act(rig({ hands: [[5, 2], [0], [3]], deck: [1, 1, 1] }), p('p0', 5, 'p1')),
    viewer: 'p1',
  },
  {
    sit: 'spy_discarded_other',
    state: () => act(rig({ hands: [[5, 2], [0], [3]], deck: [1, 1, 1] }), p('p0', 5, 'p1')),
    viewer: 'p2',
  },
  {
    sit: 'guard_hit_mine',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 3)),
    viewer: 'p0',
  },
  {
    sit: 'guard_hit_on_me',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 3)),
    viewer: 'p1',
  },
  {
    sit: 'guard_hit_other',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 3)),
    viewer: 'p2',
  },
  {
    sit: 'guard_miss_mine',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 6)),
    viewer: 'p0',
  },
  {
    sit: 'guard_miss_on_me',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 6)),
    viewer: 'p1',
  },
  {
    sit: 'guard_miss_other',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 6)),
    viewer: 'p2',
  },
  {
    sit: 'targeted',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 6)),
    viewer: 'p1',
  },
  {
    sit: 'guard_streak_mine',
    state: () =>
      seq(
        rig({ hands: [[1, 1], [3], [4]], deck: [2, 2, 1, 1] }),
        g('p0', 'p1', 5),
        p('p1', 2, 'p2'),
        p('p2', 2, 'p0'),
        g('p0', 'p1', 5),
      ),
    viewer: 'p0',
  },
  {
    sit: 'guard_streak_other',
    state: () =>
      seq(
        rig({ hands: [[1, 1], [3], [4]], deck: [2, 2, 1, 1] }),
        g('p0', 'p1', 5),
        p('p1', 2, 'p2'),
        p('p2', 2, 'p0'),
        g('p0', 'p1', 5),
      ),
    viewer: 'p2',
  },
  {
    sit: 'guard_count_third',
    state: () =>
      seq(
        rig({ hands: [[1, 5], [1], [1]], deck: [2, 2, 2, 2] }),
        g('p0', 'p1', 6),
        g('p1', 'p2', 6),
        g('p2', 'p0', 6),
      ),
    viewer: 'p1',
  },
  {
    sit: 'priest_mine',
    state: () => act(rig({ hands: [[2, 5], [3], [4]] }), p('p0', 2, 'p1')),
    viewer: 'p0',
  },
  {
    sit: 'priest_on_me',
    state: () => act(rig({ hands: [[2, 5], [3], [4]] }), p('p0', 2, 'p1')),
    viewer: 'p1',
  },
  {
    sit: 'priest_other',
    state: () => act(rig({ hands: [[2, 5], [3], [4]] }), p('p0', 2, 'p1')),
    viewer: 'p2',
  },
  {
    sit: 'baron_tie_involved',
    state: () => act(rig({ hands: [[3, 5], [5], [4]] }), p('p0', 3, 'p1')),
    viewer: 'p1',
  },
  {
    sit: 'baron_tie_other',
    state: () => act(rig({ hands: [[3, 5], [5], [4]] }), p('p0', 3, 'p1')),
    viewer: 'p2',
  },
  {
    sit: 'baron_won',
    state: () => act(rig({ hands: [[3, 6], [5], [4]] }), p('p0', 3, 'p1')),
    viewer: 'p0',
  },
  {
    sit: 'baron_lost',
    state: () => act(rig({ hands: [[3, 2], [5], [4]] }), p('p0', 3, 'p1')),
    viewer: 'p0',
  },
  {
    sit: 'baron_high_loser_mine',
    state: () => act(rig({ hands: [[3, 7], [8], [4]] }), p('p0', 3, 'p1')),
    viewer: 'p0',
  },
  {
    sit: 'baron_high_loser_other',
    state: () => act(rig({ hands: [[3, 7], [8], [4]] }), p('p0', 3, 'p1')),
    viewer: 'p2',
  },
  {
    sit: 'baron_other',
    state: () => act(rig({ hands: [[3, 6], [5], [4]] }), p('p0', 3, 'p1')),
    viewer: 'p2',
  },
  {
    sit: 'protected_mine',
    state: () => act(rig({ hands: [[4, 6], [5], [4]] }), p('p0', 4)),
    viewer: 'p0',
  },
  {
    sit: 'protected_other',
    state: () => act(rig({ hands: [[4, 6], [5], [4]] }), p('p0', 4)),
    viewer: 'p1',
  },
  {
    sit: 'protected_all',
    state: () =>
      seq(rig({ hands: [[2], [3], [4, 5]], active: 2, deck: [4, 1, 1] }), p('p2', 4), p('p0', 4)),
    viewer: 'p1',
  },
  {
    sit: 'no_targets_mine',
    state: () => act(rig({ hands: [[1, 5], [3], [2]], protect: [1, 2] }), p('p0', 1)),
    viewer: 'p0',
  },
  {
    sit: 'no_targets_other',
    state: () => act(rig({ hands: [[1, 5], [3], [2]], protect: [1, 2] }), p('p0', 1)),
    viewer: 'p1',
  },
  {
    sit: 'prince_princess_me',
    state: () => act(rig({ hands: [[5, 2], [9], [3]] }), p('p0', 5, 'p1')),
    viewer: 'p1',
  },
  {
    sit: 'prince_princess_other',
    state: () => act(rig({ hands: [[5, 2], [9], [3]] }), p('p0', 5, 'p1')),
    viewer: 'p2',
  },
  {
    sit: 'prince_mine_on_other',
    state: () => act(rig({ hands: [[5, 2], [4], [3]] }), p('p0', 5, 'p1')),
    viewer: 'p0',
  },
  {
    sit: 'prince_on_me',
    state: () => act(rig({ hands: [[5, 2], [4], [3]] }), p('p0', 5, 'p1')),
    viewer: 'p1',
  },
  {
    sit: 'prince_other',
    state: () => act(rig({ hands: [[5, 2], [4], [3]] }), p('p0', 5, 'p1')),
    viewer: 'p2',
  },
  {
    sit: 'prince_self_mine',
    state: () => act(rig({ hands: [[5, 2], [4], [3]] }), p('p0', 5, 'p0')),
    viewer: 'p0',
  },
  {
    sit: 'prince_self_other',
    state: () => act(rig({ hands: [[5, 2], [4], [3]] }), p('p0', 5, 'p0')),
    viewer: 'p1',
  },
  {
    sit: 'chancellor_mine',
    state: () => act(rig({ hands: [[6, 2], [4], [3]], deck: [1, 1, 1, 1, 1] }), p('p0', 6)),
    viewer: 'p0',
  },
  {
    sit: 'chancellor_other',
    state: () => act(rig({ hands: [[6, 2], [4], [3]], deck: [1, 1, 1, 1, 1] }), p('p0', 6)),
    viewer: 'p1',
  },
  {
    sit: 'chancellor_short',
    state: () => act(rig({ hands: [[6, 2], [4], [3]], deck: [5] }), p('p0', 6)),
    viewer: 'p1',
  },
  {
    sit: 'chancellor_short',
    state: () => act(rig({ hands: [[6, 2], [4], [3]], deck: [] }), p('p0', 6)),
    viewer: 'p0',
  },
  {
    sit: 'king_mine',
    state: () => act(rig({ hands: [[7, 2], [4], [3]] }), p('p0', 7, 'p1')),
    viewer: 'p0',
  },
  {
    sit: 'king_on_me',
    state: () => act(rig({ hands: [[7, 2], [4], [3]] }), p('p0', 7, 'p1')),
    viewer: 'p1',
  },
  {
    sit: 'king_other',
    state: () => act(rig({ hands: [[7, 2], [4], [3]] }), p('p0', 7, 'p1')),
    viewer: 'p2',
  },
  {
    sit: 'king_after_priest',
    state: () =>
      seq(
        rig({ hands: [[2, 7], [5], [4]], deck: [1, 1, 2, 3] }),
        p('p0', 2, 'p1'),
        g('p1', 'p2', 6),
        g('p2', 'p1', 6),
        p('p0', 7, 'p1'),
      ),
    viewer: 'p2',
  },
  {
    sit: 'countess_mine',
    state: () => act(rig({ hands: [[8, 2], [4], [3]] }), p('p0', 8)),
    viewer: 'p0',
  },
  {
    sit: 'countess_other',
    state: () => act(rig({ hands: [[8, 2], [4], [3]] }), p('p0', 8)),
    viewer: 'p1',
  },
  {
    sit: 'countess_suspect',
    state: () =>
      seq(rig({ hands: [[7, 1], [8], [4]], deck: [2, 2, 2] }), p('p0', 7, 'p2'), p('p1', 8)),
    viewer: 'p2',
  },
  {
    sit: 'deck_three',
    state: () => act(rig({ hands: [[0, 4], [3], [2]], deck: [1, 1, 1, 1] }), p('p0', 0)),
    viewer: 'p2',
  },
  {
    sit: 'deck_last',
    state: () => act(rig({ hands: [[0, 4], [3], [2]], deck: [1, 1] }), p('p0', 0)),
    viewer: 'p2',
  },
  {
    sit: 'deck_empty',
    state: () => act(rig({ hands: [[0, 4], [3], [2]], deck: [1] }), p('p0', 0)),
    viewer: 'p2',
  },
  {
    sit: 'eliminated_me',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 3)),
    viewer: 'p1',
  },
  {
    sit: 'eliminated_me_princess',
    state: () => act(rig({ hands: [[5, 2], [9], [3]] }), p('p0', 5, 'p1')),
    viewer: 'p1',
  },
  {
    sit: 'eliminated_first',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 3)),
    viewer: 'p2',
  },
  {
    sit: 'two_left',
    state: () => act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 3)),
    viewer: 'p2',
  },
  {
    sit: 'eliminated_other',
    state: () => act(rig({ hands: [[1, 5], [3], [2], [4]] }), g('p0', 'p1', 3)),
    viewer: 'p2',
  },
  {
    sit: 'round_win_last_mine',
    state: () => act(rig({ hands: [[1, 5], [3]] }), g('p0', 'p1', 3)),
    viewer: 'p0',
  },
  {
    sit: 'round_win_last_other',
    state: () => act(rig({ hands: [[1, 5], [3]] }), g('p0', 'p1', 3)),
    viewer: 'p1',
  },
  {
    sit: 'round_win_hand_mine',
    state: () => act(ended([[4, 8], [3], [7]]), p('p0', 4)),
    viewer: 'p0',
  },
  {
    sit: 'round_win_hand_other',
    state: () => act(ended([[4, 5], [3], [7]]), p('p0', 4)),
    viewer: 'p1',
  },
  {
    sit: 'round_win_tiebreak_mine',
    state: () => act(ended([[2, 5], [5], [3]], { discards: { 0: [6] } }), p('p0', 2, 'p1')),
    viewer: 'p0',
  },
  {
    sit: 'round_win_tiebreak_other',
    state: () => act(ended([[2, 5], [5], [3]], { discards: { 1: [6] } }), p('p0', 2, 'p1')),
    viewer: 'p2',
  },
  {
    sit: 'round_shared_mine',
    state: () =>
      act(ended([[2, 5], [5], [3]], { discards: { 0: [1, 1], 1: [4] } }), p('p0', 2, 'p1')),
    viewer: 'p0',
  },
  {
    sit: 'round_shared_other',
    state: () =>
      act(ended([[2, 5], [5], [3]], { discards: { 0: [1, 1], 1: [4] } }), p('p0', 2, 'p1')),
    viewer: 'p2',
  },
  { sit: 'spy_bonus_mine', state: () => act(ended([[0, 5], [3], [4]]), p('p0', 0)), viewer: 'p0' },
  { sit: 'spy_bonus_other', state: () => act(ended([[0, 5], [3], [4]]), p('p0', 0)), viewer: 'p1' },
  { sit: 'round_lost', state: () => act(ended([[4, 5], [3], [7]]), p('p0', 4)), viewer: 'p0' },
  {
    sit: 'near_goal_mine',
    state: () => act(ended([[4, 5], [3], [7]], { tokens: [0, 0, 3] }), p('p0', 4)),
    viewer: 'p2',
  },
  {
    sit: 'near_goal_other',
    state: () => act(ended([[4, 5], [3], [7]], { tokens: [0, 0, 3] }), p('p0', 4)),
    viewer: 'p0',
  },
  {
    sit: 'token_tie',
    state: () => act(ended([[4, 5], [7], [3]], { tokens: [2, 1, 0] }), p('p0', 4)),
    viewer: 'p0',
  },
  { sit: 'guard_count_fourth', state: () => fourGuards(), viewer: 'p1' },
  { sit: 'guard_count_many', state: () => fourGuards([g('p0', 'p1', 6)]), viewer: 'p2' },
];

describe('frases: catálogo', () => {
  it('cada situación tiene al menos 3 variantes y las frases no están vacías', () => {
    for (const sit of SITUATIONS) {
      expect(LINES[sit].length, sit).toBeGreaterThanOrEqual(3);
      for (const line of LINES[sit]) expect(line.trim().length).toBeGreaterThan(5);
    }
  });

  it('hay muchas frases distintas', () => {
    const all = SITUATIONS.flatMap((s) => [...LINES[s]]);
    expect(phraseCount()).toBe(all.length);
    expect(new Set(all).size).toBeGreaterThanOrEqual(all.length - 3);
    expect(phraseCount()).toBeGreaterThanOrEqual(300);
  });

  it('las plantillas solo usan marcadores conocidos', () => {
    for (const sit of SITUATIONS) {
      for (const line of LINES[sit]) {
        const rest = line.replaceAll('{name}', '').replaceAll('{card}', '');
        expect(rest, line).not.toMatch(/[{}]/);
      }
    }
  });

  it('todas las situaciones están cubiertas por un escenario o por la despedida', () => {
    const covered = new Set(scenarios.map((s) => s.sit));
    const farewells = SITUATIONS.filter((s) => s.startsWith('farewell_'));
    const missing = SITUATIONS.filter((s) => !covered.has(s) && !farewells.includes(s));
    expect(missing).toEqual([]);
  });
});

describe.each(
  scenarios.map((s, i) => [`${s.sit} (${s.viewer ?? 'cualquiera'}) #${i}`, s] as const),
)('situación %s', (_name, scenario) => {
  let state: GameState;
  try {
    state = scenario.state();
  } catch (e) {
    throw new Error(`${scenario.sit}: ${(e as Error).message}`);
  }
  const found = find(state, scenario.sit, scenario.viewer);

  it('se detecta con la vista real del motor', () => {
    expect(found, `no se detectó ${scenario.sit}`).not.toBeNull();
  });

  it('genera una frase de la situación, sin usar información oculta', () => {
    if (!found) throw new Error('sin evento');
    const { view, event, viewerId, cands } = found;
    const allowed = new Set(cands.flatMap((c) => [...rendered(c.situation)]));
    const own = rendered(scenario.sit);
    let hits = 0;
    for (let seed = 0; seed < 400; seed++) {
      const r = botRemark(view, emptyBotNotes(), event, seededRandom(seed));
      if (!r) continue;
      expect(allowed.has(r.text), r.text).toBe(true);
      if (own.has(r.text)) hits++;
      // La misma reacción aunque cambien las cartas ocultas (mano propia, ajenas, mazo).
      if (seed < 40) {
        const other = viewFor(scramble(state, viewerId, seededRandom(seed + 1000), true), viewerId);
        const again = botRemark(other, emptyBotNotes(), event, seededRandom(seed));
        expect(again?.text).toBe(r.text);
        expect(again?.involved).toBe(r.involved);
      }
    }
    expect(hits, `ninguna semilla produjo ${scenario.sit}`).toBeGreaterThan(0);
  });

  it('tiene variedad entre semillas', () => {
    if (!found) throw new Error('sin evento');
    const texts = new Set<string>();
    for (let seed = 0; seed < 600; seed++) {
      const r = botRemark(found.view, emptyBotNotes(), found.event, seededRandom(seed));
      if (r && rendered(scenario.sit).has(r.text)) texts.add(r.text);
    }
    expect(texts.size).toBeGreaterThanOrEqual(Math.min(3, LINES[scenario.sit].length));
  });
});

describe('memoria de frases', () => {
  it('un bot no repite la misma frase seguida', () => {
    const state = act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 3));
    const found = find(state, 'guard_hit_mine', 'p0');
    if (!found) throw new Error('sin evento');
    const random = seededRandom(11);
    let notes = createBotNotes(random);
    let last = '';
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const r = botRemark(found.view, notes, found.event, random);
      expect(r).not.toBeNull();
      if (!r) return;
      expect(r.text).not.toBe(last);
      last = r.text;
      seen.add(r.text);
      notes = r.notes;
    }
    expect(seen.size).toBe(LINES.guard_hit_mine.length);
    expect((notes.recent ?? []).length).toBeLessThanOrEqual(8);
  });

  it('es determinista con el mismo rng y notas', () => {
    const state = act(rig({ hands: [[1, 5], [3], [2]] }), g('p0', 'p1', 3));
    const found = find(state, 'guard_hit_mine', 'p0');
    if (!found) throw new Error('sin evento');
    const a = botRemark(found.view, emptyBotNotes(), found.event, seededRandom(4));
    const b = botRemark(found.view, emptyBotNotes(), found.event, seededRandom(4));
    expect(a).toEqual(b);
  });
});

describe('despedidas', () => {
  const over = (winnerIds: string[], round = 3) => {
    const s = act(rig({ hands: [[1, 5], [3]] }), g('p0', 'p1', 3));
    s.phase = 'game_over';
    s.winnerIds = winnerIds;
    s.round = round;
    return s;
  };
  const say = (s: GameState, id: string, seed: number) =>
    botFarewell(viewFor(s, id), emptyBotNotes(), seededRandom(seed));

  it.each([
    ['farewell_win', ['p0'], 3, 'p0'],
    ['farewell_lose', ['p0'], 3, 'p1'],
    ['farewell_long_win', ['p0'], 8, 'p0'],
    ['farewell_long_lose', ['p0'], 8, 'p1'],
    ['farewell_shared', ['p0', 'p1'], 3, 'p1'],
  ] as const)('%s', (sit, winners, round, viewer) => {
    const state = over([...winners], round);
    const texts = new Set<string>();
    for (let seed = 0; seed < 200; seed++) texts.add(say(state, viewer, seed));
    expect([...texts].every((t) => (LINES[sit] as readonly string[]).includes(t))).toBe(true);
    expect(texts.size).toBe(LINES[sit].length);
  });
});
