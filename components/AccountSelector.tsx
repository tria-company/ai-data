
import React, { useEffect, useState } from 'react';
import { User, CheckCircle, XCircle } from 'lucide-react';

interface Account {
    id: string;
    username: string;
    last_login: string | null;
    is_active: boolean;
}

interface AccountSelectorProps {
    onSelect: (account: Account) => void;
    selectedAccountId: string | null;
}

export default function AccountSelector({ onSelect, selectedAccountId }: AccountSelectorProps) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/accounts/list')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setAccounts(data);
                } else {
                    console.error("API response is not an array:", data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="text-gray-400">Loading accounts...</div>;

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
                Conta de Login (Agente)
            </label>
            <div className="grid grid-cols-1 gap-2">
                {accounts.map(acc => (
                    <div
                        key={acc.id}
                        onClick={() => onSelect(acc)}
                        className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-colors
              ${selectedAccountId === acc.id
                                ? 'bg-blue-900/30 border-blue-500 text-blue-100'
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
                    >
                        <div className="flex items-center gap-3">
                            <User className="h-5 w-5" />
                            <div>
                                <div className="font-semibold">@{acc.username}</div>
                                <div className="text-xs text-gray-500">
                                    {acc.last_login ? `Último login: ${new Date(acc.last_login).toISOString().split('T')[0]}` : 'Nunca logado'}
                                </div>
                            </div>
                        </div>
                        {selectedAccountId === acc.id && <CheckCircle className="h-5 w-5 text-blue-400" />}
                    </div>
                ))}
                {accounts.length === 0 && (
                    <div className="text-gray-500 text-sm italic">Nenhuma conta cadastrada no Supabase.</div>
                )}
            </div>
        </div>
    );
}
