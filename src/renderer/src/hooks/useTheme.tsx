import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

// ============================================================================
// Context
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'askrename-theme';

// ============================================================================
// Provider 组件
// ============================================================================

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [theme, setThemeState] = useState<Theme>(() => {
        // 从 localStorage 读取，默认 system
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
            if (stored && ['light', 'dark', 'system'].includes(stored)) {
                return stored;
            }
        }
        return 'system';
    });

    const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    });

    // 计算实际主题
    const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

    // 监听系统主题变化
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    // 更新 HTML 类名和 localStorage
    useEffect(() => {
        const root = document.documentElement;
        if (resolvedTheme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme, resolvedTheme]);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((prev) => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'light';
            // system -> 切换到当前系统主题的反面
            return systemTheme === 'dark' ? 'light' : 'dark';
        });
    }, [systemTheme]);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
