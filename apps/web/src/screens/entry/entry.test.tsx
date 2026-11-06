import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
    await user.click(screen.getByRole('button', { name: '+ Añadir un bot' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'configure', config: { bots: 2 } });
    await user.click(screen.getByRole('button', { name: 'Quitar a Robo' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'configure', config: { bots: 0 } });
    await user.click(screen.getByRole('button', { name: 'Expulsar a Beto' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'kick', playerId: 'b' });
    expect(screen.getByRole('button', { name: /Esperando a que todos/ })).toBeDisabled();
  });

  it('inicia cuando la sala lo permite', async () => {
    const { send, user } = setup(true, { canStart: true });
    await user.click(screen.getByRole('button', { name: 'Comenzar la partida' }));
    expect(send).toHaveBeenCalledWith({ type: 'start' });
  });

  it('un invitado marca listo y no ve controles de anfitrión', async () => {
    const { send, user } = setup(false);
    expect(screen.queryByRole('button', { name: '+ Añadir un bot' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Expulsar/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '¿Listo para jugar?' }));
    expect(send).toHaveBeenCalledWith({ type: 'set_ready', ready: true });
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
