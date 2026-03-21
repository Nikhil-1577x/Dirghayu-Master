import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Trash2, UserRound, Clock3 } from 'lucide-react';
import {
  addAbhaPatientToPanel,
  listAbhaPanelPatients,
  lookupAbhaPatient,
  removeAbhaPatientFromPanel,
  type AbhaPatient,
} from '../api/endpoints';

interface PatientManagerProps {
  selectedAbhaId?: string | null;
  onSelectPatient?: (abhaId: string) => void;
}

export default function PatientManager({ selectedAbhaId = null, onSelectPatient }: PatientManagerProps) {
  const [abhaInput, setAbhaInput] = useState('');
  const [lookupResult, setLookupResult] = useState<AbhaPatient | null>(null);
  const [panelPatients, setPanelPatients] = useState<AbhaPatient[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const loadPanel = async () => {
    const panel = await listAbhaPanelPatients();
    setPanelPatients(panel.patients || []);
  };

  useEffect(() => {
    loadPanel().catch(() => setError('Failed to load ABHA panel'));
  }, []);

  const filteredPanel = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return panelPatients;
    return panelPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.abha_id.toLowerCase().includes(q) ||
        p.conditions.some((c) => c.toLowerCase().includes(q))
    );
  }, [panelPatients, query]);

  const doLookup = async () => {
    const id = abhaInput.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const patient = await lookupAbhaPatient(id);
      setLookupResult(patient);
      onSelectPatient?.(patient.abha_id);
    } catch (e) {
      setLookupResult(null);
      setError(e instanceof Error ? e.message : 'ABHA lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const addToPanel = async (id: string) => {
    setError('');
    setNotice('');
    try {
      await addAbhaPatientToPanel(id);
      await loadPanel();
      setNotice(`${id} added to panel`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add patient');
    }
  };

  const removeFromPanel = async (id: string) => {
    setError('');
    setNotice('');
    try {
      await removeAbhaPatientFromPanel(id);
      await loadPanel();
      setNotice(`${id} removed from panel`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove patient');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>ABHA Patient Manager</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={abhaInput}
          onChange={(e) => setAbhaInput(e.target.value)}
          placeholder="Enter ABHA ID (e.g. ABHA-1001)"
          style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', width: '100%', fontSize: 13 }}
        />
        <button className="btn btn-primary" onClick={doLookup} disabled={loading}>
          <Search size={14} /> Lookup
        </button>
      </div>

      {lookupResult && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12, background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{lookupResult.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {lookupResult.abha_id} · Age {lookupResult.age} · {lookupResult.gender} · {lookupResult.blood_group}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => addToPanel(lookupResult.abha_id)}>
                <Plus size={14} /> Add to My Panel
              </button>
              <button className="btn" onClick={() => removeFromPanel(lookupResult.abha_id)}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {lookupResult.conditions.map((c) => (
              <span key={c} className="badge badge-red">{c}</span>
            ))}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {lookupResult.allergies.map((a) => (
              <span key={a} className="badge badge-amber">{a}</span>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Clinical Timeline</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lookupResult.history.map((h, idx) => (
                <div key={`${h.date}-${idx}`} style={{ fontSize: 12, color: 'var(--text-secondary)', borderLeft: '2px solid rgba(59,130,246,0.35)', paddingLeft: 8 }}>
                  <span style={{ fontWeight: 700 }}>{h.date}</span> · {h.event} · {h.hospital}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Search size={14} color="var(--text-muted)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search added panel patients"
          style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent', fontSize: 13 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
        {filteredPanel.map((p) => {
          const active = selectedAbhaId === p.abha_id;
          return (
            <div key={p.abha_id} style={{ border: `1px solid ${active ? 'rgba(59,130,246,0.45)' : 'var(--border)'}`, background: active ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
                <button onClick={() => onSelectPatient?.(p.abha_id)} style={{ border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserRound size={15} />
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {p.abha_id} · Age {p.age}
                  </div>
                </button>
                <button onClick={() => removeFromPanel(p.abha_id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(error || notice) && (
        <div style={{ marginTop: 10, fontSize: 12, color: error ? '#dc2626' : '#2563eb' }}>
          {error || notice}
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Clock3 size={13} /> In-memory ABHA registry and shared panel is active
      </div>
    </div>
  );
}
