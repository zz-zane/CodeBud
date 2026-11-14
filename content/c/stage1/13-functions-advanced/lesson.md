---
id: c-stage1-13
lang: c
stage: 1
order: 13
title: 函数进阶
tags: [函数, 作用域, 参数传递, 函数声明]
required: ["c-stage1-12"]
crossRefs: []
estMinutes: 25
keywords: [scope, prototype, global, pass-by-value]
---

## 学习目标

本课学习函数进阶。重点包括参数传递、局部变量、全局变量、声明与原型。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```c
#include <stdio.h>

void feed(int n) {
    n = n + 1;
    printf("函数里：%d\n", n);
}

int main(void) {
    int fish = 5;
    feed(fish);
    printf("main 里：%d\n", fish);
    return 0;
}
```

```text
函数里：6
main 里：5
```

```demo
title: 调用一次函数，外面那个元素为什么没跟着变
code:
| void feed(int n) {
|     n = n + 1;
|     printf("函数里：%d\n", n);
| }
| int main(void) {
|     int fish = 5;
|     feed(fish);
|     printf("main 里：%d\n", fish);
| }

step main 里先摆好自己那个元素
at: 6
say: `int fish = 5;` 先在自己家里摆一个元素，贴上 `fish`，装上 5。这会儿函数还没被调用，`feed` 里一个元素都还没摆出来。
meow: main 的 fish 是 5。
pose: expect
main 里的 fish = 5
函数里的 n = 还没摆
标准输出 = 还没印

step 调用一次 feed(fish)：先瞄一眼里面是几
at: 7
say: 这一行是调用函数。编译器先看括号里那条数据 —— 报名字 `fish`，把元素里的数读取：**是 5**。
meow: 调用时先读取 fish 的值。
pose: busy
main 里的 fish = 5
函数里的 n = 还没摆
标准输出 = 还没印

step 抄一张纸条，投进函数里那个元素
at: 7
say: 接下来端进去的**不是那个元素**，是一张写着 5 的纸条。函数里现摆一个崭新的元素 `n`，纸条投进去 —— 里面躺着的这个 5 是**抄件**。从这一刻起，两个元素各归各。
meow: 把 5 复制给参数 n。
pose: busy
main 里的 fish = 5
函数里的 n = 5（抄件）
标准输出 = 还没印

step 函数里那个元素自己加一
at: 2
say: 函数里这句 `n = n + 1` 改的是**函数里那个 n 元素**：5 加 1 得 6，重新赋值。**注意：外面那个 `fish` 从头到尾没被碰过，还是 5。**
meow: n 变成 6，fish 不变。
pose: busy
main 里的 fish = 5
函数里的 n = 6
标准输出 = 还没印

step 函数里调用一次，印出 6
at: 3
say: 这句 `printf` 印的是函数里那个 `n` 元素 —— 屏幕上出现「函数里：6」。这个 6 只在函数里成立，它是那张纸条上的数。
meow: 输出函数里的 n：6。
pose: yay
main 里的 fish = 5
函数里的 n = 6
标准输出 = 函数里：6

step 函数收工：n 这个元素就地撤走
at: 4
say: 函数那块大括号一合，函数里现摆的那一套元素**立刻撤走** —— `n` 没了，它只在函数里活着。下次再调用 `feed`，里里外外是**崭新的一个 n**，不记得这次装过 6。
meow: 函数结束，n 被销毁。
pose: busy
main 里的 fish = 5
函数里的 n = 撤走了
标准输出 = 函数里：6

step 回到 main，印的是自己那个元素
at: 8
say: 控制权回到刚才调用函数的那一行，接着往下跑。这句 `printf` 印的是 **main 自己那个 `fish`** —— 它睡到现在，还是 5。
meow: 回到 main，输出 fish：5。
pose: expect
main 里的 fish = 5
函数里的 n = 撤走了
标准输出 = 函数里：6 ／ main 里：5

step 大括号一合，整段收工
at: 9
say: 程序跑完，屏幕上两行：函数里 **6**、main 里 **5**。差别就在投进去的是抄件还是原件 —— 课文第二节那排数组元素是唯一的例外，整排元素交出去的是「元素架在哪儿」，函数里一改，外面真的会变。
meow: C 语言普通参数是值传递。
pose: proud
main 里的 fish = 5
函数里的 n = 撤走了
标准输出 = 函数里：6 ／ main 里：5
```

## 二、唯一的例外：整排数组元素交出去的是原件

那是不是所有东西传入都是抄件？**不是。有一样东西是例外，而且你一定要记住它。**

```c
#include <stdio.h>

void treat(int bowl[], int count) {
    int i;
    for (i = 0; i < count; i++) {
        bowl[i] = bowl[i] * 10;
    }
}

int main(void) {
    int bowl[3] = {1, 2, 3};
    treat(bowl, 3);
    printf("%d %d %d\n", bowl[0], bowl[1], bowl[2]);
    return 0;
}
```

```text
10 20 30
```

咦？这一趟明明也是调用函数，函数里也没写 `return`，怎么 `main` 里那排元素**真的被改了**？

因为**一整排元素太重了，抄一份太贵**。几百只元素挨个抄一遍，调用一次函数就这么折腾，太笨了。C 在这里换了做法：交出去的不是抄件，而是**「这排元素架在哪儿」这个信息** —— 函数拿着这个信息，就能直接走到那一排元素前面，伸手去动**你自己的原件**。

所以 `treat(bowl, 3)` 里那句 `bowl[i] = bowl[i] * 10` 改的是你本人的元素，出来一看，全变成十倍了。

::: warn 这条区别会一直跟着你
- **单个的元素**（整数、字符这种小东西）→ 传入是**抄件**，函数里改了，外面不变。
- **整排的元素** → 交出去的是**「元素架在哪儿」**，函数里改了，外面**真的会变**。

今天你只要记住这个结论就行。至于「元素架在哪儿」这条信息到底是什么东西、该怎么写下来 —— 那是下一课的主角：一张**指针**。我们先卖个关子
:::

## 三、函数自己的元素

第二个问题：函数里摆的元素，出了门还算数吗？先看两个函数抢名字：

```c
#include <stdio.h>

int doubleIt(int n) {
    n = n * 2;
    return n;
}

int square(int n) {
    n = n * n;
    return n;
}

int main(void) {
    printf("%d\n", doubleIt(4));
    printf("%d\n", square(4));
    return 0;
}
```

```text
8
16
```

两个函数里都摆了一个叫 `n` 的元素，名字撞上了，编译器却一点都不生气。凭什么？

因为**函数里的元素，地盘只在函数内部**。每调用一次函数，就在函数里**现摆**一套崭新的元素；函数一收工，整套元素立刻撤走。两个不同的函数各摆各的，谁也看不见谁。

连和外面的元素撞名字也不怕，照样跑：

```c
#include <stdio.h>

void feed(int fish) {
    fish = fish + 1;
    printf("函数里：%d\n", fish);
}

int main(void) {
    int fish = 5;
    feed(fish);
    printf("main 里：%d\n", fish);
    return 0;
}
```

```text
函数里：6
main 里：5
```

函数里那个 `fish` 和 `main` 里那个 `fish`，名字一样、**其实是两个完全不同的元素**。函数里改的是它自己那个，外面那个纹丝不动 —— 结果和第一段的 `n` 一模一样。

这套「谁看得见谁」的规矩，正式叫法是地盘（作用域）。

那反过来呢？**函数收工后，外面能不能调用函数里那个元素？**

```c
#include <stdio.h>

void make(void) {
    int n = 7;
}

int main(void) {
    printf("%d\n", n);
    return 0;
}
```

```text
main.c:8:20: error: 'n' undeclared (first use in this function)
    8 |     printf("%d\n", n);
```

编译器说：`'n' undeclared` —— 也就是「`n` 这个名字我们没登记过」。

`n` 只在 `make` 该变量子里挂了号。站在 `main` 里称呼它，等于跑到别人家门口调用自身家对象的名字，谁也听不懂。**函数里的元素，只在函数里活着。**

## 四、摆在门口的大缸

有些东西偏偏**就该让所有函数都看得见** —— 比如「今天一共发出去多少条数据」，每调用一个方法就往上涨一点。

那就别把它放在谁家里，摆在**大门口**：写在所有函数的外面。

```c
#include <stdio.h>

int fishCount = 0;

void addOne(void) {
    fishCount = fishCount + 1;
}

void addThree(void) {
    fishCount = fishCount + 3;
}

int main(void) {
    addOne();
    addThree();
    printf("大缸里现在有 %d 条\n", fishCount);
    return 0;
}
```

```text
大缸里现在有 4 条
```

这个摆在门外的 `fishCount`，两个函数都能看见、都能往里伸手。调用结束 `addOne()` 再调用 `addThree()`，大缸里就攒到了 `4`。

这种摆在所有函数门外的变量，正式叫法是大缸（全局变量）。它有两个和「函数里的元素」正好相反的脾气：

**脾气一：不写初值，编译器自动给你装 0。**

```c
#include <stdio.h>

int total;

int main(void) {
    printf("%d\n", total);
    return 0;
}
```

```text
0
```

注意：这一条**只对门口的大缸成立**。函数里的元素要是不写初值，里面保存的是上一次谁用剩的垃圾，印出来是什么全看运气 —— 这种「结果不稳定」的东西我们没法给你演示，只能提醒你：**函数里的元素，一律自己写上初值。**

**脾气二：和函数里的元素撞名字时，函数里的那个赢。**

```c
#include <stdio.h>

int fish = 10;

int main(void) {
    printf("大缸里：%d\n", fish);
    int fish = 3;
    printf("自己的元素里：%d\n", fish);
    return 0;
}
```

```text
大缸里：10
自己的元素里：3
```

第一行印的时候，我们自己那个 `fish` 还没摆出来，所以看到的是大缸里的 `10`。第二行前面刚写了 `int fish = 3;` —— 从这一行起，这条街上再说 `fish`，都指**自己的元素**，大缸里那 `10` 被挡在后头了。

::: warn 大缸很方便，但别乱用
它谁都能改，而且「谁在什么时候改的」你根本追不到。今天这两个函数还算乖，要是十几个函数都往同一口缸里伸手，出了错你连从哪儿查起都不知道。

小家伙的规矩：**能用函数里的元素就用元素，大缸只留给真正「所有函数都该看见」的东西。**
:::

## 五、先在门口挂块名称

还有一条 C 独有的讲究：**函数得先登场，后施展。**

```c
#include <stdio.h>

int main(void) {
    printf("%d\n", add(2, 5));
    return 0;
}

int add(int a, int b) {
    return a + b;
}
```

```text
main.c:4:20: error: implicit declaration of function 'add' [-Wimplicit-function-declaration]
    4 |     printf("%d\n", add(2, 5));
```

编译器一路往下念，念到 `main` 里那句 `add(2, 5)` 时愣住了：**「`add` 是谁？我们没听过这个名字。」**

C 的脾气是**从上往下念一遍、念到哪儿办到哪儿**：它念到 `add(2, 5)` 的时候，后面那个 `add` 的函数还没有登场，它当然不认识。注意这里和第 11 课那次不一样 —— 那次是忘了请档案管理员，这次是**顺序**的问题。

那是不是非得把函数全塞到 `main` 前面？不用。**先在门口挂块名称**就行：

```c
#include <stdio.h>

int add(int a, int b);

int main(void) {
    printf("%d\n", add(2, 5));
    return 0;
}

int add(int a, int b) {
    return a + b;
}
```

```text
7
```

名称长这样：`int add(int a, int b);` —— **把函数头上那一行原样抄一遍，后面加个分号**，函数身体一个字都不写。

这块名称等于提前跟编译器打了招呼：「后头有个叫 `add` 的函数，要喂两个整数，会返回一个整数。」等它真念到函数那里，对一下名称，对得上就直接开张。

名称的正式叫法是函数招牌（函数声明 / 原型）。

名称必须和真函数**一字不差地对上**。写歪了会怎样？

```c
#include <stdio.h>

int add(int a, int b);

int main(void) {
    printf("%d\n", add(2, 5));
    return 0;
}

int add(int a, int b, int c) {
    return a + b + c;
}
```

```text
main.c:10:5: error: conflicting types for 'add'; have 'int(int,  int,  int)'
main.c:3:5: note: previous declaration of 'add' with type 'int(int,  int)'
```

`conflicting types` 就是「对不上号」：名称上说这招收**两个**元素，真函数却摆了三个。编译器两边一对照，当场拦下。

名称还有个好处：**函数的身体写多长都行，招牌只有短短一行。** 读到 `main` 的时候，一眼就能知道后面有哪些招能用。

## 一句话对照表

| 东西 | 写在哪儿 | 谁看得见 | 传入是 |
|---|---|---|---|
| 函数里的元素 | 函数的大括号里面 | 只有这一个方法 | —— |
| 门口的大缸 | 所有函数的外面 | 所有函数 | —— |
| 单个的小东西传入函数 | —— | —— | **抄件**，改了外面不变 |
| 整排的元素交进函数 | —— | —— | **元素架在哪儿**，改了外面真的变 |

## 小任务

1. 把第一段那段代码亲手跑一遍。然后把函数里那句改成 `n = n + 100;`，再跑一次 —— 猜猜 `main` 里印出来是几？（剧透：还是 `5`，因为它改的是抄件。）
2. 第三段最后那段代码跑完之后，把 `make` 里那句 `int n = 7;` **挪进 `main`**（写在 `printf` 前面），再跑一次。这次能印出来吗？想想为什么换个地方住就活了。
3. 给大缸那段代码加一个方法 `addFive`，一次往大缸里放 `5` 条，然后在 `main` 里连调用 `addOne()`、`addFive()` 各一次，看看大缸最后是几条。
4. 把第 5 段最后那段代码的招牌改成 `int add(int a);`（少写一个元素），跑一次，看看编译器会不会拦下来。
