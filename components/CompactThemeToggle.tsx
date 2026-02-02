
import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { cn } from './Shared';

export const CompactThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const options = [
        { value: 'light' as const, icon: Sun, label: 'Tema Claro' },
        { value: 'dark' as const, icon: Moon, label: 'Tema Escuro' },
        { value: 'system' as const, icon: Monitor, label: 'Tema Sistema' },
    ];

    return (
        <div className="flex bg-secondary/50 rounded-lg p-1 border border-border gap-0.5">
            {options.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    onClick={() => setTheme(value)}
                    title={label}
                    className={cn(
                        "group p-2 rounded-md transition-all relative",
                        theme === value
                            ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                    )}
                >
                    <Icon size={16} />
                    {/* Tooltip */}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-md">
                        {label}
                    </span>
                </button>
            ))}
        </div>
    );
};
