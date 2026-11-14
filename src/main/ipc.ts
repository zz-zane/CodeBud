/**
 * IPC 登记口（docs/28 §2 规矩 1、docs/29 §3.2）：`handle` 在向 ipcMain 注册的同时把 handler
 * 记进一张表，手机端的远程调用从这张表取同一个函数执行 —— 一个功能只写一遍。
 * 全仓只有 `features/` 下的文件调用它；本文件顶层只有一个 Map 的声明，没有副作用。
 */
import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'

/** `never[]`：各 handler 的参数各有各的类型，登记时一律放行，调用侧统一当 unknown 传入（入参由 handler 自己校验） */
type Handler = (event: IpcMainInvokeEvent, ...args: never[]) => unknown
type Invoker = (event: unknown, args: unknown[]) => unknown

const registry = new Map<string, Invoker>()

export function handle(channel: string, fn: Handler): void {
  const loose = fn as (e: IpcMainInvokeEvent, ...a: unknown[]) => unknown
  ipcMain.handle(channel, loose)
  registry.set(channel, (event, args) => (loose as (e: unknown, ...a: unknown[]) => unknown)(event, ...args))
}

/** 远程服务按通道名取 handler；没登记 = undefined */
export function lookupHandler(channel: string): Invoker | undefined {
  return registry.get(channel)
}
