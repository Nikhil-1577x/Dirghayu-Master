import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, LogOut, User } from 'lucide-react';
import { useRoleStore } from '../store';

const MOCK_PATIENTS = [
    { id: 1, name: 'Ramesh Kumar', age: 67, conditions: ['Diabetes', 'Hypertension'], risk: 'High' },
    { id: 2, name: 'Sunita Devi', age: 58, conditions: ['Hypertension'], risk: 'Moderate' },
    { id: 3, name: 'Arun Sharma', age: 72, conditions: ['Diabetes'], risk: 'High' },
    { id: 4, name: 'Kamla Bai', age: 63, conditions: ['Diabetes', 'CKD'], risk: 'Critical' },
    { id: 5, name: 'Mahesh Yadav', age: 55, conditions: ['Hypertension'], risk: 'Low' },
];

const RISK_COLOR: Record<string, string> = {
    Critical: '#ef4444',
    High: '#f59e0b',
    Moderate: '#3b82f6',
    Low: '#10b981',
};

interface DoctorLayoutProps {
    children: React.ReactNode;
    selectedId: number | null;
    onSelectPatient: (id: number) => void;
}

export default function DoctorLayout({ children, selectedId, onSelectPatient }: DoctorLayoutProps) {
    const navigate = useNavigate();
    const setRole = useRoleStore((s) => s.setRole);

    const handleLogout = () => {
        setRole(null);
        navigate('/');
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
            {/* Sidebar */}
            <div
                style={{
                    width: 280,
                    background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    overflowY: 'auto',
                }}
            >
                {/* Header */}
                <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Stethoscope size={18} color="#60a5fa" />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Dr. Priya Mehta</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Cardiologist</div>
                        </div>
                    </div>
                </div>

                {/* Patient List */}
                <div style={{ padding: '16px 12px', flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#475569', marginBottom: 10, paddingLeft: 8 }}>PATIENTS</div>
                    {MOCK_PATIENTS.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => onSelectPatient(p.id)}
                            style={{
                                width: '100%',
                                padding: '12px 12px',
                                borderRadius: 10,
                                border: 'none',
                                background: selectedId === p.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                marginBottom: 4,
                                transition: 'background 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <User size={16} color="#94a3b8" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Age {p.age} · {p.conditions[0]}</div>
                            </div>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: RISK_COLOR[p.risk], flexShrink: 0 }} title={p.risk} />
                        </button>
                    ))}
                </div>

                {/* Logout */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                        onClick={handleLogout}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}
                    >
                        <LogOut size={15} /> Switch Role
                    </button>
                </div>
            </div>

            {/* Main */}
            <div style={{ flex: 1, marginLeft: 280, overflow: 'auto', padding: '32px 40px 48px' }}>
                {children}
            </div>
        </div>
    );
}

export { MOCK_PATIENTS };
