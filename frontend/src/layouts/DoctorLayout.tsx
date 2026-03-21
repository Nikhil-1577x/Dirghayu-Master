import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, LogOut, User, Users, MessageCircle } from 'lucide-react';
import { useRoleStore } from '../store';
import { listAbhaPanelPatients, type AbhaPatient } from '../api/endpoints';

export interface DoctorLayoutPatient {
    abha_id: string;
    name: string;
    age: number;
    conditions: string[];
    risk: 'Low' | 'Moderate' | 'High' | 'Critical';
    db_patient_id?: number | null;
}

const FALLBACK_PATIENTS: DoctorLayoutPatient[] = [
    { abha_id: 'ABHA-1001', name: 'No panel patient', age: 0, conditions: ['Add ABHA patient'], risk: 'Low', db_patient_id: null },
];

const RISK_COLOR: Record<string, string> = {
    Critical: '#ef4444',
    High: '#f59e0b',
    Moderate: '#3b82f6',
    Low: '#10b981',
};

interface DoctorLayoutProps {
    children: React.ReactNode;
    selectedAbhaId: string | null;
    onSelectPatient: (abhaId: string) => void;
    onManagePatients?: () => void;
    onPatientsLoaded?: (patients: DoctorLayoutPatient[]) => void;
    /** Opens doctor ↔ CHO chat (uses mapped DB patient for the selected ABHA profile). */
    onChatCho?: () => void;
    /** Opens doctor ↔ caretaker chat for the current clinical context (uses mapped DB patient). */
    onChatCaretaker?: () => void;
}

export default function DoctorLayout({
    children,
    selectedAbhaId,
    onSelectPatient,
    onManagePatients,
    onPatientsLoaded,
    onChatCho,
    onChatCaretaker,
}: DoctorLayoutProps) {
    const navigate = useNavigate();
    const setRole = useRoleStore((s) => s.setRole);
    const [patients, setPatients] = useState<DoctorLayoutPatient[]>(FALLBACK_PATIENTS);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const rows = await listAbhaPanelPatients();
                if (!active) return;
                const mapped: DoctorLayoutPatient[] = (rows.patients || []).map((p: AbhaPatient) => ({
                    abha_id: p.abha_id,
                    name: p.name,
                    age: p.age,
                    conditions: p.conditions,
                    risk: 'Moderate',
                    db_patient_id: p.db_patient_id ?? null,
                }));
                const list = mapped.length ? mapped : [];
                setPatients(list);
                onPatientsLoaded?.(list);
                if (!selectedAbhaId && list.length) onSelectPatient(list[0].abha_id);
            } catch {
                if (!active) return;
                setPatients(FALLBACK_PATIENTS);
                onPatientsLoaded?.(FALLBACK_PATIENTS);
                if (!selectedAbhaId) onSelectPatient(FALLBACK_PATIENTS[0].abha_id);
            }
        })();
        return () => {
            active = false;
        };
    }, [onPatientsLoaded, onSelectPatient, selectedAbhaId]);

    const visiblePatients = useMemo(() => patients, [patients]);

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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 8, paddingRight: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#475569' }}>PATIENTS</div>
                        <button
                            onClick={onManagePatients}
                            style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', borderRadius: 8, padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                        >
                            <Users size={12} /> Manage Patients
                        </button>
                    </div>
                    {visiblePatients.map((p) => (
                        <button
                            key={p.abha_id}
                            onClick={() => onSelectPatient(p.abha_id)}
                            style={{
                                width: '100%',
                                padding: '12px 12px',
                                borderRadius: 10,
                                border: 'none',
                                background: selectedAbhaId === p.abha_id ? 'rgba(59,130,246,0.15)' : 'transparent',
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
                                <div style={{ fontSize: 11, color: '#64748b' }}>{p.abha_id} · Age {p.age} · {p.conditions[0]}</div>
                            </div>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: RISK_COLOR[p.risk], flexShrink: 0 }} title={p.risk} />
                        </button>
                    ))}
                    {!visiblePatients.length && (
                        <div style={{ padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>
                            No ABHA patients in panel. Use "Manage Patients".
                        </div>
                    )}
                </div>

                {(onChatCho || onChatCaretaker) && (
                    <div
                        style={{
                            padding: '4px 16px 12px',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}
                    >
                        {onChatCho && (
                            <button
                                type="button"
                                onClick={onChatCho}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid rgba(139, 92, 246, 0.4)',
                                    background: 'rgba(139, 92, 246, 0.12)',
                                    color: '#c4b5fd',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                <MessageCircle size={16} strokeWidth={2} />
                                Chat · CHO
                            </button>
                        )}
                        {onChatCaretaker && (
                            <button
                                type="button"
                                onClick={onChatCaretaker}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid rgba(5, 150, 105, 0.35)',
                                    background: 'rgba(5, 150, 105, 0.12)',
                                    color: '#6ee7b7',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                <MessageCircle size={16} strokeWidth={2} />
                                Chat · Caretaker
                            </button>
                        )}
                    </div>
                )}

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
