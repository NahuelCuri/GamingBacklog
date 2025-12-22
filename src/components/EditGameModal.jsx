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
        review: ''
    });

    // Initialize form data when game changes
    useEffect(() => {
        if (game) {
            setFormData({
                title: game.title,
                genre: game.genre,
                hours: game.hours,
                // Mock data for fields not in the game object but in logic
                score: '9.5',
                status: game.status.toLowerCase().replace(' ', '-') || 'completed',
                review: 'A masterpiece of world design, challenging combat, and open-ended exploration. Truly one of the best games I\'ve ever played. The boss fights are unforgettable.'
            });
        }
    }, [game]);

    const handleChange = (e) => {
        const { id, value, name, type } = e.target;
        // Handle radio buttons which use name instead of id
        const fieldName = type === 'radio' ? name : id;
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }));
    };

    const handleSave = () => {
        onSave({ ...game, ...formData });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-display">
            {/* Background Elements for visual depth */}
            <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm z-[-1]" onClick={onClose}></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-2xl bg-surface-dark rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col max-h-[90vh] overflow-y-auto animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-8 pb-4">
                    <h2 className="text-text-light text-2xl font-bold tracking-tight">Edit Game Details</h2>
                    <button
                        onClick={onClose}
                        className="group p-2 rounded-full hover:bg-white/5 transition-colors duration-200 text-text-muted hover:text-white cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="px-8 pb-8 space-y-8">
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

                    {/* Genre & Hours Grid */}
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
                                    className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-4 text-text-light placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                                    id="hours"
                                    type="number"
                                    value={formData.hours}
                                    onChange={handleChange}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">hrs</span>
                            </div>
                        </div>
                    </div>

                    {/* Score & Status Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Score Select */}
                        <div className="flex flex-col gap-2">
                            <label className="text-text-muted text-sm font-medium ml-1" htmlFor="score">Score</label>
                            <div className="relative">
                                <select
                                    className="w-full appearance-none bg-background-dark border border-border-dark rounded-xl px-5 py-4 text-text-light focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 cursor-pointer"
                                    id="score"
                                    value={formData.score}
                                    onChange={handleChange}
                                >
                                    <option value="10">10 - Masterpiece</option>
                                    <option value="9.5">9.5 - Amazing</option>
                                    <option value="9">9 - Great</option>
                                    <option value="8">8 - Very Good</option>
                                    <option value="7">7 - Good</option>
                                    <option value="6">6 - Okay</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none">expand_more</span>
                            </div>
                        </div>

                        {/* Status Segmented Control */}
                        <div className="flex flex-col gap-2">
                            <label className="text-text-muted text-sm font-medium ml-1">Status</label>
                            <div className="flex bg-background-dark border border-border-dark p-1.5 rounded-full h-[58px]">
                                {['playing', 'completed', 'backlog'].map((status) => (
                                    <label key={status} className="flex-1 relative cursor-pointer group">
                                        <input
                                            className="peer sr-only"
                                            name="status"
                                            type="radio"
                                            value={status}
                                            checked={formData.status === status}
                                            onChange={handleChange}
                                        />
                                        <div className="w-full h-full flex items-center justify-center rounded-full text-sm font-medium text-text-muted transition-all duration-200 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-lg peer-checked:shadow-primary/20 group-hover:text-text-light capitalize">
                                            {status}
                                        </div>
                                    </label>
                                ))}
                            </div>
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

                    {/* Footer / Actions */}
                    <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/5">
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
