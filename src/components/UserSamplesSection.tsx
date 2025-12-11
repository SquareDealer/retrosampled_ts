
import React, { useState, useEffect } from 'react';
import SamplePiece from './SamplePiece';
import { Sample } from '../types/Sample';
import { mockSamples } from '../mocks/mockSamples';

type TabType = 'popular' | 'premium' | 'liked';

interface UserSamplesSectionProps {
  userId: string | number;
}

// Имитация запроса на бэкенд
const fetchUserSamples = (userId: string | number, tab: TabType): Promise<Sample[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Используем mockSamples из отдельного файла
      // Подменяем authorId на текущий userId
      const samples = (mockSamples[tab] || []).map(s => ({ ...s, authorId: userId }));
      resolve(samples);
    }, 300);
  });
};

const UserSamplesSection: React.FC<UserSamplesSectionProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<TabType>('popular');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

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
              <SamplePiece sample={sample} key={sample.id}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSamplesSection;