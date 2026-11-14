---
id: cpp-stage3-14
lang: cpp
stage: 3
order: 18
title: 设计模式
tags: [设计模式, 单例]
required: ["cpp-stage3-13"]
crossRefs: []
estMinutes: 28
keywords: [singleton, factory, observer, virtual]
---

## 学习目标

本课学习设计模式。重点包括单例、工厂、观察者、模式思想。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、全塘只留一个：独苗类定义

```cpp
#include <iostream>
using namespace std;

class FishBowl {
public:
    static FishBowl& getInstance() {
        static FishBowl only;
        return only;
    }
    void add(int n) { count += n; }
    int count = 0;
private:
    FishBowl() = default;
};

int main() {
    FishBowl& a = FishBowl::getInstance();
    a.add(5);
    FishBowl& b = FishBowl::getInstance();
    b.add(3);
    cout << "a 的元素：" << a.count << endl;
    cout << "b 的元素：" << b.count << endl;
    cout << "是不是同一个：" << (&a == &b ? "是" : "不是") << endl;
    return 0;
}
```

```text
a 的元素：8
b 的元素：8
是不是同一个：是
```

我们**调用了两次**「把那口元素拿来」（`getInstance()` 就是调用对象过来的那一次），两次拿到的居然是**同一口元素**里的数：`a.add(5)` 和 `b.add(3)` 加在了一块儿，最后是 `8`。最后一行问的是「**这两个名字是不是同一个对象**」，答案是「是」。

凭什么是同一个？看类定义里那两句：

- 函数里面写的是 `static FishBowl only;` —— `static` 在这儿的意思是「**只造一次，造完就留在原地**」。头一次称呼它的时候造一个，往后每调用一次，拿到的都是那一个。
- 交回来的形状写的是 `FishBowl&`，那个 `&` 的意思是「**把那个对象本身递出去**」。少了它，程序照样编得过 —— 只是每次递出来的都是**另一个长得一模一样的对象**。

那它到底什么时候初始化的？

```cpp
#include <iostream>
using namespace std;

class FishBowl {
public:
    static FishBowl& getInstance() {
        static FishBowl only;
        return only;
    }
private:
    FishBowl() { cout << "（独苗类定义开工，造了一个）" << endl; }
};

int main() {
    cout << "还没称呼它" << endl;
    FishBowl::getInstance();
    cout << "调用了一次" << endl;
    FishBowl::getInstance();
    cout << "又调用了一次" << endl;
    return 0;
}
```

```text
还没称呼它
（独苗类定义开工，造了一个）
调用了一次
又调用了一次
```

「还没称呼它」的时候，那个对象**还没初始化** —— 写在函数里的 `static` 是**头一次称呼它的时候才造**，不是程序一上来就造。后面调用了两次，却只印了一遍「造了一个」：这就是「全塘只留一个」最硬的凭据。

```cpp
#include <iostream>
using namespace std;

class FishBowl {
public:
    static FishBowl& getInstance() {
        static FishBowl only;
        return only;
    }
private:
    FishBowl() = default;
};

int main() {
    FishBowl mine;
    (void)mine;
    return 0;
}
```

编译器当场拦下：

```text
main.cpp:15:14: error: 'constexpr FishBowl::FishBowl()' is private within this context
main.cpp:11:5: note: declared private here
```

念作「**这个的起手式是私房的，你在这儿造不出来**」。起手式写在 `private:` 底下，就只有类定义自己家里碰得到 —— 外面谁想「自己再造一个」都会被拦住，这就把门关上了。

::: warn 注意
**「只造一个」和「只递一个」是两件事。** 类定义里那个对象确实只有一个（`static` 管住了），可要是接货的时候写成 `FishBowl a = ...`（少写那个 `&`），接货的对象**复印一份**带走 —— 程序不报错、不提醒，只是各自捧着各自的元素。我们当年就是这么把账记岔的：明明只有一口元素，两个地方各加各的。
:::

## 二、让类定义去接生

```cpp
#include <iostream>
#include <memory>
#include <string>
using namespace std;

class Cat {
public:
    virtual string speak() const { return "……"; }
    virtual ~Cat() = default;
};

class FishCat : public Cat {
public:
    string speak() const override { return "数据！"; }
};

class BallCat : public Cat {
public:
    string speak() const override { return "毛线球！"; }
};

unique_ptr<Cat> makeCat(const string& kind) {
    if (kind == "fish") return make_unique<FishCat>();
    return make_unique<BallCat>();
}

int main() {
    auto c1 = makeCat("fish");
    auto c2 = makeCat("ball");
    cout << c1->speak() << endl;
    cout << c2->speak() << endl;
    return 0;
}
```

```text
数据！
毛线球！
```

主对象那一句 `makeCat("fish")` 报的只是个**名字**：「给我们来一个数据对象」。至于数据对象怎么造、要带什么，主对象一件都没提 —— 那都是**接生类定义**状态里的活儿：

- 底类定义 `Cat` 写着「对象都该会的那一句」（`speak`），两张岔路类定义 `FishCat` 和 `BallCat` 各自把那一句换成自己的。岔路挂在底类定义上的写法是**继承**：`class FishCat : public Cat`。
- 接生类定义 `makeCat` 里有一条岔路：报 `"fish"` 就接生数据对象；报别的，兜底接生毛线球对象。
- 交回来那个对象装在 `unique_ptr` 里 —— 第六课那口**会自己收尾的箱子**，放对象的事不用我们操心。

它省下的是什么？**「塘里添了新对象」这件事被圈在了一个地方**。以后要加一个会唱歌的对象，我们只在接生类定义里添一条岔路，主对象那边一个字都不用改。

::: warn 注意
底类定义那一句上挂着一块名称 `virtual`，意思是「**这一句各对象各样，走到谁面前就念谁那句**」。名称要是忘了挂 —— 岔路那边也别写 `override` —— 程序照样编得过，一句抱怨都没有；可到了输出的时候，全塘念的都是底类定义那句「……」，我们就傻眼了。这种坑不报错、不提醒，只有一个「看着好像对」的结果。
:::

## 三、处理一调用，各家答应

```cpp
#include <iostream>
#include <functional>
#include <string>
#include <vector>
using namespace std;

class DinnerBell {
public:
    void listen(function<void(const string&)> ear) {
        ears.push_back(ear);
    }
    void ring(const string& what) const {
        for (auto& ear : ears) ear(what);
    }
private:
    vector<function<void(const string&)>> ears;
};

int main() {
    DinnerBell bell;
    bell.listen([](const string& what) { cout << "咪爱听见了：" << what << endl; });
    bell.listen([](const string& what) { cout << "计算机听见了：" << what << endl; });
    bell.ring("处理完成");
    return 0;
}
```

```text
咪爱听见了：处理完成
计算机听见了：处理完成
```

这一手叫**处理喇叭**，三件事：

1. `listen(...)` 是**把一个耳朵登记进名单**。登记的不是对象的名字，而是「听见之后要干什么」那一小段 —— 就是第九课学的那种**随身函数**（`[]{ ... }` 的样子）。
2. `ring("处理完成")` 是**调用输出方法**：照着名单从头到尾调用一遍，登记过的耳朵全听得见。
3. 喇叭**不认识**名单上这些耳朵。它只管调用；听见之后要印字、要记账、还是要装没听见，全是耳朵自己的事。

它省下的是什么？**「以后谁想听、想听几个」被圈在了名单里**。想多一个耳朵，在主对象那儿多 `listen` 一次就好，喇叭那一句半句都不用改。

::: warn 注意
引用的时候得**从头到尾**调用一遍。我们有一回手滑，把 `ring` 里那句写成了只调用名单上第一位 —— 程序编得过、跑得也安静，可名单上第二位那个对象一直没处理上饭，饿了一整天。**「登记了」不等于「调用到了」**，这两件事得分开检查。
:::

## 四、设计模式好在哪

三手动作看着不像一家人，其实干的是**同一件事**：把「以后可能会变的地方」**圈出来，围在一处**。

| 以后可能会变的是…… | 被圈在了哪儿 |
|---|---|
| 塘里添了新对象 | 接生类定义里那条岔路 |
| 谁想听处理 | 喇叭那份名单 |
| 管账的对象该有几个 | 藏起来的那个独苗 |

圈好之后有两个好处：**一是变的时候只动一处**，别的地方不用跟着提心吊胆；**二是说得出名字**，别的对象一听「处理喇叭」就知道你要干什么，不用从头解释一遍。

⚠️ 不过套路**不是越多越好**。我们的工作区里只有三个对象的时候，硬上一套「处理喇叭」反而多绕一层：引用的、听的、名单，三样都得摆在明面上。**先看场面，再挑套路** —— 已有实现对象攒下这些，是给「这个场面又来了」的时候用的，不是见谁都摆一套。

## 一句话对照表

| 想干什么 | 怎么写 |
|---|---|
| 让一个对象全塘只留一个 | 函数里写 `static FishBowl only;` |
| 把那个对象本身递出去 | 交回来的形状写上 `&` |
| 不让外面的对象自己再造一个 | 起手式藏在 `private:` 底下 |
| 让类定义替你挑一个对象来造 | `unique_ptr` 接住 + 一条岔路 |
| 对岔路说「这一句各对象各样」 | 底类定义那一句挂上 `virtual` |
| 登记一个耳朵 | `bell.listen([](const string& what) { ... })` |
| 一输出方法调用遍名单 | `for (auto& ear : ears) ear(what);` |

::: tip 提示

- **三手动作干的是同一件事**：把「以后可能会变的地方」圈出来、围在一处 —— 变的时候只动那一处，而且说得出名字。
- **独苗那张类定义上，两句话各管一头**：函数里的 `static` 管「只造一次」，交回来的形状上那个 `&` 管「把那个对象本身递出去」。
- **「只造一个」和「只递一个」是两件事**：少写那个 `&`，接货的对象就复印一份带走 —— 程序不报错、不提醒，只是各自捧着各自的元素。
- **名称忘了挂（岔路那边也别写 `override`），程序照样编得过**：到了输出的时候全塘念的都是底类定义那一句，这种坑只有一个「看着好像对」的结果。
- **套路不是越多越好**：先看场面，再挑套路。

:::

## 小任务

1. 把第一节的 `add` 换成两处不同的加法，跑一遍看看最后那口元素里的数对不对得上。
2. 把接货那一行写成 `FishBowl a = ...`（少写一个 `&`），看看「是不是同一个」那行印的是什么。
3. 给接生类定义再添一条岔路：报 `"singing"` 就接创建一个会唱歌的对象；报别的还是兜底接生毛线球对象。
4. 给处理喇叭多登记一个耳朵，看看调用输出方法会印出几行 —— 再多登记一个，行数变了没有？

下一课我们要把这一路学来的东西全凑到一块儿：做一个**小图书馆**的管理系统 —— 登记在册、借出去、还回来，再存进记录表里。这一课的三手动作，到时候你会看到它们各自站在哪儿 
