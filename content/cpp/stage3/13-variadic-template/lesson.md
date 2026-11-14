---
id: cpp-stage3-13
lang: cpp
stage: 3
order: 17
title: 模板进阶
tags: [模板, 泛型]
required: ["cpp-stage3-12"]
crossRefs: []
estMinutes: 27
keywords: [template, typename, sizeof..., 折叠展开]
---

## 学习目标

本课学习模板进阶。重点包括模板特化、可变参数、编译期计算直觉。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、先说那个省略号：一包东西

```cpp
#include <iostream>
using namespace std;

template <typename... Args>
int countAll(Args... args) {
    return sizeof...(args);
}

int main() {
    cout << countAll() << endl;
    cout << countAll(1) << endl;
    cout << countAll(1, 2, 3) << endl;
    cout << countAll("数据", 2, 3.5, "商品") << endl;
    return 0;
}
```

```text
0
1
3
4
```

拆开看这两行：

- `template <typename... Args>` 是**类定义上留的那个空位**，只是这次留的是**一包**：`Args...` 念作「来多少样都行，全装进这一包」。名字叫 `Args` 还是别的都行，前面的三个点才是要紧的。
- `Args... args` 是**把这包东西原样收下**。收下来的名字叫 `args`（本课后面都叫它**一包东西**）。
- `sizeof...(args)` 念作「**这包里保存了几样**」。注意那三个点在括号**里面** —— 写成 `sizeof(args)` 就问不出样数了。

它替我们省掉了什么？上面四个印出来的数分别是 `0`、`1`、`3`、`4`：**空手来也收、一样也收、四样也收**，而类定义只写了一张。包里装的东西还能**各不相同**（字、整数、小数混着来都行）—— 这就是「量体裁衣」这四个字最爽的地方。

## 二、把一包东西合起来

包里保存的是数的时候，我们想全加起来：

```cpp
#include <iostream>
using namespace std;

template <typename... Args>
int addAll(Args... args) {
    return (args + ...);
}

int main() {
    cout << addAll(1, 2, 3) << endl;
    cout << addAll(4, 5) << endl;
    return 0;
}
```

```text
6
9
```

`(args + ...)` 这一句念作「**把包里每一样挨个用 `+` 串起来**」—— 三个点站在哪一边，就决定了往哪边走：

- `(args + ...)` 从**头**一样一样加下去：`1 + 2 + 3`。
- 换成 `(... + args)` 是从**尾**加起。加法左右都不讲究，两个写法答案一样；换上 `-` 这种讲究先后的算子，两个写法就**不一样了**。

那要是包是空的呢？我们把 `addAll()` 也印一下试试：

```cpp
#include <iostream>
using namespace std;

template <typename... Args>
int addAll(Args... args) {
    return (args + ...);
}

int main() {
    cout << addAll() << endl;
    return 0;
}
```

编译器当场犯难：

```text
main.cpp:6:18: error: fold of empty expansion over operator+
```

念作「**这一串是空的，我没法把它们串起来**」。它说的是实话：一样东西都没有的时候，`+` 不知道该拿谁跟谁加。要收空手来的包，就**在末尾垫一个底**：

```cpp
#include <iostream>
using namespace std;

template <typename... Args>
int addAll(Args... args) {
    return (args + ... + 0);
}

int main() {
    cout << addAll(1, 2, 3) << endl;
    cout << addAll() << endl;
    return 0;
}
```

```text
6
0
```

`(args + ... + 0)` 比刚才多了最后那个 `+ 0`：意思是「**串完之后再拿 `0` 加一下**」。包里满满的时候它一点不影响结果（加 0 嘛）；包是空的时候，它就当了那个「一样东西都没有」的答案。

::: warn 注意
**垫的那个底，得是这件事的「空答案」。** 加法的空答案是 `0`；要是往包里全乘起来（`(args * ... * 1)`），垫的就该是 `1` —— 垫 `0` 的话，再多的数乘下来也全变成 `0` 了。写之前先问自己一句：**一样都没有的时候，这件事该给出什么？**
:::

包满的时候和包空的时候各走了一遍，我们把这两回拆成一步一步走给你看：

```demo
title: 一包东西怎么串成一个数
code:
| template <typename... Args>
| int addAll(Args... args) {
|     return (args + ... + 0);
| }
|
| int main() {
|     cout << addAll(1, 2, 3) << endl;
|     cout << addAll() << endl;
| }

step 第一回：三样东西塞进这一包
at: 7
say: 第 7 行 `addAll(1, 2, 3)` —— 三样东西按写的顺序塞进**这一包**。第 2 行的 `Args... args` 就是「来多少样都行、全装进这一包」那个收下的姿势。
meow: 调用 addAll(1, 2, 3)。
pose: expect
包里保存 = 1、2、3
串出来的式子 = （还没串）
交回去的数 = （还没算）
标准输出 = （还没印）

step 三个点把包拆开：从头一样一样串
at: 3
say: 第 3 行 `(args + ...)` —— 三个点站在 `+` 的**右边**，意思是「从头的每一样，挨个用 `+` 串下去」。包里的 1、2、3 被拆成一条式子：`1 + 2 + 3`。
meow: 折叠表达式展开参数包。
pose: busy
包里保存 = 1、2、3
串出来的式子 = 1 + 2 + 3
交回去的数 = （还没算）
标准输出 = （还没印）

step 末尾再垫上那个 + 0
at: 3
say: 式子末尾那个 `+ 0` 是**垫底的**：串完再拿 0 加一下。包里满满的时候它一点不影响结果（加 0 嘛）—— 待会儿包空的时候，就是它撑住答案。
meow: 末尾的 0 是初始值。
pose: expect
包里保存 = 1、2、3
串出来的式子 = 1 + 2 + 3 + 0
交回去的数 = （还没算）
标准输出 = （还没印）

step 算出来 6，交回去
at: 3
say: 这条式子算下来是 **6**，按类定义上写的形状（`int`）交回去。这就是 `(args + ... + 0)` 干的事：**包里几样，就串几下** —— 我们一行都没多写。
meow: 结果是 6。
pose: yay
包里保存 = 1、2、3
串出来的式子 = 1 + 2 + 3 + 0
交回去的数 = 6
标准输出 = （还没印）

step 第 6 步
at: 7
say: 回到第 7 行，`cout` 把 6 印出来。**这一行用的是同一个类定义** —— 我们没为「加三个数」单独写过任何东西。
meow: 输出 6。
pose: yay
包里保存 = 1、2、3
串出来的式子 = 1 + 2 + 3 + 0
交回去的数 = 6
标准输出 = 6

step 第二回：这回空手来
at: 8
say: 第 8 行 `addAll()` —— **一样东西都不喂**。收下的还是那一包，只是这包**空的**。
meow: 调用 addAll()，参数包为空。
pose: think
包里保存 = （一样都没有）
串出来的式子 = （没东西可串）
交回去的数 = （还没算）
标准输出 = 6

step 空包：全靠垫底那个 0
at: 3
say: 空的包，`(args + ...)` **没东西可串** —— 课文里那句 `fold of empty expansion over operator+` 说的就是少了垫底的情况。有了末尾那个 `+ 0`，式子就退化成孤零零一个 `0`：这就是「一样都没有」的答案。
meow: 空包时结果就是 0。
pose: think
包里保存 = （一样都没有）
串出来的式子 = 0（只剩垫底的）
交回去的数 = 0
标准输出 = 6

step 第 0 步
at: 8
say: 第 8 行把 0 印出来。上面 TEXT 里的 `6` 和 `0` 就是这两回：**包满时垫底的 0 不碍事，包空时全靠它**。
meow: 输出 0。
pose: proud
包里保存 = （一样都没有）
串出来的式子 = 0（只剩垫底的）
交回去的数 = 0
标准输出 = 6 / 0

step main 到头：同一个类定义收了两回
at: 9
say: `main` 的括号到头。回头看一眼：同一个类定义，收 3 样也行、收 0 样也行 —— **包里几样就是几样**，类定义一个字都不用改。
meow: 同一个模板支持不同参数个数。
pose: proud
包里保存 = （这一回收完了）
串出来的式子 = （这一回串完了）
交回去的数 = （这一回交完了）
标准输出 = 6 / 0
```

**这一块只讲一件事**：`(args + ...)` 把一包东西**从头的每一样挨个串起来**，末尾那个 `+ 0` 是包空时的靠山。下一节要把头一样单独拎出来，剩下的一样打包。

## 三、先点名一个，剩下的打包

有时候头一样东西要单独拿出来对待，剩下的才打包：

```cpp
#include <iostream>
using namespace std;

template <typename T, typename... Rest>
void firstThenRest(T first, Rest... rest) {
    cout << "头一个：" << first << endl;
    cout << "后面还有 " << sizeof...(rest) << " 个" << endl;
}

int main() {
    firstThenRest("数据", 1, 2.5, "商品");
    firstThenRest("只有它一个");
    return 0;
}
```

```text
头一个：数据
后面还有 3 个
头一个：只有它一个
后面还有 0 个
```

类定义上先写了 `T first` 占住**头一个**，后面才是那一包 `Rest... rest`。传入的东西按顺序站好：第一位进了 `first`，后面的全进包里。第二回只喂了一样，包里就是**空的**（`sizeof...(rest)` 给出 `0`）—— 空包在这里不闹脾气，因为我们没去串它，只是问了问它有几样。

这个「先点名一个、剩下的打包」的形状，是很多现成函数都在用的写法：一刀切下头一个，剩下的再原样传给下一轮。

## 四、印东西也一样

`+` 能串，`<<` 也能串 —— 一包东西可以挨个印出来：

```cpp
#include <iostream>
using namespace std;

template <typename... Args>
void printAll(Args... args) {
    (cout << ... << args);
    cout << endl;
}

int main() {
    printAll("数据 ", 3, " 条");
    printAll("商品", " 和 ", "毛线球");
    return 0;
}
```

```text
数据 3 条
商品 和 毛线球
```

`(cout << ... << args)` 念作「**把包里每一样依次递给 `cout`**」：先印第一样，印出来的东西接着当左边，再印第二样…… 一圈下来就串成了一整句。最后那个 `cout << endl;` 是另起一行用的，跟这一包没关系。

::: tip 提示
`(args + ...)` 和 `(cout << ... << args)` 是同一个形状，区别只是**中间站的是哪个符号**。看着这套写法，我们第一反应是「这也行？」，可真跑起来它就是这么老实：包里几样，就串几下。
:::

## 五、混着喂的坑

量体裁衣最省事的地方是「来什么裁什么」，可它也有个不声不响的坑：

```cpp
#include <iostream>
using namespace std;

template <typename... Args>
int addAll(Args... args) {
    return (args + ...);
}

int main() {
    cout << addAll(1, 2, 3) << endl;
    cout << addAll(1, 2.5) << endl;
    return 0;
}
```

```text
6
3
```

第二行印的是 `3`，可 `1 + 2.5` 明明是 `3.5`。毛病出在类定义上写的那个 `int`：包里算出来的是 `3.5`，**交回去的时候按类定义写的裁成整数**，小数点后面那截就没了。

::: warn 注意
**类定义上写什么形状，交回来就是什么形状。** 混着小数的场面，要是把交回来的形状写成 `int`，那半条数据就悄悄没了 —— 而且**不报错、不提醒**，只有一个看起来「差不多」的数。要小数就换成 `double`，拿不准就自己先真跑一遍看看印出来是什么。
:::

## 一句话对照表

| 想干什么 | 写什么 |
|---|---|
| 说明这次来的是一包东西 | `template <typename... Args>` |
| 把这包东西原样收下 | `Args... args` |
| 数一数包里保存了几样 | `sizeof...(args)` |
| 把包里每一样用 `+` 串起来 | `(args + ...)` |
| 串完再垫一个底 | `(args + ... + 0)` |
| 把包里每一样递给 `cout` | `(cout << ... << args)` |
| 先点名一个，剩下的打包 | `template <typename T, typename... Rest>` |

## 小任务

1. 写一个类定义 `countAll`，喂它 0 样、3 样、5 样东西，看看印出来的数对不对得上。
2. 把第二节那个 `(args + ...)` 换成 `(... + args)` 跑一遍 —— 加法两边不讲究先后，印出来的数应该一样。
3. 试着写一个「把包里每一样乘起来」的类定义，想想**空包**的时候该垫什么底（提示：想想 `1` 和 `0` 谁是乘法的空答案）。
4. 把第五节的类定义改成交回 `double`，再跑一遍 `addAll(1, 2.5)` —— 这回印出来的是多少？

下一课我们要聊一件「听起来很玄、其实天天在用」的事：**已有实现对象踩过坑以后攒下来的老套路**。比如「一样东西全塘只留一件」、比如「包一层再交给别人」—— 这些场面我们早就见过，只是没给它们起过名字 
