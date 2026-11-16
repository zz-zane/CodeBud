# 第三方开源组件声明

**CodeBud（miai-biancheng）** · 版本 0.2.0 · 本文件 Generate 于 2026-11-16

> 🤖 **本文件由脚本自动生成，请勿手改。**
> 生成命令：`npm run gen:notices`（源码见 `scripts/gen-third-party-notices.mjs`）
> 增删任何依赖之后都要重跑一次，否则下面的版本号会过期。

---

## 这份文件是干什么的

CodeBud用到了很多别人写好的开源库。这些库的许可证都要求在**分发软件时**把「用了谁的东西、他们的版权归谁、他们的许可证原文」一并带上。这份文件就是干这个的。

**什么时候需要在意它**：只要有一天你把CodeBud打包成 exe 发给别人（哪怕只发给一个朋友），这些声明就必须跟着一起走。放在仓库里不占地方，但缺了它就是一个真实的合规漏洞，而且**是那种事后很难补的漏洞**（因为你要回头去查当时用的是哪个版本）。

**它是怎么来的**：不是从网上抄的模板，是直接读取本机 `node_modules/` 里每个包自己带的 `LICENSE` 文件原文汇总的。所以它和**实际装的版本**逐字对应。

---

## 一、总览

| 项目 | 数值 |
|---|---|
| 直接运行时依赖（`dependencies`） | 22 个 |
| 其中被打进分发产物的构建期依赖（`devDependencies`） | 2 个 |
| 展开全部传递依赖后 | 89 个 |
| 许可证原文总字节数 | 113,373 字节 |
| 含 copyleft（GPL/AGPL/LGPL/MPL）的组件 | **0 个** |

**协议分布**：

| 许可证 | 组件数 | 性质 |
|---|---|---|
| MIT | 77 | 宽松，只需保留版权声明 |
| BSD-3-Clause | 4 | 宽松，另加「不得用作者名背书」 |
| ISC | 3 | 宽松，等同 MIT 的简化版 |
| Apache-2.0 | 1 | 宽松，另需转载 NOTICE 文件、声明改动 |
| 0BSD | 1 | 最宽松，**连版权声明都不要求保留** |
| PSF-2.0 | 1 | 宽松（Python 基金会版） |
| BlueOak-1.0.0 | 1 | — |
| BSD-2-Clause | 1 | 宽松，只需保留版权声明 |

**结论**：**没有任何 copyleft 组件。** GPL/AGPL 那种「用了就得开源」的传染性许可证，在这 89 个包里**一个都没有**。全部是 MIT / BSD / ISC / Apache-2.0 / 0BSD / PSF 这类宽松许可，与本项目自身的 MIT 兼容。

---

## 二、组件清单

### 2.1 直接依赖（`package.json` 里显式声明的）

| 组件 | 版本 | 许可证 | 版权归属 |
|---|---|---|---|
| `@codemirror/autocomplete` | 6.20.3 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/commands` | 6.11.0 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/lang-cpp` | 6.0.3 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/lang-java` | 6.0.2 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/lang-python` | 6.2.1 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/language` | 6.12.4 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/state` | 6.7.4 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/view` | 6.43.11 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@formkit/auto-animate` | 0.10.0 | MIT | Copyright 2022 FormKit Inc. |
| `@lezer/highlight` | 1.2.3 | MIT | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `animejs` | 4.5.0 | MIT | Copyright (c) 2025 Julian Garnier |
| `echarts` | 6.1.0 | Apache-2.0 | Copyright 2017-2026 The Apache Software Foundation（摘自该包 NOTICE 文件） |
| `electron` | 44.9.3 | MIT | Copyright (c) Electron contributors Copyright (c) 2013-2020 GitHub Inc. |
| `electron-updater` | 6.8.11 | MIT | Copyright (c) 2015 Loopline Systems |
| `highlight.js` | 11.12.0 | BSD-3-Clause | Copyright (c) 2006, Ivan Sagalaev. |
| `iconv-lite` | 0.7.3 | MIT | Copyright (c) 2011 Alexander Shtuchkin |
| `katex` | 0.19.1 | MIT | Copyright (c) 2013-2020 Khan Academy and other contributors |
| `markdown-it` | 15.0.1 | MIT | Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin. |
| `markdown-it-container` | 4.0.0 | MIT | Copyright (c) 2015 Vitaly Puzrin, Alex Kocharin. |
| `pinia` | 3.0.4 | MIT | Copyright (c) 2019-present Eduardo San Martin Morote |
| `splitpanes` | 4.1.2 | MIT | Copyright (c) 2018 Antoni Andre |
| `unpdf` | 2.1.0 | MIT | Copyright (c) 2023-PRESENT Johann Schopplich |
| `vue` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `vue-router` | 4.6.4 | MIT | Copyright (c) 2019-present Eduardo San Martin Morote |

> 📌 `electron`：安装包内置的 Electron 运行时（MIT）。版本以 `package.json` 的 `build.electronVersion` 为准（本仓库 44.9.3）；Electron 分发包内另带 `LICENSES.chromium.html`（Chromium 及其依赖的许可证汇编），打包时随安装包一起分发，不要删。

> 📌 这张表里有 2 个是 **`devDependencies`**（`iconv-lite`、`electron`）—— 它们的代码会被**内联进分发产物**，所以必须列进来。
>
> 为什么：主进程 / 预加载构建的 `externalizeDepsPlugin()` **只外置 `dependencies`**，源码里 import 进来的 devDependency 一律被 esbuild 打包进 `out/`。前几项是脚本**扫 `src/` 的 import 自动找出来的**（见脚本里的 `bundledDevDeps`），`electron` 是构建脚本显式补上的（它由安装器带进分发物），不是手写版本号。
>
> 测试文件里的 import（vitest 那些）不在扫描范围：它们只在开发机跑，不进分发产物。

### 2.2 传递依赖（被上面的包间接引入的）

> 📌 **这一节里有相当一部分是「多列的」。** 比如 `@vue/compiler-sfc`、`@babel/parser`、`postcss`、`magic-string` 这些是 **Vue 在构建阶段用的编译器**，打包时会被摇掉，**不会进入最终分发的程序**。把它们列上属于「多算不多错」——声明多了没有法律风险，少了才有。

| 组件 | 版本 | 许可证 | 版权归属 |
|---|---|---|---|
| `@babel/helper-string-parser` | 7.29.7 | MIT | Copyright (c) 2014-present Sebastian McKenzie and other contributors |
| `@babel/helper-validator-identifier` | 7.29.7 | MIT | Copyright (c) 2014-present Sebastian McKenzie and other contributors |
| `@babel/parser` | 7.29.8 | MIT | Copyright (C) 2012-2014 by various contributors (see AUTHORS) |
| `@babel/types` | 7.29.8 | MIT | Copyright (c) 2014-present Sebastian McKenzie and other contributors |
| `@jridgewell/sourcemap-codec` | 1.6.0 | MIT | Copyright 2024 Justin Ridgewell <justin@ridgewell.name> |
| `@lezer/common` | 1.5.2 | MIT | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@lezer/cpp` | 1.1.6 | MIT | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@lezer/java` | 1.1.4 | MIT | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@lezer/lr` | 1.4.10 | MIT | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@lezer/python` | 1.1.19 | MIT | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@marijn/find-cluster-break` | 1.0.4 | MIT | Copyright (C) 2024 by Marijn Haverbeke <marijn@haverbeke.berlin> |
| `@vue/compiler-core` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `@vue/compiler-dom` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `@vue/compiler-sfc` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `@vue/compiler-ssr` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `@vue/devtools-api` | 7.7.10 | MIT | Copyright (c) 2023 webfansplz |
| `@vue/devtools-kit` | 7.7.10 | MIT | Copyright (c) 2023 webfansplz |
| `@vue/devtools-shared` | 7.7.10 | MIT | Copyright (c) 2023 webfansplz |
| `@vue/reactivity` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `@vue/runtime-core` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `@vue/runtime-dom` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `@vue/server-renderer` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `@vue/shared` | 3.5.42 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| `argparse` | 3.0.1 | PSF-2.0 | (该包未在 LICENSE 中声明版权行，见其 package.json 的 author 字段) |
| `birpc` | 2.9.0 | MIT | Copyright (c) 2021 Anthony Fu <https://github.com/antfu> |
| `builder-util-runtime` | 9.3.1 | MIT | Copyright (c) 2015 Loopline Systems |
| `commander` | 5.1.0 | MIT | Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca> |
| `copy-anything` | 4.1.0 | MIT | Copyright (c) 2018 Luca Ban - Mesqueeb |
| `crelt` | 1.0.7 | MIT | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> |
| `csstype` | 3.2.3 | MIT | Copyright (c) 2017-2018 Fredrik Nicol |
| `debug` | 4.4.3 | MIT | Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca> Copyright (c) 2018-2021 Josh Junon |
| `entities` | 8.1.0 | BSD-2-Clause | Copyright (c) Felix Böhm |
| `estree-walker` | 2.0.2 | MIT | Copyright (c) 2015-20 [these people](https://github.com/Rich-Harris/estree-walker/graphs/contributors) |
| `fs-extra` | 10.1.0 | MIT | Copyright (c) 2011-2017 JP Richardson |
| `graceful-fs` | 4.2.11 | ISC | Copyright (c) 2011-2022 Isaac Z. Schlueter, Ben Noordhuis, and Contributors |
| `hookable` | 5.5.3 | MIT | Copyright (c) Pooya Parsa <pooya@pi0.io> |
| `js-yaml` | 4.3.2 | MIT | Copyright (C) 2011-2015 by Vitaly Puzrin |
| `jsonfile` | 6.2.1 | MIT | Copyright (c) 2012-2015, JP Richardson <jprichardson@gmail.com> |
| `lazy-val` | 1.0.5 | MIT | Copyright (c) Vladimir Krivosheev |
| `linkify-it` | 6.1.0 | MIT | Copyright (c) 2015 Vitaly Puzrin. |
| `lodash.escaperegexp` | 4.1.2 | MIT | (该包未在 LICENSE 中声明版权行，见其 package.json 的 author 字段) |
| `lodash.isequal` | 4.5.0 | MIT | (该包未在 LICENSE 中声明版权行，见其 package.json 的 author 字段) |
| `magic-string` | 0.30.21 | MIT | Copyright 2018 Rich Harris |
| `mdurl` | 2.1.0 | MIT | Copyright (c) 2015 Vitaly Puzrin, Alex Kocharin. Copyright Joyent, Inc. and other Node contributors. All rights reserved. |
| `mitt` | 3.0.1 | MIT | Copyright (c) 2021 Jason Miller |
| `ms` | 2.1.3 | MIT | Copyright (c) 2020 Vercel, Inc. |
| `nanoid` | 3.3.18 | MIT | Copyright 2017 Andrey Sitnik <andrey@sitnik.ru> |
| `perfect-debounce` | 1.0.0 | MIT | Copyright (c) Pooya Parsa <pooya@pi0.io> |
| `picocolors` | 1.1.1 | ISC | Copyright (c) 2021-2024 Oleksii Raspopov, Kostiantyn Denysov, Anton Verinov |
| `postcss` | 8.5.28 | MIT | Copyright 2013 Andrey Sitnik <andrey@sitnik.es> |
| `punycode.js` | 2.3.1 | MIT | Copyright Mathias Bynens <https://mathiasbynens.be/> |
| `rfdc` | 1.4.1 | MIT | Copyright 2019 "David Mark Clements <david.mark.clements@gmail.com>" |
| `safer-buffer` | 2.1.2 | MIT | Copyright (c) 2018 Nikita Skovoroda <chalkerx@gmail.com> |
| `sax` | 1.6.1 | BlueOak-1.0.0 | (该包未在 LICENSE 中声明版权行，见其 package.json 的 author 字段) |
| `semver` | 7.8.5 | ISC | Copyright (c) Isaac Z. Schlueter and Contributors |
| `source-map-js` | 1.2.1 | BSD-3-Clause | Copyright (c) 2009-2011, Mozilla Foundation and contributors |
| `speakingurl` | 14.0.1 | BSD-3-Clause | Copyright (c) 2013-2017 Sascha Droste <pid@posteo.net> |
| `style-mod` | 4.1.3 | MIT | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `superjson` | 2.2.6 | MIT | Copyright (c) 2020 Simon Knott and superjson contributors |
| `tiny-typed-emitter` | 2.1.0 | MIT | Copyright (c) 2020 Zurab Benashvili (binier) <zura.bena@gmail.com> |
| `tslib` | 2.3.0 | 0BSD | Copyright (c) Microsoft Corporation. |
| `uc.micro` | 3.0.0 | MIT | Copyright Mathias Bynens <https://mathiasbynens.be/> |
| `universalify` | 2.0.1 | MIT | Copyright (c) 2017, Ryan Zimmerman <opensrc@ryanzim.com> |
| `w3c-keyname` | 2.2.8 | MIT | Copyright (C) 2016 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `zrender` | 6.1.0 | BSD-3-Clause | Copyright (c) 2017, Baidu Inc. |

> 📌 **补录的许可证正文（1 个）**：下面这些包的 npm tarball 里**没有** LICENSE 文件，但 `package.json` 声明 MIT。为了不静默少列，生成脚本从 `scripts/licenses/` 读取标准 MIT 正文补上，版权行取自各包 `package.json` 的 `author` 字段。这些正文**不是从原包复制的**，详见 `scripts/licenses/README.md`：
>
> - `lazy-val@1.0.5` —— Copyright (c) Vladimir Krivosheev

---

## 三、Apache-2.0 的额外义务（涉及 1 个组件）

Apache-2.0 比 MIT 多两条要求：

1. **如果原包带了 `NOTICE` 文件，分发时必须转载它的内容**
2. **如果你修改了源码，要说明改了哪里**

关于第 2 条：本项目**没有修改**这些组件的任何源码，只是作为依赖引用，所以这条不适用。

关于第 1 条，以下逐个列出：

### `echarts@6.1.0`

**`node_modules\echarts\NOTICE` 原文**：

```
Apache ECharts
Copyright 2017-2026 The Apache Software Foundation

This product includes software developed at
The Apache Software Foundation (https://www.apache.org/).
```

**内嵌子组件**：该包的 `licenses/` 目录下还有 1 份独立的许可证。
这说明它的源码里**内嵌了别人的代码**，那些代码的许可证与主许可证不是一回事，需要一并转载：

#### `node_modules\echarts\licenses\LICENSE-d3`

```
Copyright 2010-2016 Mike Bostock
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the author nor the names of contributors may be used to
  endorse or promote products derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## 四、许可证原文

下面是上面所有组件的许可证正文。**为了不把同一份 MIT 印 66 遍**，正文按「协议 + 措辞」去重；每个组件各自的**版权行**已在第二节的清单里逐条列出，两者合起来才构成完整声明。

### 4.1 0BSD —— 适用于 1 个组件

**适用组件**：`tslib@2.3.0`

**各组件版权行**：

- `tslib@2.3.0` —— Copyright (c) Microsoft Corporation.

**许可证正文**（照录 `node_modules\tslib\LICENSE.txt`，**一字未改**）：

```
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

### 4.2 Apache-2.0 —— 适用于 1 个组件

**适用组件**：`echarts@6.1.0`

**各组件版权行**：

- `echarts@6.1.0` —— Copyright 2017-2026 The Apache Software Foundation（摘自该包 NOTICE 文件）

**许可证正文**（照录 `node_modules\echarts\LICENSE`，**一字未改**）：

```
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.





========================================================================
Apache ECharts Subcomponents:

The Apache ECharts project contains subcomponents with separate copyright
notices and license terms. Your use of the source code for these
subcomponents is also subject to the terms and conditions of the following
licenses.

BSD 3-Clause (d3.js):
The following files embed [d3.js](https://github.com/d3/d3) BSD 3-Clause:
    `/src/chart/treemap/treemapLayout.ts`,
    `/src/chart/tree/layoutHelper.ts`,
    `/src/chart/graph/forceHelper.ts`,
    `/src/util/number.ts`
See `/licenses/LICENSE-d3` for details of the license.
```

### 4.3 BlueOak-1.0.0 —— 适用于 1 个组件

**适用组件**：`sax@1.6.1`

**各组件版权行**：

- `sax@1.6.1` —— (该包未在 LICENSE 中声明版权行，见其 package.json 的 author 字段)

**许可证正文**（照录 `node_modules\sax\LICENSE.md`，**一字未改**）：

```
# Blue Oak Model License

Version 1.0.0

## Purpose

This license gives everyone as much permission to work with
this software as possible, while protecting contributors
from liability.

## Acceptance

In order to receive this license, you must agree to its
rules.  The rules of this license are both obligations
under that agreement and conditions to your license.
You must not do anything with this software that triggers
a rule that you cannot or will not follow.

## Copyright

Each contributor licenses you to do everything with this
software that would otherwise infringe that contributor's
copyright in it.

## Notices

You must ensure that everyone who gets a copy of
any part of this software from you, with or without
changes, also gets the text of this license or a link to
<https://blueoakcouncil.org/license/1.0.0>.

## Excuse

If anyone notifies you in writing that you have not
complied with [Notices](#notices), you can keep your
license by taking all practical steps to comply within 30
days after the notice.  If you do not do so, your license
ends immediately.

## Patent

Each contributor licenses you to do everything with this
software that would otherwise infringe any patent claims
they can license or become able to license.

## Reliability

No contributor can revoke this license.

## No Liability

***As far as the law allows, this software comes as is,
without any warranty or condition, and no contributor
will be liable to anyone for any damages related to this
software or this license, under any kind of legal claim.***
```

### 4.4 BSD-2-Clause —— 适用于 1 个组件

**适用组件**：`entities@8.1.0`

**各组件版权行**：

- `entities@8.1.0` —— Copyright (c) Felix Böhm

**许可证正文**（照录 `node_modules\entities\LICENSE`，**一字未改**）：

```
Copyright (c) Felix Böhm
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 4.5 BSD-3-Clause —— 适用于 2 个组件

**适用组件**：`zrender@6.1.0`、`highlight.js@11.12.0`

**各组件版权行**：

- `zrender@6.1.0` —— Copyright (c) 2017, Baidu Inc.
- `highlight.js@11.12.0` —— Copyright (c) 2006, Ivan Sagalaev.

**许可证正文**（照录 `node_modules\zrender\LICENSE`，**一字未改**）：

```
BSD 3-Clause License

Copyright (c) 2017, Baidu Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the copyright holder nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

> 上面的正文里带的是 `zrender` 自己的版权行；其余 1 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.6 BSD-3-Clause —— 适用于 1 个组件

**适用组件**：`speakingurl@14.0.1`

**各组件版权行**：

- `speakingurl@14.0.1` —— Copyright (c) 2013-2017 Sascha Droste <pid@posteo.net>

**许可证正文**（照录 `node_modules\speakingurl\LICENSE`，**一字未改**）：

```
The BSD 3-Clause License (BSD3)

Copyright (c) 2013-2017 Sascha Droste <pid@posteo.net>
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* Neither the name of the author nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 4.7 BSD-3-Clause —— 适用于 1 个组件

**适用组件**：`source-map-js@1.2.1`

**各组件版权行**：

- `source-map-js@1.2.1` —— Copyright (c) 2009-2011, Mozilla Foundation and contributors

**许可证正文**（照录 `node_modules\source-map-js\LICENSE`，**一字未改**）：

```
Copyright (c) 2009-2011, Mozilla Foundation and contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the names of the Mozilla Foundation nor the names of project
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 4.8 ISC —— 适用于 2 个组件

**适用组件**：`graceful-fs@4.2.11`、`semver@7.8.5`

**各组件版权行**：

- `graceful-fs@4.2.11` —— Copyright (c) 2011-2022 Isaac Z. Schlueter, Ben Noordhuis, and Contributors
- `semver@7.8.5` —— Copyright (c) Isaac Z. Schlueter and Contributors

**许可证正文**（照录 `node_modules\graceful-fs\LICENSE`，**一字未改**）：

```
The ISC License

Copyright (c) 2011-2022 Isaac Z. Schlueter, Ben Noordhuis, and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

> 上面的正文里带的是 `graceful-fs` 自己的版权行；其余 1 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.9 ISC —— 适用于 1 个组件

**适用组件**：`picocolors@1.1.1`

**各组件版权行**：

- `picocolors@1.1.1` —— Copyright (c) 2021-2024 Oleksii Raspopov, Kostiantyn Denysov, Anton Verinov

**许可证正文**（照录 `node_modules\picocolors\LICENSE`，**一字未改**）：

```
ISC License

Copyright (c) 2021-2024 Oleksii Raspopov, Kostiantyn Denysov, Anton Verinov

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### 4.10 MIT —— 适用于 15 个组件

**适用组件**：`@codemirror/autocomplete@6.20.3`、`@codemirror/language@6.12.4`、`@codemirror/state@6.7.4`、`@marijn/find-cluster-break@1.0.4`、`@codemirror/view@6.43.11`、`@lezer/common@1.5.2`、`@lezer/highlight@1.2.3`、`@lezer/lr@1.4.10`、`@codemirror/commands@6.11.0`、`@codemirror/lang-cpp@6.0.3`、`@lezer/cpp@1.1.6`、`@codemirror/lang-java@6.0.2`、`@lezer/java@1.1.4`、`@codemirror/lang-python@6.2.1`、`@lezer/python@1.1.19`

**各组件版权行**：

- `@codemirror/autocomplete@6.20.3` —— Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@codemirror/language@6.12.4` —— Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@codemirror/state@6.7.4` —— Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@marijn/find-cluster-break@1.0.4` —— Copyright (C) 2024 by Marijn Haverbeke <marijn@haverbeke.berlin>
- `@codemirror/view@6.43.11` —— Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@lezer/common@1.5.2` —— Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@lezer/highlight@1.2.3` —— Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@lezer/lr@1.4.10` —— Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@codemirror/commands@6.11.0` —— Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@codemirror/lang-cpp@6.0.3` —— Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@lezer/cpp@1.1.6` —— Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@codemirror/lang-java@6.0.2` —— Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@lezer/java@1.1.4` —— Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@codemirror/lang-python@6.2.1` —— Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@lezer/python@1.1.19` —— Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others

**许可证正文**（照录 `node_modules\@codemirror\autocomplete\LICENSE`，**一字未改**）：

```
MIT License

Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

> 上面的正文里带的是 `@codemirror/autocomplete` 自己的版权行；其余 14 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.11 MIT —— 适用于 13 个组件

**适用组件**：`lazy-val@1.0.5`、`tiny-typed-emitter@2.1.0`、`@vue/devtools-api@7.7.10`、`@vue/devtools-kit@7.7.10`、`birpc@2.9.0`、`mitt@3.0.1`、`perfect-debounce@1.0.0`、`superjson@2.2.6`、`copy-anything@4.1.0`、`@vue/devtools-shared@7.7.10`、`splitpanes@4.1.2`、`unpdf@2.1.0`、`safer-buffer@2.1.2`

**各组件版权行**：

- `lazy-val@1.0.5` —— Copyright (c) Vladimir Krivosheev
- `tiny-typed-emitter@2.1.0` —— Copyright (c) 2020 Zurab Benashvili (binier) <zura.bena@gmail.com>
- `@vue/devtools-api@7.7.10` —— Copyright (c) 2023 webfansplz
- `@vue/devtools-kit@7.7.10` —— Copyright (c) 2023 webfansplz
- `birpc@2.9.0` —— Copyright (c) 2021 Anthony Fu <https://github.com/antfu>
- `mitt@3.0.1` —— Copyright (c) 2021 Jason Miller
- `perfect-debounce@1.0.0` —— Copyright (c) Pooya Parsa <pooya@pi0.io>
- `superjson@2.2.6` —— Copyright (c) 2020 Simon Knott and superjson contributors
- `copy-anything@4.1.0` —— Copyright (c) 2018 Luca Ban - Mesqueeb
- `@vue/devtools-shared@7.7.10` —— Copyright (c) 2023 webfansplz
- `splitpanes@4.1.2` —— Copyright (c) 2018 Antoni Andre
- `unpdf@2.1.0` —— Copyright (c) 2023-PRESENT Johann Schopplich
- `safer-buffer@2.1.2` —— Copyright (c) 2018 Nikita Skovoroda <chalkerx@gmail.com>

**许可证正文**（补录的标准 MIT 模板，不是从原包复制的：`scripts\licenses\lazy-val-MIT.txt`）：

```
MIT License

Copyright (c) Vladimir Krivosheev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> 上面的正文里带的是 `lazy-val` 自己的版权行；其余 12 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.12 MIT —— 适用于 10 个组件

**适用组件**：`vue@3.5.42`、`@vue/shared@3.5.42`、`@vue/runtime-dom@3.5.42`、`@vue/runtime-core@3.5.42`、`@vue/reactivity@3.5.42`、`@vue/compiler-sfc@3.5.42`、`@vue/compiler-core@3.5.42`、`@vue/compiler-dom@3.5.42`、`@vue/compiler-ssr@3.5.42`、`@vue/server-renderer@3.5.42`

**各组件版权行**：

- `vue@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You
- `@vue/shared@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You
- `@vue/runtime-dom@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You
- `@vue/runtime-core@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You
- `@vue/reactivity@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You
- `@vue/compiler-sfc@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You
- `@vue/compiler-core@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You
- `@vue/compiler-dom@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You
- `@vue/compiler-ssr@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You
- `@vue/server-renderer@3.5.42` —— Copyright (c) 2018-present, Yuxi (Evan) You

**许可证正文**（照录 `node_modules\vue\LICENSE`，**一字未改**）：

```
The MIT License (MIT)

Copyright (c) 2018-present, Yuxi (Evan) You

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

> 上面的正文里带的是 `vue` 自己的版权行；其余 9 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.13 MIT —— 适用于 7 个组件

**适用组件**：`electron-updater@6.8.11`、`builder-util-runtime@9.3.1`、`ms@2.1.3`、`katex@0.19.1`、`pinia@3.0.4`、`hookable@5.5.3`、`vue-router@4.6.4`

**各组件版权行**：

- `electron-updater@6.8.11` —— Copyright (c) 2015 Loopline Systems
- `builder-util-runtime@9.3.1` —— Copyright (c) 2015 Loopline Systems
- `ms@2.1.3` —— Copyright (c) 2020 Vercel, Inc.
- `katex@0.19.1` —— Copyright (c) 2013-2020 Khan Academy and other contributors
- `pinia@3.0.4` —— Copyright (c) 2019-present Eduardo San Martin Morote
- `hookable@5.5.3` —— Copyright (c) Pooya Parsa <pooya@pi0.io>
- `vue-router@4.6.4` —— Copyright (c) 2019-present Eduardo San Martin Morote

**许可证正文**（照录 `node_modules\electron-updater\LICENSE`，**一字未改**）：

```
The MIT License (MIT)

Copyright (c) 2015 Loopline Systems

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> 上面的正文里带的是 `electron-updater` 自己的版权行；其余 6 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.14 MIT —— 适用于 4 个组件

**适用组件**：`crelt@1.0.7`、`style-mod@4.1.3`、`w3c-keyname@2.2.8`、`@babel/parser@7.29.8`

**各组件版权行**：

- `crelt@1.0.7` —— Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin>
- `style-mod@4.1.3` —— Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `w3c-keyname@2.2.8` —— Copyright (C) 2016 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
- `@babel/parser@7.29.8` —— Copyright (C) 2012-2014 by various contributors (see AUTHORS)

**许可证正文**（照录 `node_modules\crelt\LICENSE`，**一字未改**）：

```
Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

> 上面的正文里带的是 `crelt` 自己的版权行；其余 3 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.15 MIT —— 适用于 4 个组件

**适用组件**：`uc.micro@3.0.0`、`punycode.js@2.3.1`、`iconv-lite@0.7.3`、`electron@44.9.3`

**各组件版权行**：

- `uc.micro@3.0.0` —— Copyright Mathias Bynens <https://mathiasbynens.be/>
- `punycode.js@2.3.1` —— Copyright Mathias Bynens <https://mathiasbynens.be/>
- `iconv-lite@0.7.3` —— Copyright (c) 2011 Alexander Shtuchkin
- `electron@44.9.3` —— Copyright (c) Electron contributors Copyright (c) 2013-2020 GitHub Inc.

**许可证正文**（照录 `node_modules\uc.micro\LICENSE.txt`，**一字未改**）：

```
Copyright Mathias Bynens <https://mathiasbynens.be/>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

> 上面的正文里带的是 `uc.micro` 自己的版权行；其余 3 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.16 MIT —— 适用于 3 个组件

**适用组件**：`@formkit/auto-animate@0.10.0`、`estree-walker@2.0.2`、`magic-string@0.30.21`

**各组件版权行**：

- `@formkit/auto-animate@0.10.0` —— Copyright 2022 FormKit Inc.
- `estree-walker@2.0.2` —— Copyright (c) 2015-20 [these people](https://github.com/Rich-Harris/estree-walker/graphs/contributors)
- `magic-string@0.30.21` —— Copyright 2018 Rich Harris

**许可证正文**（照录 `node_modules\@formkit\auto-animate\LICENSE`，**一字未改**）：

```
Copyright 2022 FormKit Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

> 上面的正文里带的是 `@formkit/auto-animate` 自己的版权行；其余 2 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.17 MIT —— 适用于 3 个组件

**适用组件**：`markdown-it@15.0.1`、`linkify-it@6.1.0`、`markdown-it-container@4.0.0`

**各组件版权行**：

- `markdown-it@15.0.1` —— Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin.
- `linkify-it@6.1.0` —— Copyright (c) 2015 Vitaly Puzrin.
- `markdown-it-container@4.0.0` —— Copyright (c) 2015 Vitaly Puzrin, Alex Kocharin.

**许可证正文**（照录 `node_modules\markdown-it\LICENSE`，**一字未改**）：

```
Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
```

> 上面的正文里带的是 `markdown-it` 自己的版权行；其余 2 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.18 MIT —— 适用于 3 个组件

**适用组件**：`@babel/types@7.29.8`、`@babel/helper-string-parser@7.29.7`、`@babel/helper-validator-identifier@7.29.7`

**各组件版权行**：

- `@babel/types@7.29.8` —— Copyright (c) 2014-present Sebastian McKenzie and other contributors
- `@babel/helper-string-parser@7.29.7` —— Copyright (c) 2014-present Sebastian McKenzie and other contributors
- `@babel/helper-validator-identifier@7.29.7` —— Copyright (c) 2014-present Sebastian McKenzie and other contributors

**许可证正文**（照录 `node_modules\@babel\types\LICENSE`，**一字未改**）：

```
MIT License

Copyright (c) 2014-present Sebastian McKenzie and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

> 上面的正文里带的是 `@babel/types` 自己的版权行；其余 2 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.19 MIT —— 适用于 2 个组件

**适用组件**：`fs-extra@10.1.0`、`jsonfile@6.2.1`

**各组件版权行**：

- `fs-extra@10.1.0` —— Copyright (c) 2011-2017 JP Richardson
- `jsonfile@6.2.1` —— Copyright (c) 2012-2015, JP Richardson <jprichardson@gmail.com>

**许可证正文**（照录 `node_modules\fs-extra\LICENSE`，**一字未改**）：

```
(The MIT License)

Copyright (c) 2011-2017 JP Richardson

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
(the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify,
 merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

> 上面的正文里带的是 `fs-extra` 自己的版权行；其余 1 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.20 MIT —— 适用于 2 个组件

**适用组件**：`postcss@8.5.28`、`nanoid@3.3.18`

**各组件版权行**：

- `postcss@8.5.28` —— Copyright 2013 Andrey Sitnik <andrey@sitnik.es>
- `nanoid@3.3.18` —— Copyright 2017 Andrey Sitnik <andrey@sitnik.ru>

**许可证正文**（照录 `node_modules\postcss\LICENSE`，**一字未改**）：

```
The MIT License (MIT)

Copyright 2013 Andrey Sitnik <andrey@sitnik.es>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

> 上面的正文里带的是 `postcss` 自己的版权行；其余 1 个组件的版权行在上面的清单里，两者合起来构成完整声明（这正是 MIT/BSD 要求的「版权声明 + 许可声明」两件套）。

### 4.21 MIT —— 适用于 1 个组件

**适用组件**：`animejs@4.5.0`

**各组件版权行**：

- `animejs@4.5.0` —— Copyright (c) 2025 Julian Garnier

**许可证正文**（照录 `node_modules\animejs\LICENSE.md`，**一字未改**）：

```
The MIT License

Copyright (c) 2025 Julian Garnier

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### 4.22 MIT —— 适用于 1 个组件

**适用组件**：`universalify@2.0.1`

**各组件版权行**：

- `universalify@2.0.1` —— Copyright (c) 2017, Ryan Zimmerman <opensrc@ryanzim.com>

**许可证正文**（照录 `node_modules\universalify\LICENSE`，**一字未改**）：

```
(The MIT License)

Copyright (c) 2017, Ryan Zimmerman <opensrc@ryanzim.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the 'Software'), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### 4.23 MIT —— 适用于 1 个组件

**适用组件**：`js-yaml@4.3.2`

**各组件版权行**：

- `js-yaml@4.3.2` —— Copyright (C) 2011-2015 by Vitaly Puzrin

**许可证正文**（照录 `node_modules\js-yaml\LICENSE`，**一字未改**）：

```
(The MIT License)

Copyright (C) 2011-2015 by Vitaly Puzrin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### 4.24 MIT —— 适用于 1 个组件

**适用组件**：`lodash.escaperegexp@4.1.2`

**各组件版权行**：

- `lodash.escaperegexp@4.1.2` —— (该包未在 LICENSE 中声明版权行，见其 package.json 的 author 字段)

**许可证正文**（照录 `node_modules\lodash.escaperegexp\LICENSE`，**一字未改**）：

```
Copyright jQuery Foundation and other contributors <https://jquery.org/>

Based on Underscore.js, copyright Jeremy Ashkenas,
DocumentCloud and Investigative Reporters & Editors <http://underscorejs.org/>

This software consists of voluntary contributions made by many
individuals. For exact contribution history, see the revision history
available at https://github.com/lodash/lodash

The following license applies to all parts of this software except as
documented below:

====

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

====

Copyright and related rights for sample code are waived via CC0. Sample
code is defined as all source code displayed within the prose of the
documentation.

CC0: http://creativecommons.org/publicdomain/zero/1.0/

====

Files located in the node_modules and vendor directories are externally
maintained libraries used by this software which have their own
licenses; we recommend you read them, as their terms may differ from the
terms above.
```

### 4.25 MIT —— 适用于 1 个组件

**适用组件**：`lodash.isequal@4.5.0`

**各组件版权行**：

- `lodash.isequal@4.5.0` —— (该包未在 LICENSE 中声明版权行，见其 package.json 的 author 字段)

**许可证正文**（照录 `node_modules\lodash.isequal\LICENSE`，**一字未改**）：

```
Copyright JS Foundation and other contributors <https://js.foundation/>

Based on Underscore.js, copyright Jeremy Ashkenas,
DocumentCloud and Investigative Reporters & Editors <http://underscorejs.org/>

This software consists of voluntary contributions made by many
individuals. For exact contribution history, see the revision history
available at https://github.com/lodash/lodash

The following license applies to all parts of this software except as
documented below:

====

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

====

Copyright and related rights for sample code are waived via CC0. Sample
code is defined as all source code displayed within the prose of the
documentation.

CC0: http://creativecommons.org/publicdomain/zero/1.0/

====

Files located in the node_modules and vendor directories are externally
maintained libraries used by this software which have their own
licenses; we recommend you read them, as their terms may differ from the
terms above.
```

### 4.26 MIT —— 适用于 1 个组件

**适用组件**：`debug@4.4.3`

**各组件版权行**：

- `debug@4.4.3` —— Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca> Copyright (c) 2018-2021 Josh Junon

**许可证正文**（照录 `node_modules\debug\LICENSE`，**一字未改**）：

```
(The MIT License)

Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca>
Copyright (c) 2018-2021 Josh Junon

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the 'Software'), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### 4.27 MIT —— 适用于 1 个组件

**适用组件**：`commander@5.1.0`

**各组件版权行**：

- `commander@5.1.0` —— Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>

**许可证正文**（照录 `node_modules\commander\LICENSE`，**一字未改**）：

```
(The MIT License)

Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### 4.28 MIT —— 适用于 1 个组件

**适用组件**：`mdurl@2.1.0`

**各组件版权行**：

- `mdurl@2.1.0` —— Copyright (c) 2015 Vitaly Puzrin, Alex Kocharin. Copyright Joyent, Inc. and other Node contributors. All rights reserved.

**许可证正文**（照录 `node_modules\mdurl\LICENSE`，**一字未改**）：

```
Copyright (c) 2015 Vitaly Puzrin, Alex Kocharin.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

--------------------------------------------------------------------------------

.parse() is based on Joyent's node.js `url` code:

Copyright Joyent, Inc. and other Node contributors. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
```

### 4.29 MIT —— 适用于 1 个组件

**适用组件**：`rfdc@1.4.1`

**各组件版权行**：

- `rfdc@1.4.1` —— Copyright 2019 "David Mark Clements <david.mark.clements@gmail.com>"

**许可证正文**（照录 `node_modules\rfdc\LICENSE`，**一字未改**）：

```
Copyright 2019 "David Mark Clements <david.mark.clements@gmail.com>"

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
documentation files (the "Software"), to deal in the Software without restriction, including without limitation 
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and 
to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions 
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED 
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL 
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS 
IN THE SOFTWARE.
```

### 4.30 MIT —— 适用于 1 个组件

**适用组件**：`csstype@3.2.3`

**各组件版权行**：

- `csstype@3.2.3` —— Copyright (c) 2017-2018 Fredrik Nicol

**许可证正文**（照录 `node_modules\csstype\LICENSE`，**一字未改**）：

```
Copyright (c) 2017-2018 Fredrik Nicol

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 4.31 MIT —— 适用于 1 个组件

**适用组件**：`@jridgewell/sourcemap-codec@1.6.0`

**各组件版权行**：

- `@jridgewell/sourcemap-codec@1.6.0` —— Copyright 2024 Justin Ridgewell <justin@ridgewell.name>

**许可证正文**（照录 `node_modules\@jridgewell\sourcemap-codec\LICENSE`，**一字未改**）：

```
Copyright 2024 Justin Ridgewell <justin@ridgewell.name>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 4.32 PSF-2.0 —— 适用于 1 个组件

**适用组件**：`argparse@3.0.1`

**各组件版权行**：

- `argparse@3.0.1` —— (该包未在 LICENSE 中声明版权行，见其 package.json 的 author 字段)

**许可证正文**（照录 `node_modules\argparse\LICENSE`，**一字未改**）：

```
PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2

1. This LICENSE AGREEMENT is between the Python Software Foundation
("PSF"), and the Individual or Organization ("Licensee") accessing and
otherwise using this software ("Python") in source or binary form and
its associated documentation.

2. Subject to the terms and conditions of this License Agreement, PSF hereby
grants Licensee a nonexclusive, royalty-free, world-wide license to reproduce,
analyze, test, perform and/or display publicly, prepare derivative works,
distribute, and otherwise use Python alone or in any derivative version,
provided, however, that PSF's License Agreement and PSF's notice of copyright,
i.e., "Copyright (c) 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019 Python Software Foundation;
All Rights Reserved" are retained in Python alone or in any derivative version
prepared by Licensee.

3. In the event Licensee prepares a derivative work that is based on
or incorporates Python or any part thereof, and wants to make
the derivative work available to others as provided herein, then
Licensee hereby agrees to include in any such work a brief summary of
the changes made to Python.

4. PSF is making Python available to Licensee on an "AS IS"
basis.  PSF MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
IMPLIED.  BY WAY OF EXAMPLE, BUT NOT LIMITATION, PSF MAKES NO AND
DISCLAIMS ANY REPRESENTATION OR WARRANTY OF MERCHANTABILITY OR FITNESS
FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF PYTHON WILL NOT
INFRINGE ANY THIRD PARTY RIGHTS.

5. PSF SHALL NOT BE LIABLE TO LICENSEE OR ANY OTHER USERS OF PYTHON
FOR ANY INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES OR LOSS AS
A RESULT OF MODIFYING, DISTRIBUTING, OR OTHERWISE USING PYTHON,
OR ANY DERIVATIVE THEREOF, EVEN IF ADVISED OF THE POSSIBILITY THEREOF.

6. This License Agreement will automatically terminate upon a material
breach of its terms and conditions.

7. Nothing in this License Agreement shall be deemed to create any
relationship of agency, partnership, or joint venture between PSF and
Licensee.  This License Agreement does not grant permission to use PSF
trademarks or trade name in a trademark sense to endorse or promote
products or services of Licensee, or any third party.

8. By copying, installing or otherwise using Python, Licensee
agrees to be bound by the terms and conditions of this License
Agreement.
```

---

## 附：本项目自身的许可证

CodeBud（miai-biancheng） 本身以 **MIT** 许可证发布，全文见 [`LICENSE`](./LICENSE)。

> 注意：本文件覆盖 **npm 依赖**。仓库里的图片、桌宠素材、ComfyUI 工作流与模型权重各有自己的许可，见根目录 `README.md` 的「致谢 / Open Source Credits」与 `docs/comfyui_workflow.md`；不要把这份 MIT 声明当成对全部素材的授权。
