/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord } from '../types/attendance';

// 구글 앱스 스크립트 웹 앱 배포 URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzL7QfXn_VzB7mZ8rJ0d_7P8p0mX5d7H4d-xP3z6L1h0g9t9k8y/exec';

// 순차 전송 큐 (동시 요청 충돌 및 유실 방지)
let syncQueue: any[] = [];
let isProcessingQueue = false;

const processQueue = async () => {
  if (isProcessingQueue || syncQueue.length === 0) return;
  isProcessingQueue = true;

  const payload = syncQueue.shift();

  try {
    // navigator.sendBeacon 또는 no-cors fetch로 안정적 전송
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('구글 시트 전송 지연 (로컬 데이터는 안전하게 보존됨):', error);
  } finally {
    isProcessingQueue = false;
    if (syncQueue.length > 0) {
      setTimeout(processQueue, 300);
    }
  }
};

export const syncToGoogleSheets = (data: {
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  recordKey?: string;
  record?: AttendanceRecord;
}) => {
  const payload = {
    action: 'sync',
    timestamp: new Date().toISOString(),
    ...data,
  };

  syncQueue.push(payload);
  processQueue();
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
    return null;
  }
};
