---
id: common-21
lang: common
stage: 0
order: 18
title: 函数抽象与参数化
tags: [函数, 面向对象]
required: ["common-20"]
crossRefs: ["c-stage2-12", "python-stage2-11", "cpp-stage3-05"]
estMinutes: 16
keywords: [abstraction, higher-order-function, function-pointer, lambda, summation]
---

## 学习目标

本课学习函数抽象与参数化。重点包括把最会变的一小截起名字、函数当数据递进去、四位编译器或解释器四种写法、求和只是个名字。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```python
def sum_all(n):
    total = 0
    for i in range(1, n + 1):
        total += i
    return total

def sum_squares(n):
    total = 0
    for i in range(1, n + 1):
        total += i * i
    return total

def sum_doubles(n):
    total = 0
    for i in range(1, n + 1):
        total += i * 2
    return total
```

## 把最会变的那一小截，起个名字

三张纸并排一比，眼睛一眯就能看出来：**真正在变的只有一小截**——「每一项加多少」。那我们把这一小截从纸上抠下来，留成一个**口子**，给它起名 `term`；其余部分原样不动：

```python
def summation(term, n):
    total = 0
    for i in range(1, n + 1):
        total += term(i)
    return total
```

瞧：一样的开头、一样的绕圈、一样的收尾，只有中间那一行换成了 `term(i)`。往后要用哪本账，就把「每一项加多少」**当数据递进这个口子**——它不再钉死在纸上。

这一手有个正式的名字，叫**抽象**。说全了就是一句话：**给重复出现的模式起个名字，把它收成一个方法。**

（书上的正式说法里，函数叫**函数**、递进去的东西叫**参数（参数）**——你在《函数》那课都见过它们。今天不用背，我们继续说「函数」。）

起名字还有一条老规矩：**名字要说得出它干了什么**。`summation` 一看就是「求和」；要是起成 `f2`，过两天我们自己都得盯着猜半天。

## 函数也能当数据递进去

还剩最后一问：函数这种东西，怎么「递」进口子里？记住我们这一句——**报名字，不是引用名称。**

- `square` 是那一个方法的**名字**：它本身就是一样能递来递去的东西；
- `square(3)` 是**当场称呼它一次**：真跑一遍，把 3 的平方 9 返回给你。

我们要递的是名字本身，所以写 `summation(square, 100)`——名字后面**光溜溜的，没有小括号**：

```python
def square(i):
    return i * i

def summation(term, n):
    total = 0
    for i in range(1, n + 1):
        total += term(i)
    return total

print(f"1 到 100 的平方和是 {summation(square, 100)}")
```

```text
1 到 100 的平方和是 338350
```

递进去之后，这一个方法就躺进 `term` 那个口子里等着。圈转到哪一项，`term(i)` 就在那一项上把它调用：递进来的是 `square`，算的就是平方；递进来的是别的函数，记的就是别的账。**同一个方法求和，喂什么函数，就记出什么账。**

Python 还有个更潇洒的写法：**连名字都懒得起，当场现写一个方法**——`lambda i: i * i`，读作「进来一个 `i`，把 `i * i` 交还给你」。演示里最后一幕就是它。

## 四位编译器或解释器，同一件事的四种写法

同一件事：把求和收成一个方法，口子里递 `square`，算出 1 到 100 的平方和。四位编译器或解释器写出来是这样：

```compare
c::
#include <stdio.h>

double square(int i) { return (double)i * i; }

double sum_terms(double (*term)(int), int n) {
    double total = 0;
    for (int i = 1; i <= n; i++) {
        total += term(i);
    }
    return total;
}

int main() {
    printf("1 到 100 的平方和是 %.0f\n", sum_terms(square, 100));
    return 0;
}

cpp::
#include <iostream>
#include <functional>

double square(int i) { return (double)i * i; }

double sum_terms(std::function<double(int)> term, int n) {
    double total = 0;
    for (int i = 1; i <= n; i++) {
        total += term(i);
    }
    return total;
}

int main() {
    std::cout << "1 到 100 的平方和是 " << sum_terms(square, 100) << std::endl;
    return 0;
}

java::
import java.util.function.IntUnaryOperator;

public class Main {
    static int square(int i) { return i * i; }

    static int sumTerms(IntUnaryOperator term, int n) {
        int total = 0;
        for (int i = 1; i <= n; i++) {
            total += term.applyAsInt(i);
        }
        return total;
    }

    public static void main(String[] args) {
        System.out.println("1 到 100 的平方和是 " + sumTerms(Main::square, 100));
    }
}

python::
def square(i):
    return i * i

def summation(term, n):
    total = 0
    for i in range(1, n + 1):
        total += term(i)
    return total

print(f"1 到 100 的平方和是 {summation(square, 100)}")
```

```text
1 到 100 的平方和是 338350
```

四段跑出来一个字都不差——这就是对照块的老规矩。写法上各有各的脾气：

- **C**：`double (*term)(int)` 这串符号凶巴巴的，意思其实很朴素——「一个口子，递进来的东西得是『处理一个整数、吐一个小数』的函数」。今天看懂这一行怎么**用**就够，符号的来龙去脉，C 线后面有整整一课专门讲。
- **C++**：口子的写法换成 `std::function<double(int)>`，比 C 的符号好读得多——本质是同一件事。C++ 线的现成工具里，`sort` 想要什么次序，也是你递进去的函数说了算。
- **Java**：函数得先跟 `IntUnaryOperator` 这个**约定**对表：说好「处理一个整数、吐一个整数」才算数；递的时候写 `Main::square`，意思是「要调用，就调用 Main 里那一个方法」。
- **Python**：函数本身就是能随手递的东西，`summation(square, 100)` 递得干净利落。Python 线后面有专门一课讲 `map`、`filter` 这些现成工具——它们收的，正是你递进去的函数。

## 一步一步看：函数是怎么进圈干活的

把课文里那段 Python 抱出来，我们拆成一步一步走给你看：

```demo
title: 求和那一个方法，怎么干活
code:
| def square(i):
|     return i * i
|
| def summation(term, n):
|     total = 0
|     for i in range(1, n + 1):
|         total += term(i)
|     return total
|
| print(f"1 到 100 的平方和是 {summation(square, 100)}")
| print(f"1 到 100 的和是 {summation(lambda i: i, 100)}")

step 定义函数：square
at: 1
say: 先教电脑一个方法 **square**：进来一个号码，把它的平方交还给你。这会儿它只是「学会了」，还没有谁称呼它。
meow: square 函数定义好了。
pose: expect
函数 square = 会算平方
口子 term = 还空着
账本 total = 还没开
当前这一项 i = 还没轮到
标准输出 = 还空着
返回的 = 还没调用过

step square 的肚量
at: 2
say: 这一行是 square 的肚量：把 `i * i` 交还出来。要是现在调用一次 `square(3)`，返回的就是 9——不过别急，主角在下面。
meow: 传入什么，就返回它的平方。
pose: busy
函数 square = 会算平方
口子 term = 还空着
账本 total = 还没开
当前这一项 i = 还没轮到
标准输出 = 还空着
返回的 = 9（现在就调用 square(3) 的话）

step 定义函数：summation
at: 4
say: 再教一个方法 **summation**（求和）。看它开头的肚量：除了 `n`，口子里还等着一个 `term`——一个专门用来塞函数的口子。
meow: summation 函数也定义好了。
pose: expect
函数 square = 会算平方
口子 term = 还等你递
账本 total = 还没开
当前这一项 i = 还没轮到
标准输出 = 还空着
返回的 = 还没调用过

step 账本归零
at: 5
say: 求和开始干活，先摆出账本 `total = 0`：一条数据都还没记上。
meow: total 从 0 开始。
pose: busy
函数 square = 会算平方
口子 term = 还等你递
账本 total = 0
当前这一项 i = 还没轮到
标准输出 = 还空着
返回的 = 还没调用过

step 圈口：轮到第 1 项
at: 6
say: 圈口报数：从 1 数到 100。现在轮到 `i = 1`——我们拎着 1，去找口子里的函数问一句「这一项该加多少」。
meow: 第一项：i = 1。
pose: busy
函数 square = 会算平方
口子 term = 还等你递
账本 total = 0
当前这一项 i = 1
标准输出 = 还空着
返回的 = 还没调用过

step 调用一次口子里的函数
at: 7
say: 这一行是全场的主角：`term(i)` 把当前这一项传给口子里的函数——口子里现在是 square，它算完，把 1 交还回来。
meow: 把 1 传给 square。
pose: busy
函数 square = 会算平方
口子 term = 它就是 square
账本 total = 0
当前这一项 i = 1
标准输出 = 还空着
返回的 = 1

step 记上第一笔
at: 7
say: 交还的 1 记进账本，`total` 变成 1。下一圈轮到 2 号：square 交还 4，账本变 5——一位一位往下加。
meow: 1 加进 total。
pose: busy
函数 square = 会算平方
口子 term = 它就是 square
账本 total = 1
当前这一项 i = 1
标准输出 = 还空着
返回的 = 1

step 圈一直转到 100
at: 7
say: 转到最后一位：100 号交还 10000，账本从 328350 加到 338350。一百位全算完，圈口放行。
meow: 100 项全部加完。
pose: yay
函数 square = 会算平方
口子 term = 它就是 square
账本 total = 338350
当前这一项 i = 100
标准输出 = 还空着
返回的 = 10000

step 把账本交还
at: 8
say: 干完活，把账本 `total` 交还出去——交还值就是 338350。口子里的 `term` 是谁，从头到尾只由递进来的人说了算。
meow: 返回结果：338350。
pose: proud
函数 square = 会算平方
口子 term = 它就是 square
账本 total = 338350
当前这一项 i = 100
标准输出 = 还空着
返回的 = 10000

step 第一行账报出来
at: 10
say: 屏幕上落下第一行：**1 到 100 的平方和是 338350**。这一本账，就是靠把 square 递进口子记出来的。
meow: 输出平方和：338350。
pose: yay
函数 square = 会算平方
口子 term = 还是 square
账本 total = 338350
当前这一项 i = 100
标准输出 = 1 行：1 到 100 的平方和是 338350
返回的 = 10000

step 换个函数传入
at: 11
say: 最后一句更潇洒：不要 square 了，当场现写一个方法「把 i 原样交还」递进去——**同一个方法一个字没改，账就换了一本**。
meow: 换一个函数，summation 不用改。
pose: milestone
函数 square = 还在（没人称呼它了）
口子 term = 现场现写的函数
账本 total = 5050
当前这一项 i = 100
标准输出 = 2 行：1 到 100 的和是 5050
返回的 = 100
```

注意看最后两步：同一个方法求和一个字没改，只换了递进去的函数，记出的账就从平方和换成了自然数和——**这就是口子的力气。**

## 求和这一个方法，也只是个名字

看到这里你可能觉得：抽象好厉害，那是不是越抽象越厉害？**不是。**我们把话说完整：

- 抽象不是「越高越好」，是「**刚刚好**」。三本账并排看，变的只有「每一项加多少」——那就只给这一小截留口子；别的部分钉死，读的人一眼就懂。
- 抽得再往上一层，名字会越来越多、能看懂的人越来越少。过两天换个场景，可能用得正顺手的那一个方法反而找不着了。
- 而且我们这个 `summation` 本身也只是个名字——它比原来三个方法「高」了那么一小层，就够了。**给最会变的地方留口子，其余部分放心钉死。**

其实这手活儿，老祖宗早就玩过：算圆的周长算不出来，就往圆里塞正多边形，六边形、十二边形……把那套「一圈一圈逼近」的规矩收成一个方法，才传得下来。所以抽象不是新花样，是**从重复里把名字提炼出来**的老手艺。

::: tip 提示
1. **递函数时，名字后面光溜溜**：`summation(square, 100)` 递的是函数**本身**；写成 `square()` 就成了当场称呼它——在递的这一步，调用早了。
2. **口子里的函数，什么时候调用由 `summation` 说了算**：它管着「什么时候调用、拿哪一项去调用」。你只管把函数交到口子上，剩下的它包了。
3. **「抽象」这个大名，今天先混个脸熟**：以后你会听到「抽象屏障」「抽象层」一大堆词——别担心，它们都跟今天这一手沾亲：**把里面的事收进名字里，外面只跟口子打交道**；「抽象屏障」下一课就见面。
:::

::: warn 注意
- **`summation(square(), 100)`**：`square()` 是当场称呼它一次，可 square 还张着嘴等一个号码没喂呢——编译器或解释器先在门口拦下了。递的该是名字本身：`summation(square, 100)`。
- **`summation(9, 100)`**：9 是个数，不是函数。口子里等的是「一个能调用的函数」，你把数递进去，圈里一调用 `term(i)` 就露馅了。
- **口子名不叫 `term` 也照样跑**：`term` 只是我们起的名字，换成 `f`、`item` 都行——名字是给你看的，不是给电脑看的。
:::

## 一句话对照表

| 这一课的新东西 | 一句话记住 |
|---|---|
| **抽象** | 给重复出现的模式起个名字，把它收成一个方法 |
| 求和这一个方法（`summation`） | 把「每一项加多少」抠出来，收进一个口子 |
| 递函数（`summation(square, 100)`） | 报名字，不是引用名称——名字后面光溜溜 |
| 当场现写一个方法（`lambda i: i * i`） | 懒得起名，现舀一勺 |

## 小任务

1. 我们再换一本账：`summation(lambda i: 2 * i, 100)` 算出来是多少？先猜一个数，再跑一遍验证——猜对了吗？
2. 把演示最后一行里的 `lambda i: i` 换成 `lambda i: i * i * i`（立方），跑一遍看看 1 到 100 的立方和是多少。
3. 动手改一改求和那一个方法：给它加一个 `start` 口子，指定「从第几项开始加」——比如只加第 51 到第 100 项。想清楚：哪里要改、哪里一个字都不用动？

下一课，我们要说一句大实话：名字起好之后，就有人忍不住想「顺着名字往里看」——可好名字的本事，恰恰是把里面**遮起来**。去「看不见的墙」看看 
