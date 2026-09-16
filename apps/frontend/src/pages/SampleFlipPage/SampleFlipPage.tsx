import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { SampleDetail } from "@retrosampled/shared";
import { fetchSampleById } from "../../api/samples";
import { useAuth } from "../../auth/useAuth";
import { useAudioContextManager } from "../../components/AudioContextManager";
import { WaveformBars } from "../../components/waveform/WaveformBars";
import { useElementWidth } from "../../hooks/useElementWidth";
import {
  FlipAudioEngine,
  waveformPeaks,
  type Playback,
} from "./FlipAudioEngine";
import {
  addCue,
  clamp,
  CUE_COLORS,
  effectiveReverse,
  ignoresShortcuts,
  newProject,
  projectKey,
  restoreProject,
  tempoRatio,
  type Cue,
  type FlipProject,
} from "./flipProject";
import "./SampleFlipPage.css";

const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;

function BpmField({
  label,
  value,
  min,
  max,
  disabled,
  onCommit,
}: {
  label: string;
  value: number | null;
  min: number;
  max?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  const commit = () => {
    const next = Number(draft);
    if (
      draft.trim() &&
      Number.isFinite(next) &&
      next >= min &&
      (max === undefined || next <= max)
    )
      onCommit(next);
    else setDraft(value?.toString() ?? "");
  };
  return (
    <label className="flip-control">
      {label}
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step="any"
        placeholder="Enter BPM"
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function FlipEditor({
  sample,
  engine,
  userId,
}: {
  sample: SampleDetail;
  engine: FlipAudioEngine;
  userId: string;
}) {
  const storageKey = projectKey(userId, sample.id);
  const [storageError, setStorageError] = useState(false);
  const [project, setProject] = useState<FlipProject>(() => {
    const initial = newProject(sample.id, sample.bpm);
    try {
      return restoreProject(
        localStorage.getItem(storageKey),
        initial,
        engine.duration,
      );
    } catch {
      return initial;
    }
  });
  const [playback, setPlayback] = useState<Playback>({
    position: project.reverse ? engine.duration : 0,
    playing: false,
  });
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  // Selection can move to a newly placed cue without changing the playing cue's direction.
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [audioError, setAudioError] = useState("");
  const [peaks] = useState(() => waveformPeaks(engine.buffer));
  const [waveformRef, width] = useElementWidth<HTMLDivElement>(1, 1000);
  const dragRef = useRef<{ slot: number; pointerId: number } | null>(null);
  const activeCue = project.cues.find((cue) => cue.slot === activeSlot);
  const reverse = effectiveReverse(project.reverse, activeCue?.reverse);
  const rate = tempoRatio(project);

  useEffect(() => {
    engine.onChange = setPlayback;
    engine.onError = setAudioError;
    engine.stop(project.reverse);
    return () => {
      engine.onChange = () => {};
      engine.onError = () => {};
      engine.pause();
    };
    // Initial transport position; subsequent edits are applied without stopping playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  useEffect(() => {
    engine.configure(rate, project.pitch, reverse);
  }, [engine, project.pitch, rate, reverse]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(project));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [project, storageKey]);

  const trigger = (cue: Cue) => {
    setAudioError("");
    setActiveSlot(cue.slot);
    setSelectedSlot(cue.slot);
    engine.configure(
      tempoRatio(project),
      project.pitch,
      effectiveReverse(project.reverse, cue.reverse),
    );
    void engine.play(cue.positionSeconds);
  };
  const placeCue = (slot?: number) => {
    const position = engine.currentPosition;
    const next = addCue(project, position, slot);
    const created = next.cues.find(
      (cue) => !project.cues.some((existing) => existing.slot === cue.slot),
    );
    if (!created) return;
    setProject((current) => addCue(current, position, created.slot));
    setSelectedSlot(created.slot);
  };
  const togglePlay = () => {
    if (playback.playing) engine.pause();
    else {
      setAudioError("");
      const position = engine.currentPosition;
      void engine.play(
        reverse
          ? position <= 0
            ? engine.duration
            : position
          : position >= engine.duration
            ? 0
            : position,
      );
    }
  };
  const stop = () => {
    setActiveSlot(null);
    setSelectedSlot(null);
    engine.stop(project.reverse);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (ignoresShortcuts(event)) return;
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const cue = project.cues.find(
          (item) => item.slot === Number(event.key),
        );
        if (cue) {
          trigger(cue);
        } else {
          placeCue(Number(event.key));
        }
      } else if (
        event.code === "Space" &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest("button, a")
        )
      ) {
        event.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const patchCue = (slot: number, patch: Partial<Cue>) =>
    setProject((current) => ({
      ...current,
      cues: current.cues.map((cue) =>
        cue.slot === slot ? { ...cue, ...patch } : cue,
      ),
    }));
  const pointerPosition = (clientX: number) => {
    const rect = waveformRef.current?.getBoundingClientRect();
    return rect && rect.width > 0
      ? clamp((clientX - rect.left) / rect.width, 0, 1) * engine.duration
      : 0;
  };

  return (
    <main className="flip-page">
      <header className="flip-header">
        <div>
          <Link to={`/sample/${sample.id}`} className="flip-back">
            ← Back to sample
          </Link>
          <p className="flip-eyebrow">SAMPLE FLIP</p>
          <h1>{sample.title}</h1>
        </div>
        <span className="flip-save" role="status">
          {storageError ? "Local saving unavailable" : "Saved in this browser"}
        </span>
      </header>

      <section className="flip-workspace" aria-label="Sample waveform editor">
        <div className="flip-wave-heading">
          <span>WAVEFORM</span>
          <output aria-label="Playback position">
            {time(playback.position)} <span>/ {time(engine.duration)}</span>
          </output>
        </div>
        <div
          className="flip-wave"
          ref={waveformRef}
          onPointerDown={(event) => {
            if (event.button === 0 && event.target === event.currentTarget)
              engine.seek(pointerPosition(event.clientX));
          }}
        >
          <div className="flip-wave-bars" aria-hidden="true">
            <WaveformBars
              peaks={peaks}
              width={width}
              height={240}
              barWidth={2}
              gap={1}
              playbackProgress={playback.position / engine.duration}
              activeColor="#f3f1e9"
              inactiveColor="#63656d"
            />
          </div>
          <div
            className="flip-cursor"
            style={{ left: `${(playback.position / engine.duration) * 100}%` }}
            aria-hidden="true"
          />
          <div
            className="flip-seek-accessible"
            role="slider"
            tabIndex={0}
            aria-label="Waveform position"
            aria-valuemin={0}
            aria-valuemax={engine.duration}
            aria-valuenow={Number(playback.position.toFixed(2))}
            aria-valuetext={time(playback.position)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                engine.seek(
                  engine.currentPosition +
                    (event.key === "ArrowRight" ? 0.1 : -0.1),
                );
              }
              if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                engine.seek(event.key === "Home" ? 0 : engine.duration);
              }
            }}
          />
          {project.cues.map((cue) => (
            <button
              key={cue.slot}
              type="button"
              className={`flip-marker${selectedSlot === cue.slot ? " flip-marker--active" : ""}`}
              style={{
                left: `${(cue.positionSeconds / engine.duration) * 100}%`,
                color: CUE_COLORS[cue.slot - 1],
              }}
              aria-label={`Cue ${cue.slot} at ${time(cue.positionSeconds)}; use arrow keys to move`}
              title={`Drag cue ${cue.slot} · ${time(cue.positionSeconds)}`}
              onFocus={() => setSelectedSlot(cue.slot)}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                setSelectedSlot(cue.slot);
                dragRef.current = {
                  slot: cue.slot,
                  pointerId: event.pointerId,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (
                  dragRef.current?.slot === cue.slot &&
                  dragRef.current.pointerId === event.pointerId
                )
                  patchCue(cue.slot, {
                    positionSeconds: pointerPosition(event.clientX),
                  });
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
              onLostPointerCapture={() => {
                dragRef.current = null;
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  patchCue(cue.slot, {
                    positionSeconds: clamp(
                      cue.positionSeconds +
                        (event.key === "ArrowRight" ? 0.01 : -0.01),
                      0,
                      engine.duration,
                    ),
                  });
                }
              }}
            >
              <span>
                {cue.slot}
                {cue.reverse ? " ↶" : ""}
              </span>
            </button>
          ))}
        </div>
        <div className="flip-ruler" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index}>{time((engine.duration * index) / 4)}</span>
          ))}
        </div>
        <div className="flip-transport">
          <button
            className="flip-button flip-button--primary"
            onClick={togglePlay}
          >
            {playback.playing ? "Ⅱ Pause" : "▶ Play"}
          </button>
          <button className="flip-button" onClick={stop}>
            ■ Stop
          </button>
          <button
            className="flip-button"
            aria-pressed={project.reverse}
            onClick={() => {
              setProject((current) => ({
                ...current,
                reverse: !current.reverse,
              }));
              if (
                !playback.playing &&
                activeSlot === null &&
                (playback.position === 0 ||
                  playback.position === engine.duration)
              )
                engine.seek(project.reverse ? 0 : engine.duration);
            }}
          >
            ↶ Reverse all
          </button>
          <button
            className="flip-button flip-add"
            disabled={project.cues.length === 9}
            onClick={() => placeCue()}
          >
            + Add cue <span>{project.cues.length}/9</span>
          </button>
        </div>
      </section>

      <section className="flip-settings" aria-label="Pitch and tempo">
        <label className="flip-control flip-pitch">
          Pitch{" "}
          <output>
            {project.pitch > 0 ? "+" : ""}
            {project.pitch} st
          </output>
          <input
            aria-label="Pitch semitones"
            type="range"
            min={-24}
            max={12}
            step={1}
            value={project.pitch}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                pitch: Number(event.target.value),
              }))
            }
          />
        </label>
        <BpmField
          label="Original BPM"
          value={project.sourceBpm}
          min={0.01}
          onCommit={(sourceBpm) =>
            setProject((current) => ({
              ...current,
              sourceBpm,
              targetBpm: sourceBpm,
            }))
          }
        />
        <BpmField
          label="Target BPM"
          value={project.targetBpm}
          min={(project.sourceBpm ?? 1) * 0.5}
          max={(project.sourceBpm ?? 1) * 2}
          disabled={!project.sourceBpm}
          onCommit={(targetBpm) =>
            setProject((current) => ({ ...current, targetBpm }))
          }
        />
        <button
          className="flip-button"
          onClick={() =>
            setProject((current) => ({
              ...current,
              pitch: 0,
              targetBpm: current.sourceBpm,
            }))
          }
        >
          Reset pitch / BPM
        </button>
        <p className="flip-hint">
          {project.sourceBpm
            ? "Pitch and tempo are independent. Tempo range: 0.5×–2×."
            : "Enter the original BPM to adjust tempo. Pitch remains available."}
        </p>
      </section>

      <section aria-label="Cue pads">
        <div className="flip-cues-heading">
          <h2>Cue points</h2>
          <span>1–9 to set / trigger cues · Space to play / pause</span>
        </div>
        <div className="flip-pads">
          {Array.from({ length: 9 }, (_, index) => {
            const slot = index + 1;
            const cue = project.cues.find((item) => item.slot === slot);
            return (
              <div
                key={slot}
                className={`flip-pad${selectedSlot === slot ? " flip-pad--active" : ""}${cue ? "" : " flip-pad--empty"}`}
                style={
                  { "--cue-color": CUE_COLORS[index] } as React.CSSProperties
                }
              >
                <button
                  className="flip-pad-trigger"
                  disabled={!cue}
                  aria-label={`Play cue ${slot}`}
                  onClick={() => cue && trigger(cue)}
                >
                  <strong>{slot}</strong>
                  <span>{cue ? time(cue.positionSeconds) : "Empty"}</span>
                </button>
                {cue && (
                  <div className="flip-pad-actions">
                    <button
                      aria-label={`Reverse cue ${slot}`}
                      aria-pressed={cue.reverse}
                      onClick={() => patchCue(slot, { reverse: !cue.reverse })}
                    >
                      ↶ REV
                    </button>
                    <button
                      aria-label={`Delete cue ${slot}`}
                      onClick={() => {
                        if (selectedSlot === slot) setSelectedSlot(null);
                        if (activeSlot === slot) {
                          setActiveSlot(null);
                          engine.pause();
                        }
                        setProject((current) => ({
                          ...current,
                          cues: current.cues.filter(
                            (item) => item.slot !== slot,
                          ),
                        }));
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="flip-hint">
          Press an empty slot's key (1–9) to place a cue at the playhead while
          listening. Press it again to trigger. You can also click the waveform
          and add a cue, then drag its marker to adjust it.
        </p>
      </section>
      {audioError && (
        <p className="flip-error" role="alert">
          {audioError}
        </p>
      )}
      {storageError && (
        <p className="flip-error" role="alert">
          Your changes cannot be saved in this browser. You can keep playing in
          this session.
        </p>
      )}
    </main>
  );
}

export default function SampleFlipPage() {
  const { sampleId = "" } = useParams();
  const { user } = useAuth();
  const { acquireEditorSession } = useAudioContextManager();
  const [loaded, setLoaded] = useState<{
    sample: SampleDetail;
    engine: FlipAudioEngine;
    userId: string | undefined;
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => acquireEditorSession(), [acquireEditorSession]);
  useEffect(() => {
    const abort = new AbortController();
    let engine: FlipAudioEngine | undefined;
    setLoaded(null);
    setError("");
    void (async () => {
      const sample = await fetchSampleById(sampleId);
      if (abort.signal.aborted) return;
      if (!sample) throw new Error("Sample not found or unavailable.");
      if (!sample.audioPreviewUrl)
        throw new Error("This sample has no playable audio yet.");
      engine = await FlipAudioEngine.load(sample.audioPreviewUrl, abort.signal);
      if (abort.signal.aborted) {
        engine.dispose();
        return;
      }
      setLoaded({ sample, engine, userId: user?.id });
    })().catch((cause: unknown) => {
      if (!abort.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Could not load the sample.",
        );
    });
    return () => {
      abort.abort();
      engine?.dispose();
    };
  }, [sampleId, user?.id, attempt]);

  if (
    loaded &&
    loaded.sample.id === sampleId &&
    user &&
    loaded.userId === user.id
  )
    return (
      <FlipEditor
        key={`${user.id}:${sampleId}:${attempt}`}
        sample={loaded.sample}
        engine={loaded.engine}
        userId={user.id}
      />
    );
  return (
    <main className="flip-page">
      <Link to={`/sample/${sampleId}`} className="flip-back">
        ← Back to sample
      </Link>
      {error ? (
        <section className="flip-state">
          <h1>Could not open the editor</h1>
          <p role="alert">{error}</p>
          <button
            className="flip-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </section>
      ) : (
        <section className="flip-state" aria-busy="true">
          <h1>Loading sample…</h1>
          <p>Preparing the waveform and audio.</p>
        </section>
      )}
    </main>
  );
}
