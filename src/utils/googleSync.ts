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

// 구글 시트에서 최신 전체 데이터 가져오기 (GET)
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

// 구글 시트로 데이터 저장하기 (POST) - 단일 기록 전송 및 전체 백업 지원
export async function syncToGoogleSheets(data: SheetData): Promise<boolean> {
  // 빈 데이터 전송 원천 차단
  if (!data.students && !data.records && !data.record) {
    return false;
  }

  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        ...data,
        updatedAt: new Date().toISOString()
      }),
      keepalive: true, // 모바일 화면 전환이나 백그라운드에서도 전송 보장
    });

    return res.ok;
  } catch (err) {
    console.error('구글 시트 전송 오류:', err);
    return false;
  }
}
