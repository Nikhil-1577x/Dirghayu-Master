/** Mirrors Backend app.utils.chat_ids (patient + role composite id). */

export const CHAT_ID_BASE = 100_000_000;

const ROLE_TO_CODE: Record<string, number> = { doctor: 1, caretaker: 2, cho: 3 };

export type ChatRole = 'doctor' | 'caretaker' | 'cho';

export function chatUserId(patientId: number, role: ChatRole): number {
  const code = ROLE_TO_CODE[role];
  if (code === undefined) throw new Error(`Invalid role: ${role}`);
  if (patientId < 0 || patientId >= CHAT_ID_BASE) {
    throw new Error(`patient_id out of range: ${patientId}`);
  }
  return CHAT_ID_BASE * code + patientId;
}
