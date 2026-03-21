import { useNavigate } from 'react-router-dom';
import { useRoleStore, type UserRole } from '../store';
import { Heart, Stethoscope, Users, ShieldCheck, ArrowRight } from 'lucide-react';

type RoleKey = Exclude<UserRole, null>;

const ROLES: {
  key: RoleKey;
  label: string;
  description: string;
  stats: string;
  themeColor: string;
  themeColorRGB: string;
  iconBg: string;
  icon: typeof Heart;
  imageUrl: string;
  path: string;
}[] = [
  {
    key: 'caretaker',
    label: 'Caretaker',
    description: "Family member monitoring a loved one's health journey",
    stats: '24/7 Monitoring • Real-time Alerts • Medication Tracking',
    themeColor: '160 84% 39%',
    themeColorRGB: '5, 150, 105',
    iconBg: 'linear-gradient(135deg, #059669, #047857)',
    icon: Heart,
    imageUrl:
      'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?q=80&w=2078&auto=format&fit=crop',
    path: '/caretaker',
  },
  {
    key: 'doctor',
    label: 'Doctor',
    description: 'Clinical oversight with AI-powered risk intelligence',
    stats: 'Patient Analytics • Risk Scores • Lab Reports',
    themeColor: '221 83% 53%',
    themeColorRGB: '59, 130, 246',
    iconBg: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    icon: Stethoscope,
    imageUrl:
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=2070&auto=format&fit=crop',
    path: '/doctor',
  },
  {
    key: 'cho',
    label: 'Community Health Officer',
    description: 'Field-level tracking for high-risk communities',
    stats: 'Field Visits • Patient Outreach • Regional Data',
    themeColor: '262 83% 58%',
    themeColorRGB: '139, 92, 246',
    iconBg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    icon: Users,
    imageUrl:
      'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?q=80&w=2072&auto=format&fit=crop',
    path: '/cho',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const setRole = useRoleStore((s) => s.setRole);

  const select = (key: RoleKey, path: string) => {
    setRole(key);
    navigate(path);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 40%, #f1f5f9 100%)',
        padding: '40px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(5,150,105,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-30%',
          right: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo & Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 8,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(5,150,105,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          <Heart size={26} color="white" fill="white" />
        </div>
        <div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.03em',
            }}
          >
            Dirghayu
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#64748b',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            NCD Care Platform
          </div>
        </div>
      </div>

      <p
        style={{
          fontSize: 16,
          color: '#94a3b8',
          marginBottom: 48,
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        Select your role to continue
      </p>

      {/* Cards: single horizontal row — left | center | right with gaps */}
      <div className="login-role-row relative z-[1]">
        {ROLES.map((r, i) => {
          const Icon = r.icon;
          const isCenter = i === 1;
          const idleShadow = `0 4px 40px rgba(${r.themeColorRGB}, 0.15), 0 0 0 1px rgba(0,0,0,0.04)`;
          const hoverShadow = `0 20px 60px rgba(${r.themeColorRGB}, 0.3), 0 0 0 1px rgba(0,0,0,0.06)`;

          return (
            <div
              key={r.key}
              className={isCenter ? 'login-role-card-wrap login-role-card-wrap--center' : 'login-role-card-wrap'}
            >
            <button
              type="button"
              onClick={() => select(r.key, r.path)}
              style={{
                cursor: 'pointer',
                position: 'relative',
                borderRadius: 20,
                overflow: 'hidden',
                height: 'min(440px, 58svh)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                animation: `fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.12}s both`,
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease',
                boxShadow: idleShadow,
                border: 'none',
                padding: 0,
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                e.currentTarget.style.boxShadow = hoverShadow;
                const img = e.currentTarget.querySelector('.card-bg') as HTMLElement | null;
                if (img) img.style.transform = 'scale(1.08)';
                const btn = e.currentTarget.querySelector('.card-cta') as HTMLElement | null;
                if (btn) {
                  btn.style.background = `rgba(${r.themeColorRGB}, 0.35)`;
                  btn.style.borderColor = `rgba(${r.themeColorRGB}, 0.5)`;
                }
                const arrow = e.currentTarget.querySelector('.card-arrow') as HTMLElement | null;
                if (arrow) arrow.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = idleShadow;
                const img = e.currentTarget.querySelector('.card-bg') as HTMLElement | null;
                if (img) img.style.transform = 'scale(1)';
                const btn = e.currentTarget.querySelector('.card-cta') as HTMLElement | null;
                if (btn) {
                  btn.style.background = `rgba(${r.themeColorRGB}, 0.15)`;
                  btn.style.borderColor = `rgba(${r.themeColorRGB}, 0.25)`;
                }
                const arrow = e.currentTarget.querySelector('.card-arrow') as HTMLElement | null;
                if (arrow) arrow.style.transform = 'translateX(0)';
              }}
            >
              <div
                className="card-bg"
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${r.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(to top, 
                    hsl(${r.themeColor} / 0.95) 0%, 
                    hsl(${r.themeColor} / 0.7) 25%,
                    hsl(${r.themeColor} / 0.3) 50%, 
                    transparent 75%)`,
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: r.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 16px rgba(${r.themeColorRGB}, 0.4), inset 0 1px 0 rgba(255,255,255,0.15)`,
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <Icon size={22} color="white" strokeWidth={2.5} />
              </div>

              <div
                style={{
                  position: 'relative',
                  padding: '0 24px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <h3
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: 'white',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    textShadow: '0 2px 12px rgba(0,0,0,0.3)',
                    margin: 0,
                  }}
                >
                  {r.label}
                </h3>

                <p
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.75)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {r.description}
                </p>

                <p
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.02em',
                    fontWeight: 500,
                    margin: '2px 0 0',
                  }}
                >
                  {r.stats}
                </p>

                <div
                  className="card-cta"
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: `rgba(${r.themeColorRGB}, 0.15)`,
                    backdropFilter: 'blur(12px)',
                    border: `1px solid rgba(${r.themeColorRGB}, 0.25)`,
                    borderRadius: 12,
                    padding: '12px 16px',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'white',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Enter Dashboard
                  </span>
                  <ArrowRight
                    className="card-arrow"
                    size={16}
                    color="white"
                    style={{ transition: 'transform 0.3s ease' }}
                  />
                </div>
              </div>
            </button>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 48,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <ShieldCheck size={14} color="#94a3b8" />
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
          HIPAA Compliant • End-to-end Encrypted
        </span>
        <span style={{ fontSize: 12, color: '#cbd5e1', margin: '0 4px' }}>•</span>
        <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
          Demo mode — no password required
        </span>
      </div>
    </div>
  );
}
