import React, { useState } from 'react';

const Header = ({ onNavigate, onLogout, activePage }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const isActive = (page) => activePage === page;
    const activeStyle = "text-text-light border-b-2 border-primary";
    const inactiveStyle = "text-text-muted hover:text-text-light transition-colors";

    return (
        <header className="w-full px-8 py-6 flex items-center justify-between bg-transparent shrink-0">
            <div className="flex items-center gap-8">
                {/* Logo - Clickable */}
                <button
                    onClick={() => onNavigate('dashboard')}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer text-left"
                >
                    <div className="size-8 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-xl">stadia_controller</span>
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Your<span className="text-primary">Backlog</span></h2>
                </button>

                {/* Navigation Links */}
                <nav className="hidden sm:flex items-center gap-6">
                    <button
                        onClick={() => onNavigate('dashboard')}
                        className={`text-sm font-medium py-1 ${isActive('dashboard') ? activeStyle : inactiveStyle}`}
                    >
                        Backlog
                    </button>
                    <button
                        onClick={() => onNavigate('picker')}
                        className={`text-sm font-medium py-1 ${isActive('picker') ? activeStyle : inactiveStyle}`}
                    >
                        Random Picker
                    </button>
                    <button
                        onClick={() => onNavigate('statistics')}
                        className={`text-sm font-medium py-1 ${isActive('statistics') ? activeStyle : inactiveStyle}`}
                    >
                        Statistics
                    </button>
                    <button
                        className="text-sm font-medium text-text-muted hover:text-text-light transition-colors py-1"
                    >
                        Lists
                    </button>
                </nav>
            </div>

            <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center bg-surface-dark dark:bg-surface-dark bg-white rounded-full px-4 py-2 border border-white/5 shadow-sm min-w-[320px]">
                    <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                    <input className="bg-transparent border-none focus:ring-0 text-sm w-full text-slate-200 placeholder-slate-500 outline-none" placeholder="Search library..." type="text" />
                </div>

                {/* User Profile Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="size-10 rounded-full bg-cover bg-center border-2 border-surface-dark cursor-pointer hover:border-primary/50 transition-colors"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBTENNs0w-Q_UYgtXNYDjFB4O8GuWCZi3MwFvmM_azKJL62pt41IUH0xMvFJvqiH2swa_fLB_TGx0vPrxRFYz20Y7jXqZghZIW9r_-Qk4Wl0n8EXL_doZOu-Gnm2828LHvIV_vuT9Kw2IdDr_qX-yupXncj2l8srLD2ugKaEEDXucgOOIcI6eU-M5HPPPoNFbasuNAYUWGl-tr3oB5Ybf0gGqWndld8zIOcn3AxoZl3LvIFPynrgrqtCj6Vz2F4WtghxaJRvXAU63I")' }}
                    ></button>

                    {isDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                            <div className="absolute right-0 top-full mt-2 w-48 bg-surface-dark border border-white/5 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <button
                                    onClick={() => onLogout()}
                                    className="w-full text-left px-4 py-3 text-sm text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 group"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-red-400 transition-colors">logout</span>
                                    Log out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
