# ETVX Workflow MVP 구현 지침

## 1. 목표

프로젝트 진행에 필요한 표준 업무 흐름을 ETVX(Entry, Task, Validation, Exit)로 정의하고, 같은 흐름으로 실행 인스턴스를 생성해 담당자가 체크리스트를 완료하며 전체 진행 상황을 확인할 수 있는 웹 도구를 구현한다.

이 MVP는 승인, 조건 분기, 외부 시스템 자동화, 실시간 다중 사용자 협업은 포함하지 않는다.

## 2. 핵심 사용자 흐름

1. 사용자가 Workflow를 생성한다.
2. Workflow에 순서가 있는 Task를 추가한다.
3. 각 Task에 Entry, 수행 지침, Validation 체크리스트, Exit 기준과 담당자를 정의한다.
4. 정의된 Workflow로 실행 인스턴스를 시작한다.
5. 선행 Task가 끝나면 다음 Task가 자동으로 `ready` 상태가 된다.
6. 담당자가 Task를 시작하고 필수 체크리스트를 완료한다.
7. 완료 조건을 충족하면 Task를 완료한다.
8. 대시보드와 Workflow 맵에서 전체 진행률과 현재 작업을 확인한다.

## 3. MVP 범위

### 포함

- Workflow 생성, 수정, 삭제
- Task 생성, 수정, 삭제 및 자유 좌표 이동
- Task별 우선순위와 복수 선행 Task 관계
- 의존 관계 기반 순차·병렬 실행
- Task 내부 필수·선택 Subtask
- Task별 ETVX 정보와 담당자
- 필수·선택 체크리스트
- Workflow 실행 인스턴스 생성
- Task 상태: `blocked`, `ready`, `in_progress`, `completed`
- 실행 이력과 진행률
- 실행 중 Workflow 스냅샷 구조 편집
- 실행본의 Workflow 템플릿 저장
- Workflow JSON Export/Import
- 실행 현황 HTML 리포트
- 개별·후속 Task Reset
- Flask JSON API와 SQLite 영속화
- LocalStorage 대체 저장소

### 제외

- 승인과 반려
- 조건 기반 분기
- 인증, 조직 및 세부 권한
- 서버 동기화와 실시간 공동 편집
- 알림, SLA 및 외부 연동
- 첨부파일 저장

## 4. 모듈 경계

```text
src/
  domain/          순수 데이터 모델, 검증, 상태 전이 규칙
  infrastructure/ Flask API 및 LocalStorage 저장소
  components/      화면 단위 렌더링과 사용자 입력
  data/            샘플 및 초기 데이터
  services/        Import, Export, 리포트
  utils/           공통 유틸리티
  app.js           라우팅과 모듈 조합
  app.bundle.js    폐쇄망 브라우저용 실행 번들
```

- `domain`은 DOM과 저장 방식을 알지 못한다.
- `infrastructure`는 도메인 객체의 저장과 조회만 담당한다.
- 실행 인스턴스는 생성 당시 Workflow 정의를 snapshot으로 보존한다.
- 상태 전이는 `workflowEngine`에 집중한다.
- `app.bundle.js`는 원본 모듈에서 생성하며 직접 수정하지 않는다.

## 5. 데이터 모델

### WorkflowDefinition

```js
{
  id, name, description, owner, version, createdAt, updatedAt,
  tasks: [{
    id, title, assignee, priority, dependencies,
    entry, instructions, exit,
    subtasks: [{ id, title, required }],
    checklist: [{ id, text, required }]
  }]
}
```

### WorkflowInstance

```js
{
  id, workflowId, workflowVersion, name, status,
  createdAt, updatedAt, completedAt,
  definitionSnapshot,
  tasks: [{
    taskId, status, startedAt, completedAt,
    subtasks: [{ itemId, completed }],
    checklist: [{ itemId, checked }]
  }],
  history: [{ id, at, type, message }]
}
```

## 6. 상태 전이 규칙

```text
선행 Task 없음: blocked -> ready (인스턴스 생성 시)
후속 Task: blocked -> ready (모든 선행 Task 완료 시)
ready -> in_progress (업무 시작)
in_progress -> completed (모든 필수 항목 완료 시)
```

- 선행 Task가 없는 여러 Task는 병렬로 즉시 실행 가능하다.
- 같은 선행 Task를 공유하는 후속 Task는 병렬로 활성화된다.
- 필수 Subtask와 필수 체크리스트가 모두 완료되어야 Task를 완료할 수 있다.
- 순환 의존 관계가 있으면 실행을 시작할 수 없다.
- 체크리스트를 처음 변경하면 Task를 자동으로 `in_progress`로 바꾼다.
- 선택 체크리스트는 완료 조건에 포함하지 않는다.
- 모든 Task가 완료되면 Instance를 `completed`로 바꾼다.

## 7. 배포 원칙

- 로컬 및 폐쇄망 실행은 Flask 서버를 사용한다.
- `index.html`은 프로젝트 최상위에 둔다.
- 브라우저는 `src/app.bundle.js`를 실행한다.
- 원본 JS 변경 후 `node scripts/build-classic-bundle.mjs`를 실행한다.
- 배포 시 `data/flowline.db` 포함 여부를 확인해 기존 데이터를 보존한다.

## 8. 완료 기준

- 샘플 Workflow가 표시된다.
- 새로운 Workflow와 Task를 작성할 수 있다.
- 필수 체크리스트 미완료 시 Task 완료가 차단된다.
- Task 완료 시 다음 Task가 자동 활성화된다.
- 새로고침 후에도 데이터가 유지된다.
- 실행 맵, 진행률 및 활동 이력이 일관되게 갱신된다.
