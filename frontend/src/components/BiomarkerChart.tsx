import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useApiStore } from '../store';
import { Activity } from 'lucide-react';

const PERIODS = [
  { label: 'Auto', value: 'auto' as const },
  { label: '7D', value: 7 as const },
  { label: '30D', value: 30 as const },
  { label: '90D', value: 90 as const },
];

const METRIC_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#6366f1'];
const METRIC_THRESHOLDS: Record<string, number> = {
  systolic: 130,
  systolic_bp: 130,
  diastolic: 90,
  diastolic_bp: 90,
  heartRate: 100,
  heart_rate: 100,
  glucose: 140,
  glucose_postprandial: 180,
  glucosePostprandial: 180,
  hba1c: 6.5,
};

const prettyMetricName = (key: string) => {
  const known: Record<string, string> = {
    systolic: 'Systolic BP',
    systolic_bp: 'Systolic BP',
    diastolic: 'Diastolic BP',
    diastolic_bp: 'Diastolic BP',
    heartRate: 'Heart Rate',
    heart_rate: 'Heart Rate',
    glucose: 'Glucose',
    glucose_postprandial: 'Glucose PP',
    glucosePostprandial: 'Glucose PP',
    hba1c: 'HbA1c',
  };
  if (known[key]) return known[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 16px',
        fontSize: 13,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
      }}
    >
      <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 12, justifyContent: 'space-between', marginBottom: 4 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function BiomarkerChart() {
  const [period, setPeriod] = useState<'auto' | 7 | 30 | 90>('auto');
  const [activeMetrics, setActiveMetrics] = useState<string[]>([]);
  const apiBiomarkers = useApiStore((s) => s.biomarkers);

  const effectivePeriod = useMemo(() => {
    if (period !== 'auto') return period;
    if (!apiBiomarkers.length) return 0;
    return apiBiomarkers.length > 30 ? 30 : apiBiomarkers.length;
  }, [apiBiomarkers.length, period]);

  const data = useMemo(() => {
    if (!apiBiomarkers.length) return [];
    if (!effectivePeriod) return [];
    return apiBiomarkers.slice(-effectivePeriod);
  }, [apiBiomarkers, effectivePeriod]);

  const metricKeys = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      Object.entries(row as unknown as Record<string, unknown>).forEach(([k, v]) => {
        if (k === 'date' || k === 'timestamp') return;
        if (Number.isFinite(Number(v))) set.add(k);
      });
    });
    return Array.from(set);
  }, [data]);

  const metrics = useMemo(
    () =>
      metricKeys.map((key, idx) => ({
        key,
        name: prettyMetricName(key),
        color: METRIC_COLORS[idx % METRIC_COLORS.length],
        threshold: METRIC_THRESHOLDS[key],
      })),
    [metricKeys]
  );

  const metricHasData = useMemo(() => {
    const out: Record<string, boolean> = {};
    metrics.forEach((m) => {
      out[m.key] = data.some((row) => Number.isFinite(Number((row as unknown as Record<string, unknown>)[m.key])));
    });
    return out;
  }, [data, metrics]);

  useEffect(() => {
    const available = metrics.filter((m) => metricHasData[m.key]).map((m) => m.key);
    if (!available.length) {
      setActiveMetrics([]);
      return;
    }
    setActiveMetrics((prev) => {
      const kept = prev.filter((k) => available.includes(k));
      if (kept.length) return kept;

      const defaultPreferred = ['glucose', 'glucose_postprandial', 'hba1c', 'glucose_random'];
      const preferredAvailable = defaultPreferred.filter((k) => available.includes(k));
      return preferredAvailable.length ? preferredAvailable : available;
    });
  }, [metricHasData, metrics]);

  const displayData = data.map((d) => {
    const ts = (d as unknown as { timestamp?: string }).timestamp;
    const label = ts ? ts.slice(5, 16).replace('T', ' ') : d.date.slice(5);
    return { ...d, label };
  });

  const thresholds = metrics.filter((m) => activeMetrics.includes(m.key) && Number.isFinite(Number(m.threshold)));

  const toggleMetric = (key: string) => {
    if (!metricHasData[key]) return;
    setActiveMetrics((prev) => (prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key]));
  };

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'var(--accent-muted)',
              border: '1px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity size={22} color="var(--accent-primary)" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Biomarker Timeline</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Clinical trends over time</div>
          </div>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
          {PERIODS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setPeriod(value)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: period === value ? 'var(--accent-primary)' : 'transparent',
                color: period === value ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {metrics.map(({ key, name, color }) => (
          <button
            key={key}
            onClick={() => toggleMetric(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 9999,
              border: `1px solid ${activeMetrics.includes(key) ? `${color}60` : 'var(--border)'}`,
              fontSize: 12,
              fontWeight: 600,
              cursor: metricHasData[key] ? 'pointer' : 'not-allowed',
              background: activeMetrics.includes(key) ? `${color}15` : 'transparent',
              color: activeMetrics.includes(key) ? color : 'var(--text-muted)',
              opacity: metricHasData[key] ? 1 : 0.45,
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
            }}
            disabled={!metricHasData[key]}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: activeMetrics.includes(key) ? color : 'var(--text-muted)',
              }}
            />
            {name}
          </button>
        ))}
      </div>

      {!displayData.length ? (
        <div
          style={{
            height: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
            border: '1px dashed var(--border)',
            borderRadius: 12,
          }}
        >
          No biomarker history found in database for the selected patient.
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={displayData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid stroke="rgba(0, 0, 0, 0.06)" strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(data.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {thresholds.map(
            ({ key, threshold, color, name }) =>
              activeMetrics.includes(key) && (
                <ReferenceLine
                  key={`ref-${key}`}
                  y={threshold}
                  stroke={color}
                  strokeDasharray="6 4"
                  strokeWidth={1.2}
                  strokeOpacity={0.5}
                  label={{ value: `${name} limit`, fill: color, fontSize: 10, position: 'insideBottomRight' }}
                />
              )
          )}
          {metrics.filter((m) => activeMetrics.includes(m.key)).map(({ key, name, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stroke={color}
              strokeWidth={2.5}
              dot={displayData.length <= 2}
              activeDot={{ r: 5, strokeWidth: 0, fill: color }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
