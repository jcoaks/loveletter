import { cleanName, formatRoomCode, normalizeRoomCode } from '@loveletter/protocol';
import { type FormEvent, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { lastName, seatToken } from '../../lib/session';
import { useRoomStore } from '../../store/room';
import {
  codeFormatProblem,
  isNameError,
  type JoinProblem,
  joinErrorProblem,
  NAME_HINT,
  nameProblem,
} from './joinProblems';
import { EntryShell, Logo, ProblemAlert, useRoomInfo } from './parts';

/** /sala/:code sin asiento en la sala: pide un nombre y te sienta a la mesa. */
export function JoinLinkScreen({ code: rawCode }: { code: string }) {
  const navigate = useNavigate();
  const code = normalizeRoomCode(rawCode);
  const { result, reload } = useRoomInfo(code);
  const storeCode = useRoomStore((s) => s.code);
  const status = useRoomStore((s) => s.status);
  const joinError = useRoomStore((s) => s.joinError);
  const connect = useRoomStore((s) => s.connect);
  const [name, setName] = useState(() => lastName.get());
  const [submitted, setSubmitted] = useState<string | null>(null);
  const ids = { name: useId(), hint: useId() };

  const ours = code !== null && storeCode === code;
  const ourError = ours ? joinError : null;
  const pending = ours && status === 'connecting' && !ourError && submitted !== null;

  let problem: JoinProblem | null = null;
  if (!code) problem = codeFormatProblem(rawCode);
  else if (ourError) problem = joinErrorProblem(ourError.code);
  else if (result.state === 'error') problem = result.problem;
  else if (result.state === 'ready' && result.info.status !== 'lobby')
    problem = { kind: 'started' };
  else if (result.state === 'ready' && !result.info.joinable) problem = { kind: 'full' };

  if (problem) {
    const canResume = problem.kind === 'started' && code !== null && seatToken.get(code) !== null;
    return (
      <EntryShell hero>
        <Logo width={260} />
        <section className="lh-card grid w-full max-w-[540px] gap-4" aria-labelledby="h-join">
          <h1 id="h-join" className="m-0 font-display text-2xl tracking-wider">
            Unirse con un código
          </h1>
          <b className="text-xl tracking-[0.16em]">
            {code ? formatRoomCode(code) : rawCode || '—'}
          </b>
          <ProblemAlert problem={problem} />
          <div className="ll-row2">
            {canResume && code ? (
              <button type="button" className="ll-play" onClick={() => connect(code)}>
                Retomar mi asiento
              </button>
            ) : problem.kind === 'network' ? (
              <button type="button" className="ll-play" onClick={reload}>
                Reintentar
              </button>
            ) : null}
            <button type="button" className="ll-ghost" onClick={() => navigate('/')}>
              Volver al inicio
            </button>
          </div>
        </section>
      </EntryShell>
    );
  }

  const localIssue = nameProblem(name);
  const nameErr =
    ourError && isNameError(ourError.code) && submitted === name ? ourError.message : null;
  const otherErr = ourError && !isNameError(ourError.code) ? ourError.message : null;
  const info = result.state === 'ready' ? result.info : null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!code || localIssue !== null || pending) return;
    const clean = cleanName(name);
    lastName.set(clean);
    setSubmitted(name);
    connect(code, { name: clean });
  }

  return (
    <EntryShell hero>
      <Logo width={280} />
      <form
        onSubmit={onSubmit}
        noValidate
        aria-labelledby="h-invite"
        className="lh-card grid w-full max-w-[520px] gap-4"
      >
        <h1 id="h-invite" className="m-0 font-display text-2xl tracking-wider">
          {info?.hostName ? `${info.hostName} te invita a su mesa` : 'Te invitan a una mesa'}
        </h1>
        <div className="flex flex-wrap justify-between gap-2">
          <span className="ll-lbl">
            Sala <b className="text-ink">{code ? formatRoomCode(code) : rawCode}</b>
          </span>
          <span className="ll-lbl" aria-live="polite">
            {info ? `${info.playerCount} en la mesa` : 'Buscando la sala…'}
          </span>
        </div>
        {info && info.playerNames.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="En la mesa">
            {info.playerNames.map((n) => (
              <li key={n} className="ll-chip lh-chip">
                {n === info.hostName ? `${n} · anfitrión` : n}
              </li>
            ))}
          </ul>
        )}
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
            placeholder="Por ejemplo, Andrés"
            value={name}
            aria-invalid={nameErr !== null}
            aria-describedby={ids.hint}
            onChange={(e) => setName(e.target.value)}
          />
          <span
            id={ids.hint}
            aria-live="polite"
            className={nameErr ? 'll-err' : 'll-lbl'}
            style={nameErr ? undefined : { textTransform: 'none' }}
          >
            {nameErr ?? NAME_HINT}
          </span>
        </div>
        <button
          type="submit"
          className="ll-play"
          disabled={pending || result.state !== 'ready' || localIssue !== null}
          aria-busy={pending || undefined}
        >
          {pending ? 'Sentándote a la mesa…' : 'Sentarme a la mesa'}
        </button>
        <div aria-live="assertive" className="ll-err empty:hidden">
          {otherErr}
        </div>
      </form>
      <Link to="/reglas" className="ll-link inline-flex min-h-11 items-center">
        ¿Primera vez? Lee cómo se juega
      </Link>
    </EntryShell>
  );
}
