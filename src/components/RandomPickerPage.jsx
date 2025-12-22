import React, { useState } from 'react';
import Header from './Header';

const RandomPickerPage = ({ onNavigate, games }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [winner, setWinner] = useState(null);

    // Filter for candidates (e.g., Backlog or In Progress, or just all)
    // For now, let's pick 8 random games from the full list to display on the wheel
    const [wheelItems, setWheelItems] = useState([]);

    React.useEffect(() => {
        if (games && games.length > 0) {
            // Shuffle and pick 8 unique games
            const shuffled = [...games].sort(() => 0.5 - Math.random());
            setWheelItems(shuffled.slice(0, 8));
        }
    }, [games]);

    const handleSpin = () => {
        if (isSpinning || wheelItems.length === 0) return;
        setIsSpinning(true);
        setWinner(null);

        // Random index
        const winningIndex = Math.floor(Math.random() * wheelItems.length);
        const segmentAngle = 360 / wheelItems.length;

        // Add huge rotation (at least 5 full spins = 1800deg)
        // We want the winner to be at the TOP (arrow position).
        // If segments are drawn clockwise 0, 1, 2... starting at 0deg.
        // To get index i to 0 degrees, we rotate - (i * angle).
        const extraSpins = 5 + Math.floor(Math.random() * 5);
        const baseTarget = -(winningIndex * segmentAngle);
        const randomOffset = Math.floor(Math.random() * (segmentAngle - 10)) - (segmentAngle / 2 - 5);

        const finalRotation = rotation + (360 * extraSpins) + (baseTarget - (rotation % 360)) + randomOffset;

        setRotation(finalRotation);

        setTimeout(() => {
            setIsSpinning(false);
            setWinner(wheelItems[winningIndex]);
        }, 5000);
    };

    return (
        <div className="bg-background-dark text-white font-display overflow-x-hidden min-h-screen flex flex-col items-center">
            {/* Navbar */}
            <Header onNavigate={onNavigate} activePage="picker" />

            {/* Main Content */}
            <main className="flex-grow flex flex-col items-center justify-center relative px-4 py-8 w-full max-w-4xl">
                {/* Headline */}
                <div className="text-center mb-8 md:mb-12 relative z-10 w-full animate-in slide-in-from-top-4 duration-700">
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-2 drop-shadow-lg">What's Next?</h1>
                    <p className="text-gray-400 text-sm md:text-base font-light">Let fate decide your next adventure.</p>
                </div>

                {/* Wheel Container */}
                <div className="relative mb-12 group scale-90 md:scale-100 transition-transform">
                    {/* Ticker Pointer */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 text-primary drop-shadow-[0_2px_10px_rgba(34,197,94,0.5)]">
                        <span className="material-symbols-outlined text-5xl md:text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_drop_down</span>
                    </div>

                    {/* The Wheel */}
                    <div className="relative size-[320px] md:size-[450px] lg:size-[500px] rounded-full bg-wheel-surface shadow-2xl border-[8px] md:border-[12px] border-[#161B22] flex items-center justify-center overflow-hidden">
                        {/* Decorative Outer Ring Glow */}
                        <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none"></div>

                        {/* Rotatable content */}
                        <div
                            className="absolute inset-0 w-full h-full"
                            style={{
                                transform: `rotate(${rotation}deg)`,
                                transition: isSpinning ? 'transform 5s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none'
                            }}
                        >
                            {/* Dynamic Segments */}
                            {wheelItems.map((item, index) => {
                                const angle = 360 / wheelItems.length;
                                const rotation = index * angle;
                                return (
                                    <div
                                        key={item.id}
                                        className="absolute top-0 left-0 w-full h-full origin-center flex justify-center pt-8"
                                        style={{ transform: `rotate(${rotation}deg)` }}
                                    >
                                        {/* Separator Line */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-1/2 bg-white/10 origin-bottom"></div>

                                        {/* Text */}
                                        <div className="w-[120px] text-center pt-8">
                                            <span className="text-xs md:text-sm font-bold uppercase tracking-widest text-slate-400 drop-shadow-md line-clamp-2 block px-2" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', maxHeight: '180px' }}>
                                                {item.title}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Center Hub */}
                        <div className="absolute size-20 md:size-24 bg-[#0B0F13] rounded-full z-20 shadow-inner-glow border-4 border-[#27303b] flex items-center justify-center">
                            <div className="size-3 bg-primary rounded-full shadow-neon"></div>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="flex flex-col items-center gap-6 z-10">
                    <button
                        onClick={handleSpin}
                        disabled={isSpinning || wheelItems.length === 0}
                        className="relative group/btn flex min-w-[200px] h-16 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary text-white text-xl font-bold tracking-widest shadow-neon hover:shadow-neon-strong transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        <span className="relative z-10">{isSpinning ? 'SPINNING...' : 'SPIN'}</span>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 rounded-full"></div>
                    </button>
                    <button
                        onClick={() => {
                            // Reshuffle
                            const shuffled = [...games].sort(() => 0.5 - Math.random());
                            setWheelItems(shuffled.slice(0, 8));
                        }}
                        className="text-[#97c4a7] text-sm font-normal hover:text-white transition-colors border-b border-transparent hover:border-[#97c4a7] pb-0.5"
                    >
                        Shuffle Games
                    </button>
                </div>
            </main>

            {/* Winner Modal - Overlay */}
            {/* Winner Modal - Overlay */}
            {winner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-popup">
                    <div className="bg-[#161B22] border border-white/10 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center gap-6 shadow-2xl relative">
                        {/* Confetti / Glow effect background */}
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent rounded-3xl pointer-events-none"></div>

                        <h3 className="text-xl font-bold text-white z-10">We have a winner!</h3>

                        <div className="relative group z-10">
                            <div className="w-48 h-64 rounded-xl bg-cover bg-center shadow-lg border-2 border-primary/50 group-hover:scale-105 transition-transform duration-500" style={{ backgroundImage: `url("${winner.cover}")` }}></div>
                            <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full -z-10 group-hover:bg-primary/30 transition-colors"></div>
                        </div>

                        <div className="text-center z-10">
                            <h4 className="text-2xl font-bold text-white mb-1">{winner.title}</h4>
                            <p className="text-primary text-sm font-medium uppercase tracking-wider">{winner.genre}</p>
                        </div>

                        <button
                            onClick={() => setWinner(null)}
                            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors z-10"
                        >
                            Awesome!
                        </button>
                    </div>
                </div>
            )}

            {/* Background Decoration */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]"></div>
                <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]"></div>
            </div>
        </div>
    );
};

export default RandomPickerPage;
