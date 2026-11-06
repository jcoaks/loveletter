# Love Letter Online

Una versión en línea de _Love Letter_ (edición de 21 cartas con Espía y Canciller, de 2 a 6 jugadores) para jugar con amigos desde el navegador: creas una sala, compartes el enlace y completas la mesa con bots si hace falta.

## Cómo se juega

Cada ronda robas una carta y juegas una de las dos que tienes. Quien siga en pie al final, o tenga la mano más alta cuando se acaba el mazo, gana una ficha de afecto. Las reglas completas están dentro del juego (`/reglas`) y en [`config/loveletter-rules.json`](config/loveletter-rules.json).

## Desarrollo

Necesitas **Node 22+** y **pnpm 9**.

```sh
pnpm install
pnpm dev
```

`pnpm dev` levanta el Worker de Cloudflare con las salas en `http://localhost:8787` y la web en `http://127.0.0.1:5173` (que reenvía `/api` al Worker).

| Comando                                  | Qué hace                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm lint`                              | Biome: formato y lint                                                             |
| `pnpm typecheck`                         | TypeScript en todos los paquetes                                                  |
| `pnpm test`                              | Pruebas: motor, protocolo, sala y pantallas                                       |
| `pnpm build`                             | Compila la web en `apps/web/dist`                                                 |
| `pnpm --filter @loveletter/server smoke` | Partida completa por WebSocket contra el Worker (`BASE=<url>` para un despliegue) |
| `python3 -I scripts/optimize-assets.py`  | Regenera los WebP de `apps/web/public/assets` desde `assets-src/`                 |

### Despliegue

```sh
pnpm build
pnpm --filter @loveletter/server run deploy
```

Publica en Cloudflare el Worker con las salas y la web compilada. Antes hay que iniciar sesión con `npx wrangler login`.

## Cómo está hecho

| Capa            | Tecnología                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Motor de reglas | TypeScript puro, estado inmutable y vistas por jugador que solo muestran lo que cada uno puede saber |
| Servidor        | Cloudflare Workers con un Durable Object por sala y WebSockets con hibernación                       |
| Protocolo       | Mensajes tipados y validados con Zod                                                                 |
| Web             | React 19, Vite, Tailwind CSS 4, Zustand, Motion y React Router                                       |
| Pruebas         | Vitest y Testing Library                                                                             |

```
config/            reglas del juego (fuente de verdad)
packages/engine    motor de reglas y bots
packages/protocol  mensajes cliente ↔ servidor
apps/server        Worker + Durable Object por sala
apps/web           interfaz React
docs/              stack.md y el prototipo HTML aprobado (docs/prototype)
```

<sub>_Love Letter_ es un juego de Seiji Kanai, publicado por Alderac Entertainment Group y Z-Man Games. Este es un proyecto de fans para jugar entre amigos; las ilustraciones pertenecen a sus autores.</sub>
