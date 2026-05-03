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

    const updateThemeColor = (activeTheme: 'light' | 'dark') => {
      const metas = document.querySelectorAll("meta[name='theme-color']");
      const color = activeTheme === 'dark' ? '#020617' : '#f8fafc';
      
      if (metas.length > 0) {
        metas.forEach(meta => {
          meta.setAttribute("content", color);
          meta.removeAttribute("media"); // override the initial media query
        });
      } else {
        const metaThemeColor = document.createElement("meta");
        metaThemeColor.setAttribute("name", "theme-color");
        metaThemeColor.setAttribute("content", color);
        document.head.appendChild(metaThemeColor);
      }
    };

    let appliedTheme: 'light' | 'dark' = 'light';
    if (theme === 'system') {
      appliedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      appliedTheme = theme as 'light' | 'dark';
    }
    
    root.classList.add(appliedTheme);
    updateThemeColor(appliedTheme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        const appliedTheme = mediaQuery.matches ? 'dark' : 'light';
        root.classList.add(appliedTheme);
        
        const metas = document.querySelectorAll("meta[name='theme-color']");
        const color = appliedTheme === 'dark' ? '#020617' : '#f8fafc';
        metas.forEach(meta => {
          meta.setAttribute("content", color);
          meta.removeAttribute("media");
        });
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
