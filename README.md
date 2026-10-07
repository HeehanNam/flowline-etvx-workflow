# Flowline

ETVX 기준으로 프로젝트 Workflow를 정의하고 실행 상태를 관리하는 Flask 기반 웹앱입니다.

## 실행

```powershell
python -m pip install -r requirements.txt
python app.py
```

브라우저에서 [http://127.0.0.1:5050](http://127.0.0.1:5050)을 엽니다.

첫 접속 시 표시할 사용자 이름을 입력합니다. 해당 브라우저에서 이름을 기억하고 체크리스트·Subtask 체크에 이름과 시각을 기록합니다. 상단의 이름 변경으로 사용자를 바꿀 수 있습니다. 이름 변경은 과거 체크 기록을 바꾸지 않습니다. GitLab 연동은 선택 사항이며, 로그인한 경우 GitLab 계정을 우선 사용합니다. 기존 DB는 그대로 사용할 수 있고 과거 체크에 작성자 기록이 없으면 기록 없음으로 표시합니다.

`index.html`을 직접 열지 말고 반드시 Flask 주소로 접속해야 합니다. 인터넷이 차단된 폐쇄망에서도 외부 CDN 없이 동작합니다.

## 폐쇄망 배포

- 프로젝트 폴더 전체를 복사합니다.
- 최상위의 `index.html`과 `src/app.bundle.js`가 반드시 포함되어야 합니다.
- Python과 `requirements.txt`의 Flask 패키지가 필요합니다.
- 소스 모듈을 변경한 경우 `node scripts/build-classic-bundle.mjs`로 실행 번들을 다시 생성합니다.
- 실제 브라우저 실행은 ES 모듈 대신 `src/app.bundle.js` 단일 파일을 사용합니다.

## 저장 구조

- Flask가 정적 프런트엔드와 JSON API를 제공합니다.
- Workflow, 실행 인스턴스, Task 좌표는 `data/flowline.db` SQLite 파일에 저장됩니다.
- 기존 LocalStorage 데이터가 있으면 서버의 최초 데이터 생성 시 자동 이전됩니다.
- Flask API를 사용할 수 없는 정적 호스팅 환경에서는 LocalStorage 저장소로 자동 전환됩니다.

## 주요 기능

- 자유 좌표 기반 격자 캔버스
- Task 드래그 앤 드롭과 좌표 서버 저장
- 선행 Task 관계에 따른 SVG 연결선
- Task 출력 포트에서 입력 포트로 드래그하여 연결 생성
- 화살표 선택 및 source·destination 변경
- 중복·순환 관계 차단 및 연결 삭제
- Task 설정 모달
- ETVX, 담당자, 우선순위, 선행 Task, Subtask, 체크리스트 편집
- Workflow 맵 확대·축소 및 화면 맞춤
- 체크리스트 기반 실행 및 진행률 관리
- 실행 중 Workflow 구조 편집과 기존 상태 보존
- 실행본을 독립적인 Workflow 템플릿으로 저장
- Workflow JSON Export/Import
- 실행 현황 HTML 리포트 다운로드
- 현재 Task 또는 연결된 후속 Task Reset

상세 설계는 [MVP_IMPLEMENTATION_GUIDE.md](./MVP_IMPLEMENTATION_GUIDE.md)를 참고하세요.
