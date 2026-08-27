/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord } from '../types/attendance';

// ⚠️ 여기에 복사한 본인의 실제 구글 앱스 스크립트 웹 앱 URL을 붙여넣어 주세요!
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw9bhO-j6e2kG8CNvfCpxUIzh6Ksuj0-h9Q0nKShHK-5fv28L0I-lgLNTS08aZq18W7/exec';

export const syncToGoogleSheets = async (data: {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  recordKey?: string;
  record?: AttendanceRecord;
}) => {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'sync',
        timestamp: new Date().toISOString(),
        ...data,
      }),
    });
  } catch (error) {
    console.error('구글 시트 전송 실패:', error);
  }
};

export const fetchFromGoogleSheets = async (): Promise<{
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
} | null> => {
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getData&t=${Date.now()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('구글 시트 가져오기 실패:', err);
    return null;
  }
};
