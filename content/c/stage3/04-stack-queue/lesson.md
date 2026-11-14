---
id: c-stage3-04
lang: c
stage: 3
order: 5
title: 栈与队列：后进先出与先进先出
tags: [数据结构, 栈, 队列]
required: [c-stage3-03]
crossRefs: []
estMinutes: 20
keywords: [push, pop, top, enqueue, dequeue]
---

## 学习目标

本课学习栈与队列：后进先出与先进先出。重点包括栈操作、队列操作、数组实现。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、一摞元素：最后进来的最先出去

关键词是「**最后进去的最先出来**」。我们用一排贴了编号的数组元素当底座（地方一开始就摆好，我们只记「用到哪儿了」），再配两招：放一个元素上去、从最上面拿走一个。

```c
#include <stdio.h>

#define MAX_BOWLS 5

int bowls[MAX_BOWLS];   /* 一排 5 只元素当底座 */
int top = 0;            /* 已经摞了几个元素 */

int is_empty(void) { return top == 0; }
int is_full(void) { return top == MAX_BOWLS; }

int push(int value) {
    if (is_full()) {
        return 0;
    }
    bowls[top] = value;
    top++;
    return 1;
}

int pop(int *value) {
    if (is_empty()) {
        return 0;
    }
    top--;
    *value = bowls[top];
    return 1;
}

int main(void) {
    push(1);
    push(2);
    push(3);
    int v = 0;
    while (pop(&v)) {
        printf("取到 %d\n", v);
    }
    printf("空了吗？%s\n", is_empty() ? "空了" : "还有");
    return 0;
}
```

```text
取到 3
取到 2
取到 1
空了吗？空了
```

放进去的顺序是 1、2、3，拿出来的顺序却是 3、2、1 —— 这就是「最后进去的最先出来」。诀窍全在那个 `top`：它既是「已经摞了几个」，也正好是「下一个元素该放在哪儿」。

- 放一个元素：`bowls[top] = value;` 放好之后 `top++`，元素摞长高一层。
- 拿一个元素：先 `top--` 退到「最上面那个」的位置，再把它读取（`*value = bowls[top];`）。

注意 `push` 和 `pop` 都**先问边界**：满了（`top == MAX_BOWLS`）就放不下，空了（`top == 0`）就拿不出。这两句话看着啰嗦，可省掉它们的代价是「元素摞塌了」：继续往满元素摞上放，会踩到不属于自己的地方；从空元素摞上拿，会读到一堆莫名其妙的数字。

放进去的是 1、2、3，拿出来的却是 3、2、1 —— 这件事光看输出想不明白。下面把 `top` 和元素摞**每一步都摆出来**，盯着 `top` 那一栏：它既是「已经摞了几个」，也正好是「下一个元素该放在哪儿」。

```demo
title: 放进去 1 2 3，为什么拿出来是 3 2 1
code:
| push(1);
| push(2);
| push(3);
| int v = 0;
| while (pop(&v)) {
|     printf("取到 %d\n", v);
| }

step 一开始：元素摞是空的
at: 1
say: 底座早就摆好了（bowls[0] 到 bowls[4] 五格），可一个元素都还没摞上去。top = 0，意思是「已经摞了 0 只」，也正好指着第 0 格。
meow: 栈是空的，top 是 0。
pose: expect
top = 0
元素摞 = (空的)
刚取到 = 还没取
印出来 = (还没印)

step push(1)：放进第一个
at: 1
say: 函数里做两件事：bowls[top] = 1 把元素放进 top 指的那一格，然后 top++ 摞高一层。放的是第 0 格，放完 top 变成 1。
meow: 1 入栈，top 变成 1。
pose: yay
top = 1
元素摞 = 最下面第 0 格是 1
刚取到 = 还没取
印出来 = (还没印)

step push(2)：摞在它上面
at: 2
say: 现在 top 是 1，所以 2 放在 bowls[1] —— 正好压在 1 上面。放完 top++ 变成 2。
meow: 2 入栈，top 变成 2。
pose: yay
top = 2
元素摞 = 第 0 格 1 · 第 1 格 2
刚取到 = 还没取
印出来 = (还没印)

step push(3)：摞到最上面
at: 3
say: top 是 2，3 放在 bowls[2]。放完 top 变成 3。到这一步，三个元素从下到上是 1、2、3。
meow: 3 入栈，top 变成 3。
pose: yay
top = 3
元素摞 = 第 0 格 1 · 第 1 格 2 · 第 2 格 3
刚取到 = 还没取
印出来 = (还没印)

step 备一个元素等着接数据
at: 4
say: int v = 0; 准备一个空元素。等一下 pop 会把读取的那个元素里的数放进你本人的 v 里 —— 所以传进去的是 &v 这块名称（还记得地址那一课）。
meow: v 用来接收出栈的值。
pose: busy
top = 3
元素摞 = 第 0 格 1 · 第 1 格 2 · 第 2 格 3
刚取到 = 还没取
印出来 = (还没印)

step 第 1 步
at: 5
say: while 拿 pop(&v) 的返回值当条件。pop 第一件事是问 is_empty()：top 是 3，不空，可以拿。
meow: 栈不空，可以出栈。
pose: think
top = 3
元素摞 = 第 0 格 1 · 第 1 格 2 · 第 2 格 3
刚取到 = 还没取
印出来 = (还没印)

step 第 1 步
at: 5
say: 先 top-- 从 3 退到 2（退到「最上面那个」的位置），再 *value = bowls[top] 把它读取。最后放上去的 3，最先被取走。
meow: top 退到 2，取出 3。
pose: yay
top = 2
元素摞 = 第 0 格 1 · 第 1 格 2 · 第 2 格 3（第 2 格这个已经被取走）
刚取到 = 3
印出来 = (还没印)

step 印「取到 3」
at: 6
say: v 里现在是 3，所以印的是「取到 3」。printf 印完回到 while，再问一次条件。
meow: 输出 3。
pose: busy
top = 2
元素摞 = 第 0 格 1 · 第 1 格 2
刚取到 = 3
印出来 = 取到 3

step 第 2 步
at: 5
say: top 是 2，不空。top-- 退到 1，返回出 bowls[1] 里的 2。轮到第二只上去的了。
meow: top 退到 1，取出 2。
pose: yay
top = 1
元素摞 = 第 0 格 1 · 第 1 格 2（第 1 格这个已经被取走）
刚取到 = 2
印出来 = 取到 3

step 印「取到 2」
at: 6
say: 第二行输出。看到没有：放进去的顺序是 1、2、3，出来的顺序是 3、2 —— 正好倒过来。
meow: 输出 2，顺序和入栈相反。
pose: busy
top = 1
元素摞 = 第 0 格 1
刚取到 = 2
印出来 = 取到 3、取到 2

step 第 3 步
at: 5
say: top 是 1，还是不空。top-- 退到 0，返回出 bowls[0] 里的 1 —— 最早放进去的那个，最后才出来。
meow: top 退到 0，取出 1。
pose: yay
top = 0
元素摞 = 第 0 格 1（这个已经被取走）
刚取到 = 1
印出来 = 取到 3、取到 2

step 印「取到 1」
at: 6
say: 第三行输出。三个元素全出来了，top 回到 0。
meow: 输出 1，栈已空。
pose: busy
top = 0
元素摞 = (空的)
刚取到 = 1
印出来 = 取到 3、取到 2、取到 1

step 第 4 步
at: 5
say: 再回到 while 问一次：pop 先问 is_empty()，top 是 0 —— 空了。它不返回东西，直接返回 0，while 条件不成立，循环收工。
meow: 栈空，pop 返回 0，循环结束。
pose: proud
top = 0
元素摞 = (空的)
刚取到 = 1
印出来 = 取到 3、取到 2、取到 1
最后一句 = 空了吗？空了
```

::: warn 空的时候「不返回东西」和「读取是空」是两件事
上面第 13 步里，`pop` 遇到空元素摞**一个字都没往 `v` 里写**，只是返回了 0。
要是它不问边界、硬往下 `top--`，`top` 会变成 -1，然后按 `bowls[-1]` 去找那个元素 ——
C 不会拦你，它会摸到元素排外面的一格，读到一堆莫名其妙的数字。
`is_empty()` 那两句看着啰嗦，拦的就是这个。
:::

## 二、一条队伍：最先来的最先出去

队伍的关键词正好相反：「**最先进去的最先出来**」。这次要记**两个**位置：队头在哪儿（谁先来的）、下一个空位在哪儿（新来的站哪儿）。

```c
#include <stdio.h>

#define MAX_CATS 5

int line[MAX_CATS];
int head = 0;   /* 队头在哪儿 */
int tail = 0;   /* 下一个空位在哪儿 */

int is_empty(void) { return head == tail; }
int is_full(void) { return tail == MAX_CATS; }

int enqueue(int value) {
    if (is_full()) {
        return 0;
    }
    line[tail] = value;
    tail++;
    return 1;
}

int dequeue(int *value) {
    if (is_empty()) {
        return 0;
    }
    *value = line[head];
    head++;
    return 1;
}

int main(void) {
    enqueue(10);
    enqueue(20);
    enqueue(30);
    int v = 0;
    while (dequeue(&v)) {
        printf("领到 %d\n", v);
    }
    printf("队空了吗？%s，可 head 已经走到 %d\n", is_empty() ? "空了" : "还有", head);
    return 0;
}
```

```text
领到 10
领到 20
领到 30
队空了吗？空了，可 head 已经走到 3
```

进队的顺序是 10、20、30，出来的顺序也是 10、20、30 —— 先来的先领到。这里两个下标各有分工：

- `tail` 负责**接客**：新来的站在 `line[tail]`，站好之后 `tail++`，指向下一个空位。
- `head` 负责**送客**：队头那位先领走（`*value = line[head];`），然后 `head++`，指向队伍里新的第一位。

怎么知道队伍空了？`head == tail` —— 接客的和送客的走到同一个地方，说明中间的对象都领完了。

::: warn 注意
队伍这个写法有个小毛病，值得你现在就看到：**`head` 只会往前走，前面空出来的格子再也回不来。** 上面那个程序跑完之后，三个对象都领完了，`head` 已经走到 3，可前三个格子明明空着 —— 要是再排两个对象进来，`tail` 就到 5 了，新来的对象会被判「满了」，而它面前还空着三格呢。这个现象叫「假满」—— 我们先透一句：把这一排元素在脑子里接成一个圈（走到头就绕回 0），这个坑就填上了，有兴趣可以自己先试试。
:::

::: tip 提示
两样法宝的规矩，一句话就能分清：**一摞元素**只记一个 `top`，**最后放上去的最先被拿走**；**一条队伍**记 `head` 和 `tail` 两个下标，**最先来的最先被伺候**。两样都靠一排现成的元素当底座，动手之前都必须先问一句「空了吗 / 满了吗」—— 边界没问清，越界就在门口等着你。
:::

## 小任务

给元素摞加一个方法 `peek`：只看一眼**最上面那个元素里装的什么**，但不把它拿走（提示：它和 `pop` 一样要看 `top`，区别是**不许动 `top`**）。加好之后，在 `main` 里先 `push` 三个元素、`peek` 一次、再 `pop` 一次，看看顺序对不对。
