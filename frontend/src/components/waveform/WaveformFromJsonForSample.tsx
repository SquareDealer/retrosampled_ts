// WaveformFromJsonForSample.tsx
import React, { useEffect, useState } from "react";
import { WaveformBars, WaveformBarsProps } from "./WaveformBars";
import { useAudioContextManager } from "../AudioContextManager";
import { Sample } from "../../types/Sample";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface JsonPeaks {
  version: number;
  channels: number;
  data: number[] | number[][];
}

export interface WaveformFromJsonForSampleProps
  extends Omit<WaveformBarsProps, "peaks" | "playbackProgress"> {
  sample: Sample;
  peaksUrl: string; // путь к json_peaks
}

/**
 * Рисует бар-вейвформ для конкретного sample,
 * используя json_peaks + прогресс из AudioManagerProvider.
 */
export const WaveformFromJsonForSample: React.FC<
  WaveformFromJsonForSampleProps
> = ({
  sample,
  peaksUrl,
  width = 200,
  height = 50,
  barWidth = 3,
  gap = 2,
  activeColor,
  inactiveColor,
  className,
}) => {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { currentSample, state } = useAudioContextManager();

  const isCurrent = currentSample?.id === sample.id;
  const playbackProgress = isCurrent ? state.progress : 0;

  useEffect(() => {
    let cancelled = false;

    const loadPeaks = async () => {
      try {
        setError(null);
        const res = await fetch(peaksUrl);
        if (!res.ok) {
          throw new Error(`Failed to load peaks: ${res.status}`);
        }
        const json: JsonPeaks = await res.json();
        if (cancelled) return;

        let data: number[];

        if (Array.isArray(json.data[0])) {
          // data: number[][]
          const channels = json.data as number[][];
          const length = channels[0].length;
          const mixed: number[] = [];

          for (let i = 0; i < length; i++) {
            let sum = 0;
            let count = 0;
            for (const ch of channels) {
              if (typeof ch[i] === "number") {
                sum += ch[i];
                count++;
              }
            }
            mixed.push(count ? sum / count : 0);
          }
          data = mixed;
        } else {
          // data: number[]
          data = json.data as number[];
        }

        setPeaks(data);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load peaks");
        }
      }
    };

    loadPeaks();

    return () => {
      cancelled = true;
    };
  }, [peaksUrl]);

  if (error) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.5,
          fontSize: 10,
        }}
      >
        peaks error
      </div>
    );
  }

  if (!peaks) {
    return (
      <div
        style={{
          width,
          height,
          background:
            "linear-gradient(90deg, #222 0px, #333 40px, #222 80px)",
          backgroundSize: "200% 100%",
          animation: "wave-skeleton 1.2s linear infinite",
          borderRadius: 4,
        }}
      />
    );
  }

  return (
    <WaveformBars
      peaks={peaks}
      width={width}
      height={height}
      barWidth={barWidth}
      gap={gap}
      playbackProgress={playbackProgress}
      activeColor={activeColor}
      inactiveColor={inactiveColor}
      className={className}
    />
  );
};

export default WaveformFromJsonForSample;
