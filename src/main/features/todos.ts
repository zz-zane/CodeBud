import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { emptyTodoFile, normalizeTodoFile, type TodoFile } from '../../shared/today-todo'
import { createJsonStore } from '../store/json-store'
import type { MainFeature } from '../context'

/**
 * 「今天」页每日待办（today-todos.json，v1）。渲染层是唯一写方，整份读整份存；
 * 这里只做读口 / 写口归一化（坏条目丢掉、同一步骤只留一条），所以桌面和手机同时加同一步骤也不会重复。
 * shortcut: 后写的覆盖先写的（无版本戳），桌面与手机同时改同一天的待办可能丢一次改动；要并发编辑时改成 memo 那套 StampedDoc。
 */
export const todosFeature: MainFeature = {
  name: 'todos',
  register(ctx) {
    const store = createJsonStore<TodoFile>(ctx.storageDir, 'today-todos.json')
    const read = (): TodoFile => {
      const raw = store.read()
      return raw === null ? emptyTodoFile() : normalizeTodoFile(raw)
    }
    handle(IPC.todosGet, (): TodoFile => read())
    handle(IPC.todosSave, (_e, raw: unknown): TodoFile => {
      const file = normalizeTodoFile(raw)
      store.write(file)
      return file
    })
  }
}
