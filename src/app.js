import{captureScroll,restoreScroll}from"./utils/scrollPosition.js";
import{escapeHtml}from"./utils/html.js";
import{seedState}from"./data/seed.js";import{ApiRepository}from"./infrastructure/apiRepository.js";import{createChecklistItem,createSubtask,createTask,createWorkflow,normalizeState,validateWorkflow}from"./domain/workflowModel.js";import{completeTask,reconcileInstanceStructure,resetTask,startInstance,startTask,toggleChecklist,toggleSubtask}from"./domain/workflowEngine.js";import{buildRunReport,cloneWorkflowAsTemplate,downloadText,parseWorkflow,safeFilename,serializeWorkflow}from"./services/workflowTransfer.js";import{pathBetweenPoints,pathData,previewPath}from"./components/workflowMap.js";import{renderLayout}from"./components/layout.js";import{renderDashboard}from"./components/dashboard.js";import{renderWorkflowEditor}from"./components/workflowEditor.js";import{renderRuns}from"./components/runView.js";
window.FlowlineCompatibility.markModuleLoaded();const repo=new ApiRepository(seedState);const root=document.querySelector("#app");window.FlowlineCompatibility.showStartupLoading();
Promise.all([repo.load(),fetch("/api/auth").then(r=>r.ok?r.json():{configured:false,user:null}).catch(()=>({configured:false,user:null}))]).then(async ([loadedState,auth])=>{let state=normalizeState(loadedState),ui={selectedTaskId:null,selectedConnection:null,editingTaskId:null,resetTaskId:null,templateRunId:null,runEditMode:false,drag:null,expandedTaskIds:[],mapZoom:.85};repo.save(state);
const NAME_KEY="flowline.displayName";
async function saveIdentity(name){
 if(repo.mode==="local"){auth.user={name:name.trim(),id:null,username:"",provider:"local"};return;}
 const response=await fetch("/api/auth/name",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
 if(response.status===404||response.status===405)throw Error("실행 중인 서버에 이름 저장 기능이 없습니다. 서버를 종료한 뒤 수정된 프로젝트 폴더에서 python app.py로 다시 시작하고 Ctrl+F5를 눌러 주세요.");
 if(!(response.headers.get("content-type")||"").includes("application/json"))throw Error("서버가 예상하지 못한 응답을 반환했습니다. 서버 실행 창의 오류와 실행 폴더를 확인해 주세요.");
 const data=await response.json();if(!response.ok)throw Error(data.error||"이름 저장에 실패했습니다.");if(!data.user?.name)throw Error("서버 응답에 사용자 정보가 없습니다.");auth.user=data.user;
}
if(!auth.user||auth.user.provider==="local"){
 let saved;try{saved=localStorage.getItem(NAME_KEY);}catch{}
 if(saved){try{await saveIdentity(saved);}catch{auth.user=null;}}
}
ui.nameDialog=!auth.user;
function identityView(){
 const local=auth.user?.provider==="local";
 return '<div class="login-status">'+(auth.user?escapeHtml(auth.user.name)+(local?' <button type="button" data-action="change-name">이름 변경</button>':' (@'+escapeHtml(auth.user.username)+') <form method="post" action="/auth/logout"><button>로그아웃</button></form>'):'사용자 이름 입력 필요')+(auth.configured&&(!auth.user||local)?' <a href="/auth/gitlab">GitLab 로그인</a>':'')+'</div>'+(ui.nameDialog?'<div class="modal-backdrop identity-backdrop"><section class="task-modal identity-modal" role="dialog" aria-modal="true" aria-label="사용자 이름"><h2>사용자 이름</h2><p>체크리스트와 Subtask에 표시할 이름을 입력해 주세요.</p><form data-form="identity"><label>이름<input name="name" maxlength="80" required autocomplete="name" value="'+escapeHtml(auth.user?.name||'')+'"></label><small>이 브라우저에서 기억합니다. 공유 PC에서는 사용 전에 이름을 확인해 주세요.</small><p role="alert" class="identity-error"></p><button class="primary" type="submit">시작하기</button></form></section></div>':'');
}
root.addEventListener("submit",async e=>{
 if(e.target.dataset.form!=="identity")return;
 e.preventDefault();e.stopImmediatePropagation();const form=e.target,button=form.querySelector("button");button.disabled=true;
 try{const name=String(new FormData(form).get("name")||"").trim();if(!name||name.length>80)throw Error("이름을 1~80자로 입력해 주세요.");await saveIdentity(name);try{localStorage.setItem(NAME_KEY,name);}catch{}ui.nameDialog=false;render();}
 catch(error){form.querySelector(".identity-error").textContent=error.message;button.disabled=false;}
});

let renderedContext=null;
function render(){
 const context=[state.activeView,state.selectedWorkflowId,state.selectedInstanceId].join("|");
 const scroll=renderedContext===context?captureScroll(root):null;
 const content=state.activeView==="dashboard"?renderDashboard(state):state.activeView==="workflows"?renderWorkflowEditor(state,ui):renderRuns(state,ui);
 root.innerHTML=renderLayout(state,content)+startRunDialog()+identityView();
 if(scroll)restoreScroll(root,scroll);
 renderedContext=context;
}

function startRunDialog(){
 const workflow=state.workflows.find(w=>w.id===ui.startRunWorkflowId);if(!workflow)return "";
 return '<div class="modal-backdrop"><section class="task-modal identity-modal" role="dialog" aria-modal="true" aria-label="Workflow 실행 시작"><h2>Workflow 실행 시작</h2><form data-form="start-run"><label>실행 건 이름<input name="name" required maxlength="200" value="'+escapeHtml(workflow.name+' · '+new Date().toLocaleDateString("ko-KR"))+'"></label><div class="reset-actions"><button type="button" class="secondary" data-action="cancel-start-run">취소</button><button class="primary" type="submit">실행 시작</button></div></form></section></div>';
}
root.addEventListener("submit",e=>{
 if(e.target.dataset.form!=="start-run")return;
 e.preventDefault();e.stopImmediatePropagation();
 try{
  const workflow=state.workflows.find(w=>w.id===ui.startRunWorkflowId);if(!workflow)throw Error("Workflow를 찾을 수 없습니다.");
  const errors=validateWorkflow(workflow);if(errors.length)throw Error(errors[0]);
  const name=String(new FormData(e.target).get("name")||"").trim();if(!name)throw Error("실행 건 이름을 입력해 주세요.");
  const run=startInstance(workflow,name);state.instances.unshift(run);state.selectedInstanceId=run.id;state.activeView="runs";ui.startRunWorkflowId=null;ui.selectedTaskId=null;ui.runEditMode=false;commit();
 }catch(error){toast(error.message,"error");}
});
let itemDrag = null;
root.addEventListener("dragstart", e => {
 const handle=e.target.closest(".item-drag-handle");if(!handle)return;
 const row=handle.closest("[data-sort-row]");itemDrag={...row.dataset};
 e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",row.dataset.itemId);
 row.classList.add("item-dragging");
});
root.addEventListener("dragover", e => {
 const row=e.target.closest("[data-sort-row]");
 if(!row||!itemDrag||row.dataset.taskId!==itemDrag.taskId||row.dataset.kind!==itemDrag.kind||row.dataset.scope!==itemDrag.scope)return;
 e.preventDefault();e.dataTransfer.dropEffect="move";
 root.querySelectorAll(".item-drop-target").forEach(x=>x.classList.remove("item-drop-target"));row.classList.add("item-drop-target");
});
root.addEventListener("drop", e => {
 const row=e.target.closest("[data-sort-row]"),drag=itemDrag;
 if(!row||!drag||row.dataset.taskId!==drag.taskId||row.dataset.kind!==drag.kind||row.dataset.scope!==drag.scope)return;
 e.preventDefault();itemDrag=null;
 if(row.dataset.itemId===drag.itemId){row.classList.remove("item-drop-target","item-dragging");return;}
 try {
  syncOpenTaskForm();const task=taskForScope(drag.scope,drag.taskId),items=drag.kind==="subtask"?task.subtasks:task.checklist;
  const from=items.findIndex(x=>x.id===drag.itemId);if(from<0)return;
  const to=items.findIndex(x=>x.id===row.dataset.itemId);if(to<0)return;
  const [item]=items.splice(from,1);items.splice(to,0,item);
  if(drag.scope==="run")reconcileSelectedRun(`“${task.title}”의 ${drag.kind==="subtask"?"Subtask":"체크리스트"} 순서를 변경했습니다.`);
  commit();
 } catch(error){toast(error.message,"error");}
});
root.addEventListener("dragend",()=>{itemDrag=null;root.querySelectorAll(".item-drop-target,.item-dragging").forEach(x=>x.classList.remove("item-drop-target","item-dragging"));});
function commit(){repo.save(state);render()}function toast(msg,kind="info"){const e=document.querySelector("#toast");e.textContent=msg;e.className=`toast show ${kind}`;setTimeout(()=>e.className="toast",2500)}
root.addEventListener("click",e=>{const t=e.target.closest("[data-action]");if(!t)return;const a=t.dataset.action;try{if(a==="change-name"){ui.nameDialog=true;render();return;}
 if(a==="modal-panel")return
 if(a==="navigate"){state.activeView=t.dataset.view;ui.selectedTaskId=null;ui.selectedConnection=null;ui.editingTaskId=null;ui.runEditMode=false;commit()}
 if(a==="select-task"){clearTimeout(ui.clickTimer);ui.clickTimer=setTimeout(()=>{ui.selectedTaskId=t.dataset.taskId;ui.selectedConnection=null;render()},220);return}
 if(a==="select-connection"){ui.selectedConnection={from:t.dataset.from,to:t.dataset.to};render();return}
 if(a==="clear-connection-selection"){ui.selectedConnection=null;render();return}
 if(a==="delete-connection"){if(confirm("이 Task 연결을 삭제할까요?")){removeConnection(t.dataset.from,t.dataset.to);if(state.activeView==="runs")reconcileSelectedRun("실행 중 Task 연결을 삭제했습니다.");ui.selectedConnection=null;commit();toast("Task 연결을 삭제했습니다.","success")}return}
 if(a==="toggle-run-edit"){ui.runEditMode=!ui.runEditMode;ui.selectedConnection=null;ui.editingTaskId=null;render();return}
 if(a==="open-task-settings"){ui.selectedTaskId=t.dataset.taskId;ui.editingTaskId=t.dataset.taskId;render()}
 if(a==="close-task-settings"){ui.editingTaskId=null;render()}
 if(a==="open-reset-dialog"){ui.resetTaskId=t.dataset.taskId;render()}
 if(a==="close-reset-dialog"){ui.resetTaskId=null;render()}
 if(a==="open-template-dialog"){ui.templateRunId=selectedRun()?.id||null;render();return}
 if(a==="close-template-dialog"){ui.templateRunId=null;render();return}
 if(a==="toggle-map-subtasks"){const id=t.dataset.taskId;ui.expandedTaskIds=ui.expandedTaskIds.includes(id)?ui.expandedTaskIds.filter(item=>item!==id):[...ui.expandedTaskIds,id];render()}
 if(a==="map-zoom-in")setMapZoom(ui.mapZoom+.1)
 if(a==="map-zoom-out")setMapZoom(ui.mapZoom-.1)
 if(a==="map-zoom-reset")setMapZoom(1)
 if(a==="map-zoom-fit"){const wrap=t.closest("[data-zoom-area]"),canvas=wrap.querySelector("[data-workflow-canvas]");setMapZoom(Math.min((wrap.clientWidth-24)/canvas.offsetWidth,(Math.max(520,window.innerHeight-280))/canvas.offsetHeight))}
 if(a==="import-workflow"){root.querySelector("[data-workflow-import]")?.click();return}
 if(a==="export-workflow"){const workflow=state.workflows.find(item=>item.id===t.dataset.workflowId);downloadText(`${safeFilename(workflow.name)}.flowline.json`,serializeWorkflow(workflow));toast("Workflow JSON을 다운로드했습니다.","success");return}
 if(a==="download-run-report"){const run=selectedRun();downloadText(`${safeFilename(run.name)}_report.html`,buildRunReport(run),"text/html;charset=utf-8");toast("실행 현황 리포트를 다운로드했습니다.","success");return}
 if(a==="new-workflow"){const w=createWorkflow({name:`새 Workflow ${state.workflows.length+1}`});state.workflows.push(w);state.selectedWorkflowId=w.id;ui.selectedTaskId=null;commit()}
 if(a==="add-task"){const runScope=t.dataset.scope==="run",w=runScope?selectedRun().definitionSnapshot:state.workflows.find(w=>w.id===t.dataset.workflowId),last=w.tasks.at(-1),task=createTask({title:`Task ${w.tasks.length+1}`,dependencies:last?[last.id]:[],position:last?{x:last.position.x+310,y:last.position.y}:{x:80,y:90},checklist:[createChecklistItem("완료 기준을 확인했다")]});w.tasks.push(task);ui.selectedTaskId=task.id;ui.editingTaskId=task.id;if(runScope)reconcileSelectedRun(`실행 중 “${task.title}” Task를 추가했습니다.`);commit()}
 if(a==="add-check"){syncOpenTaskForm();const task=taskForScope(t.dataset.scope,t.dataset.taskId);task.checklist.push(createChecklistItem("새 확인 항목"));if(t.dataset.scope==="run")reconcileSelectedRun(`“${task.title}”에 체크 항목을 추가했습니다.`);commit()}
 if(a==="delete-check"){syncOpenTaskForm();const task=taskForScope(t.dataset.scope,t.dataset.taskId);task.checklist=task.checklist.filter(i=>i.id!==t.dataset.itemId);if(t.dataset.scope==="run")reconcileSelectedRun(`“${task.title}”의 체크 항목을 삭제했습니다.`);commit()}
 if(a==="add-subtask"){syncOpenTaskForm();const task=taskForScope(t.dataset.scope,t.dataset.taskId);task.subtasks.push(createSubtask());if(t.dataset.scope==="run")reconcileSelectedRun(`“${task.title}”에 Subtask를 추가했습니다.`);commit()}
 if(a==="delete-subtask"){syncOpenTaskForm();const task=taskForScope(t.dataset.scope,t.dataset.taskId);task.subtasks=task.subtasks.filter(i=>i.id!==t.dataset.itemId);if(t.dataset.scope==="run")reconcileSelectedRun(`“${task.title}”의 Subtask를 삭제했습니다.`);commit()}
 if(a==="delete-task"){if(!confirm("이 Task를 삭제할까요?"))return;const runScope=t.dataset.scope==="run",w=runScope?selectedRun().definitionSnapshot:selectedWorkflow();if(w.tasks.length===1)throw Error("마지막 Task는 삭제할 수 없습니다.");const title=w.tasks.find(x=>x.id===t.dataset.taskId)?.title||"Task";w.tasks=w.tasks.filter(x=>x.id!==t.dataset.taskId);w.tasks.forEach(x=>x.dependencies=x.dependencies.filter(id=>id!==t.dataset.taskId));if(runScope)reconcileSelectedRun(`실행 중 “${title}” Task를 삭제했습니다.`);ui.selectedTaskId=null;ui.selectedConnection=null;ui.editingTaskId=null;commit()}
 if(a==="delete-workflow"){if(!confirm("Workflow 정의를 삭제할까요? 기존 실행 기록은 유지됩니다."))return;state.workflows=state.workflows.filter(w=>w.id!==t.dataset.workflowId);state.selectedWorkflowId=state.workflows[0]?.id||null;ui.selectedConnection=null;commit()}
 if(a==="start-run"){const w=state.workflows.find(w=>w.id===t.dataset.workflowId),errors=validateWorkflow(w);if(errors.length)throw Error(errors[0]);ui.startRunWorkflowId=w.id;render();root.querySelector("form[data-form=start-run] input")?.focus();return}
 if(a==="cancel-start-run"){ui.startRunWorkflowId=null;render();return}
 if(a==="open-run"){state.selectedInstanceId=t.dataset.runId;state.activeView="runs";ui.selectedTaskId=null;ui.runEditMode=false;commit()}
 if(a==="start-task")updateRun(r=>startTask(r,t.dataset.taskId));if(a==="toggle-check")updateRun(r=>toggleChecklist(r,t.dataset.taskId,t.dataset.itemId,auth.user));if(a==="complete-task")updateRun(r=>completeTask(r,t.dataset.taskId));
 if(a==="toggle-subtask")updateRun(r=>toggleSubtask(r,t.dataset.taskId,t.dataset.itemId,auth.user));
}catch(err){toast(err.message,"error")}});
root.addEventListener("change",e=>{const a=e.target.dataset.action;if(a==="select-workflow"){state.selectedWorkflowId=e.target.value;ui.selectedTaskId=null;ui.selectedConnection=null;commit()}if(a==="select-run"){state.selectedInstanceId=e.target.value;ui.selectedTaskId=null;ui.selectedConnection=null;ui.editingTaskId=null;ui.runEditMode=false;commit()}});
root.addEventListener("change",async e=>{const input=e.target.closest("[data-workflow-import]");if(!input?.files?.[0])return;try{const workflow=parseWorkflow(await input.files[0].text()),errors=validateWorkflow(workflow);if(errors.length)throw Error(errors[0]);state.workflows.push(workflow);state.selectedWorkflowId=workflow.id;ui.selectedTaskId=workflow.tasks[0]?.id||null;ui.selectedConnection=null;commit();setTimeout(()=>toast("Workflow JSON을 가져왔습니다.","success"),0)}catch(error){toast(error.message,"error")}finally{input.value=""}});
root.addEventListener("submit",e=>{if(e.target.getAttribute("action")==="/auth/logout")return;e.preventDefault();const f=e.target,d=new FormData(f);if(f.dataset.form==="task-memo"){const run=selectedRun(),task=run.definitionSnapshot.tasks.find(item=>item.id===f.dataset.taskId);task.memo=String(d.get("memo")||"").trim();run.updatedAt=new Date().toISOString();commit();setTimeout(()=>toast("메모를 저장했습니다.","success"),0);return}if(f.dataset.form==="save-run-template"){const run=state.instances.find(item=>item.id===ui.templateRunId)||selectedRun(),workflow=cloneWorkflowAsTemplate(run.definitionSnapshot,String(d.get("name")||""));workflow.description=String(d.get("description")||workflow.description).trim();state.workflows.push(workflow);state.selectedWorkflowId=workflow.id;state.activeView="workflows";ui.templateRunId=null;ui.runEditMode=false;ui.selectedTaskId=workflow.tasks[0]?.id||null;ui.selectedConnection=null;commit();setTimeout(()=>toast("현재 실행본을 Workflow 템플릿으로 저장했습니다.","success"),0);return}if(f.dataset.form==="reset-task"){const index=state.instances.findIndex(item=>item.id===state.selectedInstanceId);state.instances[index]=resetTask(state.instances[index],f.dataset.taskId,d.get("resetScope"));ui.resetTaskId=null;commit();setTimeout(()=>toast("선택한 범위의 Task를 Reset했습니다.","success"),0);return}if(f.dataset.form==="workflow"){const w=state.workflows.find(w=>w.id===f.dataset.workflowId);w.name=d.get("name").trim();w.description=d.get("description").trim();w.owner=d.get("owner").trim();w.updatedAt=new Date().toISOString()}if(f.dataset.form==="task"){const runScope=f.dataset.scope==="run",w=runScope?selectedRun().definitionSnapshot:selectedWorkflow(),t=w.tasks.find(t=>t.id===f.dataset.taskId),before=structuredClone(t);writeTaskFromForm(t,d);const errors=validateWorkflow(w).filter(message=>message.includes("순환")||message.includes("선행 Task 연결"));if(errors.length){Object.assign(t,before);throw Error(errors[0])}w.updatedAt=new Date().toISOString();if(runScope)reconcileSelectedRun(`실행 중 “${t.title}” Task 절차를 수정했습니다.`);ui.editingTaskId=null}commit();setTimeout(()=>toast("서버에 저장했습니다.","success"),0)});
root.addEventListener("dblclick",e=>{const connection=e.target.closest("[data-connection]");if(connection&&structureEditing()){const from=connection.dataset.from,to=connection.dataset.to;if(confirm("이 Task 연결을 삭제할까요?")){removeConnection(from,to);if(state.activeView==="runs")reconcileSelectedRun("실행 중 Task 연결을 삭제했습니다.");ui.selectedConnection=null;commit();toast("Task 연결을 삭제했습니다.","success")}return}const card=e.target.closest("[data-task-card]");if(card&&structureEditing()&&!e.target.closest(".connection-handle")){clearTimeout(ui.clickTimer);ui.selectedTaskId=card.dataset.taskId;ui.editingTaskId=card.dataset.taskId;render()}});
root.addEventListener("mousedown",e=>{const endpoint=e.target.closest("[data-reconnect-end]");if(!endpoint||!structureEditing())return;e.preventDefault();e.stopPropagation();const workflow=selectedWorkflow(),from=workflow.tasks.find(item=>item.id===endpoint.dataset.from),to=workflow.tasks.find(item=>item.id===endpoint.dataset.to),canvas=root.querySelector("[data-workflow-canvas]"),svg=canvas.querySelector(".connection-layer"),preview=document.createElementNS("http://www.w3.org/2000/svg","path");preview.setAttribute("class","preview-connection reconnect-preview");preview.setAttribute("marker-end","url(#arrow)");svg.append(preview);ui.reconnectDrag={end:endpoint.dataset.reconnectEnd,fromId:from.id,toId:to.id,from,to,canvas,preview,hover:null};document.body.classList.add("connecting","reconnecting")});
root.addEventListener("mousedown",e=>{const handle=e.target.closest("[data-connect-output]");if(!handle||!structureEditing())return;e.preventDefault();e.stopPropagation();const workflow=selectedWorkflow(),from=workflow.tasks.find(item=>item.id===handle.dataset.taskId),canvas=root.querySelector("[data-workflow-canvas]"),svg=canvas.querySelector(".connection-layer"),preview=document.createElementNS("http://www.w3.org/2000/svg","path");preview.setAttribute("class","preview-connection");preview.setAttribute("marker-end","url(#arrow)");svg.append(preview);ui.connectionDrag={fromId:from.id,from,canvas,preview,hover:null};document.body.classList.add("connecting")});
root.addEventListener("mousedown",e=>{const card=e.target.closest("[data-task-card]");if(!card||!structureEditing()||e.target.closest(".subtask-toggle,.connection-handle"))return;e.preventDefault();const task=selectedWorkflow().tasks.find(item=>item.id===card.dataset.taskId);ui.drag={id:task.id,startX:e.clientX,startY:e.clientY,origin:{...task.position},card,moved:false};card.classList.add("dragging")});
document.addEventListener("mousemove",e=>{if(!ui.drag)return;const dx=(e.clientX-ui.drag.startX)/ui.mapZoom,dy=(e.clientY-ui.drag.startY)/ui.mapZoom;if(Math.abs(dx)+Math.abs(dy)>3)ui.drag.moved=true;const task=selectedWorkflow().tasks.find(item=>item.id===ui.drag.id);task.position={x:Math.max(16,Math.round((ui.drag.origin.x+dx)/16)*16),y:Math.max(16,Math.round((ui.drag.origin.y+dy)/16)*16)};ui.drag.card.style.left=`${task.position.x}px`;ui.drag.card.style.top=`${task.position.y}px`;updateConnectionPaths(task.id)});
document.addEventListener("mousemove",e=>{if(!ui.reconnectDrag)return;const drag=ui.reconnectDrag,rect=drag.canvas.getBoundingClientRect(),cursor={x:(e.clientX-rect.left)/ui.mapZoom,y:(e.clientY-rect.top)/ui.mapZoom},source={x:drag.from.position.x+230,y:drag.from.position.y+71},destination={x:drag.to.position.x,y:drag.to.position.y+71};drag.preview.setAttribute("d",drag.end==="source"?pathBetweenPoints(cursor,destination):pathBetweenPoints(source,cursor));const target=reconnectDropTarget(e.clientX,e.clientY,drag.end);if(drag.hover&&drag.hover!==target)drag.hover.classList.remove("connection-hover");drag.hover=target||null;if(target)target.classList.add("connection-hover")});
document.addEventListener("mousemove",e=>{if(!ui.connectionDrag)return;const {canvas,from,preview}=ui.connectionDrag,rect=canvas.getBoundingClientRect(),point={x:(e.clientX-rect.left)/ui.mapZoom,y:(e.clientY-rect.top)/ui.mapZoom};preview.setAttribute("d",previewPath(from.position,point));const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.("[data-connect-input]");if(ui.connectionDrag.hover&&ui.connectionDrag.hover!==target)ui.connectionDrag.hover.classList.remove("connection-hover");ui.connectionDrag.hover=target||null;if(target&&target.dataset.taskId!==from.id)target.classList.add("connection-hover")});
document.addEventListener("mouseup",()=>{if(!ui.drag)return;ui.drag.card.classList.remove("dragging");const moved=ui.drag.moved;ui.drag=null;if(moved){commit();setTimeout(()=>toast("Task 위치를 서버에 저장했습니다.","success"),0)}});
document.addEventListener("mouseup",e=>{if(!ui.reconnectDrag)return;const drag=ui.reconnectDrag,target=reconnectDropTarget(e.clientX,e.clientY,drag.end);drag.hover?.classList.remove("connection-hover");drag.preview.remove();document.body.classList.remove("connecting","reconnecting");ui.reconnectDrag=null;if(!target)return;const targetId=target.dataset.taskId,newFrom=drag.end==="source"?targetId:drag.fromId,newTo=drag.end==="destination"?targetId:drag.toId;if(newFrom===drag.fromId&&newTo===drag.toId)return;if(newFrom===newTo){toast("Task를 자기 자신과 연결할 수 없습니다.","error");return}const workflow=selectedWorkflow(),snapshot=new Map(workflow.tasks.map(task=>[task.id,[...task.dependencies]])),oldTarget=workflow.tasks.find(task=>task.id===drag.toId),newTarget=workflow.tasks.find(task=>task.id===newTo);if(!oldTarget||!newTarget)return;oldTarget.dependencies=oldTarget.dependencies.filter(id=>id!==drag.fromId);const merged=newTarget.dependencies.includes(newFrom);if(!merged)newTarget.dependencies.push(newFrom);if(validateWorkflow(workflow).some(message=>message.includes("순환"))){restoreDependencies(workflow,snapshot);toast("순환 연결은 만들 수 없습니다.","error");return}if(state.activeView==="runs")reconcileSelectedRun("실행 중 Task 연결 관계를 변경했습니다.");ui.selectedConnection={from:newFrom,to:newTo};commit();toast(merged?"기존 연결과 병합하고 원래 화살표를 이동했습니다.":`${drag.end==="source"?"출발":"도착"} Task를 변경했습니다.`,"success")});
document.addEventListener("mouseup",e=>{if(!ui.connectionDrag)return;const drag=ui.connectionDrag,target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.("[data-connect-input]");drag.hover?.classList.remove("connection-hover");drag.preview.remove();document.body.classList.remove("connecting");ui.connectionDrag=null;if(!target||target.dataset.taskId===drag.fromId)return;const workflow=selectedWorkflow(),task=workflow.tasks.find(item=>item.id===target.dataset.taskId);if(task.dependencies.includes(drag.fromId)){toast("이미 연결된 Task입니다.","error");return}task.dependencies.push(drag.fromId);if(validateWorkflow(workflow).some(message=>message.includes("순환"))){task.dependencies=task.dependencies.filter(id=>id!==drag.fromId);toast("순환 연결은 만들 수 없습니다.","error");return}if(state.activeView==="runs")reconcileSelectedRun("실행 중 Task 연결을 추가했습니다.");ui.selectedConnection={from:drag.fromId,to:task.id};commit();toast("Task 연결을 저장했습니다.","success")});
root.addEventListener("wheel",e=>{if(!e.ctrlKey||!e.target.closest("[data-zoom-area]"))return;e.preventDefault();setMapZoom(ui.mapZoom+(e.deltaY<0 ? .1 : -.1))},{passive:false});
function updateConnectionPaths(taskId){const workflow=selectedWorkflow();document.querySelectorAll(`.task-connection[data-from="${taskId}"],.task-connection[data-to="${taskId}"],.connection-hitarea[data-from="${taskId}"],.connection-hitarea[data-to="${taskId}"]`).forEach(path=>{const from=workflow.tasks.find(task=>task.id===path.dataset.from),to=workflow.tasks.find(task=>task.id===path.dataset.to);if(from&&to)path.setAttribute("d",pathData(from.position,to.position))})}
function reconnectDropTarget(x,y,end){const element=document.elementFromPoint(x,y),port=element?.closest?.(end==="source"?"[data-connect-output]":"[data-connect-input]");if(port)return port;const cards=[...document.querySelectorAll("[data-task-card]")];return cards.reverse().find(card=>{const rect=card.getBoundingClientRect();return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom})||null}
function removeConnection(fromId,toId){const task=selectedWorkflow()?.tasks.find(item=>item.id===toId);if(task)task.dependencies=task.dependencies.filter(id=>id!==fromId)}
function restoreDependencies(workflow,snapshot){workflow.tasks.forEach(task=>task.dependencies=[...(snapshot.get(task.id)||[])])}
function writeTaskFromForm(task,data){const start=String(data.get("plannedStart")||""),end=String(data.get("plannedEnd")||"");if(start&&end&&start>end)throw Error("예정 종료일은 시작일 이후여야 합니다.");task.plannedStart=start;task.plannedEnd=end;task.memo=String(data.get("memo")||"").trim();task.title=String(data.get("title")||task.title).trim();task.assignee=String(data.get("assignee")||"").trim()||"미지정";task.priority=data.get("priority")||"medium";task.dependencies=data.getAll("dependencies").filter(id=>id!==task.id);task.entry=String(data.get("entry")||"").trim();task.instructions=String(data.get("instructions")||"").trim();task.exit=String(data.get("exit")||"").trim();task.subtasks.forEach(item=>{item.title=String(data.get(`subtask_text_${item.id}`)||item.title).trim();item.required=data.has(`subtask_required_${item.id}`)});task.checklist.forEach(item=>{item.text=String(data.get(`check_text_${item.id}`)||item.text).trim();item.required=data.has(`check_required_${item.id}`)})}
function syncOpenTaskForm(){const form=root.querySelector('form[data-form="task"]');if(!form)return;const task=taskForScope(form.dataset.scope,form.dataset.taskId);if(task)writeTaskFromForm(task,new FormData(form))}
function taskForScope(scope,taskId){const workflow=scope==="run"?selectedRun()?.definitionSnapshot:selectedWorkflow();return workflow?.tasks.find(task=>task.id===taskId)}
function selectedRun(){return state.instances.find(item=>item.id===state.selectedInstanceId)||state.instances[0]}
function reconcileSelectedRun(message){const index=state.instances.findIndex(item=>item.id===selectedRun()?.id);if(index>=0)state.instances[index]=reconcileInstanceStructure(state.instances[index],message)}
function structureEditing(){return state.activeView==="workflows"||(state.activeView==="runs"&&ui.runEditMode)}
function setMapZoom(value){ui.mapZoom=Math.min(1.6,Math.max(.4,Math.round(value*10)/10));render()}function selectedWorkflow(){if(state.activeView==="runs"&&ui.runEditMode)return selectedRun()?.definitionSnapshot;return state.workflows.find(w=>w.id===state.selectedWorkflowId)||state.workflows[0]}function updateRun(fn){const i=state.instances.findIndex(x=>x.id===state.selectedInstanceId);state.instances[i]=fn(state.instances[i]);commit()}render();window.FlowlineCompatibility.markStartupComplete();
}).catch(error=>window.FlowlineCompatibility.showStartupError(error));
