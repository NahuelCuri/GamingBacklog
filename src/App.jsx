import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import RandomPickerPage from './components/RandomPickerPage';
import StatisticsPage from './components/StatisticsPage';
import RegisterPage from './components/RegisterPage';
import AdminUsersPage from './components/AdminUsersPage';
import { login, logout, setUser, setToken } from './store/slices/authSlice';
import { fetchGames, addNewGame, updateExistingGame, removeGame } from './store/slices/gamesSlice';
import { setView } from './store/slices/uiSlice';
import { getUsers } from './services/api';

function App() {
  const dispatch = useDispatch();
  const view = useSelector((state) => state.ui.view);
  const games = useSelector((state) => state.games.items);
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);

  useEffect(() => {
    const initData = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken) {
        dispatch(setToken(storedToken));
        if (storedUser) {
          try {
            dispatch(setUser(JSON.parse(storedUser)));
          } catch (e) {
            console.error("Failed to parse stored user", e);
          }
        }
        dispatch(setView('dashboard'));
      }

      dispatch(fetchGames());
    };
    initData();
  }, [dispatch]);

  const handleLogin = (user) => {
    // Assuming LoginPage returns the user object after successful API call
    // We update the Redux store directly.
    if (user.token) {
      dispatch(setToken(user.token));
      localStorage.setItem('token', user.token);
    }
    dispatch(setUser(user));
    // Persist user details to support page reloads
    localStorage.setItem('user', JSON.stringify(user));

    dispatch(fetchGames());
    dispatch(setView('dashboard'));
  };

  const handleLogout = () => {
    dispatch(logout());
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch(setView('login'));
  };

  const handleNavigate = (targetView) => dispatch(setView(targetView));

  const handleCreateGame = (newGame) => {
    // Construct payload expecting user.id might be derived or check store
    // Note: If user refreshed page, user object in store might be null unless we fetched it.
    // But we have the token.

    const gamePayload = {
      user_id: user?.id,
      title: newGame.title,
      status: newGame.status.toLowerCase(),
      hours_played: parseInt(newGame.hours),
      score: parseFloat(newGame.score),
      genre: newGame.genre,
      review_text: newGame.review,
      hltb_estimate: parseInt(newGame.hltb) || 0,
      cover_url: newGame.cover,
      platform: newGame.platform,
      tag_ids: []
    };

    dispatch(addNewGame(gamePayload));
  };

  const handleUpdateGame = (updatedGame) => {
    const gamePayload = {
      title: updatedGame.title,
      status: updatedGame.status.toLowerCase(),
      hours_played: parseInt(updatedGame.hours),
      score: parseFloat(updatedGame.score),
      genre: updatedGame.genre,
      review_text: updatedGame.review,
      hltb_estimate: parseInt(updatedGame.hltb) || 0,
      cover_url: updatedGame.cover,
      platform: updatedGame.platform
    };
    dispatch(updateExistingGame({ id: updatedGame.id, data: gamePayload }));
  };

  const handleDeleteGame = (gameId) => {
    dispatch(removeGame(gameId));
  };

  return (
    <div className={(view === 'login' || view === 'register') ? "min-h-screen flex items-center justify-center p-4" : ""}>
      {view === 'login' && <LoginPage onLogin={handleLogin} onNavigate={handleNavigate} />}
      {view === 'register' && <RegisterPage onRegister={handleLogin} onNavigate={handleNavigate} />}
      {view === 'dashboard' && <DashboardPage onNavigate={handleNavigate} onLogout={handleLogout} games={games} onCreateGame={handleCreateGame} onUpdateGame={handleUpdateGame} onDeleteGame={handleDeleteGame} />}
      {view === 'picker' && <RandomPickerPage onNavigate={handleNavigate} onLogout={handleLogout} games={games} />}
      {view === 'statistics' && <StatisticsPage onNavigate={handleNavigate} onLogout={handleLogout} games={games} />}
      {view === 'admin-users' && <AdminUsersPage onNavigate={handleNavigate} onLogout={handleLogout} />}
    </div>
  )
}

export default App