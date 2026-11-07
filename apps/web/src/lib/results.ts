import type { CardValue, GameEvent } from '@loveletter/engine';
import { effectLine } from './cardFx';
import { cardName, withArticle } from './cards';
import { type EventGroup, groupEvents, playText, type TextContext } from './chronicle';

export interface ResultFace {
  caption: string;
  value: CardValue;
}

/** Lo que se le enseña al jugador tras una jugada: ventana (importante) o aviso (trivial). */
export interface TableResult {
  /** `ev-<id>` del suceso que lo origina: las frases de los bots esperan a que se muestre. */
  key: string;
  style: 'modal' | 'toast';
  label: string;
  title: string;
  body: string;
  faces: ResultFace[];
  visibility: 'private' | 'public';
  /** Alguien quedó fuera. */
  hit: boolean;
  /** "Qué hace" la carta jugada, en una frase corta (en espejo para quien la juega). */
  effect?: string;
  /** Espera estos milisegundos antes de mostrarse (el vuelo de las cartas se ve primero). */
  deferMs?: number;
  /** Lo que solo tú ves de esta jugada (Sacerdote, Rey, Barón, Príncipe sobre ti). */
  secretFaces?: ResultFace[];
  /** Presente cuando es la jugada de otro jugador (aviso informativo). */
  other?: {
    actorId: string;
    card: CardValue;
    targetId: string | null;
    /** Eres el objetivo o quedas fuera: espera a que pulses Continuar. */
    affectsMe: boolean;
  };
}

export interface ChancellorPick {
  keep: CardValue;
  /** Primera en llegar al fondo primero. */
  bottom: CardValue[];
}

function find<T extends GameEvent['type']>(
  effects: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }> | undefined {
  return effects.find((e) => e.type === type) as Extract<GameEvent, { type: T }> | undefined;
}

/**
 * Aviso de una jugada, el mismo para quien la hace y para quien la ve: quién, qué carta, contra
 * quién y el texto público de `playText` (solo cambia la persona gramatical). Lo que solo tú
 * puedes saber (`secret`, que el motor únicamente manda a los implicados) va aparte, en
 * `secretFaces`, para enseñarlo etiquetado "Solo tú lo ves".
 */
function playNotice(group: Extract<EventGroup, { kind: 'play' }>, ctx: TextContext): TableResult {
  const { play, effects } = group;
  const me = ctx.me;
  const actor = play.playerId;
  const mine = actor === me;
  const nm = ctx.name;
  const who = mine ? 'Tú' : nm(actor);
  const targeted = effects.find((e) => 'targetId' in e) as
    | (GameEvent & { targetId: string })
    | undefined;
  const targetId = targeted?.targetId ?? null;
  const out = effects.some((e) => e.type === 'eliminated');
  const meOut = effects.some((e) => e.type === 'eliminated' && e.playerId === me);
  const secretFaces: ResultFace[] = [];
  const king = find(effects, 'king');
  const baron = find(effects, 'baron');
  const prince = find(effects, 'prince');
  const priest = find(effects, 'priest');
  if (priest?.secret?.hands && mine) {
    const seen = priest.secret.hands[priest.targetId];
    if (seen !== undefined) secretFaces.push({ caption: nm(priest.targetId), value: seen });
  }
  if (king?.secret?.hands && (king.targetId === me || king.playerId === me)) {
    const got = king.secret.hands[me];
    const other = mine ? king.targetId : actor;
    const gave = king.secret.hands[mine ? king.targetId : actor];
    if (got !== undefined) {
      if (mine && gave !== undefined) secretFaces.push({ caption: 'Entregas', value: gave });
      secretFaces.push({ caption: 'Recibes', value: got });
      if (!mine && gave !== undefined)
        secretFaces.push({ caption: `${nm(other)} se queda`, value: gave });
    }
  }
  if (baron?.secret?.hands && (baron.targetId === me || baron.playerId === me)) {
    const other = mine ? baron.targetId : actor;
    const mineCard = baron.secret.hands[me];
    const theirs = baron.secret.hands[other];
    if (mineCard !== undefined && theirs !== undefined) {
      secretFaces.push(
        { caption: 'Tu mano', value: mineCard },
        { caption: nm(other), value: theirs },
      );
    }
  }
  if (prince && prince.targetId === me) {
    const fresh = find(effects, 'draw')?.secret?.drawn?.[0];
    if (fresh !== undefined) secretFaces.push({ caption: 'Tu carta nueva', value: fresh });
  }
  return {
    key: `ev-${play.id}`,
    style: 'modal',
    label: mine
      ? `Tu jugada: ${cardName(play.card)}`
      : `Jugada de ${nm(actor)}: ${cardName(play.card)}`,
    title: `${who} ${mine ? 'jugaste' : 'jugó'} ${withArticle(play.card)}`,
    body: playText(play, effects, ctx),
    effect: effectLine(play.card, mine),
    faces: [],
    secretFaces,
    visibility: 'public',
    hit: out,
    other: {
      actorId: actor,
      card: play.card,
      targetId,
      // Si te afecta o hay algo privado que leer, espera a Continuar; si no, se cierra solo.
      affectsMe: targetId === me || meOut || secretFaces.length > 0,
    },
  };
}

/**
 * Resultados que hay que enseñar por los sucesos nuevos de la vista: tus propias jugadas (Canciller
 * incluido, con la elección que guardaste) y lo que otros te hacen con el Rey o el Barón.
 */
export function buildResults(
  events: readonly GameEvent[],
  ctx: TextContext,
  chancellor?: ChancellorPick | null,
): TableResult[] {
  const results: TableResult[] = [];
  for (const group of groupEvents(events)) {
    if (group.kind === 'play') {
      // Tu Canciller abre su propia elección: no hace falta avisar de la jugada.
      if (group.play.playerId === ctx.me && find(group.effects, 'chancellor')) continue;
      results.push(playNotice(group, ctx));
      continue;
    }
    const e = group.event;
    if (e.type === 'chancellor_done' && e.playerId === ctx.me) {
      const faces: ResultFace[] = chancellor
        ? [
            { caption: 'Tu mano', value: chancellor.keep },
            ...chancellor.bottom.map((value, i) => ({
              caption: i === 0 ? 'Al fondo: primera' : 'Al fondo: última',
              value,
            })),
          ]
        : [];
      results.push({
        key: `ev-${e.id}`,
        style: 'modal',
        label: 'Resultado: Canciller',
        title: 'Carta conservada.',
        body: chancellor
          ? `Conservas ${cardName(chancellor.keep)}. Al fondo del mazo ${chancellor.bottom.length === 1 ? `va ${cardName(chancellor.bottom[0] as CardValue)}` : `van ${chancellor.bottom.map(cardName).join(' (primera) y ')} (última, al fondo del todo)`}.`
          : 'Conservaste una carta y pusiste el resto al fondo del mazo.',
        faces,
        visibility: 'private',
        hit: false,
        deferMs: 1500,
      });
    }
  }
  return results;
}
