/**
 * API endpoint functions - maps to backend routes.
 */
import { api, ApiError } from './client';

// ─── Types (backend-compatible) ──────────────────────────────────────────────

export interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  phone: string;
  family_phone?: string;
  doctor_phone?: string;
  created_at: string;
}

export interface Medication {
  id: number;
  patient_id: number;
  name: string;
  dose: string;
  schedule_time: string;
}

export interface Appointment {
  id: number;
  patient_id: number;
  appointment_time: string;
  doctor_name: string;
  notes?: string;
}

export interface DashboardResponse {
  patient: Patient;
  latest_biomarkers: Record<string, { value: number; timestamp: string; slope?: number; trend?: string }>;
  risk_score: { score: number; risk_level: string } | null;
  weekly_adherence: { taken: number; late: number; missed: number; total: number; weekly_score: number };
  daily_adherence: { taken: number; late: number; missed: number; total: number; daily_score: number };
  recent_alerts: Array<{ id: number; alert_type: string; message: string; timestamp: string }>;
}

export interface AdherenceResponse {
  patient_id: number;
  daily_adherence: { taken: number; late: number; missed: number; total: number; daily_score: number };
  weekly_score: number;
  weekly_adherence: { taken: number; late: number; missed: number; total: number; weekly_score: number };
  missed_doses: Array<{ id: number; medication_id: number; timestamp: string; status: string }>;
}

export interface AdherenceHistoryResponse {
  patient_id: number;
  days: number;
  history: Array<{ date: string; status: 'taken' | 'late' | 'missed' | 'no-data' }>;
}

export interface BiomarkerReading {
  id: number;
  patient_id: number;
  biomarker_type: string;
  value: number;
  timestamp: string;
  slope?: number;
  trend?: string;
}

export interface BiomarkerReportRecord {
  report_id: string;
  biomarker_name: string;
  value: number;
  unit?: string | null;
  created_at: string;
}

export interface DietSummary {
  calories: number;
  sodium: number;
  carbs: number;
  protein: number;
  suggestions: string[];
  ai_summary?: string;
  narrative?: string;
}

export interface ExerciseSummary {
  steps: number;
  active_minutes: number;
  calories_burned: number;
  goal_message: string;
}

export interface DeteriorationSignal {
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'good';
  duration: string;
}

export interface IotDispenserStatus {
  patient_id: number;
  status: string;
  last_dispensed_time: string | null;
  last_medication_name: string | null;
  next_dose: string | null;
  device_status: 'connected' | 'offline' | string;
  slot: number | null;
  rtc_time: string | null;
  scheduled_time: string | null;
  alert: boolean;
  last_event: string;
}

export interface IotAlert {
  id: number;
  patient_id: number;
  timestamp: string;
  alert_type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | string;
}

export interface IotHistoryItem {
  id: number;
  patient_id: number;
  timestamp: string;
  medication_name: string;
  status: 'dispensed' | 'missed' | 'error' | string;
  source: string;
}

export interface ReportInfo {
  id: number;
  patient_id: number;
  file_path: string;
  created_at: string;
}

export interface AbhaHistoryItem {
  date: string;
  event: string;
  hospital: string;
}

export interface AbhaPatient {
  abha_id: string;
  name: string;
  age: number;
  gender: string;
  blood_group: string;
  conditions: string[];
  allergies: string[];
  history: AbhaHistoryItem[];
  db_patient_id?: number | null;
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export async function listPatients(): Promise<Patient[]> {
  return api.get<Patient[]>('/patient/');
}

export async function getPatient(id: number): Promise<Patient> {
  return api.get<Patient>(`/patient/${id}`);
}

export async function getDashboard(patientId: number): Promise<DashboardResponse> {
  return api.get<DashboardResponse>(`/patient/${patientId}/dashboard`);
}

export async function createPatient(data: {
  name: string;
  age: number;
  gender: string;
  phone: string;
  family_phone?: string;
  doctor_phone?: string;
}): Promise<Patient> {
  return api.post<Patient>('/patient/', data);
}

// ─── Medications ─────────────────────────────────────────────────────────────

export async function getMedications(patientId: number): Promise<Medication[]> {
  return api.get<Medication[]>(`/patient/${patientId}/medications`);
}

export async function addMedication(
  patientId: number,
  data: { name: string; dose: string; schedule_time: string }
): Promise<{ id: number; name: string; dose: string; schedule_time: string }> {
  return api.post(`/patient/${patientId}/medication`, data);
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export async function getAlerts(patientId: number): Promise<{
  patient_id: number;
  alerts: Array<{ id: number; alert_type: string; message: string; sent_to: string; timestamp: string }>;
}> {
  return api.get(`/patient/${patientId}/alerts`);
}

// ─── Adherence ───────────────────────────────────────────────────────────────

export async function getAdherence(patientId: number): Promise<AdherenceResponse> {
  return api.get(`/patient/${patientId}/adherence`);
}

export async function getAdherenceHistory(patientId: number, days = 365): Promise<AdherenceHistoryResponse> {
  return api.get(`/patient/${patientId}/adherence/history?days=${encodeURIComponent(String(days))}`);
}

// ─── Biomarkers ──────────────────────────────────────────────────────────────

export async function getBiomarkers(patientId: number): Promise<BiomarkerReading[]> {
  return api.get(`/patient/${patientId}/biomarkers`);
}

export async function getBiomarkerReports(patientId: number): Promise<BiomarkerReportRecord[]> {
  return api.get(`/patient/${patientId}/biomarker-reports`);
}

export async function uploadBiomarkerOcr(
  patientId: number,
  file: File
): Promise<{ added: number; records: Array<Record<string, unknown>> }> {
  // Backend expects multipart form with file param - use raw fetch for FormData
  const base = import.meta.env.VITE_API_URL ?? '';
  const url = `${base}/patient/${patientId}/biomarkers/ocr`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    let bodyJson: unknown = undefined;
    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      bodyJson = undefined;
    }
    const detail =
      (bodyJson as { detail?: string })?.detail ?? res.statusText ?? `Upload failed: ${res.status}`;
    throw new ApiError(String(detail), { status: res.status, url, bodyText, bodyJson });
  }
  return res.json();
}

// Optional: direct OCR preview without saving to DB
export async function analyzeReport(
  file: File,
  patientId: number
): Promise<{
  status: string;
  message: string;
  raw_text: string;
  biomarkers: Record<string, { value: number | null; unit?: string | null } | null>;
  ai_summary: string;
  ai_error?: { source?: string; status?: number | null; message?: string } | null;
}> {
  const base = import.meta.env.VITE_API_URL ?? '';
  const url = `${base}/analyze-report?patient_id=${encodeURIComponent(String(patientId))}`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    let bodyJson: unknown = undefined;
    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      bodyJson = undefined;
    }
    const detail =
      (bodyJson as { detail?: string })?.detail ?? res.statusText ?? `Analyze report failed: ${res.status}`;
    throw new ApiError(String(detail), { status: res.status, url, bodyText, bodyJson });
  }
  return res.json();
}

export async function getBiomarkerNarrative(
  patientId: number
): Promise<{ patient_id: number; narrative: string; ai_error?: { source?: string; status?: number | null; message?: string } | null }> {
  return api.get(`/patient/${patientId}/biomarkers/narrative`);
}

export async function getDietSummary(patientId: number): Promise<DietSummary> {
  return api.get(`/patient/${patientId}/diet`);
}

export async function getExerciseSummary(patientId: number): Promise<ExerciseSummary> {
  return api.get(`/patient/${patientId}/exercise`);
}

export async function getDeteriorationSignals(patientId: number): Promise<{ patient_id: number; signals: DeteriorationSignal[] }> {
  return api.get(`/patient/${patientId}/signals`);
}

export async function setIotActivePatient(patientId: number): Promise<{ patient_id: number }> {
  return api.post(`/iot/active-patient`, { patient_id: patientId });
}

export async function getIotDispenserStatus(patientId: number): Promise<IotDispenserStatus> {
  return api.get(`/iot/dispenser/${patientId}`);
}

export async function getIotAlerts(patientId: number): Promise<{ patient_id: number; alerts: IotAlert[] }> {
  return api.get(`/iot/alerts/${patientId}`);
}

export async function getIotHistory(patientId: number): Promise<{ patient_id: number; history: IotHistoryItem[] }> {
  return api.get(`/iot/history/${patientId}`);
}

export async function getEnvironmentReadings(patientId: number): Promise<{ patient_id: number; readings: Array<{ temperature_c: number; humidity_pct: number; timestamp: string }>; total: number }> {
  return api.get(`/patient/${patientId}/environment`);
}

// ─── Appointments ────────────────────────────────────────────────────────────

export async function getAppointments(patientId: number): Promise<Appointment[]> {
  return api.get<Appointment[]>(`/patient/${patientId}/appointments`);
}

export async function addAppointment(
  patientId: number,
  data: { appointment_time: string; doctor_name: string; notes?: string }
): Promise<{ id: number } & typeof data> {
  return api.post(`/patient/${patientId}/appointment`, data);
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function generateReport(patientId: number): Promise<{
  patient_id: number;
  file_path: string;
  message: string;
}> {
  return api.post(`/patient/${patientId}/report`);
}

export async function listReports(patientId: number): Promise<{
  patient_id: number;
  reports: ReportInfo[];
}> {
  return api.get(`/patient/${patientId}/reports`);
}

export async function downloadPatientSummaryReport(patientId: number): Promise<void> {
  const base = import.meta.env.VITE_API_URL ?? '';
  const url = `${base}/patient/${patientId}/report`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = 'patient_report.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function getReportDownloadUrl(patientId: number, reportId: number): string {
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}/patient/${patientId}/report/download/${reportId}`;
}

// ─── Risk ────────────────────────────────────────────────────────────────────

export async function getRiskScore(patientId: number): Promise<{
  patient_id: number;
  score: number;
  risk_level: string;
  timestamp?: string;
}> {
  return api.get(`/patient/${patientId}/risk`);
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ status: string; service: string }> {
  return api.get('/');
}

// ─── ABHA ─────────────────────────────────────────────────────────────────────

export async function lookupAbhaPatient(abhaId: string): Promise<AbhaPatient> {
  return api.get(`/abha/lookup/${encodeURIComponent(abhaId)}`);
}

export async function addAbhaPatientToPanel(abhaId: string): Promise<{ message: string; abha_id: string }> {
  return api.post(`/abha/patients/${encodeURIComponent(abhaId)}`);
}

export async function removeAbhaPatientFromPanel(abhaId: string): Promise<{ message: string; abha_id: string }> {
  return api.delete(`/abha/patients/${encodeURIComponent(abhaId)}`);
}

export async function listAbhaPanelPatients(): Promise<{ patients: AbhaPatient[]; count: number }> {
  return api.get('/abha/patients');
}
