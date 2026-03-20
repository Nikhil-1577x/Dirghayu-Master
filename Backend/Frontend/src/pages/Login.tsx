import { useNavigate } from 'react-router-dom';
import { useRoleStore, type UserRole } from '../store';
import { Heart, Stethoscope, Users } from 'lucide-react';

const ROLES: { key: UserRole; label: string; sub: string; icon: typeof Heart; color: string; bg: string; border: string; path: string }[] = [
    {
        key: 'caretaker',
        label: 'Caretaker',
        sub: 'Family member monitoring a loved one',
        icon: Heart,
        color: '#059669',
        bg: 'rgba(5,150,105,0.08)',
        border: 'rgba(5,150,105,0.25)',
        path: '/caretaker',
    },
    {
        key: 'doctor',
        label: 'Doctor',
        sub: 'Clinical overview & risk management',
        icon: Stethoscope,
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.08)',
        border: 'rgba(59,130,246,0.25)',
        path: '/doctor',
    },
    {
        key: 'cho',
        label: 'Community Health Officer',
        sub: 'Field visits & high-risk patient tracking',
        icon: Users,
        color: '#8b5cf6',
        bg: 'rgba(139,92,246,0.08)',
        border: 'rgba(139,92,246,0.25)',
        path: '/cho',
    },
];

export default function Login() {
    const navigate = useNavigate();
    const setRole = useRoleStore((s) => s.setRole);

    const select = (r: typeof ROLES[0]) => {
        setRole(r.key);
        navigate(r.path);
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                padding: 24,
            }}
        >
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(5,150,105,0.35)',
                    }}
                >
                    <Heart size={26} color="white" fill="white" />
                </div>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>Dirghau</div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>NCD Care Platform</div>
                </div>
            </div>

            <p style={{ fontSize: 15, color: '#64748b', marginBottom: 48, textAlign: 'center' }}>
                Select your role to continue
            </p>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 20,
                    width: '100%',
                    maxWidth: 840,
                }}
            >
                {ROLES.map((r, i) => {
                    const Icon = r.icon;
                    return (
                        <button
                            key={r.key}
                            onClick={() => select(r)}
                            style={{
                                background: 'white',
                                border: `2px solid ${r.border}`,
                                borderRadius: 20,
                                padding: '32px 24px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                animation: `fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.08}s both`,
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
                                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 12px 32px ${r.border}`;
                                (e.currentTarget as HTMLButtonElement).style.background = r.bg;
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
                                (e.currentTarget as HTMLButtonElement).style.background = 'white';
                            }}
                        >
                            <div
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 14,
                                    background: r.bg,
                                    border: `1px solid ${r.border}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 20,
                                }}
                            >
                                <Icon size={26} color={r.color} />
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{r.label}</div>
                            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{r.sub}</div>
                            <div
                                style={{
                                    marginTop: 20,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: r.color,
                                }}
                            >
                                Enter Dashboard →
                            </div>
                        </button>
                    );
                })}
            </div>

            <p style={{ marginTop: 48, fontSize: 12, color: '#94a3b8' }}>
                Demo mode — no password required
            </p>
        </div>
    );
}
