import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, UserMinus, Loader2, AlertCircle, CheckCircle2, Shield, MapPin, Clock, Pill, X } from 'lucide-react';

interface AbhaPatient {
    abha_id: string;
    name: string;
    age: number;
    gender: string;
    blood_group: string;
    address: string;
    phone: string;
    conditions: string[];
    allergies: string[];
    history: { date: string; event: string; facility: string }[];
    is_registered?: boolean;
}

interface PatientManagerProps {
    themeColor?: string;       // e.g. '#3b82f6' for Doctor, '#8b5cf6' for CHO
    themeColorRGB?: string;    // e.g. '59,130,246'
    onPatientsChange?: () => void;
}

export default function PatientManager({ themeColor = '#3b82f6', themeColorRGB = '59,130,246', onPatientsChange }: PatientManagerProps) {
    const [abhaInput, setAbhaInput] = useState('');
    const [lookupResult, setLookupResult] = useState<AbhaPatient | null>(null);
    const [registeredPatients, setRegisteredPatients] = useState<AbhaPatient[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchRegistered = useCallback(async () => {
        try {
            const res = await fetch('/abha/patients');
            const data = await res.json();
            setRegisteredPatients(data.patients || []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchRegistered(); }, [fetchRegistered]);

    const handleLookup = async () => {
        const id = abhaInput.trim();
        if (!id) return;
        setLoading(true);
        setError('');
        setSuccess('');
        setLookupResult(null);
        try {
            const res = await fetch(`/abha/lookup/${encodeURIComponent(id)}`);
            if (!res.ok) {
                const data = await res.json();
                setError(data.detail || 'Patient not found in ABHA registry');
                return;
            }
            const patient = await res.json();
            setLookupResult(patient);
        } catch {
            setError('Failed to connect to ABHA registry');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (abhaId: string) => {
        try {
            const res = await fetch(`/abha/patients/${encodeURIComponent(abhaId)}`, { method: 'POST' });
            if (res.ok) {
                setSuccess('Patient added to your panel');
                setLookupResult(null);
                setAbhaInput('');
                await fetchRegistered();
                onPatientsChange?.();
            } else {
                const data = await res.json();
                setError(data.detail || 'Failed to add patient');
            }
        } catch {
            setError('Network error');
        }
    };

    const handleRemove = async (abhaId: string) => {
        try {
            const res = await fetch(`/abha/patients/${encodeURIComponent(abhaId)}`, { method: 'DELETE' });
            if (res.ok) {
                setSuccess('Patient removed from your panel');
                setLookupResult(null);
                await fetchRegistered();
                onPatientsChange?.();
            }
        } catch {
            setError('Network error');
        }
    };

    return (
        <div>
            {/* ABHA Lookup */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Shield size={18} color={themeColor} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>ABHA Patient Lookup</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            value={abhaInput}
                            onChange={(e) => { setAbhaInput(e.target.value); setError(''); setSuccess(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                            placeholder="Enter ABHA ID (e.g. ABHA-2001)"
                            style={{
                                width: '100%', padding: '12px 14px 12px 42px', borderRadius: 12,
                                border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit',
                                outline: 'none', transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = themeColor}
                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'}
                        />
                    </div>
                    <button
                        onClick={handleLookup}
                        disabled={loading || !abhaInput.trim()}
                        style={{
                            padding: '12px 20px', borderRadius: 12, border: 'none',
                            background: themeColor, color: 'white', fontWeight: 600, fontSize: 14,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            fontFamily: 'inherit', opacity: loading || !abhaInput.trim() ? 0.5 : 1,
                            boxShadow: `0 4px 12px rgba(${themeColorRGB}, 0.3)`,
                        }}
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        Lookup
                    </button>
                </div>

                {/* Quick ABHA IDs hint */}
                <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                    Try: ABHA-1001 · ABHA-2001 · ABHA-2002 · ABHA-2003
                </div>

                {/* Error / Success */}
                {error && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}
                {success && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', color: '#047857', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={16} /> {success}
                    </div>
                )}
            </div>

            {/* Lookup Result Card */}
            {lookupResult && (
                <div style={{ marginBottom: 24, background: `rgba(${themeColorRGB}, 0.03)`, border: `1.5px solid rgba(${themeColorRGB}, 0.2)`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: themeColor, marginBottom: 4 }}>ABHA RECORD</div>
                            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>{lookupResult.name}</h3>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                                {lookupResult.age}yrs · {lookupResult.gender} · {lookupResult.blood_group}
                            </div>
                        </div>
                        <div style={{ padding: '6px 14px', borderRadius: 8, background: themeColor, color: 'white', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>
                            {lookupResult.abha_id}
                        </div>
                    </div>

                    {/* Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={14} /> {lookupResult.address}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                            📞 {lookupResult.phone}
                        </div>
                    </div>

                    {/* Conditions & Allergies */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {lookupResult.conditions.map(c => (
                            <span key={c} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontWeight: 600, border: '1px solid rgba(239,68,68,0.15)' }}>{c}</span>
                        ))}
                        {lookupResult.allergies.map(a => (
                            <span key={a} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.08)', color: '#b45309', fontWeight: 600, border: '1px solid rgba(245,158,11,0.15)' }}>⚠ {a}</span>
                        ))}
                    </div>

                    {/* Medical History Timeline */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={14} /> Medical History
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {lookupResult.history.map((h, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                                    <div style={{ width: 80, flexShrink: 0, color: '#94a3b8', fontWeight: 500 }}>{h.date}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: '#0f172a', fontWeight: 500 }}>{h.event}</div>
                                        <div style={{ color: '#94a3b8', fontSize: 11 }}>{h.facility}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Button */}
                    {lookupResult.is_registered ? (
                        <button onClick={() => handleRemove(lookupResult.abha_id)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <UserMinus size={16} /> Remove from Panel
                        </button>
                    ) : (
                        <button onClick={() => handleAdd(lookupResult.abha_id)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: themeColor, color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 12px rgba(${themeColorRGB}, 0.3)` }}>
                            <UserPlus size={16} /> Add to My Panel
                        </button>
                    )}
                </div>
            )}

            {/* Registered Patients List */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Pill size={16} color={themeColor} /> Registered Patients
                    </div>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{registeredPatients.length} patients</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {registeredPatients.map((p) => (
                        <div key={p.abha_id} style={{
                            background: 'white', borderRadius: 14, padding: '14px 16px',
                            border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            display: 'flex', alignItems: 'center', gap: 14,
                        }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: `rgba(${themeColorRGB}, 0.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, fontWeight: 700, color: themeColor }}>
                                {p.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.abha_id} · {p.age}yrs · {p.conditions[0]}</div>
                            </div>
                            <button
                                onClick={() => handleRemove(p.abha_id)}
                                title="Remove patient"
                                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.04)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    {registeredPatients.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: 13 }}>
                            No patients registered. Use the search above to find and add patients via ABHA ID.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
