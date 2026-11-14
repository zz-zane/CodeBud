---
id: cpp-stage2-05
lang: cpp
stage: 2
order: 5
title: 静态成员
tags: [面向对象, 静态成员, 共享数据]
required: ["cpp-stage2-04"]
crossRefs: []
compare: ["common-10"]
estMinutes: 23
keywords: [static, shared, counter]
---

## 学习目标

本课学习静态成员。重点包括static 成员变量、static 成员函数、使用场景。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、共用的一份：`static` 格子

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    static int count;
    string name;

    Cat(string n) : name(n) {
        count = count + 1;
    }
};

int Cat::count = 0;

int main() {
    Cat a("张三");
    Cat b("李四");
    Cat c("王五");
    cout << "一共初始化了 " << Cat::count << " 只" << endl;
    return 0;
}
```

```text
一共初始化了 3 只
```

这段里有三处要拿记录表抄下来：

1. **类定义里**：`static int count;` —— 前面那个 `static` 是宣告「这一格**整张类定义共用**」，不属于任何一个对象。
2. **类定义外面**：`int Cat::count = 0;` —— 多出来的这一行，是给这份共用的格子**落地**、顺便给它一个起步的数。（为什么不能少，下一节专门说。）
3. **构造函数里**：`count = count + 1;` —— 每创建一个对象都去**同一个**格子上加一。生三个，加三次，所以是 `3`。

念法上，`Cat::count` 念作「**`Cat` 这张类定义上的 `count`**」—— 和上一课写在类定义外面的函数名前面那个 `Cat::` 是同一个暗号。

::: tip 提示
**共用的那一份，一律用类定义名去念**（`Cat::count`）。写下 `Cat::` 这四个字符，读的人一眼就知道「这不是某个对象自己的东西」—— 这条规矩能帮你省下很多想不明白的工夫。
:::

## 二、它真的只有一份

「共用」这两个字得亲手验一次才踏实。下面这段是**故意使坏**：我们拿一个对象去改那个数，然后看看另外两位怎么看。

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    static int count;
    string name;

    Cat(string n) : name(n) {
        count = count + 1;
    }
};

int Cat::count = 0;

int main() {
    Cat a("张三");
    Cat b("李四");
    a.count = 100;
    cout << Cat::count << " " << b.count << endl;
    return 0;
}
```

```text
100 100
```

我们只写了 `a.count = 100;`，可印出来的是 `100 100` —— `b` 那一侧也变了。

**因为它压根不是 `a` 的东西**：`a.count`、`b.count`、`Cat::count` 三种写法指的是**同一份**，一共就这一格。我们拿最啰嗦的那档念叨（`-Wall`）真跑过一遍：编得过、跑得动、**编译器一个字都没说** —— 它不拦这种写法，也不会提醒你「你改的是共用的那一份」。

所以我们给自己立一条规矩：**共用的那份只写 `Cat::count`**。`a.count` 这种念法编译器认，但它会让读代码的人（包括三天后的你自己）以为这是 `a` 自己的一格。

这三个对象是怎么共用一个格子的，我们拆成一步一步走给你看：

```demo
title: 三个对象加的是同一格 —— 改一个，另外两个一起变
code:
| class Cat {
| public:
|     static int count;
|     string name;
|     Cat(string n) : name(n) { count = count + 1; }
| };
| int Cat::count = 0;
| Cat a("张三");
| Cat b("李四");
| Cat c("王五");
| a.count = 100;
| cout << Cat::count << " " << b.count << endl;

step 类定义里先报一格共用的
at: 3
say: `static int count;` 是**报名字**：类定义上有这么一格，它是**整张类定义共用**的 —— 不属于任何一个对象。这一刻它还没落地，就像类定义上画了一个空格子，实物还没有。
meow: count 由所有对象共享。
pose: expect
类定义上那格 count = 还没落地
张三那格的 name = （还没生）
李四那格的 name = （还没生）

step 名字前面没有 static：每个对象各一格
at: 4
say: `string name;` 前面**没有** `static` —— 那它就是**每个对象各有一格**：这个那格装「张三」，那个那格装「李四」，互不相干。这种格子跟着实例一起被造出来，不用在类定义外面再写一行。
meow: name 每个对象各有一份。
pose: expect
类定义上那格 count = 还没落地
张三那格的 name = （还没生）
李四那格的 name = （还没生）

step 构造函数里加的是那唯一的一格
at: 5
say: 第 5 行那句 `count = count + 1;` 是**构造函数**里的活儿，只有创建对象的时候才跑。它加的是 `count` —— 类定义上**那唯一的一格**，不是「自己那一格」。此刻一个对象都还没生，它一次都还没跑过。
meow: 构造函数每次把 count 加 1。
pose: busy
类定义上那格 count = 还没落地
张三那格的 name = （还没生）
李四那格的 name = （还没生）

step 类定义外面给它落地，起步是 0
at: 7
say: `int Cat::count = 0;` 写在类定义**外面**，是亲手给这格落地、顺便给个起步的数。**注意：写完它 count 还是 0** —— 构造函数一次都还没跑，一个对象都还没生呢。
meow: 类外定义 count，初值 0。
pose: busy
类定义上那格 count = 0
张三那格的 name = （还没生）
李四那格的 name = （还没生）

step 生张三：共用的那格变成 1
at: 8
say: 第 8 行创建第一个对象。构造函数跑到那句加一 —— 加的是**那唯一的一格**：0 变 1。同时 `name` 那格装进「张三」，**那一格是张三自己的**。
meow: 创建 a，count 变成 1。
pose: yay
类定义上那格 count = 1
张三那格的 name = 张三
李四那格的 name = （还没生）

step 生李四：还是那同一格，变成 2
at: 9
say: 第 9 行生第二只。构造函数加的**还是那一格**：1 变 2。所以张三那边看到的也已经是 **2** 了 —— 它俩看的是同一格，不是各看各的。
meow: 创建 b，count 变成 2。
pose: yay
类定义上那格 count = 2
张三那格的 name = 张三
李四那格的 name = 李四

step 生王五：那格变成 3
at: 10
say: 第 10 行生第三个，加的还是那一格：2 变 3。三个对象各有一格 `name`（三个名字互不相干，王五那格保存的是「王五」），可 `count` 从头到尾就这**一格**。
meow: 创建 c，count 变成 3。
pose: yay
类定义上那格 count = 3
张三那格的 name = 张三
李四那格的 name = 李四

step 只写了 a. ，改的却是共用那一格
at: 11
say: `a.count = 100;` —— 写的是 `a.`，可 `a.count` 指的**根本不是 `a` 自己的一格**：它指的就是那唯一的一格。3 一下子变成 100。这一刻 `b`、`c` 那边**还没开口问**，可它们看到的值已经是 100 了。
meow: a.count 也是同一个静态成员。
pose: think
类定义上那格 count = 100
张三那格的 name = 张三
李四那格的 name = 李四

step 两种念法，印出来是同一个数
at: 12
say: `cout` 里一个是 `Cat::count`、一个是 `b.count` —— 两种不同的念法，走的是**同一格**。所以印出来是 `100 100`，不是 `100 3`。名字那种每个各一格的东西正好相反：改张三那格，李四那边一个字都不会动。
meow: 两种写法访问的是同一个变量。
pose: proud
类定义上那格 count = 100
张三那格的 name = 张三
李四那格的 name = 李四
```

**记住这一条就不会再绕晕**：`static` 那一格**从头到尾只有一份** —— 三个对象加的是它、看的也是它，所以改一个，另外两个一起变；`name` 那种「每个各有一格」的东西正好相反，改张三的，李四那边一个字都不会动。

## 三、类定义外面还得再写一行

类定义里那句 `static int count;` **只是报个名字**：有这么一格、它是整张类定义共用的。可它**没有落地** —— 它不像每个对象自己那两格，跟着实例一起被造出来。

共用的格子必须**在类定义外面单独写一行**，亲手给它一个起步的数 —— 就是那个 `int Cat::count = 0;`：格子名前面挂上类定义名，后面写 `= 0` 给它一个起步的数。少了这一行会怎样？我们把上面第一节那段里的这一行抽掉，真跑了一次：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    static int count;
    string name;

    Cat(string n) : name(n) {
        count = count + 1;
    }
};

int main() {
    Cat a("张三");
    Cat b("李四");
    cout << "一共初始化了 " << Cat::count << " 只" << endl;
    return 0;
}
```

编译器的原话，最末一行是：

```text
collect2.exe: error: ld returned 1 exit status
```

这一行上面还有一行，里面写着 `undefined reference` 和 `Cat::count`（那一行开头是一长串临时小路，每次跑都不一样，我们就不整行抄给你了）。意思很直白：**「`count` 这个名字我们认得，可它落地的地方没找着。」**

注意这个错**来得特别晚**：前面每一句都被逐句看过了、都说没问题，直到**把所有零件拼起来那一刻**才炸。原话里那个 `ld` 就是干拼装这活的工具。

所以往后看到 `collect2.exe: error: ld returned 1 exit status`，先回头数一数：是不是有个 `static` 格子忘了在类定义外面写那一行。

## 四、`static` 函数：没有「我们自己」的函数

有些活**不需要哪个对象也能干** —— 比如「报一报一共初始化了几个」。这种活就该写成 `static` 函数：前面加 `static`，称呼它的时候不需要先有一个对象。

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    static int count;
    string name;

    Cat(string n) : name(n) {
        count = count + 1;
    }

    static int howMany() {
        return count;
    }
};

int Cat::count = 0;

int main() {
    Cat a("张三");
    Cat b("李四");
    cout << "一共有 " << Cat::howMany() << " 只" << endl;
    return 0;
}
```

```text
一共有 2 只
```

注意两件事：

- 称呼它的时候，名字前面挂的是**类定义名**：`Cat::howMany()`。这件事不属于任何一个对象，所以从类定义上调用最自然。
- 它状态里碰的是 `count`（共用的那一份）—— 完全没问题。

可要是它去碰**某个对象自己那一格**呢？编译器当场拦下：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    static int count;
    string name;

    Cat(string n) : name(n) {
        count = count + 1;
    }

    static int howMany() {
        return name.size();
    }
};

int Cat::count = 0;

int main() {
    Cat a("张三");
    cout << Cat::howMany() << endl;
    return 0;
}
```

```text
main.cpp:15:16: error: invalid use of member 'Cat::name' in static member function
main.cpp:8:12: note: declared here
```

念作：**「`name` 是每个对象自己的一份，可你现在站的是 `static` 函数 —— 称呼它的时候没有对象站在旁边，你要用的是哪个对象的 `name`？」**

`this` 也是同一个道理。上一课说过，`this` 就是「调用这一个方法的那个对象」；可 `static` 函数是挂在类定义上的，称呼它的时候手里**根本没有对象**：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    static int count;

    Cat() {
        count = count + 1;
    }

    static int howMany() {
        return this->count;
    }
};

int Cat::count = 0;

int main() {
    Cat a;
    Cat b;
    cout << "一共初始化了 " << Cat::howMany() << " 只" << endl;
    return 0;
}
```

```text
main.cpp:14:16: error: 'this' is unavailable for static member functions
```

念作：**「`static` 函数里没有『我们自己』这个东西 —— `this` 在这儿是空的。」**

一句话记住：**`static` 函数里，共用的格子随便碰，每个对象自己的格子一个都不能碰**（`this` 就更不能写）。

## 五、什么时候该请出 `static`

我们把判断法子缩成两句话：

- **只跟「类定义」有关、跟具体哪个对象无关的事** → 请 `static` 出来。比如：一共初始化了几个、一共收了多少条、这张类定义的共用上限；
- **所有对象都该看同一份、改一处立刻全体可见的值** → 也请 `static`。比如全体共用的上限、总开关。

反过来，**每个对象各有一份**的东西（名字、这个对象自己的条数）就绝对不该加 `static` —— 加了它，三个对象的名字会互相覆盖，只剩下最后生的那一个。

## 六、我们今天记住的三句话

::: tip 提示
1. **`static` 格子属于类定义，不属于对象**：一共只有一份，所以一律念 `Cat::count` 这种写法，别写 `b.count`。
2. **它必须在类定义外面再写一行**：`int Cat::count = 0;` —— 少了这一行，**拼装的时候**才报错，原话末尾是 `collect2.exe: error: ld returned 1 exit status`（那是拼装阶段，不是逐句看的那一关）。
3. **`static` 函数里没有「我们自己」**：共用的格子随便碰，每个对象自己的格子一个都不能碰，`this` 也用不了；称呼它写成 `Cat::howMany()`。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `static int count;`（类定义里） | 报个名字：有这么一格**整张类定义共用**的东西 |
| `int Cat::count = 0;`（类定义外面） | 给它落地、给个起步的数 —— **这一行不能少** |
| `Cat::count` | 「`Cat` 这张类定义上的 `count`」，一共只有一份 |
| `a.count = 100;` | 编译器认这种写法，可改的还是**那同一份** —— 不是 `a` 自己的一格 |
| `static int howMany() { return count; }` | 挂在类定义上的函数：碰共用的格子没问题 |
| `Cat::howMany()` | 称呼它的写法（称呼它不需要对象） |
| `return name.size();`（在 `static` 函数里） | 挨拦：`invalid use of member 'Cat::name' in static member function` |
| `this->count`（在 `static` 函数里） | 挨拦：`'this' is unavailable for static member functions` |

## 小任务

1. 把第一节那段里的 `Cat::count` 换成 `a.count`，真跑一次看看结果变不变；再把 `a.count = 100;` 那一手自己试一遍，看看另外一个对象是不是也「看见」了。
2. 给类定义加一格共用的 `static int total;`，在构造函数里把这个对象的条数加进去；再写一个 `static int getTotal()` 把它返回。**别忘了类定义外面那一行。**
3. 把第三节那段里类定义外面那行 `int Cat::count = 0;` 删掉，真跑一次，把编译器的原话抄进记录表 —— 重点是记下**它是什么时候**报的错（是逐句看的那一关，还是拼装那一刻）。
4. 试着在 `static` 函数里加一句 `name = "子对象";`，真跑一次，看看编译器说什么。这一条就是为了让你记住：`static` 函数里碰「每个对象自己的格子」是**编不过**的。
5. 把 `howMany()` 前面那个 `static` 去掉，别的都别动，真跑一次 —— 它应该照样跑得通（构造函数早就在碰 `count` 了）。想一想为什么：共用的那一份，本来就是谁都能碰的。

下一课，我们要让**写在类定义外面的函数**也能看类定义里盖上盖子的格子 —— 不过这不是随便谁都行的：得类定义自己亲口答应一次，说「它是我朋友」。去下一课探险 
