// The drafts' calls to Jack's Now editor Worker (workers/now/drafts.js), with the login pass the palette's
// "/login" keeps in this browser. Without a pass there are no drafts to show, and the pages stay as everyone
// sees them.
import { SITE } from '../site';
import { PASS_KEY } from './now-command.js';

export interface DraftSummary { id: string; title: string; topic: string; updated_at: string; images: number }
export interface Draft { id: string; title: string; topic: string; tags: string; body: string; updated_at: string }
export interface DraftImage { name: string; type: string; size: number }

export function draftPass(): string {
  try { return localStorage.getItem(PASS_KEY) ?? ''; } catch { return ''; }
}

/** A call to the Worker: its JSON, or an Error with the Worker's words. */
export async function draftCall<T>(path: string, init: { method?: string; json?: unknown; text?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${draftPass()}` };
  if (init.json !== undefined) headers['Content-Type'] = 'application/json';
  if (init.text !== undefined) headers['Content-Type'] = 'text/plain';
  let answer: Response;
  try {
    answer = await fetch(`${SITE.nowEditor}${path}`, { method: init.method ?? (init.json !== undefined || init.text !== undefined ? 'POST' : 'GET'), headers, body: init.text ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined) });
  } catch {
    throw new Error("Couldn't reach the editor. Check the connection and try again.");
  }
  const data = await answer.json().catch(() => null);
  if (!answer.ok) throw Object.assign(new Error(data?.error ?? 'Something went wrong. Please try again.'), { status: answer.status });
  return data as T;
}

/** A draft's picture, fetched with the pass (an <img> can't send one), as a data: address the page can show. */
export async function pictureUrl(id: string, name: string): Promise<string> {
  const { type, base64 } = await draftCall<{ type: string; base64: string }>(`/api/drafts/${id}/images/${name}`);
  return `data:${type};base64,${base64}`;
}

/** A file as base64, made here: the Worker has too little CPU time to make it itself (workers/now/drafts.js). */
export const fileBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
  reader.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
  reader.readAsDataURL(file);
});

/**
 * Publishes a draft in the Worker's steps: the check, each picture to GitHub, then the commit. `step` hears what's
 * happening, for the page to show. Returns the post's address.
 */
export async function publishDraft(id: string, step: (words: string) => void): Promise<string> {
  step('Checking');
  const { pictures } = await draftCall<{ pictures: string[] }>(`/api/drafts/${id}/publish`, { method: 'POST' });
  const blobs: Record<string, string> = {};
  for (const [i, name] of pictures.entries()) {
    step(`Sending picture ${i + 1} of ${pictures.length}`);
    blobs[name] = (await draftCall<{ sha: string }>(`/api/drafts/${id}/publish?step=picture&name=${encodeURIComponent(name)}`, { method: 'POST' })).sha;
  }
  step('Publishing');
  return (await draftCall<{ address: string }>(`/api/drafts/${id}/publish?step=finish`, { json: { blobs } })).address;
}
