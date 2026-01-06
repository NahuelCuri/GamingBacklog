import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    pointerWithin,
    rectIntersection,
    getFirstCollision,
    closestCorners,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    rectSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getTierList, updateTierList } from '../services/tierlist';
import { getGames } from '../services/api';
import html2canvas from 'html2canvas';
import Header from './Header';

// --- Draggable Game Item Component ---
const SortableGameItem = ({ game, id }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: id, data: { type: 'Game', game } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="relative size-20 shrink-0 overflow-hidden rounded-lg shadow-lg cursor-grab active:cursor-grabbing hover:scale-105 transition-transform touch-none"
            title={game.title}
        >
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${game.cover_url || game.cover}')` }}
            >
                {!game.cover_url && !game.cover && (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center text-[8px] text-center p-1">
                        {game.title}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Droppable Tier Row Component ---
const SortableTierRow = ({ row, games, onAddRow, onDeleteRow, onUpdateRow }) => {
    const { setNodeRef } = useSortable({
        id: row.id,
        data: {
            type: 'TierRow',
            row
        },
        disabled: true // The row itself isn't draggable in this version, but its contents are
    });

    return (
        <div className="group flex flex-col md:flex-row min-h-[120px] overflow-hidden rounded-xl bg-surface-dark border border-[#1E293B] transition-all hover:border-[#2C3B4E]">
            {/* Label Section */}
            <div className="flex md:w-32 shrink-0 items-center justify-center p-4 md:p-0 md:border-r border-[#1E293B]" style={{ backgroundColor: `${row.color}1A` }}>
                <div
                    className="flex h-16 w-16 items-center justify-center rounded-full shadow-[0_0_20px_rgba(0,0,0,0.2)]"
                    style={{ backgroundColor: row.color }}
                >
                    <span className="font-display text-3xl font-black text-[#0B0F13]">{row.label}</span>
                </div>
            </div>

            {/* Droppable Area */}
            <SortableContext items={games.map(g => g.dragId)} strategy={rectSortingStrategy}>
                <div ref={setNodeRef} className="flex flex-1 flex-wrap content-start items-center gap-3 p-4 bg-surface-dark transition-colors group-hover:bg-[#1E252F] min-h-[120px]">
                    {games.length === 0 && (
                        <span className="text-sm text-gray-600 italic select-none">Drop games here</span>
                    )}
                    {games.map((game) => (
                        <SortableGameItem key={game.dragId} id={game.dragId} game={game} />
                    ))}
                </div>
            </SortableContext>

            {/* Controls */}
            <div className="flex w-12 flex-col items-center justify-center gap-2 border-l border-[#1E293B] bg-[#1E252F] opacity-0 transition-opacity group-hover:opacity-100 p-1">
                <button className="text-gray-400 hover:text-white" onClick={() => onUpdateRow(row.id, 'up')}><span className="material-symbols-outlined text-[20px]">keyboard_arrow_up</span></button>
                <button className="text-gray-400 hover:text-white"><span className="material-symbols-outlined text-[20px]">settings</span></button>
                <button className="text-gray-400 hover:text-white" onClick={() => onUpdateRow(row.id, 'down')}><span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span></button>
            </div>
        </div>
    );
};


// --- Main Editor Component ---
const TierListEditor = ({ tierListId, onNavigate }) => {
    const [tierList, setTierList] = useState(null);
    const [unrankedGames, setUnrankedGames] = useState([]);
    const [dragItems, setDragItems] = useState({}); // Map of containerId -> array of games
    const [isLoading, setIsLoading] = useState(true);
    const [activeDragItem, setActiveDragItem] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showAllGames, setShowAllGames] = useState(false);
    const [dropAnimationEnabled, setDropAnimationEnabled] = useState(true);
    const captureRef = useRef(null);
    const lastOverId = useRef(null); // Keep track of last over id for smoother transitions
    const restoreScrollPos = useRef(null); // To prevent scroll jumps when returning to pool

    // Restore scroll position after drag end if needed
    useLayoutEffect(() => {
        if (restoreScrollPos.current !== null) {
            const pos = restoreScrollPos.current;
            window.scrollTo({ top: pos, behavior: 'instant' });

            // Backup scroll in the next frame
            requestAnimationFrame(() => {
                window.scrollTo({ top: pos, behavior: 'instant' });
            });

            restoreScrollPos.current = null;
        }
    });

    // Custom collision detection strategy
    const customCollisionDetection = useCallback(
        (args) => {
            const pointerCollisions = pointerWithin(args);

            // If pointer is inside something, use that
            if (pointerCollisions.length > 0) {
                return pointerCollisions;
            }

            // Fallback to rect intersection (good for containers)
            const rectCollisions = rectIntersection(args);
            if (rectCollisions.length > 0) {
                return rectCollisions;
            }

            // If nothing matched, we are truly outside.
            return [];
        },
        []
    );

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        const init = async () => {
            try {
                // Fetch Tier List and All Games
                const [listData, allGames] = await Promise.all([
                    getTierList(tierListId),
                    getGames()
                ]);

                setTierList(listData);

                // Process initial state
                // 1. Map existing tier items to games
                const initialItems = {};
                const rankedGameIds = new Set();

                // Existing Rows
                listData.rows.forEach(row => {
                    initialItems[row.id] = row.items.map(item => ({
                        ...item.game,
                        // We need a unique ID for dragging that persists. 
                        // Using game.id is fine unless we allow duplicates (we don't)
                        dragId: item.game.id
                    }));
                    row.items.forEach(i => rankedGameIds.add(i.game.id));
                });

                // Unranked Pool (Backlog games not in tiers)
                // We keep all unranked games in memory, but filter them in the render logic or here.
                // Actually, for dragItems state, it's better to having them all available if possible, 
                // but checking the previous implementation we were filtering here.
                // Let's load ALL unranked into state, and filter by 'showAllGames' in the render part.
                const unranked = allGames
                    .filter(g => !rankedGameIds.has(g.id))
                    .map(g => ({ ...g, dragId: g.id }));
                initialItems['unranked'] = unranked;

                setDragItems(initialItems);

            } catch (error) {
                console.error("Failed to load tier list", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (tierListId) {
            init();
        }
    }, [tierListId]);

    const handleDragStart = (event) => {
        setDropAnimationEnabled(true);
        const { active } = event;
        // Find the game object
        let game = null;
        for (const key in dragItems) {
            const found = dragItems[key].find(g => g.dragId === active.id);
            if (found) {
                game = found;
                break;
            }
        }
        setActiveDragItem(game);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        // Find source and destination containers
        const findContainer = (id) => {
            if (id in dragItems) return id;
            return Object.keys(dragItems).find(key => dragItems[key].find(g => g.dragId === id));
        };

        const activeContainer = findContainer(activeId);
        const overContainer = findContainer(overId);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        setDragItems((prev) => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            const activeIndex = activeItems.findIndex(i => i.dragId === activeId);
            const overIndex = overItems.findIndex(i => i.dragId === overId);

            let newIndex;
            if (overId in prev) {
                // We're over a container
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top >
                    over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;

                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return {
                ...prev,
                [activeContainer]: [
                    ...prev[activeContainer].filter(item => item.dragId !== activeId)
                ],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    activeItems[activeIndex],
                    ...prev[overContainer].slice(newIndex, prev[overContainer].length)
                ]
            };
        });
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        const activeId = active.id;
        const overId = over ? over.id : null;

        const findContainer = (id) => {
            if (id in dragItems) return id;
            return Object.keys(dragItems).find(key => dragItems[key].find(g => g.dragId === id));
        };

        const activeContainer = findContainer(activeId);
        const overContainer = findContainer(overId);

        // If dropped outside any droppable area, return to unranked
        if (!overContainer || !over) {
            // 1. DISABLE ANIMATION to prevent "flying" scroll
            setDropAnimationEnabled(false);

            // 2. Prevent auto-scroll by capturing current position
            restoreScrollPos.current = window.scrollY;

            // Also blur active element as a backup
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }

            if (activeContainer && activeContainer !== 'unranked') {
                setDragItems((prev) => {
                    const item = prev[activeContainer].find(i => i.dragId === activeId);
                    if (!item) return prev; // Should not happen

                    return {
                        ...prev,
                        [activeContainer]: prev[activeContainer].filter(i => i.dragId !== activeId),
                        ['unranked']: [...prev['unranked'], item]
                    };
                });
            }
            setActiveDragItem(null);
            return;
        }

        if (activeContainer && overContainer && activeContainer === overContainer) {
            const activeIndex = dragItems[activeContainer].findIndex(i => i.dragId === activeId);
            const overIndex = dragItems[overContainer].findIndex(i => i.dragId === overId);

            if (activeIndex !== overIndex) {
                setDragItems((prev) => ({
                    ...prev,
                    [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex),
                }));
            }
        }

        setActiveDragItem(null);
    };

    const [isSaveSuccessOpen, setIsSaveSuccessOpen] = useState(false);

    const handleSave = async () => {
        // Construct payload
        // Rows need to be reconstructed with items
        if (!tierList) return;

        const updatedRows = tierList.rows.map(row => {
            const items = dragItems[row.id] || [];
            return {
                ...row,
                items: items.map((game, index) => ({
                    game_id: game.id,
                    sort_order: index
                }))
            };
        });

        const payload = {
            ...tierList,
            rows: updatedRows
        };

        try {
            await updateTierList(tierList.id, payload);
            setIsSaveSuccessOpen(true);
        } catch (error) {
            console.error("Failed to save", error);
            alert("Failed to save.");
        }
    };

    const handleSaveImage = () => {
        if (!captureRef.current) return;
        html2canvas(captureRef.current, { backgroundColor: '#0B0F13' }).then(canvas => {
            const link = document.createElement('a');
            link.download = `${tierList.name}-tierlist.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    };

    const handleAddRow = () => {
        // Ideally we add to local state then save, or just add local visual row
        // For now let's just alert
        alert("Add Row feature coming soon!");
    }

    if (isLoading || !tierList) {
        return <div className="min-h-screen bg-background-dark text-white flex items-center justify-center">Loading...</div>;
    }

    // Filter unranked games by search AND status toggle
    const filteredUnranked = (dragItems['unranked'] || []).filter(g => {
        const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase());
        const isFinished = g.status === 'finished' || g.status === 'Finished';
        return matchesSearch && (showAllGames || isFinished);
    });

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            accessibility={{
                restoreFocus: false
            }}
            autoScroll={false}
        >
            <div className="bg-background-light dark:bg-background-dark text-[#F8FAFC] font-display min-h-screen flex flex-col overflow-x-hidden selection:bg-primary/30">
                <Header onNavigate={onNavigate} onLogout={() => window.location.reload()} activePage="tier-lists" />

                {/* Main Content */}
                <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
                    {/* Page Title & Controls */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-extrabold tracking-tight text-white">{tierList.name}</h2>
                            <p className="text-gray-400 max-w-2xl">Drag games from the pool below into the tier rows. Reorder them as you see fit.</p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">search</span>
                                <input
                                    className="w-full h-10 rounded-full bg-[#1E293B] border-none pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                                    placeholder="Search games..."
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E293B] text-white hover:bg-[#2C3B4E] transition" title="Add Custom Image">
                                <span className="material-symbols-outlined">add_photo_alternate</span>
                            </button>
                        </div>
                    </div>

                    {/* Tier List Container */}
                    <div className="flex flex-col gap-4" ref={captureRef}>
                        {tierList.rows.map(row => (
                            <SortableTierRow
                                key={row.id}
                                row={row}
                                games={dragItems[row.id] || []}
                                onAddRow={handleAddRow}
                            />
                        ))}

                        {/* Add New Row Button */}
                        <div className="flex justify-center pt-2">
                            <button
                                onClick={handleAddRow}
                                className="group flex items-center gap-2 px-6 py-2 rounded-full border border-dashed border-gray-600 text-gray-400 hover:border-primary hover:text-primary transition-colors text-sm font-medium"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Add New Row
                            </button>
                        </div>
                    </div>

                    {/* Unranked Game Pool */}
                    <div className="mt-8 rounded-2xl bg-[#0B0F13] border border-[#1E293B] p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">layers</span>
                                Unranked Games
                            </h3>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${showAllGames ? 'bg-primary border-primary' : 'border-gray-500 group-hover:border-primary'}`}>
                                        {showAllGames && <span className="material-symbols-outlined text-black text-[16px] font-bold">check</span>}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={showAllGames}
                                        onChange={() => setShowAllGames(!showAllGames)}
                                    />
                                    <span className={`text-sm font-medium transition-colors ${showAllGames ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                                        Show All Games
                                    </span>
                                </label>
                                <span className="text-xs font-semibold bg-[#1E293B] text-gray-400 px-3 py-1 rounded-full">{filteredUnranked.length} Games</span>
                            </div>
                        </div>

                        <SortableContext items={filteredUnranked.map(g => g.dragId)} strategy={rectSortingStrategy}>
                            <div className="flex flex-wrap gap-4 min-h-[140px] items-start">
                                {filteredUnranked.map((game) => (
                                    <SortableGameItem key={game.dragId} id={game.dragId} game={game} />
                                ))}
                            </div>
                        </SortableContext>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pb-8">
                        <button
                            onClick={() => window.location.reload()}
                            className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#1E293B] px-5 text-sm font-semibold text-white transition hover:bg-[#2C3B4E]"
                        >
                            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                            <span>Reset</span>
                        </button>
                        <button
                            onClick={handleSaveImage}
                            className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#1E293B] px-5 text-sm font-semibold text-white transition hover:bg-[#2C3B4E]"
                        >
                            <span className="material-symbols-outlined text-[20px]">download</span>
                            <span>Save Image</span>
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-background-dark transition hover:bg-emerald-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                        >
                            <span className="material-symbols-outlined text-[20px]">save</span>
                            <span>Save</span>
                        </button>
                    </div>
                </main>

                {/* Footer */}
                <footer className="mt-auto py-6 border-t border-[#1E293B] text-center text-sm text-gray-500">
                    <p>© 2023 TierMaster. Built for gamers.</p>
                </footer>

                <DragOverlay dropAnimation={dropAnimationEnabled ? undefined : null}>
                    {activeDragItem ? (
                        <div
                            className="relative size-20 shrink-0 overflow-hidden rounded-lg shadow-2xl cursor-grabbing scale-105"
                        >
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{ backgroundImage: `url('${activeDragItem.cover_url || activeDragItem.cover}')` }}
                            />
                        </div>
                    ) : null}
                </DragOverlay>

                {/* Save Success Modal */}
                {isSaveSuccessOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSaveSuccessOpen(false)}></div>
                        <div className="relative w-full max-w-sm bg-surface-dark rounded-2xl shadow-2xl border border-white/5 p-6 animate-in fade-in zoom-in-95 duration-200 text-center">
                            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-2xl">check_circle</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Saved Successfully!</h3>
                            <p className="text-gray-400 text-sm mb-6">Your tier list changes have been safely stored.</p>
                            <button
                                onClick={() => setIsSaveSuccessOpen(false)}
                                className="w-full py-2.5 rounded-full bg-primary hover:bg-emerald-400 text-background-dark font-bold transition-all"
                            >
                                Awesome
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </DndContext>
    );
};

export default TierListEditor;
