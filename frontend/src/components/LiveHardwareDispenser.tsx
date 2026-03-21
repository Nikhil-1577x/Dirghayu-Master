import { useMemo, useEffect } from 'react';
import { Cpu, Clock3, Pill, Activity, AlertTriangle } from 'lucide-react';
import { useIotStore, useWSStore } from '../store';
import { getIotDispenserStatus } from '../api/endpoints';
import { useApiStore } from '../store';

function asLocal(ts: string | null): string {
  if (!ts) return '--:--';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

export default function LiveHardwareDispenser() {
  const patientId = useApiStore((s) => s.patientId);
  const status = useIotStore((s) => s.dispenser);
  const setSnapshot = useIotStore((s) => s.setSnapshot);
  const wsState = useWSStore((s) => s.status);

  // Poll actual RTC from hardware every second when device is connected
  useEffect(() => {
    if (!patientId || status?.device_status !== 'connected') return;
    const id = setInterval(async () => {
      try {
        const dispenser = await getIotDispenserStatus(patientId);
        setSnapshot({ dispenser });
      } catch {}
    }, 1000);
    return () => clearInterval(id);
  }, [patientId, status?.device_status, setSnapshot]);

  const isConnected = status?.device_status === 'connected';
  const deviceBadge = !status || !isConnected ? 'OFFLINE' : status.alert ? 'ALERT' : 'IDLE';
  const headline = useMemo(() => {
    if (wsState === 'reconnecting') return 'Reconnecting to hardware...';
    if (!status || !isConnected) return 'Device Offline';
    if (status.alert) return 'Hardware alert active';
    return 'Realtime dispenser feed';
  }, [isConnected, status, wsState]);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
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
          <Cpu size={22} color="var(--accent-primary)" strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Live Hardware Dispenser</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{headline}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock3 size={17} color="#64748b" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>System Time (RTC)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{status?.rtc_time ?? '--:--:--'}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Clock3 size={14} color="#94a3b8" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Pill size={17} color="#64748b" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Active Dose Slot</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Scheduled for: {status?.scheduled_time || '--:--'}
              </div>
            </div>
          </div>
          <span className="badge badge-blue">{deviceBadge}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 12, background: status?.alert ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: status?.alert ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {status?.alert ? <AlertTriangle size={17} color="#ef4444" /> : <Activity size={17} color="#10b981" />}
            <div style={{ fontSize: 13, fontWeight: 600 }}>{status?.alert ? 'Alert Active' : 'System Normal'}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Last dose: {status?.last_medication_name || '--'} · {asLocal(status?.last_dispensed_time ?? null)}
          </div>
        </div>
      </div>
    </div>
  );
}

