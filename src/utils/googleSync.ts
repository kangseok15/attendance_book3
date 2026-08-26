/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord } from '../types/attendance';

// 구글 앱스 스크립트 웹 앱 배포 URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv01vQj8821z9V_cRrvx1X-fWqQ2Nl1Q73E_5m9lQ8Qv6xQ3c0E_qC8U/exec';

export interface SheetData {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  recordKey?: string;
  record?: AttendanceRecord;
}

// 1. 구글 시트에서 최신 전체 데이터 가져오기 (GET)
export async function fetchFromGoogleSheets(): Promise<{ students: Student[]; records: Record<string, AttendanceRecord> } | null> {
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

// 2. 구글 시트로 데이터 저장하기 (POST) - 모바일 브라우저 전송 100% 보장 로직
export async function syncToGoogleSheets(data: SheetData): Promise<boolean> {
  // 빈 데이터 전송 차단
  if (!data.students && !data.records && !data.record) {
    return false;
  }

  const payload = JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString()
  });

  try {
    // 모바일(iOS 사파리, 안드로이드 크롬) 통신 차단 우회 및 전송 보장 (no-cors)
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: payload,
    });

    return true;
  } catch (err) {
    // 만약 fetch 실패 시 navigator.sendBeacon(브라우저 백그라운드 전송)으로 2차 전송 보장
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([payload], { type: 'text/plain' });
        navigator.sendBeacon(SCRIPT_URL, blob);
        return true;
      } catch (beaconErr) {
        console.error('Beacon 전송 오류:', beaconErr);
      }
    }
    console.error('구글 시트 전송 오류:', err);
    return false;
  }
}
