# 内容许可 / Content License

CodeBud 的**代码**与**内容**分开授权。代码见 [`LICENSE`](LICENSE)（MIT）；本文件说明内容部分。

## 一览

| 范围 | 许可 | 说明 |
|---|---|---|
| 源代码：`src/`、`scripts/`、`server/`、构建与配置文件 | [MIT](LICENSE) | 可自由使用、修改、再分发，含商用 |
| 原创课程内容：`content/common/`、`content/c/`、`content/cpp/`、`content/java/`、`content/python/`、`content/challenge-bank/`、`content/error-lib/`、`content/glossary.json`、`content/syllabus.json`，以及 `docs/` 中的原创文档 | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans) | 署名、非商业性使用、相同方式共享 |
| Hello 算法课程：`content/algo/`、`content/algo-questions/` 中来自上游的材料 | CC BY-NC-SA 4.0（上游 [krahets/hello-algo](https://github.com/krahets/hello-algo)） | 权利归上游作者及贡献者，原文见 [`LICENSES/hello-algo-CC-BY-NC-SA-4.0.txt`](LICENSES/hello-algo-CC-BY-NC-SA-4.0.txt) |
| 六级真题与听力音频：`content/cet6/`、`cet6-audio-v1` release | **不授予任何许可** | 版权归原权利人所有，见下文 |
| CodeBud 名称与图标 | 不在 MIT 与 CC 授权范围内 | 可用于指代本项目；请勿用于暗示官方背书的衍生发行版 |
| 其他第三方代码、依赖与素材 | 各自的上游许可 | 见 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)、[`THIRD-PARTY-CODE-NOTICES.md`](THIRD-PARTY-CODE-NOTICES.md) |

## 为什么这样分

- **代码用 MIT**：项目依赖与移植来源（如 open-claude-ui）均为宽松许可，没有 copyleft 代码被链接进来；MIT 让学生和老师可以最低门槛地阅读、修改、拿去做自己的学习工具。
- **原创课程内容用 CC BY-NC-SA 4.0**：课程与题库是教学材料而不是软件，CC 协议更合适；与同仓库的 Hello 算法课程保持同一协议，整份内容可以按同一套规则使用；「非商业 + 相同方式共享」防止内容被打包转卖，同时允许自由学习、改编和分享。
- **整体效果**：因为内容部分带有「非商业」条款，**含内容的完整应用（包括安装包）只能用于非商业用途**。只取用 `src/` 等 MIT 代码、自行替换内容时，不受此限制。

## 六级真题与听力音频

大学英语六级考试真题及听力音频的著作权归原权利人所有，**本项目不拥有、也不授予其任何许可**，MIT 与 CC 协议均不适用于这部分内容。

- 这些材料仅供个人学习与备考使用，请勿用于商业用途或再次分发。
- 权利人如认为相关内容不应出现在此仓库，请通过 [Issues](https://github.com/zz-zane/CodeBud/issues) 联系，我们会及时移除。

## 署名方式

使用或改编原创课程内容时，请注明：

> 来自 CodeBud（https://github.com/zz-zane/CodeBud），采用 CC BY-NC-SA 4.0 许可。

改编后的内容须以相同协议发布，并说明做了哪些修改。
