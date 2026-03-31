'use client';

import React, { useEffect, useState } from 'react';
import { FolderOpen, CheckCircle, Plus } from 'lucide-react';

interface Projeto {
    id: string;
    nome: string;
    criado_em: string;
}

interface ProjectSelectorProps {
    onSelect: (projeto: Projeto) => void;
    selectedProjetoId: string | null;
}

export default function ProjectSelector({ onSelect, selectedProjetoId }: ProjectSelectorProps) {
    const [projetos, setProjetos] = useState<Projeto[]>([]);
    const [loading, setLoading] = useState(true);
    const [newNome, setNewNome] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetch('/api/projetos/list')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setProjetos(data);
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

    const handleCreate = async () => {
        const trimmed = newNome.trim();
        if (!trimmed || creating) return;

        setCreating(true);
        try {
            const res = await fetch('/api/projetos/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: trimmed }),
            });
            if (res.status === 201) {
                const newProject: Projeto = await res.json();
                setProjetos(prev => [newProject, ...prev]);
                setNewNome('');
                onSelect(newProject);
            } else {
                const err = await res.json();
                console.error('Failed to create project:', err);
            }
        } catch (err) {
            console.error('Error creating project:', err);
        } finally {
            setCreating(false);
        }
    };

    if (loading) return <div className="text-gray-400">Carregando projetos...</div>;

    const selectedProjeto = projetos.find(p => p.id === selectedProjetoId);

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
                Projeto
            </label>

            {/* Selected project badge */}
            {selectedProjeto && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-900/30 border border-purple-500 text-purple-100">
                    <FolderOpen className="h-5 w-5 text-purple-400" />
                    <div className="flex-1">
                        <div className="font-semibold">{selectedProjeto.nome}</div>
                        <div className="text-xs text-purple-300/60">
                            Criado em: {new Date(selectedProjeto.criado_em).toISOString().split('T')[0]}
                        </div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-purple-400" />
                </div>
            )}

            {/* Project list */}
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                {projetos.map(projeto => (
                    <div
                        key={projeto.id}
                        onClick={() => onSelect(projeto)}
                        className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-colors
                            ${selectedProjetoId === projeto.id
                                ? 'bg-purple-900/30 border-purple-500 text-purple-100'
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
                    >
                        <div className="flex items-center gap-3">
                            <FolderOpen className="h-5 w-5" />
                            <div>
                                <div className="font-semibold">{projeto.nome}</div>
                                <div className="text-xs text-gray-500">
                                    {new Date(projeto.criado_em).toISOString().split('T')[0]}
                                </div>
                            </div>
                        </div>
                        {selectedProjetoId === projeto.id && <CheckCircle className="h-5 w-5 text-purple-400" />}
                    </div>
                ))}
                {projetos.length === 0 && (
                    <div className="text-gray-500 text-sm italic py-2">
                        Nenhum projeto cadastrado.
                    </div>
                )}
            </div>

            {/* New project section */}
            <div className="flex items-center gap-2 pt-2">
                <input
                    type="text"
                    placeholder="Nome do projeto..."
                    value={newNome}
                    onChange={e => setNewNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                    onClick={handleCreate}
                    disabled={creating || !newNome.trim()}
                    className={`bg-purple-600 hover:bg-purple-700 rounded-lg p-2 transition-colors ${creating || !newNome.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Criar projeto"
                >
                    <Plus className="h-5 w-5 text-white" />
                </button>
            </div>
            {creating && <div className="text-xs text-purple-300">Criando...</div>}
        </div>
    );
}
