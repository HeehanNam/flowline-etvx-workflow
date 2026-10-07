# GitLab 로그인 설정

## 기존 DB 유지

서버 종료 후 `data/flowline.db`를 별도 폴더에 백업하세요. 프로그램 파일만 교체하며 기존 DB는 그대로 사용합니다. 기존 체크의 작성자·시각은 기록 없음으로 표시됩니다.

## GitLab OAuth 등록

사내 GitLab의 사용자 설정 → Applications에서 등록합니다. 메뉴가 제한된 경우 관리자에게 요청하세요.

- 이름: Flowline
- Redirect URI: `http://127.0.0.1:5050/auth/gitlab/callback`
- Confidential: 선택
- Scope: `read_user`

Application ID와 Secret을 발급받아 아래 환경변수에 설정합니다. GITLAB_URL은 프로젝트 저장소 주소가 아닌 GitLab 서버 기본 주소입니다.

```powershell
$env:GITLAB_URL = Read-Host "사내 GitLab 서버 주소"
$env:GITLAB_CLIENT_ID = Read-Host "Application ID"
$flowlineSecret = Read-Host "Application Secret" -AsSecureString
$env:GITLAB_CLIENT_SECRET = [System.Net.NetworkCredential]::new('', $flowlineSecret).Password
$env:GITLAB_REDIRECT_URI = 'http://127.0.0.1:5050/auth/gitlab/callback'
$env:FLOWLINE_SECRET_KEY = ([guid]::NewGuid().ToString() + [guid]::NewGuid().ToString())
python app.py
```

환경변수는 현재 PowerShell 세션에만 유지됩니다. Secret은 Git에 올리지 마세요. 사내 CA를 사용하는 경우 `SSL_CERT_FILE`에 CA PEM 경로를 설정하세요.

Flowline에서 GitLab 로그인 후 체크하면 이름·ID·시각을 자동 기록합니다. 설정 전에도 기존 데이터 열람과 편집은 가능하지만 체크에는 로그인이 필요합니다.

## 일정과 메모

Task 설정에서 예정 시작·종료일과 메모를 입력합니다. 일정은 이름 옆에 표시됩니다. 실행 화면에서 저장한 메모는 해당 실행본에 반영됩니다.

## 배포

`app.py`, `relationship.css`, `src/app.bundle.js`를 교체하고 서버를 재시작합니다. `index.html`과 `src/compat.js`도 반드시 포함되어야 합니다. 원본 JS 변경 후 `node scripts/build-classic-bundle.mjs`로 번들을 다시 생성합니다. 정적 GitHub Pages에서는 서버 로그인 기능을 지원하지 않습니다.
