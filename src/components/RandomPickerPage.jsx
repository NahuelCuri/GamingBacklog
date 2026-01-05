
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Header from './Header';
import GameSelectionModal from './GameSelectionModal';

const RandomPickerPage = ({ onNavigate, games }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [winner, setWinner] = useState(null);
    const [offset, setOffset] = useState(0);
    const [items, setItems] = useState([]);
    const [showSelectionModal, setShowSelectionModal] = useState(false);

    // Pool Selection State (Lifted from Modal)
    const [selectedIds, setSelectedIds] = useState(new Set());
    const initializedRef = useRef(false);

    // Initialize selection when games load
    useEffect(() => {
        if (games && games.length > 0 && !initializedRef.current) {
            setSelectedIds(new Set(games.map(g => g.id)));
            initializedRef.current = true;
        }
    }, [games]);

    const activeGames = useMemo(() => {
        if (!games) return [];
        return games.filter(g => selectedIds.has(g.id));
    }, [games, selectedIds]);

    const toggleGameSelection = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Config
    const CARD_WIDTH = 200;
    const CARD_GAP = 16;
    const TOTAL_ITEMS = 80;
    const WINNER_INDEX = 65;
    const START_INDEX = 5;
    const lastJitterRef = useRef(0);

    // Re-generate strip when ACTIVE games change (and not spinning)
    // Avoid regenerating during spin though? 
    // If spin is active, we shouldn't change items. 
    // But user can't change selection while spinning (modal closed).
    useEffect(() => {
        if (!isSpinning) {
            generateStrip(null);
        }
    }, [activeGames, isSpinning]);

    const generateStrip = (forcedWinner) => {
        if (activeGames.length === 0) {
            setItems([]);
            return;
        }

        const contentCandidates = [...activeGames];
        const newWinner = forcedWinner || contentCandidates[Math.floor(Math.random() * contentCandidates.length)];

        const newItems = new Array(TOTAL_ITEMS).fill(null).map((_, i) => {
            if (i === WINNER_INDEX) return newWinner;
            return contentCandidates[Math.floor(Math.random() * contentCandidates.length)];
        });

        setItems(newItems);
        setOffset(0);
    };

    const handleSpin = () => {
        if (isSpinning || activeGames.length === 0) return;

        const contentCandidates = [...activeGames];
        const nextWinner = contentCandidates[Math.floor(Math.random() * contentCandidates.length)];

        const newItems = new Array(TOTAL_ITEMS).fill(null).map((_, i) => {
            if (winner && i === START_INDEX) return winner;
            if (i === WINNER_INDEX) return nextWinner;
            return contentCandidates[Math.floor(Math.random() * contentCandidates.length)];
        });

        let resetOffset = 0;
        const itemStride = CARD_WIDTH + CARD_GAP;

        if (winner) {
            const oldJitter = lastJitterRef.current;
            resetOffset = -(START_INDEX * itemStride) - (CARD_WIDTH / 2) + oldJitter;
        }

        setIsSpinning(false);
        setWinner(null);
        setItems(newItems);
        setOffset(resetOffset);

        setTimeout(() => {
            setIsSpinning(true);
            const newJitter = (Math.random() * CARD_WIDTH * 0.8) - (CARD_WIDTH * 0.4);
            lastJitterRef.current = newJitter;
            const targetPos = -(WINNER_INDEX * itemStride) - (CARD_WIDTH / 2) + newJitter;
            setOffset(targetPos);

            setTimeout(() => {
                setIsSpinning(false);
                setWinner(nextWinner);
            }, 6500);
        }, 100);
    };

    return (
        <div className="bg-background-dark text-white font-display overflow-x-hidden min-h-screen flex flex-col">
            <Header onNavigate={onNavigate} activePage="picker" />

            <main className="flex-grow flex flex-col items-center justify-center relative w-full overflow-hidden">

                {/* Headline */}
                <div className="absolute top-20 md:top-32 z-10 text-center animate-in slide-in-from-top-4 duration-700">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-2 drop-shadow-lg">
                        Random Game Picker
                    </h1>
                </div>

                {/* The Scroller Window */}
                <div className="relative w-full h-[300px] bg-background-dark border-y-4 border-white/5 flex items-center shadow-2xl mb-12">

                    {/* Center Marker / Line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[4px] bg-primary z-30 shadow-neon transform -translate-x-1/2"></div>
                    <div className="absolute left-1/2 top-4 -translate-x-1/2 z-30 text-primary">
                        <span className="material-symbols-outlined text-4xl drop-shadow-md">arrow_drop_down</span>
                    </div>
                    <div className="absolute left-1/2 bottom-4 -translate-x-1/2 z-30 text-primary">
                        <span className="material-symbols-outlined text-4xl drop-shadow-md">arrow_drop_up</span>
                    </div>

                    {/* Gradient Fade Edges */}
                    <div className="absolute inset-y-0 left-0 w-64 bg-gradient-to-r from-background-dark to-transparent z-20 pointer-events-none"></div>
                    <div className="absolute inset-y-0 right-0 w-64 bg-gradient-to-l from-background-dark to-transparent z-20 pointer-events-none"></div>

                    {/* Sliding Rail */}
                    <div
                        className="flex items-center gap-4 pl-[50%] will-change-transform"
                        style={{
                            transform: `translateX(${offset}px)`,
                            transition: isSpinning ? 'transform 6.5s cubic-bezier(0.1, 0.05, 0.1, 1)' : 'none',
                        }}
                    >
                        {items.length > 0 ? items.map((item, index) => (
                            <div
                                key={index}
                                className={`relative shrink-0 w-[200px] h-[200px] rounded-lg overflow-hidden border-2 transition-all duration-300 ${index === WINNER_INDEX && !isSpinning && winner
                                    ? 'border-primary shadow-neon-strong scale-110 z-10'
                                    : 'border-white/10 bg-surface-dark'
                                    }`}
                            >
                                {item ? (
                                    <>
                                        <div
                                            className="absolute inset-0 bg-cover bg-center"
                                            style={{ backgroundImage: `url("${item.cover}")` }}
                                        ></div>
                                        <div className="absolute inset-x-0 bottom-0 bg-black/80 p-3 text-center">
                                            <p className="text-sm font-bold truncate text-gray-200">{item.title}</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                                        ?
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className="absolute left-1/2 -translate-x-1/2 text-text-muted text-lg">
                                No games in pool. Add some below!
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-center gap-4 z-10 mt-8">
                    <button
                        onClick={handleSpin}
                        disabled={isSpinning || activeGames.length === 0}
                        className="group relative px-12 py-4 bg-primary hover:bg-green-400 text-white font-black text-xl tracking-widest uppercase skew-x-[-12deg] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-neon hover:shadow-neon-strong"
                    >
                        <span className="block skew-x-[12deg]">
                            {isSpinning ? 'Rolling...' : 'Roll Pool'}
                        </span>
                    </button>

                    {!isSpinning && (
                        <p
                            className={`text-xs font-mono cursor-pointer transition-all duration-200 ${activeGames.length === 0
                                ? 'text-violet-500 animate-pulse drop-shadow-[0_0_8px_rgba(139,92,246,0.5)] font-bold scale-110'
                                : 'text-slate-500 hover:text-primary'
                                }`}
                            onClick={() => setShowSelectionModal(true)}
                        >
                            {games ? `${activeGames.length} games in the pool` : 'Loading...'}
                        </p>
                    )}
                </div>

                {/* Winner Reveal Modal (Optional, or just display inline) */}
                {winner && !isSpinning && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
                        <div className="bg-surface-dark border border-primary/30 p-8 rounded-xl max-w-md w-full text-center shadow-2xl transform scale-100 animate-in zoom-in-95 duration-300">
                            <h2 className="text-3xl font-bold text-primary mb-2 uppercase tracking-tight">Item Acquired</h2>
                            <div className="my-6 relative inline-block">
                                <div className="w-48 h-64 bg-cover bg-center rounded-lg shadow-lg" style={{ backgroundImage: `url("${winner.cover}")` }}></div>
                                <div className="absolute -inset-4 bg-primary/20 blur-xl -z-10 rounded-full"></div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1">{winner.title}</h3>
                            <p className="text-gray-400 mb-8">{winner.genre}</p>

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setWinner(null)}
                                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded font-bold transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setWinner(null);
                                        // Optional: trigger spin again immediately? 
                                        // handleSpin(); 
                                    }}
                                    className="px-6 py-2 bg-primary hover:bg-green-400 text-white rounded font-bold transition-colors shadow-neon"
                                >
                                    Review Game
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>

            <GameSelectionModal
                isOpen={showSelectionModal}
                onClose={() => setShowSelectionModal(false)}
                games={games}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                toggleSelection={toggleGameSelection}
            />
        </div>
    );
};

export default RandomPickerPage;
