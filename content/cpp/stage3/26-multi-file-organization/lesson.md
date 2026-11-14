---
id: cpp-stage3-26
lang: cpp
stage: 3
order: 26
title: C++ 类与多文件工程组织
tags: [工具链, 工程组织]
required: ["cpp-stage3-22"]
compare: ["common-35"]
estMinutes: 25
keywords: [multi-file, header, include-guard, inline, forward-declaration]
---

## 学习目标

本课学习C++ 类与多文件工程组织。重点包括声明与实现分居、类头文件的写法、编译多个 .cpp、重复定义与 inline、前置声明。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、一册说明书：`fish.h`

说明书只回答一个问题：**这条鱼长什么样** —— 它有哪些函数、每个函数收什么、还回来什么；状态里有几个格子、每个格子装什么。至于每个函数**具体怎么做**，一行都不写。

```cpp
#ifndef FISH_H
#define FISH_H

class Fish {
public:
    Fish(const char* name, int size);
    int size() const;
    void grow(int delta);

private:
    const char* name_;
    int size_;
};

#endif
```

三个细节，每个都有讲究：

- **开头两句 + 结尾一句是一对门岗。** `#ifndef FISH_H` 先问「`FISH_H` 这个名称挂过了吗」，没挂过才放行，顺手把名称挂上（`#define FISH_H`）；到结尾 `#endif` 收工。这样一来，同一册说明书被抄进来两遍、三遍都没事 —— 第二遍进门时看见名称，整段直接跳过。少了这对门岗，两处抄同一册的源代码就会吵重复定义。
- **每个函数后面只有一个分号，没有花括号的身子** —— 这叫「只报名字」。编译器看到这种行，知道名字和收还的规矩就行，身子在第一行里找。
- **格子（`name_`、`size_`）写清楚了。** 想按这张类定义把鱼造出来，就得知道要预留几格、每格多大，所以它们必须在这个阶段写上。

## 二、一册身子：`fish.cpp`

身子那一册，把每个「怎么做」落地。文件名旁边抄一行说明书：

```cpp
#include "fish.h"

Fish::Fish(const char* name, int size) : name_(name), size_(size) {}

int Fish::size() const {
    return size_;
}

void Fish::grow(int delta) {
    size_ += delta;
}

/* fish.cpp 到此为止——容器里每条鱼的函数，都住在这里 */
```

两处新东西：

- **`#include "fish.h"`** —— 把这册说明书**抄进来**。抄的是一张纸，不是原件：它只在这一份翻译里有意义，谁抄谁得。
- **`Fish::`** 读作「鱼的·」。身子写在类定义外面时，得自报家门 —— 告诉编译器这条身子的正主是哪张类定义，不然它不知道这个 `size` 是给谁写的。后面每一条外面写的身子，都得带上这个前缀。

## 三、摊开：两册拼起来长什么样

分居之后，机器真的还认得吗？我们把两册摊开在同一页上给你看 —— 把说明书的内容直接铺在跟前，身子接在后面，再加一份主稿。这就是一遍跑得动的完整程序：

```cpp
#include <cstdio>

/* ── fish.h 里写的：鱼「长什么样」 ── */
class Fish {
public:
    Fish(const char* name, int size);
    int size() const;
    void grow(int delta);

private:
    const char* name_;
    int size_;
};

/* ── fish.cpp 里写的：鱼「怎么动」 ── */
Fish::Fish(const char* name, int size) : name_(name), size_(size) {}

int Fish::size() const {
    return size_;
}

void Fish::grow(int delta) {
    size_ += delta;
}

/* ── main.cpp 里写的：怎么称呼它干活 ── */
int main() {
    Fish fish("计算机", 24);
    fish.grow(12);
    printf("计算机长到 %d 厘米啦\n", fish.size());
    return 0;
}
```

```text
计算机长到 36 厘米啦
```

计算机从 24 厘米长到了 36 厘米 —— **分居不分家**，机器照样认。这张「摊开来」的样子你要在脑子里留一份：往后任何一份拼起来的东西，都是这个样子。

## 四、手工走一遍流水线

分居以后，从源代码到能跑的程序，中间多了一道工序。先看看主稿那份长什么样：

```text
#include <cstdio>
#include "fish.h"

int main() {
    Fish fish("计算机", 24);
    fish.grow(12);
    printf("计算机长到 %d 厘米啦\n", fish.size());
    return 0;
}
```

主稿只管输出，所以它只需要抄**说明书**那一册（身子是编译器拼装时去找的）。三份源代码放进同一个文件夹，敲这几条：

- 第一条 `-c` 是说「只翻译、先别拼」，产出 `fish.o` —— 一份**半成品**；
- 主稿也先翻成半成品 `main.o`；
- 第三条把几份半成品**拼接**成可执行程序（这一步的行话叫「链接」）；
- 最后一条开跑。

```text
g++ -c fish.cpp
g++ -c main.cpp
g++ -o fish_tank.exe fish.o main.o
./fish_tank.exe
计算机长到 36 厘米啦
```

半成品（`.o`）里装的就是「这一份源代码翻译完的样子」—— 还差最后一步把几份接起来。别嫌这四步麻烦：它们马上会教给你一件大事 —— 改了哪份、只需要重翻哪份，不动的那些不用管。

## 五、同名的函数只能有一条身子

分居带来一个新麻烦。先立最基础的一条规矩：**同一个名字，身子只能有一条**。同一份源代码里写两条，翻译这一步就翻脸：

```cpp
#include <cstdio>

int feed(int times) {
    return times + 1;
}

int feed(int times) {
    return times + 2;
}

int main() {
    printf("喂了 %d 次\n", feed(1));
    return 0;
}
```

```text
main.cpp:7:5: error: redefinition of 'int feed(int)'
    7 | int feed(int times) {
      |     ^~~~
main.cpp:3:5: note: 'int feed(int)' previously defined here
    3 | int feed(int times) {
      |     ^~~~
```

`redefinition` 就是「又定义了一遍」。注意它念的是 `feed` 这个名字 —— **两处都带着身子，它当然要说「你已经教过一遍了」**。这也正是那张说明书不带身子的原因：说明书会被抄进很多份源代码，要是它带着身子，抄两处就成两条身子。

那要是身子**住在两份不同的文件**里呢？各自翻译的时候，谁看谁都合规 —— 只有到最后「拼接」那一步，它们才会撞上面。我们用两份小稿实测给你看：`a.cpp` 里躺着一条 `feed`，`b.cpp` 里又躺着一条同名的，主稿只抄一行名字，然后四步走：

```text
g++ -c a.cpp
g++ -c b.cpp
g++ -c main.cpp
g++ -o prog.exe a.o b.o main.o
```

前三条命令一次不吭 —— 每份半成品自己看自己，都合规；到第四条「拼接」才炸。它念的原话，最末一行是：

```text
collect2.exe: error: ld returned 1 exit status
```

这一行上面还有一行，里面写着 `multiple definition`（重复定义）和两处分子的文件名，开头还带着一长串本机小路 —— 每次跑都不太一样，我们就不整行抄给你了。要记住的是这句大白话：**同一个名字的两条身子，拼的时候只能留一条**。

## 六、`inline`：允许「一对双子」的名称

有时候你**确实**想要同一条函数在多份源代码里各有一条 —— 最常见的情形：把它写进说明书里，谁抄说明书谁就得到一条。这时在函数名字前挂一块 `inline`（内联）名称：

```cpp
#include <cstdio>

inline int fishSizeInCm(int body_mm) {
    return body_mm / 10;
}

int main() {
    printf("%d %d\n", fishSizeInCm(250), fishSizeInCm(360));
    return 0;
}
```

```text
25 36
```

挂了名称的函数，编译器对「好几份里各有一条**一模一样**的身子」睁一个眼闭一个眼 —— 它们算同一条，拼接时不吵了。250 毫米和 360 毫米的鱼，折成 25 厘米和 36 厘米。名称还带个好处：又小又短的函数挂上它，跑起来少一趟来回。

## 七、只报名字的「预告」

分居时还有一种半成品状态：**类定义只报了名字，身子一行还没写**。写在前面的一句 `class Fish;` 就是这种「预告」（也叫**前置声明**）—— 它够用吗？

```cpp
class Fish;

void feed(Fish& fish);

class Aquarium {
public:
    void put(Fish* fish);
    Fish* take();

private:
    Fish* residents_[4];
    int count_ = 0;
};
```

看 `Aquarium`：它状态里摆着「四张拿鱼的指针」（`Fish*`），两条函数收的也是「拿鱼来的指针」或者「借来用的写法」（带 `&` 的那种）。这些地方只需要**知道有 `Fish` 这么个名字**，不需要知道鱼长什么样 —— 所以预告够用。

想更进一步，就不行了。想「创建一个真的鱼」，编译器得按类定义给它留格子；可类定义上除了名字空空如也：

```cpp
#include <cstdio>

class Fish;

int main() {
    Fish fish;
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:6:10: error: aggregate 'Fish fish' has incomplete type and cannot be defined
    6 |     Fish fish;
      |          ^~~~
```

`incomplete type` 用自然语言解释就是「这张类定义我们还没看全」—— 创建一个真鱼要预留格子（鱼多大？几格？），偏偏这些一个字都还没写，它只好停手。所以：**预告只撑得起「拿指针、借来用」的说法；真要造出实体，得有完整说明书。**

## 小任务

1. 把下面这段自己拆开：说明书一册（只报名字）、身子一册、主稿一份，放进文件夹，用这节课的四条命令拼出来跑通。
2. 试试把说明书里那对门岗（`#ifndef` / `#define` / `#endif`）删掉，然后把说明书**抄两遍**进主稿，看看编译器说什么。
3. 回过头把「摊开」那一页的三个部分再对照一遍：哪个部分属于哪册、靠什么被认出。

```cpp
#include <cstdio>

class Fish {
public:
    Fish(const char* name, int size) : name_(name), size_(size) {}
    int size() const { return size_; }

private:
    const char* name_;
    int size_;
};

int main() {
    Fish fish("计算机", 24);
    printf("这条鱼 %d 厘米\n", fish.size());
    return 0;
}
```

## 预告

今天你背熟了四条命令。下次一改源代码，四条又要重来 —— 而且谁记得住哪个文件配哪一步？下一节把这套流水线**写进一张纸**：Makefile 与 CMake，改哪份自动重翻哪份，你只管敲一个字。
