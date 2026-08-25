/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord } from '../types/attendance';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzOBmScvTbJAks8HiDtTlJC3sQP43eTAy3QF1S8t32iN7zBYDZQ9NLd0e7UwgHxEguU/exec';

export interface SyncPayload {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  updatedAt?: string;
}

export async function fetchFromGoogleSheets(): Promise<SyncPayload | null> {
  if (!GOOGLE_SCRIPT_URL) return null;
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=read&_nocache=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Google Sheets Fetch Fail:', err);
    return null;
  }
}

export async function syncToGoogleSheets(payload: SyncPayload): Promise<boolean> {
  if (!GOOGLE_SCRIPT_URL) return false;

  // [핵심 안전장치 1] records 객체가 비어있거나 데이터가 없으면 구글 시트 덮어쓰기 전송을 즉시 차단
  if (payload.records && Object.keys(payload.records).length === 0) {
    console.warn('빈 데이터 덮어쓰기 방지: 전송이 취소되었습니다.');
    return false;
  }

  try {
    const bodyStr = JSON.stringify({
      ...payload,
      updatedAt: payload.updatedAt || new Date().toISOString(),
    });
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: bodyStr,
    });
    return true;
  } catch (err) {
    console.warn('Google Sheets Sync Fail:', err);
    return false;
  }
}
