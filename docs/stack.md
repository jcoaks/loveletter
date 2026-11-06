# Love Letter Online: stack y plan

Misma base que `~/projects/avalon` (referencia de arquitectura: léela antes de escribir código). Reglas: `config/loveletter-rules.json`. Interfaz: `docs/prototype/mesa-real.html` (prototipo aprobado por el usuario, "Mesa Real") y `docs/ui-spec.md`.

## Resumen

| Capa              | Elección                                                                                |
| ----------------- | --------------------------------------------------------------------------------------- |
| Lenguaje          | TypeScript estricto en todo el proyecto                                                 |
| Monorepo          | pnpm workspaces (`packages/*`, `apps/*`, `e2e`)                                         |
| Frontend          | React 19 + Vite (SPA), React Router                                                     |
| Estilos           | Tailwind CSS 4; fuentes Cinzel y Alegreya Sans autoalojadas (Fontsource)                |
| Animaciones       | Motion                                                                                  |
| Estado en cliente | Zustand, alimentado por los mensajes del servidor                                       |
| Tiempo real       | WebSockets; en el cliente, PartySocket (reconexión automática)                          |
| Servidor          | Cloudflare Workers + un Durable Object por sala (WebSockets con hibernación)            |
| Validación        | Zod para todos los mensajes, compartido entre cliente y servidor                        |
| Hosting           | Cloudflare: Worker + frontend como assets estáticos (`loveletter.<cuenta>.workers.dev`) |
| Pruebas           | Vitest (motor, protocolo, sala, pantallas), Playwright (partidas completas contra bots) |
| Calidad           | Biome, GitHub Actions (lint, tipos, pruebas, build)                                     |

## Estructura

```
config/loveletter-rules.json   reglas (fuente de verdad)
packages/engine                motor: TypeScript puro, sin red ni UI (+ bots)
packages/protocol              esquemas Zod de mensajes y tipos compartidos
apps/server                    Worker + Durable Object "Room"
apps/web                       React + Vite
e2e/                           Playwright + bots por WebSocket
docs/                          stack.md, ui-spec.md, prototype/ (HTML aprobado)
```

## Reglas de diseño que se heredan de Avalon

- El servidor manda. El cliente solo recibe `RoomView`/`PlayerView` por jugador: nunca la mano ajena, el mazo ni la carta apartada.
- Motor puro `(estado, acción) → estado`; toda la aleatoriedad entra por parámetro para poder reproducir partidas en pruebas.
- `viewFor(estado, jugador)` proyecta solo lo que ese jugador puede saber.
- `room-core.ts` puro (se prueba sin Cloudflare); `room.ts` solo adapta WebSockets, almacenamiento y alarmas.
- Sin cuentas: token de asiento aleatorio (128 bits) en `localStorage` para reconectar; códigos de sala de 6 caracteres sin ambiguos; límite de tamaño y de frecuencia de mensajes; nombres de 2 a 20 caracteres, únicos, escapados.
- Desconexión pausa la partida; el anfitrión puede terminarla tras 120 s; alarma borra salas inactivas a las 6 h.
- Bots (completan la mesa, deciden solo con su vista) en `packages/engine/src/bot.ts` y sus frases en `bot-talk.ts`.
- API: `POST /api/rooms`, `GET /api/rooms/:code`, `GET /api/rooms/:code/ws`.

## Particularidades de Love Letter

- 2 a 6 jugadores, varias rondas: el estado de partida incluye fichas de afecto y el número de ronda; entre rondas hay una fase `round_over` que todos reconocen para seguir.
- El turno empieza robando; el jugador activo tiene 2 cartas. Cartas con decisión: Guardia (jugador + carta), Sacerdote/Barón/Rey (jugador), Príncipe (jugador, incluido uno mismo), Canciller (2 pasos: conservar 1 y ordenar el fondo).
- Información privada que no debe filtrarse: mano propia, resultado del Sacerdote (solo quien juega), lo recibido con el Rey (cada parte conoce lo que recibe), cartas robadas por el Canciller, mazo y carta apartada (excepto las 3 boca arriba en partidas de 2).
- Información pública: todos los descartes en orden, quién está protegido o eliminado, fichas, tamaño del mazo, acusaciones del Guardia y su acierto, resultado del Barón (quién cae y con qué carta), Espías jugados.
