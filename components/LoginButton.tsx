
import React, { useState } from 'react';
import { LogIn, Loader2, AlertTriangle } from 'lucide-react';

interface LoginButtonProps {
    accountId: string | null;
    onSuccess: () => void;
}

export default function LoginButton({ accountId, onSuccess }: LoginButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    const handleLogin = async () => {
        if (!accountId) return;
        setLoading(true);
        setError(null);
        setStatus('Iniciando browser...');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            setStatus(null);
            onSuccess();
            alert("Login bem-sucedido! Cookies salvos.");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-2">
            <button
                onClick={handleLogin}
                disabled={!accountId || loading}
                className={`w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all
          ${!accountId
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : loading
                            ? 'bg-blue-800 text-blue-200 cursor-wait'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/20'
                    }`}
            >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                {loading ? (status || 'Aguardando Login Manual...') : 'Iniciar Login Manual'}
            </button>

            {loading && (
                <div className="text-xs text-center text-yellow-300 animate-pulse">
                    ⚠️ Um navegador será aberto no servidor (local). Faça o login manualmente nele.
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm flex gap-2 items-start">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
