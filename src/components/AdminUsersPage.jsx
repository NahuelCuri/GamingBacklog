import React, { useState, useEffect } from 'react';
import Header from './Header';
import { getUsers, deleteUser, updateUser } from '../services/api';

const AdminUsersPage = ({ onNavigate, onLogout }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm("Are you sure you want to delete this user?")) {
            try {
                await deleteUser(id);
                setUsers(users.filter(user => user.id !== id));
            } catch (error) {
                console.error("Failed to delete user", error);
                alert("Failed to delete user");
            }
        }
    };

    const handleEditClick = (user) => {
        setEditingUser({ ...user });
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        try {
            const payload = {
                username: editingUser.username,
                email: editingUser.email,
                role: editingUser.role
            };
            if (editingUser.password) {
                payload.password = editingUser.password;
            }
            const updatedUser = await updateUser(editingUser.id, payload);
            setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
            setEditingUser(null);
        } catch (error) {
            console.error("Failed to update user", error);
            alert("Failed to update user");
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = (
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.role.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesSearch;
    });

    // Helper to simulate status/avatar until backend supports it
    const getUserInitials = (name) => {
        return name ? name.substring(0, 2).toUpperCase() : '??';
    }

    return (
        <div className="bg-[#0B0F13] text-[#F8FAFC] h-screen overflow-hidden flex flex-col font-sans">
            <Header onNavigate={onNavigate} onLogout={onLogout} activePage="admin-users" />

            <main className="w-full max-w-7xl mx-auto flex flex-col h-full overflow-hidden relative px-6 md:px-12">
                {/* Internal Page Header */}
                <div className="h-24 flex items-center justify-between border-b border-[#30363d] shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-[#94A3B8] text-xs font-medium mb-1">
                            <span>AdminUI</span>
                            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                            <span className="text-[#22C55E]">User Management</span>
                        </div>
                        <h1 className="text-3xl font-bold text-[#F8FAFC] tracking-tight">Team Members</h1>
                    </div>
                </div>

                {/* Main Scrollable Content */}
                <div className="flex-1 overflow-y-auto py-6 md:py-12 scroll-smooth">
                    <div className="flex flex-col gap-8">
                        {/* Search and Filters */}
                        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                            <div className="flex flex-1 w-full lg:w-auto gap-4">
                                <div className="relative w-full max-w-lg group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#94A3B8] group-focus-within:text-[#22C55E] transition-colors">search</span>
                                    <input
                                        className="w-full h-12 pl-12 pr-4 bg-[#161B22] border border-[#30363d] rounded-full text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all shadow-sm outline-none"
                                        placeholder="Search by name, email, or role..."
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* User List */}
                        <div className="w-full pb-20">
                            {/* Table Header */}
                            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider border-b border-[#30363d]/50 mb-2">
                                <div className="col-span-5">User Details</div>
                                <div className="col-span-3">Role</div>
                                <div className="col-span-2">Status</div>
                                <div className="col-span-2 text-right">Actions</div>
                            </div>

                            <div className="flex flex-col gap-3">
                                {isLoading ? (
                                    <div className="flex justify-center py-4">
                                        <div className="animate-pulse flex space-x-2">
                                            <div className="size-2 bg-[#94A3B8]/30 rounded-full"></div>
                                            <div className="size-2 bg-[#94A3B8]/30 rounded-full"></div>
                                            <div className="size-2 bg-[#94A3B8]/30 rounded-full"></div>
                                        </div>
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="text-center text-[#94A3B8] py-8">No users found.</div>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <div key={user.id} className="group relative md:grid grid-cols-12 gap-4 items-center p-4 md:px-6 md:py-5 bg-[#161B22] rounded-2xl border border-transparent hover:border-[#30363d]/80 transition-all shadow-sm hover:shadow-md hover:bg-[#1c222b]">
                                            <div className="col-span-5 flex items-center gap-4">
                                                <div className="size-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold border border-indigo-500/30">
                                                    {getUserInitials(user.username)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-base font-medium text-white">{user.username}</span>
                                                    <span className="text-sm text-[#94A3B8]">{user.email}</span>
                                                </div>
                                            </div>
                                            <div className="col-span-3 mt-3 md:mt-0 flex items-center">
                                                <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-[#0B0F13] border border-[#30363d] ${user.role === 'admin' ? 'text-purple-400 border-purple-500/30' : 'text-[#94A3B8]'}`}>
                                                    <span className="material-symbols-outlined text-sm mr-2">{user.role === 'admin' ? 'admin_panel_settings' : 'person'}</span>
                                                    {user.role === 'admin' ? 'Administrator' : 'User'}
                                                </div>
                                            </div>
                                            <div className="col-span-2 mt-3 md:mt-0 flex items-center">
                                                <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    <span className="size-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
                                                    Active
                                                </div>
                                            </div>
                                            <div className="col-span-2 mt-3 md:mt-0 flex justify-end gap-4 opacity-100 transition-opacity pr-2">
                                                <button
                                                    onClick={() => handleEditClick(user)}
                                                    className="text-[#94A3B8] hover:text-[#22C55E] transition-colors"
                                                    title="Edit User"
                                                >
                                                    <span className="material-symbols-outlined text-xl">edit_square</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="text-[#94A3B8] hover:text-red-400 transition-colors"
                                                    title="Remove User"
                                                >
                                                    <span className="material-symbols-outlined text-xl">delete_forever</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit User Modal */}
                {editingUser && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#161B22] border border-[#30363d] rounded-2xl w-full max-w-md shadow-2xl p-6">
                            <h2 className="text-xl font-bold text-white mb-6">Edit User</h2>

                            <div className="flex flex-col gap-4 mb-8 max-h-[60vh] overflow-y-auto pr-2">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-[#94A3B8]">Username</label>
                                    <input
                                        type="text"
                                        value={editingUser.username || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                                        className="w-full h-11 px-4 bg-[#0B0F13] border border-[#30363d] rounded-xl text-[#F8FAFC] focus:border-[#22C55E] outline-none transition-colors"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-[#94A3B8]">Email</label>
                                    <input
                                        type="email"
                                        value={editingUser.email || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                        className="w-full h-11 px-4 bg-[#0B0F13] border border-[#30363d] rounded-xl text-[#F8FAFC] focus:border-[#22C55E] outline-none transition-colors"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-[#94A3B8]">Password (Leave empty to keep current)</label>
                                    <input
                                        type="password"
                                        placeholder="New Password"
                                        value={editingUser.password || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                                        className="w-full h-11 px-4 bg-[#0B0F13] border border-[#30363d] rounded-xl text-[#F8FAFC] focus:border-[#22C55E] outline-none transition-colors"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-[#94A3B8]">Role</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setEditingUser({ ...editingUser, role: 'user' })}
                                            className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${editingUser.role === 'user'
                                                ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                                                : 'bg-[#0B0F13] border-[#30363d] text-[#94A3B8] hover:border-[#94A3B8]'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-lg">person</span>
                                            User
                                        </button>
                                        <button
                                            onClick={() => setEditingUser({ ...editingUser, role: 'admin' })}
                                            className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${editingUser.role === 'admin'
                                                ? 'bg-purple-500/10 border-purple-500 text-purple-400'
                                                : 'bg-[#0B0F13] border-[#30363d] text-[#94A3B8] hover:border-[#94A3B8]'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                                            Admin
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setEditingUser(null)}
                                    className="flex-1 py-3 px-4 bg-[#0B0F13] border border-[#30363d] hover:bg-[#1c222b] text-[#94A3B8] rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="flex-1 py-3 px-4 bg-[#22C55E] hover:bg-[#16a34a] text-white rounded-xl font-semibold transition-colors shadow-lg shadow-[#22C55E]/20"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminUsersPage;
