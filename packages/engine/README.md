# @loveletter/engine

Motor puro de Love Letter (edición 2019, 21 cartas, 2 a 6 jugadores). TypeScript sin red, sin UI y sin dependencias. Reglas en `config/loveletter-rules.json`.

## Ciclo de una partida

```ts
const created = createGame({ players, starterId? }, random); // Result<GameState>, ya con la ronda 1 repartida
const next = applyAction(state, action, random);              // Result<GameState>, no muta el estado
const view = viewFor(state, playerId);                        // PlayerView: lo que ese jugador puede saber
```

- `random` es un `() => number` en [0,1). Solo se usa al barajar (crear la partida y `continue_round`). En pruebas, `seededRandom(seed)`.
- Todo el estado es JSON serializable; el servidor lo guarda tal cual.
- `Result<T>` es `{ ok: true, value } | { ok: false, error: { code, message } }`.

### Fases (`state.phase`)

| Fase         | Quién actúa                          | Acción                                                            |
| ------------ | ------------------------------------ | ----------------------------------------------------------------- |
| `turn`       | `activeId` (ya robó: tiene 2 cartas) | `play_card`                                                       |
| `chancellor` | `activeId`                           | `chancellor_keep`                                                 |
| `round_over` | todos los humanos                    | `continue_round` (los bots, `Player.bot`, ya figuran confirmados) |
| `game_over`  | nadie                                | terminal; toda acción da `game_over`                              |

Con todos los jugadores confirmados se reparte la ronda siguiente automáticamente: abre el ganador de la ronda anterior (menor asiento si hubo varios). Si hay solo bots, la sala debe enviar `continue_round` por uno de ellos (`chooseBotAction` lo hace).

### Acciones

```ts
{ type: 'play_card', playerId, card: 0..9, targetId?, guess? }
{ type: 'chancellor_keep', playerId, keep: valor, bottomOrder: [valor, ...] }
{ type: 'continue_round', playerId }   // idempotente
```

- Las cartas se identifican por valor (0 Espía, 1 Guardia, 2 Sacerdote, 3 Barón, 4 Doncella, 5 Príncipe, 6 Canciller, 7 Rey, 8 Condesa, 9 Princesa). Dos copias iguales son intercambiables.
- Si una carta pide objetivo y no hay ninguno legal, se juega sin `targetId`/`guess` (sin efecto). Si hay objetivos legales y no se manda, es `invalid_target`.
- `bottomOrder`: la primera carta es la primera que se robará de las devueltas; debe ser exactamente la mano menos `keep` (2 cartas, o 1 si el mazo solo tenía 1).
- Códigos de error: `game_over`, `wrong_phase`, `unknown_player`, `not_your_turn`, `card_not_in_hand`, `countess_forced`, `invalid_target`, `target_protected`, `invalid_guess`, `invalid_chancellor_choice`, y en la creación `invalid_player_count`, `duplicate_player`.

## `PlayerView`

- `you`: `{ id, name, seat, hand, eliminated, protected, tokens }`. `hand` es solo la mano propia.
- `players[]` (por asiento, incluido tú): `{ id, name, seat, bot, tokens, handSize, discards, protected, eliminated, spyPlayed, isActive }`. Nunca la mano ajena.
- `phase`, `round`, `tokensToWin`, `activeId`, `isMyTurn`, `awaiting` (a quién espera la mesa).
- `legalPlays`, `chancellor` (ver abajo), `deckSize`, `hasSetAside` (nunca su valor), `faceUp` (las 3 de la partida de 2).
- `events`: crónica completa y en orden (`GameEvent`, con `id` creciente y `round`). Los datos privados viajan en `event.secret` y solo existen en las vistas de los destinatarios (`secret.to`):
  - `draw` (turno o Príncipe): `secret.drawn` = lo robado.
  - `priest`: solo quien juega ve `secret.hands[targetId]`.
  - `baron`: ambos ven las dos manos; públicamente solo `loserId`/`loserCard`.
  - `king`: ambos ven la mano que tienen DESPUÉS del intercambio (`secret.hands[id]`).
  - `chancellor`: solo el activo ve `secret.drawn`; los demás ven cuántas (`drawn: number`).
- `summary` (`RoundSummary`, en `round_over`/`game_over`): `reason` (`last_standing` | `highest_hand` | `discard_tiebreak` | `shared_tie`), `winnerIds`, `spyBonusId`, `survivors`, `eliminated`, `revealedHands` (solo si se acabó el mazo), `discardTotals` (si hubo desempate), `setAside` (la carta apartada boca abajo, revelada solo al terminar la ronda; si un Príncipe la robó sigue siendo la original), `awarded`, `tokens`, `gameWinnerIds`. `history` guarda las de rondas anteriores.
- `roundOver`: `{ ready, waitingFor, youReady }` para el botón "Continuar".
- `winnerIds` al terminar la partida.

## Cómo usa `legalPlays` la UI

Solo se rellena en la fase `turn` cuando es tu turno (si no, `[]`). Una entrada por valor distinto en la mano:

```ts
{ card, playable, blockedBy: 'countess' | null,
  targetRule: 'none' | 'other' | 'any',
  targets: PlayerId[], needsTarget: boolean, needsGuess: boolean, guesses: CardValue[] }
```

1. Mostrar como jugables solo las entradas con `playable`. Una con `blockedBy: 'countess'` se muestra deshabilitada con el motivo.
2. Si `needsTarget`, pedir un jugador de `targets` (el Príncipe incluye a uno mismo). Si además `needsGuess`, pedir un valor de `guesses` (0 sí, 1 no).
3. Si `targetRule !== 'none'` pero `needsTarget` es `false` (todos protegidos/eliminados), la carta se juega directamente y no tiene efecto: avisar al jugador y enviar `play_card` sin objetivo.
4. En la fase `chancellor`, `view.chancellor = { hand, keepOptions, returnCount }`: elegir una de `keepOptions` y ordenar las `returnCount` restantes.

## Bots

```ts
chooseBotAction(view, notes, random): { action, notes } | null
createBotNotes(random) / emptyBotNotes()
botEvents(before, after)                 // eventos públicos nuevos entre dos estados
botRemark(view, notes, event, random)    // { text, involved } | null
botFarewell(view, notes, random)         // frase al terminar la partida
eventKey(event)                          // clave de la crónica ('ev-<id>') para `ChatLine.after`
```

El bot decide solo con su `PlayerView`: cuenta las copias que no ha visto, recuerda lo que descubrió (Sacerdote, Barón, Rey) reconstruyéndolo de su propia crónica, nunca juega la Princesa, acusa con la carta más probable y evita Barones perdidos. `chooseBotAction` devuelve también `continue_round` en `round_over`.

## Pruebas

`pnpm --filter @loveletter/engine test`: unitarias de cada carta y borde, vistas, bots, y simulaciones (3000 partidas con bots de 2 a 6 jugadores, 600 con jugadas aleatorias legales; invariante de 21 cartas en cada paso y comprobación de que ninguna vista depende de las cartas ocultas).
