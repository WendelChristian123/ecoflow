
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, User as UserIcon } from 'lucide-react';
import { cn, Avatar } from './Shared';

export interface FilterOption {
    value: string;
    label: string;
    avatarUrl?: string; // Optional avatar
    group?: string; // Optional group name
}

interface FilterSelectProps {
    label?: string; // Title inside the dropdown (e.g. "RESPONSÁVEL")
    externalLabel?: string; // Label shown above the component
    inlineLabel?: string; // Label shown as prefix inside button (e.g. "Resp: ")
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
    icon?: React.ReactNode;
    className?: string;
    triggerClassName?: string;
    placeholder?: string;
    darkMode?: boolean; // Force dark background
    searchable?: boolean;
}

export const FilterSelect: React.FC<FilterSelectProps> = ({
    label,
    externalLabel,
    inlineLabel,
    options,
    value,
    onChange,
    icon,
    className,
    triggerClassName,
    placeholder = "Selecione",
    darkMode = false,
    searchable = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isClickInsideContainer = containerRef.current?.contains(target);
            const isClickInsideDropdown = dropdownRef.current?.contains(target);

            if (!isClickInsideContainer && !isClickInsideDropdown) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Execute only on client side (safe for Next.js/SSR if needed, though this is Vite)
    useLayoutEffect(() => {
        if (isOpen && containerRef.current) {
            const updatePosition = () => {
                const rect = containerRef.current!.getBoundingClientRect();
                const width = Math.max(rect.width, 256); // Min width 256px (w-64)
                let left = rect.left;

                // Check for right overflow
                if (left + width > window.innerWidth) {
                    left = window.innerWidth - width - 16; // 16px margin from right edge
                }

                setPosition({
                    top: rect.bottom + 8, // 8px margin
                    left: left,
                    width: width
                });
            };

            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

    // Focus search input when opening
    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isOpen, searchable]);


    const selectedOption = options.find(opt => opt.value === value);
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group options
    const groups: { [key: string]: FilterOption[] } = {};
    const ungroupedOptions: FilterOption[] = [];

    filteredOptions.forEach(opt => {
        if (opt.group) {
            if (!groups[opt.group]) groups[opt.group] = [];
            groups[opt.group].push(opt);
        } else {
            ungroupedOptions.push(opt);
        }
    });

    // Portal Element
    const DropdownMenu = (
        <div
            ref={dropdownRef}
            style={{
                top: position.top,
                left: position.left,
                // width: position.width, // Let it be w-64 by default or min-width
                position: 'fixed'
            }}
            className={cn(
                "w-64 border rounded-xl shadow-2xl z-[9999] animate-in fade-in zoom-in-95 duration-100 p-2",
                darkMode ? "bg-slate-900 border-slate-700" : "bg-card border-border"
            )}
        >
            {label && (
                <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {label}
                </div>
            )}

            {searchable && (
                <div className="px-2 pb-2">
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="w-full bg-secondary/50 text-sm border-0 rounded px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 placeholder:text-muted-foreground outline-none"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            )}

            <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                {/* Ungrouped Options First */}
                {ungroupedOptions.map(option => (
                    <OptionItem
                        key={option.value}
                        option={option}
                        isSelected={option.value === value}
                        onClick={() => { onChange(option.value); setIsOpen(false); }}
                        darkMode={darkMode}
                    />
                ))}

                {/* Grouped Options */}
                {Object.entries(groups).map(([groupName, groupOptions]) => (
                    <div key={groupName} className="pt-2">
                        <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/30 rounded mb-1 mx-1">
                            {groupName}
                        </div>
                        {groupOptions.map(option => (
                            <OptionItem
                                key={option.value}
                                option={option}
                                isSelected={option.value === value}
                                onClick={() => { onChange(option.value); setIsOpen(false); }}
                                darkMode={darkMode}
                            />
                        ))}
                    </div>
                ))}

                {filteredOptions.length === 0 && (
                    <div className="text-center py-4 text-xs text-muted-foreground italic">
                        Nenhuma opção encontrada
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            {externalLabel && (
                <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">
                    {externalLabel}
                </label>
            )}
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 text-sm h-[34px] rounded-lg px-3 focus:ring-1 focus:ring-primary outline-none transition-colors min-w-[140px] justify-between w-full",
                    darkMode
                        ? "bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
                        : "bg-card border border-border text-foreground hover:bg-muted/50",
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
                            <span className="truncate">
                                {inlineLabel && <span className="font-semibold text-muted-foreground">{inlineLabel} </span>}
                                {selectedOption.label}
                            </span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                </div>
                <ChevronDown size={14} className={cn("text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {/* Dropdown Menu Portal - Only render if width is calculated */}
            {isOpen && position.width > 0 && createPortal(DropdownMenu, document.body)}
        </div>
    );
};

const OptionItem: React.FC<{ option: FilterOption, isSelected: boolean, onClick: () => void, darkMode: boolean }> = ({ option, isSelected, onClick, darkMode }) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left",
            isSelected
                ? "bg-emerald-500 text-white shadow-md font-medium"
                : darkMode
                    ? "text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-400"
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
