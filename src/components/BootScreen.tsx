import { useState, useEffect } from 'react';
import './BootScreen.css';
import { Terminal } from 'lucide-react';

interface BootScreenProps {
    onComplete: () => void;
}

export default function BootScreen({ onComplete }: BootScreenProps) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(p => {
                if (p >= 100) {
                    clearInterval(interval);
                    setTimeout(onComplete, 500);
                    return 100;
                }
                return p + (Math.random() * 5);
            });
        }, 50);

        return () => clearInterval(interval);
    }, [onComplete]);

    return (
        <div className="boot-container">
            <div className="boot-center">
                <div className="boot-icon">
                    <Terminal size={48} />
                </div>
                <div className="boot-progress-wrapper">
                    <div className="boot-bar" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="boot-status">L O A D I N G</div>
            </div>
        </div>
    );
}
