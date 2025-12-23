import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getGames, createGame, updateGame, deleteGame, API_URL } from '../../services/api';

const initialState = {
    items: [],
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
};

// ... thunks code stays same ...
export const fetchGames = createAsyncThunk('games/fetchGames', async () => {
    const response = await getGames();
    return response;
});
// ... other thunks ...
export const addNewGame = createAsyncThunk('games/addNewGame', async (gameData) => {
    const response = await createGame(gameData);
    return response;
});
export const updateExistingGame = createAsyncThunk('games/updateGame', async ({ id, data }) => {
    const response = await updateGame(id, data);
    return response;
});
export const removeGame = createAsyncThunk('games/removeGame', async (id) => {
    await deleteGame(id);
    return id;
});

const gamesSlice = createSlice({
    name: 'games',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch Games
            .addCase(fetchGames.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchGames.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = action.payload.map(g => {
                    let cover = g.cover_url || g.cover;
                    if (cover && !cover.startsWith('http') && !cover.startsWith('data:')) {
                        cover = `${API_URL}${cover}`;
                    }
                    return {
                        id: g.id,
                        title: g.title,
                        genre: g.genre,
                        cover: cover,
                        lastPlayed: 'Recently',
                        status: g.status.charAt(0).toUpperCase() + g.status.slice(1),
                        statusColor: g.status === 'playing' ? 'bg-violet-500' : (g.status === 'finished' ? 'bg-primary' : 'bg-slate-500'),
                        hours: g.hours_played,
                        dateFinished: g.date_finished,
                        score: g.score,
                        releaseYear: g.release_year,
                        review: g.review_text,
                        hltb: g.hltb_estimate,
                        vibes: g.Tags ? g.Tags.map(t => t.name) : []
                    };
                });
            })
            .addCase(fetchGames.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message;
            })
            // Add Game
            .addCase(addNewGame.fulfilled, (state, action) => {
                const createdGame = action.payload;
                let cover = createdGame.cover_url || createdGame.cover;
                if (cover && !cover.startsWith('http') && !cover.startsWith('data:')) {
                    cover = `${API_URL}${cover}`;
                }
                // Map response to frontend model
                const mappedGame = {
                    id: createdGame.id,
                    title: createdGame.title,
                    genre: createdGame.genre,
                    cover: cover,
                    lastPlayed: 'Recently',
                    status: createdGame.status.charAt(0).toUpperCase() + createdGame.status.slice(1),
                    statusColor: createdGame.status === 'playing' ? 'bg-violet-500' : (createdGame.status === 'finished' ? 'bg-primary' : 'bg-slate-500'),
                    hours: createdGame.hours_played,
                    dateFinished: createdGame.date_finished,
                    score: createdGame.score,
                    releaseYear: createdGame.release_year,
                    review: createdGame.review_text,
                    hltb: createdGame.hltb_estimate,
                    vibes: []
                };
                state.items.unshift(mappedGame);
            })
            // Update Game
            .addCase(updateExistingGame.fulfilled, (state, action) => {
                const updatedGame = action.payload;
                const index = state.items.findIndex(g => g.id === updatedGame.id);
                if (index !== -1) {
                    let cover = updatedGame.cover_url || updatedGame.cover;
                    if (cover && !cover.startsWith('http') && !cover.startsWith('data:')) {
                        cover = `${API_URL}${cover}`;
                    }
                    // Update only the fields present in the response or re-map entirely
                    // Re-mapping for safety
                    state.items[index] = {
                        ...state.items[index], // keep local placeholders like 'lastPlayed' if needed
                        title: updatedGame.title,
                        genre: updatedGame.genre,
                        cover: cover,
                        status: updatedGame.status.charAt(0).toUpperCase() + updatedGame.status.slice(1),
                        statusColor: updatedGame.status === 'playing' ? 'bg-violet-500' : (updatedGame.status === 'finished' ? 'bg-primary' : 'bg-slate-500'),
                        hours: updatedGame.hours_played,
                        dateFinished: updatedGame.date_finished,
                        score: updatedGame.score,
                        releaseYear: updatedGame.release_year,
                        review: updatedGame.review_text,
                        hltb: updatedGame.hltb_estimate,
                        // vibes: ... (tags not yet in update response typically, unless handled)
                    };
                }
            })
            // Remove Game
            .addCase(removeGame.fulfilled, (state, action) => {
                console.log('Backend delete success for ID:', action.payload);
                console.log('Current items IDs:', state.items.map(i => i.id));
                const initialLength = state.items.length;
                state.items = state.items.filter(game => game.id !== action.payload);
                console.log('Items length after filter:', state.items.length);
                if (state.items.length === initialLength) {
                    console.warn('Game removal failed in state! ID not found or mismatch:', action.payload);
                }
            })
            .addCase(removeGame.rejected, (state, action) => {
                console.error('Backend delete failed:', action.error);
            });
    },
});

export default gamesSlice.reducer;
