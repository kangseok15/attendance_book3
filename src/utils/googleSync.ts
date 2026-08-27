/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord } from '../types/attendance';

// ⚠️ 1단계에서 새로 복사한 웹 앱 URL을 여기에 붙여넣어 주세요!
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjSK4tikaVt5DICqLnk2apCpa1iAxfhvjijyTs4h8PECrZfRo_LjkC34iY1JEYcT5wmg/exec';

export const syncToGoogleSheets = async (data: {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  recordKey?: string;
  record?: AttendanceRecord;
}) => {
  const payloadStr = JSON.stringify(data);

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(payloadStr)}`,
    });
  } catch (err) {
    try {
      const getUrl = `${GOOGLE_SCRIPT_URL}?action=sync&data=${encodeURIComponent(payloadStr)}&_t=${Date.now()}`;
      const img = new Image();
      img.src = getUrl;
    } catch (e) {
      console.warn('동기화 실패:', e);
    }
  }
};

export const fetchFromGoogleSheets = async (): Promise<{
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  updatedAt?: string;
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
