import React, { useState, useEffect } from 'react';

const EditGameModal = ({ isOpen, onClose, game, onSave }) => {
    if (!isOpen || !game) return null;

    // Local state for form fields
    const [formData, setFormData] = useState({
        title: '',
        genre: '',
        hours: '',
        score: '9.5',
        status: 'completed',
        vibes: [],
        review: '',
        hltb: '',
        cover: '',
        dateFinished: ''
    });

    const [vibeInput, setVibeInput] = useState('');
    const [errors, setErrors] = useState({});
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

    // Initialize form data when game changes
    useEffect(() => {
        if (game) {
            setFormData({
                title: game.title,
                genre: game.genre,
                hours: game.hours,
                // Mock data for fields not in the game object but in logic
                score: '9.5',
                status: game.status.toLowerCase().replace(' ', '-') || 'finished',
                vibes: ['Atmospheric', 'Difficult', 'Great Soundtrack'],
                review: 'A masterpiece of world design, challenging combat, and open-ended exploration. Truly one of the best games I\'ve ever played. The boss fights are unforgettable.',
                hltb: '60', // Mock default
                cover: game.cover,
                dateFinished: game.dateFinished || ''
            });
            setErrors({});
        }
    }, [game]);

    const validate = () => {
        const newErrors = {};

        // Score validation (1-10)
        const scoreNum = parseFloat(formData.score);
        if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 10) {
            newErrors.score = 'Score must be between 1 and 10';
        }

        // HLTB validation (positive number)
        const hltbNum = parseFloat(formData.hltb);
        if (isNaN(hltbNum) || hltbNum < 0) {
            newErrors.hltb = 'Must be a positive number';
        }

        // Hours validation
        const hoursNum = parseFloat(formData.hours);
        if (isNaN(hoursNum) || hoursNum < 0) {
            newErrors.hours = 'Must be a positive number';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { id, value, name, type } = e.target;
        // Handle radio buttons which use name instead of id
        const fieldName = type === 'radio' ? name : id;
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }));
        // Clear error when user types
        if (errors[fieldName]) {
            setErrors(prev => ({ ...prev, [fieldName]: undefined }));
        }
    };

    const handleVibeKeyDown = (e) => {
        if (e.key === 'Enter' && vibeInput.trim()) {
            e.preventDefault();
            if (!formData.vibes.includes(vibeInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    vibes: [...prev.vibes, vibeInput.trim()]
                }));
            }
            setVibeInput('');
        }
    };

    const removeVibe = (vibeToRemove) => {
        setFormData(prev => ({
            ...prev,
            vibes: prev.vibes.filter(vibe => vibe !== vibeToRemove)
        }));
    };

    const addPopularVibe = (vibe) => {
        if (!formData.vibes.includes(vibe)) {
            setFormData(prev => ({
                ...prev,
                vibes: [...prev.vibes, vibe]
            }));
        }
    };

    const handleStatusSelect = (status) => {
        setFormData(prev => ({ ...prev, status }));
        setIsStatusDropdownOpen(false);
    };

    const handleSave = () => {
        if (validate()) {
            onSave({ ...game, ...formData });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-display">
            {/* Background Elements for visual depth */}
            <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm z-[-1]" onClick={onClose}></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-5xl bg-surface-dark rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col max-h-[90vh] overflow-y-auto animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-8 pb-4">
                    <h2 className="text-text-light text-2xl font-bold tracking-tight">{game.id ? 'Edit Game Details' : 'Add New Game'}</h2>
                    <button
                        onClick={onClose}
                        className="group p-2 rounded-full hover:bg-white/5 transition-colors duration-200 text-text-muted hover:text-white cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="px-8 pb-8 flex flex-col gap-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        {/* Left Column: Image Editor */}
                        <div className="lg:col-span-4 space-y-6">
                            <div>
                                <label className="block text-text-muted text-sm font-medium mb-3 ml-1">Cover Image</label>
                                <div className="relative group w-full aspect-[3/4] rounded-2xl overflow-hidden bg-background-dark border border-border-dark shadow-lg">
                                    <img
                                        alt="Game Cover"
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        src={formData.cover || "https://via.placeholder.com/300x400?text=No+Cover"}
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                                        <button className="px-4 py-2 rounded-full bg-white text-black text-sm font-bold shadow-lg hover:bg-gray-200 transition-colors flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 duration-300 cursor-pointer">
                                            <span className="material-symbols-outlined text-[18px]">upload</span>
                                            Change Art
                                        </button>
                                        <button className="px-4 py-2 rounded-full bg-red-500/20 text-red-200 border border-red-500/30 text-sm font-medium hover:bg-red-500/30 transition-colors flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 duration-300 delay-75 cursor-pointer">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-start gap-3">
                                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">info</span>
                                <div className="space-y-1">
                                    <p className="text-text-light text-sm font-medium">Optimal Dimensions</p>
                                    <p className="text-text-muted text-xs leading-relaxed">For best results, use a portrait image with a ratio of 3:4. Recommended size 600x800px.</p>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Form Fields */}
                        <div className="lg:col-span-8 space-y-8">
                            {/* Game Title Input */}
                            <div className="flex flex-col gap-2">
                                <label className="text-text-muted text-sm font-medium ml-1" htmlFor="title">Title</label>
                                <div className="relative">
                                    <input
                                        className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-4 text-text-light placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                                        id="title"
                                        type="text"
                                        value={formData.title}
                                        onChange={handleChange}
                                    />
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/50 pointer-events-none text-[20px]">videogame_asset</span>
                                </div>
                            </div>

                            {/* Genre & Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-text-muted text-sm font-medium ml-1" htmlFor="genre">Genre</label>
                                    <input
                                        className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-4 text-text-light placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                                        id="genre"
                                        type="text"
                                        value={formData.genre}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-text-muted text-sm font-medium ml-1" htmlFor="hours">Hours Played</label>
                                    <div className="relative">
                                        <input
                                            className={`w-full bg-background-dark border ${errors.hours ? 'border-red-500' : 'border-border-dark'} rounded-xl px-5 py-4 text-text-light placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200`}
                                            id="hours"
                                            type="number"
                                            value={formData.hours}
                                            onChange={handleChange}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">hrs</span>
                                    </div>
                                    {errors.hours && <span className="text-red-500 text-xs ml-1">{errors.hours}</span>}
                                </div>
                            </div>

                            {/* Date Finished */}
                            <div className="flex flex-col gap-2">
                                <label className="text-text-muted text-sm font-medium ml-1" htmlFor="dateFinished">Date Completed</label>
                                <input
                                    className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-4 text-text-light placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                                    id="dateFinished"
                                    type="date"
                                    value={formData.dateFinished}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* HLTB & Score Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-text-muted text-sm font-medium ml-1" htmlFor="hltb">HLTB Time</label>
                                    <div className="relative">
                                        <input
                                            className={`w-full bg-background-dark border ${errors.hltb ? 'border-red-500' : 'border-border-dark'} rounded-xl px-5 py-4 text-text-light placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200`}
                                            id="hltb"
                                            type="number"
                                            value={formData.hltb}
                                            onChange={handleChange}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">hrs</span>
                                    </div>
                                    {errors.hltb && <span className="text-red-500 text-xs ml-1">{errors.hltb}</span>}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-text-muted text-sm font-medium ml-1" htmlFor="score">Score (1-10)</label>
                                    <div className="relative">
                                        <input
                                            className={`w-full bg-background-dark border ${errors.score ? 'border-red-500' : 'border-border-dark'} rounded-xl px-5 py-4 text-text-light placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200`}
                                            id="score"
                                            type="number"
                                            min="1"
                                            max="10"
                                            step="0.1"
                                            value={formData.score}
                                            onChange={handleChange}
                                        />
                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none">star</span>
                                    </div>
                                    {errors.score && <span className="text-red-500 text-xs ml-1">{errors.score}</span>}
                                </div>
                            </div>

                            {/* Status Dropdown (Custom) */}
                            <div className="flex flex-col gap-2 relative z-50">
                                <label className="text-text-muted text-sm font-medium ml-1">Status</label>
                                <div className="relative">
                                    {/* Trigger */}
                                    <button
                                        type="button"
                                        onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                        className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-4 text-text-light flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 cursor-pointer"
                                    >
                                        <span className="capitalize">{formData.status}</span>
                                        <span className={`material-symbols-outlined text-text-muted transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {isStatusDropdownOpen && (
                                        <>
                                            {/* Backdrop for click-outside */}
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setIsStatusDropdownOpen(false)}
                                            ></div>

                                            {/* Menu Items */}
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-background-dark border border-border-dark rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 p-1">
                                                {['finished', 'playing', 'unplayed'].map((status) => (
                                                    <button
                                                        key={status}
                                                        type="button"
                                                        onClick={() => handleStatusSelect(status)}
                                                        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150 capitalize flex items-center justify-between group cursor-pointer ${formData.status === status
                                                            ? status === 'playing' ? 'bg-violet-500/10 text-violet-500'
                                                                : status === 'finished' ? 'bg-primary/10 text-primary'
                                                                    : 'bg-white/5 text-slate-400'
                                                            : 'text-text-light hover:bg-white/5'
                                                            }`}
                                                    >
                                                        {status}
                                                        {formData.status === status && (
                                                            <span className={`material-symbols-outlined text-[18px] ${status === 'playing' ? 'text-violet-500' :
                                                                status === 'finished' ? 'text-primary' :
                                                                    'text-slate-400'
                                                                }`}>check</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Vibe Tags */}
                            <div className="flex flex-col gap-2">
                                <label className="text-text-muted text-sm font-medium ml-1">Vibe Tags</label>
                                <div className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all duration-200 min-h-[60px] items-center">
                                    {formData.vibes.map((vibe, index) => (
                                        <span key={index} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-500/10 text-violet-500 border border-violet-500/20 animate-in fade-in zoom-in duration-200">
                                            {vibe}
                                            <button
                                                onClick={() => removeVibe(vibe)}
                                                className="hover:text-violet-300 transition-colors flex items-center cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        className="bg-transparent border-none focus:ring-0 p-0 text-text-light placeholder:text-gray-600 text-sm h-8 min-w-[80px] flex-1 focus:outline-none"
                                        placeholder="Add tag..."
                                        type="text"
                                        value={vibeInput}
                                        onChange={(e) => setVibeInput(e.target.value)}
                                        onKeyDown={handleVibeKeyDown}
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2 ml-1 mt-1">
                                    <span className="text-xs font-medium text-text-muted/60 uppercase tracking-wider py-1 mr-1">Popular:</span>
                                    {['Story Rich', 'Fantasy', 'Controller Support'].map((vibe) => (
                                        <button
                                            key={vibe}
                                            onClick={() => addPopularVibe(vibe)}
                                            className="text-xs text-text-muted hover:text-violet-500 border border-border-dark/50 hover:border-violet-500/50 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md transition-all duration-200 cursor-pointer"
                                        >
                                            {vibe}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Review Textarea */}
                            <div className="flex flex-col gap-2">
                                <label className="text-text-muted text-sm font-medium ml-1" htmlFor="review">Your Review</label>
                                <textarea
                                    className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-4 text-text-light placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 resize-none leading-relaxed custom-scrollbar"
                                    id="review"
                                    placeholder="Write your thoughts here..."
                                    rows="5"
                                    value={formData.review}
                                    onChange={handleChange}
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="flex items-center justify-end gap-4 pt-6 border-t border-white/5">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-full text-text-muted font-medium hover:text-white hover:bg-white/5 transition-all duration-200 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-8 py-3 bg-primary hover:bg-green-500 text-white rounded-full font-semibold shadow-lg shadow-primary/25 transition-all duration-200 transform active:scale-95 flex items-center gap-2 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[20px]">save</span>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditGameModal;
