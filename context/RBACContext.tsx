import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { UserRole, LegacyUserPermissions as UserPermissions } from '../types';

interface RBACContextType {
  role: UserRole;
  permissions: UserPermissions | undefined;
  can: (module: keyof UserPermissions, action: 'view' | 'create' | 'edit') => boolean;
  canDelete: () => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

const ADMIN_PERMISSIONS: UserPermissions = {
  routines: { view: true, create: true, edit: true },
  finance: { view: true, create: true, edit: true },
  commercial: { view: true, create: true, edit: true },
  reports: { view: true }
};

export const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  routines: { view: true, create: true, edit: false },
  finance: { view: false, create: false, edit: false },
  commercial: { view: false, create: false, edit: false },
  reports: { view: false }
};

// Map Permission Modules to System Module IDs and Feature Prefixes
export const MODULE_MAP: Record<string, { sysId: string, featPrefix: string }> = {
  'routines': { sysId: 'mod_tasks', featPrefix: 'tasks_' },
  'finance': { sysId: 'mod_finance', featPrefix: 'finance_' },
  'commercial': { sysId: 'mod_commercial', featPrefix: 'crm_' },
  'reports': { sysId: 'mod_reports', featPrefix: 'rep_' }
};

// Map Exception strings from Layout to Constants
// Map Exception strings from Layout to Constants
export const FEATURE_EXCEPTION_MAP: Record<string, string> = {
  // Finance
  'finance.dashboard': 'finance_overview',
  'finance.accounts': 'finance_banking',

  // Routines
  'routines.dashboard': 'tasks_overview',
  'routines.tasks': 'tasks_list',
  'routines.agenda': 'tasks_calendar',

  // Commercial
  'commercial.dashboard': 'crm_overview',
  'commercial.catalog': 'crm_catalogs',     // Singular in layout, plural in ID
  'commercial.quotes': 'crm_budgets',       // Quotes vs Budgets
  'commercial.recurring': 'crm_contracts',  // Recurring vs Contracts
};

export const RBACProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { currentTenant, isMultiTenant } = useTenant();

  // Role comes directly from the User object (merged from profile in AuthContext)
  // Fallback to 'user' if undefined
  const role: UserRole = (user as any)?.role || 'user';

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin' || isSuperAdmin;

  // Permissions: Admin gets full access (SCOPE CHECKED LATER), others get from DB or Default
  const permissions: UserPermissions = isAdmin
    ? ADMIN_PERMISSIONS
    : ((user as any)?.permissions || DEFAULT_USER_PERMISSIONS);

  const checkPlanAccess = (moduleKey: string): boolean => {
    // 1. Super Admin bypass
    if (isSuperAdmin) return true;
    if (!currentTenant?.contractedModules) return true; // Safety fallback (or false?)

    const modules = currentTenant.contractedModules;

    const [baseKey, subFeature] = moduleKey.split('.');
    const map = MODULE_MAP[baseKey];

    if (!map) return true; // Unknown module, let it pass (or strict block?)

    // 2. Check Base Module Presence
    // If the base module (e.g. mod_finance) is NOT present, access denied.
    if (!modules.includes(map.sysId) && !modules.includes(`${map.sysId}:extra`)) {
      return false;
    }

    // 3. Check Granular Feature Presence
    if (subFeature) {
      // Construct expected feature string
      let expectedFeatId = `${map.featPrefix}${subFeature}`; // e.g. finance_cards OR crm_contacts

      // Handle known exceptions/renames
      if (FEATURE_EXCEPTION_MAP[moduleKey]) {
        expectedFeatId = FEATURE_EXCEPTION_MAP[moduleKey];
      } else if (baseKey === 'commercial' && subFeature === 'contracts') {
        expectedFeatId = 'crm_contracts';
      }

      const fullString = `${map.sysId}:${expectedFeatId}`;

      // Logic:
      // A. If Plan contains ANY granular features for this module -> Strict Mode.
      // B. If Plan contains NO granular features for this module -> Accepted (Legacy/All Included).

      const hasGranularForModule = modules.some(m => m.startsWith(`${map.sysId}:`) && m !== `${map.sysId}:extra`);

      if (hasGranularForModule) {
        return modules.includes(fullString);
      } else {
        // Legacy/Default: No specific features listed, so all are allowed.
        return true;
      }
    }

    return true;
  };

  const can = (module: keyof UserPermissions | string, action: 'view' | 'create' | 'edit') => {
    // 1. Plan Check (The Hard/Physical Limit)
    // If the company hasn't paid for it, NO ONE can see it, not even Admin.
    // (Except Super Admin who is handled in checkPlanAccess)
    if (!checkPlanAccess(module as string)) {
      return false;
    }

    // 2. Role Check (The Soft Limit within the Tenant)
    if (isAdmin) return true;

    // ... Existing Role Logic ...
    // 1. New Granular Permission Check
    const granular = (user as any)?.granular_permissions as any[];

    if (granular && granular.length > 0) {
      let featurePrefix = module as string;
      const hasModuleAccess = granular.some(p => {
        const isMatch = p.feature_id === featurePrefix || p.feature_id.startsWith(featurePrefix + '.');
        if (isMatch) {
          if (action === 'view') return p.actions.view;
          if (action === 'create') return p.actions.create;
          if (action === 'edit') return p.actions.edit;
        }
        return false;
      });
      return hasModuleAccess;
    }

    // 2. Fallback to Legacy Column
    const modulePerms = (permissions as any)[module.split('.')[0]]; // Handle 'finance.cards' -> 'finance'
    if (!modulePerms) return false;

    if (module === 'reports') return action === 'view' ? modulePerms.view : false;

    return (modulePerms as any)[action];
  };

  const canDelete = () => {
    return isAdmin;
  };

  return (
    <RBACContext.Provider value={{ role, permissions, can, canDelete, isAdmin, isSuperAdmin }}>
      {children}
    </RBACContext.Provider>
  );
};

export const useRBAC = () => {
  const context = useContext(RBACContext);
  if (context === undefined) {
    throw new Error('useRBAC must be used within a RBACProvider');
  }
  return context;
};
