
import React, { useState, useRef, useEffect } from 'react';
import Header from './Header';

const RandomPickerPage = ({ onNavigate, games }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [winner, setWinner] = useState(null);
    const [offset, setOffset] = useState(0);
    const [items, setItems] = useState([]);

    // Config
    const CARD_WIDTH = 200; // Width of one game card
    const CARD_GAP = 16;   // Gap between cards
    const VISIBLE_ITEMS = 5; // How many items visible at once (approx)
    // The exact center position pixels (will be calculated)

    // We need a long strip. Let's say 70 items. Winner is at index 60.
    // That gives plenty of spin time.
    const TOTAL_ITEMS = 80;
    const WINNER_INDEX = 65;

    // Initialize the "strip" of games
    useEffect(() => {
        if (games && games.length > 0) {
            generateStrip(null);
        }
    }, [games]);

    const generateStrip = (forcedWinner) => {
        if (!games || games.length === 0) return;

        // Pick a winner if not provided
        const contentCandidates = [...games]; // can filter if needed
        const newWinner = forcedWinner || contentCandidates[Math.floor(Math.random() * contentCandidates.length)];

        // Fill the strip with random games
        // We want the winner specifically at WINNER_INDEX
        const newItems = new Array(TOTAL_ITEMS).fill(null).map((_, i) => {
            if (i === WINNER_INDEX) return newWinner;
            return contentCandidates[Math.floor(Math.random() * contentCandidates.length)];
        });

        setItems(newItems);
        // Reset position: Start a bit before the beginning so it looks full
        // Actually, we want to start at index 0 roughly aligned.
        // Let's say we center align index 2 initially.
        setOffset(0);
    };

    const handleSpin = () => {
        if (isSpinning || items.length === 0) return;

        setIsSpinning(true);
        setWinner(null);

        // Pick a NEW winner and regenerate the strip behind the scenes? 
        // Actually, CS:GO roulette usually pre-determines the winner, then generates the layout.
        // So let's pick a winner NOW.
        const contentCandidates = [...games];
        const nextWinner = contentCandidates[Math.floor(Math.random() * contentCandidates.length)];

        // Re-generate strip with this winner at WINNER_INDEX
        // BUT visually we might jump if we just replace the array. 
        // Ideally we are at "position 0" or we reset to "position 0" instantly before spinning.
        // Let's generate and reset.

        const newItems = new Array(TOTAL_ITEMS).fill(null).map((_, i) => {
            if (i === WINNER_INDEX) return nextWinner;
            return contentCandidates[Math.floor(Math.random() * contentCandidates.length)];
        });
        setItems(newItems);
        setOffset(0); // Reset to start

        // Small delay to ensure render, then spin
        setTimeout(() => {
            // Calculate target pixel offset
            // We want WINNER_INDEX centered.
            // Center of container (assuming partial container width or full width with translation)
            // Let's say our "window" is effectively centered. 
            // The strip moves LEFT.
            // To center item W:
            // Offset = (W * (WIDTH + GAP)) - (WindowWidth / 2) + (CardWidth / 2)
            // But implementing randomly slight offset for "suspense" (landing on the line vs middle)

            // Random jitter: +/- 40% of card width
            const jitter = (Math.random() * CARD_WIDTH * 0.8) - (CARD_WIDTH * 0.4);

            // We want to scroll until the winner is centered.
            // Since we translate the STRIP to the left, target is negative.
            // We assume the strip starts with Item 0 at left-most edge of container.
            // So we need to shift left by: (WINNER_INDEX * (CARD_WIDTH + GAP))
            // But we want it centered in the viewport.
            // Let's ignore viewport calculation here and rely on CSS centering the "window" 
            // and us centering the item *relative to the window center*.
            // Actually, simpler:
            // TranslateX = - (WINNER_INDEX * (CARD_WIDTH + GAP)) + jitter
            // Then add a "half window" offset if the container is full width.
            // Let's do it purely relative to the arrow.

            const itemStride = CARD_WIDTH + CARD_GAP;
            const targetPos = -(WINNER_INDEX * itemStride) + jitter;

            setOffset(targetPos);

            // Time matches the CSS transition
            setTimeout(() => {
                setIsSpinning(false);
                setWinner(nextWinner);
            }, 6500); // 6.5s spin time
        }, 50);
    };

    const containerRef = useRef(null);
    // Center compensation:
    // We want index 0 to initially sit such that... actually let's just use flex center.
    // If the strip is in a container that is centered, 
    // and we align the "Current Point" to the center of the screen.
    // We need to shift the whole strip so that start index is at the arrow? 
    // No, usually start index is visible on the left and we scroll right-to-left.
    // Let's assume the "Arrow" is at the exact center of the screen.
    // We need to offset the strip by + (ScreenCenter) initially?
    // Let's handle this by adding a "padder" to the strip or using CSS calc.

    return (
        <div className="bg-background-dark text-white font-display overflow-x-hidden min-h-screen flex flex-col">
            <Header onNavigate={onNavigate} activePage="picker" />

            <main className="flex-grow flex flex-col items-center justify-center relative w-full overflow-hidden">

                {/* Headline */}
                <div className="absolute top-20 md:top-32 z-10 text-center animate-in slide-in-from-top-4 duration-700">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-2 drop-shadow-lg">
                        Mystery Game
                    </h1>
                    <p className="text-gray-400 text-sm md:text-base font-light tracking-widest uppercase">
                        Case Opening
                    </p>
                </div>

                {/* The Scroller Window */}
                <div className="relative w-full max-w-[1400px] h-[300px] bg-background-dark border-y-4 border-white/5 flex items-center shadow-2xl mb-12">

                    {/* Center Marker / Line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[4px] bg-primary z-30 shadow-neon transform -translate-x-1/2"></div>
                    <div className="absolute left-1/2 top-4 -translate-x-1/2 z-30 text-primary">
                        <span className="material-symbols-outlined text-4xl drop-shadow-md">arrow_drop_down</span>
                    </div>
                    <div className="absolute left-1/2 bottom-4 -translate-x-1/2 z-30 text-primary">
                        <span className="material-symbols-outlined text-4xl drop-shadow-md">arrow_drop_up</span>
                    </div>

                    {/* Gradient Fade Edges */}
                    <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background-dark to-transparent z-20 pointer-events-none"></div>
                    <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background-dark to-transparent z-20 pointer-events-none"></div>

                    {/* Sliding Rail */}
                    <div
                        className="flex items-center gap-4 px-[50vw] will-change-transform"
                        style={{
                            transform: `translateX(${offset}px)`,
                            transition: isSpinning ? 'transform 6.5s cubic-bezier(0.1, 0.05, 0.1, 1)' : 'none',
                        }}
                    >
                        {items.map((item, index) => (
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
                        ))}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-center gap-4 z-10 mt-8">
                    <button
                        onClick={handleSpin}
                        disabled={isSpinning || !games || games.length === 0}
                        className="group relative px-12 py-4 bg-primary hover:bg-green-400 text-white font-black text-xl tracking-widest uppercase skew-x-[-12deg] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-neon hover:shadow-neon-strong"
                    >
                        <span className="block skew-x-[12deg]">
                            {isSpinning ? 'Rolling...' : 'Roll Case'}
                        </span>
                    </button>

                    {!isSpinning && (
                        <p className="text-xs text-slate-500 font-mono">
                            {games ? `${games.length} items in case` : 'Loading...'}
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
        </div>
    );
};

export default RandomPickerPage;
