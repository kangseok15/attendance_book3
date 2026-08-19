export type SessionType = 'morning' | 'night';

export type UserRole = 'admin' | 'teacher' | 'student';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'EARLY_LEAVE' | 'NONE';

export interface AttendanceRecord {
  status: AttendanceStatus;
  reason?: string; // e.g. "병결", "학원", "가족행사", "수행평가"
  checkInTime?: string; // e.g. "07:42"
}

export interface Student {
  id: string;
  seq: number;       // 연번 (1~15 per grade or overall)
  grade: 1 | 2 | 3;  // 학년
  classNum: number;  // 반
  studentNum: number;// 번호
  name: string;      // 이름
  seatNum?: string;  // 좌석번호 (e.g. "A-01", "12")
  phone?: string;    // 학생 연락처
  parentPhone?: string; // 학부모 연락처
  notes?: string;    // 비고 (e.g. "화목 학원", "학원 조퇴")
  academyDays?: string[]; // 학원 가는 요일 (체크 시 야자 미참여 음영 처리, e.g. ['화', '목'])
  nightDays?: string[]; // 하위 호환용 (참여 요일)
  active: boolean;   // 참여 여부
}

export interface DayConfig {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;  // 1~31
  dayOfWeek: string; // "월", "화", "수", "목", "금", "토", "일"
  isHoliday?: boolean;
  label?: string;
  enabled: boolean; // Is self-study active on this day?
}

export interface MonthAttendanceState {
  year: number;
  month: number;
  // key format: `${studentId}_${session}_${dateStr}`
  records: Record<string, AttendanceRecord>;
}

export interface AppSettings {
  defaultSession: SessionType;
  morningTimeRange: string; // "07:30 ~ 08:30"
  nightTimeRange: string;   // "19:00 ~ 21:30"
  schoolName: string;       // "미래인재반"
  autoFillPresent: boolean;
}
