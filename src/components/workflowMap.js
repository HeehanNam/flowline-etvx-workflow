import { escapeHtml } from "../utils/html.js";

const labels={blocked:"진입 대기",ready:"수행 가능",in_progress:"진행 중",completed:"완료"};
const priorities={low:"낮음",medium:"보통",high:"높음",critical:"긴급"};
const CARD_WIDTH=230, CARD_HEIGHT=142, ENDPOINT_OFFSET=20;

export function workflowMap(workflow,instance=null,selected=null,expandedIds=[],zoom=1,selectedConnection=null){
 if(!workflow||!workflow.tasks.length)return `<div class="empty"><span>◇</span><strong>아직 Task가 없습니다</strong><p>첫 Task를 추가해 흐름을 만들어 보세요.</p></div>`;
 const width=Math.max(1100,...workflow.tasks.map(task=>task.position.x+CARD_WIDTH+180));
 const height=Math.max(620,...workflow.tasks.map(task=>task.position.y+CARD_HEIGHT+(expandedIds.includes(task.id)?task.subtasks.length*44+70:80)));
 const paths=workflow.tasks.flatMap(task=>task.dependencies.map(parentId=>connectionPath(workflow,parentId,task.id,selectedConnection))).join("");
 const endpoints=!instance&&selectedConnection?connectionEndpoints(workflow,selectedConnection):"";
 const inspector=!instance&&selectedConnection?connectionInspector(workflow,selectedConnection):"";
 return `<div class="mindmap-wrap free-canvas-wrap" data-zoom-area><div class="map-zoom-controls"><button data-action="map-zoom-out" title="축소">−</button><strong>${Math.round(zoom*100)}%</strong><button data-action="map-zoom-in" title="확대">＋</button><i></i><button class="zoom-text" data-action="map-zoom-reset">100%</button><button class="zoom-text" data-action="map-zoom-fit">화면 맞춤</button></div>${inspector}<div class="workflow-canvas" data-workflow-canvas style="--map-zoom:${zoom};width:${width}px;height:${height}px"><svg class="connection-layer" width="${width}" height="${height}" aria-label="Task 연결선"><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z"></path></marker></defs>${paths}${endpoints}</svg>${workflow.tasks.map((task,index)=>taskNode(task,workflow,instance,selected,expandedIds,index)).join("")}</div></div>`;
}

function connectionPath(workflow,fromId,toId,selectedConnection){
 const from=workflow.tasks.find(task=>task.id===fromId),to=workflow.tasks.find(task=>task.id===toId);
 if(!from||!to)return "";
 const selected=selectedConnection&&selectedConnection.from===fromId&&selectedConnection.to===toId;
 const path=pathData(from.position,to.position);
 return `<path class="connection-hitarea" data-connection data-action="select-connection" data-from="${fromId}" data-to="${toId}" d="${path}"><title>${escapeHtml(from.title)} → ${escapeHtml(to.title)} · 클릭하여 조정</title></path><path class="task-connection ${selected?"selected":""}" data-connection data-action="select-connection" data-from="${fromId}" data-to="${toId}" d="${path}" marker-end="url(#arrow)" tabindex="0"><title>${escapeHtml(from.title)} → ${escapeHtml(to.title)} · 클릭하여 조정</title></path>`;
}

function connectionEndpoints(workflow,connection){
 const from=workflow.tasks.find(task=>task.id===connection.from),to=workflow.tasks.find(task=>task.id===connection.to);
 if(!from||!to)return "";
 return `<g class="connection-endpoints"><circle class="connection-endpoint source" data-reconnect-end="source" data-from="${from.id}" data-to="${to.id}" cx="${from.position.x+CARD_WIDTH+ENDPOINT_OFFSET}" cy="${from.position.y+CARD_HEIGHT/2}" r="11"><title>출발 Task 변경 · 다른 Task 영역에 놓기</title></circle><circle class="connection-endpoint destination" data-reconnect-end="destination" data-from="${from.id}" data-to="${to.id}" cx="${to.position.x-ENDPOINT_OFFSET}" cy="${to.position.y+CARD_HEIGHT/2}" r="11"><title>도착 Task 변경 · 다른 Task 영역에 놓기</title></circle></g>`;
}

function connectionInspector(workflow,connection){
 const from=workflow.tasks.find(task=>task.id===connection.from),to=workflow.tasks.find(task=>task.id===connection.to);
 if(!from||!to)return "";
 return `<div class="connection-inspector"><span class="connection-swatch">↗</span><div><small>SELECTED CONNECTION</small><strong>${escapeHtml(from.title)} <b>→</b> ${escapeHtml(to.title)}</strong><p>파란 원형 끝점을 원하는 Task 카드나 포트로 드래그하세요.</p></div><button data-action="delete-connection" data-from="${from.id}" data-to="${to.id}" title="연결 삭제">⌫</button><button data-action="clear-connection-selection" title="선택 해제">×</button></div>`;
}

export function pathData(from,to){
 const sx=from.x+CARD_WIDTH,sy=from.y+CARD_HEIGHT/2,tx=to.x,ty=to.y+CARD_HEIGHT/2;
 const bend=Math.max(45,Math.abs(tx-sx)*.45);
 return `M ${sx} ${sy} C ${sx+bend} ${sy}, ${tx-bend} ${ty}, ${tx} ${ty}`;
}

export function previewPath(from,toPoint){
 const sx=from.x+CARD_WIDTH,sy=from.y+CARD_HEIGHT/2,tx=toPoint.x,ty=toPoint.y;
 const bend=Math.max(45,Math.abs(tx-sx)*.45);
 return `M ${sx} ${sy} C ${sx+bend} ${sy}, ${tx-bend} ${ty}, ${tx} ${ty}`;
}

export function pathBetweenPoints(fromPoint,toPoint){
 const bend=Math.max(45,Math.abs(toPoint.x-fromPoint.x)*.45);
 return `M ${fromPoint.x} ${fromPoint.y} C ${fromPoint.x+bend} ${fromPoint.y}, ${toPoint.x-bend} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`;
}

function taskNode(task,workflow,instance,selected,expandedIds,index){
 const run=instance&&instance.tasks.find(item=>item.taskId===task.id),status=run?run.status:"definition";
 const deps=task.dependencies.map(id=>{const parent=workflow.tasks.find(item=>item.id===id);return parent&&parent.title}).filter(Boolean);
 const expanded=expandedIds.includes(task.id),subtaskState=id=>{const value=run&&run.subtasks.find(item=>item.itemId===id);return value&&value.completed};
 return `<div class="canvas-task-group ${selected===task.id?"selected":""}" data-task-card data-task-id="${task.id}" style="left:${task.position.x}px;top:${task.position.y}px">${instance?"":`<button class="connection-handle input" data-connect-input data-task-id="${task.id}" title="여기에 연결"></button><button class="connection-handle output" data-connect-output data-task-id="${task.id}" title="드래그하여 Task 연결">＋</button>`}<button class="flow-node canvas-node ${status} priority-${task.priority}" data-action="select-task" data-task-id="${task.id}"><div class="node-top"><span class="task-kind">TASK ${String(index+1).padStart(2,"0")}</span>${run?`<span class="status-pill ${status}">${labels[status]}</span>`:`<span class="priority-badge">${priorities[task.priority]}</span>`}</div><strong>${escapeHtml(task.title)}</strong><span class="assignee">${escapeHtml(task.assignee)}</span><span class="dependency-label">${deps.length?`← ${escapeHtml(deps.join(", "))}`:"⚡ 시작 Task"}</span><div class="node-checks"><span>${task.subtasks.length} subtask · ${task.checklist.length} check</span>${run?`<span>${run.checklist.filter(item=>item.checked).length}/${run.checklist.length}</span>`:""}</div></button>${task.subtasks.length?`<button class="subtask-toggle ${expanded?"open":""}" data-action="toggle-map-subtasks" data-task-id="${task.id}"><span>${expanded?"−":"＋"}</span> Subtask ${task.subtasks.length}개 ${expanded?"접기":"보기"}</button>`:""}${expanded?`<div class="map-subtasks">${task.subtasks.map((sub,subIndex)=>`<div class="subtask-grid-row ${subtaskState(sub.id)?"done":""}"><span class="elbow"><i></i><b>›</b></span><div class="map-subtask"><i>${subIndex+1}</i><span>${escapeHtml(sub.title)}</span>${sub.required?"<em>필수</em>":""}</div></div>`).join("")}</div>`:""}</div>`;
}
