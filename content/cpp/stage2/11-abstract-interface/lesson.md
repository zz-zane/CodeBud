---
id: cpp-stage2-11
lang: cpp
stage: 2
order: 11
title: 抽象类与接口
tags: [面向对象, 抽象类, 纯虚函数]
required: ["cpp-stage2-10"]
crossRefs: []
estMinutes: 26
keywords: [pure virtual, abstract class, interface, override]
---

## 学习目标

本课学习抽象类与接口。重点包括纯虚函数、抽象类、接口思想。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```cpp
#include <iostream>
#include <string>
using namespace std;

class Animal {
protected:
    string name;
public:
    Animal(string n) : name(n) {}
    virtual void speak() const = 0;
    void showName() const {
        cout << "我们叫 " << name << endl;
    }
};

class Cat : public Animal {
public:
    Cat(string n) : Animal(n) {}
    void speak() const override {
        cout << name << "：" << endl;
    }
};

int main() {
    Cat c("张三");
    c.showName();
    c.speak();
    return 0;
}
```

```text
我们叫 张三
张三：
```

```cpp
virtual void speak() const = 0;
```

## 一、有这种招牌的类定义，生不出真身

我们试过一个最自然的问题：既然 `Animal` 是张类定义，那我们**直接照它创建一个动物**行不行？

```cpp
#include <iostream>
#include <string>
using namespace std;

class Animal {
protected:
    string name;
public:
    Animal(string n) : name(n) {}
    virtual void speak() const = 0;
};

int main() {
    Animal a("谁");
    a.speak();
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:14:12: error: cannot declare variable 'a' to be of abstract type 'Animal'
```

编译器的原话是 `error: cannot declare variable 'a' to be of abstract type 'Animal'` —— 念作：「**`a` 这一格要的是一个真动物，可 `Animal` 是张抽象类定义，照不出真身。**」

编译器说得对：**`Animal` 上那一手只有招牌、没有动作**。要是真让它创建一个来，我们调用 `a.speak()` 的时候，它该叫成什么样？**没有答案。** 所以这类型定义**干脆不许被直接照出来**。

我们把这种**身上挂着「只挂招牌」那一手的类定义**叫做 抽象类（抽象类定义）。

::: warn 注意
`abstract` 这个词我们不翻译成「难」，它说的是「**抽出来的**」—— 从学生甲、学生乙、计算机身上**抽出来**的那个共同点，只有「提供输出方法」两个字。

所以抽象类定义不是「画坏了的类定义」，恰恰相反：它是**把共同点立成招牌**的那张类定义。它不许被直接照出来，不是缺陷，是**它的全部意义**。
:::

## 二、子对象必须把招牌上的活干完，才能初始化

那照抽象类定义画下来的子对象呢？我们试过**漏掉一手**：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Animal {
protected:
    string name;
public:
    Animal(string n) : name(n) {}
    virtual void speak() const = 0;
};

class Cat : public Animal {
public:
    Cat(string n) : Animal(n) {}
};

int main() {
    Cat c("张三");
    c.speak();
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:19:9: error: cannot declare variable 'c' to be of abstract type 'Cat'
main.cpp:13:7: note: because the following virtual functions are pure within 'Cat':
```

注意看第二行那个 `note` —— 它说「**因为 `Cat` 里下面这些招牌还是空的**」，然后就把我们漏的那一手名字念了出来。

**这就是约定最值钱的地方。** 我们不用记得「我还欠着一手没写」—— **编译器替我们记着**。只要漏了，它当场拦下，绝不放过。

反过来看：要是老类定义上那一手**当时忘了写 `= 0`**（写成 `virtual void speak() const { ... }`，给了一个动作），那么子对象漏写就**谁也不会提醒**，程序照样跑起来，只是叫出来的不是子对象自己的声音。这条我们在后面「常见摔法」里写清楚了。

我们把两种捏法摆在一起走一遍 —— 一种会被当场拦下，另一种能捏出来：

```demo
title: 空招牌没补全，谁也别想捏出真身
code:
| class Animal { virtual void speak() const = 0; };                  // 抽象类定义：这一手只有招牌
| class Cat : public Animal { void speak() const override { ... } }; // 子类定义：把那一手补全了
| Animal a("谁");                                                     // 先试这一句：直接照抽象类定义捏
| Cat c("张三");                                                      // 再试这一句：照补齐了的子类定义捏

step 老类定义上那一手：只有招牌
at: 1
say: `virtual void speak() const = 0;` 那个 `= 0` 的意思是「**这一手我们只立个招牌，动作留给照它画下来的每一个类定义自己去写**」。身上挂着这样一手的类定义，就是抽象类定义。
meow: = 0 声明纯虚函数。
pose: expect
这一步捏的是 = （还没捏）
类定义上 speak 那一手 = 老类定义上只有招牌（`= 0`）
编译器 = （还没轮到）

step 子类定义把那一手补全了
at: 2
say: 子类定义照着 `Animal` 画下来，并且**把那一手补全**：`speak` 写上了自己的动作。补全了，它身上就没有空招牌了 —— 这一点下一步就要用到。
meow: Cat 实现了 speak。
pose: busy
这一步捏的是 = （还没捏）
类定义上 speak 那一手 = 子对象补全了，老类定义上仍是招牌
编译器 = （还没轮到）

step 先试最自然的那一问：直接照抽象类定义捏
at: 3
say: `Animal a("谁");` 我们想直接照抽象类定义创建一个。这一步**跑不到** —— 编译器在捏之前就把它拦下了，屏幕上只有一句原话：`error: cannot declare variable 'a' to be of abstract type 'Animal'`。
meow: 抽象类不能实例化。
pose: think
这一步捏的是 = 直接照抽象类定义捏
类定义上 speak 那一手 = 老类定义上只有招牌
编译器 = 拦下了

step 为什么拦：那一手没有动作
at: 3
say: 它的理由我们替它说一遍：**那一手只有招牌**。真让它创建东西来，我们调用 `a.speak()` 的时候，它该叫成什么样？**没有答案** —— 所以这类型定义干脆不许被直接照出来。它照样能被指着、被排成一排、当塞料收，**就是不能被直接照出来**。
meow: 纯虚函数没有实现，所以被拒绝。
pose: remind
这一步捏的是 = 直接照抽象类定义捏（没捏成）
类定义上 speak 那一手 = 招牌底下还是一点动作都没有
编译器 = 拦下：'a' to be of abstract type 'Animal'

step 换成照补齐了的子类定义捏
at: 4
say: `Cat c("张三");` 子类定义**不是**抽象类定义（那一手补全了），所以这一句放行 —— 张三这个对象就站在这里了，称呼它的 `speak` 有答案可跑。
meow: Cat 是具体类，可以创建。
pose: yay
这一步捏的是 = 照补齐了的子类定义捏
类定义上 speak 那一手 = 子对象把那一手补全了
编译器 = 放行：捏出来了
```

记住这两半就够了：**类定义上有一手只有招牌（`= 0`），它自己就捏不出来**；照它画下来的类定义，**把那些空招牌一手机一手补全，才捏得出来**。所以抽象类定义的用处从来不是「照它捏」，而是**当一份大家都得会的约定**。

## 三、抽象类定义上，别的都可以是正常的

我们要特别说清楚一件事：**不是整张类定义都变成「空招牌」了**。

回头看第一段那段代码：`Animal` 上除了那一手空招牌，还有

- **一栏 `name`** —— 一个正常的、有名字的变量；
- **一个正常的构造函数** —— 照它的类定义都能用；
- **一手 `showName`** —— 一个动作写全了的正常函数。

这三样都是**实打实的**，谁照 `Animal` 画下来就白得一份，一个字都不用重写。

::: tip 提示
判断一个类定义是不是抽象类定义，只看一件事：**它身上有没有挂着「`= 0`」的那一手**。

- 有 → 它不能被直接照出来，只能被指着用；照它画下来的类定义**必须**把那几手全补上。
- 没有 → 它还是普通类定义，想生就生。

一个类定义上有几手空招牌都行，**只要有一手，它就是抽象类定义**。
:::

## 四、接口约定

现在说这一课名字里的另一半。

有时候我们想要的不是「一张能长出子对象的类定义」，而是**一份约定**：我们不关心你身上有几栏变量、不关心你基类是谁，**我们只关心你会不会这几手**。

于是我们画一张**干干净净的类定义**：没有一栏数据，没有构造函数，**只有几手空招牌**：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Speaker {
public:
    virtual void speak() const = 0;
    virtual ~Speaker() {}
};

class Cat : public Speaker {
    string name;
public:
    Cat(string n) : name(n) {}
    void speak() const override {
        cout << name << "：" << endl;
    }
};

class Fish : public Speaker {
    string name;
public:
    Fish(string n) : name(n) {}
    void speak() const override {
        cout << name << "：" << endl;
    }
};

int main() {
    Cat c("张三");
    Fish f("计算机");
    Speaker* roster[2] = { &c, &f };
    for (int i = 0; i < 2; i++) {
        roster[i]->speak();
    }
    return 0;
}
```

```text
张三：
计算机：
```

这张干干净净的类定义，叫 接口（接口约定）。它说的是：

> **说好会这几手的对象，都得能用这几手。**

看 `main` 里那三行 —— 那正是我们要的东西：

- 我们手上只有一排写着 `Speaker` 的名称（`Speaker* roster[2]`），**名称上写的是「提供输出方法的」，不是「对象」也不是「鱼」**。
- 我们挨个调用同一句 `roster[i]->speak()`，学生甲、大鱼吐泡泡 —— **各对象各样**。
- 学生甲和计算机**没有半点血缘关系**，可它们都能站进这排名称里，因为**它们都按约定把那几手补上了**。

**约定和「抽象类定义」的分别，我们用一句话钉住：**

| | 抽象类定义（抽象类） | 接口约定（接口） |
|---|---|---|
| 身上有什么 | 约定那一手 **+ 正常的数据和函数** | **只有**约定那几手，别的什么都没有 |
| 照它画下来能得到什么 | 白得基类子对象数据和函数 | 什么都白得不着，**只有一份要还的约定** |
| 关心的是什么 | 「你是谁家的孩子」 | 「**你会不会这几手**」 |
| 典型场合 | 学生甲、学生乙、学生丁 —— 都是对象 | 提供输出方法的、会跳的、会数鱼的 —— 互不相干 |

::: warn 注意
两个最容易摔的地方，我们都真跑过：

- **约定那张类定义上，析构函数也要挂 `virtual`**（上面写的 `virtual ~Speaker() {}`）。上一课的规矩在这儿照样管用：老类定义有挂了招牌的函数，收尾就该挂招牌。我们真跑过这一对：**漏挂**的时候顺着名称 `delete` 那个对象，屏幕上除了输出那句 `张三：`，只剩 `老类定义那半被拆了` —— 子对象自己那半**一次不响地没被拆**（编译器只在 `delete` 那一行嘀咕一句 `warning: deleting object of abstract class type 'Speaker' which has non-virtual destructor will cause undefined behavior [-Wdelete-non-virtual-dtor]`，光看屏幕上印出来的东西发现不了）；把 `virtual` 挂上，屏幕上才是 `子对象那半也被拆了` 排在 `老类定义那半被拆了` 前面，而且连那句嘀咕都没有。
- **约定类定义上不许有数据**。有了一层需要填的初始化的东西，照它画下来的每一个类定义都得先想办法把它填上 —— 那就不再是「只会几手就行」的约定了。
:::

## 五、抽象类定义能做的三件事

我们把抽象类定义能做的事收成三条，往后天天用：

1. **可以被「指着」**：`Speaker* p = &c;`、`Speaker& r = c;` —— 我们手上是名称，屋里住的是实例。
2. **可以被「排成一排」**：`Speaker* roster[2] = { &c, &f };` —— **这就是上一课那份名单**，只是名字从「对象」换成了「提供输出方法的」。
3. **可以当塞料收**：函数收一个 `const Speaker& s`，凡是按约定画下来的都能传入。

它**唯一不能做**的事，就是**被直接照出来**。

| 我们写下的 | 它的意思 |
|---|---|
| `virtual void speak() const = 0;` | 只挂招牌、不写动作的那一手 —— 动作留给照它画下来的类定义 |
| `error: cannot declare variable 'a' to be of abstract type 'Animal'` | 我们想直接照抽象类定义创建一个 —— 编译器拦下了 |
| `error: cannot declare variable 'c' to be of abstract type 'Cat'` | 子对象漏了招牌上的活 —— 编译器替我们记着 |
| `Animal& r = c;` | 抽象类定义只能被「指着」，不能被「照出来」 |
| `Speaker* roster[2] = { &c, &f };` | 一排写着「会这几手的」名称 —— 学生甲和计算机站在一起 |
| `virtual ~Speaker() {}` | 约定类定义上的析构函数也挂招牌 |

## 小任务

1. 把第一节那段抄进练习场跑一次。然后把老类定义上那一行改成**没有 `= 0` 的空动作** `virtual void speak() const { }`，再跑一次 —— `Cat` 里那一手还在，所以两行输出一模一样。**这说明一件要紧的事：`= 0` 管的不是「子对象能不能改」，而是「子对象能不能不改」。**
2. 把第二节那段抄进去，确认编译器真的报 `to be of abstract type 'Cat'`；再把 `Cat` 里漏掉的那一手补上，看它是不是就好了。
3. 给第四节再添一个 `Dog`（狗），照 `Speaker` 画下来、补上 `speak`，然后**只改 `main` 里那排名称**（`Speaker* roster[3]`），让三个一起出声。体会一下：狗和对象和计算机**互不相干**，可它们都能站进同一排名称。
4. 想一想：我们在第四节说「我们只关心你会不会这几手」。那要是我们哪天想把**提供输出方法的**和**会跳的**合成一份约定，让一个对象同时答应两件事 —— 该怎么办？先记在心里。

下一课我们要教一张**模板**：同一个类定义，塞进去整数就裁成整数版，塞进去小数就裁成小数版，塞进去一串数据就裁成一串数据 —— 我们一个类定义都不用重画。去下一课探险 
