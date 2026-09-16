import { useEffect, useRef, useState } from "react";
import type { FlipAudioEngine } from "./FlipAudioEngine";
import { FlipRecorder, IDLE_RECORDING } from "./FlipRecorder";

export function useFlipRecording(
  engine: FlipAudioEngine,
  bpm: number,
  onRecorded: ((buffer: AudioBuffer, bpm: number) => void) | undefined,
  onError: (message: string) => void,
) {
  const recorder = useRef<FlipRecorder | null>(null);
  const alive = useRef(false);
  const initializing = useRef(false);
  const recordingBpm = useRef(bpm);
  const [starting, setStarting] = useState(false);
  const [state, setState] = useState(IDLE_RECORDING);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current) {
        recorder.current.onState = () => {};
        recorder.current.onError = () => {};
        recorder.current.cancel();
      }
      recorder.current = null;
    };
  }, [engine]);

  const toggleRecording = async () => {
    if (initializing.current || state.phase === "finishing" || !onRecorded)
      return;
    onError("");
    try {
      if (state.phase !== "idle") {
        const buffer = await recorder.current?.stop();
        if (!alive.current) return;
        engine.pause();
        if (buffer) onRecorded(buffer, recordingBpm.current);
        return;
      }
      initializing.current = true;
      setStarting(true);
      engine.pause();
      // Resume inside the user gesture, before fetching/registering the worklet.
      await engine.audioContext.resume();
      const next =
        recorder.current ??
        (await FlipRecorder.create(engine.audioContext, engine.outputNode));
      if (!alive.current) {
        next.cancel();
        return;
      }
      recorder.current = next;
      next.onState = setState;
      next.onError = onError;
      recordingBpm.current = bpm;
      next.start(bpm);
    } catch (error) {
      if (alive.current) {
        recorder.current?.cancel();
        onError(
          error instanceof Error
            ? error.message
            : "Could not record this take.",
        );
      }
    } finally {
      initializing.current = false;
      if (alive.current) setStarting(false);
    }
  };
  return {
    state,
    starting,
    busy: starting || state.phase !== "idle",
    toggleRecording,
  };
}
