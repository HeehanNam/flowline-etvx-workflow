# Flowline

ETVX 기준으로 프로젝트 Workflow를 정의하고 실행 상태를 관리하는 Flask 기반 웹앱입니다.

## 실행

```powershell
cd "C:\Users\HP Jarbis 15\Documents\Workflow 편집기"
python -m pip install -r requirements.txt
python app.py
```

브라우저에서 [http://localhost:5050](http://localhost:5050)을 엽니다.

## 원격 데모

GitHub Pages 배포본은 정적 호스팅 환경에서 실행되며 데이터는 각 브라우저의 LocalStorage에 저장됩니다. 로컬에서 Flask로 실행할 때는 기존과 같이 SQLite를 사용합니다.

`main` 브랜치에 Push하면 `.github/workflows/deploy-pages.yml`이 자동으로 정적 데모를 배포합니다.

## 저장 구조

- 로컬에서는 Flask가 정적 프런트엔드와 JSON API를 제공합니다.
- Workflow, 실행 인스턴스, Task 좌표는 `data/flowline.db` SQLite 파일에 저장됩니다.
- 기존 LocalStorage 데이터가 있으면 서버의 최초 데이터 생성 시 자동 이전됩니다.
- Flask API를 사용할 수 없는 GitHub Pages에서는 LocalStorage 저장소로 자동 전환됩니다.

## 주요 기능

- 자유 좌표 기반 격자 캔버스
- Task 드래그 앤 드롭과 좌표 서버 저장
- 선행 Task 관계에 따른 SVG 연결선
- Task 출력 포트에서 입력 포트로 드래그하여 연결 생성
- 넓어진 화살표 클릭 영역과 Task 카드 전체 드롭 영역
- 화살표 선택 후 양 끝점을 Task 카드/포트로 드래그하여 source·destination 변경
- 같은 관계로 이동하면 기존 연결과 병합하고, 실행 불가능한 순환 관계만 차단
- 선택 연결 HUD, 점선 미리보기, 중복·순환 관계 차단 및 연결 삭제
- Task 더블클릭 설정 모달
- ETVX, 담당자, 우선순위, 선행 Task, Subtask, 체크리스트 편집
- Subtask 펼치기/접기와 L자 계층 표시
- Workflow 맵 40~160% 확대·축소 및 화면 맞춤
- 체크리스트 기반 실행 및 진행률 관리
- 실행 중인 Workflow 스냅샷의 Task·ETVX·연결·Subtask·체크리스트 추가/수정/삭제
- 실행 중 구조 변경 시 기존 완료·체크 상태 보존 및 실행 이력 기록
- Task 편집 도중 Subtask/체크 항목을 변경해도 작성 중인 폼 내용 보존
- 수행 중·완료 Task의 체크리스트와 Subtask 일괄 Reset
- 현재 Task만 또는 연결된 모든 후속 Task Reset 범위 선택
- Reset 확인 팝업과 실행 이력 기록

상세 설계는 [MVP_IMPLEMENTATION_GUIDE.md](./MVP_IMPLEMENTATION_GUIDE.md)를 참고하세요.
