import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Monitor, Globe, LogIn, LogOut, Menu, X, Download, Trash2, History, Wallet, Target, FileSpreadsheet, Calendar, Briefcase } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { useAuth } from '../contexts/AuthContext';
import { UserPreferences } from '../types';

export function Header({ 
  onInstall, 
  setShowResetConfirm, 
  setShowActivityLog,
  setShowGoalModal,
  setShowExportModal,
  setShowLeaveModal,
  preferences,
  updatePreferences
}: { 
  onInstall?: () => void; 
  setShowResetConfirm: (show: boolean) => void; 
  setShowActivityLog: (show: boolean) => void;
  setShowGoalModal: (show: boolean) => void;
  setShowExportModal: (show: boolean) => void;
  setShowLeaveModal: (show: boolean) => void;
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
}) {
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
    <header className="glass-panel mx-4 mt-3 rounded-3xl px-6 py-4 flex justify-between items-center transition-colors relative z-50">
      <div className="flex items-center gap-3">
        <div className="relative group">
          {/* 3D Liquid Glass Logo Container */}
          <div className="relative w-10 h-10 flex items-center justify-center">
            {/* Background Liquid Layer */}
            <div className={`absolute inset-0 bg-gradient-to-br rounded-2xl blur-[2px] opacity-80 group-hover:scale-110 transition-all duration-500 animate-pulse ${
              theme === 'dark' 
                ? 'from-cyan-500 via-blue-600 to-indigo-700' 
                : 'from-indigo-500 via-purple-500 to-pink-500'
            }`}></div>
            
            {/* Glass Layer */}
            <div className="absolute inset-0 bg-white/20 dark:bg-slate-900/20 backdrop-blur-md rounded-2xl border border-white/40 dark:border-slate-700/40 shadow-xl transform -rotate-3 group-hover:rotate-0 transition-transform duration-500"></div>
            
            {/* Icon Layer */}
            <Wallet className="w-6 h-6 text-white relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] transform group-hover:scale-110 transition-transform duration-300" />
            
            {/* Shine Effect */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-2xl pointer-events-none"></div>
          </div>
          
          {/* Day/Night Indicator Dot */}
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-colors duration-500 ${theme === 'dark' ? 'bg-amber-400' : 'bg-indigo-600'}`}></div>
        </div>
        
        <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-indigo-200 dark:to-white bg-clip-text text-transparent">
          {t.appTitle}
        </h1>
      </div>
      
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
                <button onClick={() => { logout(); loginWithGoogle(); }} className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                  <LogIn className="w-4 h-4" />
                  <span>{t.switchAccount || 'สลับบัญชี Google'}</span>
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

            {/* Activity Log */}
            <button 
              onClick={() => { setShowActivityLog(true); setIsMenuOpen(false); }}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <History className="w-4 h-4" />
              <span>{t.history || 'บันทึกกิจกรรม'}</span>
            </button>

            {/* Leave Planning */}
            <button 
              onClick={() => { setShowLeaveModal(true); setIsMenuOpen(false); }}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>{t.leavePlanning || 'วางแผนการลาหยุด'}</span>
            </button>

            {/* Goals */}
            <button 
              onClick={() => { setShowGoalModal(true); setIsMenuOpen(false); }}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <Target className="w-4 h-4 text-indigo-500" />
              <span>{t.goals || 'เป้าหมายรายได้'}</span>
            </button>

            {/* Export CSV Data */}
            <button 
              onClick={() => { setShowExportModal(true); setIsMenuOpen(false); }}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>{t.exportData || 'ส่งออกข้อมูล (CSV)'}</span>
            </button>

            {/* Clear All Data */}
            <button 
              onClick={() => { setShowResetConfirm(true); setIsMenuOpen(false); }}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.resetData || 'ล้างข้อมูลทั้งหมด'}</span>
            </button>

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

            {/* Work Type Profile Selector */}
            {preferences?.workType && (
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Briefcase className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium">
                    {currentLang === 'th' ? 'รูปแบบงานหลัก' : currentLang === 'zh' ? '工作性质' : 'Work Profile'}
                  </span>
                </div>
                <select
                  value={preferences.workType}
                  onChange={(e) => updatePreferences({ workType: e.target.value as any })}
                  className="bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none cursor-pointer text-right max-w-[140px] truncate"
                >
                  <option value="rider" className="text-slate-900">
                    {currentLang === 'th' ? '🏍️ ไรเดอร์' : '🏍️ Rider'}
                  </option>
                  <option value="freelance" className="text-slate-900">
                    {currentLang === 'th' ? '💻 ฟรีแลนซ์' : '💻 Freelancer'}
                  </option>
                  <option value="salary" className="text-slate-900">
                    {currentLang === 'th' ? '💼 งานประจำ' : '💼 Salary'}
                  </option>
                </select>
              </div>
            )}

            {/* Gemini Model Selector */}
            <div className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="text-sm font-medium">
                  {currentLang === 'th' ? 'โมเดล Gemini (AI Model)' : 'Gemini Model'}
                </span>
              </div>
              <select
                value={preferences?.geminiModel || 'gemini-3.5-flash'}
                onChange={(e) => updatePreferences({ geminiModel: e.target.value })}
                className="bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none cursor-pointer text-right max-w-[140px] truncate"
              >
                <option value="gemini-3.5-flash" className="text-slate-900">Gemini 3.5 Flash</option>
                <option value="gemini-2.5-flash" className="text-slate-900">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro" className="text-slate-900">Gemini 2.5 Pro</option>
                <option value="gemini-3.1-pro-preview" className="text-slate-900">Gemini 3.1 Pro</option>
              </select>
            </div>

            {/* Install App */}
            {onInstall && (
              <button 
                onClick={() => {
                  onInstall();
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>{t.installApp}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
