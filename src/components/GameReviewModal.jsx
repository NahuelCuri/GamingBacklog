import React, { useEffect, useState } from 'react';
import PlatformIcon from './PlatformIcon';

const GameReviewModal = ({ isOpen, onClose, game, onEdit }) => {
    if (!isOpen || !game) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background-dark/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* MODAL CARD */}
            <div className="relative w-full max-w-[1000px] bg-modal-surface/95 backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl shadow-black/50 flex flex-col md:flex-row overflow-hidden transition-all transform scale-100 animate-fade-in-up">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 text-white/70 hover:bg-white/10 hover:text-white transition-all backdrop-blur-md border border-white/5 group cursor-pointer"
                >
                    <span className="material-symbols-outlined group-hover:rotate-90 transition-transform duration-300" style={{ fontSize: '20px' }}>close</span>
                </button>

                {/* LEFT COLUMN: Game Art */}
                <div className="w-full md:w-[42%] p-3 md:p-4 flex flex-col">
                    <div className="relative h-64 md:h-full w-full rounded-2xl overflow-hidden group shadow-lg">
                        {/* Image */}
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                            style={{ backgroundImage: `url('${game.cover}')` }}
                        >
                        </div>
                        {/* Gradient Overlay for text readability on mobile if needed */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden"></div>
                        {/* Floating Platform Badge (Visual Flair) */}
                        <div className="absolute bottom-4 left-4 hidden md:flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                            <PlatformIcon platform={game.platform} className="w-4 h-4 text-white/90" />
                            <span className="text-xs font-medium text-white/90 capitalize">{game.platform || 'Undefined'}</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Content */}
                <div className="flex-1 p-6 md:p-10 flex flex-col relative">
                    {/* HEADER: Title & Score */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="pr-16">
                            <h1 className="text-white text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-2">{game.title}</h1>
                            <p className="text-white/40 text-sm font-medium tracking-wide uppercase">
                                {game.genre} • OPEN WORLD • {game.dateFinished ? new Date(game.dateFinished).getFullYear() : '2023'}
                                {game.dateFinished && <span className="text-primary ml-2">• FINISHED {new Date(game.dateFinished).toLocaleDateString()}</span>}
                            </p>
                        </div>
                        {/* Score Badge */}
                        <div className={`flex flex-col items-center justify-center rounded-2xl px-3 py-2 border shadow-glow min-w-[72px] ${parseFloat(game.score) >= 8 ? 'bg-emerald-500/10 border-emerald-500/20' :
                            parseFloat(game.score) >= 5 ? 'bg-yellow-500/10 border-yellow-500/20' :
                                'bg-red-500/10 border-red-500/20'
                            }`}>
                            <span className={`text-3xl font-bold leading-none tracking-tighter ${parseFloat(game.score) >= 8 ? 'text-emerald-500' :
                                parseFloat(game.score) >= 5 ? 'text-yellow-500' :
                                    'text-red-500'
                                }`}>{game.score || '-'}</span>
                        </div>
                    </div>

                    {/* VIBE TAGS */}
                    <div className="flex flex-wrap gap-2 mb-8">
                        <div className="flex items-center justify-center px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 transition-colors cursor-default">
                            <span className="text-violet-400 text-xs font-semibold tracking-wide uppercase">Exploration</span>
                        </div>
                        <div className="flex items-center justify-center px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 transition-colors cursor-default">
                            <span className="text-violet-400 text-xs font-semibold tracking-wide uppercase">Cozy</span>
                        </div>
                        <div className="flex items-center justify-center px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 transition-colors cursor-default">
                            <span className="text-violet-400 text-xs font-semibold tracking-wide uppercase">Great Soundtrack</span>
                        </div>
                        <div className="flex items-center justify-center px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 transition-colors cursor-default">
                            <span className="text-violet-400 text-xs font-semibold tracking-wide uppercase">Puzzle</span>
                        </div>
                    </div>

                    {/* REVIEW SECTION */}
                    <div className="flex-1 mb-8 overflow-y-auto custom-scrollbar pr-2">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>rate_review</span>
                            <h3 className="text-white/90 text-sm font-bold tracking-wider uppercase">curiReview</h3>
                        </div>
                        <p className="text-gray-400 text-base md:text-lg font-light leading-relaxed">
                            A breathtaking experience that redefines the genre. The verticality of the world adds a completely new dimension to exploration, making the landscape feel fresh despite being familiar. While the frame rate occasionally stutters, the sheer creativity of the building mechanics overshadows any technical flaws. An absolute masterpiece.
                        </p>
                    </div>

                    {/* STATS: TIME PLAYED */}
                    <div className="mt-auto bg-white/5 rounded-2xl p-5 border border-white/5">
                        <div className="flex justify-between items-end mb-3">
                            <div>
                                <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-1">Time Played</p>
                                <p className="text-white text-xl font-bold tracking-tight">{game.hours}h <span className="text-white/30 text-base font-normal">/ 120h</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-1">HLTB Average</p>
                                <p className="text-white/60 text-sm font-medium">50h Main Story</p>
                            </div>
                        </div>
                        {/* Progress Bar Container */}
                        <div className="relative h-2.5 w-full bg-black/40 rounded-full overflow-hidden">
                            {/* HLTB Marker (Gray Bar) - Representing 50h on a scale of 100h */}
                            <div className="absolute top-0 left-0 h-full bg-white/20 w-[50%] rounded-r-full"></div>
                            {/* Player Progress (Violet Bar) - Representing 45h */}
                            <div className="absolute top-0 left-0 h-full bg-violet-500 w-[45%] rounded-full shadow-[0_0_12px_rgba(139,92,246,0.8)] z-10"></div>
                        </div>
                    </div>

                    {/* FOOTER ACTIONS */}
                    <div className="flex gap-3 mt-6 pt-6 border-t border-white/5">
                        <button
                            onClick={onEdit}
                            className="flex-1 h-12 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background-dark text-sm font-bold rounded-full transition-all shadow-lg shadow-primary/20 cursor-pointer">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                            Edit Review
                        </button>
                        <button className="h-12 w-12 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors cursor-pointer">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>share</span>
                        </button>
                        <button className="h-12 w-12 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors cursor-pointer">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>more_horiz</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameReviewModal;
