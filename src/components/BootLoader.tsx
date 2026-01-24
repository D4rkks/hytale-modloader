import React, { useEffect, useState } from 'react';
import { Box } from 'lucide-react';

interface BootLoaderProps {
    onComplete: () => void;
    externalProgress?: number;
    externalStatus?: string;
}

const BootLoader: React.FC<BootLoaderProps> = ({ onComplete, externalProgress, externalStatus }) => {
    const [internalProgress, setInternalProgress] = useState(0);
    const [internalStatus, setInternalStatus] = useState('Iniciando Orbis Launcher...');

    const progress = externalProgress !== undefined ? externalProgress : internalProgress;
    const status = externalStatus !== undefined ? externalStatus : internalStatus;

    useEffect(() => {
        if (externalProgress !== undefined) return;

        const segments = [
            { p: 25, s: 'Verificando atualizações...' },
            { p: 50, s: 'Carregando perfil do usuário...' },
            { p: 75, s: 'Sincronizando instâncias...' },
            { p: 100, s: 'Inicialização concluída.' }
        ];

        let currentSegment = 0;
        const interval = setInterval(() => {
            setInternalProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }

                const next = prev + Math.random() * 8;

                if (currentSegment < segments.length && next >= segments[currentSegment].p) {
                    setInternalStatus(segments[currentSegment].s);
                    currentSegment++;
                }

                return next > 100 ? 100 : next;
            });
        }, 150);

        return () => clearInterval(interval);
    }, [externalProgress]);

    useEffect(() => {
        if (progress >= 100) {
            const timer = setTimeout(onComplete, 800);
            return () => clearTimeout(timer);
        }
    }, [progress, onComplete]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent">
            <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-visible">
                <div className="absolute w-[600px] h-[600px] bg-hytale-accent/10 blur-[140px] rounded-full animate-pulse"></div>
                <div className="absolute w-[300px] h-[300px] bg-hytale-mana/5 blur-[90px] rounded-full animate-pulse delay-500"></div>
            </div>

            <div className="relative z-10 orbis-panel p-16 w-[500px] h-[500px] rounded-[48px] flex flex-col items-center justify-between animate-in fade-in zoom-in-95 duration-1000 shadow-[0_0_80px_rgba(0,0,0,0.6),0_0_30px_rgba(245,184,65,0.15)]">
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-hytale-accent/20 blur-3xl rounded-full animate-pulse"></div>
                        <Box className="w-24 h-24 text-hytale-accent relative z-10 drop-shadow-[0_0_20px_rgba(245,184,65,0.5)] animate-[spin3d_3s_ease-in-out_infinite]" style={{ transformStyle: 'preserve-3d' }} />
                    </div>

                    <h1 className="logo-orbis text-4xl text-white uppercase tracking-wide mb-4">
                        ORBIS <span className="text-hytale-accent">LAUNCHER</span>
                    </h1>
                    <p className="text-[10px] text-white/30 uppercase tracking-[0.4em] mb-4">Orbis Launcher v0.12.4</p>
                </div>

                <div className="w-full space-y-6">
                    <div className="flex justify-between items-baseline mb-2">
                        <span className="text-[10px] text-white/40 uppercase tracking-[0.3em]">{status}</span>
                        <span className="text-3xl font-black text-hytale-accent tracking-tighter">{Math.round(progress)}%</span>
                    </div>

                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                        <div
                            className="h-full bg-gradient-to-r from-hytale-accent to-hytale-mana rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(245,184,65,0.6)]"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BootLoader;


