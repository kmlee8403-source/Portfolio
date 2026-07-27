# 포트폴리오 시각적 편집기 설정

이 편집기는 포트폴리오에 관리자 로그인 화면을 노출하지 않습니다. Google 계정으로 접근이 제한된 Apps Script 전용 주소에서만 편집하고, 방문자는 기존 GitHub Pages 주소만 보게 됩니다.

## 구성

- 공개 포트폴리오: `https://kmlee8403-source.github.io/Portfolio/`
- 공개 백엔드: 기존 Apps Script 웹 앱 배포
- 비공개 편집기: 같은 Apps Script 프로젝트의 별도 웹 앱 배포
- 콘텐츠 저장: Apps Script 소유자의 Google Drive `Portfolio CMS` 폴더
- Gemini 키: Apps Script의 `GEMINI_API_KEY` 스크립트 속성

## Apps Script 속성

Apps Script의 **프로젝트 설정 → 스크립트 속성**에 다음 값을 둡니다.

- `GEMINI_API_KEY`: Google AI Studio에서 발급한 키
- `EDITOR_EMAIL`: 편집을 허용할 Google 계정 이메일

키 값은 HTML이나 GitHub 저장소에 넣지 않습니다.

## 권장 배포 방식

1. 기존 공개 웹 앱 배포는 URL을 유지한 채 새 버전으로 업데이트합니다.
2. 같은 프로젝트에서 편집기용 웹 앱 배포를 하나 더 만듭니다.
3. 편집기 배포의 접근 권한은 **나만**으로 제한합니다.
4. 편집 주소 끝에 `?mode=editor&page=index`를 붙여 북마크합니다.

예시:

`https://script.google.com/macros/s/편집기_배포_ID/exec?mode=editor&page=index`

공개 배포는 콘텐츠 읽기와 기존 강좌 진단을 담당하고, 비공개 배포는 편집·임시 저장·게시·버전 복원·Gemini 문구 다듬기를 담당합니다.

## 사용법

1. 편집 주소를 엽니다.
2. 문구를 더블클릭하면 큰 문구 편집창이 열립니다.
3. 편집창에서 원문과 수정문을 비교하고, 필요하면 Gemini 수정안을 만든 뒤 `이 문구 적용`을 누릅니다.
4. 목록 항목을 클릭한 뒤 추가, 복제, 이동, 삭제할 수 있습니다.
5. 강의 카드는 편집 패널에서 교육 대상, 기관, 기간, 상세 설명, 검색 키워드도 수정할 수 있습니다.
6. `임시 저장`으로 작업을 보관하거나 `사이트에 게시`로 방문자 화면에 반영합니다.
7. 문제가 있으면 이전 게시 버전을 선택해 복원합니다.
