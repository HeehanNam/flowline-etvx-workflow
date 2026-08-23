export const seedState = { workflows: [{
  id:"wf_product_launch", name:"신규 기능 출시", description:"기획부터 배포 확인까지의 표준 출시 절차", owner:"프로덕트팀", version:1, createdAt:"2026-07-12T09:00:00.000Z", updatedAt:"2026-07-12T09:00:00.000Z",
  tasks:[
    {id:"task_scope",title:"출시 범위 확정",assignee:"PM",entry:"출시 목표와 요청사항이 등록됨",instructions:"이번 릴리스에 포함할 기능과 제외할 범위를 문서화합니다.",exit:"범위와 성공 지표가 명확하게 기록됨",checklist:[{id:"check_goal",text:"출시 목표와 성공 지표를 작성했다",required:true},{id:"check_scope",text:"포함/제외 범위를 구분했다",required:true},{id:"check_share",text:"관련 팀에 범위를 공유했다",required:false}]},
    {id:"task_build",title:"개발 및 자체 검증",assignee:"개발팀",entry:"출시 범위 확정 Task 완료",instructions:"정의된 범위에 맞게 개발하고 기본 품질 검증을 수행합니다.",exit:"개발 항목과 필수 테스트가 모두 완료됨",checklist:[{id:"check_dev",text:"기능 구현을 완료했다",required:true},{id:"check_test",text:"핵심 시나리오 테스트를 통과했다",required:true},{id:"check_note",text:"릴리스 노트를 작성했다",required:true}]},
    {id:"task_release",title:"배포 및 확인",assignee:"운영 담당자",entry:"개발 및 자체 검증 완료",instructions:"운영 환경에 배포하고 사용자 관점에서 정상 동작을 확인합니다.",exit:"운영 배포와 사후 확인 완료",checklist:[{id:"check_deploy",text:"운영 환경에 배포했다",required:true},{id:"check_smoke",text:"배포 후 핵심 기능을 확인했다",required:true},{id:"check_announce",text:"출시 공지를 게시했다",required:false}]}
  ]}], instances:[], selectedWorkflowId:"wf_product_launch", selectedInstanceId:null, activeView:"dashboard" };
