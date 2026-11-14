---
id: python-stage3-21
lang: python
stage: 3
order: 21
title: venv、pip 与包管理
tags: [工具链, 生态]
required: ["python-stage3-20"]
compare: ["common-36"]
estMinutes: 30
keywords: [venv, pip, site-packages, requirements.txt, conda]
---

## 学习目标

本课学习venv、pip 与包管理。重点包括解释器怎么找包、venv 建与用、pip 装查卸、requirements.txt、conda 是什么（对照）。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、先Python 虚拟环境

第 13 课那三步，我们先摆出来，今天要往细里看：

```text
python -m venv .venv               ← 造屋：在窝里多长出一间叫 .venv 的屋
.venv\Scripts\activate             ← 激活虚拟环境（Windows命令）
deactivate                         ← 收工：走回大院子
```

进门那一步还有个更实在的近亲：**直接调用屋里那台解释器干活** ——

```text
.venv\Scripts\python.exe -m pip install 箱子名
```

念法是：「**该变量里的解释器**，用他自己的 pip，去办后面这件事。」它跟进门的区别是**不会站错屋**：进门是「把整间屋挪到你脚下」，走着走着容易又站回大院子；写全路径是「指名道姓调用这一个变量的对象」。这一课后面的命令全用指名道姓的写法，省心的就这一条。

## 二、解释器找箱子，看的是那串路牌

本子一调用 `import`，解释器是翻箱倒柜地找吗？才不。它手里攥着一串**路牌**，从上往下一格一格看，哪一格撞见箱子名，就进那一格去返回。这串路牌我们把它打印出来看看：

```python
import os
import site
import sys

本子待的屋 = os.path.dirname(os.path.abspath(__file__))
装盒子的地方 = [一份 for 一份 in sys.path if "site-packages" in 一份]

print("路牌第一站就是脚本待的那间屋吗：", sys.path[0] == 本子待的屋)
print("路牌上能找到 site-packages 吗：", len(装盒子的地方) >= 1)
print("解释器报的地址，也在路牌上吗：", site.getsitepackages()[-1] in sys.path)
```

```text
路牌第一站就是脚本待的那间屋吗： True
路牌上能找到 site-packages 吗： True
解释器报的地址，也在路牌上吗： True
```

三行都得念一遍：

1. **第一行 True**：路牌第一站，认的是**这本子自己待的该变量**。所以把一个散装小本子摆在本子旁边，它扭头就能 `import` 到 —— 沾的就是这一站的光。（这是「把本子当文件直接跑」时的规矩；换成用 `python -m` 的方式调用本子、或者进交互该变量，第一站会换成「你正站在哪儿」—— 一句活的：**第一站认的是脚下该变量**。）
2. **第二行 True**：路牌上找得到 `site-packages` 那一格 —— 那是每间屋的**存货间**。本子里引用的箱子，最后都是在这一格里撞见的。
3. **第三行 True**：`site` 这册子能问出「我们的存货间在哪儿」；拿它和路牌上那一格对一对，对得上 —— 说明它认的就是同一间存货间。**你站哪间屋，路牌就挂哪间屋的**；装箱子，装进的是「某间屋的存货间」。

把刚才那段本子再一格一格走一遍，专盯那串路牌是怎么铺开的：

```demo
title: 解释器找箱子：那串路牌是怎么铺开的
code:
| import os
| import site
| import sys
| 本子待的屋 = os.path.dirname(os.path.abspath(__file__))
| 装盒子的地方 = [一份 for 一份 in sys.path if "site-packages" in 一份]
| print("路牌第一站就是脚本待的那间屋吗：", sys.path[0] == 本子待的屋)
| print("路牌上能找到 site-packages 吗：", len(装盒子的地方) >= 1)
| print("解释器报的地址，也在路牌上吗：", site.getsitepackages()[-1] in sys.path)

step 先看第一站
at: 6
say: 本子刚开跑，解释器就把手里的路牌铺开了。第一站是这本子自己待的该变量 —— 所以摆在本子旁边的散装纸，它一眼就能看见。
meow: sys.path 第一项是脚本所在目录。
pose: welcome
sys.path[0] = 脚本所在目录
本子待的屋 = 从本子自己的位置推出来

step 再往下找存货间
at: 5
say: 路牌一格一格往下翻，翻到写着 site-packages 的格子就进去看看 —— 那是该变量放箱子的存货间。翻法就是拿路牌的格子一个个看过去。
meow: 筛选出 site-packages 路径。
pose: busy
存货间 = 找到了
翻法 = 顺着路牌一格一格往下

step 解释器自报存货间
at: 8
say: site 这册子能问出「我的存货间在哪儿」；拿它和路牌上那一格对一对 —— 对得上，说明它认的正是同一间存货间，没跑错屋。
meow: 和 site 报告的路径对照。
pose: proud
解释器报的地址 = 和路牌那一格对得上
对不对 = True

step 站错屋就找不着
at: 1
say: 反过来想：要是这本子站在大院子里，路牌挂的就是大院子那间存货间 —— 请进屋里该变量的箱子，翻完路牌也撞不见。
meow: 解释器不同，查找的路径也不同。
pose: remind
想找箱子 = 顺着路牌一格格撞
站错屋 = 翻到底也撞不见
```

## 三、找不到箱子的时候

那要是一路翻到底，路牌上的格子全翻遍了还是没找着呢？解释器就撂下这么一段：

```python
import 深海鱼粮库

print("压根跑不到这一行")
```

```text
Traceback (most recent call last):
    import 深海鱼粮库
ModuleNotFoundError: No module named '深海鱼粮库'
```

头一行的 `Traceback` 是「翻旧账」的意思：把它是从哪儿摸到哪儿一条条摆出来。中间那些 `File "..."` 的行写着本子存在哪一格 —— 路径随每台机器变，我们就没抄进来。要紧的是**末行**：`ModuleNotFoundError`，解释器明说了 —— 路牌上的格子全翻遍了，没找到叫「深海鱼粮库」的箱子。

::: warn 注意
「找不到箱子」平时就俩来路：**一是名字写错**（箱子叫 `fishfood`，你调用 `fish_food`，它也照样翻不着）；**二是真没装，或者装到别的屋去了**。撞上这行报错，先别急着改代码 —— 站对屋，调用一次 `pip list` 看看登记单上有没有它，多半就有答案了。
:::

## 四、装、查、卸：pip 三件套

我们桌上正躺着一个别人送来的箱子 —— 一个**已经打好包的轮子**（wheel，文件名末尾是 `.whl`，按规矩装好的一个工具箱）。就拿它当例子，全程不出门、不求网。

**装。** 站定该变量，调用一次：

```text
.venv\Scripts\python.exe -m pip install fishfood-0.1.0-py3-none-any.whl
```

屏幕上滚过一长串，要紧的只有末尾两行：

```text
Installing collected packages: fishfood
Successfully installed fishfood-0.1.0
```

`Successfully installed` 一出，就是装好了。末尾可能还跟着两行 `[notice]` 唠叨新版本的事 —— pip 的老毛病，看不看随你。

**查。** 请完点一点存货间，它把屋里住着的箱子连版本列成一张小表：

```text
.venv\Scripts\python.exe -m pip list
```

```text
Package  Version
-------- -------
fishfood 0.1.0
pip      25.0.1
```

屋里只有两行：一个刚请的箱子，一个 pip 自己。**保存了谁、哪个版本，这张表就是底账。**

**登记到单子上。** 想要一张**能带走的**版本清单，调用 `pip freeze`：

```text
.venv\Scripts\python.exe -m pip freeze
```

它把每个箱子按**「箱子名==版本号」**一行一行写出来。我们这台机器大院子该变量的登记单很长，随手摘几行（节选）给你看一眼：

```text
astroid==4.3.4
black==26.10.1
flake8==7.4.1
```

`list` 和 `freeze` 的分工记一句：`list` 是**给自己看**的（连 pip 自己都列进去，扫一眼就完）；`freeze` 是**给别的屋照着请**的 —— 一行一个「名字==版本」，正好拿来重搭一间一模一样的屋。（我们那个 fishfood 是从本地轮子请的，它的登记行会连来路一起记下来，长得很，这里就不抄了。）

把这串抄进窝里的一个本子，起名 `requirements.txt` —— 「这个窝请过的箱子，全在这张单上」。别人（或者三个月后的你）拿到窝，一条命令把单上的箱子一次请齐：

```text
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

那个 `-r` 念作「照着这份单子请」。另有一个常用的小旗子是 `--upgrade`：写在箱子名前面，意思是「有新版本就直接换上」。

**卸。** 某只箱子不再需要了：

```text
.venv\Scripts\python.exe -m pip uninstall -y fishfood
```

它先报一句「找到它了」，再摘掉，最后报一次卸干净 ——

```text
Found existing installation: fishfood 0.1.0
Uninstalling fishfood-0.1.0:
  Successfully uninstalled fishfood-0.1.0
```

末尾那个 `-y` 是「替我们答『是』」：不写它，pip 会停下来等你敲一个 y，问「确定要卸吗」。

::: tip 提示
给 pip 立规矩，一条就够：**箱子安在哪间屋，全看你是站在哪间屋里引用的**。所以我们的习惯是：

1. **一个箱子只请进真正用它的该变量**，别一股脑全塞进大院子（大院子塞满了，早晚撞版本）；
2. 每间屋配一张 `requirements.txt`，请了新箱子就顺手更新一次；
3. 出怪事的第一步永远是 `pip list` —— 先看清「该变量里到底住着谁」，再动手。

哦对：从网上请箱子慢的时候，可以给 pip 换一面近处的镜子（叫**镜像源**），在命令后面加 `-i` 和镜子的地址就行。我们这边走得顺，就没换。
:::

## 五、conda：另一种管变量的办法（看到能认出来的程度）

venv 只管蟒蛇的箱子。还有一种更大会管事的：**conda** —— 它连**解释器本体**都能一次配好一副，箱子、别的语言的家伙事也一把抓。它把「哪个对象 + 哪批箱子」整个打成一个变量，装、换、搬全归它。

我们这台机器上没装 conda，就不现场招呼它了（**没跑过的东西，我们不装作跑过**）。认两点就够：

| | venv + pip | conda |
|---|---|---|
| 管什么 | 只管家门口这批箱子 | 对象本体 + 箱子，还管别的语言的家伙事 |
| 从哪来 | 蟒蛇自带，不用另装 | 要专门装一套 |

以后在别人的机器上看到 `conda create`、`conda activate` 这类命令，知道它和我们今天讲的 venv 是**同一个问题的两种答法**就行 —— 都在回答「怎么让不同窝的箱子互不打架」。

## 小任务

1. 给自己某个窝造一个变量（`python -m venv .venv`），进门后 `pip list` 点一点：新屋的登记单上只有谁？（照着第四节那张两行的表对一对。）
2. 挑一个你请过的箱子，先 `pip freeze` 抄进 `requirements.txt`，再把箱子卸掉、照着单子请回来 —— 看看登记单是不是原样长回来。
3. 把第二节那段小本子存成文件跑一遍，把 `sys.path` 整个打印出来，数一数：路牌一共几格？第一格是哪儿？
4. 想一个问题：为什么「卸箱子」比「请箱子」用得少，却同样要紧？（提示：想想该变量越来越胖的后果。）

这一课把「箱子住哪儿」拆开看了：路牌怎么铺、pip 怎么请查卸、单子怎么记。总结起来就一句：**站在哪间屋，就是哪间屋的对象；单子记清楚，换台机器也搬得走。** 
