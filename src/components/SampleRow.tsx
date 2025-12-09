import React, { useState, useEffect } from 'react';
import Waveform from './Waveform';
import { Sample } from '../types/Sample';

interface User {
  id: string | number;
  name: string;
}

interface SampleRowProps {
  sample: Sample;
  currentPlayingId: string | number | null;
  onPlay: (id: string | number) => void;
}

// Имитация запроса на бэкенд
const fetchUser = (userId: string | number): Promise<User> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // В реальности здесь был бы fetch('/api/users/' + userId)
      resolve({ id: userId, name: "@bagamemphis" });
    }, 100);
  });
};

const SampleRow: React.FC<SampleRowProps> = ({ sample, currentPlayingId, onPlay }) => {
  const [authorName, setAuthorName] = useState<string>(sample.author || "Loading...");

  useEffect(() => {
    if (sample.authorId) {
      fetchUser(sample.authorId).then(user => {
        setAuthorName(user.name);
      });
    }
  }, [sample.authorId]);

  return (
    <div className="sample-row">
      {/* ЛЕВАЯ ЧАСТЬ: аватар, автор, название, теги */}
      <div className="sample-row__left">
          <img
              className="sample-row__avatar"
              src="/img/avatar.jpg"
              alt={authorName}
          />

          <div className="sample-row__info">
              <a href={`/user/${sample.authorId}`} className="sample-row__author">
                {authorName}
              </a>
              <div className="sample-row__title">{sample.title}</div>

              <div className="sample-row__tags">
                  {sample.tags.map((tag, index) => (
                      <span className="tag" key={index}>{tag}</span>
                  ))}
              </div>
          </div>
      </div>
    <div className="sample-row__center">
        {/* СРЕДНЯЯ ЧАСТЬ: плеер + волна + метаданные */}
        <Waveform 
            audioUrl={sample.audioUrl} 
            id={sample.id}
            currentPlayingId={currentPlayingId}
            onPlay={onPlay}
        />

        <div className="sample-row__metadata">
            <div className="sample-row__time">{sample.time}</div>
            <div className="sample-row__key">{sample.key}</div>
            <div className="sample-row__bpm">{sample.bpm}</div>
        </div>
    </div>
      <div className='sample-row__right'>
        {/* ПРАВАЯ ЧАСТЬ: цена + лайк */}
        <div className="sample-row__actions">
            <div className="sample-row__price">
                <span className="sample-row__coin">
                    <img className="sample-row__coin-icon" src="/img/gold_icon.png" alt="gold" />
                </span>
                <span>{sample.price}</span>
            </div>

            <button className="sample-row__like" type="button"></button>
        </div>
        </div>
    </div>
  );
};

export default SampleRow;
