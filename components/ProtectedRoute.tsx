import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRBAC } from '../context/RBACContext';
import { Loader } from './Shared';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

interface PermissionRouteProps {
  children: React.ReactNode;
  module: string;
  action: 'view' | 'create' | 'edit' | 'delete';
}

export const PermissionRoute: React.FC<PermissionRouteProps> = ({ children, module, action }) => {
  const { user, loading } = useAuth();
  const { can } = useRBAC();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!can(module, action)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <h1 className="text-2xl font-bold text-white mb-2">Acesso Negado</h1>
        <p>Você não tem permissão para acessar este módulo.</p>
        <button
          onClick={() => window.history.back()}
          className="mt-4 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 transition-colors"
        >
          Voltar
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
