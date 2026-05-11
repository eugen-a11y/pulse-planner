import type {
  Project, Task, Tag, TaskTag, Attachment, TimeEntry, Comment, Note,
  PulseSession, OutboxEntry,
} from "@pulse/core";

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export interface SyncStatus {
  online: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  outboxSize: number;
  lastError: string | null;
}

export interface ParsedQuickAdd {
  title: string;
  projectId: string | null;
  dueDate: string | null;
  priority: 1 | 2 | 3 | 4;
  tagNames: string[];
}

export interface PulseApi {
  // Resolves an absolute file path from a dropped File object. Required since
  // Electron 32+ removed File.path; the renderer must call into preload to
  // hit webUtils.getPathForFile.
  getPathForFile(file: File): string;
  auth: {
    signIn(email: string, password: string): Promise<PulseSession>;
    signUp(email: string, password: string): Promise<PulseSession>;
    signOut(): Promise<void>;
    restoreSession(): Promise<PulseSession | null>;
  };
  projects: {
    list(): Promise<Project[]>;
    create(input: { name: string; color?: string }): Promise<Project>;
    update(id: string, fields: Partial<Project>): Promise<Project>;
    delete(id: string): Promise<void>;
  };
  tasks: {
    list(filter: { projectId?: string }): Promise<Task[]>;
    listToday(): Promise<Task[]>;
    listUpcoming(): Promise<Task[]>;
    listInbox(): Promise<Task[]>;
    tagsForTask(taskId: string): Promise<string[]>;
    create(input: {
      projectId: string | null; title: string;
      dueDate?: string | null; priority?: 1 | 2 | 3 | 4;
      parentTaskId?: string | null; description?: string | null;
    }): Promise<Task>;
    update(id: string, fields: Partial<Task>): Promise<Task>;
    delete(id: string): Promise<void>;
    complete(id: string): Promise<Task>;
  };
  tags: {
    list(): Promise<Tag[]>;
    create(input: { name: string; color?: string }): Promise<Tag>;
    delete(id: string): Promise<void>;
    attach(taskId: string, tagId: string): Promise<void>;
    detach(taskId: string, tagId: string): Promise<void>;
  };
  notes: {
    listForTask(taskId: string): Promise<Note[]>;
    listForProject(projectId: string): Promise<Note[]>;
    create(input: { projectId?: string; taskId?: string; bodyMd: string }): Promise<Note>;
    update(id: string, fields: { bodyMd: string }): Promise<Note>;
    delete(id: string): Promise<void>;
  };
  comments: {
    listForTask(taskId: string): Promise<Comment[]>;
    create(input: { taskId: string; bodyMd: string }): Promise<Comment>;
    update(id: string, fields: { bodyMd: string }): Promise<Comment>;
    delete(id: string): Promise<void>;
  };
  attachments: {
    listForTask(taskId: string): Promise<Attachment[]>;
    upload(input: { taskId: string; localPath: string }): Promise<Attachment>;
    openLocally(id: string): Promise<void>;
    delete(id: string): Promise<void>;
  };
  time_entries: {
    listForTask(taskId: string): Promise<TimeEntry[]>;
    start(taskId: string): Promise<TimeEntry>;
    stop(): Promise<TimeEntry | null>;
  };
  sync: {
    pushNow(): Promise<void>;
    pullNow(): Promise<void>;
  };
  timer: {
    current(): Promise<{ taskId: string; startedAt: string } | null>;
  };
  quickAdd: {
    show(): void;
    parse(text: string): Promise<ParsedQuickAdd>;
    submit(parsed: ParsedQuickAdd): Promise<Task>;
  };
  notifications: {
    snooze(taskId: string, minutes: number): Promise<void>;
  };
  updater: {
    check(): Promise<UpdateInfo | null>;
    installAndRestart(): void;
  };
  events: {
    on(channel: PulseEvent, cb: (data: unknown) => void): () => void;
  };
}

export type PulseEvent =
  | "tasks.changed"
  | "projects.changed"
  | "tags.changed"
  | "sync.status"
  | "timer.current"
  | "updater.progress"
  | "updater.downloaded"
  | "auth.expired"
  | "toast.show"
  | "nav.today"
  | "nav.task";
