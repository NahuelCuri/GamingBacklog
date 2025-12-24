import React from 'react';
import Header from './Header';

const AdminUsersPage = ({ onNavigate, onLogout }) => {
    return (
        <div className="bg-[#0B0F13] text-[#F8FAFC] h-screen overflow-hidden flex flex-col font-sans">
            <Header onNavigate={onNavigate} onLogout={onLogout} activePage="admin-users" />

            <main className="w-full max-w-7xl mx-auto flex flex-col h-full overflow-hidden relative px-6 md:px-12">
                {/* Internal Page Header (Breadcrumbs & Title) derived from provided HTML */}
                <div className="h-24 flex items-center justify-between border-b border-[#30363d] shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-[#94A3B8] text-xs font-medium mb-1">
                            <span>AdminUI</span>
                            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                            <span className="text-[#22C55E]">User Management</span>
                        </div>
                        <h1 className="text-3xl font-bold text-[#F8FAFC] tracking-tight">Team Members</h1>
                    </div>
                    {/* Replicated actions from HTML but removed profile picture as it's in the global header */}
                    <div className="flex items-center gap-4">
                        <button className="size-10 rounded-full bg-[#161B22] border border-[#30363d] text-[#94A3B8] hover:text-white hover:border-[#22C55E]/50 transition-all flex items-center justify-center relative">
                            <span className="material-symbols-outlined text-xl">notifications</span>
                            <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-[#161B22]"></span>
                        </button>
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
                                    />
                                </div>
                                <button className="size-12 flex-shrink-0 rounded-full bg-[#161B22] border border-[#30363d] text-[#94A3B8] text-sm font-medium hover:text-white hover:border-[#94A3B8] transition-colors flex items-center justify-center" title="Filter">
                                    <span className="material-symbols-outlined">filter_list</span>
                                </button>
                            </div>
                            <button className="hidden sm:flex h-12 px-6 items-center justify-center rounded-full bg-[#22C55E] hover:bg-[#16a34a] text-white text-sm font-semibold transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] cursor-pointer">
                                <span className="material-symbols-outlined text-xl mr-2">add</span>
                                Add User
                            </button>
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
                                {/* User 1: Alex Johnson */}
                                <div className="group relative md:grid grid-cols-12 gap-4 items-center p-4 md:px-6 md:py-5 bg-[#161B22] rounded-2xl border border-transparent hover:border-[#30363d]/80 transition-all shadow-sm hover:shadow-md hover:bg-[#1c222b]">
                                    <div className="col-span-5 flex items-center gap-4">
                                        <div className="size-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold border border-indigo-500/30">
                                            AJ
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-base font-medium text-white">Alex Johnson</span>
                                            <span className="text-sm text-[#94A3B8]">alex.j@company.com</span>
                                        </div>
                                    </div>
                                    <div className="col-span-3 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-[#0B0F13] border border-[#30363d] text-[#94A3B8]">
                                            <span className="material-symbols-outlined text-sm mr-2 text-purple-400">admin_panel_settings</span>
                                            Administrator
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            <span className="size-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
                                            Active
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex justify-end gap-3 opacity-100 transition-opacity">
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-indigo-500/20 border border-[#30363d] hover:border-indigo-500/50 flex items-center justify-center text-[#94A3B8] hover:text-indigo-400 transition-colors" title="Edit User">
                                            <span className="material-symbols-outlined text-lg">edit_square</span>
                                        </button>
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-red-500/20 border border-[#30363d] hover:border-red-500/50 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-colors" title="Remove User">
                                            <span className="material-symbols-outlined text-lg">delete_forever</span>
                                        </button>
                                    </div>
                                </div>

                                {/* User 2: Sarah Williams */}
                                <div className="group relative md:grid grid-cols-12 gap-4 items-center p-4 md:px-6 md:py-5 bg-[#161B22] rounded-2xl border border-transparent hover:border-[#30363d]/80 transition-all shadow-sm hover:shadow-md hover:bg-[#1c222b]">
                                    <div className="col-span-5 flex items-center gap-4">
                                        <div className="size-12 rounded-full bg-cover bg-center border border-[#30363d]" data-alt="Portrait of Sarah Williams" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCo20FTtG7Awx38xaybdxE7imisAIwyXhwqTdCycJPACOD7t8rlNkgIfJKjxRdSJ6UCMTbIRPdReUbVEYKNtA4iu9OlSnqiVlmq5FMmpwzCTOpnJ4bA7-eGvlblnHouMH8fGH1ETLsk12Kym9jSVe9DBsRWLmM7EvyksHI3pEmgtWulST20Vl92vwCGOg4Zmu-2sEBNTmcoxSi1VyVPnLjekc9wPv6H_fr2Aj-kaGH_VkFXqCiGbvq_XvkxvS4XlCbHUmrSP_KbDOk')" }}></div>
                                        <div className="flex flex-col">
                                            <span className="text-base font-medium text-white">Sarah Williams</span>
                                            <span className="text-sm text-[#94A3B8]">s.williams@company.com</span>
                                        </div>
                                    </div>
                                    <div className="col-span-3 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-[#0B0F13] border border-[#30363d] text-[#94A3B8]">
                                            <span className="material-symbols-outlined text-sm mr-2 text-blue-400">edit_note</span>
                                            Editor
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            <span className="size-2 rounded-full bg-emerald-400 mr-2"></span>
                                            Active
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex justify-end gap-3 opacity-100 transition-opacity">
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-indigo-500/20 border border-[#30363d] hover:border-indigo-500/50 flex items-center justify-center text-[#94A3B8] hover:text-indigo-400 transition-colors" title="Edit User">
                                            <span className="material-symbols-outlined text-lg">edit_square</span>
                                        </button>
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-red-500/20 border border-[#30363d] hover:border-red-500/50 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-colors" title="Remove User">
                                            <span className="material-symbols-outlined text-lg">delete_forever</span>
                                        </button>
                                    </div>
                                </div>

                                {/* User 3: Michael Chen */}
                                <div className="group relative md:grid grid-cols-12 gap-4 items-center p-4 md:px-6 md:py-5 bg-[#161B22] rounded-2xl border border-transparent hover:border-[#30363d]/80 transition-all shadow-sm hover:shadow-md hover:bg-[#1c222b]">
                                    <div className="col-span-5 flex items-center gap-4">
                                        <div className="size-12 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold border border-orange-500/30">
                                            MC
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-base font-medium text-white">Michael Chen</span>
                                            <span className="text-sm text-[#94A3B8]">michael.chen@company.com</span>
                                        </div>
                                    </div>
                                    <div className="col-span-3 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-[#0B0F13] border border-[#30363d] text-[#94A3B8]">
                                            <span className="material-symbols-outlined text-sm mr-2 text-slate-400">visibility</span>
                                            Viewer
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-slate-700/30 text-slate-400 border border-slate-600/30">
                                            <span className="size-2 rounded-full bg-slate-500 mr-2"></span>
                                            Offline
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex justify-end gap-3 opacity-100 transition-opacity">
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-indigo-500/20 border border-[#30363d] hover:border-indigo-500/50 flex items-center justify-center text-[#94A3B8] hover:text-indigo-400 transition-colors" title="Edit User">
                                            <span className="material-symbols-outlined text-lg">edit_square</span>
                                        </button>
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-red-500/20 border border-[#30363d] hover:border-red-500/50 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-colors" title="Remove User">
                                            <span className="material-symbols-outlined text-lg">delete_forever</span>
                                        </button>
                                    </div>
                                </div>

                                {/* User 4: Jessica Davis */}
                                <div className="group relative md:grid grid-cols-12 gap-4 items-center p-4 md:px-6 md:py-5 bg-[#161B22] rounded-2xl border border-transparent hover:border-[#30363d]/80 transition-all shadow-sm hover:shadow-md hover:bg-[#1c222b]">
                                    <div className="col-span-5 flex items-center gap-4">
                                        <div className="size-12 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center text-sm font-bold border border-pink-500/30">
                                            JD
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-base font-medium text-white">Jessica Davis</span>
                                            <span className="text-sm text-[#94A3B8]">j.davis@company.com</span>
                                        </div>
                                    </div>
                                    <div className="col-span-3 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-[#0B0F13] border border-[#30363d] text-[#94A3B8]">
                                            <span className="material-symbols-outlined text-sm mr-2 text-blue-400">edit_note</span>
                                            Editor
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            <span className="size-2 rounded-full bg-emerald-400 mr-2"></span>
                                            Active
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex justify-end gap-3 opacity-100 transition-opacity">
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-indigo-500/20 border border-[#30363d] hover:border-indigo-500/50 flex items-center justify-center text-[#94A3B8] hover:text-indigo-400 transition-colors" title="Edit User">
                                            <span className="material-symbols-outlined text-lg">edit_square</span>
                                        </button>
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-red-500/20 border border-[#30363d] hover:border-red-500/50 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-colors" title="Remove User">
                                            <span className="material-symbols-outlined text-lg">delete_forever</span>
                                        </button>
                                    </div>
                                </div>

                                {/* User 5: David Miller */}
                                <div className="group relative md:grid grid-cols-12 gap-4 items-center p-4 md:px-6 md:py-5 bg-[#161B22] rounded-2xl border border-transparent hover:border-[#30363d]/80 transition-all shadow-sm hover:shadow-md hover:bg-[#1c222b]">
                                    <div className="col-span-5 flex items-center gap-4">
                                        <div className="size-12 rounded-full bg-cover bg-center border border-[#30363d]" data-alt="Portrait of David Miller" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuABm7-rXCm2PZPMeRhClzZY-TwcEiRx_hB4s0pPSh1kDUTGVjC4V8r4yqQeihoh2Pot-cWsOmfuFYIu-pOSy7d7IUi1wgIxo1Usqg25SWSzSmPKwgvdT48ittGx1weeavpfVmV4ZjirV82CW3F6IhU6BY8LqrEWXzmgqZuWqbj3S4jFErXMgFHtsBzRpIUuGQvb17cQGGjwsUy_xGwyFMi-WPFlrjWSZSlW_rrrVTwGccFRIaCg2oRYQLwpdeKlQawtewr1GEjlpc0')" }}></div>
                                        <div className="flex flex-col">
                                            <span className="text-base font-medium text-white">David Miller</span>
                                            <span className="text-sm text-[#94A3B8]">d.miller@company.com</span>
                                        </div>
                                    </div>
                                    <div className="col-span-3 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-[#0B0F13] border border-[#30363d] text-[#94A3B8]">
                                            <span className="material-symbols-outlined text-sm mr-2 text-slate-400">visibility</span>
                                            Viewer
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            <span className="size-2 rounded-full bg-amber-400 mr-2"></span>
                                            Pending
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex justify-end gap-3 opacity-100 transition-opacity">
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-indigo-500/20 border border-[#30363d] hover:border-indigo-500/50 flex items-center justify-center text-[#94A3B8] hover:text-indigo-400 transition-colors" title="Edit User">
                                            <span className="material-symbols-outlined text-lg">edit_square</span>
                                        </button>
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-red-500/20 border border-[#30363d] hover:border-red-500/50 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-colors" title="Remove User">
                                            <span className="material-symbols-outlined text-lg">delete_forever</span>
                                        </button>
                                    </div>
                                </div>

                                {/* User 6: Anna Lee */}
                                <div className="group relative md:grid grid-cols-12 gap-4 items-center p-4 md:px-6 md:py-5 bg-[#161B22] rounded-2xl border border-transparent hover:border-[#30363d]/80 transition-all shadow-sm hover:shadow-md hover:bg-[#1c222b]">
                                    <div className="col-span-5 flex items-center gap-4">
                                        <div className="size-12 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold border border-cyan-500/30">
                                            AL
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-base font-medium text-white">Anna Lee</span>
                                            <span className="text-sm text-[#94A3B8]">anna.lee@company.com</span>
                                        </div>
                                    </div>
                                    <div className="col-span-3 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-[#0B0F13] border border-[#30363d] text-[#94A3B8]">
                                            <span className="material-symbols-outlined text-sm mr-2 text-blue-400">edit_note</span>
                                            Editor
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex items-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-slate-700/30 text-slate-400 border border-slate-600/30">
                                            <span className="size-2 rounded-full bg-slate-500 mr-2"></span>
                                            Offline
                                        </div>
                                    </div>
                                    <div className="col-span-2 mt-3 md:mt-0 flex justify-end gap-3 opacity-100 transition-opacity">
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-indigo-500/20 border border-[#30363d] hover:border-indigo-500/50 flex items-center justify-center text-[#94A3B8] hover:text-indigo-400 transition-colors" title="Edit User">
                                            <span className="material-symbols-outlined text-lg">edit_square</span>
                                        </button>
                                        <button className="size-9 rounded-full bg-[#0B0F13] hover:bg-red-500/20 border border-[#30363d] hover:border-red-500/50 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-colors" title="Remove User">
                                            <span className="material-symbols-outlined text-lg">delete_forever</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Loading Pulse */}
                                <div className="flex justify-center py-4">
                                    <div className="animate-pulse flex space-x-2">
                                        <div className="size-2 bg-[#94A3B8]/30 rounded-full"></div>
                                        <div className="size-2 bg-[#94A3B8]/30 rounded-full"></div>
                                        <div className="size-2 bg-[#94A3B8]/30 rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FAB for Mobile */}
                <button className="sm:hidden absolute bottom-6 right-6 size-14 rounded-full bg-[#22C55E] text-white shadow-lg shadow-[#22C55E]/40 flex items-center justify-center z-20 hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl">add</span>
                </button>
            </main>
        </div>
    );
};

export default AdminUsersPage;
