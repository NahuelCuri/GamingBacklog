import React, { useState } from 'react';

const RandomPickerPage = ({ onNavigate }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);

    const handleSpin = () => {
        if (isSpinning) return;
        setIsSpinning(true);

        // Random rotations: at least 5 full spins + random degrees
        const randomDeg = Math.floor(Math.random() * 360);
        const totalRotation = rotation + (360 * 5) + randomDeg;

        setRotation(totalRotation);

        // Reset spinning state after animation (approx 3s - matches common ease-out duration)
        // We'll use CSS transition for the actual visual
        setTimeout(() => {
            setIsSpinning(false);
        }, 5000);
    };

    return (
        <div className="bg-background-dark text-white font-display overflow-x-hidden min-h-screen flex flex-col">
            {/* Navbar */}
            <header className="w-full px-6 py-4 flex items-center justify-between z-10 border-b border-[#161B22]">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
                    <span className="material-symbols-outlined text-primary text-3xl">casino</span>
                    <h2 className="text-white text-lg font-bold tracking-tight">Random Game Picker</h2>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onNavigate('dashboard')}
                        className="text-sm font-medium text-gray-400 hover:text-primary transition-colors cursor-pointer"
                    >
                        Back to Backlog
                    </button>
                    {/* User Avatar */}
                    <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-[#161B22]" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA3UAoBF_aIz4eYLMsQDHwxu8_DevsIl7XLAGI7PPX01TLV1bcZRkob0fkBMr1e7CbTOwNHaO_0z8p-pS8xFyArf_2xBFFvXPa6-JSFmBKyzWeUuGTR0ZCi1wjb8ZXBhf1a6IJp2T40iJwuhliOGH5CvyKm7kWW1cWzPbJizj1PGv3tChqA_2ptVgF6l4uJZ95jn_lE-fwQFlNYmp1jeo58fqMheHIrIavM0FI806vMV6Mz0ult0Zs0xQkNsXJNNuPm3ckoOEK6J3A")' }}>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex flex-col items-center justify-center relative px-4 py-8">
                {/* Headline */}
                <div className="text-center mb-8 md:mb-12 relative z-10">
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-2 drop-shadow-lg">What should we play next?</h1>
                    <p className="text-gray-400 text-sm md:text-base font-light">Spin the wheel to decide your destiny</p>
                </div>

                {/* Wheel Container */}
                <div className="relative mb-12 group">
                    {/* Ticker Pointer */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 text-primary drop-shadow-[0_2px_10px_rgba(34,197,94,0.5)]">
                        <span className="material-symbols-outlined text-5xl md:text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_drop_down</span>
                    </div>

                    {/* The Wheel */}
                    <div className="relative size-[320px] md:size-[450px] lg:size-[500px] rounded-full bg-wheel-surface shadow-2xl border-[12px] border-[#161B22] flex items-center justify-center overflow-hidden floating-element">
                        {/* Decorative Outer Ring Glow */}
                        <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none"></div>

                        {/* Wheel Surface Gradient simulating motion blur/texture */}
                        <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle_at_center,_#27303b_0%,_#161B22_70%)]"></div>

                        {/* Rotatable content */}
                        <div
                            className="absolute inset-0 w-full h-full transition-transform cubic-bezier(0.25, 0.1, 0.25, 1)"
                            style={{
                                transform: `rotate(${rotation}deg)`,
                                transitionDuration: '5s'
                            }}
                        >
                            {/* Segments (Simulated with CSS) */}
                            <div className="absolute inset-0 rounded-full opacity-80" style={{
                                background: `conic-gradient(
                        transparent 0deg 0deg,
                        rgba(255,255,255,0.03) 0deg 45deg,
                        transparent 45deg 46deg,
                        rgba(255,255,255,0.03) 46deg 90deg,
                        transparent 90deg 91deg,
                        rgba(255,255,255,0.03) 91deg 135deg,
                        transparent 135deg 136deg,
                        rgba(255,255,255,0.03) 136deg 180deg,
                        transparent 180deg 181deg,
                        rgba(255,255,255,0.03) 181deg 225deg,
                        transparent 225deg 226deg,
                        rgba(255,255,255,0.03) 226deg 270deg,
                        transparent 270deg 271deg,
                        rgba(255,255,255,0.03) 271deg 315deg,
                        transparent 315deg 316deg,
                        rgba(255,255,255,0.03) 316deg 360deg
                     )`
                            }}>
                            </div>

                            {/* Inner Decoration Lines */}
                            <div className="absolute inset-0 rounded-full border-[1px] border-white/5 scale-[0.6]"></div>

                            {/* Text Labels (Positioned absolutely) - Rotating with the container */}
                            <div className="absolute top-[15%] left-1/2 -translate-x-1/2 text-primary font-bold tracking-widest text-sm uppercase drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">Valorant</div>
                            <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 text-gray-500 font-medium tracking-widest text-xs uppercase opacity-40 rotate-180">Minecraft</div>
                            <div className="absolute left-[15%] top-1/2 -translate-y-1/2 text-gray-500 font-medium tracking-widest text-xs uppercase opacity-40 -rotate-90">Apex</div>
                            <div className="absolute right-[15%] top-1/2 -translate-y-1/2 text-gray-500 font-medium tracking-widest text-xs uppercase opacity-40 rotate-90">GTA V</div>
                            <div className="absolute top-[25%] right-[25%] text-gray-500 font-medium tracking-widest text-xs uppercase opacity-40 rotate-[45deg]">CS:GO</div>
                            <div className="absolute top-[25%] left-[25%] text-gray-500 font-medium tracking-widest text-xs uppercase opacity-40 -rotate-[45deg]">Dota 2</div>
                        </div>

                        {/* Active "Winner" Segment Highlight - Static Overlay */}
                        <div className="absolute top-0 w-full h-1/2 overflow-hidden opacity-100 origin-bottom pointer-events-none" style={{ transform: 'rotate(-22.5deg)' }}>
                            <div className="w-full h-full bg-primary/10 backdrop-blur-sm" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}></div>
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
                        disabled={isSpinning}
                        className="relative group/btn flex min-w-[200px] h-16 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary text-white text-xl font-bold tracking-widest shadow-neon hover:shadow-neon-strong transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="relative z-10">{isSpinning ? 'SPINNING...' : 'SPIN'}</span>
                        {/* Button Hover Effect */}
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 rounded-full"></div>
                    </button>
                    <a className="text-[#97c4a7] text-sm font-normal hover:text-white transition-colors border-b border-transparent hover:border-[#97c4a7] pb-0.5" href="#">Edit Game List</a>
                </div>
            </main>

            {/* Optional Background Decoration for depth */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]"></div>
                <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]"></div>
            </div>
        </div>
    );
};

export default RandomPickerPage;
