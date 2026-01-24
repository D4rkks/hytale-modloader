import { useState } from 'react';
import '../App.css';
import './LoginModal.css';

interface LoginModalProps {
    onClose: () => void;
    onLogin: (username: string) => void;
}

export default function LoginModal({ onClose, onLogin }: LoginModalProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username && password) {
            onLogin(username);
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>Login to Hytale Account</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email / Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="login-submit-btn">Login</button>
                </form>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
        </div>
    );
}
