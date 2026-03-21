import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Home, AlertTriangle, Calendar, Settings, LogOut, Users,
    Activity, Pill, CheckCircle2, Globe, RefreshCw, Heart,
    MapPin, Clock, ChevronRight, TrendingUp, Bell, UserPlus
} from 'lucide-react';
import { useRoleStore } from '../store';
import PatientManager from '../components/PatientManager';

type Tab = 'home' | 'highrisk' | 'visits' | 'patients' | 'settings';

const HIGH_RISK_PATIENTS = [
    { id: 1, name: 'Kamla Bai', age: 63, village: 'Paithan', risk: 98, conditions: 'Diabetes + CKD', lastVisit: '12 days ago', alerts: 3 },
    { id: 2, name: 'Ramesh Kumar', age: 67, village: 'Aurangabad', risk: 87, conditions: 'Diabetes + Hypertension', lastVisit: '3 days ago', alerts: 2 },
    { id: 3, name: 'Arun Sharma', age: 72, village: 'Waluj', risk: 76, conditions: 'Diabetes', lastVisit: '1 week ago', alerts: 1 },
];

const TODAY_VISITS = [
    { id: 1, name: 'Ramesh Kumar', time: '10:00 AM', village: 'Aurangabad', type: 'BP Check', done: true },
    { id: 2, name: 'Kamla Bai', time: '12:30 PM', village: 'Paithan', type: 'Med Refill', done: false },
    { id: 3, name: 'Sunita Devi', time: '3:00 PM', village: 'Nanded Road', type: 'Glucose Test', done: false },
];

const HOME_STATS = [
    { label: 'Patients Visited', value: '4', icon: Users, color: '#059669', bg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.2)' },
    { label: 'Meds Dispensed', value: '12', icon: Pill, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
    { label: 'Active Alerts', value: '6', icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
    { label: 'Readings Logged', value: '8', icon: Activity, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
];

/* ---------- Responsive CSS via <style> tag ---------- */
const responsiveStyles = `
  .cho-root {
    min-height: 100vh;
    display: flex;
    background: #f8fafc;
  }

  /* ---- Sidebar (desktop only) ---- */
  .cho-sidebar {
    display: none;
  }
  @media (min-width: 768px) {
    .cho-sidebar {
      display: flex;
      flex-direction: column;
      width: 260px;
      min-height: 100vh;
      background: white;
      border-right: 1px solid rgba(0,0,0,0.06);
      position: fixed;
      top: 0; left: 0; bottom: 0;
      z-index: 40;
    }
  }

  /* ---- Main area ---- */
  .cho-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  @media (min-width: 768px) {
    .cho-main {
      margin-left: 260px;
    }
  }

  /* ---- Mobile Header ---- */
  .cho-mobile-header {
    display: block;
  }
  @media (min-width: 768px) {
    .cho-mobile-header { display: none; }
  }

  /* ---- Desktop Header ---- */
  .cho-desktop-header {
    display: none;
  }
  @media (min-width: 768px) {
    .cho-desktop-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 32px;
      background: white;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
  }

  /* ---- Content ---- */
  .cho-content {
    flex: 1;
    padding: 20px 16px 100px;
  }
  @media (min-width: 768px) {
    .cho-content {
      padding: 32px 40px 48px;
      max-width: 1200px;
    }
  }

  /* ---- Stat Grid ---- */
  .cho-stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (min-width: 768px) {
    .cho-stat-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
  }

  /* ---- Patient Cards Grid (desktop: 2-up) ---- */
  .cho-patients-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  @media (min-width: 768px) {
    .cho-patients-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
  }

  /* ---- Visits List (desktop: wider cards) ---- */
  .cho-visits-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  @media (min-width: 768px) {
    .cho-visits-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
  }

  /* ---- Settings Grid ---- */
  .cho-settings-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  @media (min-width: 768px) {
    .cho-settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
  }

  /* ---- Bottom Nav (mobile only) ---- */
  .cho-bottom-nav {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: white;
    border-top: 1px solid rgba(0,0,0,0.08);
    display: flex;
    padding: 8px 0 env(safe-area-inset-bottom);
    box-shadow: 0 -4px 24px rgba(0,0,0,0.08);
    z-index: 50;
  }
  @media (min-width: 768px) {
    .cho-bottom-nav { display: none; }
  }

  /* ---- Sidebar Nav Button ---- */
  .cho-nav-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 20px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 12px;
    transition: all 0.15s ease;
    font-size: 14px;
    font-weight: 500;
    color: #64748b;
    font-family: inherit;
    margin: 0 12px;
    width: calc(100% - 24px);
  }
  .cho-nav-btn:hover {
    background: rgba(139,92,246,0.06);
    color: #7c3aed;
  }
  .cho-nav-btn.active {
    background: rgba(139,92,246,0.1);
    color: #7c3aed;
    font-weight: 600;
  }

  /* ---- Next Visit Banner (desktop: horizontal) ---- */
  .cho-next-visit {
    margin-top: 20px;
    padding: 16px;
    border-radius: 14px;
  }
  @media (min-width: 768px) {
    .cho-next-visit {
      margin-top: 24px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }
`;

export default function CHODashboard() {
    const [tab, setTab] = useState<Tab>('home');
    const [lang, setLang] = useState<'en' | 'hi'>('en');
    const navigate = useNavigate();
    const setRole = useRoleStore((s) => s.setRole);

    const tabs = [
        { key: 'home' as Tab, label: lang === 'en' ? 'Home' : 'होम', icon: Home },
        { key: 'highrisk' as Tab, label: lang === 'en' ? 'High Risk' : 'जोखिम', icon: AlertTriangle },
        { key: 'visits' as Tab, label: lang === 'en' ? 'Visits' : 'दौरे', icon: Calendar },
        { key: 'patients' as Tab, label: lang === 'en' ? 'Patients' : 'मरीज़', icon: UserPlus },
        { key: 'settings' as Tab, label: lang === 'en' ? 'Settings' : 'सेटिंग', icon: Settings },
    ];

    return (
        <>
            <style>{responsiveStyles}</style>
            <div className="cho-root">
                {/* ========== SIDEBAR (Desktop) ========== */}
                <aside className="cho-sidebar">
                    {/* Sidebar Brand */}
                    <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                                <Heart size={20} color="white" fill="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Dirghayu</div>
                                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CHO Panel</div>
                            </div>
                        </div>
                    </div>

                    {/* User Info */}
                    <div style={{ padding: '20px 20px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Anita Pawar</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} /> Aurangabad Block • 18 patients
                        </div>
                    </div>

                    {/* Nav Items */}
                    <nav style={{ flex: 1, padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {tabs.map((t) => {
                            const Icon = t.icon;
                            return (
                                <button
                                    key={t.key}
                                    className={`cho-nav-btn ${tab === t.key ? 'active' : ''}`}
                                    onClick={() => setTab(t.key)}
                                >
                                    <Icon size={18} />
                                    <span>{t.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Sidebar Footer */}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                        <button
                            onClick={() => { setRole(null); navigate('/'); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit', fontWeight: 500 }}
                        >
                            <LogOut size={16} /> Switch Role
                        </button>
                    </div>
                </aside>

                {/* ========== MAIN ========== */}
                <div className="cho-main">
                    {/* Mobile Header */}
                    <div className="cho-mobile-header" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', padding: '20px 20px 24px', color: 'white' }}>
                        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>{lang === 'en' ? 'Community Health Officer' : 'सामुदायिक स्वास्थ्य अधिकारी'}</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>Anita Pawar</div>
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>Aurangabad Block • 18 patients</div>
                    </div>

                    {/* Desktop Header */}
                    <div className="cho-desktop-header">
                        <div>
                            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
                                {tab === 'home' && (lang === 'en' ? "Today's Overview" : 'आज का सारांश')}
                                {tab === 'highrisk' && (lang === 'en' ? 'High-Risk Patients' : 'उच्च जोखिम वाले रोगी')}
                                {tab === 'visits' && (lang === 'en' ? "Today's Visits" : 'आज के दौरे')}
                                {tab === 'settings' && (lang === 'en' ? 'Settings' : 'सेटिंग')}
                            </h1>
                            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Aurangabad Block • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
                                <Bell size={18} color="#64748b" />
                                <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '2px solid white' }} />
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="cho-content">
                        {tab === 'home' && (
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }} className="cho-mobile-header">{lang === 'en' ? "Today's Summary" : 'आज का सारांश'}</div>
                                <div className="cho-stat-grid">
                                    {HOME_STATS.map((s) => {
                                        const Icon = s.icon;
                                        return (
                                            <div key={s.label} style={{ background: 'white', borderRadius: 16, padding: '20px 16px', border: `1px solid ${s.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                                    <Icon size={20} color={s.color} />
                                                </div>
                                                <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Next Visit Banner */}
                                <div className="cho-next-visit" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.04) 100%)', border: '1px solid rgba(139,92,246,0.2)' }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Clock size={14} /> Next Visit
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Kamla Bai — 12:30 PM</div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <MapPin size={12} /> Paithan · Med Refill
                                        </div>
                                    </div>
                                    <button style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(139,92,246,0.3)', fontFamily: 'inherit' }}>
                                        Start Visit <ChevronRight size={15} />
                                    </button>
                                </div>

                                {/* Quick High-Risk Preview */}
                                <div style={{ marginTop: 24 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <TrendingUp size={16} color="#ef4444" /> Priority Patients
                                        </div>
                                        <button onClick={() => setTab('highrisk')} style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            View All →
                                        </button>
                                    </div>
                                    <div className="cho-patients-grid">
                                        {HIGH_RISK_PATIENTS.slice(0, 2).map((p) => (
                                            <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.village} · {p.conditions}</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: 22, fontWeight: 800, color: p.risk > 85 ? '#ef4444' : '#f59e0b', lineHeight: 1 }}>{p.risk}</div>
                                                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>risk</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {tab === 'highrisk' && (
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }} className="cho-mobile-header">{lang === 'en' ? 'High-Risk Patients' : 'उच्च जोखिम वाले रोगी'}</div>
                                <div className="cho-patients-grid">
                                    {HIGH_RISK_PATIENTS.map((p) => (
                                        <div key={p.id} style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s', cursor: 'pointer' }}
                                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                <div>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                                                        {p.name} <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>({p.age})</span>
                                                    </div>
                                                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <MapPin size={13} /> {p.village} · {p.conditions}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                                                    <div style={{ fontSize: 28, fontWeight: 800, color: p.risk > 85 ? '#ef4444' : '#f59e0b', lineHeight: 1 }}>{p.risk}</div>
                                                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>risk score</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 600 }}>
                                                    {p.alerts} alert{p.alerts > 1 ? 's' : ''}
                                                </span>
                                                <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: '#f8fafc', color: '#64748b', border: '1px solid rgba(0,0,0,0.06)' }}>
                                                    Last visit: {p.lastVisit}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {tab === 'visits' && (
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }} className="cho-mobile-header">{lang === 'en' ? "Today's Visits" : 'आज के दौरे'}</div>
                                <div className="cho-visits-list">
                                    {TODAY_VISITS.map((v) => (
                                        <div key={v.id} style={{
                                            background: 'white', borderRadius: 16, padding: 20,
                                            border: `1px solid ${v.done ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.06)'}`,
                                            display: 'flex', alignItems: 'center', gap: 16,
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                            opacity: v.done ? 0.65 : 1,
                                            transition: 'box-shadow 0.2s',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}
                                        >
                                            <div style={{ width: 48, height: 48, borderRadius: 14, background: v.done ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {v.done ? <CheckCircle2 size={22} color="#10b981" /> : <Calendar size={22} color="#8b5cf6" />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', textDecoration: v.done ? 'line-through' : 'none' }}>{v.name}</div>
                                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                                    <Clock size={12} /> {v.time} · <MapPin size={12} /> {v.village} · {v.type}
                                                </div>
                                            </div>
                                            {!v.done && (
                                                <button style={{ padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(139,92,246,0.25)' }}>
                                                    Start
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {tab === 'patients' && (
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 20 }} className="cho-mobile-header">{lang === 'en' ? 'Manage Patients' : 'मरीज़ प्रबंधित करें'}</div>
                                <PatientManager themeColor="#8b5cf6" themeColorRGB="139,92,246" />
                            </div>
                        )}

                        {tab === 'settings' && (
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 20 }} className="cho-mobile-header">{lang === 'en' ? 'Settings' : 'सेटिंग'}</div>
                                <div className="cho-settings-grid">
                                    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid rgba(0,0,0,0.06)' }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 16 }}>Language / भाषा</div>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            {(['en', 'hi'] as const).map((l) => (
                                                <button
                                                    key={l}
                                                    onClick={() => setLang(l)}
                                                    style={{
                                                        flex: 1, padding: '12px', borderRadius: 12,
                                                        border: `1.5px solid ${lang === l ? 'rgba(139,92,246,0.4)' : 'rgba(0,0,0,0.08)'}`,
                                                        background: lang === l ? 'rgba(139,92,246,0.08)' : 'transparent',
                                                        color: lang === l ? '#7c3aed' : '#64748b', fontWeight: 600,
                                                        cursor: 'pointer', fontSize: 14,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                                        fontFamily: 'inherit', transition: 'all 0.2s',
                                                    }}
                                                >
                                                    <Globe size={16} />{l === 'en' ? 'English' : 'हिंदी'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid rgba(0,0,0,0.06)' }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 16 }}>Data Sync</div>
                                        <button className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                                            <RefreshCw size={16} /> Sync Patient Data
                                        </button>
                                    </div>

                                    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid rgba(0,0,0,0.06)' }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 16 }}>Account</div>
                                        <button
                                            onClick={() => { setRole(null); navigate('/'); }}
                                            style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)', color: '#dc2626', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontFamily: 'inherit', transition: 'all 0.2s' }}
                                        >
                                            <LogOut size={16} /> Switch Role
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ========== BOTTOM NAV (Mobile) ========== */}
                <div className="cho-bottom-nav">
                    {tabs.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                style={{
                                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    gap: 4, padding: '8px 4px', border: 'none', background: 'transparent',
                                    cursor: 'pointer', color: active ? '#8b5cf6' : '#94a3b8', transition: 'color 0.2s',
                                    fontFamily: 'inherit',
                                }}
                            >
                                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{t.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
