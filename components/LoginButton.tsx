import React, { useState } from 'react';
import { LogIn, Loader2, AlertTriangle, CheckCircle, FileJson } from 'lucide-react';
import CookieImportGuide from './CookieImportGuide';

interface LoginButtonProps {
    accountId: string | null;
    onSuccess: () => void;
}

export default function LoginButton({ accountId, onSuccess }: LoginButtonProps) {
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [cookiesJson, setCookiesJson] = useState('');
    const [validationResult, setValidationResult] = useState<{ valid: boolean; reason?: string } | null>(null);

    const handleImportCookies = async () => {
        if (!accountId) return;
        if (!cookiesJson.trim()) {
            setError("Cole o JSON dos cookies primeiro.");
            return;
        }

        let parsedCookies;
        try {
            parsedCookies = JSON.parse(cookiesJson);
        } catch (e) {
            setError("JSON inválido. Certifique-se de copiar todo o conteúdo.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/accounts/import-cookies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, cookies: parsedCookies }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Falha na importação');

            onSuccess();
            setShowImport(false);
            setCookiesJson('');
            alert("Cookies importados com sucesso!");

            // Auto-validate after import
            handleValidateSession();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleValidateSession = async () => {
        if (!accountId) return;
        setValidating(true);
        setValidationResult(null);

        try {
            const res = await fetch(`/api/accounts/validate-session?accountId=${accountId}`);
            const data = await res.json();
            setValidationResult(data);
        } catch (e) {
            setValidationResult({ valid: false, reason: "Erro de rede ao validar" });
        } finally {
            setValidating(false);
        }
    };

    if (!accountId) {
        return (
            <button disabled className="w-full py-3 px-4 rounded-lg bg-gray-800 text-gray-500 font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                Selecione uma conta primeiro
            </button>
        );
    }

    if (showImport) {
        return (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white flex gap-2 items-center">
                        <FileJson size={20} className="text-yellow-500" />
                        Importar Cookies
                    </h3>
                    <button onClick={() => setShowImport(false)} className="text-xs text-slate-400 hover:text-white">Cancelar</button>
                </div>

                <CookieImportGuide />

                <textarea
                    value={cookiesJson}
                    onChange={e => setCookiesJson(e.target.value)}
                    placeholder='Cole o JSON aqui (ex: [{"domain": ".instagram.com", ...}])'
                    className="w-full h-32 bg-slate-950 text-xs text-slate-300 font-mono p-3 rounded border border-slate-700 mb-3 focus:outline-none focus:border-blue-500"
                />

                {error && (
                    <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-xs flex gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                <button
                    onClick={handleImportCookies}
                    disabled={loading}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold flex justify-center items-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    {loading ? "Processando..." : "Salvar Cookies"}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => setShowImport(true)}
                    className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                >
                    <FileJson size={18} /> Importar Cookies
                </button>

                <button
                    onClick={handleValidateSession}
                    disabled={validating}
                    className={`py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all border
                        ${validating
                            ? 'bg-slate-800 border-slate-600 text-slate-400'
                            : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800'}`}
                >
                    {validating ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle size={18} />}
                    {validating ? "Validando..." : "Validar Sessão"}
                </button>
            </div>

            {validationResult && (
                <div className={`p-3 rounded text-sm flex items-center gap-3 border ${validationResult.valid ? 'bg-green-900/30 border-green-800 text-green-200' : 'bg-red-900/30 border-red-800 text-red-200'}`}>
                    {validationResult.valid ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    <div className="flex-1">
                        <strong>{validationResult.valid ? "Sessão Válida" : "Sessão Inválida"}</strong>
                        <div className="text-xs opacity-80">{validationResult.reason || (validationResult.valid ? "Pronto para extrair." : "Importe novos cookies.")}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
