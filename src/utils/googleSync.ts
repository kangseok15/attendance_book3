import { Student, AttendanceRecord } from '../types/attendance';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIr2Kv-D8uv7Ke8Ddcdua7IYKv-KRUuR9pBobGPJesIlaXuyrEJMFCjhwzS2Tunc5RE/exec';

export interface SyncPayload {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  updatedAt?: string;
}

// 1. 데이터 가져오기 (리다이렉트 정상 추적 및 캐시 방지)
export async function fetchFromGoogleSheets(): Promise<SyncPayload | null> {
  if (!GOOGLE_SCRIPT_URL) return null;

  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=read&_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Google Sheets Fetch Error:', err);
    return null;
  }
}

// 2. 데이터 전송하기
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
    console.warn('Google Sheets Sync Error:', err);
    return false;
  }
}
