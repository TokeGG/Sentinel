// Pure SQL builders for migration 41 (bot_workflows, bot_jobs, bot_job_runs, bot_site_notes) and the weekly view.
import type { Q } from "./sql.ts";
import type { Workflow } from "./workflow.ts";

export const listWorkflows = (): Q => ({ sql: "SELECT id, name, goal, start_url, steps, source FROM bot_workflows ORDER BY id DESC", params: [] });
export const insertWorkflow = (w: Workflow): Q => ({ sql: "INSERT INTO bot_workflows (name, goal, start_url, steps, source) VALUES ($1,$2,$3,$4,$5)", params: [w.name, w.goal.slice(0, 500), w.startUrl.slice(0, 2000), JSON.stringify(w.steps), w.source] });
export const updateWorkflow = (w: Workflow & { id: number }): Q => ({ sql: "UPDATE bot_workflows SET name = $2, goal = $3, start_url = $4, steps = $5 WHERE id = $1", params: [w.id, w.name, w.goal.slice(0, 500), w.startUrl.slice(0, 2000), JSON.stringify(w.steps)] });
export const deleteWorkflow = (id: number): Q => ({ sql: "DELETE FROM bot_workflows WHERE id = $1", params: [id] });

export const listJobs = (): Q => ({ sql: "SELECT id, name, goal, workflow_id, every_minutes, enabled, last_run FROM bot_jobs ORDER BY id", params: [] });
export const insertJob = (name: string, goal: string, workflowId: number | null, every: number): Q => ({ sql: "INSERT INTO bot_jobs (name, goal, workflow_id, every_minutes, enabled) VALUES ($1,$2,$3,$4,0)", params: [name.slice(0, 80), goal.slice(0, 500), workflowId, Math.max(60, Math.min(10080, Math.round(every)))] });
export const setJobEnabled = (id: number, on: boolean): Q => ({ sql: "UPDATE bot_jobs SET enabled = $2 WHERE id = $1", params: [id, on ? 1 : 0] });
export const deleteJob = (id: number): Q => ({ sql: "DELETE FROM bot_jobs WHERE id = $1", params: [id] });
export const markJobRun = (id: number): Q => ({ sql: "UPDATE bot_jobs SET last_run = datetime('now') WHERE id = $1", params: [id] });
export const insertJobRun = (jobId: number, outcome: string, summary: string): Q => ({ sql: "INSERT INTO bot_job_runs (job_id, outcome, summary) VALUES ($1,$2,$3)", params: [jobId, outcome, summary.slice(0, 600)] });
export const jobRuns = (limit = 30): Q => ({ sql: "SELECT r.id, r.job_id, j.name, r.outcome, r.summary, r.at FROM bot_job_runs r LEFT JOIN bot_jobs j ON j.id = r.job_id ORDER BY r.id DESC LIMIT $1", params: [limit] });
export const pruneJobRuns = (keep = 300): Q => ({ sql: "DELETE FROM bot_job_runs WHERE id NOT IN (SELECT id FROM bot_job_runs ORDER BY id DESC LIMIT $1)", params: [keep] });

export const listSiteNotes = (): Q => ({ sql: "SELECT host, text, updated_at FROM bot_site_notes ORDER BY host", params: [] });
export const putSiteNote = (host: string, text: string): Q => ({ sql: "INSERT OR REPLACE INTO bot_site_notes (host, text, updated_at) VALUES ($1,$2,datetime('now'))", params: [host.slice(0, 255), text] });
export const deleteSiteNote = (host: string): Q => ({ sql: "DELETE FROM bot_site_notes WHERE host = $1", params: [host] });

export const weekEpisodes = (): Q => ({ sql: "SELECT json FROM bot_episodes WHERE created_at >= datetime('now', '-7 days') ORDER BY id DESC LIMIT 300", params: [] });
export const snapKey = (cls: string) => `snap:${cls}`;
