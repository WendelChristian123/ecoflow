import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export function ReloadPrompt() {
    // autoUpdate automatically registers the SW
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    const close = () => {
        setNeedRefresh(false);
    };

    if (!needRefresh) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm w-full">
                <div className="flex items-start gap-4">
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-emerald-500" />
                            Nova versão disponível
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Uma atualização do aplicativo está pronta. Recarregue a página para aplicar.
                        </p>
                    </div>
                    <button
                        onClick={close}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="mt-4 flex gap-2">
                    <button
                        onClick={() => updateServiceWorker(true)}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        Atualizar Agora
                    </button>
                    <button
                        onClick={close}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        Depois
                    </button>
                </div>
            </div>
        </div>
    );
}
