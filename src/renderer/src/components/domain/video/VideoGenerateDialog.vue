<script setup lang="ts">
import MiModal from '../../base/MiModal.vue'
import MiButton from '../../base/MiButton.vue'
import { useVideoStore } from '../../../stores/video'
import { VIDEO_UI } from '../../../lib/copy'
import { computed } from 'vue'
import { useSettingsStore } from '../../../stores/settings'
import { useSettingsDialogStore } from '../../../stores/settings-dialog'
import { useStudyStore } from '../../../stores/study'
const video = useVideoStore()
const remote = window.miai.isRemote
const settings = useSettingsStore()
const settingsDialog = useSettingsDialogStore()
const study = useStudyStore()
const hasAi = computed(() => Boolean(settings.config.ai?.hasKey) || Boolean(study.activeConnectionId))
function openAiSettings(): void {
  void video.closeDialog()
  settingsDialog.openSettings('ai')
}
</script>
<template>
  <MiModal :visible="video.dialogOpen" :title="VIDEO_UI.GENERATE" :width="560" @update:visible="v => { if (!v) void video.closeDialog() }">
    <div v-if="video.verification" class="dialog-body">
      <h3>{{ VIDEO_UI.VERIFY_TITLE }}</h3><p>{{ VIDEO_UI.VERIFY_HINT }}</p>
      <pre class="code">{{ video.verification.code.join('\n') }}</pre>
      <div class="actions"><MiButton variant="secondary" @click="video.answerVerification(false)">{{ VIDEO_UI.VERIFY_SKIP }}</MiButton><MiButton variant="primary" @click="video.answerVerification(true)">{{ VIDEO_UI.VERIFY_ACCEPT }}</MiButton></div>
    </div>
    <div v-else-if="video.loading" class="dialog-body" role="status"><h3>{{ VIDEO_UI.GENERATING }}</h3><MiButton variant="secondary" @click="video.closeDialog()">{{ VIDEO_UI.CANCEL }}</MiButton></div>
    <div v-else-if="remote" class="dialog-body"><p>{{ VIDEO_UI.PHONE_GENERATE }}</p><div class="actions"><MiButton variant="secondary" @click="video.closeDialog()">{{ VIDEO_UI.CLOSE }}</MiButton></div></div>
    <div v-else-if="!hasAi" class="dialog-body">
      <h3>{{ VIDEO_UI.CONFIGURE }}</h3>
      <p>{{ VIDEO_UI.CONFIGURE_HINT }}</p>
      <div class="actions">
        <MiButton variant="secondary" @click="video.closeDialog()">{{ VIDEO_UI.CLOSE }}</MiButton>
        <MiButton variant="primary" @click="openAiSettings">{{ VIDEO_UI.SETTINGS }}</MiButton>
      </div>
    </div>
    <div v-else-if="!video.outline" class="dialog-body">
      <label for="video-question">{{ VIDEO_UI.QUESTION_TITLE }}</label>
      <textarea id="video-question" v-model="video.question" maxlength="500" rows="4" :placeholder="VIDEO_UI.QUESTION_HINT" />
      <p v-if="video.excerpt" class="excerpt"><strong>{{ VIDEO_UI.EXCERPT }}</strong><br>{{ video.excerpt }}</p>
      <p v-if="video.error" role="alert" class="error">{{ video.error }} <MiButton size="sm" variant="secondary" @click="openAiSettings">{{ VIDEO_UI.SETTINGS }}</MiButton></p>
      <div class="actions"><MiButton variant="secondary" @click="video.closeDialog()">{{ VIDEO_UI.CANCEL }}</MiButton><MiButton variant="primary" :disabled="!video.question.trim()" @click="video.makeOutline()">{{ VIDEO_UI.GET_OUTLINE }}</MiButton></div>
    </div>
    <div v-else class="dialog-body">
      <h3>{{ VIDEO_UI.OUTLINE }}</h3><div class="outline"><strong>{{ VIDEO_UI.CONFUSION }}</strong><p>{{ video.outline.confusion }}</p></div><div class="outline"><strong>{{ VIDEO_UI.ANALOGY }}</strong><p>{{ video.outline.analogy }}</p></div>
      <ol class="goals"><li v-for="(scene, i) in video.outline.scenes" :key="i">{{ scene.goal }}</li></ol>
      <p v-if="video.error" role="alert" class="error">{{ video.error }} <MiButton size="sm" variant="secondary" @click="openAiSettings">{{ VIDEO_UI.SETTINGS }}</MiButton></p>
      <div class="actions"><MiButton variant="ghost" @click="video.outline = null">{{ VIDEO_UI.BACK }}</MiButton><MiButton variant="secondary" @click="video.makeOutline(video.outline.analogy)">{{ VIDEO_UI.REGENERATE }}</MiButton><MiButton variant="primary" @click="video.generate()">{{ VIDEO_UI.START }}</MiButton></div>
    </div>
  </MiModal>
</template>
<style scoped>
.dialog-body { display:flex; flex-direction:column; gap:var(--mi-sp-4); } h3 { font-size:var(--mi-fs-read); font-weight:var(--mi-fw-medium); }
textarea { width:100%; border:1px solid var(--mi-border-control); border-radius:var(--mi-radius); padding:var(--mi-sp-3); font:inherit; resize:vertical; }
.excerpt,.outline { background:var(--mi-blue-light); border-radius:var(--mi-radius); padding:var(--mi-sp-3); white-space:pre-wrap; overflow-wrap:anywhere; }
.excerpt { max-height:120px; overflow:auto; color:var(--mi-text-2); }.goals { padding-left:var(--mi-sp-6); }.code { max-height:45vh; overflow:auto; background:var(--mi-code-bg); padding:var(--mi-sp-4); font:var(--mi-fs-body)/1.6 var(--mi-code); white-space:pre; user-select:text; }
.actions { display:flex; justify-content:flex-end; gap:var(--mi-sp-2); flex-wrap:wrap; }.error { color:var(--mi-error-deep); overflow-wrap:anywhere; }
</style>
