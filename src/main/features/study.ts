import * as path from 'path'
import { dialog } from 'electron'
import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { STUDY_TEXT } from '../../shared/study-copy'
import type { StudyResult } from '../../shared/study-companion'
import { confirmStudyPlan, discardStudyPlan, exportStudyVault, importStudyMaterial, readStudyMaterial, setStudyTaskStatus } from '../study/materials'
import { editStudyTasks } from '../study/tasks'
import { detectAgy, listAgyModels } from '../study/agy-detect'
import { getStudyUsage } from '../study/usage'
import { runMathViaMcp } from '../study/math'
import { createHtmlPreview } from '../study/html-preview'
import type { MainFeature } from '../context'

function studyResult<T>(action: () => T): StudyResult<T> {
  try { return { ok: true, data: action() } }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : STUDY_TEXT.OPERATION_FAILED } }
}

async function studyAsyncResult<T>(action: () => Promise<T>): Promise<StudyResult<T>> {
  try { return { ok: true, data: await action() } }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : STUDY_TEXT.OPERATION_FAILED } }
}

// register 时填；dispose() 没有 ctx 参数，靠它拿到连接池
let closeConnections: (() => Promise<void>) | null = null

export const studyFeature: MainFeature = {
  name: 'study',
  register(ctx) {
    const { readConfig, storageDir, studyMathPath } = ctx
    const { store: studyStore, connections: studyConnections, generateLearningPlan } = ctx.study

    // ---- AI 学习助手 (2026-10-27)
    handle(IPC.studyGetState, () => studyConnections.snapshot())
    handle(IPC.studyCreateHtmlPreview, (_event, html: unknown) => studyResult(() => createHtmlPreview(html)))
    handle(IPC.studyRunMath, (_event, input: unknown) => studyAsyncResult(() => runMathViaMcp(input, studyMathPath, storageDir)))
    handle(IPC.studySaveConnection, (_event, input: unknown) => studyResult(() => studyConnections.save(input)))
    handle(IPC.studyDetectAgent, () => studyAsyncResult(() => detectAgy()))
    handle(IPC.studyListModels, (_event, command: unknown) => studyAsyncResult(() => listAgyModels(command)))
    handle(IPC.studyConnect, (_event, id: unknown) => studyAsyncResult(() => studyConnections.connect(id)))
    handle(IPC.studyAuthenticate, (_event, input: unknown) => studyAsyncResult(() => studyConnections.authenticate(input)))
    handle(IPC.studyDisconnect, (_event, id: unknown) => studyAsyncResult(() => studyConnections.disconnect(id)))
    handle(IPC.studySetModel, (_event, input: unknown) => studyAsyncResult(() => studyConnections.setModel(input)))
    handle(IPC.studyRemoveConnection, (_event, id: unknown) => studyAsyncResult(() => studyConnections.remove(id)))
    handle(IPC.studySelectConnection, (_event, id: unknown) => studyResult(() => studyConnections.select(id)))
    handle(IPC.studySaveMemory, (_event, input: unknown) => studyResult(() => studyStore.saveMemory(input)))
    handle(IPC.studyForgetMemory, (_event, id: unknown) => studyResult(() => studyStore.forgetMemory(id)))
    handle(IPC.studyUpdatePosition, (_event, input: unknown) => studyResult(() => studyStore.updatePosition(input)))
    handle(IPC.studySaveNote, (_event, input: unknown) => studyResult(() => studyStore.saveNote(input)))
    handle(IPC.studyArchiveNote, (_event, id: unknown) => studyResult(() => studyStore.archiveNote(id)))
    handle(IPC.studyReadMaterial, (_event, id: unknown) => studyResult(() => readStudyMaterial(studyStore, id)))
    handle(IPC.studyGetUsage, (_event, refresh: unknown) => studyAsyncResult(() => {
      if (refresh !== undefined && typeof refresh !== 'boolean') throw new Error(STUDY_TEXT.REFRESH_INVALID)
      const ai = readConfig().ai
      return getStudyUsage(studyStore, refresh === true, { provider: ai.provider ?? 'custom', baseUrl: ai.baseUrl, apiKey: ai.apiKey })
    }))
    handle(IPC.studySetTaskStatus, (_event, input: unknown) => studyResult(() => setStudyTaskStatus(studyStore, input)))
    handle(IPC.studyImportMaterials, () => studyAsyncResult(async () => {
      const picked = await dialog.showOpenDialog({ title: STUDY_TEXT.IMPORT_TITLE, properties: ['openFile'], filters: [{ name: STUDY_TEXT.MATERIAL_FILTER, extensions: ['pdf', 'md', 'txt'] }] })
      if (picked.canceled || !picked.filePaths[0]) return []
      return [await importStudyMaterial(studyStore, picked.filePaths[0])]
    }))
    handle(IPC.studyGeneratePlan, (_event, input: unknown) => studyAsyncResult(() => generateLearningPlan(input)))
    handle(IPC.studyConfirmPlan, (_event, input: unknown) => studyResult(() => confirmStudyPlan(studyStore, input)))
    handle(IPC.studyDiscardPlan, (_event, planId: unknown) => studyResult(() => discardStudyPlan(studyStore, planId)))
    handle(IPC.studyEditTasks, (_event, input: unknown) => studyResult(() => editStudyTasks(studyStore, input)))
    handle(IPC.studyExportVault, () => studyAsyncResult(async () => {
      const picked = await dialog.showOpenDialog({ title: STUDY_TEXT.EXPORT_TITLE, properties: ['openDirectory', 'createDirectory'] })
      if (picked.canceled || !picked.filePaths[0]) return null
      const directory = path.join(picked.filePaths[0], `learning-vault-${Date.now()}`)
      exportStudyVault(studyStore, directory)
      return { path: directory }
    }))
    closeConnections = () => studyConnections.close()
  },
  // study 与 ai-chat 共用同一个 ACP 连接池；退出前统一在这里收（原 app.ts 顶层 before-quit 的第一个）
  dispose() {
    // kill() is issued synchronously inside; quit does not wait for the exit to be confirmed
    void closeConnections?.()
  }
}
