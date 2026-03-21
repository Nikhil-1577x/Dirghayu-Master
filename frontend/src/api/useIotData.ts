import { useEffect } from 'react';
import { getIotAlerts, getIotDispenserStatus, getIotHistory, setIotActivePatient } from './endpoints';
import { useApiStore, useIotStore } from '../store';

export function useIotData() {
  const patientId = useApiStore((s) => s.patientId);
  const setSnapshot = useIotStore((s) => s.setSnapshot);
  const reset = useIotStore((s) => s.reset);

  // Sync selected patient to backend so Arduino events go to this patient
  useEffect(() => {
    if (patientId) {
      setIotActivePatient(patientId).catch((err) => {
        console.warn('Failed to sync active IoT patient:', err);
      });
    }
  }, [patientId]);

  useEffect(() => {
    if (!patientId) {
      reset();
      return;
    }
    let active = true;
    (async () => {
      try {
        const [dispenser, alertsRes, historyRes] = await Promise.all([
          getIotDispenserStatus(patientId),
          getIotAlerts(patientId),
          getIotHistory(patientId),
        ]);
        if (!active) return;
        setSnapshot({
          dispenser,
          alerts: alertsRes.alerts || [],
          history: historyRes.history || [],
        });
      } catch {
        if (!active) return;
        reset();
      }
    })();
    return () => {
      active = false;
    };
  }, [patientId, reset, setSnapshot]);
}

