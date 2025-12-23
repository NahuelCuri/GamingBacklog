import React, { useMemo, useState } from 'react';
import Header from './Header';
import GameReviewModal from './GameReviewModal';

const StatisticsPage = ({ games, onNavigate }) => {
    // --- State for Sort ---
    const [topTenSort, setTopTenSort] = useState('score'); // 'score' or 'year'
    const [selectedGame, setSelectedGame] = useState(null);

    // --- Calculations ---
    const stats = useMemo(() => {
        if (!games || games.length === 0) return null;

        const totalGames = games.length;
        const totalHours = games.reduce((acc, game) => acc + (game.hours || 0), 0);

        // Status Counts
        const statusCounts = games.reduce((acc, game) => {
            const status = game.status || 'Unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        const completedCount = statusCounts['Finished'] || 0;
        const backlogCount = (statusCounts['Unplayed'] || 0) + (statusCounts['Playing'] || 0); // Rough estimation
        const completionRate = Math.round((completedCount / totalGames) * 100);

        // Genre Distribution
        const genreCounts = games.reduce((acc, game) => {
            const genre = game.genre || 'Unknown';
            acc[genre] = (acc[genre] || 0) + 1;
            return acc;
        }, {});

        // Convert to array and sort by count desc
        const sortedGenres = Object.entries(genreCounts)
            .map(([label, count]) => ({ label, count, percentage: Math.round((count / totalGames) * 100) }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5

        // Score Distribution (Histogram buckets: 1-2, 3-4, 5-6, 7-8, 9-10)
        const scoreBuckets = [0, 0, 0, 0, 0]; // <3, 3-4.9, 5-6.9, 7-8.9, 9-10
        let totalScore = 0;
        let scoredGamesCount = 0;

        games.forEach(game => {
            const score = parseFloat(game.score);
            if (!isNaN(score)) {
                totalScore += score;
                scoredGamesCount++;

                if (score < 3) scoreBuckets[0]++;
                else if (score < 5) scoreBuckets[1]++;
                else if (score < 7) scoreBuckets[2]++;
                else if (score < 9) scoreBuckets[3]++;
                else scoreBuckets[4]++;
            }
        });

        const averageScore = scoredGamesCount > 0 ? (totalScore / scoredGamesCount).toFixed(1) : 'N/A';
        const maxBucketSize = Math.max(...scoreBuckets);

        // Top 10 Games
        const topGames = [...games].sort((a, b) => {
            if (topTenSort === 'year') {
                return (b.releaseYear || 0) - (a.releaseYear || 0);
            }
            // Default to score
            return parseFloat(b.score || 0) - parseFloat(a.score || 0);
        }).slice(0, 10);

        return {
            totalGames,
            totalHours,
            completedCount,
            backlogCount,
            completionRate,
            statusCounts,
            sortedGenres,
            scoreBuckets,
            maxBucketSize,
            averageScore,
            topGames
        };
    }, [games, topTenSort]);

    if (!stats) return <div className="text-white text-center mt-20">Loading statistics...</div>;

    // --- Helper for Conic Gradient ---
    // Colors: Finished (Green/Primary), Playing (Violet), Unplayed (Slate)
    // We need to calculate degrees for each segment
    const calculateConicGradient = () => {
        const finishedDeg = (stats.statusCounts['Finished'] || 0) / stats.totalGames * 360;
        const playingDeg = (stats.statusCounts['Playing'] || 0) / stats.totalGames * 360;
        const unplayedDeg = (stats.statusCounts['Unplayed'] || 0) / stats.totalGames * 360;

        // Note: Tailwind colors need hex equivalents roughly
        // Primary (Green): #22c55e
        // Violet: #8b5cf6
        // Slate: #64748b

        let gradient = `conic-gradient(
            #22c55e 0deg ${finishedDeg}deg,
            #8b5cf6 ${finishedDeg}deg ${finishedDeg + playingDeg}deg,
            #64748b ${finishedDeg + playingDeg}deg 360deg
        )`;
        return gradient;
    };


    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col">
            <Header onNavigate={onNavigate} activePage="statistics" />

            <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-12 flex flex-col gap-12 animate-fade-in-up">

                {/* Hero Stats */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-surface-dark border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg hover:border-primary/20 transition-colors group">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Total Time</span>
                        <div className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                            {stats.totalHours.toLocaleString()}<span className="text-lg text-slate-500 ml-1 font-bold">h</span>
                        </div>
                    </div>
                    <div className="bg-surface-dark border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg hover:border-primary/20 transition-colors group">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Completion Rate</span>
                        <div className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                            {stats.completionRate}<span className="text-lg text-slate-500 ml-1 font-bold">%</span>
                        </div>
                    </div>
                    <div className="bg-surface-dark border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg hover:border-primary/20 transition-colors group">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Avg Score</span>
                        <div className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                            {stats.averageScore}
                        </div>
                    </div>
                    <div className="bg-surface-dark border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg hover:border-primary/20 transition-colors group">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Library Size</span>
                        <div className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                            {stats.totalGames}
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Status Chart */}
                    <section className="bg-surface-dark border border-white/5 rounded-3xl p-8 shadow-sm">
                        <h3 className="text-xl font-bold mb-8">Library Status</h3>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
                            {/* Donut Chart */}
                            <div className="relative size-48 rounded-full shrink-0 shadow-[0_0_30px_-5px_rgba(0,0,0,0.3)]"
                                style={{ background: calculateConicGradient() }}>
                                <div className="absolute inset-4 bg-surface-dark rounded-full flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-white">{stats.totalGames}</div>
                                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Games</div>
                                    </div>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex flex-col gap-4 w-full max-w-[200px]">
                                {[
                                    { label: 'Finished', count: stats.statusCounts['Finished'] || 0, color: 'bg-green-500' },
                                    { label: 'Playing', count: stats.statusCounts['Playing'] || 0, color: 'bg-violet-500' },
                                    { label: 'Unplayed', count: stats.statusCounts['Unplayed'] || 0, color: 'bg-slate-500' },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center justify-between group cursor-default">
                                        <div className="flex items-center gap-3">
                                            <span className={`size-3 rounded-full ${item.color} shadow-[0_0_10px_-2px] shadow-${item.color.replace('bg-', '')}/50`}></span>
                                            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-500 group-hover:text-white transition-colors">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Genre Chart */}
                    <section className="bg-surface-dark border border-white/5 rounded-3xl p-8 shadow-sm">
                        <h3 className="text-xl font-bold mb-6">Top Genres</h3>
                        <div className="flex flex-col gap-5 justify-center h-full pb-4">
                            {stats.sortedGenres.map((genre, i) => (
                                <div key={genre.label} className="group">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{genre.label}</span>
                                        <span className="text-xs font-bold text-slate-500 group-hover:text-primary transition-colors">{genre.count} games</span>
                                    </div>
                                    <div className="w-full bg-slate-800/50 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-violet-500 to-primary rounded-full transition-all duration-1000 ease-out group-hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                                            style={{ width: `${genre.percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Score Histogram */}
                {/* <section className="..."> (Optional: Removed to focus on Top 10 Table for now as it's more requested) */}

                {/* Top 10 Table */}
                <section className="bg-surface-dark border border-white/5 rounded-3xl overflow-hidden shadow-sm flex flex-col">
                    <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-yellow-500">trophy</span>
                            Top 10 Games
                        </h3>

                        {/* Sort Toggle */}
                        <div className="flex bg-background-dark p-1 rounded-lg">
                            <button
                                onClick={() => setTopTenSort('score')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 ${topTenSort === 'score' ? 'bg-primary text-background-dark shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                By Score
                            </button>
                            <button
                                onClick={() => setTopTenSort('year')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 ${topTenSort === 'year' ? 'bg-primary text-background-dark shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                By Year
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5 bg-white/2">
                                    <th className="px-8 py-4 font-medium w-16">#</th>
                                    <th className="px-4 py-4 font-medium">Title</th>
                                    <th className="px-4 py-4 font-medium text-right">Year</th>
                                    <th className="px-8 py-4 font-medium text-right">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.topGames.map((game, index) => (
                                    <tr
                                        key={game.id}
                                        onClick={() => setSelectedGame(game)}
                                        className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-8 py-4 text-slate-500 font-mono text-sm group-hover:text-white transition-colors">
                                            {index + 1 < 10 ? `0${index + 1}` : index + 1}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-md bg-cover bg-center shadow-md bg-slate-800" style={{ backgroundImage: `url("${game.cover}")` }}></div>
                                                <span className="font-bold text-white group-hover:text-primary transition-colors">{game.title}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-400 font-mono text-sm">
                                            {game.releaseYear || '—'}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <span className={`font-bold text-lg ${index === 0 ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]' :
                                                index === 1 ? 'text-slate-300' :
                                                    index === 2 ? 'text-orange-400' :
                                                        'text-slate-600'
                                                }`}>
                                                {game.score}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="h-8"></div> {/* Bottom Spacer */}
            </main>

            {/* Game Review Modal */}
            <GameReviewModal
                isOpen={!!selectedGame}
                onClose={() => setSelectedGame(null)}
                game={selectedGame}
                onEdit={() => { }}
            />
        </div>
    );
};

export default StatisticsPage;
