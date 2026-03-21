import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Pill, Calendar, Activity } from 'lucide-react';
import DoctorLayout from '../layouts/DoctorLayout';
import DeteriorationSignals from '../components/DeteriorationSignals';

interface PatientDetail {
    abha_id: string;
    name: string;
    age: number;
    gender: string;
    blood_group: string;
    conditions: string[];
    allergies: string[];
    history: { date: string; event: string; facility: string }[];
}

// Simulated biomarker data keyed by some ABHA IDs (fallback to generic)
const BIOMARKER_DATA: Record<string, Array<{ type: string; value: number; unit: string; trend: 'up' | 'down' | 'stable'; readings: number[] }>> = {
    'ABHA-1001': [
        { type: 'Systolic BP', value: 148, unit: 'mmHg', trend: 'up', readings: [132, 138, 141, 145, 148] },
        { type: 'Diastolic BP', value: 92, unit: 'mmHg', trend: 'up', readings: [80, 84, 87, 90, 92] },
        { type: 'Fasting Glucose', value: 138, unit: 'mg/dL', trend: 'up', readings: [115, 122, 128, 134, 138] },
        { type: 'HbA1c', value: 7.8, unit: '%', trend: 'up', readings: [6.9, 7.1, 7.4, 7.6, 7.8] },
        { type: 'Creatinine', value: 1.1, unit: 'mg/dL', trend: 'stable', readings: [1.0, 1.0, 1.1, 1.1, 1.1] },
    ],
    'ABHA-1002': [
        { type: 'Systolic BP', value: 136, unit: 'mmHg', trend: 'down', readings: [148, 144, 140, 138, 136] },
        { type: 'Diastolic BP', value: 84, unit: 'mmHg', trend: 'down', readings: [95, 90, 88, 86, 84] },
        { type: 'Fasting Glucose', value: 98, unit: 'mg/dL', trend: 'stable', readings: [100, 99, 97, 98, 98] },
    ],
};

const DEFAULT_BIOMARKERS = [
    { type: 'Systolic BP', value: 128, unit: 'mmHg', trend: 'stable' as const, readings: [130, 129, 128, 127, 128] },
    { type: 'Fasting Glucose', value: 110, unit: 'mg/dL', trend: 'stable' as const, readings: [112, 111, 110, 110, 110] },
];

const MEDICATIONS: Record<string, Array<{ name: string; dose: string; time: string; interaction: boolean; note?: string }>> = {
    'ABHA-1001': [
        { name: 'Metformin 500mg', dose: '500mg', time: 'Twice daily', interaction: false },
        { name: 'Amlodipine 5mg', dose: '5mg', time: 'Once daily', interaction: true, note: 'Possible interaction with Simvastatin — monitor LFT' },
        { name: 'Aspirin 75mg', dose: '75mg', time: 'Once daily', interaction: false },
        { name: 'Atorvastatin', dose: '10mg', time: 'Night', interaction: true, note: 'Statin + Amlodipine: monitor for myopathy' },
    ],
    'ABHA-1002': [
        { name: 'Losartan 50mg', dose: '50mg', time: 'Once daily', interaction: false },
        { name: 'Hydrochlorothiazide', dose: '12.5mg', time: 'Morning', interaction: false },
    ],
};

const DEFAULT_MEDS: Array<{ name: string; dose: string; time: string; interaction: boolean; note?: string }> = [
    { name: 'Metformin 500mg', dose: '500mg', time: 'Twice daily', interaction: false },
];

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
    if (trend === 'up') return <TrendingUp size={14} color="#ef4444" />;
    if (trend === 'down') return <TrendingDown size={14} color="#10b981" />;
    return <Minus size={14} color="#94a3b8" />;
}

export default function DoctorDashboard() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [patient, setPatient] = useState<PatientDetail | null>(null);

    // Fetch patient detail when selection changes
    useEffect(() => {
        if (!selectedId) { setPatient(null); return; }
        fetch(`/abha/lookup/${encodeURIComponent(selectedId)}`)
            .then(r => r.json())
            .then(data => setPatient(data))
            .catch(() => setPatient(null));
    }, [selectedId]);

    const biomarkers = (selectedId && BIOMARKER_DATA[selectedId]) || DEFAULT_BIOMARKERS;
    const meds = (selectedId && MEDICATIONS[selectedId]) || DEFAULT_MEDS;

    const riskScore = patient
        ? (patient.conditions.length >= 2 && patient.conditions.some(c => c.includes('CKD') || c.includes('Kidney'))) ? 95
        : patient.conditions.length >= 2 ? 80
        : patient.conditions.some(c => c.includes('Diabetes')) ? 55
        : 25
        : 0;
    const riskLabel = riskScore >= 90 ? 'Critical' : riskScore >= 70 ? 'High' : riskScore >= 40 ? 'Moderate' : 'Low';
    const riskColor = riskScore >= 90 ? '#ef4444' : riskScore >= 70 ? '#f59e0b' : riskScore >= 40 ? '#3b82f6' : '#10b981';

    if (!patient) {
        return (
            <DoctorLayout selectedId={selectedId} onSelectPatient={setSelectedId}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#94a3b8', fontSize: 15 }}>
                    Select a patient from the sidebar to view their details
                </div>
            </DoctorLayout>
        );
    }

    return (
        <DoctorLayout selectedId={selectedId} onSelectPatient={setSelectedId}>
            {/* Patient Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 4 }}>
                        {patient.name}
                    </h1>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#64748b' }}>Age {patient.age} · {patient.gender} · {patient.blood_group}</span>
                        {patient.conditions.map((c) => (
                            <span key={c} className="badge badge-blue">{c}</span>
                        ))}
                        {patient.allergies.map((a) => (
                            <span key={a} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(245,158,11,0.1)', color: '#b45309', fontWeight: 600, border: '1px solid rgba(245,158,11,0.2)' }}>⚠ {a}</span>
                        ))}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>ABHA: {patient.abha_id}</div>
                </div>
                <div style={{ padding: '14px 20px', borderRadius: 16, background: `${riskColor}15`, border: `1px solid ${riskColor}30`, textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: riskColor, lineHeight: 1 }}>{riskScore}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: riskColor, marginTop: 2 }}>{riskLabel.toUpperCase()} RISK</div>
                </div>
            </div>

            {/* Biomarkers Table */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <Activity size={18} color="#3b82f6" />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Biomarker Trends (Last 5 Readings)</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                {['Biomarker', 'Latest', 'Trend', 'Last 5 readings'].map((h) => (
                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {biomarkers.map((b) => (
                                <tr key={b.type} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                    <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a' }}>{b.type}</td>
                                    <td style={{ padding: '12px', fontWeight: 800, color: b.trend === 'up' ? '#ef4444' : b.trend === 'down' ? '#10b981' : '#0f172a', fontSize: 15 }}>
                                        {b.value} <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>{b.unit}</span>
                                    </td>
                                    <td style={{ padding: '12px' }}><TrendIcon trend={b.trend} /></td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            {b.readings.map((r, i) => (
                                                <span key={i} style={{ padding: '2px 6px', borderRadius: 4, background: i === b.readings.length - 1 ? (b.trend === 'up' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)') : 'var(--bg-tertiary)', fontSize: 11, color: i === b.readings.length - 1 ? (b.trend === 'up' ? '#dc2626' : '#047857') : '#64748b', fontWeight: i === b.readings.length - 1 ? 700 : 400 }}>
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Deterioration Signals */}
            <div style={{ marginBottom: 24 }}>
                <DeteriorationSignals />
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
                {[{ date: '22 Mar 2026', doctor: 'Dr. Priya Mehta', type: 'Follow-up' }, { date: '28 Mar 2026', doctor: 'Dr. Rajesh Patel', type: 'Lab Review' }].map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i === 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{a.type}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{a.doctor}</div>
                        </div>
                        <span className="badge badge-accent">{a.date}</span>
                    </div>
                ))}
            </div>
        </DoctorLayout>
    );
}
