import React, { useState, useEffect } from 'react';
import { 
  Eraser, 
  X, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Layers,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { SessionType, DayConfig, UserRole } from '../types/attendance';

interface ClearAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  session: SessionType;
  activeDays: DayConfig[];
  currentSelectedDateStr?: string;
  onClearDate: (dateStr: string, gradeFilter?: number, targetSession?: SessionType | 'both') => void;
  onClearMonthSession: (year: number, month: number, session: SessionType | 'both') => void;
  onClearAll: () => void;
  userRole?: UserRole;
  onOpenRoleModal?: () => void;
}

export const ClearAttendanceModal: React.FC<ClearAttendanceModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  session,
  activeDays,
  currentSelectedDateStr,
  onClearDate,
  onClearMonthSession,
  onClearAll,
  userRole = 'admin',
  onOpenRoleModal,
}) => {
  const [clearScope, setClearScope] = useState<'single-day' | 'all' | 'month-session'>('single-day');
  const [targetDateStr, setTargetDateStr] = useState<string>(() => {
    return currentSelectedDateStr || activeDays[0]?.dateStr || `${year}-${String(month).padStart(2, '0')}-19`;
  });
  const [targetGrade, setTargetGrade] = useState<number | 'all'>('all');
  const [targetSessionOption, setTargetSessionOption] = useState<SessionType | 'both'>(session);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Sync targetDateStr when currentSelectedDateStr or activeDays changes
  useEffect(() => {
    if (currentSelectedDateStr && activeDays.some(d => d.dateStr === currentSelectedDateStr)) {
      setTargetDateStr(currentSelectedDateStr);
    } else if (activeDays.length > 0 && !activeDays.some(d => d.dateStr === targetDateStr)) {
      setTargetDateStr(activeDays[0].dateStr);
    }
  }, [currentSelectedDateStr, activeDays, isOpen]);

  // Sync session option
  useEffect(() => {
    setTargetSessionOption(session);
  }, [session, isOpen]);

  if (!isOpen) return null;

  const isAdmin = userRole === 'admin';
  const sessionLabel = session === 'morning' ? '아침 자율학습' : '야간 자율학습';
  const targetDay = activeDays.find(d => d.dateStr === targetDateStr);

  const getTargetSessionLabel = (opt: SessionType | 'both') => {
    if (opt === 'both') return '아침 및 야간 자습 모두';
    if (opt === 'morning') return '아침 자율학습만';
    return '야간 자율학습만';
  };

  const handleExecuteClear = () => {
    if (!isAdmin) return;

    if (clearScope === 'single-day') {
      onClearDate(targetDateStr, targetGrade === 'all' ? undefined : targetGrade, targetSessionOption);
      const gradeText = targetGrade === 'all' ? '전체 학년' : `${targetGrade}학년`;
      const sessionText = getTargetSessionLabel(targetSessionOption);
      setSuccessMessage(`${targetDateStr} (${sessionText}) ${gradeText} 출결 기록이 초기화되었습니다.`);
    } else if (clearScope === 'all') {
      onClearAll();
      setSuccessMessage(`모든 기간/세션의 출결 기록이 완전히 초기화되었습니다. (학생 명단은 안전하게 유지됩니다)`);
    } else if (clearScope === 'month-session') {
      onClearMonthSession(year, month, targetSessionOption);
      const sessionText = getTargetSessionLabel(targetSessionOption);
      setSuccessMessage(`${year}년 ${month}월 ${sessionText} 전체 출결 기록이 초기화되었습니다.`);
    }

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <Eraser className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  출결 기록 비우기 (초기화)
                </h2>
                <span className="text-3xs font-extrabold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  관리자 전용
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                특정 날짜만 비우거나 전체 기간 출결을 깔끔하게 초기화합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {!isAdmin ? (
            /* Admin Only Permission Guard */
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  관리자 권한 필요
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  출결 비우기(초기화) 기능은 데이터 유실 방지를 위해 <strong>관리자(Admin)</strong>만 사용할 수 있습니다. 관리자로 전환 후 이용해 주세요.
                </p>
              </div>
              {onOpenRoleModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRoleModal();
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  관리자 모드로 전환하기 (PIN 입력)
                </button>
              )}
            </div>
          ) : isSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 animate-in zoom-in" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                출결 초기화 완료
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs font-medium">
                {successMessage}
              </p>
            </div>
          ) : (
            <>
              {/* Fast Tab Switcher for clear mode */}
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setClearScope('single-day')}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    clearScope === 'single-day'
                      ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>해당 날짜만 비우기</span>
                </button>

                <button
                  type="button"
                  onClick={() => setClearScope('all')}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    clearScope === 'all'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>전체 출결 비우기</span>
                </button>

                <button
                  type="button"
                  onClick={() => setClearScope('month-session')}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    clearScope === 'month-session'
                      ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>이번 달({month}월) 비우기</span>
                </button>
              </div>

              {/* Mode Details */}
              {clearScope === 'single-day' && (
                <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      1. 특정 날짜만 비우기 (일별 초기화)
                    </span>
                    <span className="text-3xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      추천
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    선택한 날짜의 출결만 빈칸으로 지웁니다. 다른 날짜의 기록은 안전하게 보존됩니다.
                  </p>

                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Date select */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        초기화할 날짜
                      </label>
                      <select
                        value={targetDateStr}
                        onChange={e => setTargetDateStr(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        {activeDays.map(d => (
                          <option key={d.dateStr} value={d.dateStr}>
                            {d.dateStr} ({d.dayOfWeek}요일)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Session select */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        대상 자습 세션
                      </label>
                      <select
                        value={targetSessionOption}
                        onChange={e => setTargetSessionOption(e.target.value as SessionType | 'both')}
                        className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value={session}>현재 세션만 ({sessionLabel})</option>
                        <option value="both">아침 + 야간 모두 비우기</option>
                        <option value="morning">아침 자율학습만</option>
                        <option value="night">야간 자율학습만</option>
                      </select>
                    </div>

                    {/* Grade select */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        대상 학년 선택
                      </label>
                      <select
                        value={targetGrade}
                        onChange={e => setTargetGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">전체 학년 (1~3학년 전체)</option>
                        <option value={3}>3학년만 비우기</option>
                        <option value={2}>2학년만 비우기</option>
                        <option value={1}>1학년만 비우기</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {clearScope === 'all' && (
                <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      2. 전체 출결 완전 초기화 (전체 기간/모든 세션)
                    </span>
                    <span className="text-3xs font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                      주의
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    등록된 모든 월(8월~12월)과 모든 세션(아침/야간)의 출결 기록을 <strong>완전한 백지 상태</strong>로 깨끗이 초기화합니다.
                  </p>
                  <div className="p-2.5 bg-rose-100/60 dark:bg-rose-900/40 rounded-lg text-2xs text-rose-900 dark:text-rose-200 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>실행 시 모든 출결 데이터가 즉시 삭제됩니다. 학생 명단(45명)은 안전하게 보존됩니다.</span>
                  </div>
                </div>
              )}

              {clearScope === 'month-session' && (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-600" />
                      3. 이번 달({year}년 {month}월) 전체 비우기
                    </span>
                    <span className="text-3xs font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                      월별 초기화
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>{year}년 {month}월</strong>에 해당하는 모든 운영일의 출결 기록을 한 번에 비웁니다.
                  </p>

                  <div className="pt-2 border-t border-amber-100 dark:border-amber-900/40">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      대상 세션
                    </label>
                    <select
                      value={targetSessionOption}
                      onChange={e => setTargetSessionOption(e.target.value as SessionType | 'both')}
                      className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    >
                      <option value={session}>{month}월 {sessionLabel}만 비우기</option>
                      <option value="both">{month}월 아침 + 야간 모두 비우기</option>
                      <option value="morning">{month}월 아침 자율학습만</option>
                      <option value="night">{month}월 야간 자율학습만</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Safety notice */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  초기화를 실행해도 <strong>학생 명단(45명) 및 학적/연락처 정보는 안전하게 유지</strong>됩니다.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {isAdmin && !isSuccess && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleExecuteClear}
              className={`px-5 py-2 rounded-xl text-white text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
                clearScope === 'all'
                  ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                  : clearScope === 'month-session'
                  ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
            >
              <Eraser className="w-4 h-4" />
              {clearScope === 'single-day'
                ? `선택 날짜 (${targetDateStr}) 비우기`
                : clearScope === 'month-session'
                ? `${month}월 출결 비우기`
                : '전체 출결 완전 초기화'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

