/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceStatus, 
  AttendanceRecord,
  UserRole
} from './types/attendance';
import { 
  generateMonthDays 
} from './data/initialData';
import { 
  loadStudents, 
  saveStudents, 
  loadAttendanceRecords, 
  saveAttendanceRecords,
  loadUserRole,
  saveUserRole,
  loadLockPastDates,
  saveLockPastDates
} from './utils/storage';
import { fetchFromGoogleSheets, syncToGoogleSheets } from './utils/googleSync';
import { Header, ViewTab } from './components/Header';
import { MonthlyGridView } from './components/MonthlyGridView';
import { DailyCheckinView } from './components/DailyCheckinView';
import { StudentRosterView } from './components/StudentRosterView';
import { AnalyticsView } from './components/AnalyticsView';
import { ParentNotificationModal } from './components/ParentNotificationModal';
import { GoogleSheetsExportModal } from './components/GoogleSheetsExportModal';
import { MonthConfigModal } from './components/MonthConfigModal';
import { RoleAuthModal } from './components/RoleAuthModal';
import { ClearAttendanceModal } from './components/ClearAttendanceModal';
import { 
  getRecordKey, 
  isStudentExcluded, 
  isStudentExcludedOnDate, 
  sortStudents, 
  isPastDate, 
  getTodayDateStr,
  isStudentAttendanceLocked
} from './utils/attendanceHelpers';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const getInitialRole = (): UserRole => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get('role');
      if (urlRole === 'admin' || urlRole === 'teacher' || urlRole === 'student') {
        return urlRole as UserRole;
      }
      const hash = window.location.hash.replace(/^#/, '');
      if (hash === 'admin' || hash === 'teacher' || hash === 'student') {
        return hash as UserRole;
      }
      const hashParams = new URLSearchParams(hash);
      const hashRole = hashParams.get('role');
      if (hashRole === 'admin' || hashRole === 'teacher' || hashRole === 'student') {
        return hashRole as UserRole;
      }
    }
    return loadUserRole();
  };

  const [userRole, setUserRole] = useState<UserRole>(() => getInitialRole());
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [targetRoleToSwitch, setTargetRoleToSwitch] = useState<UserRole>(userRole);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('role') !== userRole) {
        url.searchParams.set('role', userRole);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [userRole]);

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      let urlRole = params.get('role');
      if (!urlRole) {
        const hash = window.location.hash.replace(/^#/, '');
        if (hash === 'admin' || hash === 'teacher' || hash === 'student') {
          urlRole = hash;
        } else {
          const hashParams = new URLSearchParams(hash);
          urlRole = hashParams.get('role');
        }
      }
      if (urlRole === 'admin' || urlRole === 'teacher' || urlRole === 'student') {
        setUserRole(urlRole as UserRole);
        saveUserRole(urlRole as UserRole);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<ViewTab>('monthly');
  const [session, setSession] = useState<SessionType>('morning');

  const todayStr = getTodayDateStr();
  const todayYear = parseInt(todayStr.split('-')[0], 10) || 2026;
  const todayMonth = parseInt(todayStr.split('-')[1], 10) || 8;

  const [year, setYear] = useState<number>(todayYear);
  const [month, setMonth] = useState<number>(todayMonth);

  const handleRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    saveUserRole(newRole);
    if (newRole === 'teacher' && (activeTab === 'daily' || activeTab === 'students')) {
      setActiveTab('monthly');
    } else if (newRole === 'student' && (activeTab === 'students' || activeTab === 'analytics')) {
      setActiveTab('monthly');
    }
  };

  const handleOpenRoleModal = (targetRole?: UserRole) => {
    setTargetRoleToSwitch(targetRole || userRole);
    setIsRoleModalOpen(true);
  };

  const [students, setStudents] = useState<Student[]>(() => loadStudents());
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>(() => 
    loadAttendanceRecords()
  );

  // 실시간 동기화 상태 Ref
  const studentsRef = useRef<Student[]>(students);
  studentsRef.current = students;
  const recordsRef = useRef<Record<string, AttendanceRecord>>(records);
  recordsRef.current = records;

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'success' | 'syncing' | 'error'>('success');
  const [lastSyncText, setLastSyncText] = useState<string>('');
  const isInitialRemoteLoadDone = useRef(false);
  const lastUserEditTimeRef = useRef<number>(0);
  const debounceTimerRef = useRef<any>(null);

  // 구글 시트로 확실하게 전체 데이터 동기화 전송
  const triggerRemoteSync = (targetStudents?: Student[], targetRecords?: Record<string, AttendanceRecord>) => {
    const s = targetStudents || studentsRef.current;
    const r = targetRecords || recordsRef.current;

    setIsSyncing(true);
    setSyncStatus('syncing');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await syncToGoogleSheets({
          students: s,
          records: r,
          updatedAt: new Date().toISOString()
        });
        const now = new Date();
        setLastSyncText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
        setSyncStatus('success');
      } catch (err) {
        setSyncStatus('error');
      } finally {
        setIsSyncing(false);
      }
    }, 400);
  };

  // 구글 시트 원격 데이터 불러오기
  const refreshRemoteData = async (showLoading = true) => {
    // 사용자가 방금(15초 이내) 직접 수정한 경우 외부 데이터로 덮어쓰기 엄격 차단
    if (Date.now() - lastUserEditTimeRef.current < 15000 && !showLoading) {
      return;
    }

    if (showLoading) {
      setIsSyncing(true);
      setSyncStatus('syncing');
    }

    try {
      const remote = await fetchFromGoogleSheets();
      if (remote) {
        if (remote.students && Array.isArray(remote.students) && remote.students.length > 0) {
          studentsRef.current = remote.students;
          setStudents(remote.students);
          saveStudents(remote.students);
        }
        if (remote.records && typeof remote.records === 'object') {
          // 로컬에 있는 최신 수정을 유지하면서 원격 데이터 병합
          const merged = { ...remote.records, ...recordsRef.current };
          recordsRef.current = merged;
          setRecords(merged);
          saveAttendanceRecords(merged);
        }
        const now = new Date();
        setLastSyncText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
        setSyncStatus('success');
      }
    } catch (e) {
      setSyncStatus('error');
    } finally {
      if (showLoading) setIsSyncing(false);
      isInitialRemoteLoadDone.current = true;
    }
  };

  useEffect(() => {
    refreshRemoteData(true);
  }, []);

  // 25초마다 주기적 원격 동기화
  useEffect(() => {
    const interval = setInterval(() => {
      refreshRemoteData(false);
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStudents = (newStudents: Student[]) => {
    lastUserEditTimeRef.current = Date.now();
    const sorted = sortStudents(newStudents, [3, 2, 1], true);
    studentsRef.current = sorted;
    setStudents(sorted);
    saveStudents(sorted);
    triggerRemoteSync(sorted, recordsRef.current);
  };

  const [daysConfig, setDaysConfig] = useState<{
    morning: DayConfig[];
    night: DayConfig[];
  }>(() => ({
    morning: generateMonthDays(todayYear, todayMonth, 'morning', (todayYear === 2026 && todayMonth === 8) ? [19, 20, 21, 24, 25, 26, 27, 28, 31] : undefined),
    night: generateMonthDays(todayYear, todayMonth, 'night', (todayYear === 2026 && todayMonth === 8) ? [20, 21, 24, 25, 27, 28, 31] : undefined),
  }));

  const allDaysInMonth = daysConfig[session] || [];
  const activeDays = useMemo(() => allDaysInMonth.filter(d => d.enabled), [allDaysInMonth]);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = getTodayDateStr();
    const initActive = generateMonthDays(todayYear, todayMonth, 'morning', (todayYear === 2026 && todayMonth === 8) ? [19, 20, 21, 24, 25, 26, 27, 28, 31] : undefined).filter(d => d.enabled);
    if (initActive.some(d => d.dateStr === today)) {
      return today;
    }
    return initActive[0]?.dateStr || today;
  });

  useEffect(() => {
    const today = getTodayDateStr();
    if (activeDays.some(d => d.dateStr === today)) {
      setSelectedDateStr(today);
    } else if (activeDays.length > 0 && !activeDays.some(d => d.dateStr === selectedDateStr)) {
      setSelectedDateStr(activeDays[0].dateStr);
    }
  }, [session, activeDays]);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMonthConfigModalOpen, setIsMonthConfigModalOpen] = useState(false);
  const [isClearAttendanceModalOpen, setIsClearAttendanceModalOpen] = useState(false);

  const [lockPastDates, setLockPastDates] = useState<boolean>(() => loadLockPastDates());
  const handleToggleLockPastDates = () => {
    setLockPastDates(prev => {
      const next = !prev;
      saveLockPastDates(next);
      return next;
    });
  };

  const [parentModalData, setParentModalData] = useState<{
    isOpen: boolean;
    dateStr: string;
    list: { student: Student; status: AttendanceStatus; reason?: string }[];
  }>({
    isOpen: false,
    dateStr: selectedDateStr,
    list: [],
  });

  const handleSetYearMonth = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
    const newMorningDays = (newMonth === 8 && newYear === 2026)
      ? generateMonthDays(newYear, newMonth, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31])
      : generateMonthDays(newYear, newMonth, 'morning');
    const newNightDays = (newMonth === 8 && newYear === 2026)
      ? generateMonthDays(newYear, newMonth, 'night', [20, 21, 24, 25, 27, 28, 31])
      : generateMonthDays(newYear, newMonth, 'night');
    setDaysConfig({ morning: newMorningDays, night: newNightDays });
    
    const currentActive = (session === 'morning' ? newMorningDays : newNightDays).filter(d => d.enabled);
    const today = getTodayDateStr();
    if (currentActive.some(d => d.dateStr === today)) {
      setSelectedDateStr(today);
    } else if (currentActive.length > 0) {
      setSelectedDateStr(currentActive[0].dateStr);
    }
  };

  // ★ 완벽한 단일 출결 수정: 즉시 메모리 및 로컬 동기화 + 안전 원격 전송
  const handleUpdateRecord = (
    studentId: string,
    dateStr: string,
    status: AttendanceStatus,
    reason?: string,
    checkInTime?: string
  ) => {
    if (userRole === 'teacher') return;
    if (userRole === 'student') {
      const lockCheck = isStudentAttendanceLocked(session, dateStr);
      if (lockCheck.isLocked) return;
    }

    lastUserEditTimeRef.current = Date.now();
    const key = getRecordKey(studentId, session, dateStr);
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const prevRec = recordsRef.current[key];

    let finalCheckInTime: string | undefined = undefined;
    if (status !== 'NONE') {
      finalCheckInTime = checkInTime !== undefined ? checkInTime : (prevRec?.checkInTime || currentTimestamp);
    }

    const updatedRecord: AttendanceRecord = {
      status,
      reason: reason !== undefined ? reason : prevRec?.reason,
      checkInTime: finalCheckInTime,
    };

    const nextRecords = {
      ...recordsRef.current,
      [key]: updatedRecord,
    };

    // 1. 메모리 Ref 즉시 업데이트 (0ms 지연 없음)
    recordsRef.current = nextRecords;
    // 2. React UI 즉시 반영
    setRecords(nextRecords);
    // 3. 브라우저 로컬 저장
    saveAttendanceRecords(nextRecords);
    // 4. 구글 시트로 안전 전송
    triggerRemoteSync(studentsRef.current, nextRecords);
  };

  const handleBatchUpdateDay = (dateStr: string, status: AttendanceStatus, gradeFilter?: number) => {
    if (userRole === 'teacher' || userRole === 'student') return;
    lastUserEditTimeRef.current = Date.now();
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const nextRecords = { ...recordsRef.current };
    studentsRef.current
      .filter(st => st.active && !isStudentExcluded(st, session, dateStr) && (gradeFilter === undefined || st.grade === gradeFilter))
      .forEach(st => {
        const key = getRecordKey(st.id, session, dateStr);
        nextRecords[key] = {
          status,
          reason: nextRecords[key]?.reason,
          checkInTime: status !== 'NONE' ? (nextRecords[key]?.checkInTime || currentTimestamp) : undefined,
        };
      });

    recordsRef.current = nextRecords;
    setRecords(nextRecords);
    saveAttendanceRecords(nextRecords);
    triggerRemoteSync(studentsRef.current, nextRecords);
  };

  const handleFillDayAbsent = (dateStr: string, gradeFilter?: number) => {
    if (userRole === 'teacher' || userRole === 'student') return;
    lastUserEditTimeRef.current = Date.now();
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const nextRecords = { ...recordsRef.current };
    studentsRef.current
      .filter(st => st.active && !isStudentExcluded(st, session, dateStr) && (gradeFilter === undefined || st.grade === gradeFilter))
      .forEach(st => {
        const key = getRecordKey(st.id, session, dateStr);
        const currentStatus = nextRecords[key]?.status;
        if (!currentStatus || currentStatus === 'NONE') {
          nextRecords[key] = {
            status: 'ABSENT',
            reason: nextRecords[key]?.reason,
            checkInTime: currentTimestamp,
          };
        }
      });

    recordsRef.current = nextRecords;
    setRecords(nextRecords);
    saveAttendanceRecords(nextRecords);
    triggerRemoteSync(studentsRef.current, nextRecords);
  };

  const handleToggleDay = (dateStr: string) => {
    setDaysConfig(prev => ({
      ...prev,
      [session]: prev[session].map(d => (d.dateStr === dateStr ? { ...d, enabled: !d.enabled } : d)),
    }));
  };

  const handleSetPreset = (preset: 'standard' | 'weekdays' | 'sample8' | 'all' | 'none') => {
    if (preset === 'standard') {
      const stdDays = month === 8 && year === 2026
        ? (session === 'morning'
            ? generateMonthDays(year, month, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31])
            : generateMonthDays(year, month, 'night', [20, 21, 24, 25, 27, 28, 31]))
        : generateMonthDays(year, month, session);
      setDaysConfig(prev => ({ ...prev, [session]: stdDays }));
      return;
    }
    setDaysConfig(prev => ({
      ...prev,
      [session]: prev[session].map(d => {
        let isEn = false;
        if (preset === 'weekdays') {
          isEn = session === 'night' 
            ? (d.dayOfWeek !== '토' && d.dayOfWeek !== '일' && d.dayOfWeek !== '수')
            : (d.dayOfWeek !== '토' && d.dayOfWeek !== '일');
        } else if (preset === 'sample8') {
          isEn = session === 'night'
            ? [20, 21, 24, 25, 27, 28, 31].includes(d.dayNum)
            : [19, 20, 21, 24, 25, 26, 27, 28, 31].includes(d.dayNum);
        } else if (preset === 'all') isEn = true;
        return { ...d, enabled: isEn };
      }),
    }));
  };

  const handleClearDate = (dateStr: string, gradeFilter?: number, targetSession?: SessionType | 'both') => {
    lastUserEditTimeRef.current = Date.now();
    const sessionToClear = targetSession || session;
    const nextRecords = { ...recordsRef.current };
    studentsRef.current
      .filter(st => gradeFilter === undefined || st.grade === gradeFilter)
      .forEach(st => {
        if (sessionToClear === 'both') {
          delete nextRecords[getRecordKey(st.id, 'morning', dateStr)];
          delete nextRecords[getRecordKey(st.id, 'night', dateStr)];
        } else {
          delete nextRecords[getRecordKey(st.id, sessionToClear, dateStr)];
        }
      });

    recordsRef.current = nextRecords;
    setRecords(nextRecords);
    saveAttendanceRecords(nextRecords);
    triggerRemoteSync(studentsRef.current, nextRecords);
  };

  const handleClearMonthSession = (targetYear: number, targetMonth: number, targetSession: SessionType | 'both') => {
    lastUserEditTimeRef.current = Date.now();
    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const nextRecords = { ...recordsRef.current };
    Object.keys(nextRecords).forEach(key => {
      const parts = key.split('_');
      if (parts.length >= 3) {
        const keySession = parts[1] as SessionType;
        const keyDate = parts[2];
        const isMatchingSession = targetSession === 'both' || keySession === targetSession;
        if (isMatchingSession && keyDate.startsWith(monthPrefix)) {
          delete nextRecords[key];
        }
      }
    });

    recordsRef.current = nextRecords;
    setRecords(nextRecords);
    saveAttendanceRecords(nextRecords);
    triggerRemoteSync(studentsRef.current, nextRecords);
  };

  const handleClearAll = () => {
    lastUserEditTimeRef.current = Date.now();
    recordsRef.current = {};
    setRecords({});
    saveAttendanceRecords({});
    triggerRemoteSync(studentsRef.current, {});
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Realtime Sync Status Indicator */}
      <div className="bg-slate-900 text-slate-300 text-3xs px-4 py-1 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          {syncStatus === 'syncing' && <span className="w-2 h-2 rounded-full bg-amber-400 animate-spin" />}
          {syncStatus === 'success' && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          {syncStatus === 'error' && <span className="w-2 h-2 rounded-full bg-rose-500" />}
          <span>
            {syncStatus === 'syncing' && '구글 시트에 안전 저장 중...'}
            {syncStatus === 'success' && '구글 시트 실시간 연결됨 (데이터 보호)'}
            {syncStatus === 'error' && '네트워크 지연 (로컬에 안전 보관됨)'}
          </span>
          {lastSyncText && <span className="opacity-60">(마지막 동기화: {lastSyncText})</span>}
        </div>
        <button 
          onClick={() => refreshRemoteData(true)} 
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-indigo-300 font-bold"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>지금 동기화</span>
        </button>
      </div>

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        setSession={setSession}
        year={year}
        month={month}
        setYearMonth={handleSetYearMonth}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenMonthConfigModal={() => setIsMonthConfigModalOpen(true)}
        onClearAttendance={() => setIsClearAttendanceModalOpen(true)}
        studentCount={students.length}
        userRole={userRole}
        onOpenRoleModal={handleOpenRoleModal}
        onDirectSelectRole={handleRoleChange}
        lockPastDates={lockPastDates}
        onToggleLockPastDates={handleToggleLockPastDates}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'monthly' && (
          <MonthlyGridView
            students={students}
            session={session}
            year={year}
            month={month}
            activeDays={activeDays}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onBatchUpdateDay={handleBatchUpdateDay}
            onFillDayAbsent={handleFillDayAbsent}
            onUpdateStudents={handleUpdateStudents}
            onSessionChange={setSession}
            onClearDate={handleClearDate}
            onOpenClearModal={() => setIsClearAttendanceModalOpen(true)}
            userRole={userRole}
            lockPastDates={lockPastDates}
            onToggleLockPastDates={handleToggleLockPastDates}
          />
        )}

        {activeTab === 'daily' && (
          <DailyCheckinView
            students={students}
            session={session}
            setSession={setSession}
            activeDays={activeDays}
            selectedDateStr={selectedDateStr}
            setSelectedDateStr={setSelectedDateStr}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onBatchUpdateDay={handleBatchUpdateDay}
            onFillDayAbsent={handleFillDayAbsent}
            onOpenParentModal={list => {
              setParentModalData({
                isOpen: true,
                dateStr: selectedDateStr,
                list,
              });
            }}
            onClearDate={handleClearDate}
            onOpenClearModal={() => setIsClearAttendanceModalOpen(true)}
            userRole={userRole}
            lockPastDates={lockPastDates}
            onToggleLockPastDates={handleToggleLockPastDates}
          />
        )}

        {activeTab === 'students' && (
          <StudentRosterView
            students={students}
            onUpdateStudents={handleUpdateStudents}
            userRole={userRole}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            students={students}
            session={session}
            year={year}
            month={month}
            activeDays={activeDays}
            records={records}
            userRole={userRole}
          />
        )}
      </main>

      <RoleAuthModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        targetRole={targetRoleToSwitch}
        currentRole={userRole}
        onConfirmRole={handleRoleChange}
      />

      <GoogleSheetsExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        session={session}
        year={year}
        month={month}
        activeDays={activeDays}
        students={students}
        records={records}
      />

      <MonthConfigModal
        isOpen={isMonthConfigModalOpen}
        onClose={() => setIsMonthConfigModalOpen(false)}
        session={session}
        year={year}
        month={month}
        allDaysInMonth={allDaysInMonth}
        onToggleDay={handleToggleDay}
        onSetPreset={handleSetPreset}
      />

      <ParentNotificationModal
        isOpen={parentModalData.isOpen}
        onClose={() => setParentModalData(prev => ({ ...prev, isOpen: false }))}
        session={session}
        dateStr={parentModalData.dateStr}
        absentList={parentModalData.list}
      />

      <ClearAttendanceModal
        isOpen={isClearAttendanceModalOpen}
        onClose={() => setIsClearAttendanceModalOpen(false)}
        year={year}
        month={month}
        session={session}
        activeDays={activeDays}
        currentSelectedDateStr={selectedDateStr}
        onClearDate={handleClearDate}
        onClearMonthSession={handleClearMonthSession}
        onClearAll={handleClearAll}
        userRole={userRole}
        onOpenRoleModal={() => handleOpenRoleModal('admin')}
      />

    </div>
  );
}
