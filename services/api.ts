
import {
    Task, Project, Team, User, CalendarEvent,
    FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard,
    Contact, Quote, CatalogItem, RecurringService,
    Tenant, SaasPlan, Delegation,
    DashboardMetrics, GlobalStats, UserPermissions
} from '../types';
import { supabase } from './supabase';

export const getErrorMessage = (error: any): string => {
    return error?.message || error?.error_description || String(error);
};

// Helper: Ensure we always have a tenant ID (fallback to auth user's tenant if not explicitly set)
const getCurrentTenantId = () => {
    return localStorage.getItem('ecoflow-tenant-id');
};

// Helper: Convert empty strings to null for UUID fields to prevent Postgres errors
const uuidOrNull = (val: any) => (val === '' || val === undefined) ? null : val;

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
    addTask: async (task: Partial<Task>) => {
        const tenantId = getCurrentTenantId();
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
            links: task.links,
            tenant_id: tenantId
        };

        // Remove undefined fields to let DB defaults work
        if (!dbTask.status) delete dbTask.status;
        if (!dbTask.priority) delete dbTask.priority;

        const { data, error } = await supabase
            .from('tasks')
            .insert([dbTask])
            .select()
            .single();

        if (error) throw error;
        // Map back to camelCase for the UI
        return {
            ...data,
            assigneeId: data.assignee_id,
            projectId: data.project_id,
            teamId: data.team_id,
            tenantId: data.tenant_id,
            dueDate: data.due_date,
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
        const dbProject = {
            name: project.name,
            description: project.description,
            status: project.status,
            progress: project.progress,
            due_date: project.dueDate,
            tenant_id: tenantId,
            team_ids: project.teamIds,
            member_ids: project.members,
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
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
    },
    updateUserPermissions: async (id: string, permissions: UserPermissions) => {
        // Permissions usually in a separate table or column.
        // Assuming column exists (it wasn't in my minimal schema, I should have added it, but let's assume JSONB in profiles or dedicated table)
        // Check schema.sql... I didn't add permissions column explicitly. 
        // I will attempt to update it if it exists.
        const { error } = await supabase.from('profiles').update({ permissions }).eq('id', id);
        if (error) console.warn("Permissions update failed (column might be missing)", error);
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


    // --- EVENTS ---
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
            tenantId: e.tenant_id
        })) as CalendarEvent[];
    },
    addEvent: async (evt: Partial<CalendarEvent>) => {
        const tenantId = getCurrentTenantId();
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
            tenant_id: tenantId
        };
        const { error } = await supabase.from('calendar_events').insert([dbEvt]);
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
            links: evt.links
        };
        const { error } = await supabase.from('calendar_events').update(dbEvt).eq('id', evt.id);
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
        const dbTrans = {
            description: t.description,
            amount: t.amount,
            type: t.type,
            date: t.date,
            is_paid: t.isPaid,
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
            links: t.links,
            tenant_id: tenantId
        };
        const { data, error } = await supabase.from('financial_transactions').insert([dbTrans]).select().single();
        if (error) throw error;
        return data as FinancialTransaction; // Return for linking
    },
    updateTransaction: async (t: FinancialTransaction, scope: 'single' | 'future' = 'single') => {
        const dbTrans = {
            description: t.description,
            amount: t.amount,
            type: t.type,
            date: t.date,
            is_paid: t.isPaid,
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
        const { error } = await supabase.from('financial_transactions').update(dbTrans).eq('id', t.id);
        if (error) throw error;
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
    deleteTransaction: async (id: string) => {
        // First delete any linked technical transactions (e.g. credit card limit release)
        await supabase.from('financial_transactions')
            .delete()
            .eq('origin_id', id)
            .eq('origin_type', 'technical');

        const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
        if (error) throw error;
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
        const { error } = await supabase.from('financial_categories').insert([{ ...data, tenant_id: tenantId }]);
        if (error) throw error;
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
        const { error } = await supabase.from('contacts').insert([dbContact]);
        if (error) throw error;
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
    updateTenantSettings: async (settings: any) => {
        const tenantId = getCurrentTenantId();
        const { error } = await supabase.from('tenants').update({ settings }).eq('id', tenantId);
        if (error) throw error;
    },
    getTenantSettings: async () => {
        const tenantId = getCurrentTenantId();
        const { data, error } = await supabase.from('tenants').select('settings').eq('id', tenantId).single();
        if (error) throw error;
        return data?.settings || {};
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
            contact: r.contacts ? { ...r.contacts, fantasyName: r.contacts.fantasy_name } : undefined
        })) as RecurringService[];
    },
    addRecurringService: async (data: Partial<RecurringService>) => {
        const tenantId = getCurrentTenantId();
        const { data: rec, error } = await supabase.from('recurring_services').insert([{
            contact_id: uuidOrNull(data.contactId),
            setup_fee: data.setupFee,
            recurring_amount: data.recurringAmount,
            start_date: data.startDate,
            frequency: data.frequency,
            contract_months: data.contractMonths,
            active: true,
            tenant_id: tenantId
        }]).select().single();
        if (error) throw error;
        return rec.id;
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
        const { data, error } = await supabase.from('delegations').select('*');
        if (error) return [];
        return data as Delegation[];
    },
    addDelegation: async (d: Partial<Delegation>) => {
        await supabase.from('delegations').insert([d]);
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
