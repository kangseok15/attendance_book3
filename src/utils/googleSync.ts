import { Student, AttendanceRecord } from '../types/attendance';

// 새로 발급받으신 최신 정상 웹 앱 URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzOBmScvTbJAks8HiDtTlJC3sQP43eTAy3QF1S8t32iN7zBYDZQ9NLd0e7UwgHxEguU/exec';

export interface SyncPayload {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  updatedAt?: string;
}

// 1. 구글 시트에서 최신 데이터 가져오기
export async function fetchFromGoogleSheets(): Promise<SyncPayload | null> {
  if (!GOOGLE_SCRIPT_URL) return null;

  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=read&_t=${Date.now()}`, {
      method: 'GET',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Google Sheets Fetch Fail:', err);
    return null;
  }
}

// 2. 구글 시트로 데이터 안전 전송
export async function syncToGoogleSheets(payload: SyncPayload): Promise<boolean> {
  if (!GOOGLE_SCRIPT_URL) return false;

  try {
    const bodyStr = JSON.stringify({
      ...payload,
      updatedAt: payload.updatedAt || new Date().toISOString(),
    });

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: bodyStr,
    });
    return true;
  } catch (err) {
    console.warn('Google Sheets Sync Fail:', err);
    return false;
  }
}
