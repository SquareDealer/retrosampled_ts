// WaveformBars.tsx
import React from "react";

export interface WaveformBarsProps {
  peaks: number[];        // нормализованные значения 0..1 или -1..1
  width?: number;         // ширина всего компонента в px (по умолчанию 160)
  height?: number;        // высота в px (по умолчанию 60)
  barWidth?: number;      // ширина одного бара
  gap?: number;           // расстояние между барами
  playbackProgress?: number; // 0..1 — прогресс воспроизведения
  activeColor?: string;   // цвет "пройденных" баров
  inactiveColor?: string; // цвет остальных баров
  className?: string;
}

export const WaveformBars: React.FC<WaveformBarsProps> = ({
  peaks,
  width = 200,
  height = 50,
  barWidth = 3,
  gap = 2,
  playbackProgress = 0,
  activeColor = "#FFFFFF",
  inactiveColor = "rgba(255,255,255,0.30)",
  className,
}) => {
  // сколько баров поместится по ширине
  const maxBars = Math.max(1, Math.floor(width / (barWidth + gap)));
  const bars: number[] = [];

  if (peaks.length > 0) {
    const ratio = peaks.length / maxBars;

    for (let i = 0; i < maxBars; i++) {
      let val = 0;
      if (ratio >= 1) {
        // Downsampling: берем максимальное значение в диапазоне (чтобы не терять пики)
        const start = Math.floor(i * ratio);
        const end = Math.min(peaks.length, Math.floor((i + 1) * ratio));
        for (let j = start; j < end; j++) {
          const curr = Math.abs(peaks[j]);
          if (curr > val) val = curr;
        }
      } else {
        // Upsampling: берем ближайшее значение
        const idx = Math.floor(i * ratio);
        val = Math.abs(peaks[Math.min(peaks.length - 1, idx)]);
      }
      bars.push(val);
    }
  }

  // Находим максимальное значение для нормализации
  const maxPeak = bars.reduce((max, val) => Math.max(max, val), 0) || 1;

  const clampedProgress = Math.max(0, Math.min(1, playbackProgress));

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        width,
        height,
      }}
    >
      {bars.map((value, index) => {
        // нормализуем |value| относительно maxPeak
        const v = Math.abs(value) / maxPeak;
        const barHeight = Math.max(1, v * 100); // Минимальная высота 1%

        // Заполняем бар, если прогресс больше начала этого бара.
        // При 0 бар пустой. При >0 сразу заполняется.
        const isFilled = clampedProgress > (index / bars.length);

        return (
          <div
            key={index}
            style={{
              width: barWidth,
              marginRight: index === bars.length - 1 ? 0 : gap,
              height: `${barHeight}%`,
              backgroundColor: isFilled ? activeColor : inactiveColor,
              alignSelf: "center",
            }}
          />
        );
      })}
    </div>
  );
};
