# 咪爱编程宣傳素材來源

核對日期：2026-11-14。所有正式素材位於本目錄；未執行 git commit。

## 背景圖片

| 檔案 | 內容 | 作者／製作 | 來源與授權類型 |
|---|---|---|---|
| bg_room.png | 夜晚溫馨書桌房間 | 本次由 Codex 使用 OpenAI imagegen 生成 | 本次生成素材，非網路圖庫下載；沒有另行附加 CC0／CC-BY 授權。服務來源：https://openai.com/；適用生成服務條款。 |
| bg_world.png | 明亮白天橫向卷軸野外場景 | 本次由 Codex 使用 OpenAI imagegen 生成 | 本次生成素材，非網路圖庫下載；沒有另行附加 CC0／CC-BY 授權。服務來源：https://openai.com/；適用生成服務條款。 |
| bg_islands.png | 五座不同主題的漂浮島 | 本次由 Codex 使用 OpenAI imagegen 生成 | 本次生成素材，非網路圖庫下載；沒有另行附加 CC0／CC-BY 授權。服務來源：https://openai.com/；適用生成服務條款。 |
| bg_sunrise.png | 日出雲海片尾底圖 | 本次由 Codex 使用 OpenAI imagegen 生成 | 本次生成素材，非網路圖庫下載；沒有另行附加 CC0／CC-BY 授權。服務來源：https://openai.com/；適用生成服務條款。 |
| bg_circuit.png | 深墨綠低對比電路底紋 | 本次由 Codex 使用 OpenAI imagegen 生成 | 本次生成素材，非網路圖庫下載；沒有另行附加 CC0／CC-BY 授權。服務來源：https://openai.com/；適用生成服務條款。 |

五張最終圖均為 **1920×1080、16:9、RGB PNG**，已逐張目視檢查：沒有主角、可見文字、字母、logo 或浮水印，下方保留較乾淨區域供疊字。島上的小蛇屬指定場景內容。原始工具輸出為 1672×941；以 FFmpeg nearest-neighbor（最近鄰）縮放至交付尺寸，保留像素邊緣；不是原生 1080p 生成。未將圖片宣稱為手繪作品或第三方 CC0 作品。

風格參考由使用者提供，原檔：
`<本地工作区>`。
參考作者／原始授權未提供；只用於配色與像素風格參考，沒有把主角畫入交付背景。
配色依照米白 #F6F4EC、淡綠 #7DB87A、淡黃 #FFF2A6；電路底圖以 #16261C 深墨綠為目標色調。

## 背景音樂：bgm.mp3

- 曲名：**Short 8-bit Music**。
- 作者：**tamesu**，作者頁：https://opengameart.org/users/tamesu
- 來源頁：https://opengameart.org/content/short-8-bit-music
- 直接下載：https://opengameart.org/sites/default/files/short_8-bit_music_1.mp3
- 授權：**CC0 1.0 Universal**，https://creativecommons.org/publicdomain/zero/1.0/
- 來源頁明確標示 CC0，並說明適合選單或宣傳 trailer；可免費商用、修改，不要求署名。保留本紀錄便於追溯。
- 交付：原始 MP3 位元組直接改名，未裁切、未循環或重新編碼；44.1 kHz、雙聲道、約 **42.997542 秒**，符合 40 秒以上。
- 類型：8-bit / chiptune 音樂；未做正常速度人工試聽，已完整解碼且無錯誤。
- 來源文字快照：`sources/bgm-source.txt`（透過 Jina Reader 讀取公開來源頁）。

## 字體：fonts/fusion-pixel-12px.ttf

- 專案：**缝合像素字体 / Fusion Pixel Font**。
- 作者／著作權：**TakWolf 與專案貢獻者**；Copyright (c) 2022, TakWolf (https://takwolf.com)。
- 官方專案：https://github.com/TakWolf/fusion-pixel-font
- 查詢最新 release 的官方 API：https://api.github.com/repos/TakWolf/fusion-pixel-font/releases/latest
- 本次最新 release：**2026.11.10**，發布於 2026-11-09 20:53:07 UTC。
- 來源 release：https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.11.10
- 壓縮包：https://github.com/TakWolf/fusion-pixel-font/releases/download/2026.11.10/fusion-pixel-font-12px-proportional-ttf-v2026.11.10.zip
- 所選：`fusion-pixel-12px-proportional-zh_hans.ttf`，12px、比例字寬、簡體中文字型；僅更改外部檔名，未改字體內部資料。
- 壓縮包官方 SHA-256：`aa6b4da3f80d95af45f41d74b37db0fa3a832d7f428adeb7234b4758d50bbae9`。
- 字型授權：**SIL Open Font License 1.1（OFL-1.1）**，可商用與嵌入影片。隨字體再散布時須保留著作權與授權文字；字體本身不可單獨出售。其他條件以完整授權為準。
- 官方授權：https://github.com/TakWolf/fusion-pixel-font/blob/2026.11.10/LICENSE-OFL
- 完整授權隨附：`fonts/OFL.txt`。此處使用的是字體的 OFL，而不是專案程式碼的 MIT。
- 未採用 Zpix 替代方案。

## 製圖提示詞與生成紀錄

使用內建 imagegen，每個素材各一次生成，附同一張參考圖作風格參考。
以下為實際送出的完整提示詞，便於後續維持風格：

### bg_room.png

```text
Create ONE final promotional background asset bg_room.png. 16:9 landscape, exactly 1920x1080 or larger (prefer 2560x1440). Reference image is STYLE/PALETTE ONLY: coarse low-resolution pixel art, flat square pixel clusters, limited pastel palette, pale yellow #FFF2A6, sage green #7DB87A outlines, off-white #F6F4EC, a few warm orange highlights. Do NOT depict the creature, any mascot, character, face or person. Cozy nighttime study room with a wooden desk, one softly glowing blank retro CRT monitor, a window showing stars. Warm, calm and inviting. Compose desk/monitor/window mostly in UPPER TWO THIRDS; bottom third is uncluttered broad flat pale sage shadow/desk-front area for later subtitles, no objects there. A simple blocky 8-bit indie game background matching the sparse coarse pixels of the reference, no painterly detail, no smooth vector curves, no photorealism. Night uses muted sage shadows and cream light. Absolutely NO text, letters, digits, code glyphs, labels, logos or watermarks anywhere, including monitor; blank monitor glow only. Full bleed image with no border.
```

### bg_world.png

```text
Create ONE final background bg_world.png, landscape 16:9 exactly 1920x1080 or larger (prefer 2560x1440). Style reference attached ONLY for pixel shapes and palette; do NOT draw the creature or any character. Very coarse low resolution 8-bit pixel art with crisp squared steps and large simple flat pixel clusters. Soft cream #F6F4EC sky, pale yellow #FFF2A6 sunlight and sage #7DB87A outlines/grass, subdued distant pale green mountains and blocky cream clouds. Bright daytime, cheerful side-scrolling platform game outdoor meadow. Horizon/flat grass platform top is at y=75 percent of image (25 percent up from bottom). Absolutely level continuous ground across full width suitable for animating a walking character later. Mountains only in distance. Bottom third is very clean, almost flat low-detail green and cream turf with NO foreground objects, stones, flowers or obstacles. Upper sky open, a few clouds. Full bleed, not framed. NO text, letters, numbers, logo, watermark, UI, characters, faces or mascot. Match reference's restrained coarse pixel simplicity, no photographic texture or painterly detail.
```

### bg_islands.png

```text
ONE standalone 16:9 landscape promotional background, request 2560x1440 PNG. Reference image ONLY for coarse low-resolution pixel art style and soft palette, NO creature. Large flat square pixel clusters and crisp stairstep silhouettes, cream #F6F4EC, light sage #7DB87A, pale yellow #FFF2A6, sparse muted warm orange. No realistic textures, no vector curves. Absolutely NO text, letters, digits, logos, watermarks, symbols resembling writing, UI, people, characters or mascot. Bottom third is clean low-detail negative space for captions. Full bleed. bg_islands.png: Exactly FIVE separate floating small pixel islands arranged across upper two thirds of a pale cream sky, each clearly visible and connected by tiny bridges or luminous dotted paths. Left to right five themes: a pastel BLUE crystal cluster island; a muted PURPLE mechanical island with two chunky gears; a warm ORANGE island with a large plain coffee cup; a YELLOW-GREEN jungle island with blocky plants and a small curled green snake (only animal, simple natural snake, not mascot); a muted PINK island with a large open blank book with no markings. Use these theme colors sparingly within unified soft cream/sage/yellow environment. No sixth island. Keep island bases above y=65%, bottom third empty cream sky with only faint cloud silhouettes. Coarse charming 8-bit game map style, small simple islands and clean spacing.
```

### bg_sunrise.png

```text
ONE standalone 16:9 landscape promotional background, request 2560x1440 PNG. Reference image ONLY for coarse low-resolution pixel art style and soft palette, NO creature. Large flat square pixel clusters and crisp stairstep silhouettes, cream #F6F4EC, light sage #7DB87A, pale yellow #FFF2A6, sparse muted warm orange. No realistic textures, no vector curves. Absolutely NO text, letters, digits, logos, watermarks, symbols resembling writing, UI, people, characters or mascot. Bottom third is clean low-detail negative space for captions. Full bleed. bg_sunrise.png: A soft pastel pixel art sunrise sky and cloud sea. Wide broad stepped gradient bands from pale sage at top through warm cream and pale yellow toward horizon with a hint of muted apricot. Blocky pixel cloud banks frame left/right lower edges, sea of clouds along bottom. Center large empty luminous cream negative space for adding an ending title later, do NOT render a title. Sun is subtle pale yellow light at distant horizon, no central foreground subject. Extremely calm, sparse, simple square pixels, no busy detail or bright saturation. Bottom third clouds broad and low contrast.
```

### bg_circuit.png

```text
ONE standalone 16:9 landscape promotional background, request 2560x1440 PNG. Reference image ONLY for coarse low-resolution pixel art style and soft palette, NO creature. Large flat square pixel clusters and crisp stairstep silhouettes, cream #F6F4EC, light sage #7DB87A, pale yellow #FFF2A6, sparse muted warm orange. No realistic textures, no vector curves. Absolutely NO text, letters, digits, logos, watermarks, symbols resembling writing, UI, people, characters or mascot. Bottom third is clean low-detail negative space for captions. Full bleed. bg_circuit.png: Very dark deep ink green #16261C full background, subtle low-contrast coarse pixel art circuit-board traces and a few abstract vertical falling square blocks, NOT actual code or letters. Trace colors are slightly lighter muted dark sage greens only, rare tiny dim pale yellow nodes, all details restrained and dark. Concentrate faint circuit structure toward upper corners and sides; center and especially bottom third nearly flat #16261C and uncluttered for overlay text. Orthogonal stepped 8-bit traces, large squared nodes, no legible writing, no 0s or 1s. Deliberately dark subdued text background, avoid glow highlights or bright lines.
```


