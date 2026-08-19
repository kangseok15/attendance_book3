import { Student, AttendanceRecord } from '../types/attendance';

// 구글 Apps Script 배포 후 생성된 웹 앱 URL (환경 변수 또는 기본값)
export const GOOGLE_SHEETS_API_URL =
  (import.meta as any).env?.VITE_GOOGLE_SHEETS_API_URL ||
  '';

export interface AppSyncPayload {
  students: Student[];
  records: Record<string, AttendanceRecord>;
  updatedAt?: string;
}

/**
 * 구글 스프레드시트에서 최신 학생 목록 및 출결 기록을 조회합니다.
 */
export async function fetchFromGoogleSheets(): Promise<AppSyncPayload | null> {
  const url = GOOGLE_SHEETS_API_URL;
  if (!url || url.trim() === '') {
    return null;
  }
  try {
    const res = await fetch(`${url}?action=getData`, {
      method: 'GET',
      mode: 'cors',
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[GoogleSync] 원격 데이터 불러오기 실패:', err);
    return null;
  }
}

/**
 * 구글 스프레드시트로 최신 데이터를 동기화(백업/저장)합니다.
 */
export async function syncToGoogleSheets(payload: AppSyncPayload): Promise<boolean> {
  const url = GOOGLE_SHEETS_API_URL;
  if (!url || url.trim() === '') {
    return false;
  }
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Google Apps Script 리다이렉션 CORS 이슈 방지
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        updatedAt: new Date().toISOString(),
      }),
    });
    return true;
  } catch (err) {
    console.error('[GoogleSync] 원격 데이터 저장 실패:', err);
    return false;
  }
}
