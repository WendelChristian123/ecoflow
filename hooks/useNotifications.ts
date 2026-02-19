
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { isToday, isPast, parseISO, isValid, startOfDay, addDays, isBefore, isSameDay, addMinutes } from 'date-fns';

export type NotificationType = 'task' | 'finance' | 'agenda';

export interface NotificationItem {
    id: string;
    type: NotificationType;
    title: string;
    date: string; // ISO String
    parsedDate: Date; // Corrected Date object
    status: 'overdue' | 'today' | 'future';
    originalStatus?: string;
}

export const useNotifications = () => {
    const { user } = useAuth();
    const { currentCompany } = useCompany();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;

        setIsLoading(true);
        setError(null);

        try {
            // Fetch in parallel
            const [tasks, events, transactions] = await Promise.all([
                api.getTasks(currentCompany?.id),
                api.getEvents(currentCompany?.id),
                api.getFinancialTransactions(currentCompany?.id)
            ]);

            const now = new Date();
            const today = startOfDay(now);
            const limitDate = addDays(today, 3); // 3 days rule

            // 1. Process Tasks
            const taskNotifs = tasks
                .filter(t => t.assigneeId === user.id && t.status !== 'done' && t.dueDate)
                .map(t => ({
                    id: t.id,
                    type: 'task' as const,
                    title: t.title,
                    date: t.dueDate,
                    status: 'future', // Calculated later
                    originalStatus: t.status
                }));

            // 2. Process Finance (Exclude Credit Card items, Unpaid, Due Date within range)
            const financeNotifs = transactions
                .filter(t =>
                    !t.isPaid &&
                    t.date &&
                    !t.creditCardId // Rule: Paid via card does not appear
                )
                .map(t => ({
                    id: t.id,
                    type: 'finance' as const,
                    title: t.description,
                    date: t.date,
                    status: 'future', // Calculated later
                    originalStatus: t.isPaid ? 'paid' : 'pending'
                }));

            // 3. Process Events
            const agendaNotifs = events
                .filter(e =>
                    e.status !== 'completed' &&
                    e.status !== 'cancelled' &&
                    Array.isArray(e.participants) && e.participants.includes(user.id)
                )
                .map(e => ({
                    id: e.id,
                    type: 'agenda' as const,
                    title: e.title,
                    date: e.startDate,
                    status: 'future', // Calculated later
                    originalStatus: e.status
                }));

            // 4. Combine, Calculate Status, Filter, and Sort
            const processed = [...taskNotifs, ...financeNotifs, ...agendaNotifs]
                .map((item): NotificationItem | null => {
                    let itemDate = parseISO(item.date);
                    if (!isValid(itemDate)) return null;

                    // Fix Timezone: If it's midnight UTC, it might be previous day locally. 
                    // Add offset to make it "Local start of day".
                    itemDate = addMinutes(itemDate, itemDate.getTimezoneOffset());

                    const itemDay = startOfDay(itemDate);
                    let status: 'overdue' | 'today' | 'future' = 'future';

                    if (isBefore(itemDay, today)) status = 'overdue';
                    else if (isSameDay(itemDay, today)) status = 'today';

                    return {
                        id: item.id,
                        type: item.type,
                        title: item.title,
                        date: item.date,
                        parsedDate: itemDate,
                        status: status,
                        originalStatus: item.originalStatus
                    };
                })
                .filter((item): item is NotificationItem => item !== null)
                .filter(item => {
                    const itemDay = startOfDay(item.parsedDate);

                    // Rule: Show Overdue, Today, and Future <= 3 days
                    if (item.status === 'overdue') return true;
                    if (item.status === 'today') return true;
                    if (item.status === 'future' && itemDay <= limitDate) return true;

                    return false;
                })
                .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

            setNotifications(processed);

        } catch (err: any) {
            console.error("Failed to fetch notifications", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [user, currentCompany]);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const completeItem = async (id: string, type: NotificationType) => {
        // Optimistic Update
        setNotifications(prev => prev.filter(n => n.id !== id));

        try {
            if (type === 'task') {
                await api.updateTaskStatus(id, 'done');
            } else if (type === 'agenda') {
                const event = await api.getEvents(currentCompany?.id).then(evts => evts.find(e => e.id === id));
                if (event) {
                    await api.updateEvent({ ...event, status: 'completed' });
                }
            } else if (type === 'finance') {
                await api.toggleTransactionStatus(id, true);
            }
        } catch (e) {
            console.error("Failed to complete item", e);
            fetchNotifications(); // Revert on error
        }
    };

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return {
        notifications,
        isLoading,
        error,
        refetch: fetchNotifications,
        completeItem,
        removeNotification
    };
};
