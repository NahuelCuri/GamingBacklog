import React, { useEffect, useState } from 'react';
import Header from './Header';
import { getTierLists, deleteTierList, createTierList } from '../services/tierlist';

const TierListDashboard = ({ onNavigate, onLogout }) => {
    const [tierLists, setTierLists] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newListName, setNewListName] = useState("");

    useEffect(() => {
        fetchTierLists();
    }, []);

    const fetchTierLists = async () => {
        try {
            const data = await getTierLists();
            setTierLists(data || []);
        } catch (error) {
            console.error("Failed to fetch tier lists", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNew = () => {
        setIsCreateModalOpen(true);
        setNewListName("");
    };

    const submitCreateNew = async () => {
        if (!newListName.trim()) return;

        try {
            await createTierList({
                name: newListName,
                rows: [
                    { label: "S", color: "#FF7F7F", sort_order: 0, items: [] },
                    { label: "A", color: "#FFBF7F", sort_order: 1, items: [] },
                    { label: "B", color: "#FFDF7F", sort_order: 2, items: [] },
                    { label: "C", color: "#FFFF7F", sort_order: 3, items: [] },
                    { label: "D", color: "#BFFF7F", sort_order: 4, items: [] },
                ]
            });
            fetchTierLists();
            setIsCreateModalOpen(false);
            setNewListName("");
        } catch (error) {
            console.error("Failed to create tier list", error);
            alert("Failed to create tier list");
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this Tier List?")) {
            try {
                await deleteTierList(id);
                fetchTierLists();
            } catch (error) {
                console.error("Failed to delete", error);
            }
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col relative">
            <Header onNavigate={onNavigate} onLogout={onLogout} activePage="tier-lists" />

            <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-12 flex flex-col gap-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-white">Your Tier Lists</h1>
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-[#0B0F13] rounded-full font-bold hover:bg-emerald-400 transition shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Create New
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-20 text-slate-500">Loading...</div>
                ) : tierLists.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 bg-surface-dark rounded-2xl border border-white/5">
                        <span className="material-symbols-outlined text-6xl mb-4 opacity-50">view_kanban</span>
                        <p className="text-xl">No Tier Lists found.</p>
                        <p className="text-sm mt-2">Create one to start ranking your games!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tierLists.map((list) => (
                            <div
                                key={list.id}
                                onClick={() => onNavigate({ view: 'tier-list-editor', params: list.id })}
                                className="group bg-surface-dark border border-white/5 rounded-2xl p-6 hover:border-primary/50 cursor-pointer transition-all hover:scale-[1.02] shadow-sm hover:shadow-xl"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center">
                                        <span className="material-symbols-outlined text-2xl">view_kanban</span>
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(e, list.id)}
                                        className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-red-400 transition"
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{list.name}</h3>
                                <p className="text-sm text-slate-500">
                                    Created on {new Date(list.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Tier List Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-surface-dark rounded-2xl shadow-2xl border border-white/5 p-8 animate-in fade-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold text-white mb-6">Create New Tier List</h2>

                        <div className="flex flex-col gap-2 mb-8">
                            <label className="text-text-muted text-sm font-medium ml-1">List Name</label>
                            <input
                                className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-4 text-text-light placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                                placeholder="e.g. My Favorite RPGs"
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') submitCreateNew();
                                }}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-6 py-3 rounded-full text-text-muted font-medium hover:text-white hover:bg-white/5 transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitCreateNew}
                                disabled={!newListName.trim()}
                                className="px-8 py-3 bg-primary hover:bg-emerald-400 text-background-dark rounded-full font-bold shadow-lg shadow-primary/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create List
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TierListDashboard;
