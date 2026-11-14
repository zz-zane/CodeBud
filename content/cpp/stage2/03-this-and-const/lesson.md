---
id: cpp-stage2-03
lang: cpp
stage: 2
order: 3
title: 成员函数与 this 指针
tags: [面向对象, this, const]
required: ["cpp-stage2-02"]
crossRefs: []
compare: ["common-10"]
estMinutes: 24
keywords: [this, const, member-function]
---

## 学习目标

本课学习成员函数与 this 指针。重点包括成员函数细节、this、const 成员函数。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```text
cout << name << " 有 " << fish << " 条" << endl;
```

## 一、函数也能写在类定义外面：名字前面挂上类定义名

类定义里画得下函数，可函数一多，类定义就长得没边。所以我们可以把函数**挪到类定义外面**写 —— 只要在函数名前面挂上「这张类定义上的」这几个字。在 C++ 里，它们写成 `Cat::`：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    int fish;

    Cat(string n, int f) : name(n), fish(f) {}
    void show() const;
};

void Cat::show() const {
    cout << name << " 有 " << fish << " 条" << endl;
}

int main() {
    Cat c1("张三", 3);
    c1.show();
    return 0;
}
```

```text
张三 有 3 条
```

看类定义里那一行：`void show() const;` —— **只报名字、不带状态**，末尾那个分号千万别丢。真正的状态写在类定义外面：

```text
void Cat::show() const {
    cout << name << " 有 " << fish << " 条" << endl;
}
```

- `Cat::` 念作「**`Cat` 这张类定义上的**」—— 编译器靠这一小段把外面的这一个方法认回类定义里去。
- 状态里写的 `name`、`fish` 依旧是**格子**，不用加任何前缀。为什么？这正是下一节要讲的 `this` 在悄悄干活。
- 类定义里那行只报名字的写法，是**先打个招呼**：告诉编译器「有这么一个方法，状态回头再写」。少了它，外面那一个方法就成了没人认领的孤儿。

::: warn 注意
**漏掉 `Cat::` 是这一课最常摔的一跤。** 我们试过在类定义外面直接写 `void show() const`（名字前面空着）—— 编译器当场拦下：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    int fish;

    Cat(string n, int f) : name(n), fish(f) {}
    void show() const;
};

void show() const {
    cout << name << " 有 " << fish << " 条" << endl;
}

int main() {
    Cat c1("张三", 3);
    c1.show();
    return 0;
}
```

```text
main.cpp:14:13: error: non-member function 'void show()' cannot have cv-qualifier
```

念作：**「这不是类定义上的函数，它凭什么叫自己只读？」** 底下还会跟着两句，说 `name`、`fish` 这两个名字「没见过」—— 因为离开了 `Cat::` 这个前缀，编译器根本不知道要进哪张类定义里去找格子。

改法就是补上那一小段：`void Cat::show() const`。看到报错里有 `non-member function`，先检查函数名前面是不是漏了它。
:::

## 二、`this`：函数里那个「我们自己」

上一节的函数里为什么可以直接写 `name`？因为函数里藏着一个**隐形的输入接口** —— 每调用一次函数，编译器都会悄悄把**称呼它的那个对象**一起递进来。这个隐形输入接口就叫 `this`：一张写着「我们自己」的指针。

平时你写 `name`，编译器会替你补全成 `this->name`（念作「**我们自己那一格 `name`**」）。可**一旦输入接口和格子同名**，这次自动补全就靠不住了：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    int fish;

    Cat(string n, int f) : name(n), fish(f) {}
    void rename(string name) {
        this->name = name;
    }
    void show() const {
        cout << name << " 有 " << fish << " 条" << endl;
    }
};

int main() {
    Cat c1("张三", 3);
    c1.rename("王五");
    c1.show();
    return 0;
}
```

```text
王五 有 3 条
```

我们图省事，把输入接口也起名叫 `name`，于是函数状态里站着**两个 `name`**：一个是输入接口，一个是格子。C++ 的规矩很干脆：**近的那个赢** —— 光写 `name`，指的是输入接口。想碰格子，就得**指名道姓**。

`this->name = name;` 念作「**把输入接口那个 `name`，装进我们自己那一格 `name` 里去**」。

那要是不写 `this->` 呢？我们真跑过 ——

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    int fish;

    Cat(string n, int f) : name(n), fish(f) {}
    void rename(string name) {
        name = name;
    }
    void show() const {
        cout << name << " 有 " << fish << " 条" << endl;
    }
};

int main() {
    Cat c1("张三", 3);
    c1.rename("王五");
    c1.show();
    return 0;
}
```

```text
张三 有 3 条
```

**这不是报错，这是「跑得成功、结果全错」。** `main` 里明明引用的是「改名叫王五」，印出来还是「张三」。

我们特意拿最啰嗦的那档念叨（`-Wall`）真跑了一遍：**编译器一个字都没说** —— 没有警告、没有提示，屏幕安安静静。这就是这一类错最要命的地方：**它不吵不闹，只是悄悄把你的活干歪。**

所以记牢这条手感：**输入接口和格子同名时，格子那一侧必须写 `this->`。**

## 三、只读函数：末尾上那个 `const`

再看一眼那个熟练的函数脑袋：`void show() const` —— 末尾多了一颗 `const`。它是**函数自己的封印**，意思是「**我们保证只看看，一格都不动**」。

这一颗 `const` 有两个好处。先说能看见的那个：**带封印的对象也能称呼它**。

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    int fish;

    Cat(string n, int f) : name(n), fish(f) {}

    void show() const {
        cout << name << " 有 " << fish << " 条" << endl;
    }

    void eat() {
        fish = fish + 1;
        cout << name << " 消耗了一条" << endl;
    }
};

int main() {
    Cat c1("张三", 3);
    c1.show();
    c1.eat();
    c1.show();

    const Cat c2("李四", 1);
    c2.show();
    return 0;
}
```

```text
张三 有 3 条
张三 消耗了一条
张三 有 4 条
李四 有 1 条
```

`const Cat c2("李四", 1);` 创建后的是一个**带封印的对象**：它身上每一格都不许改。这样的对象只能调用**只读函数**（末尾上有 `const` 的那些）—— `show` 调用得动，`eat` 调用不动，因为 `eat` 要往格子里写东西。

第二个好处是：这颗 `const` 是**给自己上的一道保险**。写函数的时候顺手加上它，等于跟编译器立下「这一个方法不碰格子」的字据；哪天真手滑在只读函数里改了格子，它当场就把你拦下。

上面那段里，`show` 被两个对象各调用了一次，函数体却只有一份 —— 它凭什么知道该读谁的格子？靠的就是上一节那块 `this` 名称。我们把它拆成一步一步，走给你看：

```demo
title: 函数只有一份，它怎么知道在替哪个对象干活
code:
| Cat c1("张三", 3);
| c1.show();
| c1.eat();
| c1.show();
| const Cat c2("李四", 1);
| c2.show();

step 生张三：函数一跑，名称就指着它
at: 1
say: `Cat c1("张三", 3);` 落地，构造函数跑起来。**每调用一次函数，编译器都会悄悄把称呼它的那个对象一起递进来** —— 这回递进来的是张三自己，函数里读写的 `name`、`fish` 全是张三那两格。
meow: 创建 c1，this 指向它。
pose: expect
走到哪一行了 = 第 1 行 · 生张三
this 指着谁 = 张三（c1）
标准输出 = 还没印

step 调用 show：名称指着张三，读的是张三的格子
at: 2
say: `c1.show();` —— 函数体只有一份，画在类定义上。可它状态里那句 `name` 会被编译器补全成 `this->name`（**我们自己那一格**）；名称这会儿指着张三，读出来的就是张三的 `name` 和 `fish`。
meow: show 读取的是 this 指向的对象。
pose: expect
走到哪一行了 = 第 2 行 · c1.show()
this 指着谁 = 张三（c1）
标准输出 = 张三 有 3 条

step 调用 eat：名称还指着张三，加的是张三那一格
at: 3
say: `c1.eat();` 递进去的还是张三，所以那句 `fish = fish + 1` 加的是**张三自己那一格**：3 变 4。可见名称指着的格子是**每个对象各有一份**的，不是大家共用一份。
meow: eat 把 c1.fish 改成 4。
pose: busy
走到哪一行了 = 第 3 行 · c1.eat()
this 指着谁 = 张三（c1）
标准输出 = 张三 有 3 条 / 张三 消耗了一条

step 再调用一次 show：函数一字没改，读出来变了
at: 4
say: 还是那一行 `c1.show()`，函数体一个字都没改，可这回印出来是「张三 有 **4** 条」—— 变的是**名称指着的那些格子**，上一行刚被加过 1。同一段代码读到什么，全看名称指着谁。
meow: 再次 show，输出 4。
pose: yay
走到哪一行了 = 第 4 行 · 又一次 c1.show()
this 指着谁 = 张三（c1）
标准输出 = 张三 有 3 条 / 张三 消耗了一条 / 张三 有 4 条

step 生李四：第二个对象，带封印
at: 5
say: `const Cat c2("李四", 1);` —— 第二个对象落地。构造函数**还是同一份**，这回递进去的是李四：它的 `name` 装「李四」、`fish` 装 1。两个对象各有各的两格，函数始终只有一份。（开头那个 `const` 让它是只**带封印的对象**，只认只读函数 —— `show` 末尾上有 `const`，调用得动。）
meow: 创建 const 对象 c2。
pose: expect
走到哪一行了 = 第 5 行 · 生李四
this 指着谁 = 李四（c2）
标准输出 = 张三 有 3 条 / 张三 消耗了一条 / 张三 有 4 条

step 调用 show：名称换成李四，同一份函数体印出另一个对象
at: 6
say: `c2.show();` —— 函数体一个字都没动（还是类定义里那一份），可名称这回指着李四，读出来的是**李四那两格**，于是印出「李四 有 1 条」。同一段代码替两个对象各跑一遍、各说各的话，这就是通往**多态**的那一步。
meow: this 指向 c2，读取它的数据。
pose: proud
走到哪一行了 = 第 6 行 · c2.show()
this 指着谁 = 李四（c2）
标准输出 = 张三 有 3 条 / 张三 消耗了一条 / 张三 有 4 条 / 李四 有 1 条
```

**这块名称只有一块，它随调用随换**：`c1.show()` 时指着张三、`c2.show()` 时指着李四，函数体从头到尾只有一份。以后我们要让同一份函数对不同的对象做出不同的事，靠的就是它。

::: warn 注意
带封印的对象去调用**没有封印**的函数，编译器会拦：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;

    Cat(string n) : name(n) {}

    void show() {
        cout << name << " 蹲在这儿" << endl;
    }
};

int main() {
    const Cat c1("张三");
    c1.show();
    return 0;
}
```

```text
main.cpp:18:12: error: passing 'const Cat' as 'this' argument discards qualifiers [-fpermissive]
```

念作：**「你递进来的是一个带封印的对象，可这一个方法说了自己要动格子 —— 封印不能丢，所以这活它接不了。」**（`qualifiers` 说的就是「封印这类挂在类型上的小末尾」。）

注意报错里那个 `this` —— 它正好是本节的另一位主角：编译器每调用一次函数都要悄悄递进来的那个对象。带封印的对象递不进去一个「随便你改」的自己，于是这一个方法就接不了这活。

看到 `discards qualifiers`，只有两条路：这一个方法**本来就只是看看**，就给它末尾上补一颗 `const`；它**确实要动格子**，那这个对象就不该带封印 —— 把 `const` 从对象身上拿掉。**先想清楚这一个方法该不该动格子，再动手**，别急着乱补。
:::

## 四、我们今天记住的三句话

::: tip 提示
1. **函数可以写在类定义外面**：名字前面挂 `Cat::`；类定义里留一行只报名字的「先打个招呼」（末尾的分号别丢）。
2. **`this` 是函数里那个「我们自己」**：平时可以不写，**输入接口和格子同名时必须写** `this->格子名` —— 不写**不报错**，只是活干歪。
3. **只读函数**：末尾上那颗 `const` 表示「只看看、不动格子」；**带封印的对象只认只读函数**。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `void show() const;`（类定义里） | 先打个招呼：有这么一个方法，状态回头写在类定义外面 |
| `void Cat::show() const { ... }` | 状态写在类定义外面；`Cat::` 念作「这是 `Cat` 类定义上的」 |
| `this->name = name;` | 把输入接口那份 `name`，装进我们自己那一格 `name` |
| `name = name;` | 只改了输入接口自己 —— 格子纹丝不动，而且**不报错** |
| `void show() const` | 只读函数：保证只看看、一动也不动格子 |
| `const Cat c2("李四", 1);` | 一个带封印的对象，只调用得动只读函数 |

## 小任务

1. 把第一节那段抄下来，**把 `show` 的状态挪回类定义里面**（类定义外面那一行顺手删掉），看看印出来是不是一模一样。同一件事两种写法，你要两种都认得。
2. 给类定义添一个方法 `listen()`：它只印一行「我们在听」，一个字都不改。给它末尾加上 `const`，再创建一个**带封印的对象**称呼它 —— 看看顺不顺。
3. 把第二节那段里的 `this->` 删掉，真跑一次，看看编译器有没有吭声、印出来的名字又是什么。**这两个结果都抄进记录表**：这是本课最值钱的一次实验。
4. 把 `rename` 换一种写法：输入接口改名叫 `newName`，状态里写 `name = newName;` —— 不用 `this->` 也能跑对。想想为什么这一版就没有同名的问题。
5. 想一想：`eat` 为什么不能写 `const`？（提示：它要往格子里写东西。）要是硬给它加上 `const`，编译器会在**哪一句**上拦你？

下一课，我们要给格子**盖上盖子**：哪些格子能让人随便碰、哪些只能隔着函数碰，以及为什么「盖上盖子」才是类定义真正的本事。去下一课探险 
