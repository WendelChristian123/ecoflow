import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, Shield, Lock } from 'lucide-react';
import { AppModule, AppFeature, UserPermission, Actions } from '../../types';
import { cn } from '../Shared';

interface PermissionAccordionProps {
    modules: AppModule[];
    features: AppFeature[];
    // Current permissions state
    permissions: Record<string, UserPermission>; // Key: feature_id
    // Callback when a toggle changes
    onChange: (featureId: string, action: keyof Actions, value: boolean) => void;
    // Tenant modules status (to show if valid)
    tenantModuleStatus?: Record<string, 'included' | 'extra' | 'disabled'>;
}

export const PermissionAccordion: React.FC<PermissionAccordionProps> = ({
    modules,
    features,
    permissions,
    onChange,
    tenantModuleStatus
}) => {
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

    const toggleModule = (modId: string) => {
        setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
    };

    // Helper: Get features for a module
    const getModuleFeatures = (modId: string) => features.filter(f => f.module_id === modId);

    const translations: Record<string, string> = {
        view: 'Visualizar',
        create: 'Criar',
        edit: 'Editar',
        delete: 'Excluir'
    };

    return (
        <div className="space-y-4">
            {modules.map(module => {
                const isExpanded = expandedModules[module.id];
                const moduleFeatures = getModuleFeatures(module.id);
                // Check if module is disabled at tenant level (Layer 1 Check)
                // If status is undefined, assume included (or wait for data?). Strict: disable if unknown?
                // For now, if no status map passed, show all (dev mode). If map passed, respect it.
                // User Request: strict adherence.
                const modConfig = tenantModuleStatus?.[module.id];
                const isTenantDisabled = modConfig === 'disabled';

                // Don't render if system-disabled/missing from map (if map implies existence)
                // But for now, just 'disabled' styling or omission?
                // Request says: "status = 'disabled' (não exibir)".
                if (isTenantDisabled) return null; // Hiding completely as per request

                return (
                    <div key={module.id} className="border border-slate-700 bg-slate-900 rounded-xl overflow-hidden transition-all">
                        {/* HEADER */}
                        <button
                            type="button" // Prevent form submit
                            onClick={() => toggleModule(module.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Shield size={18} className="text-primary" />
                                <div className="text-left">
                                    <h4 className="font-bold text-white text-sm">{module.name}</h4>
                                    {module.description && <p className="text-xs text-slate-400">{module.description}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                            </div>
                        </button>

                        {/* BODY (Features) */}
                        {isExpanded && (
                            <div className="p-4 border-t border-slate-800 bg-slate-950/30 space-y-6">
                                {moduleFeatures.map(feature => {
                                    const userPerm = permissions[feature.id] || { actions: { view: false, create: false, edit: false, delete: false } };

                                    return (
                                        <div key={feature.id} className="flex flex-col gap-3 py-3 border-b border-slate-800/50 last:border-0">
                                            <div className="w-full">
                                                <span className="text-sm text-slate-300 font-medium block">{feature.name}</span>
                                                <span className="text-xs text-slate-500 block">{feature.description}</span>
                                            </div>

                                            {/* ACTIONS GRID - Responsive and translated */}
                                            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                                                {(['view', 'create', 'edit', 'delete'] as const).map(action => {
                                                    const isActive = userPerm.actions?.[action];
                                                    // UX Logic: Can't create/edit/delete if View is false
                                                    const isDisabled = action !== 'view' && !userPerm.actions?.view;

                                                    return (
                                                        <button
                                                            key={action}
                                                            type="button" // Prevent form submit
                                                            onClick={() => onChange(feature.id, action, !isActive)}
                                                            disabled={isDisabled}
                                                            title={translations[action]}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center min-w-[80px] h-12 px-2 rounded-lg border transition-all",
                                                                isActive
                                                                    ? "bg-primary/10 border-primary text-primary"
                                                                    : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600",
                                                                isDisabled && "opacity-30 cursor-not-allowed grayscale"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                                {isActive ? <Check size={14} /> : null}
                                                                <span className="text-[10px] uppercase font-bold">{translations[action]}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
