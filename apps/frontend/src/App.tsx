import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import UserPage from './components/UserPage';
import { AudioManagerProvider } from './components/AudioContextManager';
import MiniPlayer from './components/MiniPlayer';
import { AuthModal } from './components/AuthModal';
import SamplePage from './pages/SamplePage/SamplePage';

type SessionUser = {
  id?: string;
  sub?: string;
  email?: string;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);
  const sessionLoadIdRef = useRef(0);

  const ensureRefreshedSession = useCallback(async (): Promise<boolean> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      return refreshResponse.ok;
    })();

    try {
      return await refreshPromiseRef.current;
    } finally {
      refreshPromiseRef.current = null;
    }
  }, []);

  const fetchSessionUser = useCallback(async (): Promise<SessionUser | null> => {
    const meResponse = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (meResponse.ok) {
      const meData = (await meResponse.json()) as { user?: SessionUser };
      return meData.user ?? null;
    }

    // If access token expired but refresh cookie is still valid, recover session.
    if (meResponse.status === 401) {
      const refreshed = await ensureRefreshedSession();
      if (!refreshed) {
        return null;
      }

      const retryMeResponse = await fetch(`${API_URL}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!retryMeResponse.ok) {
        return null;
      }

      const retryMeData = (await retryMeResponse.json()) as { user?: SessionUser };
      return retryMeData.user ?? null;
    }

    return null;
  }, [ensureRefreshedSession]);

  const loadSession = useCallback(async () => {
    const requestId = ++sessionLoadIdRef.current;
    setIsSessionLoading(true);

    try {
      const user = await fetchSessionUser();

      if (requestId === sessionLoadIdRef.current) {
        setSessionUser(user);
      }
    } catch {
      if (requestId === sessionLoadIdRef.current) {
        setSessionUser(null);
      }
    } finally {
      if (requestId === sessionLoadIdRef.current) {
        setIsSessionLoading(false);
      }
    }
  }, [fetchSessionUser]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      sessionLoadIdRef.current += 1;
      setSessionUser(null);
    }
  };

  const userLabel =
    sessionUser?.email || sessionUser?.id || sessionUser?.sub || 'Authenticated user';

  return (
    <AudioManagerProvider>
      <Routes>
        <Route path="/" element={<UserPage />} />
        <Route path="/sample/:sampleId" element={<SamplePage />} />
        <Route path="/user/:creatorId" element={<UserPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <MiniPlayer />
      
      {isSessionLoading ? (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '10px 14px',
            background: '#111',
            border: '1px solid #FFFFFF30',
            color: '#FFFFFF80',
            fontFamily: 'Roboto Mono, monospace',
            fontSize: '12px',
            zIndex: 999,
          }}
        >
          Checking session...
        </div>
      ) : sessionUser ? (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: '#0b0b0b',
            border: '1px solid #FFFFFF30',
            color: '#fff',
            fontFamily: 'Roboto Mono, monospace',
            fontSize: '12px',
            zIndex: 999,
          }}
        >
          <span>{userLabel}</span>
          <button
            onClick={handleLogout}
            style={{
              border: '1px solid #FFFFFF40',
              background: 'transparent',
              color: '#fff',
              padding: '4px 8px',
              cursor: 'pointer',
              fontFamily: 'Roboto Mono, monospace',
              fontSize: '11px',
            }}
          >
            Logout
          </button>
        </div>
      ) : (
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
            zIndex: 999,
          }}
        >
          Open Auth Modal
        </button>
      )}

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          sessionLoadIdRef.current += 1;
          setSessionUser(user);
          setIsAuthModalOpen(false);
        }}
      />
    </AudioManagerProvider>
  )
}

export default App
