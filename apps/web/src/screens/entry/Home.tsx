import { cleanName, formatRoomCode, normalizeRoomCode } from '@loveletter/protocol';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LogoLockup } from '../../components/LogoLockup';
import { ApiRequestError, createRoom, getRoomInfo } from '../../lib/api';
import { lastName, seatToken } from '../../lib/session';
import { CardShowcase, Features, HomeFooter, HowTo } from './HomeSections';
import {
  codeFormatProblem,
  type JoinProblem,
  NAME_HINT,
  nameProblem,
  requestProblem,
  roomInfoProblem,
} from './joinProblems';
import { ProblemAlert } from './parts';

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
  const nameRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), hint: useId(), code: useId(), err: useId() };

  // En escritorio el cursor cae en el nombre; en el móvil no, para no abrir el teclado sin pedirlo.
  useEffect(() => {
    if (!name && window.matchMedia?.('(pointer: fine)')?.matches) {
      nameRef.current?.focus({ preventScroll: true });
    }
  }, [name]);

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
    <main className="lh">
      <header className="lh-hero">
        <picture className="lh-art">
          <source media="(max-width: 700px)" srcSet="/assets/hero-group-m.webp" />
          <img
            src="/assets/hero-group.webp"
            alt=""
            width={1200}
            height={667}
            decoding="async"
            fetchPriority="low"
          />
        </picture>
        <div className="lh-shade" aria-hidden="true" />
        <nav aria-label="Ayuda" className="lh-nav">
          <a href="#como" className="ll-link">
            Cómo se juega
          </a>
          <Link to="/reglas" className="ll-link">
            Reglas
          </Link>
        </nav>
        <div className="lh-hero-in">
          <div className="lh-title">
            <h1 className="m-0">
              <LogoLockup priority width="min(80vw, 380px)" className="lh-logo" />
              <span className="sr-only-ll"> en línea</span>
            </h1>
            <p className="lh-tag">Hazle llegar tu carta a la Princesa.</p>
            <p className="lh-sub">
              Intriga, engaño y una pizca de suerte. De 2 a 6 jugadores, desde el móvil, sin
              cuentas.
            </p>
          </div>

          <div className="lh-card">
            <img
              className="ll-seal stamp lh-stamp"
              src="/assets/seal.webp"
              alt=""
              width={112}
              height={112}
              decoding="async"
            />
            <form onSubmit={onCreate} className="grid gap-3" aria-labelledby="h-crear">
              <h2 id="h-crear" className="lh-card-h">
                Siéntate a la mesa
              </h2>
              <div className="ll-field">
                <label htmlFor={ids.name} className="ll-lbl">
                  Tu nombre en la mesa
                </label>
                <input
                  ref={nameRef}
                  id={ids.name}
                  className="ll-input"
                  type="text"
                  maxLength={20}
                  autoComplete="nickname"
                  autoCorrect="off"
                  enterKeyHint="go"
                  placeholder="Por ejemplo, Lucía"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-describedby={ids.hint}
                />
                <span id={ids.hint} className="ll-lbl" style={{ textTransform: 'none' }}>
                  {NAME_HINT}
                </span>
              </div>
              <button
                type="submit"
                className="ll-play"
                disabled={nameIssue !== null || creating}
                aria-busy={creating || undefined}
              >
                {creating ? 'Creando sala…' : 'Crear sala'}
              </button>
              <p className="lh-note">Serás el anfitrión: compartes el enlace y añades bots.</p>
              <div aria-live="polite" className="ll-err empty:hidden">
                {createError}
              </div>
            </form>

            <div className="lh-or" aria-hidden="true">
              <span>o</span>
            </div>

            <form onSubmit={onJoin} noValidate className="grid gap-3" aria-labelledby="h-unir">
              <h2 id="h-unir" className="lh-card-h sm">
                ¿Ya tienes un código?
              </h2>
              <div className="ll-field">
                <label htmlFor={ids.code} className="ll-lbl">
                  Código que te compartió el anfitrión
                </label>
                <input
                  ref={codeRef}
                  id={ids.code}
                  className="ll-input lh-code"
                  type="text"
                  maxLength={7}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder="KX7-QM2"
                  value={code}
                  aria-invalid={problem !== null && problem.problem.kind !== 'network'}
                  aria-describedby={problem ? ids.err : undefined}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (problem) setProblem(null);
                  }}
                />
              </div>
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
        <a href="#como" className="lh-scroll">
          <span className="sr-only-ll">Ver cómo se juega</span>
          <span aria-hidden="true">⌄</span>
        </a>
      </header>

      <HowTo />
      <CardShowcase />
      <Features />
      <HomeFooter />
    </main>
  );
}
