/**
 * 자율학습 출결 관리 시스템 - 구글 스프레드시트 연동 Apps Script
 * 
 * [배포 방법]
 * 1. 구글 스프레드시트 생성 (이름: 자율학습 출결관리 DB)
 * 2. [확장 프로그램] > [Apps Script] 클릭
 * 3. 아래 코드를 전부 붙여넣고 저장(Ctrl+S)
 * 4. 우측 상단 [배포] > [새 배포] 클릭
 * 5. 유형: "웹 앱(Web App)" 선택
 * 6. 설정:
 *    - 설명: 출결 동기화 API v1.0
 *    - 다음 사용자로 실행: "나(내 계정)"
 *    - 액세스 권한: "모든 사용자(Anyone)"  <-- 다른 기기 접근을 위해 필수!
 * 7. [배포] 클릭 후 생성된 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 복사하여
 *    프론트엔드의 .env 또는 googleSync.ts 에 설정합니다.
 */

function doGet(e) {
  const action = (e && e.parameter) ? e.parameter.action : 'getData';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getData') {
    const dataSheet = ss.getSheetByName('DB') || ss.insertSheet('DB');
    const rawData = dataSheet.getRange('A1').getValue();
    let parsed = { students: null, records: null, updatedAt: new Date().toISOString() };
    if (rawData && typeof rawData === 'string' && rawData.trim() !== '') {
      try {
        parsed = JSON.parse(rawData);
      } catch (err) {
        console.error('JSON Parse Error:', err);
      }
    }
    return ContentService.createTextOutput(JSON.stringify(parsed))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', time: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No post data' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const contents = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName('DB') || ss.insertSheet('DB');
    
    // DB 시트 A1 셀에 최신 출결 및 학생 상태 저장
    dataSheet.getRange('A1').setValue(JSON.stringify(contents));
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      timestamp: new Date().toISOString() 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
