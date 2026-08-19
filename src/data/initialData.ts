import { Student, DayConfig, AttendanceStatus, SessionType } from '../types/attendance';

export const INITIAL_STUDENTS: Student[] = [
  // 3학년 (15명)
  { id: 's-3-1', seq: 1, grade: 3, classNum: 1, studentNum: 19, name: '최서윤', seatNum: '3-01', nightDays: ['월', '수', '금'], active: true },
  { id: 's-3-2', seq: 2, grade: 3, classNum: 2, studentNum: 18, name: '최시온', seatNum: '3-02', active: true },
  { id: 's-3-3', seq: 3, grade: 3, classNum: 3, studentNum: 1, name: '강지윤', seatNum: '3-03', active: true },
  { id: 's-3-4', seq: 4, grade: 3, classNum: 4, studentNum: 11, name: '신예은', seatNum: '3-04', active: true },
  { id: 's-3-5', seq: 5, grade: 3, classNum: 5, studentNum: 1, name: '강정인', seatNum: '3-05', active: true },
  { id: 's-3-6', seq: 6, grade: 3, classNum: 5, studentNum: 8, name: '문채원', seatNum: '3-06', active: true },
  { id: 's-3-7', seq: 7, grade: 3, classNum: 6, studentNum: 18, name: '조성희', seatNum: '3-07', active: true },
  { id: 's-3-8', seq: 8, grade: 3, classNum: 6, studentNum: 20, name: '최은서', seatNum: '3-08', active: true },
  { id: 's-3-9', seq: 9, grade: 3, classNum: 7, studentNum: 7, name: '김현서', seatNum: '3-09', active: true },
  { id: 's-3-10', seq: 10, grade: 3, classNum: 7, studentNum: 9, name: '박주원', seatNum: '3-10', active: true },
  { id: 's-3-11', seq: 11, grade: 3, classNum: 8, studentNum: 13, name: '오윤서', seatNum: '3-11', active: true },
  { id: 's-3-12', seq: 12, grade: 3, classNum: 8, studentNum: 16, name: '정시은', seatNum: '3-12', active: true },
  { id: 's-3-13', seq: 13, grade: 3, classNum: 9, studentNum: 1, name: '강희주', seatNum: '3-13', active: true },
  { id: 's-3-14', seq: 14, grade: 3, classNum: 9, studentNum: 19, name: '최보윤', seatNum: '3-14', active: true },
  { id: 's-3-15', seq: 15, grade: 3, classNum: 10, studentNum: 19, name: '현려경', seatNum: '3-15', active: true },

  // 2학년 (15명 - 최소윤 제외)
  { id: 's-2-1', seq: 1, grade: 2, classNum: 1, studentNum: 6, name: '김도은', seatNum: '2-01', phone: '010-3184-7833', parentPhone: '010-9146-1126', active: true },
  { id: 's-2-2', seq: 2, grade: 2, classNum: 1, studentNum: 8, name: '김태연', seatNum: '2-02', phone: '010-3443-2407', parentPhone: '010-7224-3709', active: true },
  { id: 's-2-3', seq: 3, grade: 2, classNum: 2, studentNum: 5, name: '김나현', seatNum: '2-03', phone: '010-7687-5637', parentPhone: '010-5311-5637', active: true },
  { id: 's-2-4', seq: 4, grade: 2, classNum: 2, studentNum: 6, name: '김세빈', seatNum: '2-04', phone: '010-4860-4766', parentPhone: '010-6374-4766', active: true },
  { id: 's-2-5', seq: 5, grade: 2, classNum: 3, studentNum: 6, name: '김은성', seatNum: '2-05', phone: '010-7401-9775', parentPhone: '010-8884-9775', active: true },
  { id: 's-2-6', seq: 6, grade: 2, classNum: 4, studentNum: 7, name: '임수민', seatNum: '2-06', phone: '010-9512-4648', parentPhone: '010-9866-7415', active: true },
  { id: 's-2-7', seq: 7, grade: 2, classNum: 5, studentNum: 5, name: '김은서', seatNum: '2-07', phone: '010-9561-9991', parentPhone: '010-9360-9992', active: true },
  { id: 's-2-9', seq: 8, grade: 2, classNum: 6, studentNum: 1, name: '권지연', seatNum: '2-08', phone: '010-3993-2294', parentPhone: '010-8324-2294', active: true },
  { id: 's-2-10', seq: 9, grade: 2, classNum: 6, studentNum: 16, name: '조아인', seatNum: '2-09', phone: '010-9231-1833', parentPhone: '010-8777-8388', active: true },
  { id: 's-2-11', seq: 10, grade: 2, classNum: 6, studentNum: 19, name: '황하진', seatNum: '2-10', phone: '010-4031-2134', parentPhone: '010-4779-5877', active: true },
  { id: 's-2-12', seq: 11, grade: 2, classNum: 7, studentNum: 17, name: '조현지', seatNum: '2-11', phone: '010-4192-2465', parentPhone: '010-9247-2465', active: true },
  { id: 's-2-13', seq: 12, grade: 2, classNum: 7, studentNum: 19, name: '황수연', seatNum: '2-12', phone: '010-6265-6640', parentPhone: '010-4107-6640', active: true },
  { id: 's-2-14', seq: 13, grade: 2, classNum: 8, studentNum: 14, name: '은예진', seatNum: '2-13', phone: '010-7266-1073', parentPhone: '010-7220-2542', active: true },
  { id: 's-2-15', seq: 14, grade: 2, classNum: 9, studentNum: 3, name: '김수안', seatNum: '2-14', phone: '010-8616-5414', parentPhone: '010-4876-5414', active: true },
  { id: 's-2-16', seq: 15, grade: 2, classNum: 9, studentNum: 12, name: '윤시현', seatNum: '2-15', phone: '010-9813-0215', parentPhone: '010-9458-8971', active: true },

  // 1학년 (15명)
  { id: 's-1-1', seq: 1, grade: 1, classNum: 1, studentNum: 3, name: '김민송', seatNum: '1-01', active: true },
  { id: 's-1-2', seq: 2, grade: 1, classNum: 1, studentNum: 4, name: '김봄', seatNum: '1-02', active: true },
  { id: 's-1-3', seq: 3, grade: 1, classNum: 2, studentNum: 10, name: '우채원', seatNum: '1-03', active: true },
  { id: 's-1-4', seq: 4, grade: 1, classNum: 4, studentNum: 7, name: '문지영', seatNum: '1-04', active: true },
  { id: 's-1-5', seq: 5, grade: 1, classNum: 4, studentNum: 14, name: '이민준', seatNum: '1-05', active: true },
  { id: 's-1-6', seq: 6, grade: 1, classNum: 4, studentNum: 18, name: '전은설', seatNum: '1-06', active: true },
  { id: 's-1-7', seq: 7, grade: 1, classNum: 5, studentNum: 3, name: '김도연', seatNum: '1-07', active: true },
  { id: 's-1-8', seq: 8, grade: 1, classNum: 5, studentNum: 20, name: '지은서', seatNum: '1-08', active: true },
  { id: 's-1-9', seq: 9, grade: 1, classNum: 5, studentNum: 21, name: '하윤성', seatNum: '1-09', active: true },
  { id: 's-1-10', seq: 10, grade: 1, classNum: 8, studentNum: 13, name: '임지호', seatNum: '1-10', active: true },
  { id: 's-1-11', seq: 11, grade: 1, classNum: 9, studentNum: 3, name: '김민정', seatNum: '1-11', active: true },
  { id: 's-1-12', seq: 12, grade: 1, classNum: 9, studentNum: 12, name: '양태훈', seatNum: '1-12', active: true },
  { id: 's-1-13', seq: 13, grade: 1, classNum: 9, studentNum: 20, name: '조하린', seatNum: '1-13', active: true },
  { id: 's-1-14', seq: 14, grade: 1, classNum: 10, studentNum: 9, name: '배준서', seatNum: '1-14', active: true },
  { id: 's-1-15', seq: 15, grade: 1, classNum: 10, studentNum: 19, name: '이하영', seatNum: '1-15', active: true },
];

export const KOREAN_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 2026년 2학기 자율학습 미실시 일정 및 공휴일 (사용자 지정 학사일정)
 * - 공휴일: 8/15(광복절), 9/24~26(추석), 10/3(개천절), 10/9(한글날), 12/25(성탄절)
 * - 9월 2일: 모의고사
 * - 9월 23일: 재량휴업일
 * - 10월 5일: 재량휴업일
 * - 10월 13일 ~ 16일: 중간고사
 * - 10월 20일: 모의고사
 * - 11월 18일, 19일: 수능
 * - 12월 15일 ~ 19일: 기말고사
 */
export const SPECIAL_CALENDAR_EVENTS: Record<string, { label: string; isHoliday: boolean }> = {
  // 8월
  '2026-08-15': { label: '광복절', isHoliday: true },
  
  // 9월
  '2026-09-02': { label: '모의고사', isHoliday: false },
  '2026-09-23': { label: '재량휴업일', isHoliday: false },
  '2026-09-24': { label: '추석 연휴', isHoliday: true },
  '2026-09-25': { label: '추석', isHoliday: true },
  '2026-09-26': { label: '추석 연휴', isHoliday: true },

  // 10월
  '2026-10-03': { label: '개천절', isHoliday: true },
  '2026-10-05': { label: '재량휴업일', isHoliday: false },
  '2026-10-09': { label: '한글날', isHoliday: true },
  '2026-10-13': { label: '중간고사', isHoliday: false },
  '2026-10-14': { label: '중간고사', isHoliday: false },
  '2026-10-15': { label: '중간고사', isHoliday: false },
  '2026-10-16': { label: '중간고사', isHoliday: false },
  '2026-10-20': { label: '모의고사', isHoliday: false },

  // 11월
  '2026-11-18': { label: '수능', isHoliday: false },
  '2026-11-19': { label: '수능', isHoliday: false },

  // 12월
  '2026-12-15': { label: '기말고사', isHoliday: false },
  '2026-12-16': { label: '기말고사', isHoliday: false },
  '2026-12-17': { label: '기말고사', isHoliday: false },
  '2026-12-18': { label: '기말고사', isHoliday: false },
  '2026-12-19': { label: '기말고사', isHoliday: false },
  '2026-12-25': { label: '성탄절', isHoliday: true },
};

/**
 * Generate school days for a given year & month and session.
 * Automatically excludes:
 * 1) Weekends
 * 2) National public holidays
 * 3) User-defined school schedule (모의고사, 재량휴업일, 중간고사, 수능, 기말고사)
 * 4) 야간 자율학습(night session): 수요일은 야자 미실시로 자동 제외 (8월~12월 야자 수요일 삭제)
 */
export function generateMonthDays(
  year: number,
  month: number,
  session: SessionType = 'morning',
  onlySpecificDates?: number[]
): DayConfig[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: DayConfig[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeekIdx = dateObj.getDay();
    const dayOfWeek = KOREAN_DAY_NAMES[dayOfWeekIdx];
    const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;
    const isWednesday = dayOfWeek === '수';
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const eventInfo = SPECIAL_CALENDAR_EVENTS[dateStr];
    const isHoliday = isWeekend || !!eventInfo?.isHoliday;
    const hasSpecialEvent = !!eventInfo;

    // Determine default enabled state:
    let isEnabled = false;

    if (onlySpecificDates && onlySpecificDates.length > 0) {
      if (session === 'night' && isWednesday) {
        // 야간 자율학습은 수요일 미실시
        isEnabled = false;
      } else {
        isEnabled = onlySpecificDates.includes(d);
      }
    } else if (year === 2026 && month === 8) {
      // 8월은 19일부터 자율학습 시작 (개학일정)
      // 아침: 19(수), 20(목), 21(금), 24(월), 25(화), 26(수), 27(목), 28(금), 31(월)
      // 야간: 20(목), 21(금), 24(월), 25(화), 27(목), 28(금), 31(월) (수요일 19일, 26일 제외)
      if (session === 'night') {
        isEnabled = !isWeekend && !isWednesday && d >= 19 && !hasSpecialEvent;
      } else {
        isEnabled = !isWeekend && d >= 19 && !hasSpecialEvent;
      }
    } else {
      // 평일이면서 공휴일 및 학사 행사(시험, 모의고사, 수능 등)가 없는 날
      // 야간 자율학습(night)의 경우 수요일은 야자 미실시로 제외
      if (session === 'night') {
        isEnabled = !isWeekend && !isWednesday && !isHoliday && !hasSpecialEvent;
      } else {
        isEnabled = !isWeekend && !isHoliday && !hasSpecialEvent;
      }
    }

    let customLabel = eventInfo?.label;
    if (!customLabel && session === 'night' && isWednesday && !isWeekend) {
      customLabel = '수요야자X';
    }

    days.push({
      dateStr,
      dayNum: d,
      dayOfWeek,
      isHoliday,
      label: customLabel,
      enabled: isEnabled,
    });
  }

  return days;
}

/**
 * Start with empty attendance records so teachers can start fresh
 */
export function generateEmptyRecords(): Record<string, { status: AttendanceStatus; reason?: string }> {
  return {};
}
