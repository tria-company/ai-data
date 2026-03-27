
import React, { useEffect, useState, useMemo } from 'react';
import { User, CheckCircle, Search, X } from 'lucide-react';

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
    const [search, setSearch] = useState('');

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

    const filtered = useMemo(() => {
        if (!search.trim()) return accounts;
        const q = search.toLowerCase();
        return accounts.filter(acc => acc.username.toLowerCase().includes(q));
    }, [accounts, search]);

    if (loading) return <div className="text-gray-400">Loading accounts...</div>;

    const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
                Conta de Login (Agente)
            </label>

            {/* Selected account badge */}
            {selectedAccount && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-900/30 border border-blue-500 text-blue-100">
                    <User className="h-5 w-5 text-blue-400" />
                    <div className="flex-1">
                        <div className="font-semibold">@{selectedAccount.username}</div>
                        <div className="text-xs text-blue-300/60">
                            {selectedAccount.last_login ? `Último login: ${new Date(selectedAccount.last_login).toISOString().split('T')[0]}` : 'Nunca logado'}
                        </div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-blue-400" />
                </div>
            )}

            {/* Search box */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                    type="text"
                    placeholder="Buscar conta..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Account list with fixed height and scroll */}
            <div className="max-h-[440px] overflow-y-auto space-y-2 pr-1">
                {filtered.map(acc => (
                    <div
                        key={acc.id}
                        onClick={() => { onSelect(acc); setSearch(''); }}
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
                {filtered.length === 0 && (
                    <div className="text-gray-500 text-sm italic py-2">
                        {search ? 'Nenhuma conta encontrada.' : 'Nenhuma conta cadastrada no Supabase.'}
                    </div>
                )}
            </div>
        </div>
    );
}
