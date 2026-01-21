
import {
    Task, Project, Team, User, CalendarEvent,
    FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard,
    Contact, Quote, CatalogItem, RecurringService, RecurrenceConfig,
    Tenant, SaasPlan, Delegation,
    DashboardMetrics, GlobalStats, UserPermissions, AuditLog
} from '../types';
import { supabase } from './supabase';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

export const getErrorMessage = (error: any): string => {
    return error?.message || error?.error_description || String(error);
};

// Helper: Ensure we always have a tenant ID (fallback to auth user's tenant if not explicitly set)
const getCurrentTenantId = () => {
    return localStorage.getItem('ecoflow-tenant-id');
};

// Helper: Convert empty strings to null for UUID fields to prevent Postgres errors
const uuidOrNull = (val: any) => (val === '' || val === undefined) ? null : val;
// Helper: Ensure date is valid string or null (sanitizes empty strings)
const sanitizeDate = (val: any) => (val === '' || val === undefined) ? null : val;

// ==========================================
// REAL SUPABASE API IMPLEMENTATION
// ==========================================

export const api = {
    // --- AUTH MOCK (Now handled by AuthContext + Supabase directly, but keeping for compatibility if utilized elsewhere) ---
    mockSignIn: async (email: string, password: string): Promise<User | null> => {
        // This should not be used anymore with the new AuthContext
        console.warn("api.mockSignIn is deprecated. Use supabase.auth.signInWithPassword instead.");
        return null;
    },

    // --- TASKS ---
    getTasks: async (tenantId?: string) => {
        let query = supabase.from('tasks').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((t: any) => ({
            ...t,
            assigneeId: t.assignee_id,
            projectId: t.project_id,
            teamId: t.team_id,
            tenantId: t.tenant_id,
            dueDate: t.due_date,
        })) as Task[];
    },
    addTask: async (task: Partial<Task>, recurrence?: RecurrenceConfig) => {
        const tenantId = getCurrentTenantId();
        const createdTasks: any[] = [];
        const baseRecurrenceId = recurrence ? crypto.randomUUID() : null;

        const createDbTask = (t: Partial<Task>, date: string, recId: string | null) => {
            const dbTask = {
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                assignee_id: uuidOrNull(t.assigneeId),
                project_id: uuidOrNull(t.projectId),
                team_id: uuidOrNull(t.teamId),
                due_date: date,
                tags: t.tags,
                links: t.links,
                tenant_id: tenantId,
                recurrence_id: recId
            };
            if (!dbTask.status) delete dbTask.status;
            if (!dbTask.priority) delete dbTask.priority;
            return dbTask;
        };

        if (recurrence) {
            const count = recurrence.occurrences || (recurrence.endDate ? 0 : 12); // Default 12 if indefinite
            // If endDate is present, calculation is more complex, for now support occurrences or fixed count
            const actualCount = count > 0 ? count : 12; // Fallback
            const startDate = new Date(task.dueDate || new Date());

            for (let i = 0; i < actualCount; i++) {
                let nextDate = new Date(startDate);
                const interval = recurrence.interval || 1;
                if (recurrence.frequency === 'daily') nextDate = addDays(startDate, i * interval);
                if (recurrence.frequency === 'weekly') nextDate = addWeeks(startDate, i * interval);
                if (recurrence.frequency === 'monthly') nextDate = addMonths(startDate, i * interval);
                if (recurrence.frequency === 'yearly') nextDate = addYears(startDate, i * interval);

                // Stop if endDate is exceeded (if provided)
                if (recurrence.endDate && nextDate > new Date(recurrence.endDate)) break;

                const dateStr = nextDate.toISOString().split('T')[0]; // Store as YYYY-MM-DD for tasks, or ISO for datetime
                // Note: Tasks dueDate is usually YYYY-MM-DD or ISO. Let's keep input format if possible, but calculating usually results in Date object.
                // Assuming task.dueDate includes time if needed. API sanitizeDate handles empty strings.
                // Using ISO string preserves time if present in original startDate.
                const isoStr = nextDate.toISOString();
                // Using task.dueDate format style would be ideal but hard to guess.
                // Let's use ISO string for safety.
                createdTasks.push(createDbTask(task, isoStr, baseRecurrenceId));
            }
        } else {
            createdTasks.push(createDbTask(task, task.dueDate || new Date().toISOString(), null));
        }

        const { data, error } = await supabase
            .from('tasks')
            .insert(createdTasks)
            .select();

        if (error) throw error;
        // Return the first created task
        const firstData = data[0];
        return {
            ...firstData,
            assigneeId: firstData.assignee_id,
            projectId: firstData.project_id,
            teamId: firstData.team_id,
            tenantId: firstData.tenant_id,
            dueDate: firstData.due_date,
        } as Task;
    },
    updateTask: async (task: Task) => {
        const dbTask = {
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assignee_id: uuidOrNull(task.assigneeId),
            project_id: uuidOrNull(task.projectId),
            team_id: uuidOrNull(task.teamId),
            due_date: task.dueDate,
            tags: task.tags,
            links: task.links
        };

        const { error } = await supabase
            .from('tasks')
            .update(dbTask)
            .eq('id', task.id);
        if (error) throw error;
    },
    updateTaskStatus: async (id: string, status: string) => {
        const { error } = await supabase.from('tasks').update({ status }).eq('id', id);
        if (error) throw error;
    },
    deleteTask: async (id: string) => {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
    },

    // --- PROJECTS ---
    getProjects: async (tenantId?: string) => {
        let query = supabase.from('projects').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((p: any) => ({
            ...p,
            dueDate: p.due_date,
            tenantId: p.tenant_id,
            teamIds: p.team_ids,
            members: p.member_ids,
        })) as Project[];
    },
    addProject: async (project: Partial<Project>) => {
        const tenantId = getCurrentTenantId();
        console.log("[API] addProject called. TenantID:", tenantId);

        if (!tenantId) {
            console.error("[API] Missing Tenant ID");
            throw new Error("Tenant ID is required but missing from local storage.");
        }

        const { data: userData } = await supabase.auth.getUser();

        let members = project.members || [];
        // Ensure current user is in members to satisfy RLS "View" policy upon insert
        if (userData?.user?.id && !members.includes(userData.user.id)) {
            members = [...members, userData.user.id];
        }

        const dbProject = {
            name: project.name,
            description: project.description,
            status: project.status,
            progress: project.progress,
            due_date: project.dueDate,
            tenant_id: tenantId,
            team_ids: project.teamIds,
            member_ids: members,
            links: project.links
        };
        const { error } = await supabase.from('projects').insert([dbProject]);
        if (error) throw error;
    },
    updateProject: async (project: Project) => {
        const dbProject = {
            name: project.name,
            description: project.description,
            status: project.status,
            progress: project.progress,
            due_date: project.dueDate,
            team_ids: project.teamIds,
            member_ids: project.members,
            links: project.links
        };
        const { error } = await supabase.from('projects').update(dbProject).eq('id', project.id);
        if (error) throw error;
    },
    deleteProject: async (id: string) => {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
    },
    completeProject: async (id: string) => {
        // Update project to completed
        const { error: pError } = await supabase.from('projects')
            .update({ status: 'completed', progress: 100 })
            .eq('id', id);
        if (pError) throw pError;

        // Update all tasks of this project to done
        const { error: tError } = await supabase.from('tasks')
            .update({ status: 'done' })
            .eq('project_id', id);
        if (tError) throw tError;
    },

    // --- TEAMS ---
    getTeams: async (tenantId?: string) => {
        let query = supabase.from('teams').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((t: any) => ({
            ...t,
            leadId: t.lead_id,
            tenantId: t.tenant_id,
            memberIds: t.member_ids,
        })) as Team[];
    },
    addTeam: async (team: Partial<Team>) => {
        const tenantId = getCurrentTenantId();
        const dbTeam = {
            name: team.name,
            description: team.description,
            lead_id: team.leadId,
            tenant_id: tenantId,
            member_ids: team.memberIds,
            links: team.links
        };
        const { error } = await supabase.from('teams').insert([dbTeam]);
        if (error) throw error;
    },
    updateTeam: async (team: Team) => {
        const dbTeam = {
            name: team.name,
            description: team.description,
            lead_id: team.leadId,
            member_ids: team.memberIds,
            links: team.links
        };
        const { error } = await supabase.from('teams').update(dbTeam).eq('id', team.id);
        if (error) throw error;
    },
    deleteTeam: async (id: string) => {
        const { error } = await supabase.from('teams').delete().eq('id', id);
        if (error) throw error;
    },

    // --- USERS ---
    getUsers: async (tenantId?: string) => {
        let query = supabase.from('profiles').select('*').neq('role', 'super_admin');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        // Map DB fields to User type if needed (snake_case to camelCase mapping might be needed if not handled automatically)
        // Since my schema uses snake_case and Types use camelCase, I might need aliasing or mapping.
        // HOWEVER, Supabase JS client usually returns what's in DB.
        // Let's assume strict mapping.
        return data.map((u: any) => ({
            ...u,
            tenantId: u.tenant_id,
            avatarUrl: u.avatar_url,
            // role, email, name match
        })) as User[];
    },
    getGlobalUsers: async () => {
        // Only super admin triggers this
        const { data, error } = await supabase.from('profiles').select('*, tenants(name)');
        if (error) throw error;
        return data.map((u: any) => ({
            ...u,
            tenantId: u.tenant_id,
            avatarUrl: u.avatar_url,
            companyName: u.tenants?.name
        })) as User[];
    },
    getUserProfile: async (id: string) => {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
        if (error) return null;
        return {
            ...data,
            tenantId: data.tenant_id,
            avatarUrl: data.avatar_url
        } as User;
    },
    createUser: async (userData: any, tenantId?: string) => {
        const { data, error } = await supabase.functions.invoke('admin-create-user', {
            body: userData
        });

        if (error) {
            console.error('Edge Function Invoke Error:', error);
            throw error;
        }

        // Edge Function might return { error: "message" }
        if (data && data.error) {
            throw new Error(data.error);
        }

        return data;
    },
    updateProfile: async (id: string, data: { name: string, phone: string, email?: string }) => {
        // If email is changing, we might need to update Auth... but that's complex with verification.
        // For now, just update profile metadata and trust the edge function for Auth updates if strictly needed.
        // Actually, let's keep it simple: Profile update only updates public info.
        const { error } = await supabase.from('profiles').update({
            name: data.name,
            phone: data.phone
            // Email sync is tricky without Edge Function 'updateUserAuth' 
        }).eq('id', id);
        if (error) throw error;
    },
    updatePassword: async (password: string) => {
        // Enforce a timeout because Supabase client can sometimes hang on token refresh race conditions
        const updatePromise = supabase.auth.updateUser({ password });
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Password update timed out')), 8000)
        );

        const { error } = await Promise.race([updatePromise, timeoutPromise]) as any;
        if (error) throw error;
    },
    adminUpdateUser: async (id: string, data: { name?: string, phone?: string, status?: string, permissions?: UserPermissions, role?: string }) => {
        // Clean undefined keys
        const updates: any = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.phone !== undefined) updates.phone = data.phone;
        if (data.status !== undefined) updates.status = data.status;
        if (data.permissions !== undefined) updates.permissions = data.permissions;
        if (data.role !== undefined) updates.role = data.role;

        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) throw error;
    },

    // Deprecated but kept for compatibility (wraps new method)
    updateUserPermissions: async (id: string, permissions: UserPermissions) => {
        await api.adminUpdateUser(id, { permissions });
    },

    deleteUser: async (id: string) => {
        // Use the admin-action edge function for safe deletion from Auth + Profile
        const { error } = await supabase.functions.invoke('admin-action', {
            body: { action: 'deleteUser', targetId: id }
        });

        if (error) throw error;
    },

    // --- ADMIN USER ACTIONS (Edge Function) ---
    adminResetPassword: async (userId: string, newPassword: string) => {
        const { data, error } = await supabase.functions.invoke('admin-action', {
            body: { action: 'resetPassword', targetId: userId, payload: { password: newPassword } }
        });
        if (error) throw new Error(error.message || 'Falha ao resetar senha');
        if (data?.error) throw new Error(data.error);
    },

    adminForceLogout: async (userId: string) => {
        const { data, error } = await supabase.functions.invoke('admin-action', {
            body: { action: 'forceLogout', targetId: userId }
        });
        if (error) throw new Error(error.message || 'Falha ao forçar logout');
        if (data?.error) throw new Error(data.error);
    },

    adminUpdateUserStatus: async (userId: string, status: 'active' | 'suspended' | 'blocked') => {
        // Status is on the profile table, we can update it directly if we are super admin
        const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
        if (error) throw error;
    },

    adminUpdateUserRole: async (userId: string, role: string) => {
        const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
        if (error) throw error;
    },



    // --- AUDIT LOGS ---
    getAuditLogs: async (tenantId?: string) => {
        let query = supabase
            .from('audit_logs')
            .select(`
                *,
                user:profiles!user_id(name, email, avatar_url, role)
            `)
            .order('created_at', { ascending: false })
            .limit(500); // Increased limit for better client-side search

        if (tenantId) query = query.eq('tenant_id', tenantId);

        const { data, error } = await query;
        if (error) throw error;

        return data.map((log: any) => ({
            id: log.id,
            tableName: log.table_name,
            recordId: log.record_id,
            action: log.action,
            oldData: log.old_data,
            newData: log.new_data,
            userId: log.user_id,
            tenantId: log.tenant_id,
            description: log.description,
            ipAddress: log.ip_address,
            userAgent: log.user_agent,
            createdAt: log.created_at,
            user: log.user ? {
                name: log.user.name,
                email: log.user.email,
                avatarUrl: log.user.avatar_url,
                role: log.user.role
            } : undefined
        })) as AuditLog[];
    },

    logAuthEvent: async (action: 'LOGIN' | 'LOGOUT', description: string) => {
        let finalDesc = description;
        try {
            // Attempt to capture IP client-side (public IP) with 2s timeout
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2000);
            const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
            clearTimeout(id);
            if (res.ok) {
                const data = await res.json();
                if (data.ip) finalDesc += ` [IP: ${data.ip}]`;
            }
        } catch (e) {
            // Ignore IP fetch errors to avoid blocking auth flow
        }

        const { error } = await supabase.rpc('log_auth_event', {
            p_action: action,
            p_description: finalDesc
        });
        if (error) console.error("Failed to log auth event", error);
    },

    getEvents: async (tenantId?: string) => {
        let query = supabase.from('calendar_events').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((e: any) => ({
            ...e,
            startDate: e.start_date,
            endDate: e.end_date,
            isTeamEvent: e.is_team_event,
            tenantId: e.tenant_id,
            projectId: e.project_id,
            teamId: e.team_id
        })) as CalendarEvent[];
    },
    addEvent: async (evt: Partial<CalendarEvent>, recurrence?: RecurrenceConfig) => {
        const tenantId = getCurrentTenantId();
        const createdEvents: any[] = [];
        const baseRecurrenceId = recurrence ? crypto.randomUUID() : null;

        const createDbEvt = (e: Partial<CalendarEvent>, start: string, end: string, recId: string | null) => ({
            title: e.title,
            description: e.description,
            start_date: start,
            end_date: end,
            type: e.type,
            status: e.status,
            is_team_event: e.isTeamEvent,
            participants: e.participants,
            links: e.links,
            tenant_id: tenantId,
            project_id: uuidOrNull(e.projectId),
            team_id: uuidOrNull(e.teamId),
            recurrence_id: recId
        });

        if (recurrence) {
            const count = recurrence.occurrences || (recurrence.endDate ? 0 : 12);
            const actualCount = count > 0 ? count : 12;

            const startDateObj = new Date(evt.startDate || new Date());
            const endDateObj = new Date(evt.endDate || new Date());
            const duration = endDateObj.getTime() - startDateObj.getTime();

            for (let i = 0; i < actualCount; i++) {
                let nextStart = new Date(startDateObj);
                const interval = recurrence.interval || 1;

                if (recurrence.frequency === 'daily') nextStart = addDays(startDateObj, i * interval);
                if (recurrence.frequency === 'weekly') nextStart = addWeeks(startDateObj, i * interval);
                if (recurrence.frequency === 'monthly') nextStart = addMonths(startDateObj, i * interval);
                if (recurrence.frequency === 'yearly') nextStart = addYears(startDateObj, i * interval);

                // Stop if endDate is exceeded (if provided strictly)
                if (recurrence.endDate && nextStart > new Date(recurrence.endDate)) break;

                const nextEnd = new Date(nextStart.getTime() + duration);

                createdEvents.push(createDbEvt(evt, nextStart.toISOString(), nextEnd.toISOString(), baseRecurrenceId));
            }
        } else {
            createdEvents.push(createDbEvt(evt, evt.startDate || '', evt.endDate || '', null));
        }

        const { error } = await supabase.from('calendar_events').insert(createdEvents);
        if (error) throw error;
    },
    updateEvent: async (evt: CalendarEvent) => {
        const dbEvt = {
            title: evt.title,
            description: evt.description,
            start_date: evt.startDate,
            end_date: evt.endDate,
            type: evt.type,
            status: evt.status,
            is_team_event: evt.isTeamEvent,
            participants: evt.participants,
            links: evt.links,
            project_id: evt.projectId,
            team_id: evt.teamId
        };
        const { error } = await supabase.from('calendar_events').update(dbEvt).eq('id', evt.id);
        if (error) throw error;
    },
    deleteEvent: async (id: string) => {
        const { error } = await supabase.from('calendar_events').delete().eq('id', id);
        if (error) throw error;
    },

    // --- FINANCE ---
    getFinancialTransactions: async (tenantId?: string) => {
        let query = supabase.from('financial_transactions').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((t: any) => ({
            ...t,
            isPaid: t.is_paid,
            accountId: t.account_id,
            toAccountId: t.to_account_id,
            categoryId: t.category_id,
            creditCardId: t.credit_card_id,
            contactId: t.contact_id,
            recurrenceId: t.recurrence_id,
            installmentIndex: t.installment_index,
            totalInstallments: t.total_installments,
            originType: t.origin_type,
            originId: t.origin_id,
            tenantId: t.tenant_id
        })) as FinancialTransaction[];
    },
    addTransaction: async (t: Partial<FinancialTransaction>, recurrence?: any) => {
        const tenantId = getCurrentTenantId();
        const transactionsToInsert: any[] = [];
        const baseRecurrenceId = recurrence?.isRecurring ? crypto.randomUUID() : null;

        // Helper to prepare DB object
        const createDbObj = (trans: Partial<FinancialTransaction>, date: string, recId: string | null, index?: number, total?: number) => ({
            description: trans.description,
            amount: trans.amount,
            type: trans.type,
            date: date,
            is_paid: trans.isPaid,
            account_id: uuidOrNull(trans.accountId),
            to_account_id: uuidOrNull(trans.toAccountId),
            category_id: uuidOrNull(trans.categoryId),
            credit_card_id: uuidOrNull(trans.creditCardId),
            contact_id: uuidOrNull(trans.contactId),
            origin_type: trans.originType,
            origin_id: uuidOrNull(trans.originId),
            recurrence_id: uuidOrNull(recId) || uuidOrNull(trans.recurrenceId), // Fix: Respect provided recurrenceId
            installment_index: index,
            total_installments: total,
            links: trans.links,
            tenant_id: tenantId
        });

        if (recurrence && recurrence.isRecurring) {
            const count = recurrence.repeatCount || 1;
            const startDate = new Date(t.date || new Date());

            for (let i = 0; i < count; i++) {
                let nextDate = new Date(startDate);
                if (recurrence.frequency === 'daily') nextDate = addDays(startDate, i);
                if (recurrence.frequency === 'weekly') nextDate = addWeeks(startDate, i);
                if (recurrence.frequency === 'monthly') nextDate = addMonths(startDate, i);
                if (recurrence.frequency === 'yearly') nextDate = addYears(startDate, i);

                const dateStr = nextDate.toISOString().split('T')[0];
                transactionsToInsert.push(createDbObj(t, dateStr, baseRecurrenceId, i + 1, count));
            }
        } else {
            // Single transaction
            transactionsToInsert.push(createDbObj(t, t.date || new Date().toISOString().split('T')[0], null, t.installmentIndex, t.totalInstallments));
        }

        const { data, error } = await supabase.from('financial_transactions').insert(transactionsToInsert).select();
        if (error) throw error;
        return data[0] as FinancialTransaction; // Return first for linking if needed
    },
    updateTransaction: async (t: FinancialTransaction, scope: 'single' | 'future' = 'single') => {
        // Base fields that can be updated in bulk
        const dbBaseOptions = {
            description: t.description,
            amount: t.amount,
            type: t.type,
            account_id: uuidOrNull(t.accountId),
            to_account_id: uuidOrNull(t.toAccountId),
            category_id: uuidOrNull(t.categoryId),
            credit_card_id: uuidOrNull(t.creditCardId),
            contact_id: uuidOrNull(t.contactId),
            origin_type: t.originType,
            origin_id: uuidOrNull(t.originId),
            recurrence_id: uuidOrNull(t.recurrenceId),
            installment_index: t.installmentIndex,
            total_installments: t.totalInstallments,
            links: t.links
        };

        // For the specific item being edited, we also update date and status
        const dbTransSpecific = {
            ...dbBaseOptions,
            date: t.date,
            is_paid: t.isPaid,
        };

        // 1. Update the specific transaction (This covers 'single' scope and the 'this' part of 'this and future')
        const { error } = await supabase.from('financial_transactions').update(dbTransSpecific).eq('id', t.id);
        if (error) throw error;

        // 2. If scope is future, update subsequent transactions
        if (scope === 'future' && t.recurrenceId) {
            // We do NOT update 'date' or 'is_paid' for future items to preserve their schedule and status
            const { error: batchError } = await supabase.from('financial_transactions')
                .update(dbBaseOptions)
                .eq('recurrence_id', t.recurrenceId)
                .gt('date', t.date);

            if (batchError) throw batchError;
        }
    },
    toggleTransactionStatus: async (id: string, isPaid: boolean) => {
        const { error } = await supabase.from('financial_transactions').update({ is_paid: isPaid }).eq('id', id);
        if (error) throw error;
        // Also toggle linked technical transactions (e.g. credit card limit release)
        await supabase.from('financial_transactions')
            .update({ is_paid: isPaid })
            .eq('origin_id', id)
            .eq('origin_type', 'technical');
    },
    deleteTransaction: async (id: string, scope: 'single' | 'future' = 'single', recurrenceId?: string, date?: string) => {
        // Helper to delete technical transactions
        const deleteTechnical = async (targetId: string) => {
            await supabase.from('financial_transactions')
                .delete()
                .eq('origin_id', targetId)
                .eq('origin_type', 'technical');
        };

        if (scope === 'single') {
            await deleteTechnical(id);
            const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
            if (error) throw error;
        } else if (scope === 'future' && recurrenceId && date) {
            // Find all IDs to delete first (to cleanup technicals)
            const { data: toDelete } = await supabase.from('financial_transactions')
                .select('id')
                .eq('recurrence_id', recurrenceId)
                .gte('date', date);

            if (toDelete && toDelete.length > 0) {
                const ids = toDelete.map(r => r.id);
                // Cleanup technicals for all
                for (const tid of ids) await deleteTechnical(tid);

                // Delete actuals
                const { error } = await supabase.from('financial_transactions')
                    .delete()
                    .in('id', ids);
                if (error) throw error;
            }
        } else {
            // Fallback if missing params
            await deleteTechnical(id);
            const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
            if (error) throw error;
        }
    },
    cleanupCardTechnicalTransactions: async (cardId: string) => {
        // Delete orphans: "Technical Income" on the card that has NO origin_id linked to a real payment.
        // OR legacy ones that just have the description but no origin_id.
        const { error } = await supabase.from('financial_transactions')
            .delete()
            .eq('credit_card_id', cardId)
            .eq('type', 'income')
            .is('origin_id', null)
            .ilike('description', '%Pagamento Fatura%'); // Safe check

        if (error) throw error;
    },

    getFinancialAccounts: async (tenantId?: string) => {
        let query = supabase.from('financial_accounts').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((a: any) => ({ ...a, initialBalance: a.initial_balance, tenantId: a.tenant_id })) as FinancialAccount[];
    },
    addFinancialAccount: async (data: Partial<FinancialAccount>) => {
        const tenantId = getCurrentTenantId();
        const { error } = await supabase.from('financial_accounts').insert([{
            name: data.name,
            type: data.type,
            initial_balance: data.initialBalance,
            tenant_id: tenantId
        }]);
        if (error) throw error;
    },
    updateFinancialAccount: async (data: FinancialAccount) => {
        const { error } = await supabase.from('financial_accounts').update({
            name: data.name,
            type: data.type,
            initial_balance: data.initialBalance
        }).eq('id', data.id);
        if (error) throw error;
    },
    deleteFinancialAccount: async (id: string) => {
        const { error } = await supabase.from('financial_accounts').delete().eq('id', id);
        if (error) throw error;
    },

    getFinancialCategories: async (tenantId?: string) => {
        let query = supabase.from('financial_categories').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((c: any) => ({ ...c, tenantId: c.tenant_id })) as FinancialCategory[];
    },
    addFinancialCategory: async (data: Partial<FinancialCategory>) => {
        const tenantId = getCurrentTenantId();
        const { data: retData, error } = await supabase.from('financial_categories').insert([{ ...data, tenant_id: tenantId }]).select();
        if (error) throw error;
        const ret = retData[0];
        return { ...ret, tenantId: ret.tenant_id } as FinancialCategory;
    },
    updateFinancialCategory: async (data: FinancialCategory) => {
        const { error } = await supabase.from('financial_categories').update(data).eq('id', data.id);
        if (error) throw error;
    },
    deleteFinancialCategory: async (id: string) => {
        const { error } = await supabase.from('financial_categories').delete().eq('id', id);
        if (error) throw error;
    },

    getCreditCards: async (tenantId?: string) => {
        let query = supabase.from('credit_cards').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((c: any) => ({
            ...c,
            limitAmount: c.limit_amount,
            closingDay: c.closing_day,
            dueDay: c.due_day,
            tenantId: c.tenant_id
        })) as CreditCard[];
    },
    addCreditCard: async (data: Partial<CreditCard>) => {
        const tenantId = getCurrentTenantId();
        const { error } = await supabase.from('credit_cards').insert([{
            name: data.name,
            limit_amount: data.limitAmount,
            closing_day: data.closingDay,
            due_day: data.dueDay,
            tenant_id: tenantId
        }]);
        if (error) throw error;
    },
    updateCreditCard: async (data: CreditCard) => {
        const { error } = await supabase.from('credit_cards').update({
            name: data.name,
            limit_amount: data.limitAmount,
            closing_day: data.closingDay,
            due_day: data.dueDay
        }).eq('id', data.id);
        if (error) throw error;
    },
    deleteCreditCard: async (id: string) => {
        const { error } = await supabase.from('credit_cards').delete().eq('id', id);
        if (error) throw error;
    },

    // --- COMMERCIAL ---
    getContacts: async (tenantId?: string) => {
        let query = supabase.from('contacts').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((c: any) => ({
            ...c,
            fantasyName: c.fantasy_name,
            adminName: c.admin_name,
            tenantId: c.tenant_id
        })) as Contact[];
    },
    addContact: async (c: Partial<Contact>) => {
        const tenantId = getCurrentTenantId();
        const dbContact = {
            name: c.name,
            type: c.type,
            scope: c.scope,
            email: c.email,
            phone: c.phone,
            document: c.document,
            address: c.address,
            fantasy_name: c.fantasyName,
            admin_name: c.adminName,
            notes: c.notes,
            tenant_id: tenantId
        };
        const { data, error } = await supabase.from('contacts').insert([dbContact]).select();
        if (error) throw error;
        const ret = data[0];
        return {
            ...ret,
            fantasyName: ret.fantasy_name,
            adminName: ret.admin_name,
            tenantId: ret.tenant_id
        } as Contact;
    },
    updateContact: async (c: Contact) => {
        const dbContact = {
            name: c.name,
            type: c.type,
            scope: c.scope,
            email: c.email,
            phone: c.phone,
            document: c.document,
            address: c.address,
            fantasy_name: c.fantasyName,
            admin_name: c.adminName,
            notes: c.notes
        };
        const { error } = await supabase.from('contacts').update(dbContact).eq('id', c.id);
        if (error) throw error;
    },
    deleteContact: async (id: string) => {
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) throw error;
    },

    getCatalogItems: async (tenantId?: string) => {
        let query = supabase.from('catalog_items').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((i: any) => ({
            ...i,
            financialCategoryId: i.financial_category_id,
            tenantId: i.tenant_id
        })) as CatalogItem[];
    },
    addCatalogItem: async (i: Partial<CatalogItem>) => {
        const tenantId = getCurrentTenantId();
        const { error } = await supabase.from('catalog_items').insert([{
            name: i.name,
            type: i.type,
            price: i.price,
            description: i.description,
            active: i.active,
            financial_category_id: uuidOrNull(i.financialCategoryId),
            tenant_id: tenantId
        }]);
        if (error) throw error;
    },

    switchActiveTenant: async (tenantId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user logged in");

        const { error } = await supabase.from('profiles').update({ tenant_id: tenantId }).eq('id', user.id);
        if (error) throw error;
    },

    // Update Tenant Settings (Finance)
    updateTenantSettings: async (settings: any) => {
        const tenantId = getCurrentTenantId();
        // Prevent saving calendar settings inside general settings JSONB to avoid duplication
        const settingsToSave = { ...settings };
        delete settingsToSave.calendar;

        const { error } = await supabase.from('tenants').update({ settings: settingsToSave }).eq('id', tenantId);
        if (error) throw error;
    },

    getTenantSettings: async () => {
        const tenantId = getCurrentTenantId();
        const { data, error } = await supabase.from('tenants').select('settings, calendar_settings').eq('id', tenantId).single();
        if (error) throw error;

        // Merge general settings with dedicated calendar_settings column
        return {
            ...(data?.settings || {}),
            calendar: data?.calendar_settings
        };
    },

    updateCatalogItem: async (i: CatalogItem) => {
        const { error } = await supabase.from('catalog_items').update({
            name: i.name,
            type: i.type,
            price: i.price,
            description: i.description,
            active: i.active,
            financial_category_id: uuidOrNull(i.financialCategoryId)
        }).eq('id', i.id);
        if (error) throw error;
    },
    deleteCatalogItem: async (id: string) => {
        const { error } = await supabase.from('catalog_items').delete().eq('id', id);
        if (error) throw error;
    },

    getQuotes: async (tenantId?: string) => {
        let query = supabase.from('quotes').select('*, contacts(*), quote_items(*)');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((q: any) => ({
            ...q,
            createdAt: q.created_at, // Explicit map
            contactId: q.contact_id,
            customerName: q.customer_name,
            customerPhone: q.customer_phone,
            validUntil: q.valid_until,
            totalValue: q.total_value,
            tenantId: q.tenant_id,
            // Deep map relations if necessary
            contact: q.contacts ? { ...q.contacts, fantasyName: q.contacts.fantasy_name } : undefined,
            items: q.quote_items.map((qi: any) => ({
                ...qi,
                catalogItemId: qi.catalog_item_id,
                unitPrice: qi.unit_price
            }))
        })) as Quote[];
    },
    addQuote: async (q: Partial<Quote>, items: any[]) => {
        const tenantId = getCurrentTenantId();
        // 1. Insert Quote
        const { data: quote, error: qError } = await supabase.from('quotes').insert([{
            contact_id: uuidOrNull(q.contactId),
            customer_name: q.customerName,
            customer_phone: q.customerPhone,
            status: q.status || 'draft',
            date: q.date,
            valid_until: q.validUntil,
            total_value: q.totalValue,
            notes: q.notes,
            tenant_id: tenantId
        }]).select().single();

        if (qError) throw qError;

        // 2. Insert Items
        if (items && items.length > 0) {
            const dbItems = items.map(i => ({
                quote_id: quote.id,
                catalog_item_id: i.catalogItemId,
                description: i.description,
                quantity: i.quantity,
                unit_price: i.unitPrice,
                total: i.total
            }));
            const { error: iError } = await supabase.from('quote_items').insert(dbItems);
            if (iError) throw iError;
        }
    },
    updateQuote: async (q: Partial<Quote>, items: any[]) => {
        // Update quote fields
        const { error } = await supabase.from('quotes').update({
            contact_id: uuidOrNull(q.contactId),
            status: q.status,
            total_value: q.totalValue,
            valid_until: q.validUntil,
            notes: q.notes
        }).eq('id', q.id);
        if (error) throw error;

        // Re-write items (naive approach: delete all and insert new)
        if (items) {
            await supabase.from('quote_items').delete().eq('quote_id', q.id);
            if (items.length > 0) {
                const dbItems = items.map(i => ({
                    quote_id: q.id,
                    catalog_item_id: i.catalogItemId,
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unitPrice,
                    total: i.total
                }));
                await supabase.from('quote_items').insert(dbItems);
            }
        }
    },
    deleteQuote: async (id: string) => {
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if (error) throw error;
    },

    getRecurringServices: async (tenantId?: string) => {
        let query = supabase.from('recurring_services').select('*, contacts(*)');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((r: any) => ({
            ...r,
            contactId: r.contact_id,
            setupFee: r.setup_fee,
            recurringAmount: r.recurring_amount,
            startDate: r.start_date,
            contractMonths: r.contract_months,
            tenantId: r.tenant_id,
            financialCategoryId: r.financial_category_id,
            setupCategoryId: r.setup_category_id,
            setupEntryAmount: r.setup_entry_amount,
            setupEntryDate: r.setup_entry_date,
            setupRemainingAmount: r.setup_remaining_amount,
            setupRemainingDate: r.setup_remaining_date,
            firstRecurrenceDate: r.first_recurrence_date,
            contact: r.contacts ? { ...r.contacts, fantasyName: r.contacts.fantasy_name } : undefined
        })) as RecurringService[];
    },
    addRecurringService: async (data: Partial<RecurringService>) => {
        console.log("Adding Recurring Service:", data);
        const tenantId = getCurrentTenantId();

        // 1. Prepare DB Insert Data
        // Map UI 'spot' date to DB 'setup_entry_date' if applicable explanation: "Entry" logic reused for "Spot"
        const dbSetupEntryDate = data.setupSpotDate || data.setupEntryDate;

        const { data: rec, error } = await supabase.from('recurring_services').insert([{
            contact_id: uuidOrNull(data.contactId),
            setup_fee: data.setupFee ? parseFloat(data.setupFee.toString()) : 0,
            recurring_amount: data.recurringAmount ? parseFloat(data.recurringAmount.toString()) : 0,
            start_date: data.startDate ? new Date(data.startDate).toISOString() : new Date().toISOString(),
            frequency: data.frequency || 'monthly',
            contract_months: data.contractMonths ? parseInt(data.contractMonths.toString()) : 12,
            active: true,
            tenant_id: tenantId,
            financial_category_id: uuidOrNull(data.financialCategoryId),
            setup_category_id: uuidOrNull(data.setupCategoryId),
            setup_entry_amount: data.setupEntryAmount ? parseFloat(data.setupEntryAmount.toString()) : 0,
            setup_entry_date: dbSetupEntryDate || null,
            setup_remaining_amount: data.setupRemainingAmount ? parseFloat(data.setupRemainingAmount.toString()) : 0,
            setup_remaining_date: data.setupRemainingDate || null,
            first_recurrence_date: data.firstRecurrenceDate || null
        }]).select().single();

        if (error) {
            console.error("Supabase Insert Error:", error);
            throw error;
        }

        console.log("Recurring Service Created:", rec);

        // remove any transactions that might have been auto-generated by database triggers
        // to prevent duplicates and ensure we use the strict logic below.
        // 1. Delete by recurrence_id (if trigger sets it)
        await supabase.from('financial_transactions').delete().eq('recurrence_id', rec.id);

        // 2. Delete by strict "Ghost Pattern" (Aggressive Mode)
        // Delete ALL transactions for this contact created in the last 30 seconds to strictly enforce our custom logic
        // This clears any trigger-generated noise before we write our clean records.
        const offset = new Date().getTimezoneOffset();
        const past30s = new Date(Date.now() - 30000 - (offset * 60 * 1000)).toISOString();
        await supabase.from('financial_transactions')
            .delete()
            .eq('contact_id', data.contactId)
            .gt('created_at', past30s);

        // 3. Delete "Ghost Category" if created by trigger (User request: "NAO é pra criar")
        try {
            await supabase.from('financial_categories')
                .delete()
                .eq('name', 'Receita Recorrente')
                .gt('created_at', past30s);
        } catch (e) { /* Ignore cleanup error */ }



        // --- TRANSACTION GENERATION (STRICT SEPARATION) ---
        const contractId = rec.id;

        // 2. Generate SETUP Transactions (Independent)
        if (data.setupFee && data.setupFee > 0 && data.setupCategoryId) {
            // Case A: Split Payment
            if (data.setupEntryAmount && data.setupEntryAmount > 0 && data.setupEntryDate) {
                await api.addTransaction({
                    description: `Setup (Entrada) - ${data.contactName || 'Contrato #' + contractId.substring(0, 4)}`,
                    amount: data.setupEntryAmount,
                    type: 'income',
                    date: data.setupEntryDate, // Strict date usage
                    categoryId: uuidOrNull(data.setupCategoryId),
                    accountId: uuidOrNull(data.bankAccountId), // Add Bank Account
                    contactId: uuidOrNull(data.contactId),
                    isPaid: false
                });
            }
            if (data.setupRemainingAmount && data.setupRemainingAmount > 0 && data.setupRemainingDate) {
                await api.addTransaction({
                    description: `Setup (Restante) - ${data.contactName || 'Contrato #' + contractId.substring(0, 4)}`,
                    amount: data.setupRemainingAmount,
                    type: 'income',
                    date: data.setupRemainingDate, // Strict date usage
                    categoryId: uuidOrNull(data.setupCategoryId),
                    accountId: uuidOrNull(data.bankAccountId), // Add Bank Account
                    contactId: uuidOrNull(data.contactId),
                    isPaid: false
                });
            }

            // Case B: Spot Payment (Single)
            // If we have a Fee, but NO split amounts/dates, check for Spot Date
            const isSplit = (data.setupEntryAmount && data.setupEntryAmount > 0 && data.setupRemainingAmount && data.setupRemainingAmount > 0);

            if (!isSplit && data.setupSpotDate) {
                await api.addTransaction({
                    description: `Setup (À Vista) - ${data.contactName || 'Contrato #' + contractId.substring(0, 4)}`,
                    amount: data.setupFee,
                    type: 'income',
                    date: data.setupSpotDate, // Strict date usage
                    categoryId: uuidOrNull(data.setupCategoryId),
                    accountId: uuidOrNull(data.bankAccountId), // Add Bank Account
                    contactId: uuidOrNull(data.contactId),
                    isPaid: false
                });
            }
        }

        // 3. Generate RECURRING Transactions (Independent)
        if (data.active && data.recurringAmount > 0 && data.financialCategoryId && data.firstRecurrenceDate) {
            let nextDate = new Date(data.firstRecurrenceDate); // Strict start date

            // Generate for contract length or for 12 months if indefinite
            const monthsToGen = data.contractMonths && data.contractMonths > 0 ? data.contractMonths : 12;

            for (let i = 0; i < monthsToGen; i++) {
                if (i > 60) break; // Safety cap

                // Strict date calculation: valid Date object required
                if (isNaN(nextDate.getTime())) {
                    console.error("Invalid recurrence date, skipping generation for month", i);
                    break;
                }

                await api.addTransaction({
                    description: `Mensalidade ${i + 1}/${data.contractMonths || 'Inf'} - ${data.contactName || 'Contrato #' + contractId.substring(0, 4)}`,
                    amount: data.recurringAmount,
                    type: 'income',
                    date: nextDate.toISOString().split('T')[0],
                    categoryId: uuidOrNull(data.financialCategoryId),
                    accountId: uuidOrNull(data.bankAccountId), // Add Bank Account
                    contactId: uuidOrNull(data.contactId),
                    isPaid: false,
                    recurrenceId: contractId // Link to contract
                });

                // Advance one month
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
        }

        return rec;
    },
    deleteRecurringService: async (id: string) => {
        const { error } = await supabase.from('recurring_services').delete().eq('id', id);
        if (error) throw error;
    },
    syncContractFinancials: async (contractId: string, categoryId?: string, sourceId?: string) => {
        // Simple placeholder for generating future transactions logic
        console.log("Future: Implement server-side generation of invoices");
    },
    ensureSetupCategory: async () => {
        const tenantId = getCurrentTenantId();
        const { data: existing } = await supabase
            .from('financial_categories')
            .select('id')
            .eq('name', 'Setup')
            .eq('tenant_id', tenantId)
            .single();

        if (existing) return existing.id;

        const { data: created, error } = await supabase
            .from('financial_categories')
            .insert([{ name: 'Setup', type: 'income', color: '#4f46e5', tenant_id: tenantId }])
            .select()
            .single();

        if (error) throw error;
        return created.id;
    },

    // --- DELEGATIONS ---
    getMyDelegations: async () => {
        const { data, error } = await supabase.from('delegations')
            .select('*, owner:profiles!owner_id(name, email, avatar_url), delegate:profiles!delegate_id(name, email, avatar_url)');
        if (error) return [];

        return data.map((d: any) => ({
            id: d.id,
            ownerId: d.owner_id,
            delegateId: d.delegate_id,
            module: d.module,
            permissions: d.permissions,
            owner: d.owner ? {
                name: d.owner.name,
                email: d.owner.email,
                avatarUrl: d.owner.avatar_url
            } : undefined,
            delegate: d.delegate ? {
                name: d.delegate.name,
                email: d.delegate.email,
                avatarUrl: d.delegate.avatar_url
            } : undefined
        })) as Delegation[];
    },
    addDelegation: async (d: Partial<Delegation>) => {
        await supabase.from('delegations').insert([{
            owner_id: d.ownerId || (await supabase.auth.getUser()).data.user?.id, // Default to current user if not specified
            delegate_id: d.delegateId,
            module: d.module,
            permissions: d.permissions
        }]);
    },
    updateDelegation: async (id: string, permissions: any) => {
        const { error } = await supabase.from('delegations').update({ permissions }).eq('id', id);
        if (error) throw error;
    },
    getDelegators: async (module: 'tasks' | 'agenda'): Promise<string[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase.from('delegations')
            .select('owner_id, permissions')
            .eq('delegate_id', user.id)
            .eq('module', module);

        if (error) throw error;

        // Filter those who gave at least 'create' or 'edit' or 'view' permission?
        // User says: "Usuários que concederam acesso direto ...". Usually implies View/Create.
        // If I can assign a task to them, I need at least some access.
        // Let's assume ANY delegation record for the module implies "Access Granted" for this context, 
        // OR strictly check permissions?
        // The Prompt says: "Usuários que não concederam acesso... NÃO devem aparecer".
        // It doesn't specify which permission bit. But usually if I delegate 'agenda', I expect you to manage it.
        // Let's filter for where 'create' or 'edit' is true, OR just simple existence if we assume granular permissions are for specific actions.
        // Actually, for "Assigning", I am creating a task FOR them.
        // If they granted me "View" only, can I create a task for them? Probably not?
        // But usually delegation is "Manage my stuff".
        // Let's just return all owners found for the module effectively.
        // Or better, let's filter for explicit permissions if needed.
        // For 'tasks', usually I need 'create' permission on their behalf? 
        // OR 'edit'?
        // Let's stick to existence of delegation record for now, as that's the "Access" concept.

        return data.map((d: any) => d.owner_id);
    },
    deleteDelegation: async (id: string) => {
        await supabase.from('delegations').delete().eq('id', id);
    },

    // --- TENANTS & SUPER ADMIN ---
    getTenantById: async (id: string) => {
        const { data, error } = await supabase.from('tenants').select('*').eq('id', id).single();
        if (error) return null;
        return {
            ...data,
            ownerEmail: data.owner_email,
            adminName: data.admin_name,
            contractedModules: data.contracted_modules,
            createdAt: data.created_at,
            financialStatus: data.financial_status,
            lastActiveAt: data.last_active_at,
            settings: {
                ...data.settings,
                calendar: data.calendar_settings
            }
        } as Tenant;
    },
    adminListTenants: async () => {
        const { data, error } = await supabase.from('tenants').select('*, saas_plans(name)');
        if (error) throw error;
        return data.map((t: any) => ({
            ...t,
            planName: t.saas_plans?.name,
            ownerEmail: t.owner_email,
            adminName: t.admin_name,
            contractedModules: t.contracted_modules,
            createdAt: t.created_at,
            financialStatus: t.financial_status,
            lastActiveAt: t.last_active_at,
            settings: {
                ...t.settings,
                calendar: t.calendar_settings
            }
        })) as Tenant[];
    },
    createTenant: async (data: any) => {
        console.log('[API] Calling create-tenant-admin Edge Function with:', data);

        const { data: response, error } = await supabase.functions.invoke('create-tenant-admin', {
            body: {
                name: data.name,
                ownerEmail: data.ownerEmail,
                adminName: data.adminName,
                password: data.password,
                planId: data.planId,
                modules: data.modules
            }
        });

        if (error || response?.error) {
            const errorMsg = error?.message || response?.error || 'Unknown error';
            console.error('[API] Edge Function failed:', errorMsg);
            throw new Error(errorMsg);
        }

        // Post-creation update for new real fields
        if (data.type || data.financialStatus) {
            await supabase.from('tenants').update({
                type: data.type || 'client',
                financial_status: data.financialStatus || 'ok'
            }).eq('id', response.tenantId);
        }

        return response.tenantId;
    },
    updateTenant: async (id: string, data: any) => {
        const dbData: any = {
            name: data.name,
            owner_email: data.ownerEmail,
            admin_name: data.adminName,
            cnpj: data.cnpj,
            phone: data.phone,
            contracted_modules: data.modules,
            plan_id: data.planId,
            status: data.status,
            type: data.type,
            financial_status: data.financialStatus,
            calendar_settings: data.settings?.calendar
        };
        // Remove undefined keys
        Object.keys(dbData).forEach(key => dbData[key] === undefined && delete dbData[key]);

        await supabase.from('tenants').update(dbData).eq('id', id);
    },
    updateCalendarSettings: async (settings: any) => {
        const tenantId = getCurrentTenantId();
        if (!tenantId) throw new Error("No tenant ID");
        const { error } = await supabase.from('tenants').update({ calendar_settings: settings }).eq('id', tenantId);
        if (error) throw error;
    },
    getSaasPlans: async () => {
        const { data } = await supabase.from('saas_plans').select('*');
        return data?.map((p: any) => ({
            ...p,
            billingCycle: p.billing_cycle,
            allowedModules: p.allowed_modules,
            maxUsers: p.max_users
        })) as SaasPlan[] || [];
    },
    createSaasPlan: async (data: any) => {
        const dbData = {
            ...data,
            billing_cycle: data.billingCycle,
            allowed_modules: data.allowedModules,
            max_users: data.maxUsers
        };
        await supabase.from('saas_plans').insert([dbData]);
    },
    updateSaasPlan: async (data: any) => {
        const dbData = {
            ...data,
            billing_cycle: data.billingCycle,
            allowed_modules: data.allowedModules,
            max_users: data.maxUsers
        };
        await supabase.from('saas_plans').update(dbData).eq('id', data.id);
    },
    getGlobalStats: async (): Promise<GlobalStats> => {
        const { count: tenantCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
        const { count: activeTenants } = await supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active');
        const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: planCount } = await supabase.from('saas_plans').select('*', { count: 'exact', head: true }).eq('active', true);

        return {
            totalTenants: tenantCount || 0,
            activeTenants: activeTenants || 0,
            totalUsers: userCount || 0,
            activePlans: planCount || 0
        };
    },

    // --- DASHBOARD METRICS ---
    getDashboardMetrics: async (tenantId?: string): Promise<DashboardMetrics> => {
        const { data, error } = await supabase.rpc('get_dashboard_stats', { p_tenant_id: tenantId });
        if (error) {
            console.error('Error fetching dashboard stats via RPC:', error);
            throw error;
        }
        return data as DashboardMetrics;
    }
};
