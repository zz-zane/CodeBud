---
id: python-stage3-12
lang: python
stage: 3
order: 13
title: 工程结构与打包分发
tags: [工程素养, 项目组织, 分发]
required: ["python-stage3-11"]
crossRefs: []
estMinutes: 25
keywords: [venv, pip, requirements, pyproject, package]
---

## 学习目标

本课学习工程结构与打包分发。重点包括项目结构、requirements、venv 常用命令。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 分变量：一个变量、一页迎宾、一道正门

收拾完的窝大概长这样：

```text
工作区工程/
├── miaow/              ← 自定义包目录
│   ├── __init__.py     ← 迎宾页：这屋被整间请进来时先跑它
│   └── 分数据.py
├── tests/              ← 体检间：体检单单独收着
│   └── test_分数据.py
├── main.py             ← 正门：从这儿进窝
├── requirements.txt    ← 记账单：请了哪些帮手
└── pyproject.toml      ← 户口本：这窝叫什么、什么版本
```

四件事拆开说：

- **`miaow/` 是一个变量。** 屋门口那块 `__init__.py`，我们原先以为它是**入场券**——少了它解释器就不认该变量。真跑一遍才知道想错了：**没有这一页，屋照样是屋**，下面那句从屋外引用名称的话照样调用得应（解释器管这种「只有文件夹、没有那一页」的屋叫**命名空间包**；老教程里「必须要有 `__init__.py`」那句，说的是很久以前的解释器，早改规矩了）。那这一页到底管什么？**它是该变量被整间请进来的时候，最先跑起来的那一页**——不是入场券，是**迎宾的那一页**。屋里没什么要迎的客，空着它一点问题没有；可要在这屋刚被拆开的那一刻做点事——迎一句、给屋准备点自己的东西、把屋里某几本的名字直接摆到大门口——就得写上它。
- **`main.py` 是正门。** 敲 `python main.py`，从这道门进窝。
- **`tests/` 是体检间。** 上一课那些体检单别跟函数挤一张桌，单独一个变量收着。收好了照样一句话扫遍整间：`python -m unittest discover -s tests -v`（那个 `-v` 是「说详细点」的意思，我们试过：不加它，屏幕上只有 `..` 两个点和一句 `OK` —— 看得见「过了」，看不见**哪几条**过了；加上它，每条体检单的名字才挨个报出来。那条念「跑了几秒」的每次都变，我们就不抄了）：

```text
test_两个对象平分六条 (test_分数据.平分体检.test_两个对象平分六条) ... ok
test_该拒绝就拒绝 (test_分数据.平分体检.test_该拒绝就拒绝) ... ok

----------------------------------------------------------------------
OK
```

- **`requirements.txt` 和 `pyproject.toml`** 是给「这窝要请谁、这窝叫什么」记账用的，后面两节细说。

上面「迎宾的那一页」是我们真跑出来的，跑了两遍给你看。

**第一遍：屋里只放本子，门口什么都不挂。**

```python
import os, sys, tempfile

变量 = tempfile.mkdtemp()
屋 = os.path.join(变量, "miaow")
os.makedirs(屋)
with open(os.path.join(屋, "分数据.py"), "w", encoding="utf-8") as f:
    f.write("def 平分(总数, 对象数):\n    return 总数 // 对象数\n")

sys.path.insert(0, 变量)
from miaow.分数据 import 平分
print("没挂门牌，照样调用得应：每个", 平分(6, 2), "条")
```

```text
没挂门牌，照样调用得应：每个 3 条
```

调用得应。**所以老教程里那句「没了 `__init__.py` 就不认该变量」，在本机的解释器这里是不成立的**——只有文件夹、没有那一页，它照样当屋认（本机这位是 3.12 版）。

**第二遍：门口挂上那一页，里面写一句「迎宾的话」；屋里的本子也写一句报到的。**

```python
import os, sys, tempfile

变量 = tempfile.mkdtemp()
屋 = os.path.join(变量, "miaow")
os.makedirs(屋)
with open(os.path.join(屋, "__init__.py"), "w", encoding="utf-8") as f:
    f.write('print("迎宾那一页先开了口：")\n')
with open(os.path.join(屋, "分数据.py"), "w", encoding="utf-8") as f:
    f.write('print("本子也被请醒了：分数据")\ndef 平分(总数, 对象数):\n    return 总数 // 对象数\n')

sys.path.insert(0, 变量)
from miaow.分数据 import 平分
print("拿到函数：每个", 平分(6, 2), "条")
```

```text
迎宾那一页先开了口：
本子也被请醒了：分数据
拿到函数：每个 3 条
```

看头两行的次序就懂了：屋外引用的是 `miaow.分数据`，可要拆到该变量里的本子，解释器得**先把该变量拆开**——而拆开该变量，就是**先跑门口那一页**。所以它才叫迎宾的那一页：它调用在屋里每一本的前头，正好用来在「这屋刚被拆开」的那一刻做点事。这也是为什么它一边是**空的也行**、一边又**值得写上**。

屋外怎么调用屋里的函数？**连着屋名一起调用**。下面这段是我们真跑过的——它先在临时变量中搭出这么一个变量，再站到屋外调用一次：

```python
import os, sys, tempfile

变量 = tempfile.mkdtemp()
屋 = os.path.join(变量, "miaow")
os.makedirs(屋)
open(os.path.join(屋, "__init__.py"), "w").close()
with open(os.path.join(屋, "分数据.py"), "w", encoding="utf-8") as f:
    f.write("def 平分(总数, 对象数):\n    return 总数 // 对象数\n")

sys.path.insert(0, 变量)
from miaow.分数据 import 平分
print("六条数据分给两个对象，每个", 平分(6, 2), "条")
```

```text
六条数据分给两个对象，每个 3 条
```

三行代码各自管一块：`os.makedirs(屋)` 造文件夹，`open(...__init__.py...).close()` 在门口摆上迎宾那一页（里面什么都不写，摆完就撒手），最后那句 `sys.path.insert(0, 变量)` 等于告诉解释器「去这个变量中找屋」。

引用名称那句要**连着屋名念**：`miaow.分数据`——屋名在前、本子名在后，中间点一个点。屋里的本子互相调用，写不写屋名都行；**我们建议一律写全**，将来屋改了名字、或者某个本子挪进了另一个变量，写全的那种只要改一处。

## 「自己当班」和「被请来当帮手」

上面那句 `import` 里藏着一件很容易被忽略的事：**被请进来的本子，会当场从头到尾走一遍**。要是它里面写了一句「处理完成」，你一请它，它就在你耳边调用输出方法。

我们跑给你看。这段会临时造一个叫 `处理铃.py` 的本子，本子最后几行是道**门卫**：

```python
import os, sys, tempfile

变量 = tempfile.mkdtemp()
内容 = '''print("被请来当帮手时，我的名字是：", __name__)

def 摇铃():
    print("处理完成")

if __name__ == "__main__":
    摇铃()
'''
with open(os.path.join(变量, "处理铃.py"), "w", encoding="utf-8") as f:
    f.write(内容)

sys.path.insert(0, 变量)
import 处理铃

print("自己当班时，我的名字是：", __name__)
处理铃.摇铃()
```

```text
被请来当帮手时，我的名字是： 处理铃
自己当班时，我的名字是： __main__
处理完成
```

三行对着一件事看：**每份代码心里都揣着一块小名称**，写着它「现在是什么身份」。这块名称叫 `__name__`。

- 被别的本子**请去当帮手**的时候，名称写的是它自己的名字（`处理铃`）。
- **自己当班**——也就是你直接敲 `python 某某.py`、把它当正门推开的时候——名称写的是 `__main__`（念作「主事的」）。

所以门卫那一行 `if __name__ == "__main__":` 输出就是：**「只有当我们是走正门的那位，才做下面这件事」**。回头看那三行输出——请它当帮手的时候，门卫把「摇铃」拦住了，一次没响；后面我们自己伸手调用 `处理铃.摇铃()`，铃才响的。

这也是为什么正门那个 `main.py` 通常写得很薄：**它只负责调用人**，真本事都住在屋里。一个本子既能走正门自己当班，也能被别人请去当帮手——靠的就是这道门卫。

::: warn 注意
`__name__` 前后各是**两条**下划线，一共四条。少写一条，**名字就变成另一个了** —— 可「变成另一个」之后是**响**还是**哑**，得看少在哪一边，我们两边都跑过：

- **少在名字那一边**（写成 `if __name_ == "__main__":`）—— **当场就响**：`NameError: name '__name_' is not defined. Did you mean: '__name__'?`，退出码 1。我们倒挺喜欢这一句，解释器**把正确的名字直接递到你眼前**了，照抄就改完。
- **少在引号里那一串那一边**（写成 `if __name__ == "_main_":`）—— **一次不响**：不报错、退出码 0、屏幕上一个字都没有，摇铃那一句就是**没跑**。这种错最费时间——它不是坏了，它只是**没在做事**，你还以为它在做。

记法就一句：**四条下划线，两边都得数。** 哪边数错了都别急着猜，先把源代码跑起来看屏幕 —— 响了是好事，哑了才要命。
:::

## 记账单：请了哪些帮手，写在 requirements.txt

我们有个函数要隔着工作区跟远处的对象说话，这活儿 Python 自己不带工具，得请外援。请来的外援都记在一张小单子上，叫 `requirements.txt`：

```text
requests
```

一行一个名字，装什么写什么。为什么要单独记一张单子？因为**记性不可靠**：你换了台电脑、或者请别的对象来一起跑这窝，照单子一行装齐就行，不用靠脑袋回忆「当初好像还装过个什么来着」。

照单子把所有帮手一次请回来，一条命令：

```text
pip install -r requirements.txt
```

`pip` 是只专门跑腿请帮手的对象；`-r` 的意思是「照这张单子请」，后面跟单子文件名。真跑出来是这样（挑要紧的几行抄）：

```text
Collecting requests (from -r requirements.txt (line 1))
Collecting charset_normalizer<4,>=2 (from requests->-r requirements.txt (line 1))
Installing collected packages: urllib3, idna, charset_normalizer, certifi, requests
Successfully installed certifi-2026.7.22 charset_normalizer-3.5.1 idna-3.19 requests-2.34.2 urllib3-2.8.0
```

最后一行要认：`Successfully installed` 就是「全请回来了」。前面那串名字是 `requests` **自己出门也要带的五个小伙伴**，pip 会自动把它们一起请来——所以你单子上只写了一行，请回来的却是一串。

（那些印着「有新版本 pip 可用」的提示不用管，跟你的窝没关系。）

## 每间窝配一个自己的柜子

现在到了那个老问题：**帮手打架**。

假设我们的窝要用外援 1.0 版，隔壁对象的窝要用同一个外援的 2.0 版。要是全窝共用一个柜子，柜子里只能摆一本——摆 1.0，隔壁对象就坏；摆 2.0，我们就坏。

Python 的解法很直白：**每间窝配一个自己的柜子**。这个柜子叫**虚拟环境（每窝自己的一个柜子）**——听着高级，其实就是窝里多出来的一个文件夹，专门搁这窝请的帮手。我们这个柜子的文件夹名叫 `.venv`。

造柜子一条命令：

```text
python -m venv .venv
```

钻进柜子里用：

```text
.venv\Scripts\activate
```

（这是 Windows 上的敲法。钻进柜子以后，那行的提示符前面会多出一个括号，等于告诉你「你现在站在柜子里」；想出来就敲 `deactivate`。）

**柜子里刚造出来是空的。** 我们钻进一个空柜子，直接调用了一次外援的名字：

```text
python -c "import requests"
```

```text
Traceback (most recent call last):
  File "<string>", line 1, in <module>
ModuleNotFoundError: No module named 'requests'
```

`ModuleNotFoundError: No module named 'requests'` 念作「**没有叫 requests 的盒子**」。这可不是坏消息，恰恰是好消息：说明这个柜子**真的是自己的**——全局大柜子里保存了什么，它一概看不见。这就是隔离要的效果。

那你可能想问：我们明明记得全局柜子里装过这个外援，为什么柜子里就没有？因为**虚拟环境不复制全局柜子里的东西**，它只带一个干净的底子。想让它的柜子里有什么，得你自己照着单子请。

在柜子里照单子请一次：

```text
pip install -r requirements.txt
```

```text
Successfully installed certifi-2026.7.22 charset_normalizer-3.5.1 idna-3.19 requests-2.34.2 urllib3-2.8.0
```

请完再敲正门那道 `python main.py`，我们这窝的真跑结果是：

```text
六条数据分给两个对象，每个 3 条
```

你看：一个刚造好的柜子里，`import requests` 当场躺下；照单子把帮手请齐，正门 `python main.py` 就一路跑通了。**请没请过，差别就在这儿**。

::: tip 提示
今天记住四件事：① 函数分屋住，`main.py` 走正门；屋门口那块 `__init__.py` **不是入场券**（没有它照样调用得应），它是这屋被整间请进来时**先跑的那一页**——要迎客就写上，不迎客空着也行；② `if __name__ == "__main__":` 是门卫，管「只有当我们是走正门的那位才做事」；③ 请了哪些帮手记在 `requirements.txt`，`pip install -r` 照单请齐；④ 每间窝配自己的 `.venv` 柜子，请进来的帮手别的窝看不见。
:::

## 打包分发：把这窝寄给别的对象

现在这窝在我们自己机器上跑得很舒服。可要是隔壁对象也想要这个分数据的函数呢？总不能让她自己照着抄一遍吧——她也不知道该抄哪几个本子、该摆在哪一层。

办法是让这窝自己带一张**户口本**，叫 `pyproject.toml`，写清楚这窝叫什么、什么版本：

```text
[build-system]
requires = ["setuptools>=61"]
build-backend = "setuptools.build_meta"

[project]
name = "miaow"
version = "0.1.0"
description = "A tiny dried-fish toolbox for cats."
requires-python = ">=3.10"
```

念几行就够：

- `[project]` 底下的 `name` —— 这窝对外的名字，别的对象就用这个名字请它。
- `version` —— 版本号。改了函数就把末尾上那个数往上抬一格，别人一眼知道是新是旧。
- `requires-python` —— 这窝至少要多新的解释器才跑得动（`>=3.10` 念「3.10 以上都行」）。
- 顶上那块 `[build-system]` 是告诉 pip「打包这窝用哪套家伙事」。照抄就行，暂时不用改。

还有一件事得**在打包之前**办好。户口本上那个 `version` 是给**外面的账本**看的，程序自己并不知道；想让**程序里**也问得出这个版本号，得在**迎宾页**上手写一行 —— 正是前面说的「给屋准备点自己的东西」：在 `miaow/__init__.py` 里写上 `__version__ = "0.1.0"`。

⚠️ 两个数得**对上**（户口本上写 `0.1.0`，迎宾页上也写 `0.1.0`），不然就成了「账本说一套、程序说一套」。我们试过：这一行**不写**，后面那句 `print(miaow.__version__)` 会当场翻脸（`AttributeError: module 'miaow' has no attribute '__version__'`）；写上再问，稳稳答 `0.1.0` 。

有了户口本，别处一条命令就能把这窝请进她的柜子：

```text
pip install .
```

那个孤零零的点念作「**就这间**」——站在你窝的文件夹里敲，它就把当前这间窝打成一个小包裹请进来。真跑出来是这样（挑要紧的几行抄）：

```text
  Building wheel for miaow (pyproject.toml): started
  Building wheel for miaow (pyproject.toml): finished with status 'done'
Successfully built miaow
Installing collected packages: miaow
Successfully installed miaow-0.1.0
```

`Successfully built miaow` 是「照着户口本打好了」，`Successfully installed miaow-0.1.0` 是「请进柜子了」。

请进来以后，我们**站到窝外面**（换一个完全不相干的文件夹）再调用一次：

```text
python -c "import miaow; print(miaow.__version__)"
```

```text
0.1.0
```

看得见吗——**站到窝外头也找得到 `miaow` 了**。它已经被安顿进柜子的正册里，不再是「碰巧摆在旁边的一个文件夹」。这就是分发：你把窝打成一个包裹寄出去，别人敲一句话，函数就住进她家，谁也不用关心你家文件夹原来摆在哪一层。

## 小任务

我们给你留两个：

1. 把自己现有的本子们分个屋：造一个文件夹当屋，把函数挪进去，再在门口摆上一页 `__init__.py`（空着就行）。摆好以后站到屋外调用一次（`from 屋名.本子名 import 某个函数`），调用得应才算分对了。要是调用不应，先对名字拼得对不对（屋名在前、本子名在后）；顺手还能做个对照实验：**先把门口那一页拿掉再调用一次**——我们真跑过，照样调用得应，所以你该记住的是「名字拼对、站对变量」，不是「幸好我摆了那一页」。
2. 给自己的窝造一个柜子（`python -m venv .venv`），钻进去，把单子上的帮手请齐，然后在柜子里把正门跑一遍。跑通以后敲 `deactivate` 出来，再跑一次同一个正门——**猜猜这次会怎样？** 先猜，再敲，错了正好知道柜子到底隔开了什么。

下一课我们带你去逛一张地图：外面那些现成的、别人已经打好的工具窝，都有哪些值得请进来用；顺便把请外援的几句常用口令认全 
