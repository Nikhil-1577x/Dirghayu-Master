import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { AlertTriangle, Info, AlertCircle, Bell } from 'lucide-react';
import { useIotStore } from '../store';

const severityConfig = {
  info: { icon: Info, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', label: 'Info' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', label: 'Warning' },
  critical: { icon: AlertCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', label: 'Critical' },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

const MISSED_ALERTS_PREVIEW = 2;

function isHardwareMissedAlert(alertType: string | undefined): boolean {
  const t = String(alertType || '').toUpperCase();
  return t.includes('MISSED');
}

export default function AlertsPanel() {
  const alerts = useIotStore((s) => s.alerts);

  /** Only hardware missed alerts, newest first, max 2 for this card */
  const missedPreview = useMemo(() => {
    const missed = alerts.filter((a) => isHardwareMissedAlert(a.alert_type));
    const byTime = [...missed].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return tb - ta;
    });
    return byTime.slice(0, MISSED_ALERTS_PREVIEW).map((a) => ({
      id: String(a.id),
      severity: (a.severity || 'warning') as 'info' | 'warning' | 'critical',
      title: String(a.alert_type || 'Hardware alert').replace(/_/g, ' '),
      description: a.message,
      timestamp: a.timestamp,
      read: false,
    }));
  }, [alerts]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'var(--red-muted)',
              border: '1px solid var(--red-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={22} color="var(--red-primary)" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Hardware Alerts</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Last {MISSED_ALERTS_PREVIEW} missed-dose alerts</div>
          </div>
        </div>
        <Link to="/alerts" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}>
          View all
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {missedPreview.length === 0 && (
          <div style={{ padding: '26px 14px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 20, color: '#10b981', fontWeight: 700, marginBottom: 4 }}>System Normal</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No active alerts. Hardware is idle and monitoring RTC time.</div>
          </div>
        )}
        {missedPreview.map((alert, i) => {
          const cfg = severityConfig[alert.severity];
          const Icon = cfg.icon;
          return (
            <div
              key={alert.id}
              style={{
                display: 'flex',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 12,
                background: alert.read ? 'var(--bg-tertiary)' : cfg.bg,
                border: `1px solid ${alert.read ? 'var(--border)' : cfg.border}`,
                animation: `fadeInUp ${0.15 + i * 0.06}s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                opacity: alert.read ? 0.85 : 1,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${cfg.color}15`,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} color={cfg.color} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{alert.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{alert.description}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: cfg.color,
                        background: `${cfg.color}20`,
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(alert.timestamp)}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTimestamp(alert.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
