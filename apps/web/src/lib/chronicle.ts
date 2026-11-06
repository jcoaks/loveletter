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
      // Quien interviene ve las dos cartas (el motor solo se las manda a los dos).
      const other = mine ? e.targetId : A;
      const bothMine = e.secret?.hands?.[me];
      const bothTheirs = e.secret?.hands?.[other];
      const cards =
        bothMine !== undefined && bothTheirs !== undefined
          ? ` (tu ${cardName(bothMine)} contra ${mine ? 'su' : `el`} ${cardName(bothTheirs)}${mine ? '' : ` de ${nm(other)}`})`
          : '';
      const base = `${head} contra ${ref(e.targetId)}${cards}`;
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
      const fresh = find(effects, 'draw')?.secret?.drawn?.[0];
      const after =
        e.discarded === 9
          ? `y ${out(T)}`
          : `y ${T === me ? 'robaste' : 'robó'} ${T === me && fresh !== undefined ? withArticle(fresh) : 'una carta nueva'}`;
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
      const gave = e.secret?.hands?.[mine ? e.targetId : A];
      const involved = e.playerId === me || e.targetId === me;
      const swap =
        involved && got !== undefined
          ? gave !== undefined
            ? ` Entregaste ${indefinite(gave)} y recibiste ${indefinite(got)}.`
            : ` Recibiste ${indefinite(got)}.`
          : '';
      return `${head} contra ${ref(e.targetId)}: intercambiaron manos.${swap}`;
    }
    case 8:
      return `${head}: sin efecto.`;
    default:
      return `${head} y ${mine ? 'quedas' : 'queda'} fuera de la ronda.`;
  }
}

/**
 * Cómo se cuenta el final de una ronda a quien lo lee: `title` (quién gana) y `reason` (por qué),
 * en segunda persona si ganas tú ("Ganaste la ronda", "Fuiste el último jugador en pie").
 */
export function roundVerdict(
  summary: RoundSummary,
  ctx: TextContext,
): { title: string; reason: string; bonus: string | null } {
  const { me } = ctx;
  const winners = summary.winnerIds;
  const meWon = winners.includes(me);
  const others = winners.filter((id) => id !== me).map((id) => ctx.name(id));
  const tie = summary.reason === 'shared_tie' || winners.length > 1;
  const first = ctx.name(winners[0] ?? '');

  let title: string;
  if (tie) {
    const pre = summary.reason === 'shared_tie' ? 'Empate: ' : '';
    title = meWon
      ? `${pre}tú y ${listNames(others)} ganan la ronda`
      : `${pre ? `${pre}ganan ` : 'Ganan la ronda '}${listNames(others)}`;
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    title = meWon ? 'Ganaste la ronda' : `Gana la ronda ${first}`;
  }

  let reason: string;
  switch (summary.reason) {
    case 'last_standing':
      reason = meWon
        ? 'Fuiste el último jugador en pie.'
        : `${first} fue el último jugador en pie.`;
      break;
    case 'highest_hand':
      reason = meWon
        ? 'Se acabó el mazo y tenías la mano más alta.'
        : `Se acabó el mazo y ${first} tenía la mano más alta.`;
      break;
    case 'discard_tiebreak':
      reason = meWon
        ? 'Empataste en la mano más alta y ganaste por la mayor suma de descartes.'
        : `${first} empató en la mano más alta y ganó por la mayor suma de descartes.`;
      break;
    case 'shared_tie':
      reason = 'Empate total: ganan todos los empatados.';
      break;
  }
  const spy = summary.spyBonusId;
  const bonus =
    spy === null
      ? null
      : spy === me
        ? 'Ganas 1 ficha extra por el Espía.'
        : `${ctx.name(spy)} gana 1 ficha extra por el Espía.`;
  return { title, reason, bonus };
}

export function roundEndText(summary: RoundSummary, ctx: TextContext): string {
  const v = roundVerdict(summary, ctx);
  return `Fin de la ronda ${summary.round}: ${v.title}. ${v.reason}${v.bonus ? ` ${v.bonus}` : ''}`;
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

export interface LogLine {
  text: string;
  /** La línea cuenta algo que solo tú sabes (viene de `event.secret`): se marca "solo tú". */
  secret: boolean;
}

const hasSecretForMe = (events: readonly GameEvent[], me: string) =>
  events.some((e) => e.secret?.to.includes(me));

/** Crónica con la marca de privacidad de cada línea, la más reciente primero. */
export function chronicleLines(events: readonly GameEvent[], ctx: TextContext): LogLine[] {
  const lines: LogLine[] = [];
  for (const group of groupEvents(events)) {
    const text = groupText(group, ctx);
    if (!text) continue;
    const source = group.kind === 'play' ? [group.play, ...group.effects] : [group.event];
    lines.push({ text, secret: hasSecretForMe(source, ctx.me) });
  }
  return lines.reverse();
}

/** Crónica en español, la más reciente primero. */
export function chronicle(events: readonly GameEvent[], ctx: TextContext): string[] {
  return chronicleLines(events, ctx).map((l) => l.text);
}
