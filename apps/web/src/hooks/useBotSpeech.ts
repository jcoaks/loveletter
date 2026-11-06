import type { ChatLine } from '@loveletter/protocol';
import { useEffect, useRef, useState } from 'react';

/** Un globo dura entre 4,5 y 9 s según lo largo que sea el texto. */
const speechMs = (text: string) => Math.min(9000, Math.max(4500, 2500 + text.length * 55));
const SPEECH_GAP_MS = 1100;
const TOPIC_GAP_MS = 2200;
const FIRST_REMARK_MS = 300;
const QUIET_AFTER_MS = 4000;
const EMPTY: ChatLine[] = [];

export interface BotSpeech {
  /** Lo que dice cada bot ahora, por id de jugador. */
  speech: Record<string, string>;
  /** Quedan frases por decir. */
  pending: boolean;
}

/**
 * Reproduce las frases de los bots como burbujas, de una en una, cuando ya se mostró el suceso al
 * que comentan (`revealKeys`: sucesos con resultado en cola) y no hay una ventana encima. Las
 * frases que ya estaban al abrir la pantalla no se repiten.
 */
export function useBotSpeech(
  chat: readonly ChatLine[] | undefined,
  busy: boolean,
  revealKeys: readonly string[],
): BotSpeech {
  const lines = chat ?? EMPTY;
  const [speech, setSpeech] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const lastTopic = useRef<string | null>(null);
  const lastSpokeAt = useRef(0);
  const lastSeen = useRef<number | null>(null);
  const queue = useRef<ChatLine[]>([]);
  const [queued, setQueued] = useState(0);
  const showing = useRef(new Map<string, ChatLine>());

  useEffect(() => {
    const live = lines.filter((line) => !line.final);
    const lastId = live.at(-1)?.id ?? 0;
    if (lastSeen.current === null || lastId < lastSeen.current) {
      lastSeen.current = lastId;
      queue.current = [];
      setPending(false);
      return;
    }
    const seen = lastSeen.current;
    const fresh = live.filter((line) => line.id > seen);
    if (fresh.length === 0) return;
    lastSeen.current = lastId;
    queue.current.push(...fresh);
    setPending(true);
    setQueued((n) => n + 1);
  }, [lines]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `queued` vuelve a ejecutar la cola
  useEffect(() => {
    const head = queue.current[0];
    const eligible = head !== undefined && !(head.after && revealKeys.includes(head.after));
    if (busy || !eligible) return;
    const fresh = Date.now() - lastSpokeAt.current > QUIET_AFTER_MS;
    const topicChange = !fresh && lastTopic.current !== null && head?.after !== lastTopic.current;
    const publish = () =>
      setSpeech(Object.fromEntries([...showing.current].map(([id, line]) => [id, line.text])));
    const timer = window.setTimeout(
      () => {
        const line = queue.current.shift();
        if (!line) return;
        lastTopic.current = line.after;
        lastSpokeAt.current = Date.now();
        setPending(queue.current.length > 0);
        showing.current.set(line.playerId, line);
        publish();
        window.setTimeout(() => {
          if (showing.current.get(line.playerId)?.id !== line.id) return;
          showing.current.delete(line.playerId);
          publish();
        }, speechMs(line.text));
        setQueued((n) => n + 1);
      },
      fresh ? FIRST_REMARK_MS : SPEECH_GAP_MS + (topicChange ? TOPIC_GAP_MS : 0),
    );
    return () => window.clearTimeout(timer);
  }, [busy, queued, revealKeys]);

  return { speech, pending };
}
