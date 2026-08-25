import { Student, SessionType, DayConfig, AttendanceStatus, AttendanceRecord, DayOfWeek } from '../types/attendance';

export const getRecordKey = (studentId: string, session: SessionType, dateStr: string): string => {
  return `${studentId}_${session}_${dateStr}`;
};

export const getTodayDateStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isPastDate = (dateStr: string, todayStr: string = getTodayDateStr()): boolean => {
  return dateStr < todayStr;
};

// 학생 체크 시 시각 기준 자동 상태 판정 (아침 07:30 / 야자 17:30)
export const determineAttendanceStatusByTime = (session: SessionType): { status: AttendanceStatus; timeStr: string } => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  if (session === 'morning') {
    if (hours > 7 || (hours === 7 && minutes > 30)) {
      return { status: 'LATE', timeStr };
    }
    return { status: 'PRESENT', timeStr };
  } else {
    if (hours > 17 || (hours === 17 && minutes > 30)) {
      return { status: 'LATE', timeStr };
    }
    return { status: 'PRESENT', timeStr };
  }
};

// 야자 학원 가는 요일 체크 여부 확인
export const isStudentExcluded = (student: Student, session: SessionType, dateStr: string): boolean => {
  if (session !== 'night') return false;
  if (!student.academyDays || student.academyDays.length === 0) return false;

  const date = new Date(dateStr);
  const dayIndex = date.getDay();
  const dayMap: Record<number, DayOfWeek> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금' };
  const currentDayOfWeek = dayMap[dayIndex];

  return currentDayOfWeek ? student.academyDays.includes(currentDayOfWeek) : false;
};

export const isStudentAttendanceLocked = (session: SessionType, dateStr: string) => {
  const today = getTodayDateStr();
  if (dateStr !== today) return { isLocked: true, reason: '당일만 출석 체크가 가능합니다.' };
  return { isLocked: false };
};
