---
id: cpp-stage3-06
lang: cpp
stage: 3
order: 10
title: 智能指针
tags: [内存, 智能指针]
required: ["cpp-stage3-05"]
crossRefs: []
estMinutes: 27
keywords: [unique_ptr, shared_ptr, make_unique, make_shared, move, use_count]
---

## 学习目标

本课学习智能指针。重点包括动态资源与提前返回、unique_ptr 与独占所有权、自动释放与异常路径、禁止复制所有权、move 与所有权转移。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 动态资源与提前返回

使用 new 申请资源后，如果在 delete 之前提前返回或抛出异常，资源可能泄漏。资源生命周期应与明确的对象生命周期关联，不能依赖调用者记住所有退出路径。

```cpp
#include <iostream>
#include <string>
using namespace std;

struct Fish {
    string name;
    Fish(string n) : name(n) { cout << "租下 " << name << endl; }
    ~Fish() { cout << "还回 " << name << endl; }
};

void work(bool early) {
    Fish* p = new Fish("计算机");
    if (early) {
        return;
    }
    cout << "用完 " << p->name << endl;
    delete p;
}

int main() {
    work(false);
    cout << "--- 提前出门那一趟 ---" << endl;
    work(true);
    cout << "收工" << endl;
    return 0;
}
```

```text
租下 计算机
用完 计算机
还回 计算机
--- 提前出门那一趟 ---
租下 计算机
收工
```

## unique_ptr 与独占所有权

unique_ptr 表达独占所有权，在拥有它的对象销毁时释放资源。优先使用 make_unique 创建对象，避免在多个所有者之间重复接管同一原始指针。通过解引用或成员访问操作使用所管理对象。

```cpp
#include <iostream>
#include <memory>
#include <string>
using namespace std;

struct Fish {
    string name;
    Fish(string n) : name(n) { cout << "领到 " << name << endl; }
    ~Fish() { cout << "还回 " << name << endl; }
};

int main() {
    cout << "开门" << endl;
    {
        unique_ptr<Fish> p = make_unique<Fish>("计算机");
        cout << "屋里用 " << p->name << endl;
    }
    cout << "关门" << endl;
    return 0;
}
```

```text
开门
领到 计算机
屋里用 计算机
还回 计算机
关门
```

## 自动释放与异常路径

局部 unique_ptr 离开作用域时会执行析构，即使函数提前返回或通过异常离开，也能按对象生命周期释放资源。这是 RAII 的具体应用，不需要在每条分支重复手动 delete。

```cpp
#include <iostream>
#include <memory>
#include <string>
using namespace std;

struct Fish {
    string name;
    Fish(string n) : name(n) { cout << "租下 " << name << endl; }
    ~Fish() { cout << "还回 " << name << endl; }
};

void work(bool early) {
    unique_ptr<Fish> p = make_unique<Fish>("计算机");
    if (early) {
        return;
    }
    cout << "用完 " << p->name << endl;
}

int main() {
    work(false);
    cout << "--- 提前出门那一趟 ---" << endl;
    work(true);
    cout << "收工" << endl;
    return 0;
}
```

```text
租下 计算机
用完 计算机
还回 计算机
--- 提前出门那一趟 ---
租下 计算机
还回 计算机
收工
```

## 禁止复制所有权

unique_ptr 不支持复制，因为复制两个独占所有者会破坏唯一所有权。示例中的复制错误用于说明类型约束。借用原始指针不等于转移所有权，借用者不得擅自释放资源。

```cpp
#include <iostream>
#include <memory>
using namespace std;

int main() {
    unique_ptr<int> a = make_unique<int>(1);
    unique_ptr<int> b = a;
    cout << *b << endl;
    return 0;
}
```

以下是本节的另一段示例或诊断信息。

```text
main.cpp: In function 'int main()':
main.cpp:7:25: error: use of deleted function 'std::unique_ptr<_Tp, _Dp>::unique_ptr(const std::unique_ptr<_Tp, _Dp>&) [with _Tp = int; _Dp = std::default_delete<int>]'
```

## move 与所有权转移

std::move 允许把 unique_ptr 的所有权转移给另一个 unique_ptr。转移后应检查源指针状态，不再假设它仍拥有原资源。std::move 本身是类型转换，实际转移由相应移动操作完成。

```cpp
#include <iostream>
#include <memory>
using namespace std;

int main() {
    unique_ptr<int> a = make_unique<int>(1);
    unique_ptr<int> b = move(a);
    cout << *b << endl;
    cout << (a == nullptr ? "a 已经空手了" : "a 还拿着") << endl;
    return 0;
}
```

```text
1
a 已经空手了
```

## shared_ptr 与共享所有权

shared_ptr 通过控制块维护共享所有权，最后一个拥有者释放时销毁受管对象。共享并不意味着对象访问自动线程安全；循环强引用可能阻止回收，可按需要使用 weak_ptr。

```cpp
#include <iostream>
#include <memory>
#include <string>
using namespace std;

struct Fish {
    string name;
    Fish(string n) : name(n) { cout << "领到 " << name << endl; }
    ~Fish() { cout << "还回 " << name << endl; }
};

int main() {
    shared_ptr<Fish> a = make_shared<Fish>("计算机");
    {
        shared_ptr<Fish> b = a;
        cout << "两个手都拿着，数=" << a.use_count() << endl;
    }
    cout << "一个手放下了，数=" << a.use_count() << endl;
    return 0;
}
```

```text
领到 计算机
两个手都拿着，数=2
一个手放下了，数=1
还回 计算机
```

以下是本节的另一段示例或诊断信息。

```demo
title: 数人头的那个手：1 涨到 2，掉回 1，减到 0 才还变量
code:
| struct Fish {
|     string name;
|     Fish(string n) : name(n) { cout << "领到 " << name << endl; }
|     ~Fish() { cout << "还回 " << name << endl; }
| };
|
| int main() {
|     shared_ptr<Fish> a = make_shared<Fish>("计算机");
|     {
|         shared_ptr<Fish> b = a;
|         cout << "两个手都拿着，数=" << a.use_count() << endl;
|     }
|     cout << "一个手放下了，数=" << a.use_count() << endl;
| }

step 请名称：租变量 + a 接住，数就是 1
at: 8
say: 第 8 行一次做了两件事：`make_shared<Fish>("计算机")` 先把变量租下来（第 3 行的构造函数印出「领到 计算机」），紧接着 `a` 把名称接住。到这一行末尾，**数已经是 1** —— 有名字指着它了。
meow: make_shared 创建对象，引用计数 1。
pose: expect
a 这颗名称 = 指着计算机那间变量
b 这颗名称 = （还没有 b）
几个手拿着这个变量 = 1
标准输出 = 领到 计算机

step 里屋的门开了：这一行自己不开工
at: 9
say: 第 9 行只是一对大括号的开头 —— 里屋的门开了。**门自己不开工**：数还是 1，变量没动，屏幕上也没多一个字。会干活的是它里面那一行。
meow: 进入内层作用域。
pose: expect
a 这颗名称 = 指着计算机那间变量
b 这颗名称 = （还没有 b）
几个手拿着这个变量 = 1
标准输出 = 领到 计算机

step b = a：数悄悄涨到 2
at: 10
say: 第 10 行 `b = a`。这是 `shared_ptr` 和上一课那块名称最大的不同：**它许你复制**。可复制出来的不是第二间变量，是**第二只手抓住同一间** —— 数在这一步从 1 涨到 2，我们一个字都没写，是名称自己记的账。
meow: 复制 shared_ptr，计数变成 2。
pose: busy
a 这颗名称 = 指着计算机那间变量
b 这颗名称 = 也指着同一名称
几个手拿着这个变量 = 2
标准输出 = 领到 计算机

step 印出来对账：数 = 2
at: 11
say: 第 11 行把数印出来，得到 `2` —— 这就是课文那句「刚请来是 1，`b = a` 之后变 2」的现场。这个数不用谁去加，名称替你记着。
meow: 输出计数 2。
pose: yay
a 这颗名称 = 指着计算机那间变量
b 这颗名称 = 也指着同一名称
几个手拿着这个变量 = 2
标准输出 = 领到 计算机 / 两个手都拿着，数=2

step 里屋关门：b 走了，数掉回 1
at: 12
say: 第 12 行那个 `}` 是里屋的门关上 —— `b` 住里屋，它到这一刻就走了，手里那颗名称松开。数从 2 **掉回 1**。要紧的是：**变量这时候还没还**，因为 `a` 那个手还抓着。
meow: b 离开作用域，计数回到 1。
pose: expect
a 这颗名称 = 指着计算机那间变量
b 这颗名称 = （已经走了）
几个手拿着这个变量 = 1
标准输出 = 领到 计算机 / 两个手都拿着，数=2

step 再印一次：数 = 1，变量还在
at: 13
say: 第 13 行印出 `1`。屏幕上到这儿一共两行数，一「2」一「1」—— 变量**一次都没还**，因为数还没走到 0。这就是课文说的「这时候变量还没还」。
meow: 输出计数 1，对象还在。
pose: yay
a 这颗名称 = 指着计算机那间变量
b 这颗名称 = （已经走了）
几个手拿着这个变量 = 1
标准输出 = 领到 计算机 / 两个手都拿着，数=2 / 一个手放下了，数=1

step 最后一根手松开：数落到 0
at: 14
say: 第 14 行是 `main` 的收尾大括号，`a` 也住到头了 —— 最后一根手松开，数从 1 落到 **0**。到这一刻为止，屏幕上还是那三行，什么都还没发生。
meow: a 离开作用域，计数变成 0。
pose: think
a 这颗名称 = （也走了，手里空了）
b 这颗名称 = （已经走了）
几个手拿着这个变量 = 0
标准输出 = 领到 计算机 / 两个手都拿着，数=2 / 一个手放下了，数=1

step 数一到 0：析构函数当场自己跑
at: 14
say: **数一到 0，析构函数当场自己跑**：第 4 行的 `~Fish()` 印出「还回 计算机」，变量这才被返回。我们从开头到结尾**没写过一句「该还了」** —— 减到 0 自动收，这就是它。
meow: 析构函数自动执行，释放对象。
pose: proud
a 这颗名称 = （也走了，手里空了）
b 这颗名称 = （已经走了）
几个手拿着这个变量 = 0（变量已还）
标准输出 = 领到 计算机 / 两个手都拿着，数=2 / 一个手放下了，数=1 / 还回 计算机
```

## 所有权模型对照

原始指针表达地址但不单独说明所有权。unique_ptr 用于独占，shared_ptr 用于共享，weak_ptr 用于不延长生命周期的观察。选择模型时先明确谁负责资源及其生命周期。



## 练习

把一个存在提前返回路径的 new/delete 示例改为 unique_ptr。再用 move 转移所有权，比较转移前后两个智能指针的状态。
