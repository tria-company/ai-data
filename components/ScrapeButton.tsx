
import React, { useState } from 'react';
import { Play, Loader2, StopCircle } from 'lucide-react';

interface ScrapeButtonProps {
    accountId: string | null;
    targetIds: number[];
    allTargets: any[];
    isAccountReady: boolean;
    projetoId?: string | null;
}

export default function ScrapeButton({ accountId, targetIds, allTargets, isAccountReady, projetoId }: ScrapeButtonProps) {
    const [scraping, setScraping] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const handleScrape = async () => {
        if (!accountId || targetIds.length === 0 || !isAccountReady) return;

        setScraping(true);
        setLogs([]);
        setProgress({ current: 0, total: targetIds.length });

        try {
            // Get usernames from filtered IDs
            const targetUsernames = allTargets
                .filter(t => targetIds.includes(t.id))
                .map(t => t.user);

            addLog(`🚀 Iniciando fila de extração para ${targetUsernames.length} perfis...`);

            // Sequential processing
            for (let i = 0; i < targetUsernames.length; i++) {
                const username = targetUsernames[i];
                addLog(`\n🔄 [${i + 1}/${targetUsernames.length}] Processando @${username}...`);

                try {
                    const res = await fetch('/api/scrape', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            accountId,
                            targetUsernames: [username],
                            projetoId
                        })
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        let errorMsg = 'Falha desconhecida';
                        try { errorMsg = JSON.parse(errorText).error || errorMsg; } catch {}
                        addLog(`Error @${username}: ${errorMsg}`);
                        continue;
                    }

                    const reader = res.body?.getReader();
                    if (!reader) {
                        addLog(`Error @${username}: No stream available`);
                        continue;
                    }

                    const decoder = new TextDecoder();
                    let buffer = '';
                    let scrapeResult: any = null;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const dataMatch = line.match(/^data: (.+)$/m);
                            if (!dataMatch) continue;

                            try {
                                const event = JSON.parse(dataMatch[1]);
                                if (event.type === 'log') {
                                    addLog(event.message);
                                } else if (event.type === 'complete') {
                                    scrapeResult = event.results?.[0];
                                } else if (event.type === 'error') {
                                    addLog(`Error: ${event.message}`);
                                }
                            } catch {}
                        }
                    }

                    if (scrapeResult?.status === 'success') {
                        addLog(`Done @${username}: ${scrapeResult.postsFound ?? '?'} posts.`);
                    } else if (scrapeResult?.status === 'failed') {
                        addLog(`Failed @${username}: ${scrapeResult.error}`);
                    }

                } catch (reqErr: any) {
                    addLog(`Erro de requisicao para @${username}: ${reqErr.message}`);
                }

                setProgress(p => ({ ...p, current: i + 1 }));
            }

            addLog('\n🏁 Fila processada!');

        } catch (error: any) {
            console.error(error);
            addLog(`❌ Erro Crítico Geral: ${error.message}`);
        } finally {
            setScraping(false);
        }
    };

    return (
        <div className="space-y-4">
            <button
                onClick={handleScrape}
                disabled={!accountId || targetIds.length === 0 || scraping || !isAccountReady}
                className={`w-full py-4 px-6 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all
          ${(!accountId || targetIds.length === 0 || !isAccountReady)
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : scraping
                            ? 'bg-yellow-600 text-yellow-100 cursor-wait'
                            : 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/20 cursor-pointer'
                    }`}
            >
                {scraping ? <Loader2 className="animate-spin h-6 w-6" /> : <Play className="h-6 w-6" />}
                {!isAccountReady ? 'Necessário Login Manual na Conta' :
                    scraping ? `Extraindo... (${progress.current}/${progress.total})` : 'INICIAR EXTRAÇÃO'}
            </button>

            {logs.length > 0 && (
                <div className="bg-black/80 rounded-lg p-4 font-mono text-xs text-green-400 h-64 overflow-y-auto border border-gray-800">
                    {logs.map((log, i) => (
                        <div key={i} className="border-b border-gray-900/50 pb-1 mb-1 last:border-0">{log}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
