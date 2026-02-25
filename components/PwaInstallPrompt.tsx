import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Check if it's already installed (Standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
            return;
        }

        // iOS detection (No automatic install prompts exist for iOS)
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIOSDevice);

        if (isIOSDevice && !isStandalone) {
            // Show iOS prompt with a slight delay
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
        }

        // Android / Chrome custom install trigger
        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, [isStandalone]);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            // Show the install prompt natively
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setShowPrompt(false);
            }
        }
    };

    if (isStandalone || !showPrompt) return null;

    return (
        <div className="fixed bottom-24 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-500">
            <div className="bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-500/20 rounded-xl shadow-2xl p-4 sm:max-w-sm w-full mx-auto relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">

                {/* Glow / Decorative Background */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <button
                    onClick={() => setShowPrompt(false)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50 transition z-10"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-4 pr-6 relative z-10">
                    <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2.5 rounded-xl shrink-0 shadow-sm border border-emerald-200/50 dark:border-emerald-500/10">
                        <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 pt-0.5">
                        <h3 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">
                            Instale o App Contazze
                        </h3>

                        {isIOS ? (
                            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300 leading-snug">
                                Para baixar no iPhone, toque em <Share className="inline w-3.5 h-3.5 mx-0.5 text-blue-500 mb-1" /> <b>Compartilhar</b> e depois escolha <b>"Adicionar à Tela de Início"</b>.
                            </p>
                        ) : (
                            <>
                                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300 leading-snug mb-3 pr-2">
                                    Adicione o app à sua tela inicial para acesso offline e melhor experiência.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleInstallClick}
                                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Instalar App
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
