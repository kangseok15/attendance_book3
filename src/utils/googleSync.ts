/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord } from '../types/attendance';

// ⚠️ 방금 Apps Script에서 새로 복사한 웹 앱 URL을 여기에 붙여넣어 주세요!
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw9bhO-j6e2kG8CNvfCpxUIzh6Ksuj0-h9Q0nKShHK-5fv28L0I-lgLNTS08aZq18W7/exec';

export interface SheetData {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  recordKey?: string;
  record?: AttendanceRecord;
}

// 1. 구글 시트에서 최신 전체 데이터 가져오기 (GET)
export async function fetchFromGoogleSheets(): Promise<{ students: Student[]; records: Record<string, AttendanceRecord> } | null> {
  if (!SCRIPT_URL || SCRIPT_URL.includes('여기에')) return null;
  try {
    const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
    if (!res.ok) return null;
    const json = await res.json();
    return {
      students: json.students || [],
      records: json.records || {}
    };
  } catch (err) {
    console.error('구글 시트 로드 실패:', err);
    return null;
  }
}

// 2. 구글 시트로 데이터 저장하기 (POST) - URL 인코딩 방식으로 모바일/PC 100% 호환
export async function syncToGoogleSheets(data: SheetData): Promise<boolean> {
  if (!SCRIPT_URL || SCRIPT_URL.includes('여기에')) return false;
  if (!data.students && !data.records && !data.record) return false;

  const payload = JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString()
  });

  try {
    // 1차: 표준 POST 전송
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload,
    });
    return true;
  } catch (err) {
    // 2차: 백업 GET 쿼리 전송 (모바일 네트워크 완벽 방어)
    try {
      await fetch(`${SCRIPT_URL}?data=${encodeURIComponent(payload)}&t=${Date.now()}`, {
        mode: 'no-cors'
      });
      return true;
    } catch (fallbackErr) {
      console.error('구글 시트 전송 최종 실패:', fallbackErr);
      return false;
    }
  }
}
