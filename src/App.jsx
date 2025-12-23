import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import DashboardPage from './components/DashboardPage'
import RandomPickerPage from './components/RandomPickerPage'
import StatisticsPage from './components/StatisticsPage'
import { getUsers, createUser, getGames, createGame, updateGame, deleteGame } from './services/api'

function App() {
  const [view, setView] = useState('login'); // 'login', 'dashboard', 'picker', 'statistics'
  const [games, setGames] = useState([]);
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  useEffect(() => {
    const initData = async () => {
      try {
        // Quick check for existing token to skip to dashboard
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
          setView('dashboard');
          setToken(storedToken);
        }

        // User setup
        let users = await getUsers();
        let currentUser;
        if (!users || users.length === 0) {
          try {
            console.log("No users found, creating default user...");
            currentUser = await createUser({
              username: "default_gamer",
              email: "gamer@example.com",
              password: "password123"
            });
            if (currentUser && currentUser.token) {
              localStorage.setItem('token', currentUser.token);
              setToken(currentUser.token);
              setView('dashboard'); // Ensure view is updated for new users too
            }
          } catch (err) {
            console.warn("User creation failed (likely exists), attempting to fetch again...");
            // Retry fetch in case of race condition or duplicate error
            users = await getUsers();
            if (users && users.length > 0) {
              currentUser = users.find(u => u.email === "gamer@example.com") || users[0];
            }
          }
        } else {
          // If we have users, try to find the one matching the token if possible, or just default to first
          // In a real app we'd call /me. Here we just pick one.
          currentUser = users[0];
        }

        if (currentUser) {
          setUserId(currentUser.id);
        }

        // Games setup
        const fetchedGames = await getGames();
        if (fetchedGames) {
          const mappedGames = fetchedGames.map(g => ({
            id: g.id,
            title: g.title,
            genre: g.genre,
            cover: g.cover_url || g.cover, // Fallback
            lastPlayed: 'Recently', // Placeholder
            status: g.status.charAt(0).toUpperCase() + g.status.slice(1),
            statusColor: g.status === 'playing' ? 'bg-violet-500' : (g.status === 'finished' ? 'bg-primary' : 'bg-slate-500'),
            hours: g.hours_played,
            dateFinished: null, // Placeholder
            score: g.score,
            releaseYear: g.release_year,
            review: g.review_text,
            hltb: g.hltb_estimate,
            vibes: g.Tags ? g.Tags.map(t => t.name) : []
          }));
          setGames(mappedGames);
        }
      } catch (err) {
        console.error("Failed to initialize data:", err);
      }
    };
    initData();
  }, []);

  const handleLogin = (user) => {
    if (user) {
      if (user.token) {
        localStorage.setItem('token', user.token);
        setToken(user.token);
      }
      if (user.id) {
        setUserId(user.id);
      }
    }
    setView('dashboard');
  };
  const handleNavigate = (targetView) => setView(targetView);

  const handleCreateGame = async (newGame) => {
    // Optimistic update - generate a temporary ID
    const tempId = `temp-${Date.now()}`;
    const gameWithTempId = { ...newGame, id: tempId };
    setGames(prevGames => [gameWithTempId, ...prevGames]);

    try {
      const createdGame = await createGame({
        user_id: userId,
        title: newGame.title,
        status: newGame.status.toLowerCase(),
        hours_played: parseInt(newGame.hours),
        score: parseFloat(newGame.score),
        genre: newGame.genre,
        review_text: newGame.review,
        hltb_estimate: parseInt(newGame.hltb) || 0,
        cover_url: newGame.cover,
        tag_ids: [] // Tags not yet supported in UI creation
      });
      // Replace temp game with real game
      setGames(prevGames => prevGames.map(g => g.id === tempId ? {
        id: createdGame.id,
        title: createdGame.title,
        genre: createdGame.genre,
        cover: createdGame.cover_url || createdGame.cover,
        lastPlayed: 'Recently',
        status: createdGame.status.charAt(0).toUpperCase() + createdGame.status.slice(1),
        statusColor: createdGame.status === 'playing' ? 'bg-violet-500' : (createdGame.status === 'finished' ? 'bg-primary' : 'bg-slate-500'),
        hours: createdGame.hours_played,
        dateFinished: null,
        score: createdGame.score,
        releaseYear: createdGame.release_year,
        review: createdGame.review_text,
        hltb: createdGame.hltb_estimate,
        vibes: []
      } : g));
    } catch (err) {
      console.error("Failed to create game:", err);
      // Revert optimistic update
      setGames(prevGames => prevGames.filter(g => g.id !== tempId));
    }
  };

  const handleUpdateGame = async (updatedGame) => {
    // Optimistic update
    setGames(prevGames => prevGames.map(game => game.id === updatedGame.id ? updatedGame : game));

    try {
      await updateGame(updatedGame.id, {
        title: updatedGame.title,
        status: updatedGame.status.toLowerCase(),
        hours_played: parseInt(updatedGame.hours),
        score: parseFloat(updatedGame.score),
        genre: updatedGame.genre,
        review_text: updatedGame.review,
        hltb_estimate: parseInt(updatedGame.hltb) || 0,
        cover_url: updatedGame.cover
        // Tags/vibes update is skipped for now as it requires ID management
      });
    } catch (err) {
      console.error("Failed to update game:", err);
      // Ideally revert state here
    }
  };

  const handleDeleteGame = async (gameId) => {
    setGames(prevGames => prevGames.filter(game => game.id !== gameId));
    try {
      await deleteGame(gameId);
    } catch (err) {
      console.error("Failed to delete game:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUserId(null);
    setView('login');
  };

  return (
    <div className={view === 'login' ? "min-h-screen flex items-center justify-center p-4" : ""}>
      {view === 'login' && <LoginPage onLogin={handleLogin} />}
      {view === 'dashboard' && <DashboardPage onNavigate={handleNavigate} onLogout={handleLogout} games={games} onCreateGame={handleCreateGame} onUpdateGame={handleUpdateGame} onDeleteGame={handleDeleteGame} />}
      {view === 'picker' && <RandomPickerPage onNavigate={handleNavigate} onLogout={handleLogout} games={games} />}
      {view === 'statistics' && <StatisticsPage onNavigate={handleNavigate} onLogout={handleLogout} games={games} />}
    </div>
  )
}

export default App