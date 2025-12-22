import { useState } from 'react'
import LoginPage from './components/LoginPage'
import DashboardPage from './components/DashboardPage'
import RandomPickerPage from './components/RandomPickerPage'

function App() {
  const [view, setView] = useState('login'); // 'login', 'dashboard', 'picker'

  const handleLogin = () => setView('dashboard');
  const handleNavigate = (targetView) => setView(targetView);

  return (
    <div className={view === 'login' ? "min-h-screen flex items-center justify-center p-4" : ""}>
      {view === 'login' && <LoginPage onLogin={handleLogin} />}
      {view === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
      {view === 'picker' && <RandomPickerPage onNavigate={handleNavigate} />}
    </div>
  )
}

export default App