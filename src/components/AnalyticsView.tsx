import React, { useState } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceRecord,
  AttendanceStatus
} from '../types/attendance';
import { 
  calculateStudentMonthStats,
  isStudentExcludedOnDate,
  isStudentExcluded,
  getRecordKey,
  getGradeOrder
} from '../utils/attendanceHelpers';
import { 
  generateAnalyticsTSV, 
  downloadAnalyticsCSV 
} from '../utils/storage';
import { 
  BarChart3, 
  TrendingUp, 
  Award, 
  AlertTriangle, 
  Sun, 
  Moon,
  FileSpreadsheet,
  Copy,
  Check,
  Download,
  Search,
  Sparkles,
  ArrowUpDown,
  Filter
} from 'lucide-react';

interface AnalyticsViewProps {
  students: Student[];
  session: SessionType;
  year: number;
  month: number;
  activeDays: DayConfig[];
  records: Record<string, AttendanceRecord>;
  userRole?: import('../types/attendance').UserRole;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  students,
  session,
  year,
  month,
  activeDays,
  records,
  userRole = 'admin',
}) => {
  if (userRole === 'student') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto my-12 shadow-xs">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
          통계 및 분석 비공개 메뉴
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          통계 및 분석 리포트는 관리자 및 담임 교사 전용 화면입니다. 학생 모드에서는 월간 출석부 및 일별 빠른 체크를 이용해 주세요.
        </p>
      </div>
    );
  }
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [tableFilter, setTableFilter] = useState<'all' | 'top' | 'warning'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rateDesc' | 'absentDesc' | 'number' | 'name'>('rateDesc');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeStudents = students.filter(s => s.active);
  const sessionLabel = session === 'morning' ? '아침' : '야간';
  const gradeOrder = getGradeOrder(month);

  // Calculate each student's stats for this session
  const studentStats = activeStudents.map(st => {
    const s = calculateStudentMonthStats(st, session, activeDays, records);
    return {
      student: st,
      ...s,
    };
  });

  // Filter by grade
  const gradeFilteredStats = studentStats.filter(item => {
    if (selectedGrade !== 'all' && item.student.grade !== selectedGrade) return false;
    return true;
  });

  // Top performers (Perfect / High Attendance >= 95%)
  const topStudents = gradeFilteredStats.filter(s => s.rateNum >= 95 && s.checkedDays > 0);

  // Warning students (Absences >= 2 or Rate < 80% with checked days)
  const warningStudents = [...gradeFilteredStats]
    .filter(s => !s.isFullyExcluded && (s.absentCount >= 2 || (s.checkedDays > 0 && s.rateNum < 80)))
    .sort((a, b) => b.absentCount - a.absentCount);

  // Full table list with search and filter
  const tableData = gradeFilteredStats.filter(item => {
    if (tableFilter === 'top' && (item.rateNum < 95 || item.checkedDays === 0)) return false;
    if (tableFilter === 'warning' && (item.isFullyExcluded || (item.absentCount < 2 && (item.checkedDays === 0 || item.rateNum >= 80)))) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return item.student.name.toLowerCase().includes(q) || `${item.student.grade}${item.student.classNum}${item.student.studentNum}`.includes(q);
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'rateDesc') return b.rateNum - a.rateNum || a.absentCount - b.absentCount;
    if (sortBy === 'absentDesc') return b.absentCount - a.absentCount || a.rateNum - b.rateNum;
    if (sortBy === 'number') {
      const gIndexA = gradeOrder.indexOf(a.student.grade);
      const gIndexB = gradeOrder.indexOf(b.student.grade);
      if (gIndexA !== gIndexB) return gIndexA - gIndexB;
      const codeA = a.student.classNum * 100 + a.student.studentNum;
      const codeB = b.student.classNum * 100 + b.student.studentNum;
      return codeA - codeB;
    }
    if (sortBy === 'name') return a.student.name.localeCompare(b.student.name);
    return 0;
  });

  // Grade-wise overall rate (출석+지각+조퇴 / 출석+지각+조퇴+결석)
  const gradeOverall = gradeOrder.map(g => {
    const gStudents = studentStats.filter(s => s.student.grade === g);
    let totalAttended = 0;
    let totalChecked = 0;

    gStudents.forEach(item => {
      totalAttended += item.presentCount + item.lateCount + item.earlyLeaveCount;
      totalChecked += item.checkedDays;
    });

    const rate = totalChecked > 0 ? Math.round((totalAttended / totalChecked) * 100) : 0;
    const isExcluded = g === 3 && activeDays.every(d => isStudentExcludedOnDate(3, d.dateStr));

    return {
      grade: g,
      count: gStudents.length,
      rate,
      totalAttended,
      totalChecked,
      isExcluded,
    };
  });

  // Morning vs Night comparison for all active students (evaluated on checked records)
  let morningTotalPres = 0;
  let morningTotalChecked = 0;
  let nightTotalPres = 0;
  let nightTotalChecked = 0;

  activeStudents.forEach(st => {
    activeDays.forEach(d => {
      const isMorningExcluded = isStudentExcluded(st, 'morning', d.dateStr, d.dayOfWeek);
      const isNightExcluded = isStudentExcluded(st, 'night', d.dateStr, d.dayOfWeek) || d.dayOfWeek === '수';

      if (!isMorningExcluded) {
        const mRec = records[getRecordKey(st.id, 'morning', d.dateStr)]?.status;
        if (mRec === 'PRESENT') {
          morningTotalPres += 1;
          morningTotalChecked += 1;
        } else if (mRec === 'LATE' || mRec === 'EARLY_LEAVE') {
          morningTotalPres += 0.5;
          morningTotalChecked += 1;
        } else if (mRec === 'ABSENT') {
          morningTotalChecked += 1;
        }
      }

      if (!isNightExcluded) {
        const nRec = records[getRecordKey(st.id, 'night', d.dateStr)]?.status;
        if (nRec === 'PRESENT') {
          nightTotalPres += 1;
          nightTotalChecked += 1;
        } else if (nRec === 'LATE' || nRec === 'EARLY_LEAVE') {
          nightTotalPres += 0.5;
          nightTotalChecked += 1;
        } else if (nRec === 'ABSENT') {
          nightTotalChecked += 1;
        }
      }
    });
  });

  const morningRate = morningTotalChecked > 0 ? Math.round((morningTotalPres / morningTotalChecked) * 100) : 0;
  const nightRate = nightTotalChecked > 0 ? Math.round((nightTotalPres / nightTotalChecked) * 100) : 0;
  const currentSessionRate = session === 'morning' ? morningRate : nightRate;

  // Direct TSV copy
  const analyticsTSV = generateAnalyticsTSV(
    '숭신고등학교 미래인재반',
    session,
    year,
    month,
    activeDays,
    students,
    records
  );

  const handleCopyAnalyticsTSV = () => {
    navigator.clipboard.writeText(analyticsTSV);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadCSV = () => {
    downloadAnalyticsCSV(
      `숭신고등학교_미래인재반_${year}년_${month}월_${session === 'morning' ? '아침' : '야간'}자습_출결통계분석`,
      session,
      year,
      month,
      activeDays,
      students,
      records
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Action Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>숭신고등학교 미래인재반 {month}월 {sessionLabel} 출결 통계 분석</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              총 {activeDays.length}회 운영일 기준 학년별/개인별 출석률, 성실 학생 및 상담 권장 학생 통계를 구글 스프레드시트와 즉시 연동합니다.
            </p>
          </div>

          {/* Action Tools: Google Sheets Export, Copy, Grade Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Grade Switch */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setSelectedGrade('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedGrade === 'all'
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                전체
              </button>
              {gradeOrder.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGrade(g)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedGrade === g
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {g}학년
                </button>
              ))}
            </div>

            {/* Quick Copy to Google Sheets Button */}
            <button
              onClick={handleCopyAnalyticsTSV}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ${
                copied
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title="통계 분석표를 구글 스프레드시트에 즉시 붙여넣을 수 있도록 클립보드에 복사합니다"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '통계 복사 완료!' : '통계표 복사 (스프레드시트용)'}</span>
            </button>

            {/* Open Google Sheets Integration Modal */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>스프레드시트 연동</span>
            </button>
          </div>
        </div>

        {/* Big KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100 dark:border-slate-700">
          
          {/* Average Attendance Rate */}
          <div className="bg-slate-50 dark:bg-slate-750/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-bold">평균 출석률</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {currentSessionRate}%
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${currentSessionRate}%` }}
              />
            </div>
          </div>

          {/* Morning vs Night Compare */}
          <div className="bg-slate-50 dark:bg-slate-750/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <div className="text-xs text-slate-500 mb-2 font-bold">아침(07:30) vs 야간(17:30) 출석률 비교</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center gap-1 text-amber-800 dark:text-amber-300 font-bold">
                  <Sun className="w-3.5 h-3.5" /> 아침
                </div>
                <div className="text-base font-black text-amber-900 dark:text-amber-200 mt-0.5 font-mono">{morningRate}%</div>
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40">
                <div className="flex items-center gap-1 text-indigo-800 dark:text-indigo-300 font-bold">
                  <Moon className="w-3.5 h-3.5" /> 야간
                </div>
                <div className="text-base font-black text-indigo-900 dark:text-indigo-200 mt-0.5 font-mono">{nightRate}%</div>
              </div>
            </div>
          </div>

          {/* Attention summary */}
          <div className="bg-slate-50 dark:bg-slate-750/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-bold">성실 학생 / 관심 필요 학생</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 flex-1">
                <span className="text-2xs text-emerald-700 dark:text-emerald-300 font-bold block">우수(≥95%)</span>
                <span className="text-lg font-black text-emerald-900 dark:text-emerald-100 font-mono">{topStudents.length}명</span>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/40 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-800 flex-1">
                <span className="text-2xs text-rose-700 dark:text-rose-300 font-bold block">관리(결석≥2)</span>
                <span className="text-lg font-black text-rose-900 dark:text-rose-100 font-mono">{warningStudents.length}명</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Grade-by-Grade Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {gradeOverall.map(g => (
          <div
            key={g.grade}
            className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                {g.grade}학년 자율학습 현황
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {g.count}명
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {g.isExcluded ? '-' : `${g.rate}%`}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {g.isExcluded ? '수능 후 자습 제외' : `${g.totalAttended} / ${g.totalChecked} 누적 출석`}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  g.grade === 3 ? 'bg-indigo-500' : g.grade === 2 ? 'bg-emerald-500' : 'bg-purple-500'
                }`}
                style={{ width: `${g.isExcluded ? 0 : g.rate}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Section: Top Performers & Absentees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Warning / Frequent Absences Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              결석 및 출석 관리 대상 학생 ({warningStudents.length}명)
            </h3>
            <span className="text-2xs text-slate-400 font-medium">상담 및 지도 권장</span>
          </div>

          {warningStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              결석 2회 이상 발생 학생이 없습니다. 전원 성실히 참여 중입니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-80 overflow-y-auto mt-2">
              {warningStudents.map(item => (
                <div key={item.student.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">
                      {item.student.name}
                    </span>
                    <span className="text-slate-500 text-2xs ml-2 font-mono">
                      ({item.student.grade}학년 {item.student.classNum}반 {item.student.studentNum}번)
                    </span>
                    {item.student.notes && (
                      <span className="text-slate-400 text-3xs ml-1.5 block">비고: {item.student.notes}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-2xs font-bold">
                      결석 {item.absentCount}회
                    </span>
                    {item.lateCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-2xs font-bold">
                        지각 {item.lateCount}회
                      </span>
                    )}
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 w-10 text-right">
                      {item.rate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Attended Students */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              성실 출석 우수 학생 ({topStudents.length}명)
            </h3>
            <span className="text-2xs text-slate-400 font-medium">출석률 95% 이상</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-80 overflow-y-auto mt-2">
            {topStudents.map(item => (
              <div key={item.student.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                    {item.student.name}
                  </span>
                  <span className="text-slate-500 text-2xs ml-2 font-mono">
                    ({item.student.grade}학년 {item.student.classNum}반 {item.student.studentNum}번)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-2xs font-bold">
                    출석 {item.presentCount}일
                  </span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 w-10 text-right">
                    {item.rate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Comprehensive Student-by-Student Analytics Table (with spreadsheet export support) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              전체 학생 출결 통계 분석 상세표 ({tableData.length}명)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Pills */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setTableFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  tableFilter === 'all'
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setTableFilter('top')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  tableFilter === 'top'
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                우수(≥95%)
              </button>
              <button
                onClick={() => setTableFilter('warning')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  tableFilter === 'warning'
                    ? 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                관리필요
              </button>
            </div>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="text-xs bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-hidden font-medium"
            >
              <option value="rateDesc">정렬: 출석률 높은 순</option>
              <option value="absentDesc">정렬: 결석 많은 순</option>
              <option value="number">정렬: 학번 순</option>
              <option value="name">정렬: 이름 순</option>
            </select>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="이름/학번 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-36 sm:w-44"
              />
            </div>
          </div>
        </div>

        {/* Detailed Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 w-12 whitespace-nowrap">연번</th>
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 w-12 whitespace-nowrap">학년</th>
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 w-12 whitespace-nowrap">반</th>
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 w-12 whitespace-nowrap">번호</th>
                <th className="py-2.5 px-3 border-r-2 border-slate-300 dark:border-slate-600 text-center w-28 min-w-24 whitespace-nowrap">이름</th>
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 w-16 whitespace-nowrap">운영일</th>
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 w-16 whitespace-nowrap">출석(○)</th>
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400 w-16 whitespace-nowrap">지각(△)</th>
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 text-rose-700 dark:text-rose-400 w-16 whitespace-nowrap">결석(X)</th>
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 text-purple-700 dark:text-purple-400 w-16 whitespace-nowrap">조퇴(⊘)</th>
                <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-400 w-16 whitespace-nowrap">공결(공)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 font-extrabold w-20 whitespace-nowrap">출석률</th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-center w-32 min-w-32 whitespace-nowrap">상태</th>
                <th className="py-2.5 px-3 text-left">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tableData.map((item, idx) => {
                const isExcluded = item.isFullyExcluded;
                let statusBadge = (
                  <span className="inline-block px-2.5 py-1 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 whitespace-nowrap">
                    정상
                  </span>
                );

                if (isExcluded) {
                  statusBadge = (
                    <span className="inline-block px-2.5 py-1 rounded-full text-2xs font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 whitespace-nowrap">
                      수능후제외
                    </span>
                  );
                } else if (item.rateNum >= 95) {
                  statusBadge = (
                    <span className="inline-block px-2.5 py-1 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 whitespace-nowrap">
                      ★ 성실우수
                    </span>
                  );
                } else if (item.absentCount >= 2 || item.rateNum < 80) {
                  statusBadge = (
                    <span className="inline-block px-2.5 py-1 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 whitespace-nowrap">
                      ! 상담권장
                    </span>
                  );
                }

                return (
                  <tr 
                    key={item.student.id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                  >
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 font-mono text-slate-500 whitespace-nowrap">
                      {item.student.seq || idx + 1}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 font-semibold whitespace-nowrap">
                      {item.student.grade}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                      {item.student.classNum}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 font-mono whitespace-nowrap">
                      {item.student.studentNum}
                    </td>
                    <td className="py-2 px-3 border-r-2 border-slate-300 dark:border-slate-600 text-center font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {item.student.name}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 font-mono whitespace-nowrap">
                      {item.totalDays}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {item.presentCount}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {item.lateCount}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 font-mono font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                      {item.absentCount}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 font-mono font-bold text-purple-700 dark:text-purple-400 whitespace-nowrap">
                      {item.earlyLeaveCount}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100 dark:border-slate-800 font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                      {item.excusedCount}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800 font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {item.rate}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800 text-center whitespace-nowrap">
                      {statusBadge}
                    </td>
                    <td className="py-2 px-3 text-left text-slate-500 truncate max-w-40">
                      {item.student.notes || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Sheets & Excel Export Modal for Analytics */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                    통계 분석 구글 스프레드시트 및 엑셀 연동
                  </h3>
                  <p className="text-xs text-slate-500">
                    숭신고등학교 미래인재반 {month}월 {session === 'morning' ? '아침' : '야간'} 통계 분석표 즉시 복사 및 다운로드
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsExportModalOpen(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  스프레드시트에 통계 데이터를 붙여넣는 방법
                </div>
                <ol className="list-decimal list-inside space-y-1 text-emerald-800 dark:text-emerald-300">
                  <li>아래 <span className="font-bold bg-emerald-100 dark:bg-emerald-900 px-1 py-0.5 rounded">통계표 전체 복사</span> 버튼을 누릅니다.</li>
                  <li>사용 중인 구글 스프레드시트의 빈 시트(A1 셀)를 선택합니다.</li>
                  <li><span className="font-bold font-mono">Ctrl + V</span> 를 누르면 학년별 요약 통계와 학생별 상세 통계가 깔끔한 표로 자동 생성됩니다.</li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleCopyAnalyticsTSV}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm shadow-xs transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copied ? '스프레드시트 형식으로 복사 완료!' : '통계표 전체 복사 (Google Sheets용)'}
                </button>

                <button
                  onClick={handleDownloadCSV}
                  className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Excel (.CSV) 파일 다운로드
                </button>
              </div>

              {/* Preview */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  통계 데이터 미리보기 (TSV 서식)
                </label>
                <textarea
                  readOnly
                  rows={9}
                  value={analyticsTSV}
                  className="w-full p-3 font-mono text-3xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 select-all focus:outline-hidden"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/80 rounded-b-2xl">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
