/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord } from '../types/attendance';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw9bhO-j6e2kG8CNvfCpxUIzh6Ksuj0-h9Q0nKShHK-5fv28L0I-lgLNTS08aZq18W7/exec';

export interface SheetData {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  recordKey?: string;
  record?: AttendanceRecord;
}

export async function fetchFromGoogleSheets(): Promise<{ students: Student[]; records: Record<string, AttendanceRecord> } | null> {
  if (!SCRIPT_URL) return null;
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

export async function syncToGoogleSheets(data: SheetData): Promise<boolean> {
  if (!SCRIPT_URL) return false;
  if (!data.students && !data.records && !data.record) return false;

  const payload = JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString()
  });

  const bodyData = new URLSearchParams();
  bodyData.append('data', payload);

  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: bodyData,
    });
    return true;
  } catch (err) {
    try {
      await fetch(`${SCRIPT_URL}?data=${encodeURIComponent(payload)}&t=${Date.now()}`, {
        mode: 'no-cors'
      });
      return true;
    } catch (fallbackErr) {
      console.error('구글 시트 전송 실패:', fallbackErr);
      return false;
    }
  }
}
