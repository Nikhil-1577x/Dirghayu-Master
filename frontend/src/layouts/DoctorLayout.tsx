import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, LogOut, User, UserPlus } from 'lucide-react';
import { useRoleStore } from '../store';
import PatientManager from '../components/PatientManager';

interface PatientSummary {
    abha_id: string;
    name: string;
    age: number;
    conditions: string[];
}

const RISK_COLOR: Record<string, string> = {
    Critical: '#ef4444',
    High: '#f59e0b',
    Moderate: '#3b82f6',
    Low: '#10b981',
};

function getRisk(conditions: string[]): string {
    if (conditions.length >= 2 && conditions.some(c => c.includes('CKD') || c.includes('Kidney'))) return 'Critical';
    if (conditions.length >= 2) return 'High';
    if (conditions.some(c => c.includes('Diabetes'))) return 'Moderate';
    return 'Low';
}

interface DoctorLayoutProps {
    children: React.ReactNode;
    selectedId: string | null;
    onSelectPatient: (id: string) => void;
}

export default function DoctorLayout({ children, selectedId, onSelectPatient }: DoctorLayoutProps) {
    const navigate = useNavigate();
    const setRole = useRoleStore((s) => s.setRole);
    const [patients, setPatients] = useState<PatientSummary[]>([]);
    const [showManager, setShowManager] = useState(false);

    const fetchPatients = useCallback(async () => {
        try {
            const res = await fetch('/abha/patients');
            const data = await res.json();
            setPatients(data.patients || []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    // Auto-select first patient
    useEffect(() => {
        if (patients.length > 0 && !selectedId) {
            onSelectPatient(patients[0].abha_id);
        }
    }, [patients, selectedId, onSelectPatient]);

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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 8, paddingRight: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#475569' }}>PATIENTS ({patients.length})</span>
                        <button
                            onClick={() => setShowManager(true)}
                            title="Manage Patients"
                            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <UserPlus size={14} />
                        </button>
                    </div>
                    {patients.map((p) => {
                        const risk = getRisk(p.conditions);
                        return (
                            <button
                                key={p.abha_id}
                                onClick={() => { onSelectPatient(p.abha_id); setShowManager(false); }}
                                style={{
                                    width: '100%',
                                    padding: '12px 12px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: selectedId === p.abha_id ? 'rgba(59,130,246,0.15)' : 'transparent',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    marginBottom: 4,
                                    transition: 'background 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    fontFamily: 'inherit',
                                }}
                            >
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <User size={16} color="#94a3b8" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Age {p.age} · {p.conditions[0]}</div>
                                </div>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: RISK_COLOR[risk], flexShrink: 0 }} title={risk} />
                            </button>
                        );
                    })}
                </div>

                {/* Logout */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                        onClick={handleLogout}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}
                    >
                        <LogOut size={15} /> Switch Role
                    </button>
                </div>
            </div>

            {/* Main */}
            <div style={{ flex: 1, marginLeft: 280, overflow: 'auto', padding: '32px 40px 48px' }}>
                {showManager ? (
                    <div style={{ maxWidth: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>Manage Patients</h1>
                            <button onClick={() => setShowManager(false)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748b', fontFamily: 'inherit' }}>
                                ← Back to Dashboard
                            </button>
                        </div>
                        <PatientManager themeColor="#3b82f6" themeColorRGB="59,130,246" onPatientsChange={fetchPatients} />
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
}

export { RISK_COLOR };
export type { PatientSummary };
