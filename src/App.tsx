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
    </GameProvider>
  )
}

export default App
