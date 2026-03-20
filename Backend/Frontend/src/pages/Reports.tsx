import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, Loader2, Sparkles, Activity } from 'lucide-react';
import { useApiStore } from '../store';
import { uploadBiomarkerOcr, getBiomarkerNarrative, getBiomarkers, analyzeReport } from '../api/endpoints';
import { ApiError } from '../api/client';
import type { BiomarkerReading } from '../api/endpoints';

export default function Reports() {
    const { patientId } = useApiStore();
    const [pipelineState, setPipelineState] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
    const [extractedData, setExtractedData] = useState<Array<{ label: string; value: string; unit: string; status: string }>>([]);
    const [narrative, setNarrative] = useState('');
    const [previewInfo, setPreviewInfo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toDisplayName = (key: string) => {
        switch (key) {
            case 'glucose_fasting':
                return 'Glucose (Fasting)';
            case 'hba1c':
                return 'HbA1c';
            case 'glucose_random':
                return 'Glucose (Random)';
            default:
                return key.replace(/_/g, ' ');
        }
    };

    const classify = (key: string, value: number, unit?: string | null) => {
        const k = key.toLowerCase();
        const u = (unit || '').toLowerCase();
        if (k === 'glucose_fasting' && u.includes('mg')) return value > 100 ? 'high' : 'normal';
        if (k === 'glucose_random' && u.includes('mg')) return value > 200 ? 'high' : 'normal';
        if (k === 'hba1c') return value >= 6.5 ? 'high' : 'normal';
        return 'normal';
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !patientId) return;
        setError(null);
        setPreviewInfo(null);
        setPipelineState('uploading');
        try {
            // Optional: preview what OCR sees before saving to DB
            const preview = await analyzeReport(file);
            // Debug: verify response shape and presence of biomarkers
            console.log('API RESPONSE:', preview);
            // If backend includes ai_error, log it verbosely.
            if (preview.ai_error?.status || preview.ai_error?.message) console.error('AI error (preview):', preview.ai_error);
            if (preview.status !== 'success') {
                setPreviewInfo(preview.message || 'OCR did not detect any biomarkers in this file.');
            } else if (preview.biomarkers && Object.keys(preview.biomarkers).length) {
                const items = Object.entries(preview.biomarkers)
                    .filter(([, v]) => v && v.value !== null && Number.isFinite(Number(v.value)))
                    .map(([key, v]) => {
                        const val = Number(v?.value);
                        const unit = (v?.unit ?? '').toString();
                        const status = classify(key, val, unit);
                        return {
                            label: toDisplayName(key),
                            value: String(val),
                            unit,
                            status,
                        };
                    });
                setExtractedData(items);
                // Preview AI summary is best-effort; never block biomarker display.
                setNarrative((preview.ai_summary ?? '').toString());
                const summary = items.map((i) => `${i.label}: ${i.value}${i.unit ? ' ' + i.unit : ''}`).join(', ');
                setPreviewInfo(`Preview (not yet saved): ${summary}`);
            }

            await uploadBiomarkerOcr(patientId, file);
            setPipelineState('processing');

            // Fetch latest biomarkers from backend so UI always reflects DB state.
            const readings = await getBiomarkers(patientId);
            const latestByType: Record<string, BiomarkerReading> = {};
            readings.forEach((r) => {
                const existing = latestByType[r.biomarker_type];
                if (!existing || r.timestamp > existing.timestamp) {
                    latestByType[r.biomarker_type] = r;
                }
            });

            const items = Object.values(latestByType).map((r) => {
                const t = r.biomarker_type.toLowerCase();
                const unit = t.includes('hba1c') ? '%' : (t.includes('hemoglobin') && !t.includes('a1c') ? 'g/dL' : 'mg/dL');
                return {
                    label: r.biomarker_type.replace(/_/g, ' '),
                    value: String(r.value),
                    unit,
                    status: 'normal',
                };
            });
            // If DB ingestion produced nothing, keep the preview biomarkers on screen.
            if (items.length) {
                setExtractedData(items);
            }

            // AI narrative is optional. Never surface its failures as a blocking UI error.
            try {
                const narrRes = await getBiomarkerNarrative(patientId);
                if (narrRes.ai_error?.status || narrRes.ai_error?.message) console.error('AI error (narrative):', narrRes.ai_error);
                // Prefer the fresh OCR summary if present; otherwise fall back to DB narrative.
                setNarrative((preview.ai_summary ?? '').trim() || (narrRes.narrative ?? ''));
            } catch (aiErr) {
                if (aiErr instanceof ApiError) {
                    console.error('AI NARRATIVE API ERROR', {
                        status: aiErr.status,
                        url: aiErr.url,
                        bodyText: aiErr.bodyText,
                        bodyJson: aiErr.bodyJson,
                    });
                } else {
                    console.error('AI NARRATIVE UNKNOWN ERROR', aiErr);
                }
                // Keep whatever we already have (preview.ai_summary or blank).
                setNarrative((preview.ai_summary ?? '').toString());
            }
            setPipelineState('done');
        } catch (err) {
            if (err instanceof ApiError) {
                console.error('API ERROR', {
                    status: err.status,
                    url: err.url,
                    bodyText: err.bodyText,
                    bodyJson: err.bodyJson,
                });
                // Only show blocking errors for OCR/upload. Narrative errors are handled separately above.
                if (!String(err.url).includes('/biomarkers/narrative')) {
                    setError(`API ${err.status} (${err.url}): ${err.message}`);
                }
            } else {
                console.error('UNKNOWN ERROR', err);
                setError(err instanceof Error ? err.message : 'Upload failed');
            }
            // If we already extracted biomarkers from the OCR preview, keep them visible.
            setPipelineState(extractedData.length ? 'done' : 'idle');
        }
        e.target.value = '';
    };

    const handleUploadClick = () => {
        if (pipelineState !== 'idle') return;
        if (!patientId) {
            setError('Select a patient first');
            return;
        }
        fileInputRef.current?.click();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 48 }}>
            {/* Header */}
            <div className="page-header">
                <h1>Report Analysis</h1>
                <p>Upload lab reports for automatic biometric extraction and AI-powered insights</p>
            </div>

            {error && (
                <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#ef4444', marginBottom: 24 }}>
                    {error}
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                <input type="file" ref={fileInputRef} accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
                {/* Upload Area */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Upload Document</h3>
                    <div
                        onClick={handleUploadClick}
                        style={{
                            flex: 1,
                            border: '2px dashed var(--border-strong)',
                            borderRadius: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 40,
                            gap: 16,
                            background: 'rgba(20, 184, 166, 0.03)',
                            cursor: pipelineState === 'idle' ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {pipelineState === 'idle' ? (
                            <>
                                <div style={{ width: 72, height: 72, background: 'var(--accent-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-border)' }}>
                                    <Upload size={32} color="var(--accent-primary)" strokeWidth={2} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Click to upload lab report</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF, PNG, or JPG – OCR extracts biomarkers</div>
                                </div>
                            </>
                        ) : pipelineState === 'uploading' ? (
                            <>
                                <div style={{ width: 64, height: 64, background: 'var(--blue-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Loader2 size={28} color="var(--blue-primary)" style={{ animation: 'spin 1.5s linear infinite' }} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Uploading document...</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>blood_panel_mar2026.pdf</div>
                                </div>
                            </>
                        ) : pipelineState === 'processing' ? (
                            <>
                                <div style={{ width: 64, height: 64, background: 'var(--amber-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Sparkles size={28} color="var(--amber-primary)" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--amber-primary)', marginBottom: 4 }}>Analyzing via AI Vision...</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Running OCR & parsing biomarkers</div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ width: 64, height: 64, background: 'var(--green-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCircle2 size={28} color="var(--green-primary)" />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--green-primary)', marginBottom: 4 }}>Analysis Complete</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Data successfully extracted</div>
                                    <button onClick={(e) => { e.stopPropagation(); setPipelineState('idle'); setExtractedData([]); setNarrative(''); }} className="btn btn-ghost" style={{ marginTop: 16 }}>Upload Another</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Results Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, opacity: pipelineState === 'done' ? 1 : 0.3, pointerEvents: pipelineState === 'done' ? 'auto' : 'none', transition: 'opacity 0.5s ease' }}>
                    <div className="card" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <Activity size={18} color="var(--blue-primary)" />
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Extracted Biomarkers</h3>
                        </div>
                        {previewInfo && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                {previewInfo}
                            </div>
                        )}
                        {pipelineState === 'done' && (
                            extractedData.length ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, animation: 'fadeInUp 0.5s ease' }}>
                                    {extractedData.map((item, i) => (
                                        <div key={i} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                                <span style={{ fontSize: 24, fontWeight: 800, color: item.status === 'normal' ? 'var(--text-primary)' : 'var(--amber-primary)' }}>{item.value}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    No biomarkers were extracted from this report.
                                </div>
                            )
                        )}
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <FileText size={18} color="#8b5cf6" />
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>AI Narrative Summary</h3>
                        </div>
                        {pipelineState === 'done' && (
                            <div style={{ padding: 16, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, animation: 'slideInRight 0.5s ease 0.2s backwards' }}>
                                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                    {narrative || 'No AI narrative available for this report yet.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
