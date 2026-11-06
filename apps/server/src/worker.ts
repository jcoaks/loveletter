import { formatRoomCode, normalizeRoomCode } from '@loveletter/protocol';
import { createRoomSchema } from '@loveletter/protocol/schema';
import { randomRoomCode } from './crypto';

export { Room } from './room';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const notFound = () => json({ error: 'room_not_found', message: 'No encontramos esa sala' }, 404);

function roomStub(env: Env, code: string) {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_message', message: 'Petición inválida' }, 400);
  }
  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'bad_message', message: 'Revisa tu nombre' }, 400);
  }

  // Codes are random; on the rare collision with a live room, draw another.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomRoomCode();
    const result = await roomStub(env, code).create(code, parsed.data.name);
    if (result.ok) {
      return json(
        { code: formatRoomCode(code), playerId: result.playerId, seatToken: result.seatToken },
        201,
      );
    }
    if (result.code !== 'room_exists') {
      return json({ error: result.code, message: result.message }, 400);
    }
  }
  return json(
    { error: 'bad_message', message: 'No se pudo crear la sala, inténtalo de nuevo' },
    503,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/rooms') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return createRoom(request, env);
    }

    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/ws)?$/);
    if (match) {
      const code = normalizeRoomCode(decodeURIComponent(match[1] ?? ''));
      if (!code) return notFound();
      const stub = roomStub(env, code);

      if (match[2]) return stub.fetch(request);

      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
      const info = await stub.info();
      return info ? json({ ...info, code: formatRoomCode(info.code) }) : notFound();
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
