import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import { Calendar as CalendarIcon, X, Clock } from 'lucide-react';
import { cn } from './Shared';
import 'react-day-picker/dist/style.css';

interface DateTimePickerProps {
    value: string | undefined; // Expects ISO string or similar compatible with new Date(value)
    onChange: (value: string | undefined) => void;
    className?: string;
    inlineLabel?: string;
    placeholder?: string;
}

import { createPortal } from 'react-dom';

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange, className, inlineLabel, placeholder = "Selecione a data" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(value ? new Date(value) : undefined);
    const [position, setPosition] = useState<{ top?: number, bottom?: number, left: number, width: number } | null>(null);

    // Time state
    const [timeValue, setTimeValue] = useState<string>(value ? format(new Date(value), 'HH:mm') : '09:00');

    // Sync internal state if external value changes
    useEffect(() => {
        if (value) {
            const d = new Date(value);
            if (isValid(d)) {
                setSelectedDate(d);
                setTimeValue(format(d, 'HH:mm'));
            }
        } else {
            setSelectedDate(undefined);
            setTimeValue('09:00');
        }
    }, [value]);

    /* Update position function with Flip Logic
       Uses fixed positioning to handle viewport boundaries easily. */
    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const DROPDOWN_HEIGHT = 380; // Estimated height with margin

            const spaceBelow = viewportHeight - rect.bottom;

            // Default: Open Down
            let newPos: { top?: number, bottom?: number, left: number, width: number } = {
                top: rect.bottom + 8,
                left: rect.left,
                width: rect.width
            };

            // Flip Logic: Open Up if not enough space below AND enough space above
            if (spaceBelow < DROPDOWN_HEIGHT && rect.top > DROPDOWN_HEIGHT) {
                newPos = {
                    bottom: viewportHeight - rect.top + 8, // Distance from bottom of screen to top of input
                    left: rect.left,
                    width: rect.width
                };
            }

            setPosition(newPos);
        }
    };

    // Use useLayoutEffect to prevent visual flickering (pop from corner)
    useLayoutEffect(() => {
        let animationFrameId: number;

        const handleUpdate = () => {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(updatePosition);
        };

        if (isOpen) {
            updatePosition(); // Immediate update first
            // Update on scroll/resize to keep attached
            window.addEventListener('resize', handleUpdate);
            window.addEventListener('scroll', handleUpdate, true);
        } else {
            setPosition(null); // Reset when closed
        }
        return () => {
            window.removeEventListener('resize', handleUpdate);
            window.removeEventListener('scroll', handleUpdate, true);
            cancelAnimationFrame(animationFrameId);
        };
    }, [isOpen]);

    // Close on click outside (modified for Portal)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is inside container OR inside the portal dropdown
            const target = event.target as Node;
            const dropdown = document.getElementById('datetime-picker-portal');

            if (containerRef.current && containerRef.current.contains(target)) return;
            if (dropdown && dropdown.contains(target)) return;

            setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleDateSelect = (date: Date | undefined) => {
        if (!date) {
            onChange(undefined);
            setSelectedDate(undefined);
            return;
        }

        // Merge Date + Time
        const [hours, minutes] = timeValue.split(':').map(Number);
        const newDate = new Date(date);
        newDate.setHours(hours || 0);
        newDate.setMinutes(minutes || 0);

        setSelectedDate(newDate);
        onChange(newDate.toISOString()); // Or whatever format expected, commonly ISO
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = e.target.value;
        setTimeValue(time);

        if (selectedDate) {
            const [hours, minutes] = time.split(':').map(Number);
            const newDate = new Date(selectedDate);
            newDate.setHours(hours || 0);
            newDate.setMinutes(minutes || 0);

            setSelectedDate(newDate);
            onChange(newDate.toISOString());
        }
    };

    // Reuse styling from DateRangePicker (Emerald/Slate)
    const css = `
        .rdp-root {
            --rdp-accent-color: #10b981;
            --rdp-background-color: rgba(16, 185, 129, 0.1);
            margin: 0;
        }
        
        /* Base Text Colors - Inherit from parent */
        .rdp-day, .rdp-caption_label, .rdp-head_cell {
            color: currentColor; 
        }
        .rdp-day_outside {
            opacity: 0.5;
        }
        .rdp-nav_button {
            color: currentColor;
            opacity: 0.7;
        }
        .rdp-nav_button:hover {
            opacity: 1;
            background-color: var(--accent); /* Fallback or contextual */
        }

        /* Hover on non-selected days */
        .rdp-day:hover:not(.rdp-selected) {
            background-color: rgba(0,0,0,0.05) !important; /* Gentle hover */
            border-radius: 6px;
        }
        /* Dark mode specific hover adjustment via parent class if needed, but safe defaults work best */
        
        /* Selected Day */
        .rdp-selected {
            background-color: #10b981 !important;
            color: white !important;
            font-weight: bold;
            border: none;
            border-radius: 6px !important;
        }

        /* Ensure Today is visible */
        .rdp-today:not(.rdp-selected) {
            color: #10b981;
            font-weight: bold;
        }
    `;

    const formatDisplay = () => {
        if (!selectedDate) return placeholder;
        return format(selectedDate, "dd/MM/yyyy HH:mm");
    };

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <style>{css}</style>

            {/* Trigger Base */}
            <div
                className={cn(
                    "flex items-center justify-between w-full bg-card border border-input rounded-xl px-4 py-3 text-sm text-foreground cursor-pointer hover:border-primary transition-colors group h-auto min-h-[46px] shadow-sm",
                    isOpen && "ring-2 ring-ring border-primary"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 overflow-hidden w-full">
                    <CalendarIcon size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <span className="truncate flex items-center gap-1 w-full">
                        {inlineLabel && <span className="text-muted-foreground font-semibold header-label text-xs whitespace-nowrap uppercase tracking-wider">{inlineLabel}</span>}
                        <span className={cn("truncate w-full", !selectedDate ? "text-muted-foreground" : "font-medium")}>
                            {formatDisplay()}
                        </span>
                    </span>
                </div>
                {selectedDate && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
                        className="p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1"
                    >
                        <X size={14} />
                    </div>
                )}
            </div>

            {/* Dropdown Panel - Portal */}
            {isOpen && position && createPortal(
                <div
                    id="datetime-picker-portal"
                    style={{
                        position: 'fixed', // Changed to fixed
                        top: position.top,
                        bottom: position.bottom, // Use bottom if flipped
                        left: position.left,
                        zIndex: 99999
                    }}
                    className="p-3 bg-popover border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-3 min-w-[300px]"
                >
                    <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        locale={ptBR}
                        showOutsideDays
                        weekStartsOn={0} // Domingo
                    />

                    {/* Time Picker Section */}
                    <div className="pt-3 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Clock size={14} />
                            <span>Horário</span>
                        </div>
                        <input
                            type="time"
                            value={timeValue}
                            onChange={handleTimeChange}
                            className="bg-secondary border border-input rounded px-2 py-1 text-foreground text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
