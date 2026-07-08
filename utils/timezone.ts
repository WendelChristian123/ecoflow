import { formatInTimeZone, toDate, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const SYSTEM_TIMEZONE = 'America/Cuiaba';

/**
 * Creates a UTC ISO string representing a specific date and time in the SYSTEM_TIMEZONE.
 * Use this when taking input from a user (e.g., from a DatePicker and TimePicker).
 * 
 * @param dateStr Format: YYYY-MM-DD or any parsable date string/Date
 * @param timeStr Format: HH:mm (24h format)
 * @returns ISO string in UTC that matches the specified local time in America/Cuiaba
 */
export const createDateTimeInSystemTimezone = (dateStr: string | Date, timeStr: string = '00:00'): string => {
    let baseDateStr = '';
    if (typeof dateStr === 'string') {
        baseDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    } else if (dateStr instanceof Date) {
        // Formata a data local do browser de volta para string YYYY-MM-DD
        baseDateStr = format(dateStr, 'yyyy-MM-dd');
    }

    if (!baseDateStr) return new Date().toISOString();

    const dateTimeString = `${baseDateStr}T${timeStr}:00`;
    
    // Converte a string "YYYY-MM-DDTHH:mm:00" que representa o fuso de Cuiabá para UTC
    const utcDate = fromZonedTime(dateTimeString, SYSTEM_TIMEZONE);
    
    return utcDate.toISOString();
};

/**
 * Creates a Date-only ISO string representing midnight in UTC.
 * Used for pure dates (due_date) where timezone shifts should not happen.
 * Ensures that if a user selects "2026-03-10", it saves exactly that day.
 * 
 * @param date Input date string or object
 */
export const createDateOnlyInUTC = (date: string | Date): string => {
    let baseDateStr = '';
    if (typeof date === 'string') {
        baseDateStr = date.includes('T') ? date.split('T')[0] : date;
    } else if (date instanceof Date) {
        baseDateStr = format(date, 'yyyy-MM-dd');
    }
    
    return `${baseDateStr}T00:00:00Z`;
};

/**
 * Formats a UTC ISO string into a display string according to SYSTEM_TIMEZONE.
 * Overrides the browser's local timezone.
 * 
 * @param isoString The UTC ISO string from the database
 * @param formatStr Format string (default: 'dd/MM/yyyy HH:mm')
 * @returns Formatted string strictly in America/Cuiaba time
 */
export const formatDateTimeForDisplay = (isoString: string | undefined | null, formatStr: string = 'dd/MM/yyyy HH:mm'): string => {
    if (!isoString) return '-';
    try {
        const date = typeof isoString === 'string' ? parseISO(isoString) : isoString;
        return formatInTimeZone(date, SYSTEM_TIMEZONE, formatStr, { locale: ptBR });
    } catch (e) {
        console.warn('Error formatting datetime', e);
        return '-';
    }
};

/**
 * Formats a UTC ISO string to display ONLY the time in SYSTEM_TIMEZONE.
 */
export const formatTimeForDisplay = (isoString: string | undefined | null): string => {
    return formatDateTimeForDisplay(isoString, 'HH:mm');
};

/**
 * Parses and formats Date-only fields exactly as they are without timezone shifts.
 * Use for `due_date` or financial dates.
 * 
 * @param dateStr The date string from the database (e.g. YYYY-MM-DDT00:00:00Z)
 * @param formatStr Format string (default: 'dd/MM/yyyy')
 */
export const formatDateOnlyForDisplay = (dateStr: string | undefined | null, formatStr: string = 'dd/MM/yyyy'): string => {
    if (!dateStr) return '-';
    try {
        const raw = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        
        // Parse the YYYY-MM-DD as local midnight to avoid offset issues with format()
        const parts = String(raw).split('-');
        if (parts.length === 3) {
             const year = parseInt(parts[0]);
             const monthIndex = parseInt(parts[1]) - 1;
             const day = parseInt(parts[2]);
             const localDate = new Date(year, monthIndex, day);
             return format(localDate, formatStr, { locale: ptBR });
        }
        
        return format(new Date(dateStr), formatStr, { locale: ptBR });
    } catch (e) {
        console.warn('Error formatting date only', e);
        return '-';
    }
};

/**
 * Converts a UTC ISO string or Date into a Date object whose local methods (getDate, getHours, etc)
 * return the values corresponding to the SYSTEM_TIMEZONE.
 * Use this for calendar logic (e.g. isSameDay) where you need to align with the system timezone.
 */
export const getZonedDate = (date: string | Date | undefined | null): Date => {
    if (!date) return getSystemNow();
    const d = typeof date === 'string' ? new Date(date) : date;
    return toZonedTime(d, SYSTEM_TIMEZONE);
};

/**
 * Obtains the current Date in the SYSTEM_TIMEZONE.
 * Use instead of `new Date()` when evaluating "today" or "now" for business logic.
 */
export const getSystemNow = (): Date => {
    const nowUtc = new Date();
    return toZonedTime(nowUtc, SYSTEM_TIMEZONE);
};
