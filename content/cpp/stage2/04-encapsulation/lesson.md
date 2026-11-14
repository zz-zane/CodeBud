---
id: cpp-stage2-04
lang: cpp
stage: 2
order: 4
title: 封装与访问控制
tags: [面向对象, 封装, 访问控制]
required: ["cpp-stage2-03"]
crossRefs: []
compare: ["common-10"]
estMinutes: 24
keywords: [private, public, getter, setter, access-control]
---

## 学习目标

本课学习封装与访问控制。重点包括private/public/protected、getter/setter、封装的意义。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```text
public:
    string name;
    int fish;
```

## 一、两区：谁都能碰的，和只有类定义自己能碰的

类定义状态里可以分**区**。每一区的开头写一小段字，说清楚这一区是留给谁的：

- `public:` —— 「**谁都能碰**」的那一区；
- `private:` —— 「**只有类定义自己的函数能碰**」的那一区。

注意这一小段字的形状：`public` / `private` 后面都跟着一个**冒号**，而且这一小段字要**顶格写**，别缩进到里面去。它管到**下一区开始**为止 —— 所以类定义上完全可以有好几块 `public:`、好几块 `private:`，一块一块地盖。

现在我们把两格家常都挪进 `private:`，只在下面留几道门：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
private:
    string name;
    int fish;

public:
    Cat(string n, int f) : name(n), fish(f) {}

    string getName() const {
        return name;
    }

    int getFish() const {
        return fish;
    }
};

int main() {
    Cat c1("张三", 3);
    c1.fish = 10;
    cout << c1.getName() << " 有 " << c1.getFish() << " 条" << endl;
    return 0;
}
```

我们猜有学员要撇嘴：「不就是把 `fish` 藏起来嘛，我照样伸手 —— 看我们写 `c1.fish = 10;`」。那就写写看。编译器当场就拦下了：

```text
main.cpp:24:8: error: 'int Cat::fish' is private within this context
main.cpp:8:9: note: declared private here
```

用自然语言解释：**「这个 `fish` 是 `Cat` 的 `private` 格子，你现在站的这个地方碰不着它 —— 它是在第 8 行那里被盖上盖子的。」**（`context` 就是「你现在站的这个地方」。）

注意编译器说的是 `private`（私有），而且它后面还贴心地补了一句：

```text
main.cpp:24:8: note: field 'int Cat::fish' can be accessed via 'int Cat::getFish() const'
```

念作：**「想碰 `fish`？隔着 `getFish()` 那道门。」** 编译器连门都替你指出来了。

那把伸手改成走门，同一个类定义就顺着跑了：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
private:
    string name;
    int fish;

public:
    Cat(string n, int f) : name(n), fish(f) {}

    string getName() const {
        return name;
    }

    int getFish() const {
        return fish;
    }
};

int main() {
    Cat c1("张三", 3);
    cout << c1.getName() << " 有 " << c1.getFish() << " 条" << endl;
    return 0;
}
```

```text
张三 有 3 条
```

**盖子不是不让用，是不让乱碰。** 要几号格子里的数，就走对应的那道门。

这一段就两件事：**伸手被拦**和**走门进去了**。我们把它拆成一步一步，走给你看：

```demo
title: 哪些格子伸手就挨拦，哪些格子隔着门进得去
code:
| Cat c1("张三", 3);
| c1.fish = 10;
| cout << c1.getName() << " 有 " << c1.getFish() << " 条" << endl;

step 生张三：类定义自己的函数碰 private 格子不受限
at: 1
say: `Cat c1("张三", 3);` 落地，构造函数跑起来。它是**类定义自己的函数** —— 伸手碰 `private:` 那一区的 `name`、`fish` 一点不受限制。盖子挡的**只是外面的手**，自己人照样随便碰。
meow: 构造函数可以访问 private 成员。
pose: expect
走到哪一行了 = 第 1 行 · 生张三
这一次够的是 = c1 那两格（类定义自己的函数在碰）
这一步的结果 = 两格都装好了

step 从外面直接伸手：被拦住了
at: 2
say: 学员不服气，非要从外面直接够：`c1.fish = 10;`。编译器当场拦下 —— `error: 'int Cat::fish' is private within this context`。**注意它不是「悄悄把数改掉了」：这一步程序根本编不过，一行都跑不了。**
meow: 外部访问 private 成员，编译报错。
pose: think
走到哪一行了 = 第 2 行 · 伸手够 c1.fish
这一次够的是 = c1.fish（private 格子）
这一步的结果 = 被拦下（编译不过）

step 报错底下：编译器把门指了出来
at: 2
say: 报错下面还跟着一句 `note: field 'int Cat::fish' can be accessed via 'int Cat::getFish() const'` —— 念作「**想碰 `fish`？隔着 `getFish()` 那道门**」。盖子锁着的那一格，门是开着的，报错连门都替我们指了出来。
meow: 报错说明这个成员是私有的。
pose: yay
走到哪一行了 = 第 2 行 · 报错顺手把门指了
这一次够的是 = c1.fish（private 格子）
这一步的结果 = 报错说：隔着 getFish() 那道门

step 收手改走门：先问名字
at: 3
say: 把伸手那一行**删掉**，改走 `getName()` 那道门。门里那几句是类定义自己的函数，碰 `name` 格子不受限制，把「张三」原样读取。**走门不是绕开盖子，是从主人开的门进去。**
meow: 改用 getName 公开接口。
pose: busy
走到哪一行了 = 第 3 行 · 走两道门
这一次够的是 = c1.getName()（公开的门）
这一步的结果 = 门里返回「张三」

step 再走第二道门：把数返回
at: 3
say: 同一个 `cout` 接着走 `getFish()` 那道门，门里那句 `return fish;` 把 3 返回；行尾 `endl` 一加，整行落定 —— `张三 有 3 条`。从头到尾，外面一次都没碰着格子。
meow: getFish 返回 3。
pose: proud
走到哪一行了 = 第 3 行 · 走两道门
这一次够的是 = c1.getFish()（公开的门）
这一步的结果 = 门里返回 3 → 印出「张三 有 3 条」
```

**看住这个对比就不会再晕**：同样是想碰 `fish`，「从外面伸手」当场编不过，「走 `getFish()` 那道门」就顺顺当当 —— 差别不在格子，在**手是从哪儿伸的**：类定义自己的函数（构造函数、门里那几句）随便碰，外面的手只能走门。

::: tip 提示
`private:` / `public:` 这类小段字，行话叫**访问控制** —— 「访问」就是「伸手过去碰」，`public` 是敞着的，`private` 是盖上盖子的。**类定义的函数里可以随便碰自己类定义上的任何格子**（哪怕它在 `private:` 里），盖上盖子挡的只是**外面**的手。
:::

## 二、留两道门：问数的，和改数的

上一节那两道门干的是同一件事 —— 把格子里的东西**原样递出来**。这样的门有个绰号叫 getter（念「盖特」），我们叫它**问数的函数**：名字通常是 `get` 加上格子名，状态里只有一句 `return`，末尾上带 `const`（上一课说过：只看看、不动格子）。

可只有问数的门，对象就只能是死的。要改数，就得再开一道**改数的函数** —— 绰号 setter（念「塞特」），名字通常是 `set` 加格子名，收一个输入接口，把格子改成它。

关键在**门里那句规矩**。改数的函数是我们亲手写的，所以我们可以在门里立规矩 —— 比如「条数不许是负数」：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
private:
    string name;
    int fish;

public:
    Cat(string n, int f) : name(n), fish(f) {}

    int getFish() const {
        return fish;
    }

    void setFish(int f) {
        if (f < 0) {
            cout << "不许倒扣" << endl;
            return;
        }
        fish = f;
    }
};

int main() {
    Cat c1("张三", 3);
    c1.setFish(5);
    cout << c1.getFish() << endl;
    c1.setFish(-2);
    cout << c1.getFish() << endl;
    return 0;
}
```

```text
5
不许倒扣
5
```

第二回输入的是 `-2`，门上那句 `if (f < 0)` 把它挡在外面，格子里的数稳稳停在 `5` 上 —— 这就是**盖子真正的价值**：不是把格子藏起来好看，而是让**每一次改动都必须经过我们立的规矩**。

要是门上不立规矩呢？那这道门就是白开的。把 `setFish` 里的守卫拿掉，改成 `fish = f;`，同一份 `main` 就会这样：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
private:
    string name;
    int fish;

public:
    Cat(string n, int f) : name(n), fish(f) {}

    int getFish() const {
        return fish;
    }

    void setFish(int f) {
        fish = f;
    }
};

int main() {
    Cat c1("张三", 3);
    c1.setFish(-2);
    cout << "现在有 " << c1.getFish() << " 条" << endl;
    return 0;
}
```

```text
现在有 -2 条
```

**它编得过、跑得动，而且我们拿最啰嗦的那档念叨（`-Wall`）真跑过一遍 —— 编译器一个字都没说。** 负数的条数就这么安安静静地住进了 `private` 的格子里。

这件事值得记在记录表上：**盖子本身不检查对错，规矩才是**。格子藏得再深，只要门开得没规矩，外面的人照样能把荒唐的数字递进来。所以 private 和 getter / setter 是**一对儿**用的 —— 少了门里的规矩，盖子就只是个装饰。

### 问数的函数，得把数**返回**

还有个小地方容易写歪：`getFish` 前面那个 `int`。它是说「这一个方法会把一个整数**返回**给称呼它的人」。称呼它的人拿这个数去印、去算，都行。要是把它写成 `void`，这一个方法就变成「只在自己状态里印一行字」的了 —— 那时候再想让它把数交给别人，编译器就不认了：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
private:
    string name;
    int fish;

public:
    Cat(string n, int f) : name(n), fish(f) {}

    void getFish() const {
        cout << "格子里的数是 " << fish << endl;
    }
};

int main() {
    Cat c1("张三", 3);
    cout << "我们的账：" << c1.getFish() << endl;
    return 0;
}
```

```text
main.cpp:20:26: error: no match for 'operator<<' (operand types are 'std::basic_ostream<char>' and 'void')
```

念作：**「你要我把一个 `void` 印出来 —— `void` 是「啥都没返回」，它装不进 `<<` 的右半边。」** 看到 `no match for 'operator<<'`，先低头看看 `<<` 右边那一个方法**前面写的是什么**：写了 `void` 的函数，只能**自己调用**，不能塞进 `<<` 里。

一句话记住：**问数的函数前面写类型（它返回数回来），改数的函数前面写 `void`（它只干活，不返回东西回来 —— 格子改好了就是它的成果）。**

## 三、还有一档盖子：`protected`

盖子其实有**三档**，我们已经认了前两档：

| 那一小段字 | 谁能碰 |
|---|---|
| `public:` | 谁都能碰 |
| `private:` | 只有类定义自己的函数能碰 |
| `protected:` | 只有类定义自己的函数 —— **以及「套着这张类定义」的下级类定义**能碰 |

第三档 `protected` 是为**继承**准备的：有些格子我们不想让外人碰，但想留给「照这张类定义再画一张更细的类定义」时用。继承是后面某一课的正题，今天先认个脸就行 —— 但它的**下半句**今天就要记住：对外人来说，它和 `private` 一样碰不得。

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
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
main.cpp:16:16: error: 'int Cat::fish' is protected within this context
main.cpp:8:9: note: declared protected here
```

编译器的话和前面几乎一模一样，只是把 `private` 换成了 `protected`。**`protected` 不是「半开着的门」**，外面照样伸手就挨拦。

## 四、我们今天记住的三句话

::: tip 提示
1. **盖子分三档**：`public:` 谁都能碰、`private:` 只有类定义自己的函数能碰、`protected:` 对类定义自己和「套着它的下级类定义」开，对外人一样碰不得。这些字后面**都带冒号**，而且管到下一区为止。
2. **盖子配门才成事**：问数的函数（`getXxx`，末尾带 `const`，状态里一句 `return`）＋ 改数的函数（`setXxx`，收一个输入接口）。**规矩立在门里**，盖子才有意义。
3. **函数前面那个词要说实话**：要返回个数回来就写类型（`int`），只干活不返回东西就写 `void`。`void` 的函数塞不进 `<<`。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `private:` | 盖上盖子：只有类定义自己的函数碰得着 |
| `public:` | 敞着：谁都能碰 |
| `protected:` | 留给「套着它的下级类定义」的那一档，对外人一样碰不得 |
| `c1.fish = 10;`（格子是 private） | 外面伸手 —— 编译器拦下：`is private within this context` |
| `int getFish() const { return fish; }` | 问数的门：把格子里的数**返回** |
| `void setFish(int f) { ... }` | 改数的门：只干活、不返回东西回来 |
| `if (f < 0) { ... return; }` | 立在门里的规矩 —— 盖子真正的价值在这儿 |
| `void getFish() const` | 只在自己状态里印字，返回不回数 —— 塞进 `<<` 会挨 `no match for 'operator<<'` |

## 小任务

1. 把第一节里那个 `private:` 改成 `public:`，真跑一次 —— 报错是不是就没了？然后再改回 `private:`，再跑一次。**这一来一回是本课最省事的一次实验**：你亲眼看见盖子确实在起作用。
2. 给第一节的类定义添一道门 `void setName(string n)`（状态里写 `name = n;`），把它也写进 `main` 里调用一次，看看名字改得动还是改不动。
3. 我们在 `setFish` 门上立了「不许是负数」，你再加一条：**条数超过 99 也不许**（提示：`if (f > 99)` 怎么写，守卫那句就照着抄）。写完真跑一次，各传入 `5`、`-2`、`120` 试试。
4. 把 `getFish` 末尾上那颗 `const` 拿掉，然后创建一个**带封印的对象**（`const Cat`）去称呼它 —— 看看编译器说什么。这是上一课学过的东西，你要能自己预测出它会说 `discards qualifiers` 才算真学会。
5. 想一想：我们把 `name` 和 `fish` 都盖上盖子之后，**外面还剩几条路能碰到它们**？把能走的路一条条输出（那两道门 + 构造函数）。再想一想：要是 `getFish` 里那句 `return fish;` 被我们改成了 `return fish + 1;`，外面的人**看得出来**吗？——这个小实验留给你自己跑。

下一课，我们要让类定义上出现**一份「所有对象共用」的格子**：不管生了多少个对象，它只有一份，谁都能看到它、改它。它到底归哪个对象？又该怎么数清楚一共有多少个对象？去下一课探险 
