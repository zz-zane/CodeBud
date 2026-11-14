---
id: c-stage3-01
lang: c
stage: 3
order: 2
title: 内存模型深入
tags: [内存, 存储区, 生命周期]
required: [c-stage2-15]
crossRefs: []
estMinutes: 20
keywords: [stack, heap, static, malloc]
---

## 学习目标

本课学习内存模型深入。重点包括内存分区、各区的角色、变量住在哪。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 大院子里的四间屋

**秘籍架（代码区）** —— 编译器把你的函数翻成一条条指令，整整齐齐码在这儿。开跑之后它**只读不写**，谁都别想改它。你把一句话写在引号里（比如 `printf` 里那句问候），那份字也会被码在这儿，因为你改不了它。

**门口那排上了锁的固定储物柜（静态区）** —— 程序一开跑就把柜子摆好，一直摆到程序结束。写在所有函数**外面**的全局变量、还有被 `static` 点过名的变量，都住这儿。它们的记性最好：**从头活到尾，只此一份**。

**动态内存（堆区）** —— 这就是上一阶段学过的 `malloc` 要来的地方。想用了才开口租，用完了得**自己**还（`free`）。租来的变量很老实：你不还，它就一直占着。

**栈（栈区）** —— 编译器给每个进门干活的对象（也就是每调用一次函数）在元素摞上摆一层元素，这一层里放着这招的局部变量和传入进来的数据。函数一出门，它那层元素**当场收走**，又快又干净 —— 但也就没了。

## 谁住在哪一间

| 住哪一间 | 谁住这儿 | 什么时候来 | 什么时候走 | 要自己管吗 |
|---|---|---|---|---|
| 固定储物柜 | 函数外面的变量、`static` 的变量 | 程序一开跑 | 程序结束 | 不用 |
| 动态内存 | `malloc` 要来的那块地方 | 你调用 `malloc` 那刻 | 你调用 `free` 那刻 | **要** |
| 一摞元素 | 函数里的局部变量、传入进来的数据 | 函数进门 | 函数出门 | 不用 |
| 秘籍架 | 翻译好的指令、引号里的字 | 程序一开跑 | 程序结束 | 只读，改不了 |

这张表就是今天的全部家当。往后读别人的代码卡住时，先问一句「这块东西住哪间屋」，一大半的疑问会当场散掉。

## 亲眼看看：固定柜的记性 vs 元素摞的记性

光看表记不住，跑一遍就忘不掉了。我们写了一个小程序：同样叫 `counter` 的两间变量，一间被 `static` 点过名（住固定柜），一间隔壁就是（住元素摞）：

```c
#include <stdio.h>

int g_count = 100;          /* 全局变量：住门口那排固定柜 */

int next_id(void) {
    static int counter = 0; /* static 变量：也住固定柜，只摆一份 */
    counter++;
    return counter;
}

int fickle(void) {
    int counter = 0;        /* 局部变量：住元素摞上，每次进门都是新的 */
    counter++;
    return counter;
}

int main(void) {
    g_count = g_count + 1;
    printf("全局变量 g_count = %d\n", g_count);
    for (int i = 1; i <= 3; i++) {
        int a = next_id();
        int b = fickle();
        printf("第 %d 次：固定柜的 counter = %d，元素摞上的 counter = %d\n", i, a, b);
    }
    return 0;
}
```

```text
全局变量 g_count = 101
第 1 次：固定柜的 counter = 1，元素摞上的 counter = 1
第 2 次：固定柜的 counter = 2，元素摞上的 counter = 1
第 3 次：固定柜的 counter = 3，元素摞上的 counter = 1
```

看出区别了吗？调用了三遍，固定柜里的 `counter` 一路记到 3，而元素摞上的 `counter` 每次都是 1 —— 不是它「忘了」，是那层元素**每次进门都重新摆过一遍**。`static` 这两个字的全部本事，就是把变量从元素摞上搬进固定柜里。

我们把前两趟调用叫拆成一步一步，走给你看（第三趟和它们一模一样）：

```demo
title: 同样叫 counter 的两间变量，一间住元素摞、一间住固定柜
code:
| int g_count = 100;
|
| int next_id(void) {
|     static int counter = 0;
|     counter++;
|     return counter;
| }
|
| int fickle(void) {
|     int counter = 0;
|     counter++;
|     return counter;
| }
|
| g_count = g_count + 1;
| for (int i = 1; i <= 3; i++) {
|     int a = next_id();
|     int b = fickle();
|     printf("第 %d 次：固定柜的 counter = %d，元素摞上的 counter = %d\n", i, a, b);
| }

step 开跑之前：编译器先把固定柜摆好
at: 1
say: 程序还没开跑，**固定柜**就先摆好了：全局变量 `g_count` 住在里头，保存 100；旁边还摆着 `next_id` 里被 `static` 点过名的那间 `counter`，保存 0。**它是程序一开跑就摆好的**，不是等 `next_id` 进门才摆。这会儿元素摞上一层元素都没有。
meow: 全局变量在程序开始前就存在。
pose: expect
元素摞上现在有什么 = （还空着，一趟函数都没进）
固定储物柜里有什么 = g_count 保存 100；next_id 的 static counter 保存 0
有没有欠着没还的 = 没有（这程序一个变量都没租过）

step main 进门，顺手把全局变量加个一
at: 15
say: 轮到 `main` 里的第一句，说明 `main` 已经进门 —— 元素摞上摆出了 `main` 这一层。这句报的名字是 `g_count`，从固定柜取出 100、加 1 得 101，**赋给同一间柜子**：柜子没换，里面的数变了。
meow: main 开始执行，栈上有了 main 这一层。
pose: busy
元素摞上现在有什么 = main 那层（还没有局部变量）
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 0
有没有欠着没还的 = 没有

step 第一圈：`i` 摆到 main 那层元素上
at: 16
say: `for` 第一圈，`i` 这个局部变量摆到**元素摞上 main 那层**，装上 1，眼色成立，进圈。这一层里的东西，`main` 一出门就全收走 —— 只是现在还早。
meow: i 是 1，进入循环。
pose: expect
元素摞上现在有什么 = main 那层：i 保存 1
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 0
有没有欠着没还的 = 没有

step 调用 `next_id`：又摆一层元素，可 counter 不在元素上
at: 17
say: 调用 `next_id()`，元素摞上又摆一层 —— 那是 `next_id` 自己那层。它进门第一眼要看 `static int counter`，可这个变量**不在这一层元素上**：它在固定柜里，就是开跑前摆好的那一间。
meow: 调用 next_id，static 变量已存在。
pose: busy
元素摞上现在有什么 = main 那层：i 保存 1；刚摆下 next_id 那层
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 0（它一直在这儿）
有没有欠着没还的 = 没有

step 加的是固定柜那间：0 变 1
at: 5
say: 因为那间 `counter` 是**原来那一间**、不是新摆的，`counter++` 就是接着它上次的数加一：从 0 变 1。`static` 的全部本事，就在这一步里。
meow: counter 变成 1 并保留。
pose: yay
元素摞上现在有什么 = main 那层：i 保存 1；next_id 那层
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 1
有没有欠着没还的 = 没有

step 返回 1，next_id 出门：那层元素当场收走
at: 17
say: `return counter` 把 1 递给 `main` 的 `a`，`next_id` 出门 —— **它那层元素当场收走**，又快又干净。可固定柜里那间 `counter` 没跟着走：它还保存 1，等下一位进门接着用。
meow: 返回 1，这一层栈帧移除。
pose: busy
元素摞上现在有什么 = main 那层：i 保存 1、a 保存 1
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 1
有没有欠着没还的 = 没有

step 调用 `fickle`：这一层的 counter 是新摆的
at: 18
say: 再调用 `fickle()`，元素摞上又摆出一层全新的。它进门第一句是 `int counter = 0;` —— 这一间 `counter` 就摆在**这一层元素上**，装 0，紧跟着加一变成 1。
meow: fickle 的 counter 每次重新创建。
pose: busy
元素摞上现在有什么 = main 那层：i 保存 1、a 保存 1；fickle 那层：counter 刚摆下装 0，加一变成 1
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 1
有没有欠着没还的 = 没有

step 返回 1，fickle 出门：连 counter 一起收走
at: 18
say: `return counter` 把 1 递给 `b` —— **数字上和 `next_id` 那一趟一模一样**。然后 `fickle` 出门：它那层元素连着 `counter` **一起收走**。这就是为什么下一趟进门，它又是全新的一个 0。
meow: 返回 1，局部变量随后销毁。
pose: busy
元素摞上现在有什么 = main 那层：i 保存 1、a 保存 1、b 保存 1
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 1
有没有欠着没还的 = 没有

step 印出第一行：1 和 1
at: 19
say: `printf` 印出第一行：**第 1 次：固定柜的 counter = 1，元素摞上的 counter = 1**。两个数一模一样 —— 第一趟看不出区别，这正是要再跑一趟的原因。
meow: 第 1 行输出：两边都是 1。
pose: expect
元素摞上现在有什么 = main 那层：i 保存 1、a 保存 1、b 保存 1
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 1
有没有欠着没还的 = 没有

step 第二圈：同一个 `next_id`，这回记得住了
at: 17
say: 收尾把 `i` 加到 2，绕回 `for` 再进一圈，又调用 `next_id()`。新的一层元素摆下又收走，可固定柜里那间 `counter` **记得上一次的 1**，加一得 2。
meow: 第二次调用，static 变成 2。
pose: yay
元素摞上现在有什么 = main 那层：i 保存 2、a 保存 2
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 2
有没有欠着没还的 = 没有

step 第二圈：同一个 `fickle`，可它又是全新的
at: 18
say: 同一个 `fickle` 又进门，但 `counter` 是**这一层新元素上新摆的**一间 —— 跟上一趟那间毫无关系，于是又从 0 加一得 1。同一个写法，两种命。
meow: 局部 counter 又从 0 开始。
pose: busy
元素摞上现在有什么 = main 那层：i 保存 2、a 保存 2、b 保存 1
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 2
有没有欠着没还的 = 没有

step 印出第二行：2 和 1，差别露出来了
at: 19
say: 第二行印出来：**第 2 次：固定柜的 counter = 2，元素摞上的 counter = 1**。差别在这儿露头了 —— 两间变量写着一模一样的 `counter++`，可一间记得住、一间每次都从头开始。
meow: 第 2 行输出：2 和 1。
pose: yay
元素摞上现在有什么 = main 那层：i 保存 2、a 保存 2、b 保存 1
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 2
有没有欠着没还的 = 没有

step 收工：元素摞全清空，固定柜摆到程序结束
at: 16
say: 第 3 圈照样跑一遍（固定柜那间到 3，元素摞上还是 1，和课文 TEXT 第三行对得上）。`i` 加到 4，眼色不成立，圈停了，`main` 出门 —— **元素摞上那几层元素全部收走**，`i`、`a`、`b` 一个不剩；固定柜里那两间一直摆到程序结束。课文那句「谁自动收」，答案全在这最后一步。
meow: 第 3 圈后 i 变成 4，循环结束。
pose: milestone
元素摞上现在有什么 = （main 出门，几层元素全收走，空了）
固定储物柜里有什么 = g_count 保存 101；next_id 的 static counter 保存 3
有没有欠着没还的 = 没有（这程序一间都没租，谈不上还）
```

**这三笔账收好**：函数一进门，元素摞上就摆一层，里面放着它的局部变量和传入进来的数据 —— 函数一出门，那层元素**当场收走**（`fickle` 的 `counter` 每次都重新开始，就是这么来的）；固定柜里的变量**程序一开跑就摆好、一直摆到程序结束**（`next_id` 的 `static counter` 记得住，`g_count` 也从头活到尾）；至于现要现租该变量，**得自己还** —— 这个程序一间都没租，所以第三个格子一直是「没有」。它什么时候会变成「欠着一间」？下一节就演给你看。

## 危险动作：把元素摞上的名称递出去

还记得现要现租那课讲的「名称」吗？名称就是写着变量地址的指针，拿到名称才能找到变量。现在你知道变量分四间了，就能看懂一个特别隐蔽的坑：

```c
int *give_me_a_number(void) {
    int local = 42;   /* 这个变量摆在元素摞上 */
    return &local;    /* 危险：把元素摞上的名称递了出去 */
}
```

`local` 住在元素摞上，函数一出门那层元素就收走了；可这招偏偏把它的名称（`&local`）递了出去。名称看着好好的，名称指的那间变量**早就换主人了**。

我们把这段补上 `main` 真跑了一遍。编译器其实**嘀咕了一句**（原话）：`warning: function returns address of local variable [-Wreturn-local-addr]`。

但它只是**警告**，不是拦路虎：编译照样过，跑起来才当场摔 —— 本机上退出码是 `3221225477`，意思是「踩到了不属于自己的地方」。换个编译器、换个优化档，也可能先印出一个看着挺对的小数字再摔。**这两种结果都不能信**：那间变量已经不归你管了。

这件事比它看起来重要：编译器的**警告就是它把知道的告诉你**，可它不负责拦住你。以后看到 `warning:` 开头的那几行，别当背景音划过去。

## 想让名称活着出门，就租一个变量

把变量从元素摞上搬到现要现租的该变量，同一个函数立刻变得靠得住 —— 只要别忘了还：

```c
#include <stdio.h>
#include <stdlib.h>

int *make_box(int value) {
    int *p = (int *)malloc(sizeof(int));  /* 现租一个变量 */
    if (p == NULL) {
        return NULL;
    }
    *p = value;
    return p;          /* 变量还开着，名称可以放心递出去 */
}

int main(void) {
    int *box = make_box(42);
    if (box == NULL) {
        printf("变量没租到\n");
        return 1;
    }
    printf("盒子里保存 %d\n", *box);
    free(box);
    box = NULL;
    printf("还掉之后，名称也收起来了\n");
    return 0;
}
```

```text
盒子里保存 42
还掉之后，名称也收起来了
```

同样是「函数里造一个变量，把名称递出去」，这一版为什么靠得住？因为这块地方住在**动态内存**该变量，函数出门时它不跟着走。可它也**不会自己消失** —— 所以 `main` 里那句 `free(box)` 一个字都不能省。我们在最后把 `box` 设成空名称，也是这个习惯：还掉的名称别再拿来用。

::: warn 注意
三句话记住今天：**元素摞上的变量，函数一出门就没了**（所以绝不能把它的名称递出去）；**固定柜里的变量从头活到尾**（`static` 的记性就是这么来的，全局变量也是）；**现租的变量要自己还**。C 里一大半「玄学 bug」，根子都是同一句话：「我以为这个变量还归我管。」
:::

::: tip 提示
编译器给你划的四间屋各有各的脾气：**秘籍架**只读、**固定柜**最长久、**租来的变量**最自由也最费心、**元素摞**最勤快（自动来、自动走）。判断一段代码里的东西住在哪，只看两条：它写在函数**里面**还是**外面**，有没有被 `static` 点过名。
:::

## 小任务

给上面那个「固定柜 vs 元素摞」的小程序加一间**全局变量**当计数器（比如叫 `g_total`），每次调用 `next_id` 就给它加一，看看它和 `static` 的 `counter` 是不是一直保持同步；再把 `static` 去掉试试 —— 感受一下「搬变量」这件事有多要紧。
