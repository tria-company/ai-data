
'use client';

import React, { useState, useEffect } from 'react';
import ProjectSelector from '@/components/ProjectSelector';
import AccountSelector from '@/components/AccountSelector';
import TargetSelector from '@/components/TargetSelector';
import LoginButton from '@/components/LoginButton';
import ScrapeButton from '@/components/ScrapeButton';
import { Instagram } from 'lucide-react';

export default function Home() {
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [allTargets, setAllTargets] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); // Key to force component reload

  // Fetch targets again at top level or lift state? 
  // TargetSelector keeps its state. We can just refetch here or pass logic.
  // For simplicity, ScrapeButton accepts ALL targets and filters by ID.
  // So we need to fetch all targets here too or pass from TargetSelector via callback?
  // Let's modify usage: TargetSelector is responsible for fetching, but we need the data in ScrapeButton.
  // I will refetch targets in Home for simplicity or create context. 
  // Refetching is easiest for now.

  useEffect(() => {
    fetch('/api/targets/list?limit=all')
      .then(r => r.json())
      .then(setAllTargets)
      .catch(console.error);
  }, []);

  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4 border-b border-gray-800 pb-6">
          <div className="bg-gradient-to-tr from-purple-600 to-pink-600 p-3 rounded-xl shadow-lg shadow-purple-900/20">
            <Instagram className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
              Instagram Scraper Pro
            </h1>
            <p className="text-gray-500">Web Dashboard &bull; Vercel &bull; Supabase</p>
          </div>
        </div>

        {/* Project Selector -- full width, before the grid */}
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-gray-200">Projeto</h2>
          <ProjectSelector
            onSelect={(projeto) => setSelectedProjetoId(projeto.id)}
            selectedProjetoId={selectedProjetoId}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Left Column: Configuration */}
          <div className="space-y-6">
            <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-gray-200">1. Selecionar Agente</h2>
              <AccountSelector
                key={refreshKey}
                onSelect={(acc) => {
                  setSelectedAccountId(acc.id);
                  setSelectedAccount(acc);
                }}
                selectedAccountId={selectedAccountId}
              />
              <div className="mt-6">
                <div className="mt-6">
                  <LoginButton
                    accountId={selectedAccountId}
                    onSuccess={async () => {
                      // Refresh selected account data to verify login status
                      if (selectedAccountId) {
                        try {
                          const res = await fetch('/api/accounts/list'); // Re-fetching all is easiest or create specific endpoint
                          const data = await res.json();
                          // API returns array directly now
                          const accounts = Array.isArray(data) ? data : (data.accounts || []);
                          const updated = accounts.find((a: any) => a.id === selectedAccountId);
                          if (updated) {
                            setSelectedAccount(updated);
                            // Increment key to force AccountSelector to re-fetch and show updated status
                            setRefreshKey(k => k + 1);
                            // NO location.reload() to preserve state
                          }
                        } catch (e) {
                          console.error('Failed to refresh account', e);
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-gray-200">2. Selecionar Alvos</h2>
              <TargetSelector
                onSelectionChange={setSelectedTargetIds}
              />
            </div>
          </div>

          {/* Right Column: Execution */}
          <div className="space-y-6">
            <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 shadow-sm h-full">
              <h2 className="text-xl font-semibold mb-4 text-gray-200">3. Execução</h2>
              <div className="p-4 bg-gray-950 rounded-lg border border-gray-800 mb-6 text-sm text-gray-400">
                <p>Conta selecionada: <span className="text-white font-mono">{selectedAccountId ? '✅ Definida' : '❌ Nenhuma'}</span></p>
                <p>Alvos selecionados: <span className="text-white font-mono">{selectedTargetIds.length}</span></p>
              </div>

              <ScrapeButton
                accountId={selectedAccountId}
                targetIds={selectedTargetIds}
                allTargets={allTargets}
                isAccountReady={!!selectedAccount?.last_login}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
