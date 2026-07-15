/**
 * useIdlePrompt – erkennt Schreibpausen im Editor.
 *
 * Bleibt `dependency` (der Journal-Text) für `idleMs` unverändert, wird
 * `isIdle` true – der Aufrufer kann dann z.B. proaktiv eine Reflexionsfrage
 * einblenden. `dismiss()` setzt einen Cooldown, in dem weitere Pausen
 * ignoriert werden, damit der Hinweis nicht in Serie feuert.
 */
import { useEffect, useRef, useState } from 'react';

export function useIdlePrompt(
  dependency: string,
  { idleMs = 25000, enabled = true }: { idleMs?: number; enabled?: boolean } = {},
) {
  const [isIdle, setIsIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownUntil = useRef(0);

  useEffect(() => {
    setIsIdle(false);

    if (timer.current) {
      clearTimeout(timer.current);
    }

    if (!enabled) {
      return;
    }

    timer.current = setTimeout(() => {
      if (Date.now() >= cooldownUntil.current) {
        setIsIdle(true);
      }
    }, idleMs);

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [dependency, enabled, idleMs]);

  const dismiss = (cooldownMs = 120000) => {
    cooldownUntil.current = Date.now() + cooldownMs;
    setIsIdle(false);
  };

  return { isIdle, dismiss };
}