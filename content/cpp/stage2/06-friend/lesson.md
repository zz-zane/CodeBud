---
id: cpp-stage2-06
lang: cpp
stage: 2
order: 6
title: 友元访问
tags: [面向对象, 友元]
required: ["cpp-stage2-05"]
crossRefs: []
estMinutes: 24
keywords: [friend, private, class, access]
---

## 学习目标

本课学习友元访问。重点包括友元函数、友元类、使用边界。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、站在类定义外面够一格带盖的格子，会怎样

先确认盖子是真的。我们在 `main` 里直接去够那一格：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
    string name;
    int fish;
public:
    Cat(string n, int f) : name(n), fish(f) {}
};

int main() {
    Cat c1("张三", 3);
    cout << c1.fish << endl;
    return 0;
}
```

```text
main.cpp:14:16: error: 'int Cat::fish' is private within this context
```

编译器这句话的意思是：「**`Cat` 这张类定义上的 `fish` 那一格是私有的，你现在站的这个地方够不着**。」

注意它连一行都没让程序跑起来 —— 这是**翻译阶段**就拦下的错。我们在第一阶段的「编译器怎么工作」那一课讲过：很多错在翻译的时候就被截住了，这份代码根本没变成能跑的东西。

## 二、开一扇后门：类定义里的那一行 `friend`

办法很轻：**在类定义里面，把那扇门指名道姓地开给谁。**

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
    string name;
    int fish;
public:
    Cat(string n, int f) : name(n), fish(f) {}
    friend void showAccount(const Cat& c);
};

void showAccount(const Cat& c) {
    cout << c.name << " 的账上是 " << c.fish << " 条数据" << endl;
}

int main() {
    Cat c1("张三", 3);
    showAccount(c1);
    return 0;
}
```

```text
张三 的账上是 3 条数据
```

同一个 `c.fish`，上一段还够不着，这一段就够得着了 —— 差别只在类定义里多出来的那一行。我们把它拆开看：

- **`friend void showAccount(const Cat& c);`** —— 这行写在类定义**里面**，说的是「**`showAccount` 是我们信得过的，它够得到我们盒子里的一切**」。这一行是**一张通行证，不是一格存储** —— 它不占地方，不生新格子，只记名字。
- **加不加 `friend`，就是「外面的函数」和「自己人的函数」的分界。** 少了这两个字母，它就是个普通的外来函数，刚才那种错立刻回来。
- **摆放位置不影响什么。** 这一行写在 `public:` 底下、还是写在 `private:` 底下，效果**一模一样** —— 通行证就是通行证，它管的不是自己能被人看见，而是**它能看见谁**。我们习惯把它放在类定义最下面，一眼就知道这是给谁的。
- **开门的函数里那个 `c.fish` 是能读能写的**：`c.fish = 10;` 这种句子在里面照样成立，因为它现在算「自己人」。

### 调用这扇后门的时候，前面别写那个对象

这是新手最容易写歪的一处。开门的函数**不是类定义上的函数**，所以称呼它的写法完全不同：

| | 类定义上的函数 | 开门的函数 |
|---|---|---|
| 定义写在哪 | 类定义**里面** | 类定义**外面** |
| 定义开头加不加 `Cat::` | 加（或者写在类定义里） | **不加** |
| 称呼它的写法 | `c1.meow()` | `showAccount(c1)` |

一句话：**类定义上的函数是「哪个对象 · 函数名」，开门的函数是「函数名(哪个对象)」。** 后者的身份是**外面的一个普通函数**，只是类定义额外给了它一张通行证。

这一开一拦到底差在哪，我们拆成一步一步走给你看（上半份类定义没写 `friend`，下半份只多写了那一行）：

```demo
title: 同一句 c.fish，写了那一行 friend 就过得去
code:
| class Cat {
|     string name;
|     int fish;
| public:
|     Cat(string n, int f) : name(n), fish(f) {}
| };
| void showAccount(const Cat& c) {
|     cout << c.fish << endl;
| }
| // ── 下面这份类定义，只多写了第 16 行那一句 friend ──
| class Cat {
|     string name;
|     int fish;
| public:
|     Cat(string n, int f) : name(n), fish(f) {}
|     friend void showAccount(const Cat& c);
| };
| void showAccount(const Cat& c) {
|     cout << c.fish << endl;
| }

step 类定义里那一格 fish 是带盖的
at: 3
say: 类定义上第 2、3 行这两格挂在 `public:` **前面**，天生带盖（私有）—— 只有类定义自己的函数伸手够得到。我们先说清：张三这个对象盒子里的 `fish` 那一格，保存 3 条。
meow: 这些成员默认是私有的。
pose: expect
张三盒子里的 fish = 3
showAccount 手里有通行证吗 = 没有
标准输出 = 还没印

step 外面来的函数伸手去够 —— 拦住
at: 8
say: 第 7、8 行是类定义**外面**的一个普通函数 `showAccount`。第 8 行那句 `c.fish` 伸手去够盒子里的东西，可类定义里**一个字都没提它** —— 通行证上没它的名字。编译器当场拦下：`error: 'int Cat::fish' is private within this context`。注意这是**翻译阶段**就拦下的，它连一行都没让程序跑起来。
meow: 普通函数访问私有成员，编译失败。
pose: think
张三盒子里的 fish = 3
showAccount 手里有通行证吗 = 没有 → 挨拦
标准输出 = 还没印

step 类定义里补上那一行 friend
at: 16
say: 下面那份类定义只多了一行：`friend void showAccount(const Cat& c);`（第 16 行）。它写在类定义**里面**，是一张**通行证**，不是一格存储 —— 它不占地方、不生新格子，只记名字：从这一刻起，这个名字算「自己人」。
meow: friend 声明授权这个函数。
pose: busy
张三盒子里的 fish = 3
showAccount 手里有通行证吗 = 有了
标准输出 = 还没印

step 同一句 c.fish，这回过去了
at: 19
say: 看第 18、19 行：和上面第 7、8 行**逐字一样**，一个字都没改。同一句 `c.fish`，这回直接够到盒子里，把 3 读取印在屏幕上。过得去与挨拦的差别，全在第 16 行写没写它的名字。
meow: 同样的代码现在可以编译。
pose: yay
张三盒子里的 fish = 3
showAccount 手里有通行证吗 = 有了 → 够到了
标准输出 = 3

step 这张通行证到底管什么
at: 16
say: 再回头看那一行：它是**一张通行证，不是一格存储** —— 管的是「**它能看见谁**」，不是「它自己能被人看见」，所以写在 `public:` 还是 `private:` 底下效果一模一样。而且它只对**写下的那一个名字**开缝：换个没写名字的外人（比如对象大夫的学徒）进来够同一句，照样挨拦。
meow: friend 是授权，不是类的成员。
pose: proud
张三盒子里的 fish = 3
showAccount 手里有通行证吗 = 有了
标准输出 = 3
```

**记住这两句**：类定义里不写那一行，外面的函数伸手够私有格子就是**翻译阶段当场挨拦、一行都不跑**；写上它的名字，**同一句就过去了**。它管的是「它能看见谁」，不是「它自己能被人看见」。

## 三、整张类定义一起开门：`friend class`

对象大夫不是一个对象，它是一整张类定义 —— 每个对象大夫都会量体温、称体重、翻账本。要是给每个对象大夫都单独开一次门，我们的手会酸。

那就**整张类定义一起开**：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
    string name;
    int fish;
public:
    Cat(string n, int f) : name(n), fish(f) {}
    friend class Vet;
};

class Vet {
public:
    void checkup(const Cat& c) {
        cout << "对象大夫打开 " << c.name << " 的盒子：" << c.fish << " 条，处理得不错" << endl;
    }
};

int main() {
    Cat c1("张三", 3);
    Vet v;
    v.checkup(c1);
    return 0;
}
```

```text
对象大夫打开 张三 的盒子：3 条，处理得不错
```

- **`friend class Vet;`** —— 「`Vet` 这张类定义照出来的**每一个**对象大夫，我们都信得过」。它照出来的对象大夫不用再一个一个打招呼，天生带着通行证。
- 注意 `Vet` 里的 `c.name` 和 `c.fish` 写得和普通够格子没两样 —— **后门开好后，写法上一点痕迹都没有**。看不出这是特权，这正是它危险的地方。
- 被开门的类定义（`Cat`）**不需要知道 `Vet` 长什么样**：`friend class Vet;` 这一行在 `Vet` 还没画出来的时候就成立了。所以「谁给谁开门」可以写在前面，「开门的是谁」慢慢再画。

## 四、后门的三条边界

后门是个很有力的工具，我们把它的边界一次讲清楚 —— 这三条不知道，迟早摔。

**第一条：后门是单向的，钥匙不会送回来。**

`Cat` 给 `Vet` 开了门，意思是「`Vet` 看得到 `Cat` 的盒子」。反过来不成立 —— **`Cat` 的函数一样够不到 `Vet` 的私有格子**。开门是你单方面签的字，不是交朋友。

**第二条：后门不传递，对象大夫的学徒进不来。**

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
    string name;
    int fish;
public:
    Cat(string n, int f) : name(n), fish(f) {}
    friend class Vet;
};

class Vet {
};

class Assistant {
public:
    void peek(const Cat& c) {
        cout << c.fish << endl;
    }
};

int main() {
    Cat c1("张三", 3);
    Assistant a;
    a.peek(c1);
    return 0;
}
```

```text
main.cpp:19:19: error: 'int Cat::fish' is private within this context
```

`Vet` 有通行证，可 `Assistant` 没有 —— **通行证不许转借**。想让它进得来，就得在 `Cat` 的类定义里**再写一行**，把名字写清楚。这一条是刻意的：要是能转借，我们开一次门就等于给全世界开门了。

**第三条：开后门的函数，依然不是类定义上的函数。**

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
    string name;
    int fish;
public:
    Cat(string n, int f) : name(n), fish(f) {}
    friend void showAccount(const Cat& c);
};

void showAccount(const Cat& c) {
    cout << c.name << " 的账上是 " << c.fish << " 条数据" << endl;
}

int main() {
    Cat c1("张三", 3);
    c1.showAccount(c1);
    return 0;
}
```

```text
main.cpp:19:8: error: 'class Cat' has no member named 'showAccount'
```

念作：「**`Cat` 这张类定义上，没有叫 `showAccount` 的那一格本事。**」它拿到的是通行证，不是工牌 —— **通行证让它看得见里面，不等于它成了里面的东西。** 调用方式还是外面那一套：`showAccount(c1)`。

::: tip 提示
今天记住五句话：

1. **`friend` 写在类定义里面**，是一张**通行证**：谁的名字写在上面，谁就够得到盒子里的一切。
2. **开门的函数定义在类定义外面，前面不加 `Cat::`，引用的时候不写 `c1.`** —— 它身份上还是外来函数。
3. **`friend class Vet;` 是整张类定义一起开门**，它照出来的每一个都带着通行证。
4. **单向、不传递**：你给谁开门是你单方面签的字，被开门的那位既不回赠钥匙，也没法把钥匙转给学徒。
5. **写了 `friend` 的函数，里面读私有格子照样算「自己人」**，能读也能写。
:::

::: warn 注意
- **后门是「把盖子开一道缝」，用多了盖子就白扣了。** 我们只在「这个函数/这张类定义天生就是盒子的搭档」时才用 —— 比如对象大夫看对象的账。随手给谁都开一扇，等于我们前面辛苦扣的盖子全白费。
- **别把 `friend` 和「把格子改成 `public:`」混为一谈。** 后者是**对所有人**掀盖子，前者只对**写下的那一个名字**开缝。要开缝，就别掀盖。
- **`friend` 那一行忘了分号**，编译器会从头说起一堆别的错 —— 先检查这一行收尾了没有。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `friend void showAccount(const Cat& c);` | 写在类定义里面的一行通行证：这个外来函数够得到盒子里的一切 |
| `friend class Vet;` | 整张类定义开门：`Vet` 照出来的每个对象大夫都够得着 |
| `showAccount(c1)` | 调用开门的函数：**函数名(对象)**，前面不写 `c1.` |
| `void showAccount(const Cat& c) { ... }` | 定义写在类定义**外面**，开头**不加** `Cat::` |
| `c1.meow()` | 类定义上的函数才是这种「哪个对象 · 函数名」的调用方式 |
| `error: ... is private within this context` | 站在够不着的地方碰了私有格子 —— 通行证没给你 |
| `has no member named` | 你把开门的函数当成类定义上的函数调用了 |

## 小任务

1. 把第二节那段抄进练习场，跑一次；然后把类定义里那一行 `friend` **删掉**再跑一次，把编译器的原话抄进记录表 —— 这是本课最值得记的一句。
2. 给 `Cat` 再写一个开门的函数 `void rename(Cat& c, string newName)`，让它**改写**盒子里的名字（不是只读）。跑起来看看名字换掉没有。
3. 给 `Cat` 画一张新类定义 `Assistant`，先用 `friend class Assistant;` 让它进得来，跑通；再把这一行删掉，看报错。**两次都跑，你就把「不写就不许进」记牢了。**
4. 自己画一张两列的小表：把第二节的 `showAccount` 和我们前面教的 `c1.meow()` 并排写出来，标出**定义在哪、调用方式差在哪** —— 这一格一填，第二节结尾那张表就是你自己的了。
5. 想一想：既然 `friend` 这么方便，为什么我们还要先花一整个课把盖子扣上，再来开后门？把答案讲给自己听。

下一课，我们要给符号本身定制函数 —— 让你自己画的类定义也能直接用 `+`、`-` 和 `==`，甚至能直接塞进 `cout` 里印出来。去下一课探险 
