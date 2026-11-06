// What bots say at the table. Every line is decided from the bot's own view; lines never reveal
// what a bot saw in private (Priest, Baron, King) or what it holds.
import type { BotNotes } from './bot';
import type { Random } from './random';
import { cardNames, PRINCESS } from './rules';
import type { GameEvent, GameState, PlayerId } from './types';
import type { PlayerView } from './view';

/** A public chronicle event: what a bot may comment on (secrets removed). */
export type BotEvent = GameEvent;

/** Public events appended between two states, in order, without their private data. */
export function botEvents(before: GameState, after: GameState): BotEvent[] {
  return after.events.slice(before.events.length).map((e) => {
    const { secret: _secret, ...rest } = e;
    return rest as BotEvent;
  });
}

/** Chronicle key an event is shown under; `ChatLine.after` in the protocol uses it. */
export function eventKey(event: { id: number }): string {
  return `ev-${event.id}`;
}

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)] as T;
}

type Remark = { text: string; involved: boolean };

/**
 * A line about `event`, which just happened, from the bot whose view this is; null to stay quiet.
 * `involved` lines (the actor, the target) come first; onlookers speak only sometimes so the
 * table is not flooded.
 */
export function botRemark(
  view: PlayerView,
  _notes: BotNotes,
  event: BotEvent,
  random: Random,
): Remark | null {
  const me = view.you.id;
  const nameOf = (id: PlayerId) => view.players.find((p) => p.id === id)?.name ?? '¿?';
  const say = (lines: readonly string[], involved: boolean, chance = 1): Remark | null =>
    random() < chance ? { text: pick(lines, random), involved } : null;

  switch (event.type) {
    case 'guess': {
      const target = nameOf(event.targetId);
      if (event.playerId === me) {
        return event.correct
          ? say(
              [
                `¡${target}, te tengo! Sabía que eras ${cardNames[event.guess]}.`,
                'Ni la bola de cristal es tan buena.',
                'Fue un presentimiento, de verdad.',
                '¡Directo al clavo!',
              ],
              true,
            )
          : say(
              [
                'Bueno, tenía que intentarlo.',
                'Era una apuesta y salió mal.',
                'Pensé que sí… qué cosa.',
                'Casi, casi.',
              ],
              true,
            );
      }
      if (event.targetId === me) {
        return event.correct
          ? say(
              [
                '¿Cómo supiste? Qué mala suerte.',
                'Me descubrieron… adiós, mesa.',
                'Hasta aquí llegué. Suerte a los demás.',
              ],
              true,
            )
          : say(
              [
                'Ja, ni cerca.',
                'Casi me atrapas, pero no.',
                'Sigo aquí, para tu disgusto.',
                'Buen intento, de verdad.',
              ],
              true,
            );
      }
      return event.correct
        ? say(['Qué puntería.', 'Uf, eso dolió.', 'Cuidado con ese Guardia.'], false, 0.3)
        : say(['Se salvó por poco.', 'Fallaste, qué lástima.'], false, 0.15);
    }
    case 'priest':
      if (event.playerId === me) {
        return say(
          [
            'Hmm… interesante. Muy interesante.',
            'Ahora sé algo que ustedes no.',
            'Qué cosas se aprenden en esta mesa.',
            'Gracias por la información.',
          ],
          true,
        );
      }
      if (event.targetId === me) {
        return say(
          [
            'No miren mucho, que me pongo tímido.',
            'Qué curiosos.',
            'Mi mano es un libro cerrado… hasta ahora.',
          ],
          true,
        );
      }
      return say(['Todos quieren espiar a alguien.', 'Ahí va una mirada indiscreta.'], false, 0.15);
    case 'baron': {
      const tie = event.loserId === null;
      if (event.playerId === me || event.targetId === me) {
        if (tie) return say(['Empate. Nadie se mueve.', 'Qué casualidad, iguales.'], true);
        const lost = event.loserId === me;
        return lost
          ? say(
              [
                'Mi carta no daba la talla…',
                'Perdí la comparación. Qué se le va a hacer.',
                'Hoy no es mi día.',
              ],
              true,
            )
          : say(
              [
                'Gané la comparación. Lo siento, no lo siento.',
                'La mía pesaba más.',
                '¡El Barón nunca falla!',
              ],
              true,
            );
      }
      return tie
        ? say(['Qué aburrido, empate.'], false, 0.15)
        : say(['El Barón no perdona.', 'Una comparación muy reñida.'], false, 0.25);
    }
    case 'protected':
      return event.playerId === me
        ? say(
            [
              'Voy a estar a salvo un ratito.',
              'La Doncella cuida de mí.',
              'Intenten alcanzarme ahora.',
              'Me retiro al jardín por esta vuelta.',
            ],
            true,
          )
        : say(
            ['Qué conveniente la Doncella.', 'Ya se escondió, qué listo.', 'Hmm, se protege.'],
            false,
            0.25,
          );
    case 'prince': {
      if (event.discarded === PRINCESS) {
        return event.targetId === me
          ? say(['¡No, la Princesa!', 'Mi pobre Princesa…', 'Qué golpe tan cruel.'], true)
          : say(['¡Princesa fuera! Qué desastre.', 'Eso sí que no lo esperaba nadie.'], false, 0.6);
      }
      if (event.playerId === me && event.targetId !== me) {
        return say(
          ['Descarta, descarta.', 'Una carta nueva te hará bien.', 'Corte de mano, nada personal.'],
          true,
        );
      }
      if (event.targetId === me && event.playerId !== me) {
        return say(
          [
            'Ay, justo esa quería conservar.',
            'Pues a empezar de nuevo.',
            'Qué Príncipe tan entrometido.',
          ],
          true,
        );
      }
      if (event.targetId === me) {
        return say(['Cambio de aires para mi mano.', 'Me renuevo, que falta me hacía.'], true);
      }
      return say(['Mmm, el Príncipe mueve la mesa.'], false, 0.1);
    }
    case 'chancellor':
      return event.playerId === me
        ? say(
            [
              'Tres cartas y una sola decisión.',
              'Déjenme pensar un momento…',
              'Más cartas, más problemas.',
              'Voy a elegir con cuidado.',
            ],
            true,
          )
        : say(['El Canciller piensa mucho…', 'Ahí va a reordenar el mazo.'], false, 0.15);
    case 'king':
      if (event.playerId === me || event.targetId === me) {
        return say(
          [
            'Trato hecho: cambio de manos.',
            'Intercambio real, sin devoluciones.',
            'El Rey manda, y yo obedezco.',
            'Veremos quién salió ganando.',
          ],
          true,
        );
      }
      return say(['Un cambio de manos, cuidado con eso.', 'Ya se enredó todo.'], false, 0.2);
    case 'play':
      if (event.card === 0 && event.playerId === me) {
        return say(
          ['Un Espía a su servicio.', 'Yo no hice nada, lo juro.', 'Tengo ojos en todas partes.'],
          true,
          0.5,
        );
      }
      if (event.card === 0)
        return say(['¿Un Espía? Qué sospechoso.', 'Ese Espía va a dar de qué hablar.'], false, 0.2);
      if (event.card === 8 && event.playerId === me) {
        return say(
          ['La Condesa nunca miente. Casi nunca.', 'Un poco de elegancia en la mesa.'],
          true,
          0.5,
        );
      }
      if (event.card === 8)
        return say(
          ['¿Condesa? Hmm, ¿forzada o farol?', 'La Condesa es una buena tapadera.'],
          false,
          0.2,
        );
      return null;
    case 'no_effect':
      if (event.reason === 'no_targets') {
        return event.playerId === me
          ? say(['Nadie al que apuntar. Qué silencio.', 'Todos escondidos… jugada al aire.'], true)
          : say(['Jugada en el vacío.', 'Todos protegidos, qué mesa tan cobarde.'], false, 0.3);
      }
      return null;
    case 'eliminated': {
      if (event.playerId === me) {
        if (event.cause === 'played_princess') {
          return say(['Qué torpeza la mía con la Princesa.', 'Ay, no, la Princesa…'], true);
        }
        return say(
          [
            'Me voy a mirar desde las gradas.',
            'Fuera de ronda. Que gane el mejor.',
            'Descanso forzoso.',
          ],
          true,
          0.6,
        );
      }
      return say(
        ['Uno menos en la mesa.', 'La mesa queda más tranquila.', 'Ya cayó otro.'],
        false,
        0.2,
      );
    }
    case 'round_end': {
      const won = event.summary.winnerIds.includes(me);
      if (event.summary.spyBonusId === me) {
        return say(
          [
            '¡El Espía rindió frutos! Ficha extra.',
            'Misión secreta cumplida, gracias.',
            'Un Espía y una ficha. Perfecto.',
          ],
          true,
        );
      }
      if (won) {
        return say(
          [
            '¡Ronda mía! Ficha para este caballero (o dama).',
            'Una menos para la meta.',
            'Bien jugado, sobre todo por mí.',
            'Así se gana una ronda.',
          ],
          true,
          0.8,
        );
      }
      if (event.summary.winnerIds.length > 0) {
        return say(
          [
            `Bien jugada, ${nameOf(event.summary.winnerIds[0] as PlayerId)}.`,
            'La próxima ronda es mía.',
            'Esta me la guardo para la revancha.',
            'Qué ronda tan reñida.',
          ],
          false,
          0.4,
        );
      }
      return null;
    }
    default:
      return null;
  }
}

/** A farewell line once the game is over; every bot may give one. */
export function botFarewell(view: PlayerView, _notes: BotNotes, random: Random): string {
  const won = view.winnerIds.includes(view.you.id);
  return won
    ? pick(
        [
          '¡El corazón de la princesa es mío!',
          'Gracias, gracias, no se levanten.',
          'Una victoria muy afectuosa.',
          'Qué gran partida. Y qué gran ganador.',
        ],
        random,
      )
    : pick(
        [
          'Felicidades, fue una buena partida.',
          'La carta de amor se me perdió por el camino.',
          'Revancha cuando quieran.',
          'Ganaste justo. Esta vez.',
        ],
        random,
      );
}
