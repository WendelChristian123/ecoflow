
import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { UserRole, UserPermissions } from '../types';

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

export const RBACProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Role comes directly from the User object (merged from profile in AuthContext)
  // Fallback to 'user' if undefined
  const role: UserRole = (user as any)?.role || 'user';

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin' || isSuperAdmin;

  // Permissions: Admin gets full access, others get from DB or Default
  const permissions: UserPermissions = isAdmin
    ? ADMIN_PERMISSIONS
    : ((user as any)?.permissions || DEFAULT_USER_PERMISSIONS);

  const can = (module: keyof UserPermissions, action: 'view' | 'create' | 'edit') => {
    if (isAdmin) return true;

    const modulePerms = permissions[module];
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
