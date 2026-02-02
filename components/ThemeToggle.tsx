
import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { cn } from './Shared';

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const options = [
        { value: 'light' as const, icon: Sun, label: 'Claro' },
        { value: 'dark' as const, icon: Moon, label: 'Escuro' },
        { value: 'system' as const, icon: Monitor, label: 'Sistema' },
    ];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">Tema da Interface</label>
            </div>
            <p className="text-xs text-muted-foreground">
                Escolha entre modo claro, escuro ou seguir a preferência do sistema.
            </p>

            <div className="grid grid-cols-3 gap-3">
                {options.map(({ value, icon: Icon, label }) => (
                    <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                            theme === value
                                ? "bg-primary/10 border-primary text-primary font-semibold shadow-md"
                                : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Icon size={24} />
                        <span className="text-xs">{label}</span>
                    </button>
                ))}
            </div>

            <div className="mt-4 p-3 bg-secondary/20 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                    <strong>Tema atual:</strong> {theme === 'light' ? 'Claro' : theme === 'dark' ? 'Escuro' : 'Sistema'}
                </p>
            </div>
        </div>
    );
};
