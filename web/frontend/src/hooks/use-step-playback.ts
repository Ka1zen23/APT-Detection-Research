import { useEffect, useState } from "react";

/** Nothing plays until requested; manually choosing a stage stops the sequence. */
export function useStepPlayback(length: number, delay = 1100, playableLength = length) {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const index = Math.min(position, Math.max(0, length - 1));
  const canPlay = playableLength > 1;
  function select(next: number) {
    setPlaying(false);
    setPosition(Math.max(0, Math.min(length - 1, next)));
  }
  useEffect(() => {
    if (!playing || !canPlay) return;
    const timer = window.setTimeout(() => {
      const next = index + 1;
      if (next < playableLength) setPosition(next);
      if (next >= playableLength - 1) setPlaying(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, index, delay, playableLength, canPlay]);
  return {
    index, playing: playing && canPlay, canPlay, select,
    previous: () => select(index - 1),
    next: () => select(index + 1),
    pause: () => setPlaying(false),
    play: () => {
      if (!canPlay) return;
      if (index >= playableLength - 1) setPosition(0);
      setPlaying(true);
    },
    replay: () => {
      setPosition(0);
      setPlaying(canPlay);
    },
  };
}

export type StepPlayback = ReturnType<typeof useStepPlayback>;
