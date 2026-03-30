import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Monitor, Globe, LogIn, LogOut, Menu, X } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { theme, setTheme, language, setLanguage, currentLang } = useSettings();
  const t = translations[currentLang];
  const { user, loginWithGoogle, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="glass-panel mx-4 mt-4 rounded-3xl px-6 py-4 flex justify-between items-center transition-colors relative z-50">
      <h1 className="text-xl font-bold text-slate-800 dark:text-white">{t.appTitle}</h1>
      
      <div ref={menuRef}>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
          aria-label="Menu"
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 glass-panel rounded-2xl flex flex-col p-2 gap-2">
            {/* Auth & Sheets */}
            {user ? (
              <div className="flex flex-col gap-2 p-2 border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-3 mb-2 px-1">
                  <img src={user.photoURL || ''} alt="Profile" className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-600" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.displayName || 'User'}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</span>
                  </div>
                </div>
                
                <button onClick={logout} className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors mt-1">
                  <LogOut className="w-4 h-4" />
                  <span>{t.logout}</span>
                </button>
              </div>
            ) : (
              <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                <button 
                  onClick={loginWithGoogle}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t.loginWithGoogle}</span>
                </button>
              </div>
            )}

            {/* Language Selector */}
            <div className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">{t.language}</span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none cursor-pointer text-right"
              >
                <option value="system" className="text-slate-900">{t.system}</option>
                <option value="en" className="text-slate-900">English</option>
                <option value="th" className="text-slate-900">ไทย</option>
                <option value="zh" className="text-slate-900">中文</option>
              </select>
            </div>

            {/* Theme Selector */}
            <div className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                {theme === 'light' ? <Sun className="w-4 h-4" /> :
                 theme === 'dark' ? <Moon className="w-4 h-4" /> :
                 <Monitor className="w-4 h-4" />}
                <span className="text-sm font-medium">{t.theme}</span>
              </div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none cursor-pointer text-right"
              >
                <option value="system" className="text-slate-900">{t.system}</option>
                <option value="light" className="text-slate-900">{t.light}</option>
                <option value="dark" className="text-slate-900">{t.dark}</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
