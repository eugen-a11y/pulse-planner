import * as chrono from "chrono-node";

export interface ParsedQuickAdd {
  title: string;
  projectId: string | null;
  dueDate: string | null;
  priority: 1 | 2 | 3;
  tagNames: string[];
}

interface ProjectRef { id: string; name: string; }

const TAG_RE = /(^|\s)#([a-zA-ZäöüÄÖÜß0-9_-]+)/g;
const PRIORITY_RE = /(^|\s)!([1-3])\b/;
const PROJECT_RE = /(^|\s)@([a-zA-ZäöüÄÖÜß0-9_-]+)/g;

export function parseQuickAdd(input: string, projects: readonly ProjectRef[]): ParsedQuickAdd {
  let text = input;
  const tagNames: string[] = [];
  let projectId: string | null = null;
  let priority: 1 | 2 | 3 = 2;

  // tags
  text = text.replace(TAG_RE, (_m, lead: string, t: string) => { tagNames.push(t); return lead; });

  // priority
  const pm = PRIORITY_RE.exec(text);
  if (pm) {
    priority = (Number(pm[2]) as 1 | 2 | 3);
    text = text.replace(PRIORITY_RE, "$1").trim();
  }

  // project
  let pmatch: RegExpExecArray | null;
  PROJECT_RE.lastIndex = 0;
  while ((pmatch = PROJECT_RE.exec(text)) !== null) {
    const token = pmatch[2];
    if (!token) continue;
    const prefix = token.toLowerCase();
    const found = projects.find((p) => p.name.toLowerCase().startsWith(prefix));
    if (found) { projectId = found.id; break; }
  }
  text = text.replace(PROJECT_RE, "").trim();

  // date — chrono with German locale
  let dueDate: string | null = null;
  const parsed = chrono.de.parse(text, new Date(), { forwardDate: true });
  if (parsed.length > 0) {
    const first = parsed[0]!;
    dueDate = first.date().toISOString();
    text = (text.slice(0, first.index) + text.slice(first.index + first.text.length)).replace(/\s+/g, " ").trim();
  }

  const title = text.replace(/\s+/g, " ").trim();
  return { title, projectId, dueDate, priority, tagNames };
}
