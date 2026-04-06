'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Loader2, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Account {
  id: string;
  username: string;
  last_login: string | null;
  is_active: boolean;
  cookie_valid: boolean;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type CaptureStatus = 'idle' | 'loading' | 'success' | 'error';

// ---------------------------------------------------------------------------
// ConnectionStatusBadge
// ---------------------------------------------------------------------------

function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        <span className="text-sm text-green-200">Conectado</span>
      </div>
    );
  }
  if (status === 'connecting') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block animate-pulse" />
        <span className="text-sm text-yellow-200">Conectando...</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
      <span className="text-sm text-gray-400">Desconectado</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LoginSessionPage() {
  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 800 });

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastMouseMoveRef = useRef<number>(0);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Mount: init Socket.io server + load accounts + connect socket
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function init() {
      // Bootstrap Socket.io server (creates it if not already running)
      try {
        await fetch('/api/socket');
      } catch {
        // Ignore — socket server may already be running
      }

      // Load accounts
      try {
        const res = await fetch('/api/accounts/list');
        if (res.ok) {
          const data = await res.json();
          if (mounted) setAccounts(data);
        }
      } catch {
        // Accounts list unavailable — leave empty
      }

      // Connect Socket.io client
      const socket = io({ path: '/api/socket/io' });
      socketRef.current = socket;

      socket.on('screencast-frame', (base64Data: string) => {
        if (imgRef.current) {
          imgRef.current.src = `data:image/jpeg;base64,${base64Data}`;
        }
      });

      socket.on(
        'session-status',
        (payload: {
          status: 'connected' | 'disconnected';
          viewportWidth?: number;
          viewportHeight?: number;
        }) => {
          if (!mounted) return;
          if (payload.status === 'connected') {
            setConnectionStatus('connected');
            if (payload.viewportWidth && payload.viewportHeight) {
              setViewportSize({
                width: payload.viewportWidth,
                height: payload.viewportHeight,
              });
            }
          } else {
            setConnectionStatus('disconnected');
          }
        }
      );

      socket.on('session-error', ({ message }: { message: string }) => {
        if (!mounted) return;
        setConnectionStatus('disconnected');
        setErrorMessage(
          message.toLowerCase().includes('browserless') ||
            message.toLowerCase().includes('connect')
            ? 'Nao foi possivel conectar ao navegador. Verifique se o container Browserless esta rodando.'
            : message
        );
        setCaptureStatus('error');
      });

      socket.on('cookies-captured', async ({ cookies }: { cookies: unknown[] }) => {
        if (!mounted || !selectedAccountIdRef.current) return;
        try {
          const res = await fetch('/api/accounts/import-cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: selectedAccountIdRef.current,
              cookies,
            }),
          });
          if (res.ok) {
            setCaptureStatus('success');
            // Revert to idle after 3s on the button, keep success banner for 5s
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            successTimerRef.current = setTimeout(() => {
              if (mounted) setCaptureStatus('idle');
            }, 5000);
          } else {
            const body = await res.json().catch(() => ({}));
            setCaptureStatus('error');
            setErrorMessage(
              (body as { error?: string }).error || 'Erro ao salvar cookies no banco. Tente novamente.'
            );
          }
        } catch {
          setCaptureStatus('error');
          setErrorMessage('Erro ao salvar cookies no banco. Tente novamente.');
        }
      });

      socket.on('cookies-error', ({ message }: { message: string }) => {
        if (!mounted) return;
        setCaptureStatus('error');
        setErrorMessage(
          message.toLowerCase().includes('sessionid')
            ? 'Cookie sessionid nao encontrado. Complete o login no Instagram antes de capturar.'
            : message
        );
      });
    }

    init();

    return () => {
      mounted = false;
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (socketRef.current) {
        socketRef.current.emit('stop-session');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // We need a ref to selectedAccountId for use inside the async cookies-captured handler
  const selectedAccountIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId;
  }, [selectedAccountId]);

  // ---------------------------------------------------------------------------
  // Account selection
  // ---------------------------------------------------------------------------

  const handleAccountChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value || null;
      setSelectedAccountId(id);
      setCaptureStatus('idle');
      setErrorMessage('');

      if (!socketRef.current) return;

      // Stop previous session (fire-and-forget, OK if no session active)
      socketRef.current.emit('stop-session');

      if (id) {
        setConnectionStatus('connecting');
        socketRef.current.emit('start-session');
      } else {
        setConnectionStatus('disconnected');
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Browser interaction handlers
  // ---------------------------------------------------------------------------

  const getScaledCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } | null => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const scaleX = viewportSize.width / rect.width;
      const scaleY = viewportSize.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [viewportSize]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (connectionStatus !== 'connected' || !socketRef.current) return;
      const coords = getScaledCoords(e);
      if (coords) socketRef.current.emit('mouse-click', coords);
    },
    [connectionStatus, getScaledCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (connectionStatus !== 'connected' || !socketRef.current) return;
      const now = Date.now();
      if (now - lastMouseMoveRef.current < 30) return; // throttle to ~30ms
      lastMouseMoveRef.current = now;
      const coords = getScaledCoords(e);
      if (coords) socketRef.current.emit('mouse-move', coords);
    },
    [connectionStatus, getScaledCoords]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (connectionStatus !== 'connected' || !socketRef.current) return;
      e.preventDefault();
      socketRef.current.emit('scroll', { deltaX: e.deltaX, deltaY: e.deltaY });
    },
    [connectionStatus]
  );

  const SPECIAL_KEYS = new Set([
    'Enter', 'Tab', 'Backspace', 'Escape',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Delete', 'Home', 'End', 'PageUp', 'PageDown',
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (connectionStatus !== 'connected' || !socketRef.current) return;
      e.preventDefault();
      if (SPECIAL_KEYS.has(e.key)) {
        socketRef.current.emit('key-press', { key: e.key });
      } else if (e.key.length === 1) {
        // Printable single character
        socketRef.current.emit('key-type', { text: e.key });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectionStatus]
  );

  // ---------------------------------------------------------------------------
  // Cookie capture
  // ---------------------------------------------------------------------------

  const handleCaptureCookies = useCallback(() => {
    if (!socketRef.current || connectionStatus !== 'connected') return;
    setCaptureStatus('loading');
    setErrorMessage('');
    socketRef.current.emit('capture-cookies');
  }, [connectionStatus]);

  // ---------------------------------------------------------------------------
  // Derived state for capture button
  // ---------------------------------------------------------------------------

  const isCapturing = captureStatus === 'loading';
  const canCapture = connectionStatus === 'connected' && !isCapturing;

  function captureButtonLabel(): string {
    if (!selectedAccountId) return 'Selecione uma conta primeiro';
    if (connectionStatus !== 'connected') return 'Inicie a sessao primeiro';
    if (isCapturing) return 'Capturando...';
    if (captureStatus === 'success') return 'Cookies Capturados!';
    return 'Capturar Cookies';
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0f1115] text-white">
      <div className="max-w-4xl mx-auto p-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-semibold">Login de Sessao</h1>
          </div>
          <p className="text-gray-400 ml-8">
            Faca login no Instagram e capture os cookies da sessao
          </p>
        </div>

        {/* Account Selector Card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mb-6">
          <label
            htmlFor="account-select"
            className="block text-sm font-semibold text-gray-300 mb-2"
          >
            Selecionar Conta
          </label>

          {accounts.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-gray-300 font-medium mb-1">Nenhuma conta cadastrada</p>
              <p className="text-gray-500 text-sm">
                Adicione uma conta no painel principal antes de iniciar o login.
              </p>
            </div>
          ) : (
            <select
              id="account-select"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              value={selectedAccountId ?? ''}
              onChange={handleAccountChange}
            >
              <option value="">-- Selecione uma conta --</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.username}
                  {account.cookie_valid ? ' (cookies validos)' : ' (sem cookies)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Browser Viewer Card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Navegador</h2>
            <ConnectionStatusBadge status={connectionStatus} />
          </div>

          {/* Viewer container — receives mouse/keyboard events */}
          <div
            ref={containerRef}
            tabIndex={0}
            className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden min-h-[400px] md:min-h-[600px] max-w-[1024px] mx-auto relative cursor-pointer outline-none focus:ring-2 focus:ring-blue-600"
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
          >
            {connectionStatus === 'disconnected' && !selectedAccountId && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <p className="text-gray-300 font-medium mb-1">Sessao nao iniciada</p>
                <p className="text-gray-500 text-sm">
                  Selecione uma conta acima para iniciar o navegador.
                </p>
              </div>
            )}

            {connectionStatus === 'connecting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                <p className="text-gray-300 text-sm">Iniciando sessao de navegador...</p>
              </div>
            )}

            {/* Screencast image — always rendered; visible when frames arrive */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              alt="Browser screencast"
              className="w-full h-auto block"
              style={{ display: connectionStatus === 'connected' ? 'block' : 'none' }}
            />
          </div>

          {connectionStatus === 'connected' && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Clique no navegador e use o teclado para interagir com a pagina
            </p>
          )}
        </div>

        {/* Capture Button */}
        <div className="mb-4">
          {!selectedAccountId || connectionStatus !== 'connected' ? (
            <button
              disabled
              className="w-full py-3 px-4 rounded-lg font-semibold text-lg bg-gray-800 text-gray-500 cursor-not-allowed"
            >
              {captureButtonLabel()}
            </button>
          ) : captureStatus === 'success' ? (
            <button
              disabled
              className="w-full py-3 px-4 rounded-lg font-semibold text-lg bg-blue-600 text-white flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Cookies Capturados!
            </button>
          ) : (
            <button
              onClick={handleCaptureCookies}
              disabled={!canCapture}
              className="w-full py-3 px-4 rounded-lg font-semibold text-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCapturing && <Loader2 className="w-5 h-5 animate-spin" />}
              {captureButtonLabel()}
            </button>
          )}
        </div>

        {/* Status Feedback Area */}
        {captureStatus === 'success' && (
          <div className="bg-green-900/30 border border-green-800 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-200 text-sm">
              Cookies capturados com sucesso! Conta marcada como ativa.
            </p>
          </div>
        )}

        {captureStatus === 'error' && errorMessage && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{errorMessage}</p>
          </div>
        )}

      </div>
    </div>
  );
}
