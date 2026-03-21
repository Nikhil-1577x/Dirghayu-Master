import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight, Sparkles, MessageCircle } from 'lucide-react';
import { useApiStore } from '../store';
import ChatWindow from '../components/ChatWindow';
import MedicineStatusCard from '../components/MedicineStatusCard';
import RiskScoreGauge from '../components/RiskScoreGauge';
import BiomarkerChart from '../components/BiomarkerChart';
import AdherenceHeatmap from '../components/AdherenceHeatmap';
import LiveHardwareDispenser from '../components/LiveHardwareDispenser';
import LiveActivityFeed from '../components/LiveActivityFeed';
import AlertsPanel from '../components/AlertsPanel';
import AppointmentCard from '../components/AppointmentCard';
import DeteriorationSignals from '../components/DeteriorationSignals';
import QuickReadingInput from '../components/QuickReadingInput';
import DietExerciseCard from '../components/DietExerciseCard';


function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const patientId = useApiStore((s) => s.patientId);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 48 }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)',
          border: '1px solid rgba(5, 150, 105, 0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 24,
          animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          boxShadow: '0 2px 12px rgba(5, 150, 105, 0.08)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={18} color="var(--accent-primary)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', letterSpacing: '0.04em' }}>
              WELCOME BACK
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 4, lineHeight: 1.2 }}>
            {getGreeting()}!
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {format(new Date(), "EEEE, MMMM d, yyyy")} · Here's your patient overview
          </p>
        </div>
        <Link
          to="/medications"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '12px 20px',
            background: 'var(--accent-muted)',
            border: '1px solid var(--accent-border)',
            borderRadius: 12,
            color: 'var(--accent-primary)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.2s ease',
          }}
        >
          View Schedule <ChevronRight size={18} strokeWidth={2.5} />
        </Link>
      </div>

      <div style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.05s forwards', opacity: 0 }}>
        <MedicineStatusCard />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards',
          opacity: 0,
        }}
      >
        <RiskScoreGauge />
        <AppointmentCard />
        <LiveActivityFeed />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 24,
          animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards',
          opacity: 0,
        }}
      >
        <LiveHardwareDispenser />
        <AlertsPanel />
      </div>

      <div style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards', opacity: 0 }}>
        <BiomarkerChart />
      </div>

      <div style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.25s forwards', opacity: 0 }}>
        <AdherenceHeatmap />
      </div>

      <div style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards', opacity: 0 }}>
        <QuickReadingInput />
      </div>

      <div style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards', opacity: 0 }}>
        <DietExerciseCard />
      </div>

      <div style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards', opacity: 0 }}>
        <DeteriorationSignals />
      </div>

      {patientId != null && patientId > 0 && (
        <>
          <button
            type="button"
            aria-label="Open chat with doctor"
            onClick={() => setChatOpen(true)}
            style={{
              position: 'fixed',
              right: 24,
              bottom: 24,
              zIndex: 60,
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: '1px solid var(--accent-border, rgba(5,150,105,0.35))',
              background: 'var(--accent-primary, #059669)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(5,150,105,0.35)',
            }}
          >
            <MessageCircle size={24} strokeWidth={2} />
          </button>

          {chatOpen && (
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
              onClick={() => setChatOpen(false)}
            >
              <div style={{ width: 'min(440px, 100%)', maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
                <ChatWindow
                  patientId={patientId}
                  selfRole="caretaker"
                  peerRole="doctor"
                  title="Chat · Doctor"
                  onClose={() => setChatOpen(false)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
