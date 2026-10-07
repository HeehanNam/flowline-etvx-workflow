export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
}

export function taskSchedule(task) {
 const short = value => { const parts=value.split("-"); return parts.length===3 ? Number(parts[1])+"/"+Number(parts[2]) : value; };
 return task.plannedStart || task.plannedEnd ? " ("+short(task.plannedStart || "미정")+"~"+short(task.plannedEnd || "미정")+")" : "";
}
