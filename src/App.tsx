import UserPage from './components/UserPage';
import { AudioManagerProvider } from './components/AudioContextManager';
import MiniPlayer from './components/MiniPlayer';


function App() {
  // Берем первый моковый семпл для примера
  return (
    <AudioManagerProvider>
      <UserPage/>
      <MiniPlayer />
    </AudioManagerProvider>
  )
}

export default App
