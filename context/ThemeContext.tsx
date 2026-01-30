
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark'; // O tema que está realmente sendo exibido (ex: system -> dark)
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always dark
  const theme = 'dark';
  const resolvedTheme = 'dark';

  useEffect(() => {
    // Ensure .dark class is present for Tailwind (just in case)
    document.documentElement.classList.add('dark');
  }, []);

  const setTheme = (t: Theme) => {
    // No-op
    // console.log("Theme switching is disabled. Enforced Dark Mode.");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
