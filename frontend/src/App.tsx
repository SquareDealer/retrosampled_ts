import UserPage from './components/UserPage';
import { AudioManagerProvider } from './components/AudioContextManager';
import MiniPlayer from './components/MiniPlayer';
import LibraryPage from './pages/LibraryPage/LibraryPage';


function App() {
  const isLibraryRoute = window.location.pathname === '/library';

  return (
    <AudioManagerProvider>
      {isLibraryRoute ? <LibraryPage /> : <UserPage/>}
      <MiniPlayer />
    </AudioManagerProvider>
  )
}

export default App
