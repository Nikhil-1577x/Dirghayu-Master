import { Salad, Dumbbell, Footprints, Timer, Flame, Lightbulb } from 'lucide-react';

interface DietEntry { label: string; value: string; unit: string; pct: number; color: string }
interface ExerciseEntry { label: string; value: string; unit: string; IconComp: typeof Footprints }

const DIET: DietEntry[] = [
    { label: 'Calories', value: '1,420', unit: 'kcal', pct: 71, color: '#059669' },
    { label: 'Sodium', value: '1.8', unit: 'g', pct: 78, color: '#f59e0b' },
    { label: 'Carbohydrates', value: '145', unit: 'g', pct: 55, color: '#3b82f6' },
    { label: 'Protein', value: '62', unit: 'g', pct: 82, color: '#8b5cf6' },
];

const EXERCISE: ExerciseEntry[] = [
    { label: 'Steps Today', value: '4,320', unit: 'steps', IconComp: Footprints },
    { label: 'Active Duration', value: '28', unit: 'min', IconComp: Timer },
    { label: 'Calories Burned', value: '210', unit: 'kcal', IconComp: Flame },
];

export default function DietExerciseCard() {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Diet */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Salad size={20} color="#059669" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Today's Diet</h3>
                    <span className="badge badge-accent" style={{ marginLeft: 'auto' }}>Mock</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {DIET.map((d) => (
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
                </div>
            </div>

            {/* Exercise */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Dumbbell size={20} color="#3b82f6" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Exercise Log</h3>
                    <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>Mock</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {EXERCISE.map((ex) => {
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
                        <Lightbulb size={14} /> Goal: 7,000 steps / day — Keep it up!
                    </div>
                </div>
            </div>
        </div>
    );
}
