import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { Button, cn } from './Shared';

export const LandingNavbar: React.FC = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    // Handle scroll effect
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Smooth scroll handler
    const scrollToSection = (id: string) => {
        setMobileMenuOpen(false);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        } else {
            // If on another page, nav to home first (simplified for single page landing)
            if (window.location.pathname !== '/') {
                navigate('/');
                setTimeout(() => {
                    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }
    };

    const navLinks = [
        { label: 'Início', id: 'hero' },
        { label: 'Quem Somos', id: 'positioning' },
        { label: 'Recursos', id: 'features' },
        { label: 'Planos', id: 'plans' },
    ];

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
                scrolled
                    ? "bg-slate-950/80 backdrop-blur-xl border-white/10 py-3 shadow-lg"
                    : "bg-transparent border-transparent py-5"
            )}
        >
            <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between">

                {/* Logo */}
                <Link to="/" className="flex items-center gap-2 group" onClick={() => scrollToSection('hero')}>
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                        <LayoutDashboard className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-white tracking-tight group-hover:text-primary transition-colors">Contazze</span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <button
                            key={link.id}
                            onClick={() => scrollToSection(link.id)}
                            className="text-sm font-medium text-slate-400 hover:text-white transition-colors relative group"
                        >
                            {link.label}
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full opacity-0 group-hover:opacity-100"></span>
                        </button>
                    ))}
                </div>

                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-4">
                    <Link to="/login" className="text-sm font-bold text-slate-300 hover:text-white transition-colors">
                        Login
                    </Link>
                    <Button
                        onClick={() => scrollToSection('plans')}
                        className="bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all transform hover:-translate-y-0.5"
                    >
                        Comece já
                    </Button>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="md:hidden text-slate-300 hover:text-white"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu */}
            <div className={cn(
                "md:hidden absolute top-full left-0 w-full bg-slate-900/95 backdrop-blur-xl border-b border-white/10 transition-all duration-300 overflow-hidden",
                mobileMenuOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="flex flex-col p-4 space-y-4">
                    {navLinks.map((link) => (
                        <button
                            key={link.id}
                            onClick={() => scrollToSection(link.id)}
                            className="text-left text-slate-300 hover:text-white font-medium py-2 border-b border-white/5"
                        >
                            {link.label}
                        </button>
                    ))}
                    <div className="pt-4 flex flex-col gap-3">
                        <Link to="/login" className="w-full text-center py-2 text-slate-300 font-bold border border-slate-700 rounded-lg">
                            Login
                        </Link>
                        <Button
                            onClick={() => scrollToSection('plans')}
                            className="w-full bg-primary text-white font-bold"
                        >
                            Comece já
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    );
};
