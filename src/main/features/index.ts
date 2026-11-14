import type { MainFeature } from '../context'
import { htmlPreviewFeature, htmlPreviewFrameGuardFeature } from './html-preview'
import { cet6Feature } from './cet6'
import { profileFeature } from './profile'
import { wrongbookFeature } from './wrongbook'
import { favoritesFeature } from './favorites'
import { memoFeature } from './memo'
import { practiceFeature } from './practice'
import { configFeature } from './config'
import { aiQuestionsFeature } from './ai-questions'
import { studyFeature } from './study'
import { aiChatFeature } from './ai-chat'
import { challengeFeature } from './challenge'
import { runnerFeature } from './runner'
import { cloudFeature } from './cloud'
import { remoteFeature } from './remote'

/**
 * 功能清单 —— 顺序即注册顺序，也是 before-quit 时 dispose 的顺序。
 * 前三项是原 whenReady 开头的协议 / 请求拦截安装，相对顺序是硬约束
 * （都必须早于建窗口）；cloud 放最后，因为启动时的会话恢复要在所有 handler 之后。
 */
export const FEATURES: MainFeature[] = [
  htmlPreviewFeature,
  cet6Feature,
  htmlPreviewFrameGuardFeature,
  profileFeature,
  wrongbookFeature,
  favoritesFeature,
  memoFeature,
  practiceFeature,
  configFeature,
  aiQuestionsFeature,
  studyFeature,
  aiChatFeature,
  challengeFeature,
  runnerFeature,
  remoteFeature,
  cloudFeature
]
