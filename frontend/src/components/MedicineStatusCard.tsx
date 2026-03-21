import { usePatientStore } from '../store';

export default function MedicineStatusCard() {
  const { overallMedicineStatus, lastDoseTime } = usePatientStore();

  const statusLabel =
    overallMedicineStatus === 'taken'
      ? 'Taken'
      : overallMedicineStatus === 'missed'
        ? 'Missed'
        : 'Pending';

  const statusColor =
    overallMedicineStatus === 'taken'
      ? '#10b981'
      : overallMedicineStatus === 'missed'
        ? '#ef4444'
        : '#f59e0b';

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.03) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Last dose
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
        {lastDoseTime ?? '—'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Status:{' '}
        <span style={{ fontWeight: 700, color: statusColor }}>{statusLabel}</span>
      </div>
    </div>
  );
}
