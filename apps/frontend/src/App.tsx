import { useCallback, useEffect, useRef, useState } from 'react';
import { Agentation } from 'agentation';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import UserPage from './components/UserPage';
import { AudioManagerProvider } from './components/AudioContextManager';
import MiniPlayer from './components/MiniPlayer';
import { AuthModal } from './components/AuthModal';
import SamplePage from './pages/SamplePage/SamplePage';
import FeedPage from './pages/FeedPage/FeedPage';
import LibraryPage from './pages/LibraryPage/LibraryPage';
import UploadPage from './pages/UploadPage/UploadPage';
import HeaderNavBar, { NavItemKey } from './components/HeaderNavBar';

type SessionUser = {
  id?: string;
  sub?: string;
  email?: string;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const NAV_ROUTES: Record<NavItemKey, string> = {
  home: '/',
  feed: '/feed',
  library: '/library',
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'signup'>('login');
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
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

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalInitialMode(mode);
    setIsAuthModalOpen(true);
  };

  const activeNavItem: NavItemKey | null =
    location.pathname === NAV_ROUTES.home
      ? 'home'
      : location.pathname.startsWith(NAV_ROUTES.feed)
      ? 'feed'
      : location.pathname.startsWith(NAV_ROUTES.library)
      ? 'library'
      : null;

  const handleNavClick = (item: NavItemKey) => {
    navigate(NAV_ROUTES[item]);
  };

  const handleSearchSubmit = (query: string) => {
    navigate(`/feed?search=${encodeURIComponent(query)}`);
  };

  const headerUser = sessionUser
    ? {
        id: sessionUser.id ?? sessionUser.sub ?? sessionUser.email ?? 'session-user',
        name: sessionUser.email ?? sessionUser.id ?? sessionUser.sub ?? 'Authenticated user',
      }
    : undefined;

  return (
    <>
      <Agentation
        endpoint="http://localhost:4747"
        onSessionCreated={(sessionId) => {
          console.log('Session started:', sessionId);
        }}
      />
      <AudioManagerProvider>
        <HeaderNavBar
          mode={sessionUser && !isSessionLoading ? 'authenticated' : 'unauthenticated'}
          activeNavItem={activeNavItem}
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSearchSubmit={handleSearchSubmit}
          onLogoClick={() => navigate('/')}
          onNavClick={handleNavClick}
          onSignInClick={() => openAuthModal('login')}
          onCreateAccountClick={() => openAuthModal('signup')}
          onUploadClick={() => navigate('/upload')}
          onUserAccountClick={() => {
            if (headerUser) {
              navigate(`/user/${headerUser.id}`);
            }
          }}
          onNotificationsClick={() => navigate('/notifications')}
          onMoreActionsClick={() => {
            void handleLogout();
          }}
          user={headerUser}
          notificationsCount={0}
        />

        <Routes>
          <Route path="/" element={<UserPage />} />
          <Route
            path="/feed"
            element={
              <FeedPage
                isAuthorized={Boolean(sessionUser && !isSessionLoading)}
                onSignInClick={() => openAuthModal('login')}
              />
            }
          />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/sample/:sampleId" element={<SamplePage />} />
          <Route path="/user/:creatorId" element={<UserPage />} />
          <Route
            path="/upload"
            element={
              <UploadPage
                isAuthorized={Boolean(sessionUser && !isSessionLoading)}
                onSignInClick={() => openAuthModal('login')}
              />
            }
          />
          <Route path="/notifications" element={<UserPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <MiniPlayer />

        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalInitialMode}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={(user) => {
            sessionLoadIdRef.current += 1;
            setSessionUser(user);
            setIsAuthModalOpen(false);
          }}
        />
      </AudioManagerProvider>
    </>
  );
}

export default App
