import { type CardValue, type GameState, viewFor } from '@loveletter/engine';
import { tableMoment } from '@loveletter/protocol';
import { cleanup, render, act as rtlAct, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRoomStore } from '../store/room';
import { useUiStore } from '../store/ui';
import { rig, roomFor, seed, step } from '../test-utils';
import { GameScreen } from './GameScreen';

afterEach(() => {
  cleanup();
  useUiStore.setState({ dialog: null });
});

function mount(state: GameState, viewer = 'p0') {
  const fns = { act: vi.fn(() => true), send: vi.fn(() => true) };
  seed(state, viewer, fns);
  const utils = render(
    <MemoryRouter>
      <GameScreen />
    </MemoryRouter>,
  );
  return { ...utils, ...fns, user: userEvent.setup() };
}

const play = (state: GameState, card: CardValue, targetId?: string, guess?: CardValue) =>
  step(state, { type: 'play_card', playerId: state.activeId as string, card, targetId, guess });

const dialog = () => screen.getByRole('dialog');

describe('GameScreen: mesa', () => {
  it('muestra tu mano, el turno y a los rivales solo con reversos', () => {
    const state = rig({ hands: [[1, 5], [3], [9]] });
    const { container } = mount(state);
    expect(screen.getAllByText('Es tu turno').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^1, Guardia/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^5, Príncipe/ })).toBeInTheDocument();
    // Cada rival enseña un reverso, nunca su carta.
    expect(container.querySelectorAll('.ll-seat .ll-back')).toHaveLength(2);
    expect(container.querySelectorAll('.ll-seat .ll-card:not(.sm)')).toHaveLength(0);
    const seatLabels = Array.from(container.querySelectorAll('.ll-seat')).map((e) =>
      e.getAttribute('aria-label'),
    );
    for (const label of seatLabels) expect(label).not.toMatch(/Barón|Princesa/);
  });

  it('cuando no es tu turno espera al jugador activo y no deja jugar', () => {
    const state = rig({ hands: [[1, 5], [3], [9]] });
    mount(state, 'p1');
    expect(screen.getAllByText('Esperando a Ana').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Jugar/ })).toBeNull();
  });

  it('avisa a la sala con table_ready cuando todo está en calma', async () => {
    const state = rig({ hands: [[1, 5], [3], [9]] });
    const { send } = mount(state);
    await waitFor(
      () =>
        expect(send).toHaveBeenCalledWith({
          type: 'table_ready',
          moment: tableMoment(viewFor(state, 'p0')),
        }),
      { timeout: 3000 },
    );
  });

  it('la Condesa bloquea Rey y Príncipe', async () => {
    const state = rig({ hands: [[8, 7], [3], [9]] });
    const { user } = mount(state);
    expect(
      screen.getByRole('button', { name: /^7, Rey.*Bloqueada por la Condesa/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jugar Condesa' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /^7, Rey/ }));
    expect(screen.getByRole('button', { name: 'Jugar Rey' })).toBeDisabled();
    expect(screen.getByText('Con la Condesa en la mano no puedes jugar Rey.')).toBeInTheDocument();
  });
});

describe('GameScreen: jugadas', () => {
  it('Guardia: jugador y carta en una ventana', async () => {
    const { user, act } = mount(rig({ hands: [[1, 2], [3], [4]] }));
    await user.click(screen.getByRole('button', { name: 'Jugar Guardia' }));
    const d = within(dialog());
    const accuse = d.getByRole('button', { name: 'Acusar' });
    expect(accuse).toBeDisabled();
    await user.click(d.getByRole('button', { name: /Beto/ }));
    await user.click(d.getByRole('button', { name: /^3\s*Barón/ }));
    await user.click(d.getByRole('button', { name: 'Acusar a Beto: Barón' }));
    expect(act).toHaveBeenCalledWith({ type: 'play_card', card: 1, targetId: 'p1', guess: 3 });
  });

  it('Sacerdote, Barón y Rey eligen jugador y envían al instante; los protegidos no se pueden elegir', async () => {
    const { user, act } = mount(rig({ hands: [[2, 7], [3], [4]], protect: [2] }));
    await user.click(screen.getByRole('button', { name: /^2, Sacerdote/ }));
    await user.click(screen.getByRole('button', { name: 'Jugar Sacerdote' }));
    const d = within(dialog());
    expect(d.getByRole('button', { name: /Carla/ })).toHaveAttribute('aria-disabled', 'true');
    expect(d.queryByRole('button', { name: /\(tú\)/ })).toBeNull();
    await user.click(d.getByRole('button', { name: /Beto/ }));
    expect(act).toHaveBeenCalledWith({ type: 'play_card', card: 2, targetId: 'p1' });
  });

  it('Príncipe: puedes elegirte y se muestra qué descartarías', async () => {
    const { user, act } = mount(rig({ hands: [[5, 2], [3], [4]] }));
    await user.click(screen.getByRole('button', { name: 'Jugar Príncipe' }));
    const d = within(dialog());
    expect(d.getByText('Descartas Sacerdote y robas')).toBeInTheDocument();
    await user.click(d.getByRole('button', { name: /Ana \(tú\)/ }));
    expect(act).toHaveBeenCalledWith({ type: 'play_card', card: 5, targetId: 'p0' });
  });

  it('Princesa pide confirmación y se puede cancelar', async () => {
    const { user, act } = mount(rig({ hands: [[9, 2], [3], [4]] }));
    await user.click(screen.getByRole('button', { name: /^9, Princesa/ }));
    await user.click(screen.getByRole('button', { name: 'Jugar Princesa' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(act).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Jugar Princesa' }));
    await user.click(screen.getByRole('button', { name: 'Sí, jugarla y salir' }));
    expect(act).toHaveBeenCalledWith({ type: 'play_card', card: 9 });
  });

  it('sin objetivos posibles: avisa y envía sin objetivo', async () => {
    const { user, act } = mount(rig({ hands: [[1, 2], [3], [4]], protect: [1, 2] }));
    expect(screen.getByText('No hay a quién elegir: se descarta sin efecto.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jugar Guardia' }));
    expect(act).toHaveBeenCalledWith({ type: 'play_card', card: 1 });
  });

  it('Canciller: conservar una y ordenar el fondo (primera = primera al fondo)', async () => {
    const before = rig({ hands: [[6, 2], [3], [4]], deck: [7, 8, 1, 1, 1] });
    const { user, act } = mount(before);
    const chan = play(before, 6);
    rtlAct(() => seed(chan, 'p0', { act }));
    // La vista nueva abre la elección sin que el jugador haga nada.
    const d = within(await screen.findByRole('dialog', { name: 'Canciller: elegir carta' }));
    await user.click(d.getByRole('button', { name: 'Conservar Sacerdote' }));
    const o = within(screen.getByRole('dialog', { name: 'Canciller: ordenar el fondo del mazo' }));
    await user.click(o.getByRole('button', { name: 'Bajar Rey' }));
    await user.click(o.getByRole('button', { name: 'Confirmar orden' }));
    expect(act).toHaveBeenCalledWith({ type: 'chancellor_keep', keep: 2, bottomOrder: [8, 7] });
    // Y el motor lo acepta tal cual.
    const done = step(chan, {
      type: 'chancellor_keep',
      playerId: 'p0',
      keep: 2,
      bottomOrder: [8, 7],
    });
    expect(done.deck.slice(-2)).toEqual([8, 7]);
  });
});

describe('GameScreen: resultados', () => {
  async function playAndSee(state: GameState, card: CardValue, target?: string, guess?: CardValue) {
    const { user, act, rerender } = mount(state);
    const after = play(state, card, target, guess);
    rtlAct(() => seed(after, 'p0', { act }));
    return { user, after, rerender };
  }

  it('Sacerdote: el aviso público de tu jugada y, aparte, la carta "Solo tú lo ves"', async () => {
    await playAndSee(rig({ hands: [[2, 7], [3], [4]] }), 2, 'p1');
    const d = within(await screen.findByRole('dialog', { name: 'Tu jugada: Sacerdote' }));
    expect(d.getByRole('heading', { name: 'Tú jugaste el Sacerdote' })).toBeInTheDocument();
    expect(d.getByText('Público')).toBeInTheDocument();
    const secret = within(d.getByRole('region', { name: 'Solo tú lo ves' }));
    const face = secret.getByRole('img', { name: 'Beto: Barón' });
    // Carta grande con arte, nombre y efecto; nunca la pequeña.
    expect(face).not.toHaveClass('sm');
    expect(face).toHaveTextContent('Barón');
  });

  it('Guardia y Barón: el mismo aviso público que ven los demás', async () => {
    await playAndSee(rig({ hands: [[1, 2], [3], [4]] }), 1, 'p1', 3);
    const d = within(await screen.findByRole('dialog', { name: 'Tu jugada: Guardia' }));
    expect(d.getByText('Público')).toBeInTheDocument();
    expect(
      d.getByText(
        'Jugaste el Guardia contra Beto y nombraste el Barón: acertaste. Beto queda fuera.',
      ),
    ).toBeInTheDocument();
    expect(d.queryByRole('region', { name: 'Solo tú lo ves' })).toBeNull();
    cleanup();
    await playAndSee(rig({ hands: [[3, 2], [5], [4]] }), 3, 'p1');
    const b = within(await screen.findByRole('dialog', { name: 'Tu jugada: Barón' }));
    expect(b.getByText('Público')).toBeInTheDocument();
    expect(b.getByText(/tu mano era la más baja \(Sacerdote\) y quedas fuera/)).toBeInTheDocument();
    // Ambas manos solo para ti.
    expect(
      within(b.getByRole('region', { name: 'Solo tú lo ves' })).getAllByRole('img'),
    ).toHaveLength(2);
  });

  it('Rey: lo entregado y lo recibido, solo para ti', async () => {
    await playAndSee(rig({ hands: [[7, 1], [3], [4]] }), 7, 'p1');
    const d = within(await screen.findByRole('dialog', { name: 'Tu jugada: Rey' }));
    const secret = within(d.getByRole('region', { name: 'Solo tú lo ves' }));
    expect(secret.getByText('Entregas')).toBeInTheDocument();
    expect(secret.getByText('Recibes')).toBeInTheDocument();
  });

  it('no repite resultados antiguos al abrir la pantalla (reconexión)', () => {
    const after = play(rig({ hands: [[2, 7], [3], [4]] }), 2, 'p1');
    mount(after);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('GameScreen: fuga de datos', () => {
  it('un tercero no ve resultados ni manos ajenas cuando otros juegan Sacerdote o Rey', async () => {
    const before = rig({ hands: [[2, 7], [3], [4]] });
    const { act, container } = mount(before, 'p2');
    const afterPriest = play(before, 2, 'p1');
    rtlAct(() => seed(afterPriest, 'p2', { act }));
    // Ve el aviso público de la jugada, nunca lo que Ana vio.
    const notice = within(await screen.findByRole('dialog', { name: 'Jugada de Ana: Sacerdote' }));
    expect(notice.getByText('Público')).toBeInTheDocument();
    expect(notice.queryByText(/Barón/)).toBeNull();
    await userEvent.setup().click(notice.getByRole('button', { name: 'Continuar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelectorAll('.ll-seat .ll-card:not(.sm)')).toHaveLength(0);
    // La crónica dice que miró, no qué vio.
    await userEvent.setup().click(screen.getByRole('button', { name: /^Registro/ }));
    const log = within(screen.getByRole('dialog', { name: 'Registro de jugadas' }));
    expect(log.getByText('Ana jugó el Sacerdote y miró la mano de Beto.')).toBeInTheDocument();
    expect(log.queryByText(/tenía un Barón/)).toBeNull();
    await userEvent.setup().keyboard('{Escape}');

    cleanup();
    const k = rig({ hands: [[7, 1], [3], [4]] });
    const m = mount(k, 'p2');
    rtlAct(() => seed(play(k, 7, 'p1'), 'p2', { act: m.act }));
    const kn = within(await screen.findByRole('dialog', { name: 'Jugada de Ana: Rey' }));
    expect(kn.queryByText(/Recibiste|Recibes/)).toBeNull();
    expect(kn.queryByRole('img', { name: /Guardia|Barón/ })).toBeNull();
    // La vista que recibe el cliente no lleva la mano ajena.
    expect(JSON.stringify(roomFor(play(k, 7, 'p1'), 'p2').game)).not.toContain('"hands"');
  });
});

describe('GameScreen: fin de ronda y de partida', () => {
  it('resumen de ronda tras el resultado y botón Continuar', async () => {
    const before = rig({ hands: [[1, 2], [3]] });
    const { user, act } = mount(before);
    const after = play(before, 1, 'p1', 3);
    rtlAct(() => seed(after, 'p0', { act }));
    // Primero el resultado de tu jugada.
    await user.click(await screen.findByRole('button', { name: 'Continuar' }));
    const d = within(await screen.findByRole('dialog', { name: 'Fin de la ronda 1' }));
    expect(d.getByRole('heading', { name: 'Ganaste la ronda' })).toBeInTheDocument();
    expect(d.getByText('Fuiste el último jugador en pie.')).toBeInTheDocument();
    expect(d.getByText('+1')).toBeInTheDocument();
    await user.click(d.getByRole('button', { name: 'Continuar' }));
    expect(act).toHaveBeenCalledWith({ type: 'continue_round' });
  });

  it('muestra las manos reveladas y espera a los demás', async () => {
    let s = rig({ hands: [[2, 3], [5], [4]], deck: [1] });
    s = play(s, 2, 'p1'); // p1 roba y el mazo queda vacío
    s = play(s, 5, 'p1'); // p1 se descarta... cierra por mazo vacío o sigue
    const rounds = s.phase === 'round_over' ? s : null;
    if (!rounds) return;
    seed(rounds, 'p0');
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole('dialog', { name: /Fin de la ronda/ })).toBeInTheDocument();
  });

  it('fin de partida: podio, ganador y nueva partida solo para el anfitrión', async () => {
    const before = rig({ hands: [[1, 2], [3]], tokens: [5, 2] });
    const { user, send, act } = mount(before);
    const after = play(before, 1, 'p1', 3);
    rtlAct(() => seed(after, 'p0', { act, send }));
    await user.click(await screen.findByRole('button', { name: 'Continuar' }));
    const d = within(await screen.findByRole('dialog', { name: 'Fin de la partida' }));
    expect(d.getByText('¡Ganaste la partida!')).toBeInTheDocument();
    const podium = d.getByRole('list', { name: 'Podio' });
    expect(within(podium).getAllByRole('listitem')[0]).toHaveTextContent('Ana');
    expect(within(podium).getByText('Ganador')).toBeInTheDocument();
    await user.click(d.getByRole('button', { name: 'Nueva partida' }));
    expect(send).toHaveBeenCalledWith({ type: 'new_game' });
  });

  it('un invitado espera al anfitrión', async () => {
    const before = rig({ hands: [[1, 2], [3]], tokens: [5, 2] });
    const after = play(before, 1, 'p1', 3);
    mount(after, 'p1');
    const d = within(await screen.findByRole('dialog', { name: 'Fin de la partida' }));
    expect(d.queryByRole('button', { name: 'Nueva partida' })).toBeNull();
    expect(d.getByText(/Esperando al anfitrión/)).toBeInTheDocument();
  });
});

describe('GameScreen: pausa y conexión', () => {
  it('pausa por desconexión con cuenta; el anfitrión no puede terminar antes de tiempo', () => {
    const state = rig({ hands: [[1, 2], [3], [4]] });
    const now = Date.now();
    seed(
      state,
      'p0',
      {},
      {
        status: 'paused',
        pause: { disconnectedIds: ['p1'], since: now - 5000, hostCanEndAt: now + 115000 },
      },
    );
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>,
    );
    const d = within(screen.getByRole('alertdialog', { name: 'Partida en pausa' }));
    expect(d.getByText('Beto perdió la conexión')).toBeInTheDocument();
    expect(d.getByTestId('pause-clock')).toHaveTextContent(/En pausa · 0:0[5-9] de 2:00/);
    expect(d.queryByRole('button', { name: 'Terminar la partida' })).toBeNull();
  });

  it('el anfitrión puede terminar pasado el tiempo', () => {
    const state = rig({ hands: [[1, 2], [3], [4]] });
    const now = Date.now();
    const send = vi.fn(() => true);
    seed(
      state,
      'p0',
      { send },
      {
        status: 'paused',
        pause: { disconnectedIds: ['p1'], since: now - 130000, hostCanEndAt: now - 10000 },
      },
    );
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Terminar la partida' })).toBeInTheDocument();
  });

  it('sin conexión no se puede jugar', () => {
    const state = rig({ hands: [[1, 2], [3], [4]] });
    mount(state);
    rtlAct(() => useRoomStore.setState({ status: 'reconnecting' }));
    expect(screen.getByRole('alertdialog', { name: 'Sin conexión' })).toBeInTheDocument();
  });
});

describe('GameScreen: bots', () => {
  it('muestra la frase de un bot junto a su asiento', async () => {
    const state = rig({ hands: [[1, 2], [3], [4]], bots: 1 });
    const { act } = mount(state);
    rtlAct(() =>
      seed(
        state,
        'p0',
        { act },
        { chat: [{ id: 1, playerId: 'p2', text: '¡Qué mala suerte!', after: null }] },
      ),
    );
    const text = await screen.findByText('¡Qué mala suerte!', {}, { timeout: 3000 });
    const bubble = text.closest('.ll-bubble');
    // Capa propia fuera de los asientos: nada del tablero lo tapa ni le hereda opacidad.
    expect(bubble?.closest('.ll-seat')).toBeNull();
    expect(bubble?.parentElement).toHaveClass('ll-bubbles');
    expect(bubble?.parentElement?.parentElement).toBe(document.body);
    expect(bubble?.parentElement).toHaveAttribute('aria-live', 'polite');
    expect(bubble).toHaveTextContent('Carla dice:');
  });
});

describe('GameScreen: avisos de jugadas ajenas', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    useUiStore.setState({ noticeMode: 'full' });
  });

  function watch(before: GameState, after: GameState, viewer: string) {
    const fns = { act: vi.fn(() => true), send: vi.fn(() => true) };
    seed(before, viewer, fns);
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>,
    );
    rtlAct(() => seed(after, viewer, fns));
    return { ...fns, user: userEvent.setup() };
  }

  it('muestra quién, la carta grande, contra quién y el resultado; no es tu jugada', async () => {
    const before = rig({ hands: [[1, 2], [3], [4]] });
    watch(before, play(before, 1, 'p1', 5), 'p2');
    const d = within(await screen.findByRole('dialog', { name: 'Jugada de Ana: Guardia' }));
    expect(d.getByRole('heading', { name: 'Ana jugó el Guardia' })).toBeInTheDocument();
    expect(d.getByRole('img', { name: /Guardia/ })).toBeInTheDocument();
    expect(d.getByText('Beto')).toBeInTheDocument();
    expect(
      d.getByText('Ana jugó el Guardia contra Beto y nombró el Príncipe: falló.'),
    ).toBeInTheDocument();
    expect(d.getByText('Público')).toBeInTheDocument();
    expect(d.getByText('Se cierra en 5 s')).toBeInTheDocument();
  });

  it('tu propia jugada no abre aviso de jugada ajena', async () => {
    const before = rig({ hands: [[2, 7], [3], [4]] });
    watch(before, play(before, 2, 'p1'), 'p0');
    await screen.findByRole('dialog', { name: 'Tu jugada: Sacerdote' });
    expect(screen.queryByRole('dialog', { name: /^Jugada de/ })).toBeNull();
  });

  it('los avisos que no te afectan se cierran solos; los que sí, esperan a Continuar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const before = rig({ hands: [[1, 2], [3], [4]] });
    const after = play(before, 1, 'p1', 5);
    watch(before, after, 'p2');
    await screen.findByRole('dialog', { name: 'Jugada de Ana: Guardia' });
    await rtlAct(() => vi.advanceTimersByTimeAsync(2000));
    await rtlAct(() => vi.advanceTimersByTimeAsync(3600));
    expect(screen.queryByRole('dialog', { name: /^Jugada de/ })).toBeNull();

    cleanup();
    watch(before, after, 'p1');
    await screen.findByRole('dialog', { name: 'Jugada de Ana: Guardia' });
    expect(screen.queryByText(/Se cierra en/)).toBeNull();
    await rtlAct(() => vi.advanceTimersByTimeAsync(8000));
    expect(screen.getByRole('dialog', { name: 'Jugada de Ana: Guardia' })).toBeInTheDocument();
  });

  it('la cuenta se pausa al pasar el cursor', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const before = rig({ hands: [[1, 2], [3], [4]] });
    watch(before, play(before, 1, 'p1', 5), 'p2');
    const d = await screen.findByRole('dialog', { name: 'Jugada de Ana: Guardia' });
    const inner = within(d).getByRole('status').closest('div.grid') as HTMLElement;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.mouseEnter(inner.parentElement as HTMLElement);
    await rtlAct(() => vi.advanceTimersByTimeAsync(7000));
    expect(screen.getByRole('dialog', { name: 'Jugada de Ana: Guardia' })).toBeInTheDocument();
  });

  it('cola ordenada: una tras otra y table_ready al cerrar la última', async () => {
    const before = rig({ hands: [[4, 2], [1], [3]], deck: [5, 1, 1, 1] });
    const after = play(play(before, 4), 1, 'p2', 5);
    const { user, send } = watch(before, after, 'p2');
    const first = within(await screen.findByRole('dialog', { name: 'Jugada de Ana: Doncella' }));
    expect(
      first.getByText('Ana jugó la Doncella: queda protegido hasta su próximo turno.'),
    ).toBeInTheDocument();
    await user.click(first.getByRole('button', { name: 'Continuar' }));
    const second = within(await screen.findByRole('dialog', { name: 'Jugada de Beto: Guardia' }));
    expect(second.getByText('Ti')).toBeInTheDocument();
    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'table_ready', moment: tableMoment(viewFor(after, 'p2')) }),
    );
    await user.click(second.getByRole('button', { name: 'Continuar' }));
    await waitFor(
      () =>
        expect(send).toHaveBeenCalledWith({
          type: 'table_ready',
          moment: tableMoment(viewFor(after, 'p2')),
        }),
      { timeout: 3000 },
    );
  });

  it('modo breve: aviso no bloqueante y la preferencia se recuerda', async () => {
    const before = rig({ hands: [[1, 2], [3], [4]] });
    const { user } = watch(before, before, 'p2');
    await user.click(screen.getByRole('switch', { name: /Avisos de jugadas: completos/ }));
    expect(localStorage.getItem('loveletter:notices')).toBe('brief');
    expect(screen.getByRole('switch', { name: /Avisos de jugadas: breves/ })).toBeInTheDocument();
    rtlAct(() => seed(play(before, 1, 'p1', 5), 'p2'));
    expect(
      await screen.findByText('Ana jugó el Guardia contra Beto y nombró el Príncipe: falló.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
  });

  it('un evento nuevo suma al contador del registro', async () => {
    const before = rig({ hands: [[1, 2], [3], [4]] });
    const { user } = watch(before, play(before, 1, 'p1', 5), 'p2');
    expect(await screen.findByLabelText(/sin leer/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Registro/ }));
    expect(screen.queryByLabelText(/sin leer/)).toBeNull();
  });

  it('el botón Reglas abre un modal sin salir de la partida y Escape lo cierra', async () => {
    const { user } = watch(
      rig({ hands: [[1, 2], [3], [4]] }),
      rig({ hands: [[1, 2], [3], [4]] }),
      'p0',
    );
    await user.click(screen.getByRole('button', { name: 'Reglas' }));
    const d = within(screen.getByRole('dialog', { name: 'Reglas del juego' }));
    expect(d.getByText('Las 10 cartas')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Jugar Guardia' })).toBeInTheDocument();
  });

  it('tus descartes y el botón de jugar están en la mesa, sin abrir nada', () => {
    mount(rig({ hands: [[1, 2], [3], [4]], discards: { 0: [4, 5] } }));
    expect(screen.getByRole('button', { name: /^Tus descartes: 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jugar Guardia' })).toBeInTheDocument();
  });
});

describe('GameScreen: elegir jugador y logo', () => {
  it('título corto, instrucción como subtítulo y descartes contados dentro de la tarjeta', async () => {
    const { user } = mount(rig({ hands: [[3, 2], [5], [4]], discards: { 1: [1, 1, 1, 1, 5, 5] } }));
    await user.click(screen.getByRole('button', { name: /^3, Barón/ }));
    await user.click(screen.getByRole('button', { name: 'Jugar Barón' }));
    const d = within(dialog());
    expect(d.getByRole('heading', { name: 'Barón' })).toBeInTheDocument();
    expect(d.getByText(/^Elige con quién comparar manos\. Protegidos/)).toBeInTheDocument();
    const tile = d.getByRole('button', { name: /Beto/ });
    expect(within(tile).getByText('6 descartes')).toBeInTheDocument();
    const fan = tile.querySelector('.ll-fan');
    expect(fan).toHaveClass('wrap');
    expect(fan?.querySelectorAll('.ll-card')).toHaveLength(6);
    expect(
      within(d.getByRole('button', { name: /Carla/ })).getByText('Sin descartes'),
    ).toBeInTheDocument();
  });

  it('el logo de la barra abre el diálogo de salir', async () => {
    const { user } = mount(rig({ hands: [[1, 2], [3], [4]] }));
    expect(screen.getByRole('img', { name: 'Love Letter' })).toHaveAttribute(
      'src',
      '/assets/logo-lockup.webp',
    );
    await user.click(screen.getByRole('button', { name: 'Love Letter: salir al inicio' }));
    expect(screen.getByRole('alertdialog', { name: 'Salir de la sala' })).toBeInTheDocument();
  });

  it('las caras del aviso de jugada ajena también son grandes', async () => {
    const before = rig({ hands: [[7, 1], [3], [4]] });
    const after = step(before, { type: 'play_card', playerId: 'p0', card: 7, targetId: 'p1' });
    const fns = { act: vi.fn(() => true), send: vi.fn(() => true) };
    seed(before, 'p1', fns);
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>,
    );
    rtlAct(() => seed(after, 'p1', fns));
    const d = within(await screen.findByRole('dialog', { name: 'Jugada de Ana: Rey' }));
    const recibes = d.getByRole('img', { name: 'Recibes: Guardia' });
    expect(recibes).not.toHaveClass('sm');
  });
});

describe('GameScreen: avisos de tus jugadas triviales', () => {
  afterEach(() => {
    vi.useRealTimers();
    useUiStore.setState({ noticeMode: 'full' });
  });

  function startWith(before: GameState, mode: 'full' | 'brief' = 'full') {
    useUiStore.setState({ noticeMode: mode });
    const fns = { act: vi.fn(() => true), send: vi.fn(() => true) };
    seed(before, 'p0', fns);
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>,
    );
    return fns;
  }

  it.each<[CardValue, string, string]>([
    [0, 'Tú jugaste el Espía', 'Jugaste el Espía.'],
    [4, 'Tú jugaste la Doncella', 'Jugaste la Doncella: quedas protegido hasta tu próximo turno.'],
    [8, 'Tú jugaste la Condesa', 'Jugaste la Condesa: sin efecto.'],
  ])(
    'carta %i, modo completo: ventana con la carta grande y cierre solo',
    async (card, title, text) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const before = rig({ hands: [[card, 2], [3], [5]] });
      const fns = startWith(before);
      rtlAct(() => seed(play(before, card), 'p0', fns));
      const d = within(await screen.findByRole('dialog', { name: /^Tu jugada: / }));
      expect(d.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(d.getByText(text, { selector: 'p' })).toBeInTheDocument();
      expect(d.getByText('Público')).toBeInTheDocument();
      expect(d.getByText('Se cierra en 5 s')).toBeInTheDocument();
      // Sin el texto explicativo de la regla del Espía.
      expect(d.queryByText(/Si al cerrar la ronda/)).toBeNull();
      await rtlAct(() => vi.advanceTimersByTimeAsync(5600));
      expect(screen.queryByRole('dialog')).toBeNull();
    },
  );

  it('modo breve: el mismo texto en el aviso inferior, sin Continuar, y se cierra solo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const before = rig({ hands: [[0, 2], [3], [5]] });
    const fns = startWith(before, 'brief');
    rtlAct(() => seed(play(before, 0), 'p0', fns));
    expect(await screen.findByText('Jugaste el Espía.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar aviso' })).toBeInTheDocument();
    await rtlAct(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Jugaste el Espía.')).toBeNull();
  });

  it('sin objetivos: el aviso explica que no había a quién elegir', async () => {
    const before = rig({ hands: [[1, 2], [3], [4]], protect: [1, 2] });
    const fns = startWith(before);
    rtlAct(() => seed(play(before, 1), 'p0', fns));
    expect(
      await screen.findByText('Jugaste el Guardia, pero no había a quién elegir: sin efecto.'),
    ).toBeInTheDocument();
  });

  it('table_ready sale al cerrarse el aviso, sin esperar un clic', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const before = rig({ hands: [[4, 2], [3], [5]] });
    const fns = startWith(before);
    const after = play(before, 4);
    rtlAct(() => seed(after, 'p0', fns));
    await screen.findByRole('dialog', { name: 'Tu jugada: Doncella' });
    expect(fns.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'table_ready', moment: tableMoment(viewFor(after, 'p0')) }),
    );
    await rtlAct(() => vi.advanceTimersByTimeAsync(5600));
    // Cada etapa (cierre, vuelo del siguiente robo, pausa de calma) necesita su propio ciclo de React.
    for (let i = 0; i < 6; i++) await rtlAct(() => vi.advanceTimersByTimeAsync(300));
    expect(fns.send).toHaveBeenCalledWith({
      type: 'table_ready',
      moment: tableMoment(viewFor(after, 'p0')),
    });
  });
});

describe('GameScreen: carta guía', () => {
  it('la carta guía solo muestra las copias totales, sin "quedan"', async () => {
    const state = rig({ hands: [[3, 2], [5], [4]], discards: { 1: [3] } });
    const { user } = mount(state);
    const panel = screen.getByRole('button', { name: 'Carta guía: ampliar' });
    expect(within(panel).queryByText(/quedan/)).toBeNull();
    expect(within(panel).getByText('×6')).toBeInTheDocument();
    await user.click(panel);
    const g = within(screen.getByRole('dialog', { name: 'Carta guía' }));
    expect(g.queryByText(/quedan|a la vista/)).toBeNull();
    expect(g.getAllByText(/^×\d$/).length).toBe(10);
    // Cada fila lleva la carta real con arte (nunca un icono) y su valor y nombre como alt.
    const imgs = g.getAllByRole('img');
    expect(imgs).toHaveLength(10);
    expect(g.getByRole('img', { name: '3, Barón' })).toHaveAttribute(
      'src',
      '/assets/card-3-sm.webp',
    );
    expect(document.querySelector('.ll-glist svg')).toBeNull();
  });
});
