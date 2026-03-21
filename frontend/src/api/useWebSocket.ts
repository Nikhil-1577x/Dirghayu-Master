/**
 * WebSocket connection to backend for real-time updates.
 */
import { useEffect, useRef } from 'react';
import { getWsUrl } from './client';
import { useApiStore, useWSStore, usePatientStore, useMedicationStore, useAlertStore } from '../store';

export function useWebSocket() {
  const patientId = useApiStore((s) => s.patientId);
  const setStatus = useWSStore((s) => s.setStatus);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!patientId) {
      setStatus('disconnected');
      return;
    }

    const url = getWsUrl(patientId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('reconnecting');

    ws.onmessage = (ev) => {
      try {
        if (ev.data === 'pong') return;

        const data = JSON.parse(ev.data);
        const { addAlert, addActivity } = useAlertStore.getState();
        const { updateMedicationStatus } = useMedicationStore.getState();
        const { setRiskScore } = usePatientStore.getState();

        if (data.type === 'dose_event') {
          const status = data.status.toLowerCase() as any;
          updateMedicationStatus(data.medication_id, status);
          addActivity({
            type: 'dose_taken',
            description: `Medication #${data.medication_id} marked as ${status}`,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        }
        if (data.type === 'risk_update') {
          setRiskScore(data.score);
          addActivity({
            type: 'alert_generated',
            description: `Risk score updated to ${data.score.toFixed(1)} (${data.risk_level})`,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        }
        if (data.type === 'alert_triggered') {
          addAlert({
            severity: data.alert_type === 'RISK_ESCALATION' ? 'critical' : 'warning',
            category: 'medication',
            title: data.alert_type.replace('_', ' '),
            description: `Alert triggered: ${data.alert_type} for patient ${data.patient_id}`,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('WS Message Error:', err);
      }
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 30000);

    return () => {
      clearInterval(ping);
      ws.close();
      wsRef.current = null;
      setStatus('disconnected');
    };
  }, [patientId, setStatus]);

  return null;
}
