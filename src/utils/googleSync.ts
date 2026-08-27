/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord } from '../types/attendance';

// ⚠️ 선생님의 실제 구글 스크립트 배포 URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw9bhO-j6e2kG8CNvfCpxUIzh6Ksuj0-h9Q0nKShHK-5fv28L0I-lgLNTS08aZq18W7/exec';

export const syncToGoogleSheets = async (data: {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  recordKey?: string;
  record?: AttendanceRecord;
}) => {
  try {
    const payloadStr = JSON.stringify(data);
    // GET 쿼리스트링 방식을 사용하여 브라우저 CORS 차단을 100% 우회
    const targetUrl = `${GOOGLE_SCRIPT_URL}?action=sync&data=${encodeURIComponent(payloadStr)}&_t=${Date.now()}`;
    
    // image beacon / fetch를 통해 백그라운드 무차단 전송
    const img = new Image();
    img.src = targetUrl;
  } catch (error) {
    console.warn('동기화 지연:', error);
  }
};

export const fetchFromGoogleSheets = async (): Promise<{
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
} | null> => {
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getData&_t=${Date.now()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (err) {
    return null;
  }
};
