import { Student, AttendanceRecord } from '../types/attendance';

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
    console.warn('동기화 전송 실패:', err);
  }
};

// 🔄 실시간 자동 동기화를 위한 JSONP 로더
export const fetchFromGoogleSheets = async (): Promise<{
  students?: Student[];
  records?: Record<string, AttendanceRecord>;
  updatedAt?: string;
} | null> => {
  return new Promise((resolve) => {
    const callbackName = 'googleSyncCallback_' + Math.round(1000000 * Math.random());
    const script = document.createElement('script');
    
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);

    const cleanup = () => {
      delete (window as any)[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      clearTimeout(timeoutId);
    };

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      resolve(data);
    };

    script.src = `${GOOGLE_SCRIPT_URL}?action=getData&callback=${callbackName}&_t=${Date.now()}`;
    script.onerror = () => {
      cleanup();
      resolve(null);
    };

    document.body.appendChild(script);
  });
};
