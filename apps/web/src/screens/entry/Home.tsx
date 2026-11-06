import { cleanName, formatRoomCode, normalizeRoomCode } from '@loveletter/protocol';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiRequestError, createRoom, getRoomInfo } from '../../lib/api';
import { lastName, seatToken } from '../../lib/session';
import {
  codeFormatProblem,
  type JoinProblem,
  NAME_HINT,
  nameProblem,
  requestProblem,
  roomInfoProblem,
} from './joinProblems';
import { EntryShell, Logo, ProblemAlert } from './parts';

/** "/" — elige un nombre, crea una sala o únete con un código. */
export function HomeScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => lastName.get());
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<{ problem: JoinProblem; code: string | null } | null>(
    null,
  );
  const codeRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), hint: useId(), code: useId(), err: useId() };

  // La sala se descarga en segundo plano para que entrar no espere.
  useEffect(() => {
    const timer = window.setTimeout(() => void import('../RoomPage').catch(() => undefined), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const nameIssue = nameProblem(name);
  const rememberName = () => nameIssue === null && lastName.set(cleanName(name));

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (nameIssue !== null || creating) return;
    setCreating(true);
    setCreateError(null);
    rememberName();
    try {
      const created = await createRoom(cleanName(name));
      const normalized = normalizeRoomCode(created.code);
      if (!normalized)
        throw new ApiRequestError('bad_code', 'El servidor devolvió un código raro', 0);
      seatToken.set(normalized, created.seatToken);
      navigate(`/sala/${formatRoomCode(normalized)}`);
    } catch (error) {
      setCreating(false);
      setCreateError(
        error instanceof ApiRequestError && error.code === 'network'
          ? 'Sin conexión con el servidor. Revisa tu red y reintenta.'
          : error instanceof Error
            ? error.message
            : 'Algo salió mal, inténtalo de nuevo.',
      );
    }
  }

  async function onJoin(event?: FormEvent) {
    event?.preventDefault();
    if (checking) return;
    const normalized = normalizeRoomCode(code);
    if (!normalized) {
      setProblem({ problem: codeFormatProblem(code), code: null });
      codeRef.current?.focus();
      return;
    }
    rememberName();
    setChecking(true);
    setProblem(null);
    try {
      const info = await getRoomInfo(normalized);
      const issue = roomInfoProblem(info);
      if (issue && !(issue.kind === 'started' && seatToken.get(normalized))) {
        setProblem({ problem: issue, code: normalized });
        setChecking(false);
        return;
      }
      navigate(`/sala/${formatRoomCode(normalized)}`);
    } catch (error) {
      setProblem({ problem: requestProblem(error), code: normalized });
      setChecking(false);
    }
  }

  return (
    <EntryShell hero>
      <nav aria-label="Ayuda" className="absolute top-3 right-4">
        <Link to="/reglas" className="ll-link inline-flex min-h-11 items-center">
          Cómo se juega
        </Link>
      </nav>
      <div className="grid justify-items-center gap-2 text-center">
        <h1 className="m-0">
          <Logo width={380} />
        </h1>
        <p className="m-0 text-lg text-ivory/85">Hazle llegar tu carta a la Princesa.</p>
      </div>

      <div className="ll-panel grid w-full max-w-[760px] gap-5">
        <div className="ll-field">
          <label htmlFor={ids.name} className="ll-lbl">
            Tu nombre en la mesa
          </label>
          <input
            id={ids.name}
            className="ll-input"
            type="text"
            maxLength={20}
            autoComplete="nickname"
            placeholder="Por ejemplo, Lucía"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={ids.hint}
          />
          <span id={ids.hint} className="ll-lbl" style={{ textTransform: 'none' }}>
            {NAME_HINT}
          </span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <form onSubmit={onCreate} className="grid content-start gap-3" aria-labelledby="h-crear">
            <h2 id="h-crear" className="m-0 font-display text-xl tracking-wider">
              Crear una sala
            </h2>
            <p className="m-0 text-ivory/80">
              Serás el anfitrión: compartes el enlace y añades bots.
            </p>
            <button
              type="submit"
              className="ll-play"
              disabled={nameIssue !== null || creating}
              aria-busy={creating || undefined}
            >
              {creating ? 'Creando sala…' : 'Crear sala'}
            </button>
            <div aria-live="polite" className="ll-err empty:hidden">
              {createError}
            </div>
          </form>

          <form
            onSubmit={onJoin}
            noValidate
            className="grid content-start gap-3"
            aria-labelledby="h-unir"
          >
            <h2 id="h-unir" className="m-0 font-display text-xl tracking-wider">
              Unirse con un código
            </h2>
            <label htmlFor={ids.code} className="text-ivory/85">
              Código que te compartió el anfitrión
            </label>
            <input
              ref={codeRef}
              id={ids.code}
              className="ll-input"
              style={{ letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}
              type="text"
              maxLength={7}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="KX7-QM2"
              value={code}
              aria-invalid={problem !== null && problem.problem.kind !== 'network'}
              aria-describedby={problem ? ids.err : undefined}
              onChange={(e) => {
                setCode(e.target.value);
                if (problem) setProblem(null);
              }}
            />
            <button
              type="submit"
              className="ll-ghost"
              disabled={code.trim() === '' || checking}
              aria-busy={checking || undefined}
            >
              {checking ? 'Buscando…' : 'Entrar a la sala'}
            </button>
            <div aria-live="polite" className="empty:hidden">
              {problem && <ProblemAlert id={ids.err} problem={problem.problem} />}
            </div>
          </form>
        </div>
      </div>
    </EntryShell>
  );
}
