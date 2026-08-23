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
- Task 생성, 수정, 삭제 및 드래그 앤 드롭 정렬
- Task별 우선순위와 복수 선행 Task 관계
- 의존 관계 기반 순차/병렬 실행
- Task 내부 필수/선택 Subtask
- 의존성 깊이별 격자형 Phase 레인과 병렬 Task 수직 배치
- Task 카드의 Subtask 확장/축소 및 L자 화살표 계층 표시
- Workflow 맵 배율 조절, 초기화, 화면 맞춤 및 Ctrl+휠 조작
- Task 재수행을 위한 개별/연결 후속 전체 Reset
- Reset 전 범위 선택 확인 팝업과 이력 기록
- Task별 ETVX 정보
- 개인 또는 역할 형태의 담당자 문자열
- 필수/선택 체크리스트
- Workflow 실행 인스턴스 생성
- Task 상태: `blocked`, `ready`, `in_progress`, `completed`
- 체크리스트 기반 완료 제한
- 실행 맵과 진행률
- 실행 이력
- 실행 중 식별된 절차를 현재 실행 스냅샷에 추가·수정·삭제
- 실행 중 구조 편집 시 기존 Runtime 상태와 체크 결과를 항목 ID 기준으로 보존
- Task 폼의 동적 Subtask·체크리스트 편집 시 미저장 입력값 보존
- Flask JSON API와 SQLite 영속화
- Task 자유 좌표 배치 및 SVG 연결선
- 입력·출력 포트 기반 연결선 드래그 앤 드롭
- 넓은 화살표 선택 영역과 Task 카드 전체 드롭 영역
- source·destination 끝점 드래그 변경, 기존 관계 병합, 미리보기, 순환 관계 검증 및 연결 삭제
- Task 더블클릭 설정 모달
- 샘플 Workflow

### 제외

- 승인과 반려
- 조건 기반 분기
- 인증, 조직 및 세부 권한
- 서버 동기화와 동시 편집
- 알림, SLA 및 외부 연동
- 첨부파일 저장

## 4. 모듈 경계

```text
src/
  domain/       순수 데이터 모델, 검증, 상태 전이 규칙
  infrastructure/ Flask API 저장소 구현
  components/   화면 단위 렌더링과 사용자 입력 처리
  data/         샘플/초기 데이터
  utils/        공통 유틸리티
  app.js        라우팅과 모듈 조합
```

- `domain`은 DOM과 저장 방식을 알지 못한다.
- `infrastructure`는 Flask API를 통한 도메인 객체의 저장과 조회만 담당한다.
- `components`는 상태를 직접 영속화하지 않고 App이 제공한 action을 호출한다.
- 실행 인스턴스는 생성 당시 Workflow 정의를 snapshot으로 보존한다.
- 상태 전이는 `workflowEngine`만 변경할 수 있도록 집중한다.

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
in_progress -> completed (모든 필수 체크리스트 완료 시)
```

- 선행 Task가 없는 여러 Task는 병렬로 즉시 실행 가능하다.
- 같은 선행 Task를 공유하는 후속 Task는 병렬로 활성화된다.
- 필수 Subtask와 필수 체크리스트가 모두 완료되어야 Task를 완료할 수 있다.
- 순환 의존 관계가 있으면 실행을 시작할 수 없다.
- `completed` 상태는 되돌리지 않는다(MVP 기준).
- 체크리스트는 `ready` 또는 `in_progress`에서 변경할 수 있다.
- 체크리스트를 처음 변경하면 Task를 자동으로 `in_progress`로 바꾼다.
- 선택 체크리스트는 완료 조건에 포함하지 않는다.
- 마지막 Task가 완료되면 Instance를 `completed`로 바꾼다.

## 7. 향후 확장 원칙

- LocalStorage Repository와 동일한 인터페이스의 API Repository를 추가한다.
- 인증 사용자 ID와 담당 Role을 별도 엔티티로 확장한다.
- Task 간 `connections`를 추가하여 병렬 및 조건 분기를 지원한다.
- Entry/Exit 문자열을 구조화된 Rule 객체로 점진적으로 전환한다.
- Workflow 게시/버전 테이블을 도입하고 draft와 published를 분리한다.
- 첨부 증빙, 댓글, 알림, SLA, 감사 로그를 독립 모듈로 추가한다.

## 8. 완료 기준

- 샘플 Workflow가 표시된다.
- 새로운 Workflow와 Task를 작성할 수 있다.
- 새 실행 건을 만들면 첫 Task만 수행 가능하다.
- 필수 체크리스트 미완료 시 Task 완료가 차단된다.
- Task 완료 시 다음 Task가 자동 활성화된다.
- 새로고침 후에도 데이터가 유지된다.
- 실행 맵, 진행률 및 활동 이력이 일관되게 갱신된다.
