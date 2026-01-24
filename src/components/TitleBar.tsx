import './TitleBar.css';
import { Minus, X, Box } from 'lucide-react';

export default function TitleBar() {
    const handleMinimize = () => {
        if ((window as any).electronAPI) {
            (window as any).electronAPI.minimizeWindow();
        }
    };

    const handleClose = () => {
        if ((window as any).electronAPI) {
            (window as any).electronAPI.closeWindow();
        }
    };

    return (
        <div className="custom-title-bar">
            <div className="title-bar-drag-region">
                <div className="title-bar-logo">
                    <Box size={14} className="title-cube" />
                    <span className="logo-text">ORBIS LAUNCHER</span>
                </div>
            </div>

            <div className="title-bar-controls">
                <button className="title-btn minimize" onClick={handleMinimize}>
                    <Minus size={14} />
                </button>
                <button className="title-btn close" onClick={handleClose}>
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
