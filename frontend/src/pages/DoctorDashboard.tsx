import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pill, Calendar, Activity, MessageCircle } from 'lucide-react';
import ChatWindow from '../components/ChatWindow';
import DoctorLayout, { type DoctorLayoutPatient } from '../layouts/DoctorLayout';
import DeteriorationSignals from '../components/DeteriorationSignals';
import PatientManager from '../components/PatientManager';
import { downloadPatientSummaryReport, getAppointments, getBiomarkerReports, getMedications, getRiskScore, lookupAbhaPatient, type AbhaPatient } from '../api/endpoints';

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

export default function DoctorDashboard() {
    const [selectedAbhaId, setSelectedAbhaId] = useState<string | null>(null);
    const [patients, setPatients] = useState<DoctorLayoutPatient[]>([]);
    const [abhaPatient, setAbhaPatient] = useState<AbhaPatient | null>(null);
    const [showManager, setShowManager] = useState(false);
    const [riskScore, setRiskScore] = useState(25);
    const [riskLevel, setRiskLevel] = useState<'Low' | 'Moderate' | 'High' | 'Critical'>('Low');
    const [biomarkerReports, setBiomarkerReports] = useState<BiomarkerReportRow[]>([]);
    const [meds, setMeds] = useState<Array<{ name: string; dose: string; time: string; interaction: boolean; note?: string }>>([]);
    const [appointments, setAppointments] = useState<Array<{ date: string; doctor: string; type: string }>>([]);
    const [abhaNotice, setAbhaNotice] = useState('');
    const [downloadingReport, setDownloadingReport] = useState(false);
    const [chatPeer, setChatPeer] = useState<'caretaker' | 'cho' | null>(null);

    const patient = useMemo(() => patients.find((p) => p.abha_id === selectedAbhaId) ?? patients[0] ?? null, [patients, selectedAbhaId]);
    const riskColor = riskLevel === 'Critical' ? '#ef4444' : riskLevel === 'High' ? '#f59e0b' : riskLevel === 'Moderate' ? '#3b82f6' : '#10b981';

    const onDownloadReport = async () => {
        const pid = abhaPatient?.db_patient_id ?? null;
        if (!pid) {
            setAbhaNotice('Download unavailable: selected ABHA patient is not mapped to DB patient.');
            return;
        }
        try {
            setDownloadingReport(true);
            await downloadPatientSummaryReport(pid);
            setAbhaNotice('Report downloaded successfully.');
        } catch (e) {
            setAbhaNotice(e instanceof Error ? e.message : 'Failed to download report.');
        } finally {
            setDownloadingReport(false);
        }
    };

    useEffect(() => {
        if (!selectedAbhaId) return;
        (async () => {
            try {
                const profile = await lookupAbhaPatient(selectedAbhaId);
                setAbhaPatient(profile);
                if (!profile.db_patient_id) {
                    setBiomarkerReports([]);
                    setMeds([]);
                    setAppointments([]);
                    setRiskScore(0);
                    setRiskLevel('Low');
                    setAbhaNotice('ABHA profile loaded. Clinical trend data is unavailable until mapped to local patient records.');
                    return;
                }
                const [risk, reportRows, medRows, apptRows] = await Promise.all([
                    getRiskScore(profile.db_patient_id),
                    getBiomarkerReports(profile.db_patient_id),
                    getMedications(profile.db_patient_id),
                    getAppointments(profile.db_patient_id),
                ]);
                setRiskScore(Math.round(risk.score));
                const lv = (risk.risk_level || 'LOW').toLowerCase();
                setRiskLevel(lv === 'critical' ? 'Critical' : lv === 'high' ? 'High' : lv === 'moderate' ? 'Moderate' : 'Low');

                setBiomarkerReports(toReportRows(reportRows));

                setMeds(medRows.map((m) => ({ name: m.name, dose: m.dose, time: m.schedule_time, interaction: false })));
                setAppointments(apptRows.map((a) => ({ date: a.appointment_time, doctor: a.doctor_name, type: 'Follow-up' })));
                setAbhaNotice('');
            } catch {
                setAbhaNotice('Unable to load ABHA profile/data for selected patient.');
            }
        })();
    }, [selectedAbhaId]);

    const openChoChat = () => {
        if (!abhaPatient?.db_patient_id) {
            setAbhaNotice('Chat needs a mapped local patient (ABHA → DB).');
            return;
        }
        setChatPeer('cho');
    };

    const openCaretakerChat = () => {
        if (!abhaPatient?.db_patient_id) {
            setAbhaNotice('Chat needs a mapped local patient (ABHA → DB).');
            return;
        }
        setChatPeer('caretaker');
    };

    return (
        <DoctorLayout
            selectedAbhaId={selectedAbhaId}
            onSelectPatient={(abhaId) => {
                setSelectedAbhaId(abhaId);
                setShowManager(false);
            }}
            onManagePatients={() => setShowManager((v) => !v)}
            onPatientsLoaded={setPatients}
            onChatCho={openChoChat}
            onChatCaretaker={openCaretakerChat}
        >
            {/* Patient Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 4 }}>
                        {abhaPatient?.name || patient?.name || 'No patient selected'}
                    </h1>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: '#64748b' }}>
                            {abhaPatient?.abha_id || patient?.abha_id || 'ABHA not selected'} · Age {abhaPatient?.age ?? patient?.age ?? '-'}
                        </span>
                        {(abhaPatient?.conditions || patient?.conditions || []).map((c) => (
                            <span key={c} className="badge badge-blue">{c}</span>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
                    <div style={{ padding: '14px 20px', borderRadius: 16, background: `${riskColor}15`, border: `1px solid ${riskColor}30`, textAlign: 'center' }}>
                        <div style={{ fontSize: 32, fontWeight: 900, color: riskColor, lineHeight: 1 }}>{riskScore}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: riskColor, marginTop: 2 }}>{riskLevel.toUpperCase()} RISK</div>
                        <button
                            className="btn btn-primary"
                            onClick={onDownloadReport}
                            disabled={downloadingReport}
                            style={{ marginTop: 10, fontSize: 12, padding: '6px 10px' }}
                        >
                            {downloadingReport ? 'Generating...' : 'Download Report'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            className="btn"
                            style={{ fontSize: 12, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={openCaretakerChat}
                        >
                            <MessageCircle size={14} /> Caretaker
                        </button>
                        <button
                            type="button"
                            className="btn"
                            style={{ fontSize: 12, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={openChoChat}
                        >
                            <MessageCircle size={14} /> CHO
                        </button>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>ABHA Integration</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            Doctor view is driven by ABHA lookup and shared ABHA panel.
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowManager((v) => !v)}>
                        Manage Patients
                    </button>
                </div>
                {abhaNotice && <div style={{ marginTop: 10, fontSize: 12, color: '#b45309' }}>{abhaNotice}</div>}
            </div>

            {showManager && (
                <div style={{ marginBottom: 24 }}>
                    <PatientManager selectedAbhaId={selectedAbhaId} onSelectPatient={setSelectedAbhaId} />
                </div>
            )}

            {/* Biomarkers Table */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <Activity size={18} color="#3b82f6" />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Biomarker Records</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                {['Report', 'Date', 'Glucose', 'Postprandial', 'HBA1C'].map((h) => (
                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {biomarkerReports.map((r) => (
                                <tr key={`${r.report}-${r.date}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                    <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>{r.report}</td>
                                    <td style={{ padding: '12px', color: '#0f172a' }}>{r.date}</td>
                                    <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>{r.glucose}</td>
                                    <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>{r.postprandial}</td>
                                    <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>{r.hba1c}</td>
                                </tr>
                            ))}
                            {biomarkerReports.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '12px', color: '#64748b' }}>No biomarker records found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Deterioration Signals */}
            <div style={{ marginBottom: 24 }}>
                <DeteriorationSignals patientId={abhaPatient?.db_patient_id ?? null} />
            </div>

            {/* Medications + Interactions */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <Pill size={18} color="#8b5cf6" />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Medications & Interactions</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {meds.map((m, i) => (
                        <div key={i} style={{ padding: 14, borderRadius: 12, border: `1px solid ${m.interaction ? 'rgba(245,158,11,0.25)' : 'rgba(0,0,0,0.06)'}`, background: m.interaction ? 'rgba(245,158,11,0.04)' : 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: m.note ? 6 : 0 }}>
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{m.name}</span>
                                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{m.time}</span>
                                </div>
                                {m.interaction && <span className="badge badge-amber"><AlertTriangle size={10} /> Interaction</span>}
                            </div>
                            {m.note && <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>⚠ {m.note}</div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Appointments */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <Calendar size={18} color="#059669" />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Upcoming Appointments</h3>
                </div>
                {appointments.map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i === 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{a.type}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{a.doctor}</div>
                        </div>
                        <span className="badge badge-accent">{a.date}</span>
                    </div>
                ))}
            </div>

            {chatPeer && abhaPatient?.db_patient_id && (
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
                    onClick={() => setChatPeer(null)}
                >
                    <div style={{ width: 'min(440px, 100%)', maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
                        <ChatWindow
                            patientId={abhaPatient.db_patient_id}
                            selfRole="doctor"
                            peerRole={chatPeer}
                            title={chatPeer === 'caretaker' ? 'Chat · Caretaker' : 'Chat · CHO'}
                            onClose={() => setChatPeer(null)}
                        />
                    </div>
                </div>
            )}
        </DoctorLayout>
    );
}
