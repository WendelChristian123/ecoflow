import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker, DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from './Shared';
import 'react-day-picker/dist/style.css';

interface DateRangePickerProps {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
    className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ date, setDate, className }) => {
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

    const css = `
        .rdp-root {
            --rdp-accent-color: #10b981;
            --rdp-background-color: rgba(16, 185, 129, 0.1);
            /* Override the gradients/backgrounds that cause white artifacts */
            --rdp-range_start-background: rgba(16, 185, 129, 0.1);
            --rdp-range_end-background: rgba(16, 185, 129, 0.1);
            --rdp-range_middle-background-color: rgba(16, 185, 129, 0.1);
            --rdp-range_middle-color: #34d399;
            margin: 0;
        }
        
        /* Base Text Colors - Dark Mode */
        .rdp-day, .rdp-caption_label, .rdp-head_cell {
            color: #cbd5e1; /* slate-300 */
        }
        .rdp-day_outside {
            opacity: 0.5;
        }
        .rdp-nav_button {
            color: #94a3b8; /* slate-400 */
        }
        .rdp-nav_button:hover {
            color: #f8fafc;
            background-color: #334155;
        }

        /* Hover on non-selected days */
        .rdp-day:hover:not(.rdp-selected) {
            background-color: #334155 !important;
            border-radius: 6px;
        }

        /* V9 SELECTORS & OVERRIDES */

        /* General Selection (Solid Green button) */
        .rdp-selected {
            background-color: #10b981 !important;
            color: white !important;
            font-weight: bold;
            border: none;
        }

        /* Range Middle */
        .rdp-range_middle {
            background-color: var(--rdp-range_middle-background-color) !important;
            color: var(--rdp-range_middle-color) !important;
            border-radius: 0 !important;
        }

        /* Range Start - Rounded Left Only */
        .rdp-range_start {
            background-color: #10b981 !important;
            color: white !important;
            border-top-left-radius: 6px !important;
            border-bottom-left-radius: 6px !important;
            border-top-right-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
        }

        /* Range End - Rounded Right Only */
        .rdp-range_end {
            background-color: #10b981 !important;
            color: white !important;
            border-top-right-radius: 6px !important;
            border-bottom-right-radius: 6px !important;
            border-top-left-radius: 0 !important;
            border-bottom-left-radius: 0 !important;
        }

        /* Ensure Today is visible */
        .rdp-today:not(.rdp-selected) {
            color: #10b981;
            font-weight: bold;
        }
    `;

    const formatDateRange = () => {
        if (!date?.from) return 'Selecione o período';
        if (!date.to) return `${format(date.from, 'dd/MM/yyyy')} - ...`;
        return `${format(date.from, 'dd/MM/yyyy')} - ${format(date.to, 'dd/MM/yyyy')}`;
    };

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <style>{css}</style>
            <div
                className={cn(
                    "flex items-center justify-between w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-200 cursor-pointer hover:border-slate-600 transition-colors group",
                    isOpen && "ring-2 ring-emerald-500/20 border-emerald-500"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <CalendarIcon size={18} className="text-slate-500 group-hover:text-emerald-500 transition-colors" />
                    <span className={!date?.from ? "text-slate-500" : ""}>{formatDateRange()}</span>
                </div>
                {date?.from && (
                    <div
                        onClick={(e) => { e.stopPropagation(); setDate(undefined); }}
                        className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={14} />
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 z-50 mt-2 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <DayPicker
                        mode="range"
                        selected={date}
                        onSelect={setDate}
                        locale={ptBR}
                        showOutsideDays
                        numberOfMonths={1}
                        weekStartsOn={0} // Domingo
                    />
                </div>
            )}
        </div>
    );
};
