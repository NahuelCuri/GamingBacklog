
import React, { useState, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const GameSelectionModal = ({ isOpen, onClose, games = [] }) => {
    const [selectedGenre, setSelectedGenre] = useState('All');

    const uniqueGenres = useMemo(() => {
        const genres = games.map(g => g.genre).filter(Boolean);
        return [...new Set(genres)].sort();
    }, [games]);

    const filteredGames = useMemo(() => {
        if (selectedGenre === 'All') return games;
        return games.filter(g => g.genre === selectedGenre);
    }, [games, selectedGenre]);

    if (!isOpen) return null;

    const Row = ({ index, style }) => {
        const game = filteredGames[index];
        // Adjust style to account for margins/gutters if needed
        return (
            <div style={style} className="px-4 sm:px-6">
                <div className="max-w-5xl mx-auto h-full pt-3">
                    <div className="group relative bg-surface-dark hover:bg-surface-hover rounded-2xl p-4 transition-all duration-200 border border-transparent hover:border-surface-hover shadow-sm h-full flex items-center">
                        <div className="flex flex-col md:grid md:grid-cols-12 gap-4 items-center w-full">
                            {/* Title Section */}
                            <div className="col-span-5 w-full flex items-center gap-4">
                                <div
                                    className="size-12 md:size-14 shrink-0 rounded-xl bg-gray-700 bg-cover bg-center shadow-inner"
                                    style={{ backgroundImage: `url('${game.cover_url || game.cover}')` }}
                                ></div>
                                <div className="flex flex-col">
                                    <h3 className="text-white font-bold text-lg leading-tight group-hover:text-primary transition-colors">{game.title}</h3>
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
                            {/* Action Toggle */}
                            <div className="col-span-1 w-full flex justify-end">
                                <label className="flex items-center cursor-pointer relative" htmlFor={`toggle-${game.id || index}`}>
                                    <input defaultChecked className="sr-only peer" id={`toggle-${game.id || index}`} type="checkbox" />
                                    <div className="w-11 h-6 bg-[#272E38] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background-dark flex flex-col animate-in fade-in duration-300">
            <style>
                {`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                `}
            </style>

            {/* Top Navigation - Fixed */}
            <header className="flex-none w-full border-b border-surface-dark bg-background-dark/95 backdrop-blur z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-primary text-white shadow-lg shadow-emerald-900/20">
                                <span className="material-symbols-outlined text-2xl">casino</span>
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-white">Randomizer<span className="text-primary">Pro</span></h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="flex items-center justify-center px-4 py-2 rounded-lg bg-surface-dark text-text-muted hover:text-white hover:bg-surface-hover transition-colors border border-surface-hover group"
                            >
                                <span className="text-sm font-medium mr-2">Close</span>
                                <span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform">close</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

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
                            <div className="px-4 py-2 bg-surface-dark rounded-full border border-surface-hover flex items-center gap-2">
                                <span className="size-2 rounded-full bg-primary animate-pulse"></span>
                                <span className="text-sm font-medium text-white">{filteredGames.length} Selected</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-background-dark/95 backdrop-blur-sm pb-4">
                        <div className="flex flex-col gap-4">
                            {/* Genre Dropdown & Filter - Simplified for this view, preserving pills */}
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                                <button
                                    onClick={() => setSelectedGenre('All')}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm hover:opacity-90 transition-opacity whitespace-nowrap ${selectedGenre === 'All'
                                            ? 'bg-primary text-background-dark'
                                            : 'bg-surface-dark border border-surface-hover text-text-muted hover:bg-surface-hover hover:text-white'
                                        }`}
                                >
                                    {selectedGenre === 'All' && <span className="material-symbols-outlined text-[18px]">check</span>}
                                    All Games
                                </button>

                                {uniqueGenres.map(genre => (
                                    <button
                                        key={genre}
                                        onClick={() => setSelectedGenre(genre)}
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm hover:opacity-90 transition-opacity whitespace-nowrap ${selectedGenre === genre
                                                ? 'bg-primary text-background-dark font-bold'
                                                : 'bg-surface-dark border border-surface-hover text-text-muted hover:bg-surface-hover hover:text-white'
                                            }`}
                                    >
                                        {selectedGenre === genre && <span className="material-symbols-outlined text-[18px]">check</span>}
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
                        <div className="col-span-1 text-right">Include</div>
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
                                    itemSize={110} // Approx height of card (88px) + gap/padding
                                    className="no-scrollbar pb-32"
                                >
                                    {Row}
                                </List>
                            )}
                        </AutoSizer>
                    ) : (
                        <div className="text-center py-12 text-text-muted">
                            No games match your filter.
                        </div>
                    )}

                    {/* Floating space reserved visually at bottom for the bar if needed, handled by pb-32 in List but that might not work on List directly if it clips */}
                    {/* Because FixedSizeList clips, pb-32 on className only affects the container. We need an itemSpacer or just accept the overlay. */}
                    {/* Usually we use `paddingBottom` in innerElementType for react-window. */}
                </div>
            </div>

            {/* Floating Action Bar - Fixed Bottom Overlay */}
            <div className="flex-none border-t border-surface-dark bg-background-dark/80 backdrop-blur p-6 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                    <div className="hidden sm:flex flex-col">
                        <span className="text-white font-bold text-sm">Selection Summary</span>
                        <span className="text-text-muted text-xs">{filteredGames.length} games included</span>
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

export default GameSelectionModal;
