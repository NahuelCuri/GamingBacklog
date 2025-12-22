import React, { useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import GameReviewModal from './GameReviewModal';
import EditGameModal from './EditGameModal';
import Header from './Header';

// --- Mock Data Generator ---
export const generateData = (count) => {
  const games = [
    { title: "Elden Ring", genre: "Action RPG", cover: "https://lh3.googleusercontent.com/aida-public/AB6AXuCKWSlmP0NF0S22cEVfRjp_EA8o-XFlNwwKKec727QBqV6Oalyp6dx2g8HgAfZcsDYYMb2xLvHuHhSPLHhNTggpqr_Dqs37TVIGDvnCsnx51k18JyoIliRp2htgR16dHRKbuAwSRLvj0RKfh8KfbBlvo06ehOBCq3MPos0G0jxgdmlAUwUzkTt1phM5WACxTXgvfyEoMfBj5WN6gRBMI4ho9AdEAfSkgKVAH5J-CB4Japk6hRdowH5HwxNfM8hORxvXn9yNOOWw-vM" },
    { title: "Baldur's Gate 3", genre: "CRPG", cover: "https://lh3.googleusercontent.com/aida-public/AB6AXuD_5ODb519KW-SnbzEnsTXZbApiyqHzrYVN6T1L-E8PmfExXToSz8dty00Iu5FXGejUy5UlihBjz2aZTfEZLtVU8CHlqm6xDUsVoyWoIAMjhVPlKhRFFrL9kKh8uW-OfO3r4l-K6S_BgCwx67I-XzDmEjh5EDpEkyuAfgD7yenyx2oU2ZYDfG3OXMfl-Fuow4c9OW5DHdUvI3qZUCx2cfbKzat-gjHS7fveGZ-LG9E-Dck5uBGQLQUtRkuFyPFNBPJoTHNTLWKW_JE" },
    { title: "Cyberpunk 2077", genre: "Open World", cover: "https://lh3.googleusercontent.com/aida-public/AB6AXuAsKoBJfNKF_fiNKGBx97yvjcQN5ZUuvxwN8oJjA-OzbFR2-AUbXM8DV2iezSYiE_nrW_s82ceE0EYhuaS7J2m2rO6PCXrDkdEX9YSOng3jMLxk6lt1TFBs_AXlLyyk6uOlxKK7w85oIITqZWHMLkFo_VmRdONvikTEV1OmopIEhLTCUrFWZk83oZ87GNPEDSnnaQwcuTPI-uu4XZGzQiyVBU4SNOJQ_Nqt2oU84Jf0NzdC7giyqj8vVHQKRIut5cymUhvo90t5pWsbzJBHg2EoBQB-6HrU" },
    { title: "Hades", genre: "Roguelike", cover: "https://lh3.googleusercontent.com/aida-public/AB6AXuBD8fiiEUTDHYDEx73C-1yXdyyDi0V8CDVSWbV1vvCx2Kho8JNKTbTRpD8qDT754GLO8LW35ipynecA-mh9uAZ7PWSyQDO0jlpbZ3AXFKUb0NvbaD4F4o0o9ktCt7Xb1P19yZMq-qEP5p6fgMrzso4yps85BQ8X1mNUOxxoZ87GNPEDSnnaQwcuTPI-uu4XZGzQiyVBU4SNOJQ_Nqt2oU84Jf0NzdC7giyqj8vVHQKRIut5cymUhvo90t5pWsbzJBHg2EoBQB-6HrU" },
    { title: "Stardew Valley", genre: "Simulation", cover: "https://lh3.googleusercontent.com/aida-public/AB6AXuBmB6lWVrvv7_4klzgtF5HXZmQA1NHp3kcEfOhMv5GJdFoelHWM8OzdbIe1R8yuQEKKMXFm5H_wG2_s9c6QaTtimQy3PQm3Ew7VatZ-SPXKnAzq8jWga6x5zAGveAo0bW9DQebwx-4_FFCUqnS9JX-eJz0OSiH57z6oPPKx2Hd3WfUvZSncvCtNVdWhMd1oLFPTCJ9mmhvEMDnXSaekEkWbH7o5vo63Y6Zi75LUb8gMUbVXcDbk-09bNYWbMZqJKfe5Lwnbc8Rbw3M" }
  ];
  const statuses = [
    { label: "Playing", color: "bg-violet-500" },
    { label: "Finished", color: "bg-primary" },
    { label: "Unplayed", color: "bg-slate-500" }
  ];

  return Array.from({ length: count }, (_, i) => {
    const game = games[i % games.length];
    const status = statuses[i % statuses.length];

    // Generate random date within last 2 years for finished games
    let dateFinished = null;
    if (status.label === 'Finished') {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 730));
      dateFinished = date.toISOString().split('T')[0];
    }

    return {
      id: i,
      title: `${game.title} ${i + 1}`,
      genre: game.genre,
      cover: game.cover,
      lastPlayed: `${Math.floor(Math.random() * 24)} hours ago`,
      status: status.label,
      statusColor: status.color,
      hours: Math.floor(Math.random() * 500),
      dateFinished: dateFinished,
      score: (Math.random() * 10).toFixed(1) // Random score 0.0 - 10.0
    };
  });
};

const Row = ({ index, style, data }) => {
  const { items, onRowClick, onDeleteClick } = data;
  const item = items ? items[index] : null;
  if (!item) return <div style={style}>Loading...</div>;

  return (
    <div style={style} className="px-1">
      <div
        className="group relative md:grid md:grid-cols-12 md:gap-4 items-center bg-white dark:bg-surface-dark p-4 sm:px-8 sm:py-5 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#1c222b] transition-all duration-300 shadow-sm border border-transparent hover:border-white/5 h-[90%] cursor-pointer hover:shadow-md hover:scale-[1.005]"
        onClick={() => onRowClick(item)}
      >
        {/* Title Column */}
        <div className="col-span-12 md:col-span-3 flex items-center gap-4 mb-4 md:mb-0">
          <div className="size-12 rounded-xl bg-cover bg-center shrink-0 shadow-lg" style={{ backgroundImage: `url("${item.cover}")` }}></div>
          <div>
            <h4 className="font-bold text-lg leading-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors">{item.title}</h4>
            <p className="text-xs text-slate-500 mt-0.5">Last played {item.lastPlayed}</p>
          </div>
        </div>
        {/* Genre Column */}
        <div className="col-span-6 md:col-span-2 flex items-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-slate-300 border border-white/5">
            {item.genre}
          </span>
        </div>

        {/* Date Finished Column */}
        <div className="col-span-6 md:col-span-2 flex items-center text-sm text-slate-400">
          {item.dateFinished ? (
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-600">event</span>
              {new Date(item.dateFinished).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          ) : (
            <span className="text-slate-600">-</span>
          )}
        </div>

        {/* Status Column */}
        <div className="col-span-6 md:col-span-2 flex items-center md:justify-start justify-end">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {item.status === 'Playing' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${item.status === 'Playing' ? 'bg-violet-500' :
                  item.status === 'Finished' ? 'bg-primary' :
                    'bg-slate-500'
                }`}></span>
            </span>
            <span className={`text-sm font-medium ${item.status === 'Playing' ? 'text-violet-500' :
              item.status === 'Finished' ? 'text-primary' :
                'text-slate-400'
              }`}>
              {item.status}
            </span>
          </div>
        </div>
        {/* Hours Column */}
        <div className="col-span-6 md:col-span-1 text-right mt-4 md:mt-0">
          <span className="font-display font-bold text-xl tabular-nums">{item.hours}<span className="text-xs text-slate-500 font-normal ml-1">h</span></span>
        </div>

        {/* Score Column */}
        <div className="col-span-6 md:col-span-1 flex items-center justify-end font-bold text-lg tabular-nums">
          <span className={`${parseFloat(item.score) >= 8 ? 'text-emerald-500' :
            parseFloat(item.score) >= 5 ? 'text-yellow-500' :
              'text-red-500'
            }`}>
            {item.score}
          </span>
        </div>

        {/* Action Column (Delete) */}
        <div className="hidden md:flex col-span-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-violet-500 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(item);
            }}
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardPage = ({ onNavigate, games, onUpdateGame, onDeleteGame }) => {
  const [selectedGame, setSelectedGame] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [gameToDelete, setGameToDelete] = useState(null);

  const handleRowClick = (game) => {
    setSelectedGame(game);
    setIsEditing(false);
  };

  const handleCloseModal = () => {
    setSelectedGame(null);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = (updatedGame) => {
    onUpdateGame(updatedGame);
    setSelectedGame(null);
    setIsEditing(false);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDeleteClick = (game) => {
    setGameToDelete(game);
  };

  const confirmDelete = () => {
    if (gameToDelete) {
      onDeleteGame(gameToDelete.id);
      setGameToDelete(null);
    }
  };

  const cancelDelete = () => {
    setGameToDelete(null);
  };

  const sortedGames = React.useMemo(() => {
    let sortableGames = [...games];
    if (sortConfig.key !== null) {
      sortableGames.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle string comparison (case-insensitive)
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableGames;
  }, [games, sortConfig]);

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return (
        <span className="material-symbols-outlined text-[16px] align-middle ml-1">
          {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col">
      {/* Top Navigation (Minimalist) */}
      {/* Top Navigation (Minimalist) */}
      <Header onNavigate={onNavigate} activePage="dashboard" />

      {/* Main Content Container */}
      <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-12 flex flex-col gap-16">
        {/* Hero Metric Section */}
        <section className="flex flex-col items-center justify-center text-center animate-fade-in-up shrink-0">
          <h1 className="text-slate-400 text-sm uppercase tracking-[0.2em] font-medium mb-4">Total Time Played</h1>
          <div className="text-7xl sm:text-9xl font-black text-primary tracking-tighter leading-none drop-shadow-2xl selection:bg-primary selection:text-white">
            3,482<span className="text-4xl sm:text-5xl align-top ml-2 opacity-60 font-bold text-white">h</span>
          </div>
          <div className="mt-6 flex gap-8 text-slate-500">
            <div className="flex flex-col items-center">
              <span className="text-white font-bold text-xl">142</span>
              <span className="text-xs">Games Owned</span>
            </div>
            <div className="w-px h-10 bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="text-white font-bold text-xl">78%</span>
              <span className="text-xs">Completion</span>
            </div>
            <div className="w-px h-10 bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="text-white font-bold text-xl">12</span>
              <span className="text-xs">Played</span>
            </div>
          </div>
        </section>

        {/* Data Table Section */}
        <section className="w-full flex flex-col h-screen min-h-screen">


          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium shrink-0">
            <div className="col-span-3 cursor-pointer hover:text-primary transition-colors flex items-center" onClick={() => handleSort('title')}>
              Game Title
            </div>
            <div className="col-span-2 cursor-pointer hover:text-primary transition-colors flex items-center" onClick={() => handleSort('genre')}>
              Genre
            </div>
            <div className="col-span-2 cursor-pointer hover:text-primary transition-colors flex items-center" onClick={() => handleSort('dateFinished')}>
              Date Completed
            </div>
            <div className="col-span-2 cursor-pointer hover:text-primary transition-colors flex items-center" onClick={() => handleSort('status')}>
              Status
            </div>
            <div className="col-span-1 text-right cursor-pointer hover:text-primary transition-colors flex items-center justify-end" onClick={() => handleSort('hours')}>
              Hours
            </div>
            <div className="col-span-1 text-right cursor-pointer hover:text-primary transition-colors flex items-center justify-end" onClick={() => handleSort('score')}>
              Score
            </div>
            <div className="col-span-1 text-right"></div>
          </div>

          {/* Virtualized Table Rows Container */}
          <div className="flex-1 w-full h-full">
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  width={width}
                  itemCount={sortedGames.length}
                  itemSize={110}
                  itemData={{ items: sortedGames, onRowClick: handleRowClick, onDeleteClick: handleDeleteClick }}
                >
                  {Row}
                </List>
              )}
            </AutoSizer>
          </div>
        </section>
      </main>

      {/* Simple Footer */}
      <footer className="w-full py-8 text-center text-xs text-slate-600 dark:text-slate-500 shrink-0">
        <p>© 2024 NexusDB. All statistics are updated in real-time.</p>
      </footer>

      {/* Game Review Modal */}
      {!isEditing && (
        <GameReviewModal
          isOpen={!!selectedGame}
          onClose={handleCloseModal}
          game={selectedGame}
          onEdit={handleEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {gameToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-sm transition-opacity" onClick={cancelDelete}></div>
          <div className="relative bg-surface-dark border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 max-w-sm w-full animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-2">Delete Game?</h3>
            <p className="text-slate-400 mb-6">
              Are you sure you want to remove <span className="text-white font-medium">{gameToDelete.title}</span> from your backlog? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-full text-slate-300 hover:bg-white/5 transition-colors font-medium text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all font-medium text-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Game Modal */}
      <EditGameModal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        game={selectedGame}
        onSave={handleSave}
      />
    </div>
  );
};

export default DashboardPage;