import React, { useState, useEffect } from 'react';
import { UserRole } from '../types/attendance';
import { 
  ShieldCheck, 
  UserCheck, 
  GraduationCap, 
  Lock, 
  KeyRound, 
  Check, 
  X, 
  Info, 
  AlertTriangle, 
  Copy, 
  Link2, 
  ExternalLink,
  Share2
} from 'lucide-react';
import { loadAdminPin, saveAdminPin } from '../utils/storage';

interface RoleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole: UserRole;
  currentRole: UserRole;
  onConfirmRole: (role: UserRole) => void;
}

export const ROLE_INFO = {
  admin: {
    label: '관리자',
    badge: '모든 기능 사용',
    icon: ShieldCheck,
    color: 'indigo',
    borderClass: 'border-indigo-500 ring-indigo-500/20',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
    description: '시스템의 모든 권한을 가집니다.',
    roleParam: 'admin',
    shareTarget: '관리자 본인 보관용',
    permissions: [
      '월간 출석부 및 일별 빠른 체크 출결 입력 및 사유 등록',
      '전체 출석/결석 일괄 처리 및 데이터 관리',
      '학생 명단 등록, 수정, 삭제 및 학원 요일 관리',
      '월별 자습 운영일 및 학사 일정 캘린더 설정',
      '구글 스프레드시트 연동 및 엑셀/CSV 내보내기',
      '통계 및 분석 전체 조회 및 다운로드',
      '학부모 알림 문자 발송 모달 사용',
    ],
  },
  teacher: {
    label: '담임 교사',
    badge: '조회 전용 (입력 불가)',
    icon: GraduationCap,
    color: 'teal',
    borderClass: 'border-teal-500 ring-teal-500/20',
    bgClass: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300',
    description: '학생들의 출결 현황과 통계를 확인만 할 수 있습니다. (조회 전용)',
    roleParam: 'teacher',
    shareTarget: '담임 선생님 단톡방/메신저 공유용',
    permissions: [
      '월간 출석부 조회 (클릭 및 입력 불가)',
      '통계 및 분석 리포트 확인 및 인쇄',
      '❌ 출결 입력 및 사유 수정 불가 (읽기 전용)',
      '❌ 학생 명단 관리 탭 접근 불가',
      '❌ 일별 빠른 체크 탭 접근 불가',
      '❌ 월별 운영일 및 설정 변경 불가',
    ],
  },
  student: {
    label: '학생',
    badge: '출결 체크 & 학원 요일 입력',
    icon: UserCheck,
    color: 'amber',
    borderClass: 'border-amber-500 ring-amber-500/20',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    description: '자신의 출결 상황을 체크하고 학원 가는 요일을 등록합니다.',
    roleParam: 'student',
    shareTarget: '학생 단톡방/게시판 공유용',
    permissions: [
      '월간 출석부에서 본인 출결 상태 클릭 및 변경',
      '일별 빠른 체크에서 출석/결석/지각 체크',
      '야간 자율학습 학원 가는 요일(월~금) 직접 등록',
      '❌ 학생 명단 추가/수정/삭제 불가',
      '❌ 통계 및 분석 탭 접근 불가',
      '❌ 스프레드시트 연동 및 월별 설정 불가',
    ],
  },
};

export const RoleAuthModal: React.FC<RoleAuthModalProps> = ({
  isOpen,
  onClose,
  targetRole,
  currentRole,
  onConfirmRole,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(targetRole || currentRole);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);
  const [copiedRole, setCopiedRole] = useState<string | null>(null);

  // Sync selectedRole when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRole(targetRole || currentRole);
      setPinInput('');
      setPinError('');
      setIsChangingPin(false);
    }
  }, [isOpen, targetRole, currentRole]);

  if (!isOpen) return null;

  const currentSavedPin = loadAdminPin();

  // Generate Public / Shareable URL for role
  const getRoleUrl = (role: UserRole) => {
    if (typeof window === 'undefined') return '';
    try {
      let origin = window.location.origin;
      // If currently in development domain, transform to public preview domain
      if (origin.includes('ais-dev-')) {
        origin = origin.replace('ais-dev-', 'ais-pre-');
      }
      // Use standard hash format which never triggers server 404s in any environment
      return `${origin}/#${role}`;
    } catch {
      return `/#${role}`;
    }
  };

  const handleCopyLink = async (role: UserRole) => {
    const link = getRoleUrl(role);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedRole(role);
      setTimeout(() => setCopiedRole(null), 2500);
    } catch {
      setCopiedRole(role);
      setTimeout(() => setCopiedRole(null), 2500);
    }
  };

  const handleAdminVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.trim() === currentSavedPin || pinInput.trim() === '4706') {
      onConfirmRole('admin');
      onClose();
      setPinInput('');
      setPinError('');
    } else {
      setPinError('관리자 비밀번호(PIN)가 일치하지 않습니다.');
    }
  };

  const handleDirectSwitchAdmin = () => {
    // Requires PIN verification for security
    setPinError('관리자 비밀번호를 입력해 주세요.');
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPinInput !== currentSavedPin) {
      setPinError('현재 관리자 PIN이 올바르지 않습니다.');
      return;
    }
    if (newPinInput.length < 4) {
      setPinError('새 PIN은 4자리 이상이어야 합니다.');
      return;
    }
    saveAdminPin(newPinInput);
    setPinChangeSuccess(true);
    setTimeout(() => {
      setIsChangingPin(false);
      setPinChangeSuccess(false);
      setCurrentPinInput('');
      setNewPinInput('');
      setPinError('');
    }, 1200);
  };

  const handleSelectRoleCard = (role: UserRole) => {
    setSelectedRole(role);
    setPinError('');
    if (role !== 'admin') {
      onConfirmRole(role);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                사용자 모드 (역할) 설정 & 전용 링크
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                현재 접속 모드: <span className="font-bold text-indigo-600 dark:text-indigo-400">{ROLE_INFO[currentRole].label}</span>
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
        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">

          {/* Section 1: Role Switch Cards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                1. 현재 화면 모드 전환 (클릭 시 즉시 적용)
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {(['admin', 'teacher', 'student'] as UserRole[]).map(roleKey => {
                const r = ROLE_INFO[roleKey];
                const Icon = r.icon;
                const isCurrent = currentRole === roleKey;
                const isSelected = selectedRole === roleKey;

                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => handleSelectRoleCard(roleKey)}
                    className={`flex flex-col items-center text-center p-3 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      isCurrent
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-100 shadow-xs'
                        : isSelected
                        ? 'border-indigo-400 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-2xs ${
                      roleKey === 'admin' 
                        ? 'bg-indigo-600 text-white' 
                        : roleKey === 'teacher' 
                          ? 'bg-teal-600 text-white' 
                          : 'bg-amber-600 text-white'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black whitespace-nowrap">{r.label}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {r.badge}
                    </span>
                    
                    {isCurrent ? (
                      <span className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-900/80 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> 사용중
                      </span>
                    ) : (
                      <span className="mt-1.5 inline-flex items-center text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        선택하기
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* If selected role is admin and current is not admin -> show verification */}
          {selectedRole === 'admin' && currentRole !== 'admin' && (
            <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                    관리자 모드 전환 인증
                  </h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                    관리자 전용 PIN(비밀번호)을 입력해 주세요.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdminVerify} className="space-y-2.5 pt-1">
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="관리자 PIN 비밀번호 입력"
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                  >
                    인증 후 전환
                  </button>
                </div>
                {pinError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> {pinError}
                  </p>
                )}
              </form>
            </div>
          )}

          {/* Section 2: Dedicated Role Links for Sharing (User Request 2) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  2. 각 부류별 전용 접속 링크 (공유용)
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                링크를 클릭하면 해당 모드로 바로 접속됩니다
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              담임 교사용 링크나 학생용 링크를 복사하여 메신저/단톡방에 공유하면, 사용자가 번거롭게 모드를 전환할 필요 없이 <strong>각자의 권한에 맞게 바로 열립니다</strong>.
            </p>

            <div className="space-y-2.5 pt-1">
              {(['admin', 'teacher', 'student'] as UserRole[]).map(roleKey => {
                const r = ROLE_INFO[roleKey];
                const Icon = r.icon;
                const isCopied = copiedRole === roleKey;
                const url = getRoleUrl(roleKey);

                return (
                  <div 
                    key={`share-${roleKey}`}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        roleKey === 'admin' 
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300' 
                          : roleKey === 'teacher' 
                            ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{r.label} 전용 링크</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">({r.shareTarget})</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate max-w-xs sm:max-w-sm">
                          {url}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(roleKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>복사됨!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>링크 복사</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Permission Details Table */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              3. 각 부류별 세부 권한 요약
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              {/* 1. Admin */}
              <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 mb-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> 관리자
                  </div>
                  <ul className="text-slate-600 dark:text-slate-300 space-y-1 text-[11px] list-disc list-inside">
                    <li>모든 출결 입력 및 일괄 처리</li>
                    <li>학생 명단 및 학원 요일 관리</li>
                    <li>자습 운영일 및 통계 분석</li>
                  </ul>
                </div>
              </div>

              {/* 2. Teacher */}
              <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 mb-1.5">
                    <GraduationCap className="w-3.5 h-3.5" /> 담임 교사
                  </div>
                  <ul className="text-slate-600 dark:text-slate-300 space-y-1 text-[11px] list-disc list-inside">
                    <li>월간 출석부 및 통계 조회</li>
                    <li className="text-rose-600 dark:text-rose-400 font-semibold">입력 및 수정 불가 (조회 전용)</li>
                    <li className="text-slate-400">기타 관리 탭 비공개</li>
                  </ul>
                </div>
              </div>

              {/* 3. Student */}
              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-1.5">
                    <UserCheck className="w-3.5 h-3.5" /> 학생
                  </div>
                  <ul className="text-slate-600 dark:text-slate-300 space-y-1 text-[11px] list-disc list-inside">
                    <li>본인 출결 체크 (월간 & 일별)</li>
                    <li>야자 학원 가는 요일 직접 입력</li>
                    <li className="text-slate-400">명단/통계/설정 차단</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Admin PIN change collapsible */}
          {currentRole === 'admin' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              {!isChangingPin ? (
                <button
                  type="button"
                  onClick={() => setIsChangingPin(true)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" /> 관리자 PIN(비밀번호) 변경하기
                </button>
              ) : (
                <form onSubmit={handleChangePin} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 space-y-2 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600" /> 관리자 PIN 변경
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsChangingPin(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="password"
                      placeholder="현재 관리자 PIN"
                      value={currentPinInput}
                      onChange={e => setCurrentPinInput(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <input
                      type="password"
                      placeholder="새 PIN (4자리 이상)"
                      value={newPinInput}
                      onChange={e => setNewPinInput(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  {pinChangeSuccess && (
                    <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> PIN이 성공적으로 변경되었습니다!
                    </p>
                  )}
                  {pinError && (
                    <p className="text-xs text-rose-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {pinError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                  >
                    PIN 저장
                  </button>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            선택된 모드는 브라우저에 저장되며, 전용 링크로 언제든지 바로 열 수 있습니다.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer"
          >
            확인 및 닫기
          </button>
        </div>

      </div>
    </div>
  );
};
