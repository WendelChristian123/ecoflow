import { supabase } from './supabase';
import { SaasPlan, Tenant, TenantAddon } from '../types';

export interface UserLimitStatus {
    allowed: boolean;
    max: number;
    used: number;
    planLimit: number;
    addonLimit: number;
}

export const checkUserLimit = async (tenantId: string): Promise<UserLimitStatus> => {
    // 1. Fetch Tenant with Plan and Addons
    const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select(`
      *,
      saas_plans (*),
      tenant_addons (*)
    `)
        .eq('id', tenantId)
        .single();

    if (tenantError || !tenantData) {
        console.error('Error fetching tenant details for limit check:', tenantError);
        // Fallback: block creation to be safe, or allow pending check? 
        // Generally safe to fail-closed.
        throw new Error('Could not verify tenant limits.');
    }

    // 2. Calculate Max Users
    // Handle DB snake_case vs TS camelCase mismatch
    const plan = tenantData.saas_plans as any;
    const rawAddons = (tenantData.tenant_addons || []) as any[];

    // Use config.max_users if available, otherwise legacy max_users (DB column)
    const baseLimit = plan?.config?.max_users ?? plan?.max_users ?? 1;

    // Sum up 'user_slot' addons
    const addonLimit = rawAddons
        .filter(a => a.addon_type === 'user_slot' && a.active)
        .reduce((sum, a) => sum + (a.quantity || 0), 0);

    const maxUsers = baseLimit + addonLimit;

    // 3. Get Current User Count
    // We count profiles linked to this tenant. 
    // Note: Depending on logic, suspended users might count or not. 
    // Usually all users consume a seat.
    const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .neq('role', 'super_admin');

    if (countError) {
        console.error('Error counting users:', countError);
        throw new Error('Could not verify current user count.');
    }

    const currentUsers = count || 0;

    return {
        allowed: currentUsers < maxUsers,
        max: maxUsers,
        used: currentUsers,
        planLimit: baseLimit,
        addonLimit: addonLimit
    };
};
