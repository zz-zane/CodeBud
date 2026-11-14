---
id: cpp-stage2-10
lang: cpp
stage: 2
order: 10
title: 多态与虚函数
tags: [面向对象, 多态]
required: ["cpp-stage2-09"]
crossRefs: []
estMinutes: 28
keywords: [virtual, override, destructor, polymorphism]
---

## 学习目标

本课学习多态与虚函数。重点包括虚函数、override、运行时多态、虚析构。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、用「对象」的名字，输出的却是「对象」的动作

类定义是这样的：老类定义 `Cat` 有 `speak` 这一手，子类定义 `OrangeCat` 把这一手**改成了自己的版本**：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
public:
    Cat(string n) : name(n) {}
    void speak() const {
        cout << name << "：喵！" << endl;
    }
};

class OrangeCat : public Cat {
public:
    OrangeCat(string n) : Cat(n) {}
    void speak() const {
        cout << name << "：我们是学生甲，！" << endl;
    }
};

int main() {
    OrangeCat o("张三");
    Cat& r = o;
    r.speak();
    o.speak();
    return 0;
}
```

```text
张三：喵！
张三：我们是学生甲，！
```

**注意第一行。** 我们手里那张名称上写的是「对象」（`Cat& r`），它指向的明明是学生甲张三，可输出的却是**老类定义那个平平无奇的「喵！」**。

而第二行 `o.speak()` 用的是「学生甲」的名字，输出的就是学生甲那一版。**同一个动作，两个名字调用出两种结果** —— 这正是我们想解决的问题。

为什么会这样？因为**编译器在翻译的时候就把话说死了**：它看见名称上写的是「对象」，就直接指到老类定义的 `speak` 上去了，根本没打算运行时再看一眼手里到底是哪个对象。**名字定终身，这就是「翻译阶段就定死」的脾气。**

我们把这一段拆成一步一步走一遍 —— 每一步都盯着两样东西：**名称上写的是什么**、**它实际指着谁**：

```demo
title: 名称写「对象」，输出的就是「对象」那一版
code:
| class Cat { void speak() const { ... } };            // 老类定义那一手：没挂 virtual
| class OrangeCat : public Cat { ... };                // 学生甲类定义：把 speak 改成自己那一版
| OrangeCat o("张三");                                  // 创建一个学生甲
| Cat& r = o;                                           // 拿一张写着「对象」的名称
| r.speak();                                            // 顺着名称调用一次
| o.speak();                                            // 直接调用这个对象本人

step 老类定义那一手没挂 virtual
at: 1
say: 老类定义上这一手写着 `void speak() const`，印的是「名字：」。**注意它开头没有 `virtual` 那三个字母** —— 差的正是那三个字母，下一节就补。
meow: speak 不是 virtual。
pose: expect
名称上写的是什么 = （还没这张名称）
它实际指着谁 = （还没这个对象）
最后挑了谁的 = （还没调用）

step 创建一个学生甲
at: 3
say: `OrangeCat o("张三");` 照学生甲类定义创建一个。它身上有基类子对象，也有自己改写的那一版 `speak` —— 这本来该是我们想听到的声音。
meow: 创建派生类对象 o。
pose: busy
名称上写的是什么 = （还没这张名称）
它实际指着谁 = 张三（学生甲）
最后挑了谁的 = （还没调用）

step 拿一张写着「对象」的名称
at: 4
say: `Cat& r = o;` 名称上写的是**基类的名字「对象」**，屋里住的却是学生甲。名称只记录地址，不记屋里住的是谁 —— 这两件事从这一刻起就分家了。
meow: 基类引用 r 绑定到 o。
pose: think
名称上写的是什么 = 对象（基类那一版的名字）
它实际指着谁 = 张三（学生甲）
最后挑了谁的 = （还没调用）

step 顺着名称调用一次
at: 5
say: **关键的一步来了。** `r.speak()` 顺着名称调用。编译器在翻译阶段就把话说死了：它只看见名称写的是「对象」，直接指到老类定义那一手上 —— 跑出来是平平无奇的「张三：」，**不是**学生甲改写的那一版。注意「它实际指着谁」这一栏写着张三，可这**不影响结果**：挑版本看的是名称，不看指着谁。
meow: 非虚函数按引用类型调用基类版本。
pose: think
名称上写的是什么 = 对象（基类那一版的名字）
它实际指着谁 = 张三（学生甲）
最后挑了谁的 = 老类定义那一手（名称说了算）

step 不走名称，直接称呼它本人
at: 6
say: `o.speak()` 引用的是这个对象本人，不经过名称 —— 这一回跑的是学生甲改写的那一版。同一个动作，两个名字调用出两种结果：差别不在对象身上，在**引用的时候看的是「名字」还是「本人」**。
meow: 直接用对象，调用派生类版本。
pose: proud
名称上写的是什么 = 对象（基类那一版的名字）
它实际指着谁 = 张三（学生甲）
最后挑了谁的 = 学生甲改写的那一版（直接引用的）
```

**这一步的教训钉在这儿**：我们当初以为「指着学生甲就该出学生甲那一版」—— 错在哪儿？错在**编译器只看了名称上的字，没看它指着谁**。下一节那三个字母，治的就是这件事。

## 二、给老类定义那一手挂上 `virtual`

解法只有三个字母：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
public:
    Cat(string n) : name(n) {}
    virtual void speak() const {
        cout << name << "：喵！" << endl;
    }
};

class OrangeCat : public Cat {
public:
    OrangeCat(string n) : Cat(n) {}
    void speak() const override {
        cout << name << "：我们是学生甲，！" << endl;
    }
};

int main() {
    OrangeCat o("张三");
    Cat& r = o;
    r.speak();
    o.speak();
    return 0;
}
```

```text
张三：我们是学生甲，！
张三：我们是学生甲，！
```

两行**都变成学生甲那一版**了 —— 因为 `r` 手上那个，本来就是学生甲。

- **`virtual` 挂在老类定义那一手的开头**：`virtual void speak() const`。它说的是「**这一手别急着定死，等真跑起来再看手里到底是哪个对象**」。
- 用我们的话说：挂了 `virtual` 的一手，是**一张会看屋里住的是谁的招牌** —— 招牌上写着「处理完成」，谁走到招牌底下，就按谁的习惯来。
- **只有老类定义那一手挂 `virtual` 就够**。子类定义把它改写一遍，改写出来的那份**自动也是「会看屋里住的是谁」的**，不用再挂。
- **挂 `virtual` 的三条小规矩**（我们见过太多对象栽在这里）：
  - 函数名、塞料、`const` 要和老类定义**一模一样**，差一个字就不是「改写」，而是「另外长了一手新的」。
  - 老类定义那一手不能是 `private`（子类定义得看得见它才能改写）。
  - 只有**顺着名称或者不必还的名字**调用，才会「回头看一眼屋里住的是谁」。手里拿着一个**实打实的实例**（像 `o.speak()`），那本来就是它自己那一版，跟 `virtual` 没关系。

## 三、`override`：让编译器替你盯着

上面那条「差一个字就不是改写」，是靠我们的眼睛盯的 —— 可我们会打错字。这一手有个专门的护身符：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
public:
    Cat(string n) : name(n) {}
    virtual void speak() const {
        cout << name << "：喵！" << endl;
    }
};

class OrangeCat : public Cat {
public:
    OrangeCat(string n) : Cat(n) {}
    void speek() const override {
        cout << name << "：我们是学生甲，！" << endl;
    }
};

int main() {
    OrangeCat o("张三");
    o.speak();
    return 0;
}
```

```text
main.cpp:18:10: error: 'void OrangeCat::speek() const' marked 'override', but does not override
```

念作：「**你给这一手挂了「我要改写基类那一手」的名称，可基类类定义上根本没有一手能让你改写。**」

注意看我们把 `speak` 打成了 `speek` —— 少了个 `a`。**没有 `override` 的话，编译器会一次不响地放行**，然后在某一天，我们对着满变量对象调用了半天，一个都没动，还找不出原因。有了 `override`，它当场就把这一跤拦下来了。

**所以我们的规矩是：凡是打算改写基类那一手的，一律挂上 `override`。** 六个字母，换一辈子不摔。

## 四、多态调用

现在把我们真正想要的效果跑一遍 —— 手里只拿一份「对象」的名单：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
public:
    Cat(string n) : name(n) {}
    virtual void speak() const {
        cout << name << "：喵！" << endl;
    }
};

class OrangeCat : public Cat {
public:
    OrangeCat(string n) : Cat(n) {}
    void speak() const override {
        cout << name << "：我们是学生甲，！" << endl;
    }
};

class TabbyCat : public Cat {
public:
    TabbyCat(string n) : Cat(n) {}
    void speak() const override {
        cout << name << "：我们是学生乙，呜" << endl;
    }
};

int main() {
    OrangeCat o("张三");
    TabbyCat t("李四");
    Cat* cats[2] = { &o, &t };
    for (int i = 0; i < 2; i++) {
        cats[i]->speak();
    }
    return 0;
}
```

```text
张三：我们是学生甲，！
李四：我们是学生乙，呜
```

**这就是我们要的东西。** 我们手上只有一份「对象」的名单（`Cat* cats[2]`），我们挨个调用同一句 `cats[i]->speak()` —— 各对象做出了各对象的动作。

- **`Cat* cats[2] = { &o, &t };`** 是一排指针，每一张上面写的是「对象」，指的却分别是学生甲和学生乙。我们第一阶段讲过：名称只记录地址，不记录屋里住的是谁。
- **`cats[i]->speak()`** 是一直顺着名称调用 —— 继续调用的那一刻，程序才低头看一眼「这家住的到底是哪位」，再决定跑哪一版。**这就是「等真跑起来再看」的意思。**
- **那一整排名称，我们一份都没写错**：不管是学生甲还是学生乙，都是照着 `Cat` 画下来的，所以都能站进「对象」的位置。**上一课那句「子对象本来就是对象」就是这里的钥匙。**

**往后写程序时这一手就是「加一种对象，不用改名单」**：我们哪天再画一张 `BlackCat`，只要它照 `Cat` 画下来、把 `speak` 改写好，就能直接塞进这排名称里，`main` 里一个字都不用动。

这一回名称还是写着「对象」，为什么就挑对了？我们把「挑版本」那一拍拆开走一遍：

```demo
title: 同一句调用声，低头看一眼屋里住的是谁
code:
| class Cat { virtual void speak() const { ... } };    // 老类定义那一手挂上了 virtual
| class OrangeCat : public Cat { ... };                // 学生甲：改写成自己那一版
| class TabbyCat : public Cat { ... };                 // 学生乙：也改写
| OrangeCat o("张三");                                  // 一个学生甲
| TabbyCat t("李四");                                   // 一个学生乙
| Cat* cats[2] = { &o, &t };                            // 一排写着「对象」的名称
| for (int i = 0; i < 2; i++) {                         // 挨个调用
|     cats[i]->speak();                                 // 顺着这张名称调用一次
| }

step 老类定义那一手挂上了 virtual
at: 1
say: 和上一段比，类定义只多了一个词：`virtual void speak() const`。它说的是「**这一手别急着定死，等真跑起来再看手里到底是哪个对象**」。子类定义改写的那一份**自动跟着**，不用再挂。
meow: 加上 virtual，运行时才决定。
pose: expect
名称上写的是什么 = （还没这排名称）
它实际指着谁 = （还没调用）
最后挑了谁的 = （还没调用）

step 排一排写着「对象」的名称
at: 6
say: `Cat* cats[2] = { &o, &t };` 两张名称上写的**都是「对象」**，指的却分别是学生甲和学生乙。这一排名称里，我们一份都没写错 —— 两个对象都是照 `Cat` 画下来的。
meow: 基类指针数组指向两个对象。
pose: busy
名称上写的是什么 = 对象（两张都是）
它实际指着谁 = 张三、李四（还没调用）
最后挑了谁的 = （还没调用）

step 第 1 步
at: 8
say: `cats[i]->speak();` 顺着第 0 张名称调用。挂了 `virtual` 的这一手**不在翻译阶段定死了** —— 程序继续调用的那一刻才低头看一眼「这家住的到底是哪位」，看出是张三，跑学生甲那一版。
meow: 第一个是 OrangeCat，调用它的版本。
pose: yay
名称上写的是什么 = 对象（两张都是）
它实际指着谁 = 张三（第 0 张名称指着它）
最后挑了谁的 = 学生甲那一版

step 第 2 步
at: 8
say: 第 2 圈 `i` 是 1，换第 1 张名称调用 —— 同一个动作、同一句代码，这一回低头看出的是李四，跑李四那一版。**各对象各样，靠的就是每调用一次都低头看一眼。**
meow: 第二个调用 TabbyCat 的版本。
pose: yay
名称上写的是什么 = 对象（两张都是）
它实际指着谁 = 李四（第 1 张名称指着它）
最后挑了谁的 = 学生乙那一版

step 两圈跑完，收工
at: 7
say: 第 3 次绕回 `for` 这一行，`i` 已经是 2，眼色不成立，圈停了。回头数一遍：**名称上从头到尾都写着「对象」，一次都没变过**；变的只是程序低头看出来的那个。
meow: 同一句代码，表现不同：多态。
pose: proud
名称上写的是什么 = 对象（两张都是，一直没变）
它实际指着谁 = 张三、李四（两个都调用结束了）
最后挑了谁的 = 各对象各样（学生甲一版、李四一版）
```

**名称上写的是「对象」，从第一张到最后一张都没动过** —— 变的只是程序低头看出来的那个。这就是「等真跑起来再看」的意思；下一节我们要讲它另一个要紧的用处：**拆变量的时候，也得靠它**。

## 五、虚析构：拆变量的时候别只拆一半

我们在上一课留了一个末尾：**老类定义的收尾动作一定要跑到。** 现在它找上门了。

看一段「只拆一半」的真事：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
public:
    Cat(string n) : name(n) {
        cout << "搭对象基类那一半：" << name << endl;
    }
    ~Cat() {
        cout << "拆对象基类那一半：" << name << endl;
    }
};

class Kitten : public Cat {
public:
    Kitten(string n) : Cat(n) {
        cout << "搭子对象那一半：" << name << endl;
    }
    ~Kitten() {
        cout << "拆子对象那一半：" << name << endl;
    }
};

int main() {
    Cat* p = new Kitten("张三");
    delete p;
    return 0;
}
```

```text
搭对象基类那一半：张三
搭子对象那一半：张三
拆对象基类那一半：张三
```

**数一数：搭的时候是两半，拆的时候只剩一半。** 「拆子对象那一半」这一行**根本没出现** —— 子对象那一半里的东西就这么留在原地了。

原因和第一节一模一样：我们手上那张名称上写的是「对象」，编译器在翻译的时候就把「拆」指到老类定义那一半上去了，**它压根没打算看一眼屋里住的是不是一个子对象**。

**解法也是同一个：给老类定义的析构函数也挂上 `virtual`。**

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
public:
    Cat(string n) : name(n) {
        cout << "搭对象基类那一半：" << name << endl;
    }
    virtual ~Cat() {
        cout << "拆对象基类那一半：" << name << endl;
    }
};

class Kitten : public Cat {
public:
    Kitten(string n) : Cat(n) {
        cout << "搭子对象那一半：" << name << endl;
    }
    ~Kitten() {
        cout << "拆子对象那一半：" << name << endl;
    }
};

int main() {
    Cat* p = new Kitten("张三");
    delete p;
    return 0;
}
```

```text
搭对象基类那一半：张三
搭子对象那一半：张三
拆子对象那一半：张三
拆对象基类那一半：张三
```

四行全齐了：**先搭基类、再搭子对象；拆的时候子对象先走、基类后走**（上一课那句话，一个字没变）。

- **`virtual ~Cat()`** 的写法就是这一手：在老类定义的析构函数前面挂上 `virtual`。它一挂上，顺着名称调用「拆」的时候，程序就会先低头看一眼屋里住的是谁，**从子对象那一半一直拆到基类那一半**。
- **规矩：只要老类定义上有一手挂了 `virtual`，它的析构函数就也该挂上 `virtual`。** 不然就是我们这一段 —— 搭的时候搭两半、拆的时候只拆一半，东西悄悄留在那儿。
- 这一条在「继承」那一课尤其要命：子对象那一半里很可能保存**第 08 课学的「动态内存」**。收尾没跑到，该变量就再也没人还了。

::: tip 提示
今天记住六句话：

1. **不挂 `virtual` 的时候，编译器在翻译阶段就把话说死了** —— 名称上写的是「对象」，就跑对象那一版，它不看屋里到底住的是谁。
2. **`virtual` 挂在老类定义那一手的开头**，子类定义改写的那一份自动跟着「看屋里住的是谁」，不用再挂。
3. **改写的时候名字、塞料、`const` 要一字不差**，差一个字就变成「另外长了一手新的」，而不是改写。
4. **打算改写的都挂上 `override`** —— 打错字的时候编译器当场拦住你。
5. **只有顺着名称（`cats[i]->`）或者不必还的名字（`Cat& r`）调用，才会回头看一眼屋里住的是谁**；手里拿着一个实打实的实例，那本来就是它自己那一版。
6. **老类定义有 `virtual` 的函数，析构函数也要挂 `virtual`** —— 不然「拆」只拆一半，子对象那一半的东西全漏掉。
:::

::: warn 注意
- **别把 `virtual` 挂在子类定义那一手上去「补」**。老类定义没挂，子对象挂了，顺着名称调用还是跑老类定义那一版 —— 你补的地方根本轮不到上场。
- **析构函数漏挂 `virtual` 不会报错、不会崩、输出也「看起来挺正常」** —— 它只是**少印了一行、少还了一个变量**。这种错只能靠「数输出行数」发现，我们第一次就是这么栽的。
- **别给每张类定义的每一手都挂 `virtual`。** 它是要花一点代价的。我们的规矩：**这一手是要被改写的**才挂；不确定的时候问自己一句 —— 我会不会拿「对象」的名单称呼它？
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `virtual void speak() const { ... }` | 老类定义那一手挂上「别急着定死」的招牌 —— 真跑起来再看手里是哪个对象 |
| `void speak() const override { ... }` | 子类定义改写那一手，并请编译器替我们盯着有没有写错名字 |
| `marked 'override', but does not override` | 名字打错（比如 `speek`）—— 你想改写的那一手基类类定义上没有 |
| `Cat& r = o;` | 不必还的名字，上面写的是「对象」，屋里住的可能是子对象 |
| `Cat* cats[2] = { &o, &t };` | 一排名称，每一张都写着「对象」，指着不同的对象 |
| `cats[i]->speak();` | 顺着名称调用 —— 继续调用才看屋里住的是谁，各对象各样 |
| `virtual ~Cat() { ... }` | 析构函数也挂上招牌：拆的时候**从子对象那一半一路拆到基类那一半** |
| 只拆一半的那一段输出 | 三行而不是四行 —— 子对象那一半的东西留在原地了，而且**一个错都不报** |

## 小任务

1. 把第一节那段抄进练习场跑一次，对着两行输出确认「名称写对象、调用出对象」。然后把 `virtual` 加上再跑一次 —— 两行的差别，就是这一课的全部。
2. 把第三节那段抄进去，确认编译器真的报 `marked 'override', but does not override`；再把 `speek` 改成 `speak`，看它是不是就好了。**这个小护身符以后每课都跟着你。**
3. 给第四节再画一张 `BlackCat`（学生丁）类定义，照着 `Cat` 画下来、把 `speak` 改写成它自己的台词，然后**只改 `main` 里那排名称**（`Cat* cats[3]`），让三个对象轮流出声。跑通了，你就摸到这一手真正的价值了。
4. 把第五节两段都跑一遍，**数一数输出有几行**。第二段是四行 —— 那多出来的一行，就是这一课最值钱的一行。
5. 想一想：我们在第四节说「再画一张新对象，`main` 一个字都不用动」。可小任务 3 里我们还是动了 `main`（名称的个数）。**有没有办法连那一个数字都不用改？** 这是下一阶段的钥匙，先记在心里。

下一课我们要往前走一大步：**有些类定义本来就不该被直接照出来，它只是一份「大家都要会这些」的约定**—— 我们管那类型定义叫抽象类定义，照着它画下来的子对象必须把该会的手都会了才能初始化。去下一课探险 
