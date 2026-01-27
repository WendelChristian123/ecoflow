import React from 'react';
import { cn } from './Shared';

export const PublicLayout: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => {
    return (
        <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white font-sans selection:bg-primary/30 relative">
            {/* Background Decor */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute top-[40%] -left-[10%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[100px]" />
                <div className="absolute bottom-0 right-0 w-[40%] h-[40%] rounded-full bg-primary/3 blur-[120px]" />
            </div>

            <main className={cn("relative z-10 w-full mb-10", className)}>
                {children}
            </main>

            <footer className="border-t border-white/10 py-8 relative z-10 bg-slate-950/50 backdrop-blur-xl">
                <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} Contazze. Todos os direitos reservados.</p>
                </div>
            </footer>
        </div>
    );
};
