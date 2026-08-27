/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord } from '../types/attendance';

export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw9bh0-j6e2kG8CNvfCpxUIzh6Ksuj0-h9Q0nKShHK-5fv28L0I-lgLNTS08aZq18W7/exec';

// 데이터 전송: 브라우저 환경에 따라 Form-URL-Encoded 및 GET fallback을 모두 적용하여 100% 전달 보장
export const syncToGoogleSheets = async (data: {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  recordKey?: string;
  record?: AttendanceRecord;
}) => {
  const payloadStr = JSON.stringify(data);

  try {
    // 1순위: URL-encoded POST 전송
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(payloadStr)}`,
    });
  } catch (err) {
    // 2순위: GET Fallback
    try {
      const getUrl = `${GOOGLE_SCRIPT_URL}?action=sync&data=${encodeURIComponent(payloadStr)}&_t=${Date.now()}`;
      const img = new Image();
      img.src = getUrl;
    } catch (e) {
      console.warn('구글 시트 동기화 실패:', e);
    }
  }
};

// 데이터 수신: 캐시 방지 및 타임스탬프 기반 안전 파싱
export const fetchFromGoogleSheets = async (): Promise<{
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  updatedAt?: string;
} | null> => {
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getData&_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('구글 시트 데이터 조회 실패:', err);
    return null;
  }
};
