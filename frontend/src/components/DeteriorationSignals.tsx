import { TrendingDown, Zap, AlertTriangle, Shield } from 'lucide-react';

interface Signal {
    id: string;
    name: string;
    severity: 'critical' | 'warning' | 'stable';
    description: string;
    since: string;
}

const MOCK_SIGNALS: Signal[] = [
    { id: '1', name: 'TRIPLE_THREAT', severity: 'critical', description: 'BP + Glucose + Missed meds all elevated simultaneously', since: '2 days' },
    { id: '2', name: 'HIGH_SALT_PATTERN', severity: 'warning', description: 'Sodium intake consistently above 2.3g/day this week', since: '5 days' },
    { id: '3', name: 'DRUG_HOLIDAY', severity: 'warning', description: '3 consecutive doses of Amlodipine missed', since: '1 day' },
    { id: '4', name: 'BP_CREEP', severity: 'warning', description: 'Systolic BP rising 2–3 mmHg per day over 7 days', since: '7 days' },
    { id: '5', name: 'GLUCOSE_SPIKE', severity: 'critical', description: 'Post-meal glucose exceeded 200 mg/dL twice today', since: '6 hours' },
    { id: '6', name: 'ADHERENCE_DROP', severity: 'stable', description: 'Weekly adherence dropped from 92% to 74%', since: '3 days' },
];

const SEVERITY_CONFIG = {
    critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: Zap, label: 'Critical' },
    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: AlertTriangle, label: 'Warning' },
    stable: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: Shield, label: 'Stable' },
};

export default function DeteriorationSignals() {
    const active = MOCK_SIGNALS;
    const critical = active.filter((s) => s.severity === 'critical').length;
    const warning = active.filter((s) => s.severity === 'warning').length;

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
                {active.map((sig) => {
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
                                    {sig.name.replace(/_/g, ' ')}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{sig.description}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Active for {sig.since}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
