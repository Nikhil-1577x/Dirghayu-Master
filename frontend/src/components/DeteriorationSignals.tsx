import { useEffect, useMemo, useState } from 'react';
import { TrendingDown, Zap, AlertTriangle, Shield } from 'lucide-react';
import { getDeteriorationSignals, type DeteriorationSignal } from '../api/endpoints';
import { useApiStore } from '../store';

interface Signal {
    id: string | number;
    title: string;
    severity: 'critical' | 'warning' | 'good';
    description: string;
    duration: string;
}

const SEVERITY_CONFIG = {
    critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: Zap, label: 'Critical' },
    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: AlertTriangle, label: 'Warning' },
    good: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: Shield, label: 'Good' },
};

export default function DeteriorationSignals({ patientId: patientIdProp }: { patientId?: number | null }) {
    const storePatientId = useApiStore((s) => s.patientId);
    const patientId = patientIdProp ?? storePatientId;
    const [active, setActive] = useState<Signal[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!patientId) return;
        let mounted = true;
        setLoading(true);
        getDeteriorationSignals(patientId)
            .then((res) => {
                if (!mounted) return;
                const mapped = (res.signals || []).map((s: DeteriorationSignal, idx: number) => ({
                    id: idx + 1,
                    title: s.title,
                    severity: s.severity,
                    description: s.description,
                    duration: s.duration,
                }));
                setActive(mapped);
            })
            .catch(() => {
                if (!mounted) return;
                setActive([]);
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [patientId]);

    const critical = active.filter((s) => s.severity === 'critical').length;
    const warning = active.filter((s) => s.severity === 'warning').length;
    const cards = useMemo(() => active, [active]);

    return (
        <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TrendingDown size={20} color="#ef4444" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Deterioration Signals</h3>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {critical > 0 && (
                        <span className="badge badge-red">
                            <Zap size={10} /> {critical} Critical
                        </span>
                    )}
                    {warning > 0 && (
                        <span className="badge badge-amber">
                            <AlertTriangle size={10} /> {warning} Warning
                        </span>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading deterioration signals...</div>}
                {!loading && cards.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No deterioration signals available.</div>}
                {!loading && cards.map((sig) => {
                    const cfg = SEVERITY_CONFIG[sig.severity];
                    const Icon = cfg.icon;
                    return (
                        <div
                            key={sig.id}
                            style={{
                                padding: 14,
                                borderRadius: 12,
                                background: cfg.bg,
                                border: `1px solid ${cfg.border}`,
                                display: 'flex',
                                gap: 12,
                                alignItems: 'flex-start',
                            }}
                        >
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    background: cfg.bg,
                                    border: `1px solid ${cfg.border}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <Icon size={16} color={cfg.color} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: '0.06em', marginBottom: 2 }}>
                                    {sig.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{sig.description}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Active for {sig.duration}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
