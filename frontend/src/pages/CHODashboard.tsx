import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle, Calendar, Settings, LogOut, Users, Activity, Pill, CheckCircle2, Globe, RefreshCw } from 'lucide-react';
import { useRoleStore } from '../store';

type Tab = 'home' | 'highrisk' | 'visits' | 'settings';

const HIGH_RISK_PATIENTS = [
    { id: 1, name: 'Kamla Bai', age: 63, village: 'Paithan', risk: 98, conditions: 'Diabetes + CKD', lastVisit: '12 days ago', alerts: 3 },
    { id: 2, name: 'Ramesh Kumar', age: 67, village: 'Aurangabad', risk: 87, conditions: 'Diabetes + Hypertension', lastVisit: '3 days ago', alerts: 2 },
    { id: 3, name: 'Arun Sharma', age: 72, village: 'Waluj', risk: 76, conditions: 'Diabetes', lastVisit: '1 week ago', alerts: 1 },
];

const TODAY_VISITS = [
    { id: 1, name: 'Ramesh Kumar', time: '10:00 AM', village: 'Aurangabad', type: 'BP Check', done: true },
    { id: 2, name: 'Kamla Bai', time: '12:30 PM', village: 'Paithan', type: 'Med Refill', done: false },
    { id: 3, name: 'Sunita Devi', time: '3:00 PM', village: 'Nanded Road', type: 'Glucose Test', done: false },
];

const HOME_STATS = [
    { label: 'Patients Visited', value: '4', icon: Users, color: '#059669', bg: 'rgba(5,150,105,0.1)' },
    { label: 'Meds Dispensed', value: '12', icon: Pill, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    { label: 'Active Alerts', value: '6', icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    { label: 'Readings Logged', value: '8', icon: Activity, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
];

export default function CHODashboard() {
    const [tab, setTab] = useState<Tab>('home');
    const [lang, setLang] = useState<'en' | 'hi'>('en');
    const navigate = useNavigate();
    const setRole = useRoleStore((s) => s.setRole);

    const tabs = [
        { key: 'home' as Tab, label: lang === 'en' ? 'Home' : 'होम', icon: Home },
        { key: 'highrisk' as Tab, label: lang === 'en' ? 'High Risk' : 'जोखिम', icon: AlertTriangle },
        { key: 'visits' as Tab, label: lang === 'en' ? 'Visits' : 'दौरे', icon: Calendar },
        { key: 'settings' as Tab, label: lang === 'en' ? 'Settings' : 'सेटिंग', icon: Settings },
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto', position: 'relative' }}>
            {/* Top Bar */}
            <div style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', padding: '20px 20px 24px', color: 'white' }}>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>{lang === 'en' ? 'Community Health Officer' : 'सामुदायिक स्वास्थ्य अधिकारी'}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Anita Pawar</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>Aurangabad Block • 18 patients</div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '20px 16px 100px', overflowY: 'auto' }}>
                {tab === 'home' && (
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Today's Summary</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {HOME_STATS.map((s) => {
                                const Icon = s.icon;
                                return (
                                    <div key={s.label} style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                            <Icon size={18} color={s.color} />
                                        </div>
                                        <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.label}</div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: 24, background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.05) 100%)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 14, padding: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', marginBottom: 4 }}>Next Visit</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Kamla Bai — 12:30 PM</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Paithan · Med Refill</div>
                        </div>
                    </div>
                )}

                {tab === 'highrisk' && (
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>High-Risk Patients</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {HIGH_RISK_PATIENTS.map((p) => (
                                <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{p.name} <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>({p.age})</span></div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.village} · {p.conditions}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: p.risk > 85 ? '#ef4444' : '#f59e0b' }}>{p.risk}</div>
                                            <div style={{ fontSize: 10, color: '#64748b' }}>risk score</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 600 }}>
                                            {p.alerts} alert{p.alerts > 1 ? 's' : ''}
                                        </span>
                                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--bg-tertiary)', color: '#64748b', border: '1px solid rgba(0,0,0,0.06)' }}>
                                            Last visit: {p.lastVisit}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'visits' && (
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Today's Visits</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {TODAY_VISITS.map((v) => (
                                <div key={v.id} style={{ background: 'white', borderRadius: 14, padding: 16, border: `1px solid ${v.done ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', opacity: v.done ? 0.7 : 1 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: v.done ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {v.done ? <CheckCircle2 size={20} color="#10b981" /> : <Calendar size={20} color="#8b5cf6" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', textDecoration: v.done ? 'line-through' : 'none' }}>{v.name}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{v.time} · {v.village} · {v.type}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'settings' && (
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Settings</div>

                        <div style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 14 }}>Language</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {(['en', 'hi'] as const).map((l) => (
                                    <button
                                        key={l}
                                        onClick={() => setLang(l)}
                                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${lang === l ? 'rgba(139,92,246,0.4)' : 'rgba(0,0,0,0.08)'}`, background: lang === l ? 'rgba(139,92,246,0.1)' : 'transparent', color: lang === l ? '#7c3aed' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                    >
                                        <Globe size={14} />{l === 'en' ? 'English' : 'हिंदी'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 14 }}>Sync</div>
                            <button className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><RefreshCw size={15} /> Sync Patient Data</button>
                        </div>

                        <button
                            onClick={() => { setRole(null); navigate('/'); }}
                            style={{ width: '100%', padding: 16, borderRadius: 14, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14 }}
                        >
                            <LogOut size={16} /> Switch Role
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: 'white', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', padding: '8px 0 env(safe-area-inset-bottom)', boxShadow: '0 -4px 24px rgba(0,0,0,0.08)', zIndex: 50 }}>
                {tabs.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: active ? '#8b5cf6' : '#94a3b8', transition: 'color 0.2s' }}
                        >
                            <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{t.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
