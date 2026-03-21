import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, WifiOff, X } from 'lucide-react';
import { getChatHistory, type ChatMessageRow } from '../api/endpoints';
import { getChatWsUrl } from '../api/client';
import { chatUserId, type ChatRole } from '../utils/chatIds';

export interface ChatWindowProps {
  patientId: number;
  selfRole: ChatRole;
  peerRole: ChatRole;
  title?: string;
  onClose?: () => void;
}

type LiveMsg = ChatMessageRow;

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1000;
/** React StrictMode double-mounts in dev; delay avoids closing the socket before `open`. */
const WS_CONNECT_DELAY_MS = 120;

function normalizeHistory(rows: ChatMessageRow[]): LiveMsg[] {
  return rows.map((r) => ({ ...r }));
}

export default function ChatWindow({
  patientId,
  selfRole,
  peerRole,
  title,
  onClose,
}: ChatWindowProps) {
  const selfId = chatUserId(patientId, selfRole);
  const peerId = chatUserId(patientId, peerRole);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const unmountingRef = useRef(false);

  const [messages, setMessages] = useState<LiveMsg[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'offline'>('connecting');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reconnectExhausted, setReconnectExhausted] = useState(false);

  const appendUnique = useCallback((row: LiveMsg) => {
    setMessages((prev) => {
      if (row.id && prev.some((m) => m.id === row.id)) return prev;
      const key = `${row.sender_id}-${row.message}-${row.timestamp}`;
      if (!row.id && prev.some((m) => `${m.sender_id}-${m.message}-${m.timestamp}` === key)) return prev;
      return [...prev, row];
    });
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryError(null);
    try {
      const { messages: rows } = await getChatHistory(selfId, peerId);
      setMessages(normalizeHistory(rows));
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load history');
    }
  }, [selfId, peerId]);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const openSocketRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    unmountingRef.current = false;

    const wireSocket = () => {
      clearReconnectTimer();
      const previous = wsRef.current;
      if (previous) {
        previous.onclose = null;
        previous.close();
        wsRef.current = null;
      }
      if (unmountingRef.current) return;
      setStatus('connecting');

      const url = getChatWsUrl(selfId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setReconnectExhausted(false);
        setStatus('open');
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string);
          if (data.type === 'error') {
            console.warn('Chat error:', data.message);
            return;
          }
          if (data.type === 'chat_message') {
            appendUnique({
              id: data.id,
              sender_id: data.sender_id,
              receiver_id: data.receiver_id,
              sender_role: data.sender_role,
              receiver_role: data.receiver_role,
              message: data.message,
              timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
              is_read: true,
              patient_id: patientId,
            });
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (unmountingRef.current) return;
        setStatus((s) => (s === 'open' ? 'closed' : s));
        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setReconnectExhausted(true);
          setStatus('offline');
          return;
        }
        const delay = INITIAL_BACKOFF_MS * 2 ** reconnectAttemptRef.current;
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(() => {
          if (!unmountingRef.current) openSocketRef.current?.();
        }, delay);
      };

      ws.onerror = () => {
        /* onclose handles reconnect */
      };
    };

    openSocketRef.current = wireSocket;

    const initialTimer = window.setTimeout(() => {
      if (!unmountingRef.current) wireSocket();
    }, WS_CONNECT_DELAY_MS);

    return () => {
      unmountingRef.current = true;
      clearTimeout(initialTimer);
      clearReconnectTimer();
      const w = wsRef.current;
      if (w) {
        w.onclose = null;
        w.close();
      }
      wsRef.current = null;
      openSocketRef.current = null;
    };
  }, [selfId, peerId, patientId, appendUnique]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setStatus('offline');
      return;
    }
    ws.send(JSON.stringify({ receiver_id: peerId, message: text }));
    setInput('');
  };

  const liveConnected = status === 'open';

  const peerLabel =
    peerRole === 'doctor' ? 'Doctor' : peerRole === 'caretaker' ? 'Caretaker' : 'CHO';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 320,
        maxHeight: 'min(70vh, 520px)',
        background: 'var(--bg-secondary, #fff)',
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: 'linear-gradient(135deg, rgba(5,150,105,0.06) 0%, rgba(5,150,105,0.02) 100%)',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
            {title ?? `Chat · ${peerLabel}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
            {status === 'open' && <span style={{ color: '#059669' }}>● Live</span>}
            {status === 'connecting' && <span>Connecting…</span>}
            {(status === 'closed' || status === 'offline') && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#b45309' }}>
                <WifiOff size={12} /> Offline
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {reconnectExhausted && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 11, padding: '6px 10px' }}
              onClick={() => {
                reconnectAttemptRef.current = 0;
                setReconnectExhausted(false);
                openSocketRef.current?.();
              }}
            >
              Reconnect
            </button>
          )}
          {onClose && (
            <button
              type="button"
              aria-label="Close chat"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                color: '#64748b',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {historyError && (
        <div style={{ padding: '8px 12px', fontSize: 12, color: '#b45309', background: '#fffbeb' }}>
          {historyError}
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 && !historyError && (
          <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 24 }}>
            No messages yet. Say hello.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === selfId;
          return (
            <div
              key={m.id ? `id-${m.id}` : `${m.sender_id}-${m.timestamp}-${m.message.slice(0, 20)}`}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 12px',
                borderRadius: 12,
                background: mine ? 'rgba(5,150,105,0.12)' : 'rgba(15,23,42,0.06)',
                border: mine ? '1px solid rgba(5,150,105,0.2)' : '1px solid rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {m.message}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
                {mine ? 'You' : peerLabel}{' '}
                {m.timestamp ? new Date(m.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 14px',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          disabled={!liveConnected}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.1)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={send}
          disabled={!input.trim() || !liveConnected}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px' }}
        >
          <Send size={16} />
          Send
        </button>
      </div>
    </div>
  );
}
