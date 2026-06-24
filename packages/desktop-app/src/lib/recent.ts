// 最近開いたプロジェクト（localStorage 保存．PC ごと・git 管理外）．

export interface RecentProject {
  dir: string;
  posterFile: string;
  title: string;
  /** epoch ms of the last open */
  time: number;
}

const KEY = "rps-recent-projects";
const MAX = 10;

export function loadRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (r): r is RecentProject =>
        r && typeof r.dir === "string" && typeof r.posterFile === "string",
    );
  } catch {
    return [];
  }
}

/** Add (or refresh) an entry and return the new list (most recent first). */
export function pushRecentProject(
  entry: Omit<RecentProject, "time">,
): RecentProject[] {
  const list = loadRecentProjects().filter(
    (r) => !(r.dir === entry.dir && r.posterFile === entry.posterFile),
  );
  const next = [{ ...entry, time: Date.now() }, ...list].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage full / unavailable — recent list is best-effort
  }
  return next;
}

/** Drop an entry (e.g. the folder no longer exists) and return the new list. */
export function removeRecentProject(dir: string, posterFile: string): RecentProject[] {
  const next = loadRecentProjects().filter(
    (r) => !(r.dir === dir && r.posterFile === posterFile),
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
  return next;
}
