'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FolderOpen, Plus, ChevronDown } from 'lucide-react';

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
    const [open, setOpen] = useState(false);
    const [newNome, setNewNome] = useState('');
    const [creating, setCreating] = useState(false);
    const [showNewInput, setShowNewInput] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
                setShowNewInput(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
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
                setShowNewInput(false);
                setOpen(false);
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
        <div className="relative" ref={dropdownRef}>
            {/* Dropdown trigger */}
            <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors
                    ${selectedProjeto
                        ? 'bg-purple-900/30 border-purple-500 text-purple-100'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}
            >
                <div className="flex items-center gap-3">
                    <FolderOpen className={`h-5 w-5 ${selectedProjeto ? 'text-purple-400' : 'text-gray-500'}`} />
                    <span className={selectedProjeto ? 'font-semibold text-purple-100' : ''}>
                        {selectedProjeto ? selectedProjeto.nome : 'Selecionar projeto...'}
                    </span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                    <div className="max-h-[240px] overflow-y-auto">
                        {projetos.map(projeto => (
                            <button
                                key={projeto.id}
                                onClick={() => {
                                    onSelect(projeto);
                                    setOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                                    ${selectedProjetoId === projeto.id
                                        ? 'bg-purple-900/30 text-purple-100'
                                        : 'text-gray-300 hover:bg-gray-800'}`}
                            >
                                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">{projeto.nome}</span>
                            </button>
                        ))}
                        {projetos.length === 0 && (
                            <div className="px-4 py-3 text-gray-500 text-sm italic">
                                Nenhum projeto cadastrado.
                            </div>
                        )}
                    </div>

                    {/* Divider + New project */}
                    <div className="border-t border-gray-700">
                        {showNewInput ? (
                            <div className="flex items-center gap-2 p-2">
                                <input
                                    type="text"
                                    placeholder="Nome do projeto..."
                                    value={newNome}
                                    onChange={e => setNewNome(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewInput(false); }}
                                    autoFocus
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                                />
                                <button
                                    onClick={handleCreate}
                                    disabled={creating || !newNome.trim()}
                                    className={`bg-purple-600 hover:bg-purple-700 rounded p-1.5 transition-colors ${creating || !newNome.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Plus className="h-4 w-4 text-white" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowNewInput(true)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-purple-400 hover:bg-gray-800 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="text-sm">Novo Projeto</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
