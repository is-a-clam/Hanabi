import { GameTable } from './components/GameTable'
import Lobby from './components/Lobby'
import { GameProvider, useGame } from './store/GameContext'

function Shell() {
  const { phase } = useGame()
  if (phase === 'idle' || phase === 'connecting' || phase === 'lobby') {
    return <Lobby />
  }
  return <GameTable />
}

function App() {
  return (
    <GameProvider>
      <Shell />
      <footer
        className="pointer-events-none fixed bottom-4 right-4 z-10 text-sm text-gray-400 opacity-95 dark:text-gray-600"
        aria-hidden="true"
      >
        Created by Isaac Lam
      </footer>
    </GameProvider>
  )
}

export default App
