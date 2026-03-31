import { useState } from 'react';
import UserPage from './components/UserPage';
import { AudioManagerProvider } from './components/AudioContextManager';
import MiniPlayer from './components/MiniPlayer';
import { AuthModal } from './components/AuthModal';


function App() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <AudioManagerProvider>
      <UserPage/>
      <MiniPlayer />
      
      {/* Кнопка для тестирования модального окна */}
      <button 
        onClick={() => setIsAuthModalOpen(true)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '10px 20px',
          background: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'Roboto Mono, monospace',
          zIndex: 999
        }}
      >
        Open Auth Modal
      </button>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
      />
    </AudioManagerProvider>
  )
}

export default App
