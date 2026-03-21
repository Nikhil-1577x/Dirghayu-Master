import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle, Calendar, Settings, LogOut, Users, Activity, Pill, CheckCircle2, Globe, RefreshCw, MessageCircle } from 'lucide-react';
import ChatWindow from '../components/ChatWindow';
import { useRoleStore } from '../store';
import PatientManager from '../components/PatientManager';
import { getAlerts, getAppointments, getBiomarkerReports, getMedications, getRiskScore, listPatients } from '../api/endpoints';

type Tab = 'home' | 'highrisk' | 'visits' | 'patients' | 'settings';

interface HighRiskPatient {
    id: number;
    name: string;
    age: number;
    detail: string;
    risk: number;
    conditions: string;
    lastVisit: string;
    alerts: number;
}

interface VisitRow {
    id: number;
    name: string;
    time: string;
    detail: string;
    type: string;
    done: boolean;
}

interface StatRow {
    label: string;
    value: string;
    icon: typeof Users;
    color: string;
    bg: string;
}

type BiomarkerReportRow = {
    report: number;
    date: string;
    glucose: string;
    postprandial: string;
    hba1c: string;
};

function toReportRows(reportRows: Array<{ report_id: string; biomarker_name: string; value: number; created_at: string }>): BiomarkerReportRow[] {
    const byReport = new Map<string, { created_at: string; glucose: string; postprandial: string; hba1c: string }>();
    for (const b of reportRows) {
        const rid = b.report_id;
        if (!byReport.has(rid)) byReport.set(rid, { created_at: b.created_at, glucose: 'NA', postprandial: 'NA', hba1c: 'NA' });
        const row = byReport.get(rid)!;
        const t = b.biomarker_name.toLowerCase();
        if (t === 'glucose_fasting' || t === 'fasting_glucose' || t === 'blood_glucose' || t === 'glucose_random') row.glucose = String(b.value);
        if (t === 'glucose_postprandial') row.postprandial = String(b.value);
        if (t === 'hba1c') row.hba1c = String(b.value);
    }
    return Array.from(byReport.entries())
        .sort((a, b) => a[1].created_at.localeCompare(b[1].created_at))
        .map(([, vals], idx) => {
            const d = new Date(vals.created_at);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yy = String(d.getFullYear()).slice(-2);
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return { report: idx + 1, date: `${dd}/${mm}/${yy} ${hh}:${min}`, glucose: vals.glucose, postprandial: vals.postprandial, hba1c: vals.hba1c };
        })
        .filter((r) => !(r.glucose === 'NA' && r.postprandial === 'NA' && r.hba1c === 'NA'));
}

export default function CHODashboard() {
    const [tab, setTab] = useState<Tab>('home');
    const [lang, setLang] = useState<'en' | 'hi'>('en');
    const navigate = useNavigate();
    const setRole = useRoleStore((s) => s.setRole);
    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
    const [homeStats, setHomeStats] = useState<StatRow[]>([
        { label: 'Patients Visited', value: '0', icon: Users, color: '#059669', bg: 'rgba(5,150,105,0.1)' },
        { label: 'Meds Dispensed', value: '0', icon: Pill, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        { label: 'Active Alerts', value: '0', icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
        { label: 'Readings Logged', value: '0', icon: Activity, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    ]);
    const [highRiskPatients, setHighRiskPatients] = useState<HighRiskPatient[]>([]);
    const [todayVisits, setTodayVisits] = useState<VisitRow[]>([]);
    const [choBiomarkerReports, setChoBiomarkerReports] = useState<Array<{ patientName: string; rows: BiomarkerReportRow[] }>>([]);
    const [patientCount, setPatientCount] = useState(0);
    const [choPatients, setChoPatients] = useState<Array<{ id: number; name: string }>>([]);
    const [chatPatientId, setChatPatientId] = useState<number | null>(null);
    const [showDoctorChat, setShowDoctorChat] = useState(false);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const patients = await listPatients();
                setPatientCount(patients.length);
                setChoPatients(patients.map((p) => ({ id: p.id, name: p.name })));
                setChatPatientId((prev) => prev ?? (patients[0]?.id ?? null));
                const details = await Promise.all(
                    patients.map(async (p) => {
                        const [risk, reportRows, meds, alerts, appointments] = await Promise.all([
                            getRiskScore(p.id).catch(() => ({ score: 0, risk_level: 'LOW' })),
                            getBiomarkerReports(p.id).catch(() => []),
                            getMedications(p.id).catch(() => []),
                            getAlerts(p.id).catch(() => ({ alerts: [] })),
                            getAppointments(p.id).catch(() => []),
                        ]);
                        return { p, risk, reportRows, meds, alerts, appointments };
                    })
                );

                const totalMeds = details.reduce((n, d) => n + d.meds.length, 0);
                const totalAlerts = details.reduce((n, d) => n + (d.alerts.alerts?.length || 0), 0);
                const totalReadings = details.reduce((n, d) => n + d.reportRows.length, 0);
                setHomeStats([
                    { label: 'Patients Visited', value: String(patients.length), icon: Users, color: '#059669', bg: 'rgba(5,150,105,0.1)' },
                    { label: 'Meds Dispensed', value: String(totalMeds), icon: Pill, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                    { label: 'Active Alerts', value: String(totalAlerts), icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                    { label: 'Readings Logged', value: String(totalReadings), icon: Activity, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                ]);

                const risks: HighRiskPatient[] = details
                    .map(({ p, risk, alerts, appointments, reportRows }) => ({
                        id: p.id,
                        name: p.name,
                        age: p.age,
                        detail: p.gender,
                        risk: Math.round(risk.score || 0),
                        conditions: reportRows.length ? 'Biomarker reports available' : 'No biomarker history',
                        lastVisit: appointments.length ? String(appointments[0].appointment_time).split('T')[0] : 'No visit',
                        alerts: alerts.alerts?.length || 0,
                    }))
                    .sort((a, b) => b.risk - a.risk)
                    .slice(0, 5);
                setHighRiskPatients(risks);
                setChoBiomarkerReports(
                    details.map(({ p, reportRows }) => ({
                        patientName: p.name,
                        rows: toReportRows(reportRows).slice(0, 5),
                    }))
                );

                const visits: VisitRow[] = details
                    .flatMap(({ p, appointments }) =>
                        appointments.map((a) => ({
                            id: a.id,
                            name: p.name,
                            time: new Date(a.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            detail: p.gender,
                            type: a.notes || 'Follow-up',
                            done: new Date(a.appointment_time).getTime() < Date.now(),
                        }))
                    )
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .slice(0, 8);
                setTodayVisits(visits);
            } catch {
                setHighRiskPatients([]);
                setTodayVisits([]);
            }
        })();
    }, []);

    const tabs = [
        { key: 'home' as Tab, label: lang === 'en' ? 'Home' : 'होम', icon: Home },
        { key: 'highrisk' as Tab, label: lang === 'en' ? 'High Risk' : 'जोखिम', icon: AlertTriangle },
        { key: 'visits' as Tab, label: lang === 'en' ? 'Visits' : 'दौरे', icon: Calendar },
        { key: 'patients' as Tab, label: lang === 'en' ? 'Patients' : 'मरीज', icon: Users },
        { key: 'settings' as Tab, label: lang === 'en' ? 'Settings' : 'सेटिंग', icon: Settings },
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex' }}>
            {!isMobile && (
                <aside
                    style={{
                        width: 260,
                        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
                        color: '#e2e8f0',
                        padding: '22px 14px',
                        position: 'fixed',
                        top: 0,
                        bottom: 0,
                        left: 0,
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>CHO Console</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>Anita Pawar</div>
                    {tabs.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                style={{
                                    width: '100%',
                                    marginBottom: 6,
                                    border: 'none',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    padding: '10px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    background: active ? 'rgba(139,92,246,0.22)' : 'transparent',
                                    color: active ? '#fff' : '#cbd5e1',
                                    textAlign: 'left',
                                }}
                            >
                                <Icon size={16} />
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</span>
                            </button>
                        );
                    })}
                </aside>
            )}

            <div style={{ flex: 1, marginLeft: isMobile ? 0 : 260, display: 'flex', flexDirection: 'column', maxWidth: isMobile ? 430 : 'none', width: '100%', marginRight: isMobile ? 'auto' : 0, position: 'relative' }}>
                {/* Top Bar */}
                <div style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', padding: '20px 20px 24px', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>{lang === 'en' ? 'Community Health Officer' : 'सामुदायिक स्वास्थ्य अधिकारी'}</div>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>Anita Pawar</div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>Aurangabad Block • {patientCount} patients</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (chatPatientId == null) return;
                                setShowDoctorChat(true);
                            }}
                            disabled={chatPatientId == null}
                            style={{
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 12px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.5)',
                                background: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: chatPatientId == null ? 'not-allowed' : 'pointer',
                                opacity: chatPatientId == null ? 0.5 : 1,
                            }}
                        >
                            <MessageCircle size={16} />
                            {lang === 'en' ? 'Doctor' : 'डॉक्टर'}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: '20px 16px 100px', overflowY: 'auto' }}>
                {tab === 'home' && (
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Today's Summary</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {homeStats.map((s) => {
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
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                                {todayVisits[0] ? `${todayVisits[0].name} — ${todayVisits[0].time}` : 'No upcoming visits'}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                {todayVisits[0] ? `${todayVisits[0].detail} · ${todayVisits[0].type}` : 'Create appointments to populate this panel.'}
                            </div>
                        </div>

                        <div style={{ marginTop: 24 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Biomarker Records</div>
                            {choBiomarkerReports.map((entry) => (
                                <div key={entry.patientName} style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{entry.patientName}</div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                                    {['Report', 'Date', 'Glucose', 'Postprandial', 'HBA1C'].map((h) => (
                                                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>{h.toUpperCase()}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {entry.rows.map((r) => (
                                                    <tr key={`${entry.patientName}-${r.report}-${r.date}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                                        <td style={{ padding: '9px 10px', fontWeight: 700 }}>{r.report}</td>
                                                        <td style={{ padding: '9px 10px' }}>{r.date}</td>
                                                        <td style={{ padding: '9px 10px', fontWeight: 700 }}>{r.glucose}</td>
                                                        <td style={{ padding: '9px 10px', fontWeight: 700 }}>{r.postprandial}</td>
                                                        <td style={{ padding: '9px 10px', fontWeight: 700 }}>{r.hba1c}</td>
                                                    </tr>
                                                ))}
                                                {entry.rows.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} style={{ padding: '9px 10px', color: '#64748b' }}>No biomarker records found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'highrisk' && (
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>High-Risk Patients</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {highRiskPatients.map((p) => (
                                <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{p.name} <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>({p.age})</span></div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.detail} · {p.conditions}</div>
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
                            {todayVisits.map((v) => (
                                <div key={v.id} style={{ background: 'white', borderRadius: 14, padding: 16, border: `1px solid ${v.done ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', opacity: v.done ? 0.7 : 1 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: v.done ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {v.done ? <CheckCircle2 size={20} color="#10b981" /> : <Calendar size={20} color="#8b5cf6" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', textDecoration: v.done ? 'line-through' : 'none' }}>{v.name}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{v.time} · {v.detail} · {v.type}</div>
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
                {tab === 'patients' && (
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>ABHA Patients</div>
                        <PatientManager />
                    </div>
                )}
                </div>

                {showDoctorChat && chatPatientId != null && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(15,23,42,0.45)',
                            zIndex: 2000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 16,
                        }}
                        onClick={() => setShowDoctorChat(false)}
                    >
                        <div
                            style={{ width: 'min(440px, 100%)', maxHeight: '92vh' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {choPatients.length > 1 && (
                                <div style={{ marginBottom: 10, background: 'white', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(0,0,0,0.08)' }}>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
                                        {lang === 'en' ? 'Patient context' : 'मरीज़'}
                                    </label>
                                    <select
                                        value={chatPatientId}
                                        onChange={(e) => setChatPatientId(Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            border: '1px solid rgba(0,0,0,0.12)',
                                            fontSize: 13,
                                        }}
                                    >
                                        {choPatients.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <ChatWindow
                                key={chatPatientId}
                                patientId={chatPatientId}
                                selfRole="cho"
                                peerRole="doctor"
                                title={lang === 'en' ? 'Chat · Doctor' : 'चैट · डॉक्टर'}
                                onClose={() => setShowDoctorChat(false)}
                            />
                        </div>
                    </div>
                )}

                {/* Bottom Nav (mobile only) */}
                {isMobile && <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: 'white', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', padding: '8px 0 env(safe-area-inset-bottom)', boxShadow: '0 -4px 24px rgba(0,0,0,0.08)', zIndex: 50 }}>
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
                </div>}
            </div>
        </div>
    );
}
