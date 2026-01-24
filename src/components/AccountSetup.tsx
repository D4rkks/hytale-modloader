import { useState, useEffect } from 'react';
import './AccountSetup.css';
import { User, Gamepad2, X } from 'lucide-react';

interface Account {
    id: string;
    username: string;
    uuid: string;
    type: 'hytale' | 'offline';
}

interface AccountSetupProps {
    onComplete: (account: Account) => void;
}

export default function AccountSetup({ onComplete }: AccountSetupProps) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [accountType, setAccountType] = useState<'hytale' | 'offline' | null>(null);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        const accs = await window.electronAPI.getAccounts();
        setAccounts(accs);
        if (accs.length > 0) {
            setShowAddAccount(false);
        }
    };

    const handleHytaleLogin = async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.startHytaleOAuth();

            if (result.success && result.account) {
                await loadAccounts();
                onComplete(result.account);
            } else if (result.error) {
                alert('Login failed: ' + result.error);
            }
        } catch (err: any) {
            alert('Failed to start OAuth: ' + err.message);
        }
        setLoading(false);
    };

    const handleAddOffline = async () => {
        if (!username.trim()) return;
        setLoading(true);
        try {
            const result = await window.electronAPI.addOfflineAccount(username);
            if (result.success) {
                await loadAccounts();
                setAccountType(null);
                setUsername('');
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const handleSelectAccount = async (account: Account) => {
        await window.electronAPI.setActiveAccount(account.id);
        await window.electronAPI.markAsLaunched();
        onComplete(account);
    };

    const handleRemoveAccount = async (accountId: string) => {
        await window.electronAPI.removeAccount(accountId);
        await loadAccounts();
    };

    return (
        <div className="account-setup-overlay">
            <div className="setup-container">
                <div className="setup-header">
                    <h2>Select Account</h2>
                    <p>Or add a new one to get started</p>
                </div>

                <div className="accounts-column">
                    {accounts.length === 0 && !showAddAccount && (
                        <div className="empty-state">
                            <User size={48} className="empty-icon" />
                            <p>No accounts added</p>
                            <button className="primary-btn" onClick={() => setShowAddAccount(true)}>
                                Add Account
                            </button>
                        </div>
                    )}

                    {accounts.map(account => (
                        <div key={account.id} className="account-card" onClick={() => handleSelectAccount(account)}>
                            <div className="account-avatar">
                                {account.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="account-details">
                                <span className="acc-name">{account.username}</span>
                                <span className="acc-type">{account.type === 'hytale' ? 'Official' : 'Offline'}</span>
                            </div>
                            <button
                                className="remove-btn"
                                onClick={(e) => { e.stopPropagation(); handleRemoveAccount(account.id); }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}

                    {accounts.length > 0 && !showAddAccount && (
                        <button className="text-btn add-more" onClick={() => setShowAddAccount(true)}>
                            + Add another account
                        </button>
                    )}
                </div>

                {showAddAccount && (
                    <div className="add-account-panel">
                        <div className="panel-header">
                            <h3>Add Account</h3>
                            <button className="close-btn" onClick={() => {
                                setShowAddAccount(false);
                                setAccountType(null);
                            }}>
                                <X size={18} />
                            </button>
                        </div>

                        {!accountType && (
                            <div className="type-params">
                                <button className="type-option hytale" onClick={() => setAccountType('hytale')}>
                                    <Gamepad2 size={24} />
                                    <div className="type-info">
                                        <span className="type-title">Hytale Account</span>
                                        <span className="type-desc">Log in via official website</span>
                                    </div>
                                </button>
                                <button className="type-option offline" onClick={() => setAccountType('offline')}>
                                    <User size={24} />
                                    <div className="type-info">
                                        <span className="type-title">Offline Mode</span>
                                        <span className="type-desc">Play without authentication</span>
                                    </div>
                                </button>
                            </div>
                        )}

                        {accountType === 'hytale' && (
                            <div className="login-step">
                                <p className="step-desc">
                                    We'll open your browser to verify your account.
                                </p>
                                <button
                                    className="primary-btn full"
                                    onClick={handleHytaleLogin}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <div className="btn-loading">
                                            <div className="spinner-sm"></div>
                                            <span>Waiting for login...</span>
                                        </div>
                                    ) : 'Open Login Page'}
                                </button>
                                {loading && (
                                    <p className="status-sm">Check your browser window...</p>
                                )}
                            </div>
                        )}

                        {accountType === 'offline' && (
                            <div className="login-step">
                                <input
                                    className="modern-input"
                                    type="text"
                                    placeholder="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoFocus
                                />
                                <button className="primary-btn full" onClick={handleAddOffline} disabled={!username.trim()}>
                                    Add Account
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
