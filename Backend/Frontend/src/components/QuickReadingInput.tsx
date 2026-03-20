import { useState } from 'react';
import { Activity, Save, CheckCircle2 } from 'lucide-react';
import { useApiStore } from '../store';
import { api } from '../api/client';

export default function QuickReadingInput() {
    const patientId = useApiStore((s) => s.patientId);
    const [systolic, setSystolic] = useState('');
    const [diastolic, setDiastolic] = useState('');
    const [glucose, setGlucose] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        if (!patientId) return;
        setSaving(true);
        try {
            const ts = new Date().toISOString();
            const calls: Promise<unknown>[] = [];
            if (systolic) calls.push(api.post(`/patient/${patientId}/biomarkers`, { biomarker_type: 'systolic_bp', value: Number(systolic), timestamp: ts }));
            if (diastolic) calls.push(api.post(`/patient/${patientId}/biomarkers`, { biomarker_type: 'diastolic_bp', value: Number(diastolic), timestamp: ts }));
            if (glucose) calls.push(api.post(`/patient/${patientId}/biomarkers`, { biomarker_type: 'fasting_glucose', value: Number(glucose), timestamp: ts }));
            await Promise.all(calls);
            setSaved(true);
            setSystolic('');
            setDiastolic('');
            setGlucose('');
            setTimeout(() => setSaved(false), 3000);
        } catch {
            // silent fail
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Activity size={20} color="var(--blue-primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Quick Reading Entry</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>SYSTOLIC (mmHg)</label>
                    <input
                        className="input"
                        type="number"
                        placeholder="e.g. 128"
                        value={systolic}
                        onChange={(e) => setSystolic(e.target.value)}
                    />
                </div>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>DIASTOLIC (mmHg)</label>
                    <input
                        className="input"
                        type="number"
                        placeholder="e.g. 84"
                        value={diastolic}
                        onChange={(e) => setDiastolic(e.target.value)}
                    />
                </div>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>GLUCOSE (mg/dL)</label>
                    <input
                        className="input"
                        type="number"
                        placeholder="e.g. 108"
                        value={glucose}
                        onChange={(e) => setGlucose(e.target.value)}
                    />
                </div>
            </div>

            <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || (!systolic && !diastolic && !glucose)}
                style={{ width: '100%', opacity: saving || (!systolic && !diastolic && !glucose) ? 0.6 : 1 }}
            >
                {saved ? (
                    <><CheckCircle2 size={16} /> Saved!</>
                ) : saving ? (
                    'Saving...'
                ) : (
                    <><Save size={16} /> Save Reading</>
                )}
            </button>
        </div>
    );
}
