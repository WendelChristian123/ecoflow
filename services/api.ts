
import {
    Task, Project, Team, User, CalendarEvent,
    FinancialTransaction, FinancialAccount, FinancialCategory, CreditCard,
    Contact, Quote, CatalogItem, RecurringService, RecurrenceConfig,
    Company, SaasPlan, Delegation, SharedAccess,
    DashboardMetrics, GlobalStats, UserPermission, LegacyUserPermissions, AuditLog
} from '../types';
import { supabase } from './supabase';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

export const getErrorMessage = (error: any): string => {
    return error?.message || error?.error_description || String(error);
};

// Helper: Ensure we always have a company ID (fallback to auth user's company if not explicitly set)
const getCurrentCompanyId = () => {
    return localStorage.getItem('ecoflow-company-id');
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

    registerCompany: async (data: any) => {
        const { data: response, error } = await supabase.functions.invoke('auth-signup', {
            body: data
        });

        if (error) throw error;
        if (response.error) throw new Error(response.error);

        return response;
    },

    // --- TASKS ---
    // --- TASKS ---
    getTasks: async (companyId?: string) => {
        let query = supabase.from('tasks').select('*');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((t: any) => ({
            ...t,
            assigneeId: t.assignee_id,
            projectId: t.project_id,
            teamId: t.team_id,
            companyId: t.company_id,
            dueDate: t.due_date,
        })) as Task[];
    },

    // Unified Logs Fetcher
    getLogs: async (entityId: string) => {
        const { data, error } = await supabase
            .from('activity_logs')
            .select(`
                *,
                user:user_id ( id, name, avatar_url )
            `)
            .eq('entity_id', entityId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map((log: any) => ({
            id: log.id,
            entityId: log.entity_id,
            entityType: log.entity_type,
            action: log.action,
            userId: log.user_id,
            timestamp: log.created_at,
            details: log.details,
            metadata: log.metadata,
            user: log.user // Optional, for UI display
        }));
    },

    // Generic Log Inserter
    addActivityLog: async (entry: {
        entityId: string,
        entityType: string,
        action: string,
        details?: string,
        metadata?: any
    }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // Should likely throw, but safe return for now

        const { error } = await supabase.from('activity_logs').insert({
            entity_id: entry.entityId,
            entity_type: entry.entityType,
            action: entry.action,
            user_id: user.id,
            details: entry.details,
            metadata: entry.metadata || {}
        });
        if (error) console.error("Error adding log:", error);
    },

    addTask: async (task: Partial<Task>, recurrence?: RecurrenceConfig) => {
        const companyId = getCurrentCompanyId();
        const createdTasks: any[] = [];
        const baseRecurrenceId = recurrence ? crypto.randomUUID() : null;

        // Note: logs are now handled by DB Trigger (trg_log_task_creation)
        // Note: created_by is handled by DB Default/Trigger

        const createDbTask = (t: Partial<Task>, date: string, recId: string | null) => {
            return {
                title: t.title,
                description: t.description,
                status: t.status || 'todo',
                priority: t.priority || 'medium',
                assignee_id: uuidOrNull(t.assigneeId),
                project_id: uuidOrNull(t.projectId),
                team_id: uuidOrNull(t.teamId),
                due_date: date, // Expecting valid ISO string (UTC) from frontend
                tags: t.tags || [],
                links: t.links || [],
                company_id: companyId,
                recurrence_id: recId,
                // logs: REMOVED
            };
        };

        if (recurrence) {
            const count = recurrence.occurrences || (recurrence.endDate ? 0 : 12);
            const actualCount = count > 0 ? count : 12;
            const startDate = new Date(task.dueDate || new Date());

            for (let i = 0; i < actualCount; i++) {
                let nextDate = new Date(startDate);
                const interval = recurrence.interval || 1;
                if (recurrence.frequency === 'daily') nextDate = addDays(startDate, i * interval);
                if (recurrence.frequency === 'weekly') nextDate = addWeeks(startDate, i * interval);
                if (recurrence.frequency === 'monthly') nextDate = addMonths(startDate, i * interval);
                if (recurrence.frequency === 'yearly') nextDate = addYears(startDate, i * interval);

                if (recurrence.endDate && nextDate > new Date(recurrence.endDate)) break;

                // Pass full ISO string to preserve time (DB will store as TIMESTAMPTZ)
                const isoStr = nextDate.toISOString();
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

        const firstData = data[0];
        return {
            ...firstData,
            assigneeId: firstData.assignee_id,
            projectId: firstData.project_id,
            teamId: firstData.team_id,
            companyId: firstData.company_id,
            dueDate: firstData.due_date,
            links: firstData.links,
            // Logs are not returned inline anymore, specifically requested to fetch separate or just rely on IDs
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
            links: task.links,
            // logs: REMOVED field
        };

        const { error } = await supabase
            .from('tasks')
            .update(dbTask)
            .eq('id', task.id);
        if (error) throw error;
    },
    updateTaskStatus: async (id: string, status: string) => {
        // This is a status change, we should log it!
        // Wait, the caller is often "drag and drop". It's better if the logging happens explicitly or via this method.
        // Let's add the log here manually as it's a specific "Business Action" method.

        const { error } = await supabase.from('tasks').update({ status }).eq('id', id);
        if (error) throw error;

        // Log it
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('activity_logs').insert({
                entity_id: id,
                entity_type: 'task',
                action: 'status_change',
                user_id: user.id,
                details: `Alterou status para ${status}`,
                metadata: { to: status }
            });
        }
    },
    deleteTask: async (id: string) => {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
    },

    // --- PROJECTS ---
    getProjects: async (companyId?: string) => {
        let query = supabase.from('projects').select('*');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((p: any) => ({
            ...p,
            dueDate: p.due_date,
            companyId: p.company_id,
            teamIds: p.team_ids,
            members: p.member_ids,
        })) as Project[];
    },
    addProject: async (project: Partial<Project>) => {
        const companyId = getCurrentCompanyId();
        console.log("[API] addProject called. CompanyID:", companyId);

        if (!companyId) {
            console.error("[API] Missing Company ID");
            throw new Error("Company ID is required but missing from local storage.");
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
            company_id: companyId,
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
            owner_id: project.ownerId,
            links: project.links,
            logs: project.logs
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

    // --- USERS ---
    getUsers: async (companyId?: string) => {
        let query = supabase.from('profiles').select('*');
        if (companyId) query = query.eq('company_id', companyId);

        const { data: profiles, error: errProfiles } = await query;
        if (errProfiles) {
            console.error('Error fetching users:', errProfiles);
            throw errProfiles;
        }

        if (!profiles) return [];

        const validProfiles = profiles.filter((p: any) => p.role !== 'super_admin');

        const userIds = validProfiles.map(u => u.id);
        if (userIds.length === 0) return [];

        let permsQuery = supabase.from('user_permissions').select('*').in('user_id', userIds);
        if (companyId) permsQuery = permsQuery.eq('company_id', companyId);

        const { data: allPerms, error: errPerms } = await permsQuery;
        if (errPerms) console.warn("Could not fetch permissions:", errPerms);

        return validProfiles.map((u: any) => {
            const userPerms = allPerms?.filter(p => p.user_id === u.id) || [];
            return {
                ...u,
                companyId: u.company_id,
                avatarUrl: u.avatar_url,
                granular_permissions: userPerms
            };
        }) as User[];
    },

    // --- TEAMS ---
    getTeams: async (companyId?: string) => {
        let query = supabase.from('teams').select('*');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;

        return data.map((t: any) => ({
            ...t,
            leaderId: t.lead_id,
            companyId: t.company_id,
            memberIds: t.member_ids,
            logs: t.logs
        })) as Team[];
    },

    addTeam: async (team: Partial<Team>) => {
        const { error } = await supabase.from('teams').insert({
            name: team.name,
            description: team.description,
            lead_id: team.leaderId,
            member_ids: team.memberIds,
            links: team.links || [],
            logs: team.logs || [],
            company_id: team.companyId
        });
        if (error) throw error;
    },

    updateTeam: async (team: Team) => {
        const dbTeam = {
            name: team.name,
            description: team.description,
            lead_id: team.leaderId,
            member_ids: team.memberIds,
            links: team.links,
            logs: team.logs
        };
        const { error } = await supabase.from('teams').update(dbTeam).eq('id', team.id);
        if (error) throw error;
    },
    deleteTeam: async (id: string) => {
        const { error } = await supabase.from('teams').delete().eq('id', id);
        if (error) throw error;
    },


    getGlobalUsers: async () => {
        // Only super admin triggers this
        const { data, error } = await supabase.from('profiles').select('*, companies(name)');
        if (error) throw error;
        return data.map((u: any) => ({
            ...u,
            companyId: u.company_id,
            avatarUrl: u.avatar_url,
            companyName: u.companies?.name
        })) as User[];
    },
    getUserProfile: async (id: string) => {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
        if (error) return null;
        return {
            ...data,
            companyId: data.company_id,
            avatarUrl: data.avatar_url
        } as User;
    },
    createUser: async (userData: any, companyId?: string) => {
        // Force get latest session to ensure token is fresh
        const { data: { session } } = await supabase.auth.getSession();

        // Check limits first (Frontend Check)
        if (companyId) {
            const { checkUserLimit } = await import('./limits');
            const limitStatus = await checkUserLimit(companyId);
            if (!limitStatus.allowed) {
                throw new Error(`Limite de usuários atingido (${limitStatus.used}/${limitStatus.max}). Atualize seu plano.`);
            }
        }

        // Use native fetch to get proper error messages from 400 Bad Request responses
        // (Supabase client often swallows the body on error)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ ...userData, companyId })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Edge Function Error:', data);
            throw new Error(data.error || 'Falha ao criar usuário (Erro desconhecido)');
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
    adminUpdateUser: async (id: string, data: { name?: string, phone?: string, status?: string, permissions?: LegacyUserPermissions, granular_permissions?: UserPermission[], role?: string }) => {
        // Clean undefined keys
        const updates: any = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.phone !== undefined) updates.phone = data.phone;
        if (data.status !== undefined) updates.status = data.status;
        if (data.permissions !== undefined) updates.permissions = data.permissions;
        // Handle granular permissions via RPC or direct insert/upsert if table is available (frontend direct or edge function)
        // Since we are using standard update, we might need a separate call for 5-table schema or assume 'profiles' has a json col.
        // BUT user strict rules say 5 tables. 'adminUpdateUser' usually updates 'profiles'.
        // So we should probably handle granular permissions separately or via edge function.
        // FOR NOW, we will let the edge function handle it if we pass it, OR separate the calls.
        // Let's assume the edge function `admin-update-user` (if it exists) or we do manual upsert here.

        // Since 'granular_permissions' is a new relation, we can't update it via 'profiles' update.
        // We must use strict table upsert.
        if (data.granular_permissions !== undefined) {
            const companyId = getCurrentCompanyId(); // Helper context
            // Delete old? No, upsert is better. But we need to handle removed ones?
            // Simplest: Delete all for user and insert new.
            if (companyId) {
                // 1. Delete all for this user/company
                await supabase.from('user_permissions')
                    .delete()
                    .eq('user_id', id)
                    .eq('company_id', companyId);

                // 2. Insert new
                if (data.granular_permissions.length > 0) {
                    const toInsert = data.granular_permissions.map(p => {
                        // Strip existing permission ID (if any) to ensure we create new records with new IDs
                        // We rename it to 'permId' to avoid shadowing the outer 'id' (which is the User ID)
                        const { id: permId, ...rest } = p as any;

                        return {
                            ...rest,
                            id: self.crypto.randomUUID(),  // Generate new Permission UUID
                            user_id: id,                   // Use the outer function argument 'id' (Target User UUID)
                            company_id: companyId
                        };
                    });

                    const { error: permError } = await supabase.from('user_permissions').insert(toInsert);
                    if (permError) {
                        console.error("Failed to update granular permissions", permError);
                        throw permError;
                    }
                }
            }
        }

        if (data.role !== undefined) updates.role = data.role;

        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) throw error;
    },

    // Deprecated but kept for compatibility (wraps new method)
    updateUserPermissions: async (id: string, permissions: LegacyUserPermissions) => {
        await api.adminUpdateUser(id, { permissions });
    },

    deleteUser: async (id: string) => {
        // Use RPC (Postgres Function) to bypass Edge Function deployment issues
        const { error } = await supabase.rpc('admin_delete_user', { target_user_id: id });

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

    adminDeleteUser: async (userId: string) => {
        const { data, error } = await supabase.functions.invoke('admin-action', {
            body: { action: 'deleteUser', targetId: userId }
        });

        if (error) {
            let errorMsg = error.message || 'Falha ao excluir usuário';
            // Try to parse detailed error message from response body
            // @ts-ignore
            if (error.context && typeof error.context.json === 'function') {
                try {
                    // @ts-ignore
                    const body = await error.context.json();
                    if (body && body.error) errorMsg = body.error;
                } catch (e) {
                    console.warn('[API] Could not parse error body:', e);
                }
            }
            throw new Error(errorMsg);
        }
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



    // --- SHARED ACCESS ---
    getSharedAccess: async (companyId?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('shared_access')
            .select(`
                *,
                target:profiles!target_id(email, name, avatar_url),
                owner:profiles!owner_id(email, name, avatar_url),
                feature:feature_id(name)
            `)
            .or(`owner_id.eq.${user.id},target_id.eq.${user.id}`);

        if (error) throw error;

        return data.map((item: any) => ({
            id: item.id,
            company_id: item.company_id,
            owner_id: item.owner_id,
            target_id: item.target_id,
            feature_id: item.feature_id,
            actions: item.actions,
            created_at: item.created_at,
            expires_at: item.expires_at,
            user_email: item.target?.email,
            user_name: item.target?.name,
            owner_email: item.owner?.email,
            owner_name: item.owner?.name,
            feature_name: item.feature?.name
        })) as (SharedAccess & { user_email?: string; user_name?: string; owner_email?: string; owner_name?: string; feature_name?: string })[];
    },

    grantSharedAccess: async ({ email, targetUserId, featureId, currentUserId, duration, permissions }: { email?: string, targetUserId?: string, featureId: string, currentUserId?: string, duration: string, permissions?: any }) => {
        // 1. Resolve to User ID
        let targetId = targetUserId;

        if (!targetId && email) {
            // Try getting by RPC first (secure)
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_id_by_email', { p_email: email });

            if (!rpcError && rpcData) {
                targetId = rpcData;
            } else {
                // Fallback: If RPC missing/fails, try public profiles lookup (if policy allows)
                const { data: profileData } = await supabase.from('profiles').select('id').eq('email', email).single();
                if (profileData) targetId = profileData.id;
            }
        }

        if (!targetId) {
            throw new Error(`Usuário não encontrado.`);
        }

        if (targetId === currentUserId) {
            throw new Error("Você não pode compartilhar acesso consigo mesmo.");
        }

        // 2. Calculate Expiration
        let expiresAt: string | null = null;
        const now = new Date();
        if (duration === '24h') expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        else if (duration === '7d') expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        else if (duration === '30d') expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        // 'forever' leaves it null

        // Default permissions if not provided
        const finalPermissions = permissions || { view: true, create: false, edit: false, delete: false };

        // 3. Insert
        const companyId = getCurrentCompanyId();
        const { error } = await supabase.from('shared_access').insert({
            company_id: companyId,
            owner_id: currentUserId, // RLS will likely enforce this matches auth.uid()
            target_id: targetId,
            feature_id: featureId,
            actions: finalPermissions,
            expires_at: expiresAt
        });

        if (error) throw error;
    },

    revokeSharedAccess: async (id: string) => {
        const { error } = await supabase.from('shared_access').delete().eq('id', id);
        if (error) throw error;
    },

    // --- AUDIT LOGS ---
    getAuditLogs: async (companyId?: string) => {
        let query = supabase
            .from('audit_logs')
            .select(`
                *,
                user:profiles!user_id(name, email, avatar_url, role)
            `)
            .order('created_at', { ascending: false })
            .limit(500); // Increased limit for better client-side search

        if (companyId) query = query.eq('company_id', companyId);

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
            companyId: log.company_id,
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

    getEvents: async (companyId?: string) => {
        let query = supabase.from('calendar_events').select('*');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((e: any) => ({
            ...e,
            startDate: e.start_date,
            endDate: e.end_date,
            isTeamEvent: e.is_team_event,
            companyId: e.company_id,
            projectId: e.project_id,
            teamId: e.team_id
        })) as CalendarEvent[];
    },
    addEvent: async (evt: Partial<CalendarEvent>, recurrence?: RecurrenceConfig) => {
        const companyId = getCurrentCompanyId();
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
            company_id: companyId,
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
    getFinancialTransactions: async (companyId?: string) => {
        let query = supabase.from('financial_transactions').select('*, category:financial_categories(*), contact:contacts(*)');
        if (companyId) query = query.eq('company_id', companyId);
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
            companyId: t.company_id,
            category: t.category,
            contact: t.contact ? { ...t.contact, fantasyName: t.contact.fantasy_name } : undefined
        })) as FinancialTransaction[];
    },
    addTransaction: async (t: Partial<FinancialTransaction>, recurrence?: any) => {
        const companyId = getCurrentCompanyId();
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
            company_id: companyId
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
    toggleTransactionStatus: async (id: string, isPaid: boolean, date?: string) => {
        const updates: any = { is_paid: isPaid };
        if (isPaid && date) {
            updates.date = date;
        }
        const { error } = await supabase.from('financial_transactions').update(updates).eq('id', id);
        if (error) throw error;
        // Also toggle linked technical transactions (e.g. credit card limit release)
        await supabase.from('financial_transactions')
            .update({ is_paid: isPaid }) // simple toggle for technicals (usually they follow parent)
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

    getFinancialAccounts: async (companyId?: string) => {
        let query = supabase.from('financial_accounts').select('*');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((a: any) => ({ ...a, initialBalance: a.initial_balance, companyId: a.company_id })) as FinancialAccount[];
    },
    addFinancialAccount: async (data: Partial<FinancialAccount>) => {
        const companyId = getCurrentCompanyId();
        const { error } = await supabase.from('financial_accounts').insert([{
            name: data.name,
            type: data.type,
            initial_balance: data.initialBalance,
            company_id: companyId
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

    getFinancialCategories: async (companyId?: string) => {
        let query = supabase.from('financial_categories').select('*');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((c: any) => ({ ...c, companyId: c.company_id })) as FinancialCategory[];
    },
    addFinancialCategory: async (data: Partial<FinancialCategory>) => {
        const companyId = getCurrentCompanyId();
        const { data: retData, error } = await supabase.from('financial_categories').insert([{ ...data, company_id: companyId }]).select();
        if (error) throw error;
        const ret = retData[0];
        return { ...ret, companyId: ret.company_id } as FinancialCategory;
    },
    updateFinancialCategory: async (data: FinancialCategory) => {
        const { error } = await supabase.from('financial_categories').update(data).eq('id', data.id);
        if (error) throw error;
    },
    deleteFinancialCategory: async (id: string) => {
        const { error } = await supabase.from('financial_categories').delete().eq('id', id);
        if (error) throw error;
    },

    getCreditCards: async (companyId?: string) => {
        let query = supabase.from('credit_cards').select('*');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((c: any) => ({
            ...c,
            limitAmount: c.limit_amount,
            closingDay: c.closing_day,
            dueDay: c.due_day,
            companyId: c.company_id
        })) as CreditCard[];
    },
    addCreditCard: async (data: Partial<CreditCard>) => {
        const companyId = getCurrentCompanyId();
        const { error } = await supabase.from('credit_cards').insert([{
            name: data.name,
            limit_amount: data.limitAmount,
            closing_day: data.closingDay,
            due_day: data.dueDay,
            company_id: companyId
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
    getContacts: async (companyId?: string) => {
        let query = supabase.from('contacts').select('*');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((c: any) => ({
            ...c,
            fantasyName: c.fantasy_name,
            adminName: c.admin_name,
            companyId: c.company_id
        })) as Contact[];
    },
    addContact: async (c: Partial<Contact>) => {
        const companyId = getCurrentCompanyId();
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
            company_id: companyId
        };
        const { data, error } = await supabase.from('contacts').insert([dbContact]).select();
        if (error) throw error;
        const ret = data[0];
        return {
            ...ret,
            fantasyName: ret.fantasy_name,
            adminName: ret.admin_name,
            companyId: ret.company_id
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

    getCatalogItems: async (companyId?: string) => {
        let query = supabase.from('catalog_items').select('*');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((i: any) => ({
            ...i,
            financialCategoryId: i.financial_category_id,
            companyId: i.company_id
        })) as CatalogItem[];
    },
    addCatalogItem: async (i: Partial<CatalogItem>) => {
        const companyId = getCurrentCompanyId();
        const { error } = await supabase.from('catalog_items').insert([{
            name: i.name,
            type: i.type,
            price: i.price,
            description: i.description,
            active: i.active,
            financial_category_id: uuidOrNull(i.financialCategoryId),
            company_id: companyId
        }]);
        if (error) throw error;
    },

    switchActiveCompany: async (companyId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user logged in");

        const { error } = await supabase.from('profiles').update({ company_id: companyId }).eq('id', user.id);
        if (error) throw error;
    },

    // Update Company Settings (Finance)
    updateCompanySettings: async (settings: any) => {
        const companyId = getCurrentCompanyId();
        // Prevent saving calendar settings inside general settings JSONB to avoid duplication
        const settingsToSave = { ...settings };
        delete settingsToSave.calendar;

        const { error } = await supabase.from('companies').update({ settings: settingsToSave }).eq('id', companyId);
        if (error) throw error;
    },

    getCompanySettings: async () => {
        const companyId = getCurrentCompanyId();
        const { data, error } = await supabase.from('companies').select('settings, calendar_settings').eq('id', companyId).single();
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

    getQuotes: async (companyId?: string) => {
        let query = supabase.from('quotes').select('*, contacts(*), quote_items(*)');
        if (companyId) query = query.eq('company_id', companyId);
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
            companyId: q.company_id,
            kanbanId: q.kanban_id,
            kanbanStageId: q.kanban_stage_id,
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
        const companyId = getCurrentCompanyId();
        // 1. Insert Quote
        const { data: quote, error: qError } = await supabase.from('quotes').insert([{
            contact_id: uuidOrNull(q.contactId),
            customer_name: q.customerName,
            customer_phone: q.customerPhone,
            status: q.status || 'draft',
            date: sanitizeDate(q.date),
            valid_until: sanitizeDate(q.validUntil),
            total_value: q.totalValue,
            notes: q.notes,
            company_id: companyId,
            kanban_id: uuidOrNull(q.kanbanId),
            kanban_stage_id: uuidOrNull(q.kanbanStageId)
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
            valid_until: sanitizeDate(q.validUntil),
            notes: q.notes,
            kanban_id: uuidOrNull(q.kanbanId),
            kanban_stage_id: uuidOrNull(q.kanbanStageId)
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

    getRecurringServices: async (companyId?: string) => {
        let query = supabase.from('recurring_services').select('*, contacts(*)');
        if (companyId) query = query.eq('company_id', companyId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((r: any) => ({
            ...r,
            contactId: r.contact_id,
            setupFee: r.setup_fee,
            recurringAmount: r.recurring_amount,
            startDate: r.start_date,
            contractMonths: r.contract_months,
            companyId: r.company_id,
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
        const companyId = getCurrentCompanyId();

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
            company_id: companyId,
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
        const companyId = getCurrentCompanyId();
        const { data: existing } = await supabase
            .from('financial_categories')
            .select('id')
            .eq('name', 'Setup')
            .eq('company_id', companyId)
            .single();

        if (existing) return existing.id;

        const { data: created, error } = await supabase
            .from('financial_categories')
            .insert([{ name: 'Setup', type: 'income', color: '#4f46e5', company_id: companyId }])
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

    // --- SHARED ACCESS ---
    // (See lines 490+ for implementation)

    // --- COMPANIES & SUPER ADMIN ---
    getCompanyById: async (id: string) => {
        // Query companies + subscriptions + company_modules
        const { data, error } = await supabase
            .from('companies')
            .select(`
                *,
                subscriptions(
                    status,
                    trial_ends_at,
                    current_period_end,
                    plan_id,
                    cycle,
                    created_at,
                    saas_plans ( name )
                ),
                company_modules(module_id, status, config)
            `)
            .eq('id', id)
            .single();

        if (error) return null;

        // Sort subscriptions to get the latest one
        const subs = data.subscriptions || [];
        subs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const sub = subs[0] || {};

        // Get active modules from company_modules
        const contractedModules = data.company_modules
            ?.filter((tm: any) => tm.status === 'active')
            .reduce((acc: string[], tm: any) => {
                acc.push(tm.module_id);

                let config = tm.config;
                // Safety check for JSON string
                if (typeof config === 'string') {
                    try { config = JSON.parse(config); } catch (e) { console.error('Error parsing config', e); }
                }

                if (config?.features && Array.isArray(config.features)) {
                    config.features.forEach((feat: string) => {
                        acc.push(`${tm.module_id}:${feat}`);
                    });
                }
                return acc;
            }, []) || [];

        return {
            id: data.id,
            name: data.name,
            ownerEmail: data.email || data.owner_email,
            cnpj: data.cnpj,
            phone: data.phone,
            adminName: data.name,
            status: data.status || 'active',
            createdAt: data.created_at,
            type: sub.status === 'trialing' ? 'trial' : 'client',
            subscriptionEnd: sub.status === 'trialing' ? sub.trial_ends_at : sub.current_period_end,
            planId: sub.plan_id,
            planName: sub.saas_plans?.name || 'Plano Personalizado',
            billingCycle: sub.cycle,
            contractedModules: contractedModules,
            settings: {
                calendar: {
                    commitments: true,
                    tasks: true,
                    financial: { enabled: true, budgets: true, receivable: true, payable: true, credit_card: true }
                }
            }
        } as Company;
    },

    adminListCompanies: async () => {
        // Query companies with their latest subscription and plan
        const { data, error } = await supabase
            .from('companies')
            .select(`
                *,
                subscriptions(
                    plan_id,
                    status,
                    current_period_end,
                    saas_plans(name)
                ),
                company_modules(*)
            `);

        if (error) throw error;

        return data.map((t: any) => {
            // Get latest sub (if multiple, distinct by created_at?) 
            // Usually 1 active sub per company.
            const sub = t.subscriptions?.[0];
            const planName = sub?.saas_plans?.name;

            // Debug Log
            if (t.name.includes('teste4') || t.company_modules?.length > 0) {
                console.log(`[API] Company: ${t.name}`, t.company_modules);
            }

            const modules = t.company_modules?.reduce((acc: string[], tm: any) => {
                acc.push(tm.module_id);

                let config = tm.config;

                if (t.name.includes('teste4') || t.name.includes('Teste 4')) {
                    console.log(`[API][DEBUG] Module: ${tm.module_id}`, {
                        configType: typeof config,
                        configValue: config,
                        hasFeatures: !!config?.features,
                        featuresIsArray: Array.isArray(config?.features)
                    });
                }

                // Safety check for JSON string (though Supabase usually handles it)
                if (typeof config === 'string') {
                    try { config = JSON.parse(config); } catch (e) { console.error('Error parsing config', e); }
                }

                if (config?.features && Array.isArray(config.features)) {
                    config.features.forEach((feat: string) => {
                        acc.push(`${tm.module_id}:${feat}`);
                    });
                }
                return acc;
            }, []) || [];

            return {
                id: t.id,
                name: t.name, // Map name -> name
                ownerEmail: t.owner_email || t.email, // Fallback to email
                adminName: t.name, // Use name as adminName fallback
                cnpj: t.cnpj,
                phone: t.phone,
                planName: planName,
                status: t.status,
                type: t.type,
                financialStatus: t.financial_status,
                contractedModules: modules,
                createdAt: t.created_at,
                lastActiveAt: t.updated_at, // Approximate
                settings: {
                    ...t.settings,
                    calendar: t.calendar_settings
                }
            };
        }) as Company[];
    },
    // --- SYSTEM CATALOG ---
    getSystemCatalog: async () => {
        const { data: modules, error: errMod } = await supabase.from('app_modules').select('*').eq('status', 'active');
        const { data: features, error: errFeat } = await supabase.from('app_features').select('*').eq('status', 'active');

        if (errMod || errFeat) throw errMod || errFeat;

        // Sort Modules by standard menu order
        const moduleOrder = ['routines', 'finance', 'commercial'];
        const sortedModules = modules?.sort((a, b) => {
            const idxA = moduleOrder.indexOf(a.id);
            const idxB = moduleOrder.indexOf(b.id);
            // Keep unknowns at the end
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });

        // Sort Features by a logical order (e.g., Dashboard first)
        const sortedFeatures = features?.sort((a, b) => {
            // Dashboard always first
            if (a.id.includes('dashboard') && !b.id.includes('dashboard')) return -1;
            if (!a.id.includes('dashboard') && b.id.includes('dashboard')) return 1;
            return 0; // standard DB order for rest
        });

        return { modules: sortedModules, features: sortedFeatures };
    },

    getPublicSystemCatalog: async () => {
        const { data: modules, error: errMod } = await supabase.from('public_app_modules').select('*');
        const { data: features, error: errFeat } = await supabase.from('public_app_features').select('*');

        if (errMod || errFeat) throw errMod || errFeat;

        // Sort Modules by standard menu order
        const moduleOrder = ['routines', 'finance', 'commercial', 'reports'];
        const sortedModules = modules?.sort((a, b) => {
            const idxA = moduleOrder.indexOf(a.id);
            const idxB = moduleOrder.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });

        return { modules: sortedModules, features };
    },

    getPublicPlans: async () => {
        const { data, error } = await supabase.from('public_saas_plans').select('*');
        if (error) throw error;

        return data?.map((p: any) => ({
            ...p,
            priceMonthly: p.price_monthly,
            priceSemiannually: p.price_semiannually,
            priceYearly: p.price_yearly,
            allowedModules: p.allowed_modules,
            maxUsers: p.max_users
        })) as SaasPlan[] || [];
    },

    getCompanyModules: async (companyId: string) => {
        const { data, error } = await supabase.from('company_modules').select('*').eq('company_id', companyId);
        if (error) throw error;
        // Transform to status map
        const statusMap: Record<string, 'included' | 'extra' | 'disabled'> = {};
        data?.forEach((m: any) => {
            // If active, use config type or default 'included'. If disabled, 'disabled'.
            // Actually, strict logic says status='active' means it is available.
            // If status='disabled', user access is blocked.
            if (m.status === 'active') {
                statusMap[m.module_id] = m.config?.type || 'included';
            } else {
                statusMap[m.module_id] = 'disabled';
            }
        });
        return statusMap;
    },

    createCompany: async (data: any) => {
        console.log('[API] Calling create-tenant-admin Edge Function with:', data);

        const { data: response, error } = await supabase.functions.invoke('create-tenant-admin', {
            body: {
                name: data.name,
                ownerEmail: data.ownerEmail,
                adminName: data.adminName,
                password: data.password,
                planId: data.planId,
                billingCycle: data.billingCycle,
                subscriptionStart: data.subscriptionStart,
                subscriptionEnd: data.subscriptionEnd,
                modules: data.modules,
                cnpj: data.cnpj,
                phone: data.phone
            }
        });

        // Helper to extract JSON body from error if available
        if (error) {
            let errorMsg = error.message || 'Unknown error';
            // Try to parse detailed error message from response body if it exists
            // @ts-ignore - Supabase error might contain context/response
            if (error.context && typeof error.context.json === 'function') {
                try {
                    // @ts-ignore
                    const body = await error.context.json();
                    if (body && body.message) {
                        errorMsg = body.message; // "Campos obrigatórios faltando..."
                    }
                } catch (e) {
                    console.warn('[API] Could not parse error body:', e);
                }
            }
            console.error('[API] Edge Function failed (Detailed):', errorMsg);
            throw new Error(errorMsg);
        }

        if (!response || !response.success) {
            const errorMsg = response?.message || 'Unknown server error';
            console.error('[API] Edge Function reported failure:', errorMsg);
            throw new Error(errorMsg);
        }

        const companyId = response.data.tenantId; // Edge fn might still return tenantId

        // Post-creation update for new real fields
        if (data.type || data.financialStatus) {
            await supabase.from('companies').update({
                type: data.type || 'client',
                financial_status: data.financialStatus || 'ok'
            }).eq('id', companyId);
        }

        return companyId;
    },
    updateCompany: async (id: string, data: any) => {
        // 1. Update Company Details
        const companyData: any = {
            name: data.name,
            owner_email: data.ownerEmail,
            admin_name: data.adminName,
            cnpj: data.cnpj,
            phone: data.phone,
            status: data.status,
            type: data.type,
            financial_status: data.financialStatus,
            calendar_settings: data.settings?.calendar
        };
        // Remove undefined
        Object.keys(companyData).forEach(key => companyData[key] === undefined && delete companyData[key]);

        if (Object.keys(companyData).length > 0) {
            const { error: coError } = await supabase.from('companies').update(companyData).eq('id', id);
            if (coError) throw coError;
        }

        // 2. Update Subscription Details (Plan, Cycle, Dates)
        // Check if any sub fields are present
        if (data.planId || data.billingCycle || data.subscriptionStart || data.subscriptionEnd) {
            const subData: any = {
                plan_id: data.planId,
                cycle: data.billingCycle === 'yearly' ? 'annual' : data.billingCycle, // Map cycle if needed
                current_period_start: data.subscriptionStart,
                current_period_end: data.subscriptionEnd,
                access_until: data.subscriptionEnd
            };
            Object.keys(subData).forEach(key => subData[key] === undefined && delete subData[key]);

            // Update active subscription for this company
            // Constraint: We update ALL active subs? Or the latest? 
            // Best effort: Update where company_id = id
            const { error: subError } = await supabase
                .from('subscriptions')
                .update(subData)
                .eq('company_id', id);

            if (subError) throw subError;
        }

        if (data.modules && Array.isArray(data.modules)) {
            // 1. Deduplicate input modules (Fix for duplicate key error)
            const uniqueModules = Array.from(new Set(data.modules as string[]));

            // 2. Delete existing for this company
            await supabase.from('company_modules').delete().eq('company_id', id);

            if (uniqueModules.length > 0) {
                const companyModules = uniqueModules.map((m: string) => {
                    const parts = m.split(':');
                    const modIdRaw = parts[0];
                    const type = parts[1] === 'extra' ? 'extra' : 'included';

                    // Fix for FK Constraint: Map Plan ID (mod_*) to DB Catalog ID
                    let dbModuleId = modIdRaw;
                    if (modIdRaw === 'mod_tasks') dbModuleId = 'routines';
                    if (modIdRaw === 'mod_finance') dbModuleId = 'finance';
                    if (modIdRaw === 'mod_commercial') dbModuleId = 'commercial';
                    if (modIdRaw === 'mod_reports') dbModuleId = 'reports';

                    return {
                        company_id: id,
                        module_id: dbModuleId,
                        status: 'active',
                        config: { type }
                    };
                });

                // 3. Final safety check: Filter out any duplicates that might have slipped through mapping (e.g. 'finance' and 'finance:extra' both map to module_id 'finance')
                // We prioritize 'included' over 'extra' if both exist? Or just take the first one?
                // Let's use a Map to ensure unique module_id
                const uniqueInserts = new Map();
                companyModules.forEach((tm: any) => {
                    if (!uniqueInserts.has(tm.module_id)) {
                        uniqueInserts.set(tm.module_id, tm);
                    } else {
                        // If we have a conflict, we might want to prefer 'included'
                        // But for now, first wins is fine as dedupe on string already handled exact matches.
                    }
                });

                const finalInserts = Array.from(uniqueInserts.values());

                const { error: modError } = await supabase.from('company_modules').insert(finalInserts);
                if (modError) throw modError;
            }
        }
    },
    deleteCompany: async (id: string) => {
        const { data, error } = await supabase.functions.invoke('admin-delete-tenant', {
            body: { companyId: id }
        });
        if (error) throw new Error(error.message || 'Falha ao excluir empresa (Edge Function)');
        if (data?.error) throw new Error(data.error);
    },
    updateCalendarSettings: async (settings: any) => {
        const companyId = getCurrentCompanyId();
        if (!companyId) throw new Error("No company ID");
        const { error } = await supabase.from('companies').update({ calendar_settings: settings }).eq('id', companyId);
        if (error) throw error;
    },

    getSaasPlans: async () => {
        const { data } = await supabase.from('saas_plans').select('*');
        return data?.map((p: any) => ({
            ...p,
            priceMonthly: p.price_monthly,
            priceSemiannually: p.price_semiannually,
            priceYearly: p.price_yearly,
            allowedModules: p.allowed_modules,
            maxUsers: p.max_users
        })) as SaasPlan[] || [];
    },
    createSaasPlan: async (data: any) => {
        const dbData = {
            name: data.name,
            price_monthly: data.priceMonthly,
            price_semiannually: data.priceSemiannually,
            price_yearly: data.priceYearly,
            allowed_modules: data.allowedModules,
            max_users: data.maxUsers,
            type: data.type,
            status: data.status,
            active: data.active
        };
        await supabase.from('saas_plans').insert([dbData]);
    },
    updateSaasPlan: async (data: any) => {
        const dbData = {
            name: data.name,
            price_monthly: data.priceMonthly,
            price_semiannually: data.priceSemiannually,
            price_yearly: data.priceYearly,
            allowed_modules: data.allowedModules,
            max_users: data.maxUsers,
            type: data.type,
            status: data.status,
            active: data.active
        };
        await supabase.from('saas_plans').update(dbData).eq('id', data.id);
    },
    deleteSaasPlan: async (id: string) => {
        const { error } = await supabase.from('saas_plans').delete().eq('id', id);
        if (error) throw error;
    },
    getGlobalStats: async (): Promise<GlobalStats> => {
        const { count: companyCount } = await supabase.from('companies').select('*', { count: 'exact', head: true });
        const { count: activeCompanies } = await supabase.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active');
        const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: planCount } = await supabase.from('saas_plans').select('*', { count: 'exact', head: true }).eq('active', true);

        return {
            totalCompanies: companyCount || 0,
            activeCompanies: activeCompanies || 0,
            totalUsers: userCount || 0,
            activePlans: planCount || 0
        };
    },

    // --- DASHBOARD METRICS ---
    getDashboardMetrics: async (companyId?: string): Promise<DashboardMetrics> => {
        const { data, error } = await supabase.rpc('get_dashboard_stats', { p_company_id: companyId });
        if (error) {
            console.error('Error fetching dashboard stats via RPC:', error);
            throw error;
        }
        return data as DashboardMetrics;
    },

    // --- ASAAS BILLING (Edge Functions) ---
    subscribe: async (data: {
        company: { name: string, cnpj: string, phone: string, email: string },
        address: { postal_code: string, address: string, address_number: string, complement?: string, province: string, city: string, state: string },
        plan_id: string,
        cycle: string,
        billing_type: 'credit_card' | 'pix',
        credit_card?: { holderName: string, number: string, expiryMonth: string, expiryYear: string, ccv: string }
    }) => {
        const { data: result, error } = await supabase.functions.invoke('billing-checkout', {
            body: data
        });

        if (error) throw new Error(error.message || "Erro na assinatura");
        if (result.error) throw new Error(result.error);

        return result;
    },

    cancelSubscription: async (subscriptionId: string) => {
        const { data: result, error } = await supabase.functions.invoke('billing-cancel', {
            body: { subscription_id: subscriptionId }
        });

        if (error) throw new Error(error.message || "Erro no cancelamento");
        if (result.error) throw new Error(result.error);

        return result;
    },

    upgradeSubscription: async (data: {
        subscription_id: string,
        to_plan_id: string,
        to_cycle: string,
        billing_type: 'credit_card' | 'pix',
        credit_card?: any
    }) => {
        const { data: result, error } = await supabase.functions.invoke('billing-upgrade', {
            body: data
        });

        if (error) throw new Error(error.message || "Erro no upgrade");
        if (result.error) throw new Error(result.error);

        return result;
    },

    scheduleDowngrade: async (data: {
        subscription_id: string,
        to_plan_id: string,
        to_cycle: string
    }) => {
        const { data: result, error } = await supabase.functions.invoke('billing-schedule-downgrade', {
            body: data
        });

        if (error) throw new Error(error.message || "Erro no agendamento");
        if (result.error) throw new Error(result.error);

        return result;
    },

    syncSubscriptionStatus: async () => {
        const { data: result, error } = await supabase.functions.invoke('billing-sync-status', {});

        if (error) throw new Error(error.message || "Erro na sincronização");
        if (result.error) throw new Error(result.error);

        return result;
    }
};
