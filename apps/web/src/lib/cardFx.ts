import type { CardValue } from '@loveletter/engine';

/**
 * Qué hace cada carta, en una frase corta (versión de las reglas de `config/loveletter-rules.json`
 * para los avisos). `mine`: la frase en segunda persona cuando la jugaste tú.
 */
export function effectLine(card: CardValue, mine: boolean): string {
  switch (card) {
    case 0:
      return mine
        ? 'No tiene efecto ahora. Si al cerrar la ronda eres el único jugador en pie que jugó un Espía, ganas 1 ficha.'
        : 'No tiene efecto ahora. Si al cerrar la ronda es el único jugador en pie que jugó un Espía, gana 1 ficha.';
    case 1:
      return 'Adivina la carta de otro jugador; si acierta, queda fuera.';
    case 2:
      return 'Mira la mano de otro jugador.';
    case 3:
      return 'Compara manos con otro jugador: la más baja queda fuera; si empatan, nadie.';
    case 4:
      return mine
        ? 'Nadie puede elegirte con una carta hasta tu próximo turno.'
        : 'Nadie puede elegirlo con una carta hasta su próximo turno.';
    case 5:
      return 'Un jugador descarta su mano y roba; si descarta la Princesa, queda fuera.';
    case 6:
      return 'Roba 2 cartas, conserva 1 y deja las otras 2 al fondo del mazo.';
    case 7:
      return mine
        ? 'Intercambias tu mano con la de otro jugador.'
        : 'Intercambia su mano con la de otro jugador.';
    case 8:
      return 'No tiene efecto. Se juega a la fuerza si se tiene el Rey o el Príncipe, o como farol.';
    case 9:
      return 'Quien la descarta queda fuera de la ronda.';
  }
}

/** Una frase larga alarga un poco el tiempo de lectura de los avisos. */
export const effectExtraMs = (text: string): number => (text.length > 60 ? 1500 : 0);
