import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

type Theme = 'light' | 'dark' | 'system';
type Language = 'en' | 'th' | 'zh' | 'system';

interface SettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  currentLang: 'en' | 'th' | 'zh';
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useLocalStorage<Theme>('app-theme', 'system');
  const [language, setLanguage] = useLocalStorage<Language>('app-language', 'th');
  const [currentLang, setCurrentLang] = useState<'en' | 'th' | 'zh'>('en');

  // Handle Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Handle Language
  useEffect(() => {
    if (language === 'system') {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('th')) setCurrentLang('th');
      else if (browserLang.startsWith('zh')) setCurrentLang('zh');
      else setCurrentLang('en');
    } else {
      setCurrentLang(language as 'en' | 'th' | 'zh');
    }
  }, [language]);

  return (
    <SettingsContext.Provider value={{ theme, setTheme, language, setLanguage, currentLang }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
