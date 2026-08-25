/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, SessionType, DayConfig, AttendanceStatus, AttendanceRecord, DayOfWeek } from '../types/attendance';

export const STATUS_CYCLE: AttendanceStatus[] = ['PRESENT', 'LATE', 'EARLY_LEAVE', 'OFFICIAL_ABSENT', 'ABSENT', 'NONE'];

export const STATUS_ICONS: Record<AttendanceStatus, string> = {
  PRESENT: '○',
  LATE: '△',
  EARLY_LEAVE: '∅',
  OFFICIAL_ABSENT: '공',
  ABSENT: 'X',
  NONE: ''
};

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: '출석',
  LATE: '지각',
  EARLY_LEAVE: '조퇴',
  OFFICIAL_ABSENT: '공결',
  ABSENT: '결석',
  NONE: '미체크'
};

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

// 1. 아침 07:30 / 야자 17:30 이후 자동 지각 판정
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

// 2. 야자 학원 요일 제외 판정
export const isStudentExcluded = (student: Student, session: SessionType, dateStr: string): boolean => {
  if (session !== 'night') return false;
  if (!student.academyDays || student.academyDays.length === 0) return false;

  const date = new Date(dateStr);
  const dayIndex = date.getDay();
  const dayMap: Record<number, DayOfWeek> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금' };
  const currentDayOfWeek = dayMap[dayIndex];

  return currentDayOfWeek ? student.academyDays.includes(currentDayOfWeek) : false;
};

export const isStudentExcludedOnDate = isStudentExcluded;

export const isStudentAttendanceLocked = (session: SessionType, dateStr: string) => {
  const today = getTodayDateStr();
  if (dateStr !== today) {
    return { isLocked: true, reason: '당일만 출석 체크가 가능합니다.' };
  }
  return { isLocked: false };
};

// 3. 학생 월간 통계 계산 (100% 초과 방지)
export const calculateStudentMonthlyStats = (
  student: Student,
  session: SessionType,
  activeDays: DayConfig[],
  records: Record<string, AttendanceRecord>
) => {
  let eligibleDays = 0;
  let present = 0;
  let late = 0;
  let early = 0;
  let official = 0;
  let absent = 0;

  activeDays.forEach(day => {
    if (!isStudentExcluded(student, session, day.dateStr)) {
      eligibleDays += 1;
      const key = getRecordKey(student.id, session, day.dateStr);
      const status = records[key]?.status;
      if (status === 'PRESENT') present += 1;
      else if (status === 'LATE') late += 1;
      else if (status === 'EARLY_LEAVE') early += 1;
      else if (status === 'OFFICIAL_ABSENT') official += 1;
      else if (status === 'ABSENT') absent += 1;
    }
  });

  const attendedDays = present + late + early + official;
  const effectivePresent = present + (late * 0.7) + (early * 0.7) + official;
  const rate = eligibleDays > 0 ? Math.min(100, Math.round((effectivePresent / eligibleDays) * 100)) : 0;

  return {
    eligibleDays,
    attendedDays: Math.min(attendedDays, eligibleDays),
    presentCount: present,
    lateCount: late,
    earlyLeaveCount: early,
    officialAbsentCount: official,
    absentCount: absent,
    rate
  };
};
