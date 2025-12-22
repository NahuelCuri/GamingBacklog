import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import DashboardPage, { generateData } from './components/DashboardPage'
import RandomPickerPage from './components/RandomPickerPage'

function App() {
  const [view, setView] = useState('login'); // 'login', 'dashboard', 'picker'
  const [games, setGames] = useState([]);

  useEffect(() => {
    // Initialize data
    setGames(generateData(50));
  }, []);

  const handleLogin = () => setView('dashboard');
  const handleNavigate = (targetView) => setView(targetView);

  const handleUpdateGame = (updatedGame) => {
    setGames(prevGames => prevGames.map(game => game.id === updatedGame.id ? updatedGame : game));
  };

  return (
    <div className={view === 'login' ? "min-h-screen flex items-center justify-center p-4" : ""}>
      {view === 'login' && <LoginPage onLogin={handleLogin} />}
      {view === 'dashboard' && <DashboardPage onNavigate={handleNavigate} games={games} onUpdateGame={handleUpdateGame} />}
      {view === 'picker' && <RandomPickerPage onNavigate={handleNavigate} games={games} />}
    </div>
  )
}

export default App