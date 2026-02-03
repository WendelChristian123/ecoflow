
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, User as UserIcon } from 'lucide-react';
import { cn, Avatar } from './Shared';

export interface FilterOption {
    value: string;
    label: string;
    avatarUrl?: string; // Optional avatar
}

interface FilterSelectProps {
    label?: string; // Title inside the dropdown (e.g. "RESPONSÁVEL")
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
    icon?: React.ReactNode;
    className?: string;
    triggerClassName?: string;
    placeholder?: string;
}

export const FilterSelect: React.FC<FilterSelectProps> = ({
    label,
    options,
    value,
    onChange,
    icon,
    className,
    triggerClassName,
    placeholder = "Selecione"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 bg-card border border-border text-foreground text-sm h-[34px] rounded-lg px-3 focus:ring-1 focus:ring-primary outline-none hover:bg-muted/50 transition-colors min-w-[140px] justify-between",
                    triggerClassName
                )}
            >
                <div className="flex items-center gap-2 truncate">
                    {icon && <span className="text-muted-foreground">{icon}</span>}
                    {selectedOption ? (
                        <div className="flex items-center gap-2 truncate">
                            {selectedOption.avatarUrl !== undefined && (
                                <Avatar name={selectedOption.label} src={selectedOption.avatarUrl} size="sm" />
                            )}
                            {/* For "Resp: Todos" scenario, maybe we handle the specialized display externally or inside options?
                        Let's assume the label passed in options is what we show.
                     */}
                            <span className="truncate">{selectedOption.label}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                </div>
                <ChevronDown size={14} className={cn("text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-2xl z-[50] animate-in fade-in zoom-in-95 duration-100 p-2">
                    {label && (
                        <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            {label}
                        </div>
                    )}

                    <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {options.map(option => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left",
                                        isSelected
                                            ? "bg-emerald-500 text-white shadow-md font-medium"
                                            : "text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        {option.avatarUrl !== undefined ? (
                                            <div className={cn("h-6 w-6 rounded-full overflow-hidden border", isSelected ? "border-emerald-400" : "border-border")}>
                                                {option.avatarUrl ? (
                                                    <img src={option.avatarUrl} alt={option.label} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full bg-muted flex items-center justify-center text-[10px] font-bold">
                                                        {option.label.substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                        <span className="truncate">{option.label}</span>
                                    </div>
                                    {isSelected && <div className="bg-emerald-600/30 rounded-full p-0.5"><Check size={12} className="text-white" strokeWidth={3} /></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
