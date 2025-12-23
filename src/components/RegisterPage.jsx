import React, { useState } from 'react';
import { createUser } from '../services/api';

const RegisterPage = ({ onRegister, onNavigate }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Assuming createUser returns the created user object
            const user = await createUser({ username, email, password });
            onRegister(user);
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative w-full max-w-md mx-auto">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="relative bg-surface-dark rounded-2xl shadow-card p-8 md:p-12 w-full border border-white/5">
                <div className="flex flex-col items-center mb-10 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                        <span className="material-symbols-outlined text-3xl">person_add</span>
                    </div>
                    <h2 className="text-3xl font-light tracking-tight text-white">Create Account</h2>
                    <p className="text-text-muted text-sm font-light">Enter your details to register</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-shake">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-muted ml-1" htmlFor="username">Username</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted group-focus-within:text-primary transition-colors duration-200">
                                <span className="material-symbols-outlined text-xl">badge</span>
                            </div>
                            <input
                                autoComplete="username"
                                className="block w-full rounded-full border-none bg-[#222933] py-3.5 pl-12 pr-4 text-white placeholder-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:bg-[#2A323D] transition-all duration-200 ease-in-out text-sm"
                                id="username"
                                name="username"
                                placeholder="johndoe"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-muted ml-1" htmlFor="email">Email</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted group-focus-within:text-primary transition-colors duration-200">
                                <span className="material-symbols-outlined text-xl">mail</span>
                            </div>
                            <input
                                autoComplete="email"
                                className="block w-full rounded-full border-none bg-[#222933] py-3.5 pl-12 pr-4 text-white placeholder-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:bg-[#2A323D] transition-all duration-200 ease-in-out text-sm"
                                id="email"
                                name="email"
                                placeholder="name@example.com"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-sm font-medium text-text-muted" htmlFor="password">Password</label>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted group-focus-within:text-primary transition-colors duration-200">
                                <span className="material-symbols-outlined text-xl">key</span>
                            </div>
                            <input
                                autoComplete="new-password"
                                className="block w-full rounded-full border-none bg-[#222933] py-3.5 pl-12 pr-4 text-white placeholder-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:bg-[#2A323D] transition-all duration-200 ease-in-out text-sm"
                                id="password"
                                name="password"
                                placeholder="••••••••"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    <button
                        className="w-full flex justify-center items-center py-3.5 px-4 rounded-full shadow-glow text-sm font-semibold text-[#0B0F13] bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-dark focus:ring-primary transition-all duration-200 mt-8 group cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Registering...' : 'Register'}
                        {!isLoading && <span className="material-symbols-outlined ml-2 text-lg group-hover:translate-x-1 transition-transform duration-200">arrow_forward</span>}
                    </button>
                </form>
                <div className="mt-8 text-center">
                    <p className="text-sm text-text-muted">
                        Already have an account?
                        <button
                            className="font-medium text-primary hover:text-primary/80 transition-colors ml-1 bg-transparent border-none cursor-pointer"
                            onClick={() => onNavigate('login')}
                        >
                            Sign In
                        </button>
                    </p>
                </div>
            </div>
            <div className="mt-8 flex justify-center space-x-6 text-xs text-text-muted/50">
                <a className="hover:text-text-muted transition-colors" href="#">Privacy Policy</a>
                <span>•</span>
                <a className="hover:text-text-muted transition-colors" href="#">Terms of Service</a>
            </div>
        </div>
    );
};

export default RegisterPage;
