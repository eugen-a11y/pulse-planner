import { X } from "lucide-react";
import { useUi } from "../stores/ui.js";
import { useTasks } from "../stores/tasks.js";
import { TaskHeader } from "./TaskHeader.js";
import { TaskMeta } from "./TaskMeta.js";
import { TaskBody } from "./TaskBody.js";
import { SubtaskList } from "./SubtaskList.js";
import { TimeEntryList } from "./TimeEntryList.js";
import { NotePane } from "./NotePane.js";
import { CommentList } from "./CommentList.js";
import { AttachmentList } from "./AttachmentList.js";

export function DetailPane(): JSX.Element | null {
  const id = useUi((s) => s.selectedTaskId);
  const close = useUi((s) => s.closeDetail);
  const task = useTasks((s) => (id ? s.byId[id] : undefined));

  if (!task) return null;

  return (
    <aside className="w-[380px] border-l border-[var(--border)] bg-white flex flex-col">
      <div className="flex items-center justify-end p-2 border-b border-[var(--border)]">
        <button onClick={close} className="p-1 text-gray-500 hover:bg-gray-100 rounded" aria-label="Schließen">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <TaskHeader task={task} />
        <TaskMeta task={task} />
        <TaskBody task={task} />
        <SubtaskList parent={task} />
        <TimeEntryList task={task} />
        <NotePane task={task} />
        <CommentList task={task} />
        <AttachmentList task={task} />
      </div>
    </aside>
  );
}
