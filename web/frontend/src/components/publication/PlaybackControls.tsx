import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from "lucide-react";
import type { StepPlayback } from "@/hooks/use-step-playback";

export function PlaybackControls({ playback, length, name, playLabel = "Play" }: { playback: StepPlayback; length: number; name: string; playLabel?: string }) {
  return <div className="pub-controls pub-playback" role="group" aria-label={name}>
    <button type="button" className="pub-segment" disabled={playback.index === 0} onClick={playback.previous}><ArrowLeft size={15} aria-hidden="true" /> Previous</button>
    <button type="button" className="pub-segment" disabled={!playback.canPlay} onClick={playback.playing ? playback.pause : playback.play}>
      {playback.playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}{playback.playing ? "Pause" : playLabel}
    </button>
    <button type="button" className="pub-segment" disabled={!playback.canPlay} onClick={playback.replay}><RotateCcw size={15} aria-hidden="true" /> Replay</button>
    <button type="button" className="pub-segment" disabled={playback.index >= length - 1} onClick={playback.next}>Next <ArrowRight size={15} aria-hidden="true" /></button>
  </div>;
}
