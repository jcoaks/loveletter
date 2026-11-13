import type { RoomView } from '@loveletter/protocol';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../lib/api';
import { seatToken } from '../../lib/session';
import { useRoomStore } from '../../store/room';
import { HomeScreen } from './Home';
import { JoinLinkScreen } from './JoinLink';
import { LobbyScreen } from './Lobby';

const api = vi.hoisted(() => ({ getRoomInfo: vi.fn(), createRoom: vi.fn() }));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  getRoomInfo: api.getRoomInfo,
  createRoom: api.createRoom,
}));

const Stub = () => <div>sala {useParams().code}</div>;
const info = {
  code: 'KX7-QM2',
  status: 'lobby',
  playerCount: 2,
  joinable: true,
  playerNames: ['Ana', 'Beto'],
  hostName: 'Ana',
};

beforeEach(() => {
  localStorage.clear();
  api.getRoomInfo.mockReset();
  api.createRoom.mockReset();
  useRoomStore.setState({ code: null, room: null, status: 'idle', joinError: null, notice: null });
});
afterEach(cleanup);

function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/sala/:code" element={<Stub />} />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe('Home', () => {
  it('crea una sala, guarda el asiento y la abre', async () => {
    api.createRoom.mockResolvedValue({ code: 'KX7-QM2', playerId: 's1', seatToken: 'tok' });
    const user = renderHome();
    await user.type(screen.getByLabelText('Tu nombre en la mesa'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Crear sala' }));
    expect(await screen.findByText('sala KX7-QM2')).toBeInTheDocument();
    expect(api.createRoom).toHaveBeenCalledWith('Ana');
    expect(seatToken.get('KX7QM2')).toBe('tok');
  });

  it('no deja crear sin nombre', () => {
    renderHome();
    expect(screen.getByRole('button', { name: 'Crear sala' })).toBeDisabled();
  });

  it('un código incompleto no llama al servidor', async () => {
    const user = renderHome();
    await user.type(screen.getByLabelText('Código que te compartió el anfitrión'), 'KX7-Q');
    await user.click(screen.getByRole('button', { name: 'Entrar a la sala' }));
    expect(screen.getByRole('alert')).toHaveTextContent('El código está incompleto');
    expect(api.getRoomInfo).not.toHaveBeenCalled();
  });

  it('sala inexistente, llena o empezada', async () => {
    const user = renderHome();
    const input = screen.getByLabelText('Código que te compartió el anfitrión');
    api.getRoomInfo.mockRejectedValueOnce(new ApiRequestError('room_not_found', 'x', 404));
    await user.type(input, 'kx7qn2');
    await user.click(screen.getByRole('button', { name: 'Entrar a la sala' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos esa sala');
    api.getRoomInfo.mockResolvedValueOnce({ ...info, status: 'playing', joinable: false });
    await user.clear(input);
    await user.type(input, 'KX7-QM2');
    await user.click(screen.getByRole('button', { name: 'Entrar a la sala' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La partida ya comenzó');
  });

  it('una sala abierta lleva al enlace de la sala', async () => {
    api.getRoomInfo.mockResolvedValue(info);
    const user = renderHome();
    await user.type(screen.getByLabelText('Código que te compartió el anfitrión'), 'kx7qm2');
    await user.click(screen.getByRole('button', { name: 'Entrar a la sala' }));
    expect(await screen.findByText('sala KX7-QM2')).toBeInTheDocument();
  });
});

describe('Portada', () => {
  it('muestra los pasos, las diez cartas, las características y los créditos', () => {
    renderHome();
    expect(
      screen.getByRole('heading', { name: 'Cómo se juega en 30 segundos' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(20);
    const cards = screen
      .getAllByRole('button')
      .filter((b) => /Ver grande$/.test(b.getAttribute('aria-label') ?? ''));
    expect(cards).toHaveLength(10);
    expect(
      screen.getByRole('heading', { name: 'Todo lo que necesitas para jugar' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Seiji Kanai, publicado por AEG y Z-Man Games/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leer las reglas completas' })).toHaveAttribute(
      'href',
      '/reglas',
    );
  });

  it('una carta se amplía con su efecto y se puede recorrer', async () => {
    const user = renderHome();
    await user.click(screen.getByRole('button', { name: /^1, Guardia.*Ver grande$/ }));
    const dialog = screen.getByRole('dialog', { name: /Guardia/ });
    expect(within(dialog).getByText(/nombra una carta/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByRole('dialog', { name: /Sacerdote/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('los botones y enlaces-botón usan el sistema de estilos del juego', () => {
    renderHome();
    expect(screen.getByRole('button', { name: 'Crear sala' })).toHaveClass('ll-play');
    expect(screen.getByRole('button', { name: 'Entrar a la sala' })).toHaveClass('ll-ghost');
    for (const name of ['Cómo se juega', 'Reglas']) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveClass('ll-ghost', 'll-glass');
      expect(link.className).not.toMatch(/lh-nav|underline/);
    }
    // El pergamino usa la variante para fondo claro, no un estilo aparte.
    expect(screen.getByRole('button', { name: 'Crear sala' }).closest('.ll-light')).not.toBeNull();
  });

  it('el logo es el título y la página no tiene dos campos de nombre', () => {
    renderHome();
    expect(
      screen.getByRole('heading', { level: 1, name: /Love Letter en línea/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText('Tu nombre en la mesa')).toHaveLength(1);
  });
});

describe('Unirse por enlace', () => {
  it('muestra la mesa y se conecta con el nombre', async () => {
    api.getRoomInfo.mockResolvedValue(info);
    const connect = vi.fn();
    useRoomStore.setState({ connect });
    render(
      <MemoryRouter>
        <JoinLinkScreen code="KX7-QM2" />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Ana te invita a su mesa')).toBeInTheDocument();
    expect(screen.getByText('Ana · anfitrión')).toBeInTheDocument();
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Sentarme a la mesa' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Tu nombre en la mesa'), 'Carla');
    await user.click(button);
    expect(connect).toHaveBeenCalledWith('KX7QM2', { name: 'Carla' });
  });

  it('una partida empezada no deja entrar', async () => {
    api.getRoomInfo.mockResolvedValue({ ...info, status: 'playing', joinable: false });
    render(
      <MemoryRouter>
        <JoinLinkScreen code="KX7QM2" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('La partida ya comenzó');
  });
});

describe('Sala de espera', () => {
  const lobby = (host: boolean, over: object = {}) => ({
    code: 'KX7QM2',
    status: 'lobby' as const,
    you: { id: host ? 'a' : 'b', isHost: host },
    hostId: 'a',
    players: [
      { id: 'a', name: 'Ana', ready: true, connected: true, left: false, bot: false, host: true },
      {
        id: 'b',
        name: 'Beto',
        ready: false,
        connected: true,
        left: false,
        bot: false,
        host: false,
      },
      { id: 'c', name: 'Robo', ready: true, connected: true, left: false, bot: true, host: false },
    ],
    config: { bots: 1 },
    limits: { minPlayers: 2, maxPlayers: 6 },
    canStart: false,
    game: null,
    chat: [],
    pending: null,
    pause: null,
    ...over,
  });

  function setup(host: boolean, over: object = {}) {
    const send = vi.fn(() => true);
    useRoomStore.setState({
      code: 'KX7QM2',
      status: 'open',
      room: lobby(host, over),
      send: send as never,
    });
    render(
      <MemoryRouter>
        <LobbyScreen />
      </MemoryRouter>,
    );
    return { send, user: userEvent.setup() };
  }

  it('el anfitrión añade y quita bots, expulsa y no inicia sin listos', async () => {
    const { send, user } = setup(true);
    expect(screen.getByText('KX7-QM2')).toBeInTheDocument();
    expect(screen.getByText(/Con 3 jugadores se gana con 5 fichas/)).toBeInTheDocument();
    expect(screen.getByText('Bot · siempre listo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Añadir un bot' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'configure', config: { bots: 2 } });
    await user.click(screen.getByRole('button', { name: 'Quitar a Robo' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'configure', config: { bots: 0 } });
    await user.click(screen.getByRole('button', { name: 'Quitar un bot' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'configure', config: { bots: 0 } });
    await user.click(screen.getByRole('button', { name: 'Expulsar a Beto' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'kick', playerId: 'b' });
    expect(screen.getByRole('button', { name: /Esperando a que todos/ })).toBeDisabled();
  });

  const human = (id: string, name: string, over: object = {}) => ({
    id,
    name,
    ready: false,
    connected: true,
    left: false,
    bot: false,
    host: false,
    ...over,
  });

  it('los asientos libres se muestran como huecos que invitan a unirse', () => {
    setup(true);
    // 3 jugadores en una mesa de 6: quedan 3 huecos.
    expect(screen.getAllByText('Esperando jugador…')).toHaveLength(3);
    expect(screen.getByText(/3 de 6/, { selector: 'b' })).toBeInTheDocument();
  });

  it('el anfitrión lleva corona y el resto de jugadores tiene su inicial; los bots, insignia', () => {
    setup(true);
    const ana = screen
      .getAllByRole('listitem')
      .find((li) => li.textContent?.startsWith('Ana')) as HTMLElement;
    expect(ana.querySelector('.lb-crown')).not.toBeNull();
    expect(within(ana).getByText('Anfitrión')).toBeInTheDocument();
    expect(ana.querySelector('.lb-avatar')?.getAttribute('data-initial')).toBe('A');
    const robo = screen
      .getAllByRole('listitem')
      .find((li) => li.textContent?.startsWith('Robo')) as HTMLElement;
    expect(robo.querySelector('.lb-avatar.bot')).not.toBeNull();
    expect(within(robo).getByText('Bot')).toBeInTheDocument();
  });

  it('el selector de bots respeta los límites', () => {
    setup(true, { config: { bots: 0 } });
    expect(screen.getByRole('button', { name: 'Quitar un bot' })).toBeDisabled();
    cleanup();
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) =>
      human(id, `J${i}`, { host: id === 'a' }),
    );
    setup(true, { players: six, config: { bots: 2 } });
    expect(screen.getByRole('button', { name: 'Añadir un bot' })).toBeDisabled();
    expect(screen.queryByText('Esperando jugador…')).toBeNull();
  });

  it('explica por qué no se puede empezar', () => {
    setup(true, {
      players: [human('a', 'Ana', { ready: true, host: true })],
    });
    expect(screen.getByRole('button', { name: /Faltan jugadores/ })).toBeDisabled();
    expect(screen.getByText(/Se necesitan al menos 2 jugadores/)).toBeInTheDocument();
    cleanup();
    setup(true);
    expect(screen.getByText('Falta que marquen listo: Beto.')).toBeInTheDocument();
    cleanup();
    setup(true, { canStart: true });
    expect(screen.getByText(/Todo listo/)).toBeInTheDocument();
  });

  it('el invitado ve el resumen pero no los ajustes del anfitrión', () => {
    setup(false);
    expect(screen.queryByRole('button', { name: 'Quitar un bot' })).toBeNull();
    expect(
      screen.getByText(/Mazo de 21 cartas, edición con Espía y Canciller/),
    ).toBeInTheDocument();
  });

  it('avisa de la conexión perdida', () => {
    setup(true);
    expect(screen.queryByText(/Reconectando con la sala/)).toBeNull();
    cleanup();
    useRoomStore.setState({ status: 'reconnecting' });
    render(
      <MemoryRouter>
        <LobbyScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Reconectando con la sala/)).toBeInTheDocument();
  });

  it('un aviso discreto cuando se sienta una persona, pero no por los bots', async () => {
    setup(true);
    const base = useRoomStore.getState().room as RoomView;
    useRoomStore.setState({
      room: { ...base, players: [...base.players, human('d', 'Dani')] },
    });
    expect(await screen.findByText('Dani se sentó a la mesa')).toBeInTheDocument();
    useRoomStore.setState({
      room: {
        ...base,
        players: [
          ...base.players,
          human('d', 'Dani'),
          { ...human('z', 'Zoe'), bot: true, ready: true },
        ],
      },
    });
    await waitFor(() => expect(screen.getAllByText('Zoe').length).toBeGreaterThan(0));
    expect(screen.queryByText('Zoe se sentó a la mesa')).toBeNull();
  });

  it('no repite las reglas en la sala: solo el botón "Reglas" de arriba, que las abre', async () => {
    const { user } = setup(true);
    expect(screen.queryByRole('heading', { name: 'Cómo se juega' })).toBeNull();
    expect(screen.queryByText(/Leer las reglas completas/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Reglas' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('la invitación no se sale del sobre: sello, rótulo, código y botones', () => {
    setup(true);
    const invite = screen.getByRole('region', { name: 'Invitación a la sala' });
    expect(within(invite).getByText('KX7-QM2')).toBeInTheDocument();
    expect(within(invite).getByText(/Invitación · código de sala/)).toBeInTheDocument();
    expect(within(invite).getAllByRole('button')).toHaveLength(2);
  });

  it('la barra y la invitación usan las variantes del sistema', () => {
    setup(true);
    expect(screen.getByRole('button', { name: 'Reglas' })).toHaveClass('ll-ghost');
    expect(screen.getByRole('button', { name: 'Salir' })).toHaveClass('ll-danger');
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toHaveClass('ll-play');
    expect(screen.getByRole('button', { name: 'Copiar código' })).toHaveClass('ll-ghost');
    expect(
      screen.getByRole('button', { name: 'Copiar código' }).closest('.ll-light'),
    ).not.toBeNull();
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toMatch(/\bll-(play|ghost|danger|x)\b/);
    }
  });

  it('inicia cuando la sala lo permite', async () => {
    const { send, user } = setup(true, { canStart: true });
    await user.click(screen.getByRole('button', { name: 'Comenzar la partida' }));
    expect(send).toHaveBeenCalledWith({ type: 'start' });
  });

  it('un invitado marca listo y no ve controles de anfitrión', async () => {
    const { send, user } = setup(false);
    expect(screen.queryByRole('button', { name: 'Añadir un bot' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Expulsar/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '¿Listo para jugar?' }));
    expect(send).toHaveBeenCalledWith({ type: 'set_ready', ready: true });
  });

  it('ofrece compartir con el menú del teléfono cuando existe', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { user } = setup(true);
    await user.click(screen.getByRole('button', { name: 'Compartir invitación' }));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('/sala/KX7-QM2') }),
    );
    Reflect.deleteProperty(navigator, 'share');
  });

  it('sin menú de compartir solo hay copiar', () => {
    setup(true);
    expect(screen.queryByRole('button', { name: 'Compartir invitación' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copiar código' })).toBeInTheDocument();
  });

  it('copia el enlace', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = setup(true);
    // userEvent instala su propio portapapeles al crearse: se sustituye después.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/sala/KX7-QM2')),
    );
  });
});

describe('Sello de listo en la sala de espera', () => {
  const seat = (id: string, name: string, ready: boolean, bot = false) => ({
    id,
    name,
    ready,
    connected: true,
    left: false,
    bot,
    host: id === 'a',
  });
  const room = (players: ReturnType<typeof seat>[]) => ({
    code: 'KX7QM2',
    status: 'lobby' as const,
    you: { id: 'a', isHost: true },
    hostId: 'a',
    players,
    config: { bots: 0 },
    limits: { minPlayers: 2, maxPlayers: 6 },
    canStart: false,
    game: null,
    chat: [],
    pending: null,
    pause: null,
  });
  const show = (players: ReturnType<typeof seat>[]) => {
    useRoomStore.setState({
      code: 'KX7QM2',
      status: 'open',
      room: room(players),
      send: vi.fn() as never,
    });
    return render(
      <MemoryRouter>
        <LobbyScreen />
      </MemoryRouter>,
    );
  };
  const rowOf = (name: string) =>
    screen.getAllByRole('listitem').find((li) => li.textContent?.startsWith(name)) as HTMLElement;
  const seals = (el: ParentNode) => el.querySelectorAll('img.ll-seal');

  it('sello para los listos, no para los que esperan; el texto accesible sigue ahí', () => {
    show([seat('a', 'Ana', true), seat('b', 'Beto', true), seat('c', 'Carla', false)]);
    expect(seals(rowOf('Ana'))).toHaveLength(1);
    expect(seals(rowOf('Beto'))).toHaveLength(1);
    expect(seals(rowOf('Carla'))).toHaveLength(0);
    expect(within(rowOf('Beto')).getByText('Listo')).toBeInTheDocument();
    expect(within(rowOf('Carla')).getByText('Esperando')).toBeInTheDocument();
    // El sello es decorativo y reserva su sitio aunque no esté.
    expect(rowOf('Carla').querySelector('.ll-seal-slot')).not.toBeNull();
    expect(rowOf('Beto').querySelector('.ll-seal-slot')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('los bots llevan el sello fijo, sin animación', () => {
    show([seat('a', 'Ana', false), seat('r', 'Robo', true, true)]);
    const seal = seals(rowOf('Robo'))[0];
    expect(seal).toBeDefined();
    expect(seal).not.toHaveClass('stamp');
  });

  it('no se anima al montar; sí al pasar a listo después, y se desvanece al dejar de estarlo', async () => {
    const { rerender } = show([seat('a', 'Ana', true), seat('b', 'Beto', false)]);
    expect(seals(rowOf('Ana'))[0]).not.toHaveClass('stamp');
    useRoomStore.setState({ room: room([seat('a', 'Ana', true), seat('b', 'Beto', true)]) });
    rerender(
      <MemoryRouter>
        <LobbyScreen />
      </MemoryRouter>,
    );
    await waitFor(() => expect(seals(rowOf('Beto'))[0]).toHaveClass('stamp'));
    // Quien ya estaba listo no se vuelve a animar.
    expect(seals(rowOf('Ana'))[0]).not.toHaveClass('stamp');
    useRoomStore.setState({ room: room([seat('a', 'Ana', true), seat('b', 'Beto', false)]) });
    rerender(
      <MemoryRouter>
        <LobbyScreen />
      </MemoryRouter>,
    );
    await waitFor(() => expect(seals(rowOf('Beto'))[0]).toHaveClass('fade'));
    await waitFor(() => expect(seals(rowOf('Beto'))).toHaveLength(0), { timeout: 1500 });
  });
});
