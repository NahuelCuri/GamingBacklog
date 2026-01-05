
import React, { useState, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import Header from './Header';

const GameSelectionModal = ({ isOpen, onClose, games = [], selectedIds, setSelectedIds, toggleSelection }) => {
    // Genre Filter State: Set of strings. Empty set means "All".
    const [selectedGenres, setSelectedGenres] = useState(new Set());

    const uniqueGenres = useMemo(() => {
        const genres = games.map(g => g.genre).filter(Boolean);
        return [...new Set(genres)].sort();
    }, [games]);

    const filteredGames = useMemo(() => {
        // If no genres selected, show all games
        if (selectedGenres.size === 0) return games;
        // Otherwise filter by selected genres
        return games.filter(g => selectedGenres.has(g.genre));
    }, [games, selectedGenres]);

    const toggleGenre = (genre) => {
        if (genre === 'All') {
            setSelectedGenres(new Set());
            return;
        }

        const newGenres = new Set(selectedGenres);
        const isActive = newGenres.has(genre);

        if (isActive) {
            newGenres.delete(genre);
            // DESELECT games of this genre
            const gamesToDeselect = games.filter(g => g.genre === genre);
            setSelectedIds(prev => {
                const next = new Set(prev);
                gamesToDeselect.forEach(g => next.delete(g.id));
                return next;
            });
        } else {
            newGenres.add(genre);
            // SELECT games of this genre
            const gamesToSelect = games.filter(g => g.genre === genre);
            setSelectedIds(prev => {
                const next = new Set(prev);
                gamesToSelect.forEach(g => next.add(g.id));
                return next;
            });
        }

        setSelectedGenres(newGenres);
    };

    // Prepare data helper for the row renderer
    const itemData = useMemo(() => ({
        games: filteredGames,
        selectedIds,
        toggleSelection
    }), [filteredGames, selectedIds, toggleSelection]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-background-dark flex flex-col animate-in fade-in duration-300">
            <style>
                {`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                `}
            </style>

            {/* Top Navigation - Standard Header + Modal specific close */}
            <div className="flex-none w-full bg-background-dark/95 backdrop-blur z-50">
                <Header activePage="picker" onNavigate={() => { }} onLogout={() => { }} />

                {/* Modal Specific Sub-header */}
                <div className="w-full border-b border-surface-dark px-4 sm:px-6 lg:px-8 py-2 flex justify-end">
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center px-4 py-1.5 rounded-lg bg-surface-dark text-text-muted hover:text-white hover:bg-surface-hover transition-colors border border-surface-hover group text-sm"
                    >
                        <span className="font-medium mr-2">Close Selection</span>
                        <span className="material-symbols-outlined text-lg group-hover:rotate-90 transition-transform">close</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area - Fixed Top Details + Virtualized List */}
            <div className="flex-grow flex flex-col min-h-0 w-full max-w-5xl mx-auto px-0 sm:px-6 relative">

                {/* Header & Filters Section (Static Top) */}
                <div className="flex-none pt-8 pb-4 px-4 sm:px-0">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">Library Selection</h2>
                            <p className="text-text-muted text-lg font-light">Filter and select games to add to your random picker pool.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div
                                onClick={() => {
                                    if (selectedIds.size === games.length) {
                                        setSelectedIds(new Set());
                                    } else {
                                        setSelectedIds(new Set(games.map(g => g.id)));
                                    }
                                }}
                                className="px-4 py-2 bg-surface-dark rounded-full border border-surface-hover flex items-center gap-2 cursor-pointer hover:bg-surface-hover group transition-colors"
                            >
                                <span className={`size-2 rounded-full animate-pulse ${selectedIds.size === 0 ? 'bg-red-500' : 'bg-primary'}`}></span>
                                <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">
                                    {selectedIds.size === games.length ? 'All' : selectedIds.size} Selected
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-background-dark/95 backdrop-blur-sm pb-4">
                        <div className="flex flex-col gap-4">
                            {/* Genre Dropdown & Filter - Simplified for this view, preserving pills */}
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                                <button
                                    onClick={() => {
                                        if (selectedIds.size === 0) {
                                            // Act as "Select All" if nothing selected
                                            setSelectedIds(new Set(games.map(g => g.id)));
                                        }
                                        toggleGenre('All');
                                    }}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm hover:opacity-90 transition-opacity whitespace-nowrap ${selectedGenres.size === 0 && selectedIds.size > 0
                                            ? 'bg-primary text-background-dark'
                                            : 'bg-surface-dark border border-surface-hover text-text-muted hover:bg-surface-hover hover:text-white'
                                        }`}
                                >
                                    {selectedGenres.size === 0 && selectedIds.size > 0 && <span className="material-symbols-outlined text-[18px]">check</span>}
                                    All Games
                                </button>

                                {uniqueGenres.map(genre => (
                                    <button
                                        key={genre}
                                        onClick={() => toggleGenre(genre)}
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm hover:opacity-90 transition-opacity whitespace-nowrap ${selectedGenres.has(genre)
                                                ? 'bg-primary text-background-dark font-bold'
                                                : 'bg-surface-dark border border-surface-hover text-text-muted hover:bg-surface-hover hover:text-white'
                                            }`}
                                    >
                                        {selectedGenres.has(genre) && <span className="material-symbols-outlined text-[18px]">check</span>}
                                        {genre}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* List Header */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 pb-2 text-sm font-medium text-text-muted uppercase tracking-wider">
                        <div className="col-span-5">Game Title</div>
                        <div className="col-span-3">Genre</div>
                        <div className="col-span-3">Tags</div>
                        {/* 'Include' header removed */}
                    </div>
                </div>

                {/* Virtualized List Container */}
                <div className="flex-grow min-h-0 w-full relative">
                    {filteredGames.length > 0 ? (
                        <AutoSizer>
                            {({ height, width }) => (
                                <List
                                    height={height}
                                    width={width}
                                    itemCount={filteredGames.length}
                                    itemData={itemData}
                                    itemSize={110}
                                    className="no-scrollbar pb-32"
                                >
                                    {GameRow}
                                </List>
                            )}
                        </AutoSizer>
                    ) : (
                        <div className="text-center py-12 text-text-muted">
                            No games match your filter.
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Action Bar - Fixed Bottom Overlay */}
            <div className="flex-none border-t border-surface-dark bg-background-dark/80 backdrop-blur p-6 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                    <div className="hidden sm:flex flex-col">
                        <span className="text-white font-bold text-sm">Selection Summary</span>
                        <span className="text-text-muted text-xs">{selectedIds.size} games included</span>
                    </div>
                    <button onClick={onClose} className="flex-1 sm:flex-none sm:w-auto min-w-[200px] h-14 bg-primary hover:bg-emerald-400 text-background-dark text-base font-bold rounded-full shadow-lg shadow-emerald-900/40 hover:shadow-emerald-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">save</span>
                        Save Selection
                    </button>
                </div>
            </div>
        </div>
    );
};

// Row Renderer pulled out to prevent re-creation
// Passing data via itemData context
const GameRow = ({ index, style, data }) => {
    const { games, selectedIds, toggleSelection } = data;
    const game = games[index];
    const isSelected = selectedIds.has(game.id);

    return (
        <div style={style} className="px-4 sm:px-6">
            <div className="max-w-5xl mx-auto h-full pt-3">
                <div
                    onClick={() => toggleSelection(game.id)}
                    className={`group relative bg-surface-dark hover:bg-surface-hover rounded-2xl p-4 transition-all duration-200 border cursor-pointer h-full flex items-center ${isSelected
                            ? 'border-violet-500 shadow-[0_0_15px_-3px_rgba(139,92,246,0.5)]' // Highlight style
                            : 'border-transparent hover:border-surface-hover shadow-sm opacity-60 hover:opacity-100'
                        }`}
                >
                    <div className="flex flex-col md:grid md:grid-cols-12 gap-4 items-center w-full pointer-events-none">
                        {/* Title Section */}
                        <div className="col-span-5 w-full flex items-center gap-4">
                            <div
                                className="size-12 md:size-14 shrink-0 rounded-xl bg-gray-700 bg-cover bg-center shadow-inner"
                                style={{ backgroundImage: `url('${game.cover_url || game.cover}')` }}
                            ></div>
                            <div className="flex flex-col">
                                <h3 className={`font-bold text-lg leading-tight transition-colors ${isSelected ? 'text-white' : 'text-text-muted group-hover:text-white'}`}>{game.title}</h3>
                                <p className="md:hidden text-sm text-text-muted mt-1">{game.genre}</p>
                            </div>
                        </div>
                        {/* Genre Section */}
                        <div className="col-span-3 w-full hidden md:flex">
                            <span className="px-3 py-1 rounded-full bg-[#272E38] text-emerald-400 text-xs font-semibold uppercase tracking-wide border border-emerald-500/10">
                                {game.genre}
                            </span>
                        </div>
                        {/* Tags Section */}
                        <div className="col-span-3 w-full hidden md:flex flex-wrap gap-2">
                            <span className="text-sm text-text-muted">Singleplayer</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameSelectionModal;
