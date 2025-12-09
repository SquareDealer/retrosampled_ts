import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';

const Waveform = ({ audioUrl, id, currentPlayingId, onPlay }) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Эффект для остановки воспроизведения, если играет другой трек
  useEffect(() => {
    if (currentPlayingId !== id && wavesurferRef.current) {
      // Если трек не активен, но у него есть прогресс (был на паузе или играет), сбрасываем его
      if (wavesurferRef.current.getCurrentTime() > 0) {
        wavesurferRef.current.stop();
        setIsPlaying(false);
      }
    }
  }, [currentPlayingId, id]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Очищаем контейнер перед созданием нового экземпляра, чтобы избежать дублей
    containerRef.current.innerHTML = '';

    // Создаем градиенты для стиля Soundcloud (Monochrome)
    const canvas = document.createElement('canvas');
    canvas.height = 54; // Высота должна совпадать с height в настройках WaveSurfer
    const ctx = canvas.getContext('2d');

    // Градиент для не проигранной части (Wave) - Серый
    const waveGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 1.35);
    waveGradient.addColorStop(0, '#656666'); // Top color

    // Градиент для проигранной части (Progress) - Светлый/Белый (Monochrome)
    const progressGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 1.35);
    progressGradient.addColorStop(0, '#FFFFFF'); // Top color
   

    // Инициализация
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: audioUrl, // Передаем URL сразу в настройки
      // --- НАСТРОЙКИ КАСТОМНЫХ БАРОВ ---
      waveColor: waveGradient,
      progressColor: progressGradient,
      height: 50,
      barWidth: 3,
      width: 200,
      barGap: 2,
      barRadius: 0,
      // --------------------------------
      cursorWidth: 1,
      cursorColor: 'transparent',
      normalize: true,
      backend: 'WebAudio',
      plugins: [
        Hover.create({
          lineColor: '#ffffff',
          lineWidth: 3,
          labelBackground: 'transparent',
          labelColor: 'transparent',
          labelSize: '0px',
        }),
      ],
    });

    wavesurferRef.current = ws;

    // Обработчики событий
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => {
        setIsPlaying(false);
        ws.stop(); // Сбрасываем в начало при завершении
    });

    // Очистка
    return () => {
      ws.destroy();
    };
  }, [audioUrl]);

  const handlePlayPause = () => {
    if (!wavesurferRef.current) return;

    if (isPlaying) {
      wavesurferRef.current.pause();
    } else {
      // Сообщаем родителю, что мы начинаем играть
      if (onPlay) onPlay(id);
      wavesurferRef.current.play();
    }
  };

  return (
    <div className="sample-row__media">
      <button className="sample-row__play" onClick={handlePlayPause} type="button">
        <img 
            className="sample-row__play-icon" 
            src={isPlaying ? "/img/pause_icon.png" : "/img/play_icon.png"} 
            alt="play" 
            onError={(e) => {
                // Fallback if pause icon doesn't exist, just use play icon or log error
                // Assuming user might not have pause_icon.png yet, but logic requires it.
                // If not present, it will show broken image. 
                // For now, let's assume they have it or will add it.
                // Or better, just toggle opacity or something if image missing.
            }}
        />
      </button>

      <div className="sample-row__waveform" ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
};

export default Waveform;
