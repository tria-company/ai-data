
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Target, CheckSquare, Square, X, Plus, Loader2 } from 'lucide-react';

interface TargetUser {
    id: number;
    user: string;
    status: string;
    data_ultimo_scrapping: string | null;
}

interface TargetSelectorProps {
    onSelectionChange: (selectedIds: number[]) => void;
    projeto?: string | null;
}

export default function TargetSelector({ onSelectionChange, projeto }: TargetSelectorProps) {
    const [targets, setTargets] = useState<TargetUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const isFirstRender = useRef(true);
    const [newTargets, setNewTargets] = useState('');
    const [adding, setAdding] = useState(false);
    const [refreshCount, setRefreshCount] = useState(0);

    useEffect(() => {
        const params = new URLSearchParams({ limit: 'all' });
        if (projeto) params.set('projeto', projeto);
        fetch(`/api/targets/list?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setTargets(data);
                } else {
                    console.error("API response is not an array:", data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [projeto, refreshCount]);

    // Clear selection when projeto changes (skip initial render)
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        setSelected(new Set());
    }, [projeto]);

    useEffect(() => {
        onSelectionChange(Array.from(selected));
    }, [selected, onSelectionChange]);

    const toggleSelect = (id: number) => {
        const newSelected = new Set(selected);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelected(newSelected);
    };

    const toggleAll = () => {
        if (selected.size === targets.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(targets.map(t => t.id)));
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-400';
            case 'failed': return 'text-red-400';
            case 'scraping': return 'text-yellow-400';
            default: return 'text-gray-400';
        }
    };

    const selectedTargets = useMemo(() => {
        return targets.filter(t => selected.has(t.id));
    }, [targets, selected]);

    const handleAddTargets = async () => {
        const usernames = newTargets
            .split(/[,\n]+/)
            .map(u => u.trim().replace(/^@/, ''))
            .filter(u => u.length > 0);
        if (usernames.length === 0 || adding) return;

        setAdding(true);
        try {
            const res = await fetch('/api/targets/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames, projeto }),
            });
            if (res.status === 201) {
                setNewTargets('');
                setRefreshCount(c => c + 1);
            } else {
                const err = await res.json();
                console.error('Failed to add targets:', err);
            }
        } catch (err) {
            console.error('Error adding targets:', err);
        } finally {
            setAdding(false);
        }
    };

    if (loading) return <div>Loading targets...</div>;

    return (
        <div className="space-y-2">
            {/* Add new targets */}
            <div className="flex items-start gap-2">
                <textarea
                    placeholder="Adicionar alvos (separados por vírgula ou nova linha)..."
                    value={newTargets}
                    onChange={e => setNewTargets(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTargets(); } }}
                    rows={2}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                />
                <button
                    onClick={handleAddTargets}
                    disabled={adding || !newTargets.trim()}
                    className={`bg-purple-600 hover:bg-purple-700 rounded-lg p-2 transition-colors mt-0.5 ${adding || !newTargets.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {adding ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Plus className="h-4 w-4 text-white" />}
                </button>
            </div>

            <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-300">
                    Alvos ({selected.size}/{targets.length})
                </label>
                <button onClick={toggleAll} className="text-xs text-blue-400 hover:text-blue-300">
                    {selected.size === targets.length ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
            </div>

            {/* Selected targets chips */}
            {selectedTargets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-blue-500/30 bg-blue-900/10">
                    {selectedTargets.map(target => (
                        <button
                            key={target.id}
                            onClick={() => toggleSelect(target.id)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-900/40 border border-blue-500/40 text-blue-200 text-xs font-mono hover:bg-red-900/30 hover:border-red-500/40 hover:text-red-200 transition-colors group"
                        >
                            {target.user}
                            <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                        </button>
                    ))}
                </div>
            )}

            <div className="max-h-60 overflow-y-auto border border-gray-700 rounded-lg bg-gray-900/50 p-2 space-y-1">
                {targets.map(target => (
                    <div
                        key={target.id}
                        onClick={() => toggleSelect(target.id)}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-800
              ${selected.has(target.id) ? 'bg-gray-800' : ''}`}
                    >
                        <div className="flex items-center gap-2">
                            {selected.has(target.id)
                                ? <CheckSquare className="h-4 w-4 text-blue-500" />
                                : <Square className="h-4 w-4 text-gray-500" />
                            }
                            <span className="text-sm font-mono">{target.user}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className={getStatusColor(target.status)}>{target.status}</span>
                            <span className="text-gray-600">
                                {target.data_ultimo_scrapping ? new Date(target.data_ultimo_scrapping).toISOString().split('T')[0] : '-'}
                            </span>
                        </div>
                    </div>
                ))}
                {targets.length === 0 && <div className="p-4 text-center text-gray-500">Nenhum alvo encontrado.</div>}
            </div>
        </div>
    );
}
