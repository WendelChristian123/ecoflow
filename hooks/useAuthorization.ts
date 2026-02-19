import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js'; // Assuming direct import or context
// In a real app, use your centralized supabase client instance
// import { supabase } from '../lib/supabase'; 

import {
    AppFeature,
    TenantModule,
    UserPermission,
    SharedAccess,
    Actions
} from '../types';

// Mocking the client for this file generation if 'lib/supabase' isn't known yet
// You should replace this with: import { supabase } from '../services/supabase';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

interface AuthorizationState {
    tenantModules: Record<string, TenantModule>; // Key: module_id
    userPermissions: Record<string, UserPermission>; // Key: feature_id
    sharedAccess: Record<string, SharedAccess[]>; // Key: feature_id, Value: List of shares
    isLoading: boolean;
}

export function useAuthorization(companyId?: string, userId?: string) {
    const [state, setState] = useState<AuthorizationState>({
        tenantModules: {},
        userPermissions: {},
        sharedAccess: {},
        isLoading: true
    });

    // 1. Fetch Initial Data
    const fetchData = useCallback(async () => {
        if (!companyId || !userId) return;

        try {
            setState(prev => ({ ...prev, isLoading: true }));

            // A. Fetch Company Modules (Layer 1)
            const { data: modules } = await supabase
                .from('company_modules')
                .select('*')
                .eq('company_id', companyId);

            // B. Fetch User Base Permissions (Layer 2)
            const { data: perms } = await supabase
                .from('user_permissions')
                .select('*')
                .eq('company_id', companyId)
                .eq('user_id', userId);

            // C. Fetch Shared Access (Layer 3)
            const { data: shared } = await supabase
                .from('shared_access')
                .select('*')
                .eq('company_id', companyId)
                .eq('target_id', userId)
                // Note: We only care about what was granted TO the user
                .gt('expires_at', new Date().toISOString()); // Logic: active shares only


            // Normalize Data for lookup
            const moduleMap: Record<string, TenantModule> = {};
            modules?.forEach((m: TenantModule) => moduleMap[m.module_id] = m);

            const permMap: Record<string, UserPermission> = {};
            perms?.forEach((p: UserPermission) => permMap[p.feature_id] = p);

            const sharedMap: Record<string, SharedAccess[]> = {};
            shared?.forEach((s: SharedAccess) => {
                if (!sharedMap[s.feature_id]) sharedMap[s.feature_id] = [];
                sharedMap[s.feature_id].push(s);
            });

            setState({
                tenantModules: moduleMap,
                userPermissions: permMap,
                sharedAccess: sharedMap,
                isLoading: false
            });

        } catch (error) {
            console.error("Authorization Sync Error:", error);
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [companyId, userId]);

    // 2. Realtime Subscriptions (Optional but Requested)
    useEffect(() => {
        if (!companyId || !userId) return;

        fetchData();

        // Subscribe to changes
        const sub1 = supabase
            .channel('auth-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'company_modules', filter: `company_id=eq.${companyId}` }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_permissions', filter: `user_id=eq.${userId}` }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_access', filter: `target_id=eq.${userId}` }, fetchData)
            .subscribe();

        return () => {
            supabase.removeChannel(sub1);
        };
    }, [companyId, userId, fetchData]); // companyId dependency updated


    // 3. Central Logic: CAN()
    const can = useCallback((
        moduleId: string,
        featureId: string,
        action: keyof Actions
    ): boolean => {
        if (state.isLoading) return false;

        // --- LAYER 1: COMPANY LOCK ---
        // If the module is not 'included' or 'extra' (i.e., it is disabled or missing), BLOCK.
        const moduleConfig = state.tenantModules[moduleId];
        const isModuleActive = moduleConfig?.status === 'included' || moduleConfig?.status === 'extra';

        if (!isModuleActive) return false; // Hard Stop

        // --- LAYER 2: USER BASE PERMISSIONS ---
        const userPerm = state.userPermissions[featureId];
        if (userPerm?.actions?.[action]) return true; // Granted by Base

        // --- LAYER 3: SHARED ACCESS ---
        const shares = state.sharedAccess[featureId] || [];
        // Check if ANY valid shared access grants this action
        const hasSharedAccess = shares.some(share => share.actions?.[action]);

        if (hasSharedAccess) return true; // Granted by Share

        return false; // Default Deny
    }, [state]);

    return {
        ...state,
        can,
        refresh: fetchData
    };
}
