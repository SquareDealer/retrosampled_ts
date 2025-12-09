import React, { useState, useEffect } from 'react';
import SampleRow from './SampleRow';

type TabType = 'popular' | 'premium' | 'liked';

interface Sample {
  id: string | number;
  authorId: string | number;
  author?: string;
  title: string;
  tags: string[];
  audioUrl: string;
  time: string;
  key: string;
  bpm: string | number;
  type: string;
  price: string | number;
}

interface UserSamplesSectionProps {
  userId: string | number;
}

// Имитация запроса на бэкенд
const fetchUserSamples = (userId: string | number, tab: TabType): Promise<Sample[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Моковые данные для демонстрации
      const mockSamples: Sample[] = [
        {
          id: `${tab}-1`,
          authorId: userId,
          title: `${tab === 'popular' ? 'Lo-Fi Dreams' : tab === 'premium' ? 'alesha_popovich_type_beat_nowrap' : 'Favorite Track'}`,
          tags: ['lofi', 'chill', 'ambient'],
          audioUrl: '/audio/ALL EYES ON ME CHOP.wav',
          time: '0:32',
          key: 'Am',
          bpm: 85,
          type: 'Loop',
          price: tab === 'premium' ? 150 : 50
        },
        {
          id: `${tab}-2`,
          authorId: userId,
          title: `${tab === 'popular' ? 'Retro Vibes' : tab === 'premium' ? 'VIP Sample' : 'Saved Beat'}`,
          tags: ['retro', 'synth', '80s'],
          audioUrl: '/audio/ALL EYES ON ME CHOP.wav',
          time: '0:45',
          key: 'Dm',
          bpm: 120,
          type: 'One-shot',
          price: tab === 'premium' ? 200 : 75
        }
      ];
      resolve(mockSamples);
    }, 300);
  });
};

const UserSamplesSection: React.FC<UserSamplesSectionProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<TabType>('popular');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchUserSamples(userId, activeTab)
      .then((data) => {
        setSamples(data);
        setLoading(false);
      })
      .catch(() => {
        setSamples([]);
        setLoading(false);
      });
  }, [userId, activeTab]);

  const handlePlay = (id: string | number) => {
    setCurrentPlayingId(id);
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'popular', label: 'Popular picks' },
    { key: 'premium', label: 'Premium subscription' },
    { key: 'liked', label: 'Liked' }
  ];

  return (
    <div className="user-samples-section">
      <div className="user-samples-section__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`user-samples-section__tab ${activeTab === tab.key ? 'user-samples-section__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="user-samples-section__content">
        {loading ? (
          <div className="user-samples-section__loading">Loading...</div>
        ) : samples.length === 0 ? (
          <div className="user-samples-section__empty">No samples found</div>
        ) : (
          <div className="samples-container">
            {samples.map((sample) => (
              <SampleRow
                key={sample.id}
                sample={sample}
                currentPlayingId={currentPlayingId}
                onPlay={handlePlay}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSamplesSection;