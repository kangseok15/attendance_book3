import { Student, AttendanceStatus, SessionType, DayConfig, UserRole } from '../types/attendance';
import { INITIAL_STUDENTS, generateEmptyRecords } from '../data/initialData';
import { 
  getRecordKey, 
  STATUS_META, 
  isStudentExcluded, 
  isStudentExcludedOnDate, 
  getGradeOrder,
  calculateStudentMonthStats,
  getStudentAcademyDays,
  sortStudents
} from './attendanceHelpers';

const STORAGE_KEYS = {
  STUDENTS: 'soongshin_mirae_students_v9',
  OLD_V8_STUDENTS: 'soongshin_mirae_students_v8',
  OLD_V7_STUDENTS: 'soongshin_mirae_students_v7',
  OLD_V6_STUDENTS: 'soongshin_mirae_students_v6',
  RECORDS: 'soongshin_mirae_records_v6',
  YEAR: 'soongshin_mirae_year_v6',
  MONTH: 'soongshin_mirae_month_v6',
  CUSTOM_DAYS: 'soongshin_mirae_custom_days_v6',
  USER_ROLE: 'soongshin_mirae_user_role_v1',
  ADMIN_PIN: 'soongshin_mirae_admin_pin_v1',
  LOCK_PAST_DATES: 'soongshin_mirae_lock_past_dates_v1',
};

export function loadLockPastDates(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.LOCK_PAST_DATES);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch (e) {
    console.error('Failed to load lock past dates setting:', e);
  }
  return true; // 기본값: 과거 날짜 수정 잠금 활성화 (True)
}

export function saveLockPastDates(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCK_PAST_DATES, String(enabled));
  } catch (e) {
    console.error('Failed to save lock past dates setting:', e);
  }
}

export function loadUserRole(): UserRole {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
    if (saved === 'admin' || saved === 'teacher' || saved === 'student') {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load user role:', e);
  }
  return 'admin';
}

export function saveUserRole(role: UserRole): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
  } catch (e) {
    console.error('Failed to save user role:', e);
  }
}

export const DEFAULT_ADMIN_PIN = '4706';

export function loadAdminPin(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_PIN) || DEFAULT_ADMIN_PIN;
  } catch {
    return DEFAULT_ADMIN_PIN;
  }
}

export function saveAdminPin(pin: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, pin);
  } catch (e) {
    console.error('Failed to save admin pin:', e);
  }
}

export function loadStudents(): Student[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.STUDENTS) || 
                  localStorage.getItem(STORAGE_KEYS.OLD_V8_STUDENTS) || 
                  localStorage.getItem(STORAGE_KEYS.OLD_V7_STUDENTS) || 
                  localStorage.getItem(STORAGE_KEYS.OLD_V6_STUDENTS);
    if (saved) {
      const parsed: Student[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Map initial students by grade + name for phone/metadata updates
        const initMap = new Map<string, Student>();
        INITIAL_STUDENTS.forEach(st => {
          initMap.set(`${st.grade}-${st.name}`, st);
        });

        // Filter out explicitly removed students (최소윤: 2학년 5반 19번)
        const filtered = parsed.filter(st => !(st.grade === 2 && st.name === '최소윤'));

        // Update parsed students with phone & parentPhone if missing or available in INITIAL_STUDENTS
        const updated = filtered.map(st => {
          const initMatch = initMap.get(`${st.grade}-${st.name}`);
          if (initMatch) {
            return {
              ...st,
              classNum: initMatch.classNum ?? st.classNum,
              studentNum: initMatch.studentNum ?? st.studentNum,
              phone: st.phone || initMatch.phone,
              parentPhone: st.parentPhone || initMatch.parentPhone,
            };
          }
          return st;
        });

        // Ensure newly added 황하진 is present if migrating from older versions
        const hajin = INITIAL_STUDENTS.find(s => s.grade === 2 && s.name === '황하진');
        if (hajin && !updated.some(s => s.grade === 2 && s.name === '황하진')) {
          updated.push(hajin);
        }

        // Always sort by grade, classNum, studentNum, name and reassign seq
        const sorted = sortStudents(updated, [3, 2, 1], true);
        saveStudents(sorted);
        return sorted;
      }
    }
  } catch (e) {
    console.error('Failed to load students:', e);
  }
  const defaultSorted = sortStudents(INITIAL_STUDENTS, [3, 2, 1], true);
  saveStudents(defaultSorted);
  return defaultSorted;
}

export function saveStudents(students: Student[]): void {
  try {
    // Automatically sort by grade, classNum, studentNum before saving
    const sorted = sortStudents(students, [3, 2, 1], true);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(sorted));
  } catch (e) {
    console.error('Failed to save students:', e);
  }
}

export function loadAttendanceRecords(): Record<string, { status: AttendanceStatus; reason?: string }> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load attendance records:', e);
  }
  // Start fresh with blank attendance records
  const initial = generateEmptyRecords();
  saveAttendanceRecords(initial);
  return initial;
}

export function saveAttendanceRecords(records: Record<string, { status: AttendanceStatus; reason?: string }>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save attendance records:', e);
  }
}

export function resetToInitialData(): {
  students: Student[];
  records: Record<string, { status: AttendanceStatus; reason?: string }>;
} {
  const students = [...INITIAL_STUDENTS];
  const records = generateEmptyRecords();
  saveStudents(students);
  saveAttendanceRecords(records);
  return { students, records };
}

/**
 * Generate TSV (Tab Separated Values) format for Google Sheets copy-pasting.
 * Exactly matches 숭신고등학교 미래인재반 출석부 layout.
 */
export function generateGoogleSheetsTSV(
  title: string,
  session: SessionType,
  year: number,
  month: number,
  activeDays: DayConfig[],
  students: Student[],
  records: Record<string, { status: AttendanceStatus; reason?: string }>
): string {
  const sessionName = session === 'morning' ? '아침' : '야간';
  const rows: string[][] = [];

  // Title Row
  rows.push([`${title || '숭신고등학교 미래인재반'} ${month}월 ${sessionName} 자율학습 출석부`]);
  rows.push([]); // Empty spacing row

  // Header Row 1: Columns
  // 연번, 학년, 반, 번호, 이름, [Day 1, Day 2, ...], 출석, 결석, 지각/공결, 출석률, 비고 (또는 야자 요일)
  const lastColHeader = session === 'night' ? '야자 요일' : '비고';
  const header1 = ['연번', '학년', '반', '번호', '이름', ...activeDays.map(d => String(d.dayNum)), '출석', '결석', '지각/공결', '출석률', lastColHeader];
  const header2 = ['', '', '', '', '', ...activeDays.map(d => d.dayOfWeek), '', '', '', '', ''];
  rows.push(header1);
  rows.push(header2);

  // Group students by grade based on month (Nov/Dec: 2->1->3, otherwise 3->2->1)
  const grades = getGradeOrder(month);

  grades.forEach(grade => {
    const rawGradeStudents = students.filter(s => s.grade === grade && s.active);
    const gradeStudents = sortStudents(rawGradeStudents, [grade], true);
    
    gradeStudents.forEach((st, idx) => {
      const stats = calculateStudentMonthStats(st, session, activeDays, records);
      const academyDays = getStudentAcademyDays(st);

      const dayCells = activeDays.map(d => {
        const isExcluded = isStudentExcluded(st, session, d.dateStr, d.dayOfWeek);
        if (isExcluded) {
          return '/';
        }

        const key = getRecordKey(st.id, session, d.dateStr);
        const rec = records[key];
        const status = rec?.status || 'NONE';
        return STATUS_META[status].symbol;
      });

      const lastColValue = session === 'night'
        ? (academyDays.length > 0 ? `학원:${academyDays.join(',')}` : '매일참여')
        : (st.notes || '');

      rows.push([
        String(st.seq || idx + 1),
        String(st.grade),
        String(st.classNum),
        String(st.studentNum),
        st.name,
        ...dayCells,
        String(stats.presentCount),
        String(stats.absentCount),
        String(stats.lateCount + stats.earlyLeaveCount + stats.excusedCount),
        stats.rate,
        lastColValue,
      ]);
    });

    // 3학년 / 2학년 / 1학년 재적 및 현원 행
    const gradePresentRow = [
      `${grade}학년 재적 (${gradeStudents.length}명)`,
      '',
      '',
      '',
      `${grade}학년 현원`,
      ...activeDays.map(d => {
        const eligibleStudents = gradeStudents.filter(st => !isStudentExcluded(st, session, d.dateStr, d.dayOfWeek));
        if (eligibleStudents.length === 0) {
          return '-';
        }
        let pres = 0;
        eligibleStudents.forEach(st => {
          const key = getRecordKey(st.id, session, d.dateStr);
          const stt = records[key]?.status;
          if (stt === 'PRESENT' || stt === 'LATE' || stt === 'EARLY_LEAVE') pres++;
        });
        return String(pres);
      }),
      '',
      '',
      '',
      '',
      '',
    ];
    rows.push(gradePresentRow);

    // 2,3학년 누적 재적 행 (If 2학년)
    if (grade === 2) {
      const g23Students = students.filter(s => (s.grade === 3 || s.grade === 2) && s.active);
      rows.push([
        `2,3학년 재적 (${g23Students.length}명)`,
        '',
        '',
        '',
        '2,3학년 출석 현황',
        ...activeDays.map(d => {
          const eligibleStudents = g23Students.filter(st => !isStudentExcluded(st, session, d.dateStr, d.dayOfWeek));
          if (eligibleStudents.length === 0) return '-';
          let pres = 0;
          eligibleStudents.forEach(st => {
            const key = getRecordKey(st.id, session, d.dateStr);
            const stt = records[key]?.status;
            if (stt === 'PRESENT' || stt === 'LATE' || stt === 'EARLY_LEAVE') pres++;
          });
          return String(pres);
        }),
        '',
        '',
        '',
        '',
        '',
      ]);
    }
  });

  // 1~3학년 총 재적 요약 행
  const allActive = students.filter(s => s.active);
  const totalSummaryRow = [
    `1~3학년 총 재적 (${allActive.length}명)`,
    '',
    '',
    '',
    '총 출석 인원',
    ...activeDays.map(d => {
      const eligibleStudents = allActive.filter(st => !isStudentExcluded(st, session, d.dateStr, d.dayOfWeek));
      if (eligibleStudents.length === 0) return '-';
      let pres = 0;
      eligibleStudents.forEach(st => {
        const key = getRecordKey(st.id, session, d.dateStr);
        const stt = records[key]?.status;
        if (stt === 'PRESENT' || stt === 'LATE' || stt === 'EARLY_LEAVE') pres++;
      });
      return String(pres);
    }),
    '',
    '',
    '',
    '',
    '',
  ];
  rows.push(totalSummaryRow);

  return rows.map(r => r.join('\t')).join('\n');
}

/**
 * Generate CSV file download with UTF-8 BOM
 */
export function downloadCSV(
  filename: string,
  session: SessionType,
  year: number,
  month: number,
  activeDays: DayConfig[],
  students: Student[],
  records: Record<string, { status: AttendanceStatus; reason?: string }>
): void {
  const tsv = generateGoogleSheetsTSV('숭신고등학교 미래인재반', session, year, month, activeDays, students, records);
  const csvContent = tsv
    .split('\n')
    .map(line =>
      line
        .split('\t')
        .map(cell => `"${(cell || '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate TSV for Analytics (통계 분석 구글 스프레드시트/엑셀 연동용)
 */
export function generateAnalyticsTSV(
  title: string,
  session: SessionType,
  year: number,
  month: number,
  activeDays: DayConfig[],
  students: Student[],
  records: Record<string, { status: AttendanceStatus; reason?: string }>
): string {
  const sessionName = session === 'morning' ? '아침' : '야간';
  const rows: string[][] = [];

  // Title & Meta
  rows.push([`${title || '숭신고등학교 미래인재반'} ${month}월 ${sessionName} 자율학습 출결 통계 분석표`]);
  rows.push([`기준년월\t${year}년 ${month}월`, `총 운영일수\t${activeDays.length}일`, `총 재적학생\t${students.filter(s => s.active).length}명`]);
  rows.push([]);

  // Section 1: Grade Summary
  rows.push(['[ 1. 학년별 출결 집계 요약 ]']);
  rows.push(['학년', '재적인원', '총 출석(○)', '총 지각(△)', '총 조퇴(⊘)', '총 공결(공)', '총 결석(X)', '평균 출석률']);

  const gradeOrder = getGradeOrder(month);

  gradeOrder.forEach(grade => {
    const gStudents = students.filter(s => s.grade === grade && s.active);
    let totalP = 0;
    let totalL = 0;
    let totalE = 0;
    let totalExc = 0;
    let totalA = 0;
    let totalPossible = 0;

    gStudents.forEach(st => {
      activeDays.forEach(d => {
        if (isStudentExcluded(st, session, d.dateStr, d.dayOfWeek)) return;
        const rec = records[getRecordKey(st.id, session, d.dateStr)]?.status || 'NONE';
        if (rec === 'PRESENT') {
          totalP++;
          totalPossible++;
        } else if (rec === 'LATE') {
          totalL++;
          totalPossible++;
        } else if (rec === 'EARLY_LEAVE') {
          totalE++;
          totalPossible++;
        } else if (rec === 'EXCUSED') {
          totalExc++;
        } else if (rec === 'ABSENT') {
          totalA++;
          totalPossible++;
        }
      });
    });

    const attended = totalP + totalL + totalE;
    const rate = totalPossible > 0 ? `${Math.round((attended / totalPossible) * 100)}%` : '-';
    rows.push([
      `${grade}학년`,
      `${gStudents.length}명`,
      String(totalP),
      String(totalL),
      String(totalE),
      String(totalExc),
      String(totalA),
      rate,
    ]);
  });

  rows.push([]);

  // Section 2: Student Detail Table
  rows.push(['[ 2. 학생별 상세 출결 통계 및 관리 분석 ]']);
  rows.push(['연번', '학년', '반', '번호', '이름', '운영일수', '출석(○)', '지각(△)', '결석(X)', '조퇴(⊘)', '공결(공)', '출석률', '출결상태', '비고']);

  let globalIdx = 1;
  gradeOrder.forEach(grade => {
    const rawGStudents = students.filter(s => s.grade === grade && s.active);
    const gStudents = sortStudents(rawGStudents, [grade], true);
    gStudents.forEach(st => {
      let pCount = 0;
      let lCount = 0;
      let aCount = 0;
      let eCount = 0;
      let excCount = 0;
      let validDays = 0;

      activeDays.forEach(d => {
        if (isStudentExcluded(st, session, d.dateStr, d.dayOfWeek)) return;
        validDays++;
        const rec = records[getRecordKey(st.id, session, d.dateStr)]?.status || 'NONE';
        if (rec === 'PRESENT') pCount++;
        else if (rec === 'LATE') lCount++;
        else if (rec === 'EARLY_LEAVE') eCount++;
        else if (rec === 'EXCUSED') excCount++;
        else if (rec === 'ABSENT') aCount++;
      });

      const attended = pCount + lCount + eCount;
      const checkedDays = attended + aCount;
      const rateNum = checkedDays > 0 ? Math.round((attended / checkedDays) * 100) : 0;
      const rate = checkedDays > 0 ? `${rateNum}%` : '-';

      let statusLabel = '정상';
      if (validDays === 0) statusLabel = '수능후제외';
      else if (checkedDays > 0 && rateNum >= 95) statusLabel = '성실우수';
      else if (aCount >= 2 || (checkedDays > 0 && rateNum < 80)) statusLabel = '관심/상담권장';

      rows.push([
        String(st.seq || globalIdx++),
        String(st.grade),
        String(st.classNum),
        String(st.studentNum),
        st.name,
        String(validDays),
        String(pCount),
        String(lCount),
        String(aCount),
        String(eCount),
        String(excCount),
        rate,
        statusLabel,
        st.notes || '',
      ]);
    });
  });

  return rows.map(r => r.join('\t')).join('\n');
}

/**
 * Download Analytics CSV file
 */
export function downloadAnalyticsCSV(
  filename: string,
  session: SessionType,
  year: number,
  month: number,
  activeDays: DayConfig[],
  students: Student[],
  records: Record<string, { status: AttendanceStatus; reason?: string }>
): void {
  const tsv = generateAnalyticsTSV('숭신고등학교 미래인재반', session, year, month, activeDays, students, records);
  const csvContent = tsv
    .split('\n')
    .map(line =>
      line
        .split('\t')
        .map(cell => `"${(cell || '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

