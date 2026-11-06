import type { CardValue, GameEvent, RoundSummary } from '@loveletter/engine';
import { CARD_BY_VALUE, cardName, withArticle } from './cards';
import { agree, type Gender } from './gender';

/** Quién mira la crónica y cómo se llaman los demás. */
export interface TextContext {
  me: string;
  name: (id: string) => string;
  /** Sin dato de género (el protocolo no lo trae) se concuerda en masculino. */
  gender?: (id: string) => Gender | undefined;
}

export type EventGroup =
  | { kind: 'play'; play: Extract<GameEvent, { type: 'play' }>; effects: GameEvent[] }
  | { kind: 'single'; event: GameEvent };

const STARTS_NEW: ReadonlySet<GameEvent['type']> = new Set([
  'play',
  'round_start',
  'round_end',
  'game_end',
  'chancellor_done',
]);

/** Agrupa cada jugada con los sucesos que provoca (efecto, eliminación, robo del Príncipe). */
export function groupEvents(events: readonly GameEvent[]): EventGroup[] {
  const out: EventGroup[] = [];
  let current: Extract<EventGroup, { kind: 'play' }> | null = null;
  for (const event of events) {
    if (event.type === 'play') {
      current = { kind: 'play', play: event, effects: [] };
      out.push(current);
    } else if (STARTS_NEW.has(event.type) || (event.type === 'draw' && event.reason === 'turn')) {
      current = null;
      out.push({ kind: 'single', event });
    } else if (current) {
      current.effects.push(event);
    } else {
      out.push({ kind: 'single', event });
    }
  }
  return out;
}

export const indefinite = (v: CardValue): string =>
  `${CARD_BY_VALUE[v].article === 'la' ? 'una' : 'un'} ${cardName(v)}`;

export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function find<T extends GameEvent['type']>(
  effects: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }> | undefined {
  return effects.find((e) => e.type === type) as Extract<GameEvent, { type: T }> | undefined;
}

/** Texto de una jugada completa, en pasado, en segunda persona si la juegas tú. */
export function playText(
  play: Extract<GameEvent, { type: 'play' }>,
  effects: readonly GameEvent[],
  ctx: TextContext,
): string {
  const { me } = ctx;
  const A = play.playerId;
  const mine = A === me;
  const nm = (id: string) => ctx.name(id);
  const ref = (id: string) => (id === me ? 'ti' : nm(id));
  const out = (id: string) => (id === me ? 'quedas fuera' : `${nm(id)} queda fuera`);
  const head = `${mine ? 'Jugaste' : `${nm(A)} jugó`} ${withArticle(play.card)}`;
  const noEffect = find(effects, 'no_effect');
  if (noEffect?.reason === 'no_targets') {
    return `${head}, pero no había a quién elegir: sin efecto.`;
  }
  switch (play.card) {
    case 0:
      return `${head}.`;
    case 1: {
      const g = find(effects, 'guess');
      if (!g) return `${head}.`;
      const T = g.targetId;
      const named = mine ? 'nombraste' : 'nombró';
      return g.correct
        ? `${head} contra ${ref(T)} y ${named} ${withArticle(g.guess)}: ${mine ? 'acertaste' : 'acertó'}. ${cap(out(T))}.`
        : `${head} contra ${ref(T)} y ${named} ${withArticle(g.guess)}: ${mine ? 'fallaste' : 'falló'}.`;
    }
    case 2: {
      const e = find(effects, 'priest');
      if (!e) return `${head}.`;
      const seen = e.secret?.hands?.[e.targetId];
      if (mine) {
        return `${head} y miraste la mano de ${nm(e.targetId)}${seen !== undefined ? `: tenía ${indefinite(seen)}` : ''}.`;
      }
      return `${head} y miró ${e.targetId === me ? 'tu mano' : `la mano de ${nm(e.targetId)}`}.`;
    }
    case 3: {
      const e = find(effects, 'baron');
      if (!e) return `${head}.`;
      const base = `${head} contra ${ref(e.targetId)}`;
      if (e.loserId === null || e.loserCard === null) return `${base}: empate, nadie queda fuera.`;
      const L = e.loserId;
      return `${base}: ${L === me ? 'tu mano' : `la mano de ${nm(L)}`} era la más baja (${cardName(e.loserCard)}) y ${out(L)}.`;
    }
    case 4:
      return `${head}: ${mine ? 'quedas' : 'queda'} ${agree('protegido', ctx.gender?.(A))} hasta ${mine ? 'tu' : 'su'} próximo turno.`;
    case 5: {
      const e = find(effects, 'prince');
      if (!e) return `${head}.`;
      const T = e.targetId;
      const self = T === A;
      const who = self ? (mine ? 'ti' : agree('sí mismo', ctx.gender?.(A))) : ref(T);
      const dropped = `${T === me ? 'descartaste' : 'descartó'} ${withArticle(e.discarded)}`;
      const after =
        e.discarded === 9 ? `y ${out(T)}` : `y ${T === me ? 'robaste' : 'robó'} una carta nueva`;
      return `${head} contra ${who}: ${dropped} ${after}.`;
    }
    case 6: {
      const e = find(effects, 'chancellor');
      if (!e) return `${head}: sin cartas que robar, sin efecto.`;
      const drawn = e.secret?.drawn;
      return `${head}: ${mine ? 'robaste' : 'robó'} ${
        drawn
          ? listNames(drawn.map(indefinite))
          : `${e.drawn} ${e.drawn === 1 ? 'carta' : 'cartas'}`
      }.`;
    }
    case 7: {
      const e = find(effects, 'king');
      if (!e) return `${head}.`;
      const got = e.secret?.hands?.[me];
      const involved = e.playerId === me || e.targetId === me;
      return `${head} contra ${ref(e.targetId)}: intercambiaron manos.${involved && got !== undefined ? ` Recibiste ${indefinite(got)}.` : ''}`;
    }
    case 8:
      return `${head}: sin efecto.`;
    default:
      return `${head} y ${mine ? 'quedas' : 'queda'} fuera de la ronda.`;
  }
}

export function reasonText(summary: RoundSummary): string {
  switch (summary.reason) {
    case 'last_standing':
      return 'fue el último jugador en pie';
    case 'highest_hand':
      return 'se acabó el mazo y tenía la mano más alta';
    case 'discard_tiebreak':
      return 'empató en la mano más alta y ganó por la mayor suma de descartes';
    case 'shared_tie':
      return 'empate total: ganan todos los empatados';
  }
}

export function roundEndText(summary: RoundSummary, ctx: TextContext): string {
  const names = summary.winnerIds.map((id) => (id === ctx.me ? 'Tú' : ctx.name(id)));
  const plural = names.length > 1;
  const bonus =
    summary.spyBonusId !== null
      ? ` ${summary.spyBonusId === ctx.me ? 'Tú ganas' : `${ctx.name(summary.spyBonusId)} gana`} 1 ficha extra por el Espía.`
      : '';
  const why =
    summary.reason === 'shared_tie'
      ? 'empate total, ganan todos los empatados'
      : reasonText(summary);
  return `Fin de la ronda ${summary.round}: ${plural ? 'ganan' : 'gana'} ${listNames(names)} (${plural && summary.reason !== 'shared_tie' ? why.replace('fue', 'fueron') : why}).${bonus}`;
}

/** Línea de la crónica de un grupo, o null si no merece línea. */
export function groupText(group: EventGroup, ctx: TextContext): string | null {
  if (group.kind === 'play') return playText(group.play, group.effects, ctx);
  const e = group.event;
  const { me } = ctx;
  switch (e.type) {
    case 'round_start': {
      const open = e.starterId === me ? 'abres tú' : `abre ${ctx.name(e.starterId)}`;
      const up = e.faceUp.length ? ` Boca arriba: ${e.faceUp.map(cardName).join(', ')}.` : '';
      return `Ronda ${e.round}: ${open}.${up}`;
    }
    case 'draw': {
      const card = e.secret?.drawn?.[0];
      return card !== undefined && e.playerId === me
        ? `Es tu turno: robaste ${indefinite(card)}.`
        : null;
    }
    case 'chancellor_done':
      return `${e.playerId === me ? 'Conservaste' : `${ctx.name(e.playerId)} conservó`} una carta y ${e.playerId === me ? 'pusiste' : 'puso'} ${e.returned} al fondo del mazo.`;
    case 'round_end':
      return roundEndText(e.summary, ctx);
    case 'game_end': {
      const names = e.winnerIds.map((id) => (id === me ? 'Tú' : ctx.name(id)));
      return `¡${listNames(names)} ${names.length > 1 || names[0] === 'Tú' ? 'ganan' : 'gana'} la partida!`;
    }
    case 'eliminated':
      return `${e.playerId === me ? 'Quedaste' : `${ctx.name(e.playerId)} quedó`} fuera de la ronda.`;
    default:
      return null;
  }
}

/** Crónica en español, la más reciente primero. */
export function chronicle(events: readonly GameEvent[], ctx: TextContext): string[] {
  const lines: string[] = [];
  for (const group of groupEvents(events)) {
    const text = groupText(group, ctx);
    if (text) lines.push(text);
  }
  return lines.reverse();
}
