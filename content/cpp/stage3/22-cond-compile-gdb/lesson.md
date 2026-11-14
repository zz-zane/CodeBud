---
id: cpp-stage3-22
lang: cpp
stage: 3
order: 25
title: 条件编译与 gdb 调试
tags: ["预处理","调试"]
required: ["cpp-stage3-21"]
crossRefs: ["cpp-stage3-21","c-stage3-13"]
estMinutes: 30
keywords: [ifdef, include-guard, assert, NDEBUG, gdb]
---

## 学习目标

本课学习条件编译与 gdb 调试。重点包括#ifdef 与头文件卫士、条件编译做开关、断言与调试输出、gdb 基本用法。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、`#ifdef` 问「贴没贴」，`#if` 问「值是多少」

先看一段真跑过的源代码：

```cpp
#include <iostream>
using namespace std;

#define DEBUG 0

int main() {
#ifdef DEBUG
    cout << "[调试] 用 #ifdef 判的：它只看 DEBUG 贴没贴" << endl;
#endif
#if DEBUG
    cout << "[调试] 用 #if 判的：它要看 DEBUG 的值" << endl;
#endif
    cout << "处理完成" << endl;
    return 0;
}
```

```text
[调试] 用 #ifdef 判的：它只看 DEBUG 贴没贴
处理完成
```

两段唠叨长得几乎一样，开关那一行也明明写着 `0`，可**第一段照样进了源代码**，第二段才被扔掉。这就是本课第一个大坑：

| 门上的写法 | 它判的是 |
| --- | --- |
| `#ifdef DEBUG` | DEBUG **有没有贴过** —— 哪怕贴成 `0`，在它眼里也算「有」 |
| `#if DEBUG` | DEBUG 的**值**：`0` 就是关 |

所以**想用一个开关把调试的话关掉，门必须写成 `#if DEBUG`**。写成 `#ifdef`，你把值改成 `0` 也关不掉 —— 它只看那张卡贴没贴，不看卡上写的什么。

那 `#ifdef` 是不是就没用了？不是。它管的是另一件事：**「这张卡贴没贴」本身就是要判的东西**。比如「我们有没有在翻译命令里加过某个开关」，那种场合它才顺手。本课第三节的包含卫士就是它的正经用场。

::: warn 注意
还有一种写法会当场翻不下去：把卡贴成**空的**（`#define DEBUG`，后面什么都不写），再用 `#if DEBUG` 去判它。我们真跑过，编译器的原话是：

```text
main.cpp:7:10: error: #if with no expression
```

读作「这个 `#if` 后面没有式子」—— `#if` 要的是一个**能算出数的式子**，而空卡里什么都没有。想用 `#if` 判，卡上就得写一个值（`0` 或 `1`）；卡是空的就别用 `#if`，老老实实用 `#ifdef`。
:::

同一份源代码、同一张卡，拧成三种样子会有什么不同？下面这段演示把它一步一步摆出来。

```demo
title: 三道门，三种拧法：哪几段进编译器的桌子
code:
| #define DEBUG 0
| int main() {
| #ifdef DEBUG
|     cout << "A 段：只问贴没贴" << endl;
| #endif
| #if DEBUG
|     cout << "B 段：还要问值" << endl;
| #endif
|     cout << "处理完成" << endl;
|     return 0;
| }

step 开关有三种拧法
at: 1
say: 第 1 行那张卡就是开关。它可以拧成三种样子：整行删掉（没贴）、贴成 0、贴成 1。下面我们一种一种拧。
meow: 第 1 行控制条件编译。
pose: expect
开关状态 = 还没拧
进桌子的行数 = 等着数
被整段扔掉的 = 还没有

step 没贴这张卡 · A 段进不来
at: 3
say: 先看最省事的一种：第 1 行整行删掉，等于没贴。A 段门口的 #ifdef DEBUG 判假 —— 这一段整段被扔掉，一个字都没进源代码。
meow: 未定义 DEBUG，A 段被移除。
pose: think
开关状态 = 没贴
进桌子的行数 = 1
被整段扔掉的 = A 段

step 没贴这张卡 · B 段也进不来
at: 6
say: B 段门口是 #if DEBUG，卡没贴，它照样判假。这一段也没进。此刻桌上只剩「处理完成」那一行。
meow: 未定义时 #if 也不成立。
pose: think
开关状态 = 没贴
进桌子的行数 = 1
被整段扔掉的 = A 段、B 段

step 拧成「贴了，值是 0」 · A 段回来了
at: 3
say: 现在把第 1 行改成 #define DEBUG 0 —— 卡贴上了，只是值是 0。A 段门口的 #ifdef 只问「贴没贴」，答「贴了」，于是这一段进了桌子。
meow: 定义为 0，#ifdef 仍成立。
pose: yay
开关状态 = 贴了，值是 0
进桌子的行数 = 2
被整段扔掉的 = B 段

step 同样的 0 · B 段还是进不来
at: 6
say: 一模一样的一张卡，B 段门口的 #if DEBUG 要看值：0 就是关，这一段还是没进来。两种写法差在哪，就是这一步。
meow: 值为 0，#if DEBUG 不成立。
pose: remind
开关状态 = 贴了，值是 0
进桌子的行数 = 2
被整段扔掉的 = B 段

step 拧成 1 · 三段全进
at: 9
say: 最后把值改成 1。两张门一前一后都开了：A 段、B 段、「处理完成」全在桌上。同一份源代码，我们一个字都没动，只拧了第 1 行。
meow: 值为 1，A、B 段都保留。
pose: milestone
开关状态 = 贴了，值是 1
进桌子的行数 = 3
被整段扔掉的 = 一段都没有

step 收工 · 回头看一眼这个岔路口
at: 1
say: 记住这个形状：开关写在源代码第一行，可决定的是下面哪几段能不能进。这就是「开工前的岔路口」—— 编译器开工之前，路就已经分好了。
meow: 编译之前就决定了代码去留。
pose: proud
开关状态 = 贴了，值是 1（最后一站）
进桌子的行数 = 3
被整段扔掉的 = 一段都没有
```

## 二、开关还能从外面拧：`-D`

上面那种写法，开关写死在源代码里（`#define DEBUG 0`）。可正式发布的时候，我们不想动源代码一个字 —— 那就**从外面把卡贴上去**：

```cpp
#include <iostream>
using namespace std;

#define VERSION 2

int main() {
#if defined(VERSION) && VERSION >= 2
    cout << "新版：一趟搬 3 条" << endl;
#else
    cout << "老版：一趟只搬 1 条" << endl;
#endif

#ifdef DEBUG
    cout << "[调试] 现在走的是哪一支，看这一行就知道了" << endl;
#endif
    cout << "处理完成" << endl;
    return 0;
}
```

```text
新版：一趟搬 3 条
处理完成
```

我们这会儿**没有**贴 DEBUG 那张卡，所以调试那一行不在源代码里。现在在翻译命令后面添一句 `-DDEBUG`，**源代码一个字都没动**，再跑一遍：

```text
新版：一趟搬 3 条
[调试] 现在走的是哪一支，看这一行就知道了
处理完成
```

`-DDEBUG` 就是从外面贴一张卡（`-D名字` 等于「贴一张空卡」，`-D名字=值` 等于「贴一张写着值的卡」）。调试行回来了，正事那两行一字没变。

这一节还有一样新东西：门上的式子可以**复合**。`#if defined(VERSION) && VERSION >= 2` 读作「**VERSION 这张卡贴过，而且它的值不小于 2**」。这段源代码走的是新版那一支：

- `defined(名字)` 是 `#if` 专用的一句问话，意思是「这张卡贴过没有」—— 它跟 `#ifdef` 判的是同一件事，好处是**能跟别的条件拼在一起**；
- `VERSION >= 2` 是拿值来比。两张卡都贴、值也够大，才进新版那一支。

::: tip 提示
`#if` 能算的比 `#ifdef` 多得多：比大小（`>= `、`<`）、拼条件（`&&`、`||`）、取反（`!`）都行 —— 因为它要的是**一个式子**。而 `#ifdef` 只会问一句「贴没贴」。

所以挑门的时候照这个顺序想：**要判值就用 `#if`；只想问「这张卡在不在」，`#ifdef` 又短又清楚。** 两样都要（「贴过、而且值够大」）就写 `#if defined(...) && ...` 。
:::

## 三、包含卫士：同一份类定义不许进两回

现在换个场景。我们把「对象」这张类定义单独存成一份，好几处都要用到它 —— 于是它会被**塞进源代码好几次**。塞两次会怎样？我们真跑了一遍（这里把同一段原样抄了两遍，就等于一份没有门的类定义被塞进来两回）：

```cpp
#include <iostream>
using namespace std;

struct Cat {
    int fish;
};

struct Cat {
    int fish;
};

int main() {
    Cat c;
    c.fish = 3;
    cout << "这个对象分到 " << c.fish << " 条数据" << endl;
    return 0;
}
```

```text
main.cpp:8:8: error: redefinition of 'struct Cat'
main.cpp:4:8: note: previous definition of 'struct Cat'
```

编译器的原话是「`Cat` 这张类定义被定义了第二回」（下面那行还贴心地告诉你第一回在第 4 行）。**它不是在挑刺 —— 同一个类定义进两回，人也会懵：以哪一份为准？** 所以这门语言干脆规定：不许。

修法就是给类定义**包一道门，门上写「这份进过了」**：

```cpp
#include <iostream>
using namespace std;

#ifndef CAT_H
#define CAT_H
struct Cat {
    int fish;
};
#endif

#ifndef CAT_H
#define CAT_H
struct Cat {
    int fish;
};
#endif

int main() {
    Cat c;
    c.fish = 3;
    cout << "这个对象分到 " << c.fish << " 条数据" << endl;
    return 0;
}
```

```text
这个对象分到 3 条数据
```

同一段字还是抄了两遍，这回一句话都没多说。门上这三行就是**包含卫士**：

1. `#ifndef CAT_H` —— 「`CAT_H` 这张卡**没贴过**吗？」第一次进来时没贴过，里面照进；
2. `#define CAT_H` —— 进门第一件事：把这张卡贴上；
3. `#endif` —— 门到此为止。第二次再进来时，第 1 行判假，**整份到 `#endif` 全被扔掉**。

有几个细节值得多看一眼：

- **卫士的名字要成套**：`#ifndef` 和 `#define` 里必须是**同一个名字**，名字随便取，习惯上照着文件名写成大写加下划线（`CAT_H`）。
- **一份类定义一个名字**。名字是卫士唯一的凭据 —— 我们要是给两份**不同**的类定义都贴上 `GUARD` 这个名字，第一份进完就把 `GUARD` 贴上了，第二份门口一判 `#ifndef GUARD` 是假，**整份被静默扔掉**，之后谁称呼它都是「这个名字没见过」。名字撞车是卫士唯一的坑，而且它**不报错**。
- **`#endif` 不能漏**。漏了编译器会当场拦下来（`unterminated #ifndef`），算是最走运的一种坏法 —— 至少它是响的。

那 `#pragma once` 呢？它一个词就顶了上面三行：

```cpp
#pragma once
struct Cat {
    int fish;
};
```

用途一样，区别有两条：

| | 包含卫士（三行） | `#pragma once`（一行） |
| --- | --- | --- |
| 靠什么认「这份进过了」 | 靠**名字**：名字撞车就会误伤 | 靠**文件本身**：进过就知道 |
| 标准里有没有它 | 有，哪只编译器都认 | 没有，但**事实上**人人都认 |

两样都能用，我们的习惯是：**自己写的类定义用 `#pragma once`**（短、不会撞名），**要给别的编译器看的老派源代码就写卫士**（谁都认，不怕万一）。这话不是绝对的，两样混着写在同一份源代码里也很常见。

::: warn 注意
`#pragma once` 认的是「**这个文件**进过没有」，卫士认的是「**这个名字**贴过没有」—— 两样都不是「同一段字写了两遍」。我们这一节把同一段字抄两遍，是为了让你看见编译器眼里是什么样子；真到了有两份文件的时候，它们才各自派上用场。

最容易出事的是卫士撞名：**它不报错、不警告、也不崩**，只是那份类定义静悄悄地没了。等到某个函数找不到名字的时候，你翻遍那份类定义也看不出问题 —— 因为它一个字都没进源代码。
:::

## 四、被扔掉的代码，编译器根本没见过

这一节是本课最值钱的一句话：

> **被门扔掉的代码，不是「跑起来不执行」，是「编译器压根没见过」。**

两个后果，一个惊喜一个坑。先看惊喜的那半边 —— 我们写到一半的东西，可以**直接搁在源代码里**：

```cpp
#include <iostream>
using namespace std;

int main() {
#if 0
    per = per + ;       // 手滑，这一行写坏了
    fish fish fish
#endif
    cout << "处理完成" << endl;
    return 0;
}
```

```text
处理完成
```

里面那两行是**故意的**：`per = per + ;` 少了个东西，`fish fish fish` 连不成一句话。可程序照样编得过、跑得通 —— 因为 `#if 0` 这一支永远为假，那两行**从来没有进过源代码**。编译器没见过的字，它当然挑不出毛病。

`#if 0` 是老已有实现传下来的「临时封存」写法：写到一半、或者临时想试试别一条路，就把那段包进 `#if 0` 里，回头改成 `#if 1` 就能接上。**它比注释掉强**：注释掉的代码里要是本来就有一个 `*/`，整段源代码会当场乱套；`#if 0` 没这个毛病。

再看坑的那半边。同样一段源代码，我们只是把开关拧开：

```cpp
#include <iostream>
using namespace std;

#define WIP 1

int main() {
    int per = 3;
#if WIP
    per = per + fish_bonus();
#endif
    cout << "一共要 " << per << " 条数据" << endl;
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:9:17: error: 'fish_bonus' was not declared in this scope
```

`fish_bonus` 这个函数我们还没写。关着的时候它安安稳稳躺在源代码里（上一段就是），一拧到 `1`，**当场翻不下去**。

这就是那个坑：**关着的那一段，没人会去编译它，所以它会安安静静地烂掉。** 我们三个月前搁进去的半成品，开关一直关着，谁也不知道它早就编不过了；哪天需要把它打开，先得花半天把它修回能用。所以老已有实现留下的源代码里，`#if 0` 那几段常常是**考古现场** —— 看见它们就当没看见，别随手去拧。

::: tip 提示
本课的四道门，摆一起对一遍：

| 写法 | 判什么 | 什么时候用 |
| --- | --- | --- |
| `#ifdef 名字` | 这张卡**贴过没有**（写 `0` 也算贴过） | 判「有没有这个开关」本身 |
| `#ifndef 名字` | 这张卡**没贴过**吗 | 包含卫士的第一行 |
| `#if 式子` | 式子**算出来是不是非 0** | 判值、比大小、拼条件 |
| `#if 0` | 永远为假 | 临时封存一段源代码 |
| `#pragma once` | 这个**文件**进过没有 | 自己写的类定义，一行顶三行 |

再加一句最要紧的：**门是在编译器开工之前关掉的，不是跑起来才跳过的。** 剩下那半句 —— 「我怎么知道到底哪一段进了源代码」—— 交给下一节的看守。
:::

## 五、断言：只在调试版里拦人的关卡

我们还有一种唠叨，比打印更硬气：**断言**。它的意思是「我们认定这里必定成立，不成立就别往下跑了」：

```cpp
#include <iostream>
#include <cassert>
using namespace std;

int main() {
    int fish = 3;
    assert(fish > 0);
    cout << "断言没拦我们，fish = " << fish << endl;
    return 0;
}
```

```text
断言没拦我们，fish = 3
```

`assert(式子)` 过关的时候**安安静静，一个字都不印**。可要是它不成立，程序当场断气 —— 我们真跑过（这一段会断气，所以只放在这儿给你看）：

```text
#include <iostream>
#include <cassert>
using namespace std;

int main() {
    int fish = 0;
    assert(fish > 0);
    cout << "我们一路跑到了终点" << endl;
    return 0;
}
```

编译器一次没吭（它只管翻得对不对，不管我们认定了什么），可一跑起来就断气，屏幕上留下这么一句：

```text
Assertion failed: fish > 0, file main.cpp, line 7
```

读作「main.cpp 第 7 行那句 `fish > 0` 不成立」。**连那一句是怎么写的、写在第几行，它都替你留着** —— 调试的时候这比十句打印都管用。

可正式版里我们不想要它。上面那几行唠叨可以靠开关扔掉，断言也一样，它的开关叫 `NDEBUG`：只要在**最顶上**写一句 `#define NDEBUG`，源代码里**所有**断言一起消失。

```cpp
#define NDEBUG
#include <iostream>
#include <cassert>
using namespace std;

int main() {
    int fish = 0;
    assert(fish > 0);
    cout << "我们一路跑到了终点" << endl;
    return 0;
}
```

```text
我们一路跑到了终点
```

同一份源代码、同一句不成立的断言（`fish` 还是 `0`），这回**一路跑到了终点**。编译器还顺口念了一句，把证据摆在了明面上：

```text
main.cpp: In function 'int main()':
main.cpp:7:9: warning: unused variable 'fish' [-Wunused-variable]
```

「`fish` 这个变量没人用了」—— 它都看出来 `fish` 没人用了，那就证明**那句话是真的被整个扔掉了**，而不是跑起来跳过去。这正是本课那句话的第二个例证。

::: warn 注意
`#define NDEBUG` 那**一行必须写在 `#include <cassert>` 上面**。写在下面会怎样？我们试过：那句断言**照样拦人**，程序照样断气。

道理不难：`assert` 这个函数是那张 `cassert` 卡进门的时候**照着当时的开关定的形状**。卡已经进过门、函数已经定好形状了，你再在后面写 `#define NDEBUG`，它也变不回去了。

正式发布的时候更省事：源代码一个字不动，在翻译命令后面添一句 `-DNDEBUG` 就行 —— 跟上一节那个 `-DDEBUG` 是同一个手拧的。
:::

## 六、看守 gdb：哪一段真的进了源代码

到这里我们手上有一份源代码，**能编能跑、屏幕上印着数**，可数是错的：

```cpp
#include <iostream>
using namespace std;

#define CATS 4
#define FISH_PER_CAT 3
#define BONUS_PER_CAT 1
#define PARTY 0

int main() {
    int per = FISH_PER_CAT;
#ifndef NDEBUG
    per = per + BONUS_PER_CAT;
#endif
#if PARTY
    per = per + 10;
#endif
    int total = CATS * per;
    cout << "一共要 " << total << " 条数据" << endl;
    return 0;
}
```

```text
一共要 16 条数据
```

我们明明算的是 `4 × 3 = 12`，它印的是 **16**。问题只可能是「哪一段我们以为没进源代码、其实进了」—— 这种事盯着源代码看是看不出来的，得请看守。

请看守之前，编译的时候得带上 `-g`（它才会记住哪一行是哪条机器指令）：

```text
g++ -g -Wall -o a.exe main.cpp
gdb ./a.exe
```

进门以后的事，我们一件件敲给你看（会话里那串每次都在变的编号、还有机器上完整的文件路径，我们抹掉了；**地址每次都不一样**，我们写成了 `0x...`）：

```text
(gdb) break main.cpp:15
Breakpoint 1 at 0x...: file main.cpp, line 17.
(gdb) break main
Breakpoint 2 at 0x...: file main.cpp, line 10.
(gdb) run
Thread 1 hit Breakpoint 2, main () at main.cpp:10
10	    int per = FISH_PER_CAT;
(gdb) next
12	    per = per + BONUS_PER_CAT;
(gdb) print per
$1 = 3
(gdb) next
Thread 1 hit Breakpoint 1, main () at main.cpp:17
17	    int total = CATS * per;
(gdb) print per
$2 = 4
(gdb) next
18	    cout << "一共要 " << total << " 条数据" << endl;
(gdb) print total
$3 = 16
(gdb) continue
一共要 16 条数据
```

这一小段会话里有**两个当场抓到的现行**：

**第一个在开头两行。** 我们敲的是「在**第 15 行**撂个断点」，可看守回的是「`Breakpoint 1` 落在**第 17 行**」。它不吭声，只把断点挪到了后面第一个有代码的行 —— 因为第 15 行在 `#if PARTY` 里，而 `PARTY` 是 `0`：**那一行根本没进源代码，看守当它不存在。** 想验「哪一段没进源代码」，这就是最硬的一条证据。

**第二个在 `print per` 那两下。** 走到第 12 行的时候 `per` 是 `3`，跨过这一行再一看，**变成了 `4`** —— 第 12 行正是 `#ifndef NDEBUG` 包着的那一句。它**真的在源代码里**，真的把「试处理的那一条」加上了。

于是那个 16 是怎么来的就一清二楚了：`4 × (3 + 1) = 16`。我们以为跑的是正式版，其实跑的是调试版 —— 因为翻译命令里**没有**加 `-DNDEBUG`。真想要 12，加上 `-DNDEBUG` 再编一遍就对了。

::: tip 提示
看守身上还有一条规矩，本课专门要你知道：**宏不是变量，看守翻不出来。**

```text
(gdb) print CATS
No symbol "CATS" in current context.
```

`CATS` 明明在源代码第 4 行写着，看守却说「不认识这个名字」。原因就是本课开头那句 —— **宏在开工前就被换掉了，它压根没进源代码**：源代码到看守手里的时候，第 4 行那个名字早就变成了 `4`。看守认识的是**真正进了源代码的东西**（变量、函数、行号），宏不算。

这一条反过来也很有用：看守说「不认识」，通常就意味着「这个名字在开工前就被换掉了」。
:::

## 小任务

1. 把第一节那段源代码敲进去跑一遍，亲眼看见「`#define DEBUG 0` 关不掉 `#ifdef`」；然后把 `#ifdef` 改成 `#if`，再跑一遍，看着调试那行**整个不见**。
2. 在第二节的源代码上做实验：把 `#define VERSION 2` 改成 `1`（先猜会印哪一句），再跑一遍确认印的是老版。然后试试从外面贴：`-DVERSION=2`。⚠️ 这一下有个**真跑出来的意外**：源代码里已经有一张 `VERSION` 的卡了，从外面再贴一张，编译器会念一句「`VERSION` redefined」，**念完它照样编，可它偏向源代码里那张 —— 印出来还是老版**。想验证「外面那张卡真的管用」，得先把源代码里那行 `#define VERSION` 删掉，再拿 `-DVERSION=2` 编，这回才是新版。
3. 写一份「类定义」包上卫士，然后在同一份源代码里**故意**把它抄两遍（第三节那段就是模板）。再玩一次撞车：把两份**不同**的类定义贴成同一个卫士名字，看看第二份是不是静悄悄没了。
4. 挑一段你以前写坏的源代码，把坏掉的那几行用 `#if 0` 封起来，跑一遍确认它照样能跑；然后按第六节那一套（`-g` 编译、`break main`、`run`、`next`、`print`）在它身上练一遍手，顺便看看 `print` 一个宏的名字会回你什么。

下一课我们要带你把这份源代码变成能装上别人机器的家伙：**同一个程序，怎么分成好几份文件、各自管好自己的一张卡** —— 到时候今天学的卫士和开关，就是你天天都要用的东西了
