/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Student, SessionType, DayConfig, AttendanceRecord } from '../types/attendance';
import { getRecordKey, isStudentExcluded } from '../utils/attendanceHelpers';
import { TrendingUp, Award } from 'lucide-react';

export const AnalyticsView: React.FC<any> = (props) => {
  const {
    students = [],
    session = 'morning',
    activeDays = [],
    records = {},
  } = props;

  const activeStudents: Student[] = useMemo(() => {
    return (students as Student[]).filter(s => s.active);
  }, [students]);

  // 학년별 및 전체 합계 통계 (100% 초과 방지 및 수식 보정)
  const statsSummary = useMemo(() => {
    const grades = [3, 2, 1];
    const gradeResults = grades.map(grade => {
      const gStudents = activeStudents.filter(s => s.grade === grade);
      let totalEligible = 0;
      let presentCount = 0;
      let lateCount = 0;
      let earlyCount = 0;
      let officialCount = 0;
      let absentCount = 0;

      gStudents.forEach(st => {
        (activeDays as DayConfig[]).forEach(day => {
          if (!isStudentExcluded(st, session as SessionType, day.dateStr)) {
            totalEligible += 1;
            const key = getRecordKey(st.id, session as SessionType, day.dateStr);
            const status = (records as Record<string, AttendanceRecord>)[key]?.status;
            if (status === 'PRESENT') presentCount += 1;
            else if (status === 'LATE') lateCount += 1;
            else if (status === 'EARLY_LEAVE') earlyCount += 1;
            else if (status === 'OFFICIAL_ABSENT') officialCount += 1;
            else if (status === 'ABSENT') absentCount += 1;
          }
        });
      });

      const effectivePresent = presentCount + (lateCount * 0.7) + (earlyCount * 0.7) + officialCount;
      const rate = totalEligible > 0 ? Math.min(100, Math.round((effectivePresent / totalEligible) * 100)) : 0;
      const attended = presentCount + lateCount + earlyCount + officialCount;

      return {
        grade,
        studentCount: gStudents.length,
        rate,
        totalEligible,
        attended: Math.min(attended, totalEligible),
        presentCount,
        lateCount,
        absentCount
      };
    });

    const totalStudents = activeStudents.length;
    const totalEligible = gradeResults.reduce((acc, cur) => acc + cur.totalEligible, 0);
    const totalAttended = gradeResults.reduce((acc, cur) => acc + cur.attended, 0);
    const totalRate = totalEligible > 0 ? Math.min(100, Math.round((totalAttended / totalEligible) * 100)) : 0;

    return {
      gradeResults,
      totalStudents,
      totalEligible,
      totalAttended,
      totalRate
    };
  }, [activeStudents, activeDays, session, records]);

  // 학생별 랭킹 통계
  const studentRankings = useMemo(() => {
    return activeStudents.map(st => {
      let eligibleDays = 0;
      let attendedDays = 0;
      let present = 0;
      let late = 0;
      let early = 0;
      let official = 0;
      let absent = 0;

      (activeDays as DayConfig[]).forEach(day => {
        if (!isStudentExcluded(st, session as SessionType, day.dateStr)) {
          eligibleDays += 1;
          const key = getRecordKey(st.id, session as SessionType, day.dateStr);
          const s = (records as Record<string, AttendanceRecord>)[key]?.status;
          if (s === 'PRESENT') { present += 1; attendedDays += 1; }
          else if (s === 'LATE') { late += 1; attendedDays += 1; }
          else if (s === 'EARLY_LEAVE') { early += 1; attendedDays += 1; }
          else if (s === 'OFFICIAL_ABSENT') { official += 1; attendedDays += 1; }
          else if (s === 'ABSENT') { absent += 1; }
        }
      });

      const effectivePresent = present + (late * 0.7) + (early * 0.7) + official;
      const rate = eligibleDays > 0 ? Math.min(100, Math.round((effectivePresent / eligibleDays) * 100)) : 0;

      return {
        student: st,
        eligibleDays,
        attendedDays: Math.min(attendedDays, eligibleDays),
        rate,
        present,
        late,
        absent
      };
    }).sort((a, b) => b.rate - a.rate || a.student.grade - b.student.grade || a.student.classNum - b.student.classNum);
  }, [activeStudents, activeDays, session, records]);

  return (
    <div className="space-y-6">
      {/* 1. 상단 학년별 및 전체 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsSummary.gradeResults.map(stat => (
          <div key={stat.grade} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-slate-800 dark:text-slate-100">{stat.grade}학년 자율학습 현황</span>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium text-slate-600 dark:text-slate-400">
                {stat.studentCount}명
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{stat.rate}%</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {stat.attended} / {stat.totalEligible} 누적 출석
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stat.grade === 3 ? 'bg-indigo-600' : stat.grade === 2 ? 'bg-emerald-500' : 'bg-purple-600'
                }`} 
                style={{ width: `${stat.rate}%` }}
              />
            </div>
          </div>
        ))}

        {/* 전체 합계 카드 */}
        <div className="bg-indigo-900 text-white p-5 rounded-2xl shadow-sm border border-indigo-800">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold">전체 누적 출석률</span>
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium text-white">
              총 {statsSummary.totalStudents}명
            </span>
          </div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-3xl font-black">{statsSummary.totalRate}%</span>
            <span className="text-xs opacity-80 font-medium">
              {statsSummary.totalAttended} / {statsSummary.totalEligible} 누적
            </span>
          </div>
          <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${statsSummary.totalRate}%` }} />
          </div>
        </div>
      </div>

      {/* 2. 학생별 상세 랭킹 테이블 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">학생별 성실도 및 출석 현황</h3>
          </div>
          <span className="text-xs text-slate-500">총 {studentRankings.length}명</span>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 text-center">순위</th>
                <th className="py-3 px-4">학년-반-번호</th>
                <th className="py-3 px-4">이름</th>
                <th className="py-3 px-4 text-center">출석률</th>
                <th className="py-3 px-4 text-center">출석</th>
                <th className="py-3 px-4 text-center">지각</th>
                <th className="py-3 px-4 text-center">결석</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {studentRankings.map((item, index) => (
                <tr key={item.student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-center font-bold">
                    {index === 0 ? <Award className="w-4 h-4 text-amber-500 inline" /> : index + 1}
                  </td>
                  <td className="py-3 px-4 font-mono">{item.student.grade}-{item.student.classNum}-{item.student.studentNum}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{item.student.name}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                      item.rate >= 90 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' :
                      item.rate >= 80 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40' :
                      'bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                    }`}>
                      {item.rate}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-semibold">{item.present}</td>
                  <td className="py-3 px-4 text-center text-amber-600 font-semibold">{item.late}</td>
                  <td className="py-3 px-4 text-center text-rose-600 font-semibold">{item.absent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
```[cite: 1]

---

이 파일만 커밋하시면 디자인 변경 없이 111%, 120%가 나오던 통계 수치가 **100% 한도 내의 실제 출석률**로 계산됩니다[cite: 1].
