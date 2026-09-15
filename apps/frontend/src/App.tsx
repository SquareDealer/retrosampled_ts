import { useState } from 'react';
import { Agentation } from 'agentation';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AudioManagerProvider } from './components/AudioContextManager';
import MiniPlayer from './components/MiniPlayer';
import SamplePage from './pages/SamplePage/SamplePage';
import FeedPage from './pages/FeedPage/FeedPage';
import LibraryPage from './pages/LibraryPage/LibraryPage';
import HeaderNavBar, { NavItemKey } from './components/HeaderNavBar';
import RequireAuth from './components/RequireAuth';
import RequireRole from './components/RequireRole';
import AdminPage from './pages/AdminPage/AdminPage';
import ProfilePage from './pages/ProfilePage/ProfilePage';
import FollowListPage from './pages/FollowListPage/FollowListPage';
import NotificationsPage from './pages/NotificationsPage/NotificationsPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';
import { useAuth } from './auth/useAuth';
import { can } from '@retrosampled/shared';

const NAV_ROUTES: Record<NavItemKey, string> = {
  home: '/',
  feed: '/feed',
  library: '/library',
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState('');
  const { user, status, logout, openAuthModal } = useAuth();

  const isAuthenticated = status === 'authenticated' && Boolean(user);

  // Same predicate the backend enforces with @Roles('ADMIN'), so the link can
  // never appear for someone the API would answer 403 to.
  const actor = user ? { id: user.id, role: user.role } : null;
  const isAdmin = can(actor, 'admin:any');

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

  const headerUser = user
    ? {
        id: user.id,
        name: user.username,
        avatarUrl: user.avatarUrl,
      }
    : undefined;

  return (
    <>
      {import.meta.env.DEV && (
        <Agentation
          endpoint="http://localhost:4747"
          onSessionCreated={(sessionId) => {
            console.log('Session started:', sessionId);
          }}
        />
      )}
      <AudioManagerProvider>
        <HeaderNavBar
          mode={isAuthenticated ? 'authenticated' : 'unauthenticated'}
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
            if (user) {
              navigate(`/user/${user.username}`);
            }
          }}
          showAdminLink={isAdmin}
          onAdminClick={() => navigate('/admin')}
          onNotificationsClick={() => navigate('/notifications')}
          onSettingsClick={() => navigate('/settings')}
          onLogoutClick={() => {
            void logout().then(() => navigate('/feed'));
          }}
          user={headerUser}
        />

        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route
            path="/feed"
            element={
              <FeedPage
                isAuthorized={isAuthenticated}
                onSignInClick={() => openAuthModal('login')}
              />
            }
          />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/sample/:sampleId" element={<SamplePage />} />
          <Route path="/user/:username" element={<ProfilePage />} />
          <Route path="/user/:username/followers" element={<FollowListPage mode="followers" />} />
          <Route path="/user/:username/following" element={<FollowListPage mode="following" />} />
          <Route path="/upload" element={<NotFoundPage />} />
          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireRole role="ADMIN" fallback="forbidden">
                  <AdminPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <MiniPlayer />
      </AudioManagerProvider>
    </>
  );
}

export default App
