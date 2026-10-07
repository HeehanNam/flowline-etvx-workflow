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

export function linkedText(value = "") {
  const text = String(value);
  const pattern = /https?:\/\/[^\s<>"']+/gi;
  let result = "", offset = 0;
  for (const match of text.matchAll(pattern)) {
    const url = match[0].replace(/[.,;!?，。]+$/, "");
    result += escapeHtml(text.slice(offset, match.index));
    result += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    offset = match.index + url.length;
  }
  return (result + escapeHtml(text.slice(offset))).replace(/\r?\n/g, "<br>");
}

export function taskSchedule(task) {
 const short = value => { const parts=value.split("-"); return parts.length===3 ? Number(parts[1])+"/"+Number(parts[2]) : value; };
 return task.plannedStart || task.plannedEnd ? " ("+short(task.plannedStart || "미정")+"~"+short(task.plannedEnd || "미정")+")" : "";
}
