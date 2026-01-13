import { format, parseISO } from 'date-fns';

/**
 * Standardized date formatter for the application.
 * Handles ISO strings by splitting strictly on 'T' to avoid local timezone shifts 
 * when displaying dates that are conceptually "Date Only".
 * @param date The date to format (string, Date, undefined, null)
 * @param formatStr Format string (default: dd/MM/yyyy)
 */
export const formatDate = (date: string | Date | undefined | null, formatStr: string = 'dd/MM/yyyy'): string => {
    if (!date) return '-';
    try {
        if (typeof date === 'string') {
            // Fix for Timezone Shift: Parse YYYY-MM-DD only
            // If we parse ISO with 'Z' or offset, it shifts to local time.
            const raw = date.includes('T') ? date.split('T')[0] : date;
            return format(parseISO(raw), formatStr);
        }
        return format(date, formatStr);
    } catch (e) {
        console.warn("Date formatting error", e);
        return '-';
    }
};

/**
 * Parses a date string (YYYY-MM-DD or ISO) into a Date object at Local Midnight.
 * Effectively ignores input time/timezone and "snaps" the date to the user's local calendar day.
 * Example: '2026-01-16T00:00:00Z' -> Fri Jan 16 2026 00:00:00 Local
 */
export const parseDateLocal = (dateStr: string): Date => {
    if (!dateStr) return new Date();

    // Extract YYYY-MM-DD part
    const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = raw.split('-');

    if (parts.length !== 3) {
        // Fallback for weird formats, though we usually deal with ISO
        return new Date(dateStr);
    }

    const year = parseInt(parts[0]);
    const monthIndex = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    return new Date(year, monthIndex, day);
};
