# 📚 미래인재반 자율학습 출석부 관리 시스템

고등학교 자율학습(아침 07:30~08:40 / 저녁 17:30~21:30) 출결 관리, 학부모 알림톡/문자 양식 생성, 구글 스프레드시트 실시간 동기화 웹 앱입니다.

---

## 🚀 빠른 시작 (로컬 실행)

1. **패키지 설치**
   ```bash
   npm install
   ```

2. **개발 서버 실행**
   ```bash
   npm run dev
   ```

3. **프로덕션 빌드**
   ```bash
   npm run build
   ```

---

## 🌐 깃허브(GitHub) 및 Vercel 배포 방법

### 1) 깃허브(GitHub) 업로드
```bash
git init
git add .
git commit -m "feat: 자율학습 출결 관리 시스템 깃허브 배포"
git branch -M main
git remote add origin https://github.com/당신의아이디/리포지토리이름.git
git push -u origin main
```

### 2) 무료 호스팅 배포 (Vercel 추천)
1. [Vercel](https://vercel.com) 로그인 (GitHub 계정 연동)
2. **Add New...** > **Project** 선택 후 방금 올린 GitHub 저장소 Import
3. **Deploy** 클릭 → 약 1분 후 `https://your-project.vercel.app` 형태의 접속 주소 발급

---

## 📱 역할별 접속 URL (다른 기기 및 공유용)

해시(`#`) 또는 파라미터(`?role=`)를 사용하여 교사, 학생에게 맞춤 권한 URL을 바로 전달할 수 있습니다.

* **관리자(Admin) 모드**: `https://당신의도메인/#admin` (또는 `?role=admin`)
  * PIN 번호 인증 (기본 PIN: `4706`, 변경 가능)
  * 전체 출석부 수정, 학생 명단 관리, 월별 일정 설정, 데이터 초기화
* **감독 교사(Teacher) 모드**: `https://당신의도메인/#teacher` (또는 `?role=teacher`)
  * 출석 현황 실시간 조회 및 분석(통계) 전용
* **학생(Student) 모드**: `https://당신의도메인/#student` (또는 `?role=student`)
  * 당일 자율학습 체크인 (아침 자습은 09:00 이후 자동 마감)

---

## 📊 구글 스프레드시트 동기화 (Apps Script 설정)

1. [Google 스프레드시트](https://sheets.new)를 새로 만듭니다.
2. 상단 메뉴 **[확장 프로그램]** > **[Apps Script]** 클릭
3. 프로젝트 내 `google-apps-script.js` 파일의 전체 내용을 복사하여 붙여넣고 저장합니다.
4. 우측 상단 **[배포]** > **[새 배포]** 선택:
   * **유형**: 웹 앱(Web App)
   * **설명**: 출결 동기화 API
   * **다음 사용자로 실행**: 나(내 계정)
   * **액세스 권한**: **모든 사용자(Anyone)** *(필수)*
5. 배포 완료 후 나온 **웹 앱 URL**을 복사합니다.
6. 프로젝트의 `.env` 파일에 `VITE_GOOGLE_SHEETS_API_URL="복사한URL"` 로 설정하거나 `src/utils/googleSync.ts` 파일의 `GOOGLE_SHEETS_API_URL` 상수에 직접 붙여넣습니다.
