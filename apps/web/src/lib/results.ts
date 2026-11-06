import type { CardValue, GameEvent } from '@loveletter/engine';
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

function toast(key: string, label: string, title: string, body: string): TableResult {
  return { key, style: 'toast', label, title, body, faces: [], visibility: 'public', hit: false };
}

function mineResult(
  group: Extract<EventGroup, { kind: 'play' }>,
  ctx: TextContext,
): TableResult | null {
  const { play, effects } = group;
  const me = ctx.me;
  const key = `ev-${play.id}`;
  const label = `Resultado: ${cardName(play.card)}`;
  const nm = (id: string) => ctx.name(id);
  const modal = (
    title: string,
    body: string,
    visibility: 'private' | 'public',
    faces: ResultFace[] = [],
    hit = false,
  ): TableResult => ({ key, style: 'modal', label, title, body, faces, visibility, hit });

  if (find(effects, 'no_effect')?.reason === 'no_targets') {
    return toast(
      key,
      label,
      'Sin efecto.',
      `Todos los rivales están protegidos o eliminados, así que ${withArticle(play.card)} se descarta sin hacer nada.`,
    );
  }
  switch (play.card) {
    case 0:
      return toast(
        key,
        label,
        'Espía jugado.',
        'No pasa nada ahora. Si al cerrar la ronda eres el único con un Espía jugado y sigues en juego, ganas 1 ficha extra.',
      );
    case 1: {
      const g = find(effects, 'guess');
      if (!g) return null;
      const t = nm(g.targetId);
      return g.correct
        ? modal(
            '¡Acertaste!',
            `${t} tenía ${withArticle(g.guess)}. Muestra su carta y queda fuera de la ronda.`,
            'public',
            [],
            true,
          )
        : modal(
            'Fallaste.',
            `${t} no tiene ${withArticle(g.guess)}. Todos ven tu acusación, pero nadie ve su carta.`,
            'public',
          );
    }
    case 2: {
      const e = find(effects, 'priest');
      const seen = e?.secret?.hands?.[e.targetId];
      if (!e || seen === undefined) return null;
      return modal(
        'Solo tú ves esto.',
        `Esta es la carta que tiene ${nm(e.targetId)}. Los demás no la ven.`,
        'private',
        [{ caption: nm(e.targetId), value: seen }],
      );
    }
    case 3: {
      const e = find(effects, 'baron');
      if (!e) return null;
      const mineCard = e.secret?.hands?.[me];
      const theirs = e.secret?.hands?.[e.targetId];
      const t = nm(e.targetId);
      const faces: ResultFace[] =
        mineCard !== undefined && theirs !== undefined
          ? [
              { caption: 'Tu mano', value: mineCard },
              { caption: t, value: theirs },
            ]
          : [];
      if (e.loserId === null) {
        return modal(
          'Empate.',
          'Las dos manos valen lo mismo y nadie queda fuera.',
          'public',
          faces,
        );
      }
      if (e.loserId === me) {
        return modal(
          'Pierdes la comparación.',
          `Tu ${cardName(e.loserCard as CardValue)} es más baja que ${theirs !== undefined ? withArticle(theirs) : `la de ${t}`}. Quedas fuera de la ronda.`,
          'public',
          faces,
          true,
        );
      }
      return modal(
        '¡Ganas la comparación!',
        `${t} tenía ${withArticle(e.loserCard as CardValue)}, más baja que ${mineCard !== undefined ? `tu ${cardName(mineCard)}` : 'tu carta'}. Queda fuera.`,
        'public',
        faces,
        true,
      );
    }
    case 4:
      return toast(
        key,
        label,
        'Protección activa.',
        'Hasta tu próximo turno nadie puede elegirte con una carta.',
      );
    case 5: {
      const e = find(effects, 'prince');
      if (!e) return null;
      const t = nm(e.targetId);
      const dropped: ResultFace = { caption: 'Descartada', value: e.discarded };
      if (e.targetId === me) {
        if (e.discarded === 9) {
          return modal(
            'Te elegiste.',
            'Descartas la Princesa y quedas fuera de la ronda.',
            'public',
            [dropped],
            true,
          );
        }
        const fresh = find(effects, 'draw')?.secret?.drawn?.[0];
        return modal(
          'Descartas y robas.',
          `Descartas ${cardName(e.discarded)} y robas una carta nueva. Solo tú ves la nueva.`,
          'private',
          fresh === undefined ? [dropped] : [dropped, { caption: 'Nueva', value: fresh }],
        );
      }
      return e.discarded === 9
        ? modal(
            'La Princesa cae.',
            `${t} descarta la Princesa y queda fuera.`,
            'public',
            [dropped],
            true,
          )
        : modal(
            'Descarte forzado.',
            `${t} descarta ${withArticle(e.discarded)} y roba una carta nueva del mazo.`,
            'public',
            [dropped],
          );
    }
    case 6:
      return find(effects, 'chancellor')
        ? null
        : toast(key, label, 'Sin efecto.', 'No quedan cartas en el mazo para robar.');
    case 7: {
      const e = find(effects, 'king');
      if (!e) return null;
      const got = e.secret?.hands?.[me];
      const gave = e.secret?.hands?.[e.targetId];
      return modal(
        'Manos intercambiadas.',
        got !== undefined && gave !== undefined
          ? `Entregas ${cardName(gave)} y recibes ${cardName(got)} de ${nm(e.targetId)}.`
          : `Intercambiaste tu mano con ${nm(e.targetId)}.`,
        'private',
        got !== undefined && gave !== undefined
          ? [
              { caption: 'Entregas', value: gave },
              { caption: 'Recibes', value: got },
            ]
          : [],
      );
    }
    case 8:
      return toast(
        key,
        label,
        'Condesa descartada.',
        'No tiene efecto. Jugarla sin necesidad hace creer a los demás que tienes Rey o Príncipe.',
      );
    default: {
      const e = find(effects, 'eliminated');
      const other = e?.revealed[0];
      return modal(
        'Quedas fuera.',
        'Descartaste la Princesa. Revelas tu otra carta y sales de la ronda.',
        'public',
        other === undefined ? [] : [{ caption: 'Tu otra carta', value: other }],
        true,
      );
    }
  }
}

/** Aviso de la jugada de otro: solo lo que tu vista permite saber (`secret` solo si va para ti). */
function otherNotice(group: Extract<EventGroup, { kind: 'play' }>, ctx: TextContext): TableResult {
  const { play, effects } = group;
  const me = ctx.me;
  const actor = play.playerId;
  const nm = ctx.name;
  const targeted = effects.find((e) => 'targetId' in e) as
    | (GameEvent & { targetId: string })
    | undefined;
  const targetId = targeted?.targetId ?? null;
  const out = effects.some((e) => e.type === 'eliminated');
  const meOut = effects.some((e) => e.type === 'eliminated' && e.playerId === me);
  const faces: ResultFace[] = [];
  let priv = false;
  const king = find(effects, 'king');
  const baron = find(effects, 'baron');
  const prince = find(effects, 'prince');
  if (king?.secret?.hands && (king.targetId === me || king.playerId === me)) {
    const got = king.secret.hands[me];
    const gave = king.secret.hands[king.targetId === me ? actor : king.targetId];
    if (got !== undefined) {
      priv = true;
      faces.push({ caption: 'Recibes', value: got });
      if (gave !== undefined) faces.push({ caption: `${nm(actor)} se queda`, value: gave });
    }
  }
  if (baron?.secret?.hands && (baron.targetId === me || baron.playerId === me)) {
    const mine = baron.secret.hands[me];
    const theirs = baron.secret.hands[actor];
    if (mine !== undefined && theirs !== undefined) {
      faces.push({ caption: 'Tu mano', value: mine }, { caption: nm(actor), value: theirs });
    }
  }
  if (prince && prince.targetId === me) {
    faces.push({ caption: 'Descartas', value: prince.discarded });
    const fresh = find(effects, 'draw')?.secret?.drawn?.[0];
    if (fresh !== undefined) {
      priv = true;
      faces.push({ caption: 'Nueva', value: fresh });
    }
  }
  return {
    key: `ev-${play.id}`,
    style: 'modal',
    label: `Jugada de ${nm(actor)}: ${cardName(play.card)}`,
    title: `${nm(actor)} jugó ${withArticle(play.card)}`,
    body: playText(play, effects, ctx),
    faces,
    visibility: priv ? 'private' : 'public',
    hit: out,
    other: { actorId: actor, card: play.card, targetId, affectsMe: targetId === me || meOut },
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
      if (group.play.playerId === ctx.me) {
        const r = mineResult(group, ctx);
        if (r) results.push(r);
        continue;
      }
      results.push(otherNotice(group, ctx));
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
      });
    }
  }
  return results;
}
