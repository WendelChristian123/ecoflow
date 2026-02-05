import { supabase } from './supabase';
import { Kanban, KanbanStage } from '../types';

export const kanbanService = {
    // --- Kanbans ---

    async listKanbans(module: string): Promise<Kanban[]> {
        const { data, error } = await supabase
            .from('kanbans')
            .select('*, stages:kanban_stages(*)')
            .eq('module', module)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true });

        if (error) throw error;
        // Sort stages by position
        return data.map((k: any) => ({
            ...k,
            isDefault: k.is_default,
            stages: (k.stages || [])
                .sort((a: any, b: any) => a.position - b.position)
                .map((s: any) => ({
                    ...s,
                    systemStatus: s.system_status,
                    isLocked: s.is_locked,
                    isDefault: s.is_default
                }))
        })) as Kanban[];
    },

    async createKanban(kanban: Partial<Kanban>): Promise<Kanban> {
        const { isDefault, tenantId, ...rest } = kanban;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = { ...rest };
        if (isDefault !== undefined) payload.is_default = isDefault;
        if (tenantId !== undefined) payload.tenant_id = tenantId;

        const { data, error } = await supabase
            .from('kanbans')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return { ...data, isDefault: data.is_default, tenantId: data.tenant_id } as Kanban;
    },

    async updateKanban(id: string, updates: Partial<Kanban>): Promise<Kanban> {
        const { isDefault, tenantId, ...rest } = updates;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = { ...rest };
        if (isDefault !== undefined) payload.is_default = isDefault;
        if (tenantId !== undefined) payload.tenant_id = tenantId;

        const { data, error } = await supabase
            .from('kanbans')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return { ...data, isDefault: data.is_default, tenantId: data.tenant_id } as Kanban;
    },

    async deleteKanban(id: string): Promise<void> {
        const { error } = await supabase
            .from('kanbans')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // --- Stages ---

    async createStage(stage: Partial<KanbanStage>): Promise<KanbanStage> {
        const { systemStatus, kanbanId, isLocked, isDefault, affectsDashboard, ...rest } = stage;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = { ...rest };
        if (systemStatus !== undefined) payload.system_status = systemStatus;
        if (kanbanId !== undefined) payload.kanban_id = kanbanId;
        if (isLocked !== undefined) payload.is_locked = isLocked;
        if (isDefault !== undefined) payload.is_default = isDefault;
        if (affectsDashboard !== undefined) payload.affects_dashboard = affectsDashboard;

        const { data, error } = await supabase
            .from('kanban_stages')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return {
            ...data,
            systemStatus: data.system_status,
            kanbanId: data.kanban_id,
            isLocked: data.is_locked,
            isDefault: data.is_default,
            affectsDashboard: data.affects_dashboard
        } as KanbanStage;
    },

    async updateStage(id: string, updates: Partial<KanbanStage>): Promise<KanbanStage> {
        const { systemStatus, kanbanId, isLocked, isDefault, affectsDashboard, ...rest } = updates;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = { ...rest };
        if (systemStatus !== undefined) payload.system_status = systemStatus;
        if (kanbanId !== undefined) payload.kanban_id = kanbanId;
        // NOTE: isLocked usually implies no update, but we allow updating other fields if needed, 
        // OR we can block it here. For now, we map it just in case logic changes.
        if (affectsDashboard !== undefined) payload.affects_dashboard = affectsDashboard;

        const { data, error } = await supabase
            .from('kanban_stages')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return {
            ...data,
            systemStatus: data.system_status,
            kanbanId: data.kanban_id,
            isLocked: data.is_locked,
            isDefault: data.is_default
        } as KanbanStage;
    },

    async deleteStage(id: string): Promise<void> {
        const { error } = await supabase
            .from('kanban_stages')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async reorderStages(stages: { id: string; position: number }[]): Promise<void> {
        // This is not atomic but suffices for UI
        for (const stage of stages) {
            await supabase
                .from('kanban_stages')
                .update({ position: stage.position })
                .eq('id', stage.id);
        }
    },

    // --- Assign Entity to Stage ---
    async moveEntity(
        entityTable: 'quotes' | 'tasks' | 'projects' | 'teams',
        entityId: string,
        kanbanId: string,
        stageId: string
    ): Promise<void> {
        // Fetch stage to see if it maps to a system status
        const { data: stage } = await supabase
            .from('kanban_stages')
            .select('system_status')
            .eq('id', stageId)
            .single();

        const updates: any = { kanban_id: kanbanId, kanban_stage_id: stageId };
        if (stage?.system_status) {
            updates.status = stage.system_status;
        }

        const { error } = await supabase
            .from(entityTable)
            .update(updates)
            .eq('id', entityId);

        if (error) throw error;
    }
};
