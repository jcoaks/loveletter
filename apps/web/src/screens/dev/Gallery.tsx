import { viewFor } from '@loveletter/engine';
import { type ReactNode, useState } from 'react';
import { Card, CardBack } from '../../components/Card';
import { ChancellorModal } from '../../components/ChancellorModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DiscardsModal } from '../../components/DiscardsModal';
import { GuardModal } from '../../components/GuessPicker';
import { GuideModal } from '../../components/GuideModal';
import { HandRow } from '../../components/HandRow';
import { type PickerPlayer, PlayerPickerModal } from '../../components/PlayerPickerModal';
import { PlayNoticeModal } from '../../components/PlayNoticeModal';
import { ResultModal } from '../../components/ResultModal';
import { MineBar, SeatCard } from '../../components/SeatCard';
import { TableLayout } from '../../components/TableLayout';
import { ToastStack } from '../../components/ToastStack';
import { Tokens } from '../../components/Token';
import { TurnBanner } from '../../components/TurnBanner';
import { CARDS, type CardValue, isLockedByCountess, TOKENS_TO_WIN } from '../../lib/cards';
import { buildResults, type TableResult } from '../../lib/results';
import type { SeatData } from '../../lib/seat';
import { rig, step } from '../../test-utils';
import { RoundOverModal } from '../special/RoundOver';

const SEATS: SeatData[] = [
  { id: 'me', name: 'Tú', gender: 'm', handCount: 2, discards: [1], tokens: 1 },
  {
    id: 'marta',
    name: 'Marta',
    gender: 'f',
    handCount: 1,
    discards: [1, 4],
    tokens: 2,
    protected: true,
  },
  {
    id: 'diego',
    name: 'Diego',
    gender: 'm',
    handCount: 0,
    discards: [2, 3, 1],
    tokens: 0,
    eliminated: true,
  },
  {
    id: 'lucia',
    name: 'Lucía',
    gender: 'f',
    handCount: 1,
    discards: [1, 1, 1, 1, 5, 5],
    tokens: 1,
    isTurn: true,
  },
  {
    id: 'pablo',
    name: 'Pablo',
    handCount: 1,
    discards: [0],
    tokens: 0,
    spyPlayed: true,
    bot: true,
  },
  {
    id: 'sofia',
    name: 'Sofía',
    gender: 'f',
    handCount: 1,
    discards: [5],
    tokens: 1,
    connected: false,
  },
];

const LOG = [
  'Es tu turno: robaste la Condesa.',
  'Marta jugó la Doncella y queda protegida.',
  'Diego jugó el Barón contra Lucía. Tenía un Guardia y quedó eliminado.',
];

type ModalKey =
  | 'guide'
  | 'picker'
  | 'prince'
  | 'guard'
  | 'result-private'
  | 'result-public'
  | 'chancellor'
  | 'confirm'
  | 'discards'
  | 'round-over'
  | 'own-spy'
  | null;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="grid gap-3 border-t border-gold/30 py-6">
    <h2 className="m-0 font-display text-xl tracking-wider">{title}</h2>
    {children}
  </section>
);

/** El aviso que ve quien juega el Espía (el mismo que ven los demás, con él como actor). */
function ownSpy(): TableResult | undefined {
  const state = step(rig({ hands: [[0, 2], [3], [4]] }), {
    type: 'play_card',
    playerId: 'p0',
    card: 0,
  });
  const names: Record<string, string> = { p0: 'Ana', p1: 'Beto', p2: 'Carla' };
  return buildResults(viewFor(state, 'p0').events, { me: 'p0', name: (id) => names[id] ?? '?' })[0];
}

/** Vista real del motor al cerrar una ronda por mazo agotado (para ver la carta apartada). */
function roundOverView() {
  const state = step(rig({ hands: [[2, 3], [5], [4]], deck: [] }), {
    type: 'play_card',
    playerId: 'p0',
    card: 2,
    targetId: 'p1',
  });
  return viewFor(state, 'p0');
}

export function Gallery() {
  const [n, setN] = useState(4);
  const [modal, setModal] = useState<ModalKey>(null);
  const [toast, setToast] = useState(false);
  const [sel, setSel] = useState<CardValue>(8);
  const [target, setTarget] = useState<string | null>(null);
  const [guess, setGuess] = useState<CardValue | null>(null);
  const close = () => setModal(null);

  const seats = SEATS.slice(0, n);
  const [me, ...rivals] = seats;
  const toWin = TOKENS_TO_WIN[n] ?? 3;
  const hand: CardValue[] = [7, 8];
  const picker: PickerPlayer[] = seats.map((s) => ({
    id: s.id,
    name: s.name,
    gender: s.gender,
    isMe: s.id === 'me',
    eligible: !s.eliminated && !s.protected,
    eliminated: s.eliminated,
    discards: s.discards,
    tokens: s.tokens,
  }));

  return (
    <main className="mx-auto max-w-[1380px] p-4">
      <h1 className="font-display text-3xl">Galería de componentes</h1>
      <p className="text-ivory/70">Solo en desarrollo. Datos de ejemplo.</p>

      <Section title="Cartas (21 con Espía y Canciller: 10 valores)">
        <div className="flex flex-wrap gap-4">
          {CARDS.map((c) => (
            <Card key={c.value} value={c.value} />
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {CARDS.map((c) => (
            <Card key={c.value} value={c.value} size="sm" />
          ))}
          <CardBack />
          <Tokens count={2} total={4} />
        </div>
        <div className="flex flex-wrap gap-4 pt-3">
          <Card value={9} selected onClick={() => undefined} />
          <Card value={5} locked onClick={() => undefined} />
          <Card value={3} dimmed />
        </div>
      </Section>

      <Section title="Asientos">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {SEATS.slice(1).map((s) => (
            <SeatCard key={s.id} seat={s} toWin={toWin} onOpen={() => setModal('discards')} />
          ))}
          <SeatCard
            seat={{
              ...(SEATS[3] as SeatData),
              id: 'x',
              name: 'Alex',
              gender: 'x',
              eliminated: true,
            }}
            toWin={toWin}
            mark="hit"
          />
        </div>
      </Section>

      <Section title="Mesa">
        {/* biome-ignore lint/a11y/useSemanticElements: grupo con nombre accesible, no un formulario */}
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Número de jugadores"
        >
          {[2, 3, 4, 5, 6].map((k) => (
            <button
              key={k}
              type="button"
              className="ll-ghost"
              aria-pressed={n === k}
              onClick={() => setN(k)}
              style={
                n === k ? { background: 'var(--color-gold)', color: 'var(--color-ink)' } : undefined
              }
            >
              {k} jugadores
            </button>
          ))}
        </div>
        {me && (
          <TableLayout
            rivals={rivals}
            toWin={toWin}
            deckCount={n === 2 ? 8 : 10}
            setAside={{ hidden: 1, faceUp: n === 2 ? [2, 5, 1] : [] }}
            turn={
              <TurnBanner
                round={3}
                text="Es tu turno"
                toWin={toWin}
                mine
                extra="● en línea · ejemplo"
              />
            }
            marks={{ lucia: 'miss' }}
            log={LOG}
            onOpenSeat={() => setModal('discards')}
            onOpenGuide={() => setModal('guide')}
            mine={
              <>
                <span className="ll-lbl priv">Tu mano · solo tú la ves</span>
                <HandRow hand={hand} selected={sel} onSelect={setSel} />
                <div className="ll-act">
                  <button
                    type="button"
                    className="ll-play"
                    disabled={isLockedByCountess(hand, sel)}
                  >
                    Jugar {CARDS[sel]?.name}
                  </button>
                  <span className="hint">{CARDS[sel]?.text}</span>
                </div>
                <MineBar seat={me} toWin={toWin} onOpen={() => setModal('discards')} />
              </>
            }
          />
        )}
      </Section>

      <Section title="Ventanas y avisos">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['guide', 'Carta guía'],
              ['picker', 'Elegir jugador (Barón)'],
              ['prince', 'Elegir jugador (Príncipe)'],
              ['guard', 'Guardia'],
              ['result-private', 'Resultado privado'],
              ['result-public', 'Resultado público'],
              ['chancellor', 'Canciller'],
              ['confirm', 'Confirmar Princesa'],
              ['discards', 'Descartes'],
              ['round-over', 'Fin de ronda'],
              ['own-spy', 'Aviso propio (Espía)'],
            ] as [Exclude<ModalKey, null>, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" className="ll-ghost" onClick={() => setModal(k)}>
              {label}
            </button>
          ))}
          <button type="button" className="ll-ghost" onClick={() => setToast(true)}>
            Aviso (Espía)
          </button>
        </div>
      </Section>

      <ToastStack
        items={
          toast
            ? [
                {
                  key: 'spy',
                  body: 'Jugaste el Espía. Si al cerrar la ronda eres el único con un Espía, ganas una ficha.',
                },
              ]
            : []
        }
        onDismiss={() => setToast(false)}
      />

      {modal === 'guide' && <GuideModal players={n} onClose={close} />}
      {modal === 'picker' && (
        <PlayerPickerModal
          card={3}
          players={picker}
          toWin={toWin}
          onPick={close}
          onCancel={close}
        />
      )}
      {modal === 'prince' && (
        <PlayerPickerModal
          card={5}
          players={picker}
          toWin={toWin}
          restCard={8}
          onPick={close}
          onCancel={close}
        />
      )}
      {modal === 'guard' && (
        <GuardModal
          players={picker}
          toWin={toWin}
          targetId={target}
          guess={guess}
          onTarget={setTarget}
          onGuess={setGuess}
          onAccuse={close}
          onCancel={close}
        />
      )}
      {modal === 'result-private' && (
        <ResultModal
          label="Resultado: Barón"
          title="Pierdes la comparación."
          body="Tu Sacerdote es más baja que el Rey. Quedas fuera de la ronda."
          faces={[
            { caption: 'Tu mano', value: 2 },
            { caption: 'Lucía', value: 7 },
          ]}
          visibility="private"
          hit
          onContinue={close}
        />
      )}
      {modal === 'result-public' && (
        <ResultModal
          label="Resultado: Guardia"
          title="¡Acertaste!"
          body="Lucía tenía el Barón. Muestra su carta y queda fuera de la ronda."
          visibility="public"
          hit
          onContinue={close}
        />
      )}
      {modal === 'chancellor' && (
        <ChancellorModal options={[3, 9, 6]} onConfirm={close} onCancel={close} />
      )}
      {modal === 'confirm' && (
        <ConfirmDialog
          label="Confirmar jugar la Princesa"
          title="¿Jugar la Princesa?"
          confirmLabel="Sí, jugarla y salir"
          onConfirm={close}
          onCancel={close}
        >
          Si la descartas, quedas fuera de la ronda.
        </ConfirmDialog>
      )}
      {modal === 'own-spy' && ownSpy() && (
        <PlayNoticeModal
          view={{
            key: 'gallery-spy',
            actorId: 'me',
            card: 0,
            targetId: null,
            result: ownSpy() as TableResult,
            fly: false,
            staged: false,
          }}
          actorName="Tú"
          targetName={null}
          mine
          autoCloseMs={5000}
          onContinue={close}
        />
      )}
      {modal === 'round-over' && (
        <RoundOverModal game={roundOverView()} onContinue={close} onHide={close} />
      )}
      {modal === 'discards' && (
        <DiscardsModal
          name="Diego"
          discards={[2, 3, 1]}
          eliminated
          spyPlayed
          tokens={2}
          toWin={4}
          onClose={close}
        />
      )}
    </main>
  );
}
