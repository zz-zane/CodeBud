---
id: c-stage3-12
lang: c
stage: 3
order: 13
title: 可变参数函数
tags: [函数, 标准库]
required: [c-stage3-11]
crossRefs: []
estMinutes: 26
keywords: [stdarg, va_list, va_start, va_arg, vprintf]
---

## 学习目标

本课学习可变参数函数。重点包括stdarg、va_list、printf 家族原理。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```c
printf("%d 个对象，一共 %d 条鱼", 3, 9);
```

## 一个坑一个萝卜：写死的传入表

先看看我们现在的老实法子：

```c
#include <stdio.h>

int fish_total3(int a, int b, int c) {
    return a + b + c;
}

int main(void) {
    printf("三个对象的：%d\n", fish_total3(2, 3, 4));
    return 0;
}
```

```text
三个对象的：9
```

这招老实是老实，可它就是**只能收三份**：想报五个对象的数，得再写一个方法 `fish_total5`；六只再写一个方法……传入表上写死几个，就得喂几个，多一份少一份编译器都不答应。

## 三个点：后头还跟着一串

C 语言给留了个口子：在传入表**最后一位**写**三个点** `...`，意思是「**后头还跟着一串，几份不好说**」。

我们把上面那招改成这样：

```c
#include <stdio.h>
#include <stdarg.h>

int fish_total(int count, ...) {
    va_list list;
    va_start(list, count);
    int sum = 0;
    for (int i = 0; i < count; i++) {
        sum += va_arg(list, int);
    }
    va_end(list);
    return sum;
}

int main(void) {
    printf("三个对象的：%d\n", fish_total(3, 2, 3, 4));
    printf("五个对象的：%d\n", fish_total(5, 1, 1, 1, 1, 1));
    return 0;
}
```

```text
三个对象的：9
五个对象的：5
```

同一个方法，三份也能收、五份也能收

看仔细：`fish_total` 的传入表分两截 ——

- 前头 `int count` 是**有名字的那位**，我们自己传了个账本进去，说清这回来几个；
- 后头 `...` 那一串全是**没名字的散兵**，它们是谁、有几个，函数本身不知道，得靠我们告诉它。

## 清单四步：开、挂、返回、收

`...` 后头那一串看不见摸不着，得靠 `stdarg.h` 这个工具房里的四步走：

| 四步 | 管什么 |
| --- | --- |
| `va_list list;` | **开一张清单**：后头那一串先记在它名下 |
| `va_start(list, count);` | **挂名字**：从 `count` 后面那一份开始记 |
| `va_arg(list, int);` | **返回一份**出来，说好它是 `int`；返回过的就往后挪一位，不会回头 |
| `va_end(list);` | **收摊**：清单用完了，交回去 |

盯住两个容易写错的地方：

1. `va_start` 的第二项**永远是最后那个有名字的传入**（这里就是 `count`）。写成别的名字，清单就从错的地方开始记。
2. 三个点**必须写在最后一位**，而且前面**至少留一个有名字的传入** —— 没名字可挂，清单就开不起来。

> 我们试过只写三个点、前面什么名字都不留：这台编译器**居然放它过去了**（新规矩松了），可没有名字能挂，那一串传入只能原样躺着，谁也用不上。别偷这个懒。

这四步是按什么顺序走的、清单每返回一口挪到哪儿，我们拆成一步一步走给你看（就用课文里 `fish_total(3, 2, 3, 4)` 那一句）：

```demo
title: 清单是怎么一份一份往前挪的
code:
| int fish_total(int count, ...) {
|     va_list list;
|     va_start(list, count);
|     int sum = 0;
|     for (int i = 0; i < count; i++) {
|         sum += va_arg(list, int);
|     }
|     va_end(list);
|     return sum;
| }
| 
| int main(void) {
|     printf("三个对象的：%d\n", fish_total(3, 2, 3, 4));
|     return 0;
| }

step 调用函数：账本先递进去，后头跟着一串
at: 13
say: 这一句里我们递进去两样：**前头的 `3` 是账本**（说清这回来几个），后面 `2、3、4` 是**那一串没名字的散兵**。它们跟着我们一起进了 `fish_total` 的门。
meow: 第一个参数 3 表示后面有 3 个数。
pose: expect
账本上写着 = 3 份
清单眼下挂在哪 = 还没开
这一问的答案 = 还没轮到问
攒到手的 = （还没归零）

step 进门：传入表分两截
at: 1
say: 进门第一眼是传入表 `int count, ...`：前头 `count` 是**有名字的那位**，账本 3 就落在它身上；后头那三个点表示「后头还跟着一串」—— **那一串一个名字都没有**，函数自己不知道它们是谁、有几个。
meow: count 接收 3。
pose: expect
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 还没开
这一问的答案 = 还没轮到问
攒到手的 = （还没归零）

step 第一步 · 开一张清单
at: 2
say: `va_list list;` 是四步里的第一步 —— **开一张清单**，说好后头那一串记在它名下。**刚开出来的清单还挂不住任何一份**：它还不知道该从哪儿开始记。
meow: 声明 va_list。
pose: busy
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 空清单（还没引用谁）
这一问的答案 = 还没轮到问
攒到手的 = （还没归零）

step 第二步 · 挂名字：从 count 后面开始记
at: 3
say: `va_start(list, count);` 是**挂名字**：从 `count` **后面那一份**开始记 —— 这一挂就挂到了那一串的**第 1 份**上。第二项永远是**最后那个有名字的传入**，写成别的名字，清单就从错的地方开始记。
meow: va_start 从 count 后面开始读取。
pose: busy
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 第 1 份（就是 2）
这一问的答案 = 还没轮到问
攒到手的 = （还没归零）

step 把 sum 归零，准备攒数
at: 4
say: `int sum = 0;` 把 `sum` 归 0 —— 一会儿每返回一份就往里加。**它和那一串传入是两回事**：账本管「有几份」，它管「攒了多少」。
meow: sum 初始化为 0。
pose: expect
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 第 1 份（就是 2）
这一问的答案 = 还没轮到问
攒到手的 = 0

step 第一圈 · 先看眼色
at: 5
say: 绕圈第一拍是**眼色**：`i < count` 就是「0 比 3 小吗」。答真 —— 放行，进圈。**跑几圈是账本说了算**，清单自己数不了。
meow: 0 < 3，进入循环。
pose: expect
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 第 1 份（就是 2）
这一问的答案 = 0 比 3 小吗 → 答真，进圈
攒到手的 = 0

step 第一口 · 取走 2，清单往后挪一位
at: 6
say: `va_arg(list, int)` 从清单**眼下挂着的那一份**把 `2` 读取，加进 `sum`：攒到手的成了 2。**返回过的清单往后挪一位**，挂到第 2 份上 —— 它**不回头**，第 1 份再也返回不着了。
meow: 读取 2，sum 是 2。
pose: busy
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 第 2 份（就是 3）
这一问的答案 = 0 比 3 小吗 → 答真
攒到手的 = 2

step 第二圈 · 先看眼色
at: 5
say: 收尾把 `i` 加到 1，绕回 `for` 又瞄一眼：`1 < count` 就是「1 比 3 小吗」，答真 —— 再进一圈。
meow: 1 < 3，继续。
pose: expect
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 第 2 份（就是 3）
这一问的答案 = 1 比 3 小吗 → 答真，进圈
攒到手的 = 2

step 第二口 · 3 出列
at: 6
say: 清单正挂着第 2 份，`va_arg` 照引用的位置再返回一口：`3` 出列，加进 `sum` —— 攒到手的 2 + 3 = **5**，清单挪到第 3 份。
meow: 读取 3，sum 是 5。
pose: busy
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 第 3 份（就是 4）
这一问的答案 = 1 比 3 小吗 → 答真，进圈
攒到手的 = 5

step 第三圈 · 再瞄一眼眼色
at: 5
say: 收尾再把 `i` 加到 2，绕回来瞄第三眼：`2 < 3` 还答真 —— 这是最后一圈。**跑几圈是开跑前就用账本定死的**，不是清单说了算。
meow: 2 < 3，最后一圈。
pose: expect
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 第 3 份（就是 4）
这一问的答案 = 2 比 3 小吗 → 答真，进圈
攒到手的 = 5

step 第三口 · 4 出列，清单见底了
at: 6
say: 最后一份 `4` 被取走，攒到手的成了 **9**，清单挪到**那一串的队尾之后** —— 那儿什么都没有了。可它**不会自己停**：清单不知道串有多长，是账本 `count` 把它拦在这儿的。
meow: 读取 4，sum 是 9。
pose: yay
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 队尾之后（那一串见底了）
这一问的答案 = 2 比 3 小吗 → 答真，进圈
攒到手的 = 9

step 第四次绕回来：眼色答假，圈停
at: 5
say: 第四次绕回 for：`i` 已经是 3，「3 比 3 小吗」答**假** —— 圈停了，`va_arg` 一次都没再跑。**这就是账本的用处**：返回几份全靠它说了算，多写一份它照样会去返回第四口。
meow: 3 < 3 不成立，循环结束。
pose: think
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 队尾之后（那一串见底了）
这一问的答案 = 3 比 3 小吗 → 答假，圈停
攒到手的 = 9

step 第四步 · 收摊，把清单交回去
at: 8
say: `va_end(list);` 是四步里的最后一步：**收摊**。开、挂、返回、收 —— 到这儿四步走全了，清单用完了要交回去。
meow: va_end 结束读取。
pose: proud
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 收摊交回了
这一问的答案 = 3 比 3 小吗 → 答假，圈停
攒到手的 = 9

step 把攒到的数递回去
at: 9
say: `return sum;` 把攒到的 **9** 递回给 `main` 里那个 `printf` —— 函数进门时接的是账本和一串散兵，出门时只带走这一个数。
meow: 返回 9。
pose: busy
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 收摊交回了
这一问的答案 = 3 比 3 小吗 → 答假，圈停
攒到手的 = 9（递回给 main 了）

step 印出来：三个对象的 9
at: 13
say: 屏幕上出现「三个对象的：9」—— 和课文里那个 TEXT 块的第一行一模一样。同一个方法换成 `fish_total(5, 1, 1, 1, 1, 1)`：账本写 5、返回五口，就是第二行那个 5。
meow: 输出 9。
pose: proud
账本上写着 = 3 份（装在 count 里）
清单眼下挂在哪 = 收摊交回了
这一问的答案 = 3 比 3 小吗 → 答假，圈停
攒到手的 = 9（印出来了）
```

**记住清单的脾气**：它只会**往前挪**，返回过的一份绝不回头；它自己也**不数数** —— 有几份、每一份是什么类型，全得靠函数自己盯死（我们靠的是传进去的那个 `count`）。

## 得自己知道有几份：`printf` 家族原理

这里有个绕不开的规矩：**后头那一串不带标签**。清单只知道「接下来还有东西」，它**不知道有几份**，也**不知道每一份是什么类型**。

所以：**谁写的函数，谁自己想办法数。**

那 `printf` 是怎么数的？它靠**格式串**：

- 格式串里有几个占位符（`%d`、`%s`……），后头那一串就有几份；
- 占位符写的是 `%d` 就按 `int` 返回、写 `%s` 就按一串字符串返回 —— **类型也是它说了算**。

这就是 `printf` 家族原理：**格式串就是它的账本**。（我们传进去的账本是那个 `count`，它传进去的账本是格式串 —— 一个道理。）

`printf` 这一家子人多得很，收法分两种：

| 收法 | 函数 |
| --- | --- |
| 后头**直接跟一串** | `printf`、`fprintf`、`sprintf`、`snprintf` |
| 收一张**已经开好的清单** | `vprintf`、`vfprintf`、`vsprintf`、`vsnprintf` |

为什么要两版？就为了**转发**。我们想给 `printf` 穿一层自己的壳 ——「先印个抬头、再印主人的话」：

```c
#include <stdio.h>
#include <stdarg.h>

void report(const char *fmt, ...) {
    va_list list;
    va_start(list, fmt);
    vprintf(fmt, list);
    va_end(list);
    printf("\n");
}

int main(void) {
    report("%d 个对象，一共 %d 条鱼", 3, 9);
    report("只印一句话");
    return 0;
}
```

```text
3 个对象，一共 9 条鱼
只印一句话
```

`report` 自己这一串传入，它**没法原样递给** `printf` —— 摆在手里的只是一张清单。所以有 `vprintf`：**收清单的那一版**。往后凡是要把「一串传入」往下转交，认准名字里带 `v` 的那一位。

还有一位常用的：`vsnprintf` 先把话攒进一串字符串里，回头再印。

```c
#include <stdio.h>
#include <stdarg.h>

void report(const char *fmt, ...) {
    char line[64];
    va_list list;
    va_start(list, fmt);
    vsnprintf(line, sizeof(line), fmt, list);
    va_end(list);
    printf("<%s>\n", line);
}

int main(void) {
    report("%d 个对象", 3);
    return 0;
}
```

```text
<3 个对象>
```

`64` 是这条字符串最长能穿多少颗，`sizeof(line)` 就是照着这排数组元素的总长度报数 —— 攒的时候攒不下会自己剪断，不会撑破元素边。

## 两个最阴的坑

**坑一：类型说错。**清单不认字，你说按 `int` 返回，它就真按 `int` 去抓：

```c
#include <stdio.h>
#include <stdarg.h>

int show_int(int count, ...) {
    va_list list;
    va_start(list, count);
    int v = va_arg(list, int);
    va_end(list);
    return v;
}

int main(void) {
    double a = 1.5;
    printf("%d\n", show_int(1, a));
    return 0;
}
```

我们传入的是 `1.5`，说好按 `int` 返回 —— 编译器**一次没吭**，跑出来印的是 `0`。这就是最阴的地方：它不报错、不警告，只是返回一个跟原来毫无关系的数。类型对不上，程序照样跑，错得安安静静。

**坑二：份数说错。**我们写 `fish_total(3, 2, 3)`：嘴上说三份，手里只给了两份。

```c
#include <stdio.h>
#include <stdarg.h>

int fish_total(int count, ...) {
    va_list list;
    va_start(list, count);
    int sum = 0;
    for (int i = 0; i < count; i++) {
        sum += va_arg(list, int);
    }
    va_end(list);
    return sum;
}

int main(void) {
    printf("%d\n", fish_total(3, 2, 3));
    return 0;
}
```

它照着 `3` 一路返回下去，第三份是**谁也不知道从哪儿抓来的**东西 —— 我们试的时候印出来是个毫无意义的数，而且**再跑一遍又是另一个数**（我们就见过它换过）。那数看着像回事，其实什么都不是。份数错了，账本就成了瞎账。

⚠️ 顺手对照一下：`printf` 那一族有格式串当账本，编译器能替你核一核 —— 我们写了句 `printf("%d\n", 3.5)`，它当场嘟囔了一句警告（`-Wformat=`）。可我们自己写的这一串，它**核不了**：类型、份数，全得你自己盯死。

## 忘带工具房那一句

`va_list`、`va_start`、`va_arg`、`va_end` **不是** C 语言自带的语法字，是 `stdarg.h` 这个工具房里现成的东西。我们把 `#include <stdarg.h>` 那一行删掉试试：

```c
#include <stdio.h>

int fish_total(int count, ...) {
    va_list list;
    va_start(list, count);
    int sum = 0;
    for (int i = 0; i < count; i++) {
        sum += va_arg(list, int);
    }
    va_end(list);
    return sum;
}

int main(void) {
    printf("三个对象的：%d\n", fish_total(3, 2, 3, 4));
    return 0;
}
```

```text
main.c: In function 'fish_total':
main.c:5:5: error: implicit declaration of function 'va_start' [-Wimplicit-function-declaration]
main.c:8:16: error: implicit declaration of function 'va_arg' [-Wimplicit-function-declaration]
main.c:8:29: error: expected expression before 'int'
main.c:10:5: error: implicit declaration of function 'va_end' [-Wimplicit-function-declaration]
```

编译器压根不认识这几件工具，只当是没听过的新函数名字，一路报下去。中间那条 `expected expression before 'int'` 是**它在替上一句收尾** —— 它已经把 `va_arg(list, int)` 当成调用一个不认识的函数了，于是逗号后面那个 `int` 它就没法安放。**一条错引出下一条**，所以别被后面的条数吓着，先修最上面那一句。

看见 `implicit declaration`，先摸一摸是不是忘了带工具房那一行。

::: tip 提示
不限量传入的四句口诀，背下来就够用：

1. **三个点写在最后一位**，前面至少留一个**有名字**的传入；
2. `va_start(清单, 那个名字)` —— 名字一定是最后那个固定的传入；
3. **自己数着数返回**（多返回一份毫无意义），**类型一定和传入的对上**（说错不报错）；
4. 返回完记得 `va_end` 收摊；要把这一串转交出去，只能用**名字里带 `v`** 的那一版。

再配一句：`printf` 的账本是**格式串**，我们的账本是**自己传的 `count`** —— 清单不会替谁记账。
:::

## 小任务

写一个方法 `int biggest(int count, ...)`：从不定量的一串里挑出**最大**的那个数返回。

- 先传账本 `count`，再用 `va_arg(list, int)` 一份一份返回；
- 自己在 `main` 里试两回：`biggest(4, 3, 9, 2, 7)` 该返回 `9`；`biggest(2, 5, 1)` 该返回 `5`；
- 做完再故意把 `count` 写成比实际多一份，看看印出来是什么 —— 记住这个坑的样子。
