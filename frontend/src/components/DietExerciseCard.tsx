import { useEffect, useMemo, useState } from 'react';
import { Salad, Dumbbell, Footprints, Timer, Flame, Lightbulb } from 'lucide-react';
import { useApiStore } from '../store';
import { getDietSummary, getExerciseSummary, type DietSummary, type ExerciseSummary } from '../api/endpoints';

export default function DietExerciseCard() {
    const patientId = useApiStore((s) => s.patientId);
    const [diet, setDiet] = useState<DietSummary | null>(null);
    const [exercise, setExercise] = useState<ExerciseSummary | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!patientId) return;
        let active = true;
        setLoading(true);
        Promise.all([getDietSummary(patientId), getExerciseSummary(patientId)])
            .then(([d, e]) => {
                if (!active) return;
                setDiet(d);
                setExercise(e);
            })
            .catch(() => {
                if (!active) return;
                setDiet(null);
                setExercise(null);
            })
            .finally(() => {
                if (!active) return;
                setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [patientId]);

    const dietRows = useMemo(
        () => [
            { label: 'Calories', value: diet?.calories ?? 0, unit: 'kcal', pct: Math.min(100, Math.round(((diet?.calories ?? 0) / 2200) * 100)), color: '#059669' },
            { label: 'Sodium', value: diet?.sodium ?? 0, unit: 'g', pct: Math.min(100, Math.round(((diet?.sodium ?? 0) / 2.3) * 100)), color: '#f59e0b' },
            { label: 'Carbohydrates', value: diet?.carbs ?? 0, unit: 'g', pct: Math.min(100, Math.round(((diet?.carbs ?? 0) / 260) * 100)), color: '#3b82f6' },
            { label: 'Protein', value: diet?.protein ?? 0, unit: 'g', pct: Math.min(100, Math.round(((diet?.protein ?? 0) / 80) * 100)), color: '#8b5cf6' },
        ],
        [diet]
    );

    const exRows = useMemo(
        () => [
            { label: 'Steps Today', value: exercise?.steps ?? 0, unit: 'steps', IconComp: Footprints },
            { label: 'Active Duration', value: exercise?.active_minutes ?? 0, unit: 'min', IconComp: Timer },
            { label: 'Calories Burned', value: exercise?.calories_burned ?? 0, unit: 'kcal', IconComp: Flame },
        ],
        [exercise]
    );

    const shortDietNote = useMemo(() => {
        const raw = (diet?.ai_summary || diet?.narrative || diet?.suggestions?.[0] || '').trim();
        if (!raw) return '';
        const firstSentence = raw.split(/(?<=[.!?])\s+/)[0] || raw;
        return firstSentence.length > 160 ? `${firstSentence.slice(0, 157).trim()}...` : firstSentence;
    }, [diet]);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Diet */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Salad size={20} color="#059669" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Today's Diet</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading diet summary...</div>}
                    {!loading && dietRows.map((d) => (
                        <div key={d.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{d.label}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{d.value} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{d.unit}</span></span>
                            </div>
                            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${d.pct}%`, borderRadius: 3, background: d.color, transition: 'width 0.6s ease' }} />
                            </div>
                        </div>
                    ))}
                    {!loading && shortDietNote ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                            {shortDietNote}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Exercise */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Dumbbell size={20} color="#3b82f6" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Exercise Log</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading exercise summary...</div>}
                    {!loading && exRows.map((ex) => {
                        const ExIcon = ex.IconComp;
                        return (
                            <div key={ex.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <ExIcon size={18} color="#3b82f6" />
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{ex.label}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{ex.value}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{ex.unit}</span>
                                </div>
                            </div>
                        );
                    })}
                    <div style={{ marginTop: 4, padding: '10px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, fontSize: 12, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Lightbulb size={14} /> {exercise?.goal_message || 'No activity guidance available yet.'}
                    </div>
                </div>
            </div>
        </div>
    );
}
