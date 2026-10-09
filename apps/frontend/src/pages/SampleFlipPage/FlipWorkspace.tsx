import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { SampleDetail } from "@retrosampled/shared";
import { WaveformBars } from "../../components/waveform/WaveformBars";
import { FlipAudioEngine, waveformPeaks } from "./FlipAudioEngine";
import { FlipEditor } from "./SampleFlipPage";
import { projectKey } from "./flipProject";
import {
  readWorkspace,
  writeWorkspace,
  type WorkspaceMetadata,
} from "./flipWorkspaceStorage";
import { encodeWav, wavFileName } from "./wavEncoder";

type Take = {
  id: string;
  name: string;
  sourceBpm: number;
  buffer: AudioBuffer;
  peaks: number[];
};
/** Router state `/sample/:id/remake` accepts to preload a flip take. */
export type RemakeTakeState = { remakeFile: File; remakeBpm?: number };

export type WorkspaceControls = {
  rootSampleId: string;
  bpm: number;
  setBpm: (bpm: number) => void;
  onRecorded: (buffer: AudioBuffer, bpm: number) => void;
  renderTakes: (busy: boolean) => ReactNode;
  saving: boolean;
  notice: string;
};

function initialBpm(key: string, sample: SampleDetail) {
  try {
    const legacy = JSON.parse(localStorage.getItem(key) ?? "null");
    if (Number.isFinite(legacy?.targetBpm) && legacy.targetBpm > 0)
      return legacy.targetBpm as number;
  } catch {
    /* Use the sample tempo when legacy settings are missing. */
  }
  return sample.bpm > 0 ? sample.bpm : 120;
}

export function FlipWorkspace({
  sample,
  engine,
  userId,
}: {
  sample: SampleDetail;
  engine: FlipAudioEngine;
  userId: string;
}) {
  const navigate = useNavigate();
  const key = projectKey(userId, sample.id);
  const [takes, setTakes] = useState<Take[]>(() => [
    {
      id: sample.id,
      name: sample.title,
      sourceBpm: sample.bpm,
      buffer: engine.buffer,
      peaks: waveformPeaks(engine.buffer, 300),
    },
  ]);
  const [activeId, setActiveId] = useState(sample.id);
  const [bpm, setBpm] = useState(() => initialBpm(key, sample));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const savedIds = useRef(new Set<string>());
  const saveQueue = useRef(Promise.resolve());
  const persistenceEnabled = useRef(true);
  const mounted = useRef(false);
  const original = useRef(takes[0]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void readWorkspace(key)
      .then((stored) => {
        if (cancelled || !stored) return;
        const restored: Take[] = stored.metadata.takes.map((take) => {
          const data = stored.audio.get(take.id)!;
          const buffer = engine.audioContext.createBuffer(
            data.channels.length,
            data.channels[0].length,
            data.sampleRate,
          );
          data.channels.forEach((channel, index) =>
            buffer.getChannelData(index).set(channel),
          );
          return { ...take, buffer, peaks: waveformPeaks(buffer, 300) };
        });
        const all = [original.current, ...restored];
        const active =
          all.find((take) => take.id === stored.metadata.activeId) ?? all[0];
        savedIds.current = new Set(restored.map((take) => take.id));
        engine.setBuffer(active.buffer);
        setTakes(all);
        setActiveId(active.id);
        setBpm(stored.metadata.bpm);
      })
      .catch(() => {
        if (cancelled) return;
        persistenceEnabled.current = false;
        setNotice(
          "Saved takes could not be loaded. New recordings will be available for this session only.",
        );
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [key, engine]);

  useEffect(() => {
    if (!ready || !persistenceEnabled.current) return;
    const recorded = takes.filter((take) => take.id !== sample.id);
    const metadata: WorkspaceMetadata = {
      version: 1,
      bpm,
      activeId,
      takes: recorded.map(({ id, name, sourceBpm }) => ({
        id,
        name,
        sourceBpm,
      })),
    };
    let current = true;
    setSaving(true);
    saveQueue.current = saveQueue.current
      .then(async () => {
        const newAudio = recorded.filter(
          (take) => !savedIds.current.has(take.id),
        );
        await writeWorkspace(key, metadata, newAudio);
        newAudio.forEach((take) => savedIds.current.add(take.id));
        if (mounted.current && current) setNotice("");
      })
      .catch(() => {
        if (mounted.current && current)
          setNotice(
            "Could not save recordings locally. Keep this page open to retain your takes.",
          );
      })
      .finally(() => {
        if (mounted.current && current) setSaving(false);
      });
    return () => {
      current = false;
    };
  }, [ready, takes, activeId, bpm, key, sample.id]);

  const active = takes.find((take) => take.id === activeId)!;
  const takeFile = (take: Take) =>
    new File([encodeWav(take.buffer)], wavFileName(sample.title, take.name), {
      type: "audio/wav",
    });
  const downloadTake = (take: Take) => {
    const url = URL.createObjectURL(takeFile(take));
    const link = document.createElement("a");
    link.href = url;
    link.download = wavFileName(sample.title, take.name);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const publishTake = (take: Take) => {
    const state: RemakeTakeState = {
      remakeFile: takeFile(take),
      remakeBpm: take.sourceBpm > 0 ? take.sourceBpm : undefined,
    };
    navigate(`/sample/${sample.id}/remake`, { state });
  };
  const select = (take: Take) => {
    if (take.id === activeId) return;
    engine.setBuffer(take.buffer);
    setActiveId(take.id);
  };
  if (!ready)
    return (
      <main className="flip-page" aria-busy="true">
        <h1>Loading workspace…</h1>
      </main>
    );

  return (
    <FlipEditor
      key={active.id}
      sample={{
        ...sample,
        id: active.id,
        title: active.name,
        bpm: active.sourceBpm,
      }}
      engine={engine}
      userId={userId}
      workspace={{
        rootSampleId: sample.id,
        bpm,
        setBpm,
        saving,
        notice,
        onRecorded: (buffer, recordedBpm) =>
          setTakes((current) => [
            ...current,
            {
              id: `${sample.id}:take:${crypto.randomUUID()}`,
              name: `Take ${current.length}`,
              sourceBpm: recordedBpm,
              buffer,
              peaks: waveformPeaks(buffer, 300),
            },
          ]),
        renderTakes: (busy) => (
          <section
            className="flip-takes"
            aria-label="Source and recorded takes"
          >
            <div className="flip-cues-heading">
              <h2>Sources & takes</h2>
              <span>Click a waveform to edit it</span>
            </div>
            <div className="flip-take-list">
              {takes.map((take, index) => (
                <button
                  key={take.id}
                  className={`flip-take${take.id === activeId ? " flip-take--active" : ""}`}
                  disabled={busy}
                  aria-pressed={take.id === activeId}
                  aria-label={`Edit ${index === 0 ? "original sample" : take.name}`}
                  onClick={() => select(take)}
                >
                  <span className="flip-take-heading">
                    <strong>{index === 0 ? "Original" : take.name}</strong>
                    <span>{take.buffer.duration.toFixed(2)}s</span>
                  </span>
                  <div className="flip-take-wave" aria-hidden="true">
                    <WaveformBars
                      peaks={take.peaks}
                      width={220}
                      height={46}
                      barWidth={2}
                      gap={1}
                      inactiveColor={
                        take.id === activeId ? "#b4e29a" : "#a4a6af"
                      }
                    />
                  </div>
                  <span className="flip-take-tempo">
                    {take.sourceBpm > 0
                      ? `${take.sourceBpm} BPM`
                      : "BPM unknown"}
                  </span>
                </button>
              ))}
            </div>
            {active.id !== sample.id ? (
              <div className="flip-take-actions">
                <button
                  type="button"
                  className="flip-button"
                  disabled={busy}
                  onClick={() => downloadTake(active)}
                >
                  Download WAV
                </button>
                <button
                  type="button"
                  className="flip-button flip-button--primary"
                  disabled={busy}
                  onClick={() => publishTake(active)}
                >
                  Publish as remake
                </button>
              </div>
            ) : null}
          </section>
        ),
      }}
    />
  );
}
