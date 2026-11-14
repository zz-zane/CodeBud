---
id: cpp-stage3-18
lang: cpp
stage: 3
order: 21
title: 多继承与虚基类
tags: ["继承","面向对象"]
required: ["cpp-stage3-17"]
crossRefs: ["cpp-stage2-09","cpp-stage2-10","java-stage2-04"]
estMinutes: 28
keywords: [multiple inheritance, diamond, virtual base, ambiguous]
---

## 学习目标

本课学习多继承与虚基类。重点包括多继承语法、菱形继承问题、虚继承与虚基类、该不该用多继承。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、照着两张类定义一起画

写法只比上一阶段多一小段：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Purr {
protected:
    string purrName;
public:
    Purr(const string& n) : purrName(n) {
        cout << "先搭会打输出的那一半" << endl;
    }
    void purr() const {
        cout << purrName << "：输出输出" << endl;
    }
};

class Knead {
protected:
    string kneadName;
public:
    Knead(const string& n) : kneadName(n) {
        cout << "再搭会踩初始化值的那一半" << endl;
    }
    void knead() const {
        cout << kneadName << "：踩踩踩" << endl;
    }
};

class Baby : public Purr, public Knead {
public:
    Baby(const string& n) : Purr(n), Knead(n) {
        cout << "最后搭子对象这一半：" << purrName << endl;
    }
};

int main() {
    Baby b("张三");
    b.purr();
    b.knead();
    return 0;
}
```

```text
先搭会打输出的那一半
再搭会踩初始化值的那一半
最后搭子对象这一半：张三
张三：输出输出
张三：踩踩踩
```

看清楚这几件事：

- **`class Baby : public Purr, public Knead`** —— 照着两张类定义一起画，中间用**逗号**隔开。念作「`Baby` 这张类定义，照着 `Purr` 和 `Knead` 两张画下来」。
- **两张前面那个 `public` 一个都不能少。** 少写了就是上一阶段那一跤：老类定义给的公开东西全变成新类定义自己的私事，外面会说「够不着」。
- **初始化顺序按我们写的先后**：先 `Purr` 那一半、再 `Knead` 那一半，**最后才是自己那一半** —— 输出前三行就是它俩加自己。
- **照出来的张三两样都会**（`b.purr()` 和 `b.knead()`），而且它**既是一个会打输出的对象，也是一个会踩初始化值的对象**：凡是能放「会打输出的对象」的地方，放它都成立。这是上一阶段那句老话的扩大版。
- 这里两张类定义**谁也不认识谁** —— 它们没有共同的底座，所以拼起来干干净净。麻烦出在它俩认识同一个类定义的时候。

## 二、岔路口：底座出现了两份

现在我们让这两张类定义**都照着同一张底座画**。底座是「会的对象」（`MeowCat`），里面有一格名字、一手 `meow`。

顺带我们在底座里挂了一个**共同的计数器**（`static int built`）：每搭一份底座它就加一 —— 这样我们就能数出来，照出来的对象状态里到底有几份底座。

```cpp
#include <iostream>
#include <string>
using namespace std;

class MeowCat {
protected:
    string name;
public:
    static int built;
    MeowCat(const string& n) : name(n) {
        built = built + 1;
        cout << "搭一份会的底座：" << name << endl;
    }
    void meow() const {
        cout << name << "：" << endl;
    }
};

int MeowCat::built = 0;

class Purr : public MeowCat {
public:
    Purr(const string& n) : MeowCat(n) {}
    void rename(const string& n) { name = n; }
    void purr() const { cout << name << "：输出输出" << endl; }
};

class Knead : public MeowCat {
public:
    Knead(const string& n) : MeowCat(n) {}
    void rename(const string& n) { name = n; }
    void knead() const { cout << name << "：踩踩踩" << endl; }
};

class Baby : public Purr, public Knead {
public:
    Baby(const string& n) : Purr(n), Knead(n) {}
};

int main() {
    Baby b("张三");
    cout << "底座份数 = " << MeowCat::built << endl;
    b.Purr::rename("小P");
    b.Purr::meow();
    b.Knead::meow();
    return 0;
}
```

```text
搭一份会的底座：张三
搭一份会的底座：张三
底座份数 = 2
小P：
张三：
```

**数一数第一行印了几遍：两遍。** 再数一数照出来的张三状态里有几份底座：`底座份数 = 2`。

形状画出来是这样的：底座在最上面，往左岔出一张、往右岔出一张，最后又被一个类定义拼回一个对象 —— 像一个**菱形**。所以这一手在书里常被叫做**菱形的那条岔路**。

- **为什么会两份**：左边那张类定义照着底座画过一次，**右边那张又照着底座画了一次**。它不是「接着左边画」，是各自照着底座画。左右各带一份底座进到最下面的对象状态里，于是两份。
- **这两份各过各的。** 我们用 `b.Purr::rename("小P")` 从**左边那条路**改了名字，于是左边输出是「小P」，右边输出还是「张三」。**同一个名字，两条路各有一份，改一份另一份纹丝不动。**
- **`b.Purr::meow()` 这种点着名字引用的写法**，就是岔路口上的路牌：告诉编译器「我们说的是左边那条路上那一份」。中间那一段 `Purr::` 就是路牌本身。

岔路口的问题就在这儿：**同一个底座，被两条路各带了一份。** 下面这段演示把它摊开给你看。

```demo
title: 菱形岔路口：底座先是两份，挂上 virtual 之后合并成一份
code:
| class MeowCat { ... };                          // 底座类定义：会的对象
| class Purr : public MeowCat { ... };            // 左边：会打输出
| class Knead : public MeowCat { ... };           // 右边：会踩初始化值
| class Baby : public Purr, public Knead { ... }; // 最后拼成一个两样都会的对象
| Baby b("张三");
| class Purr : virtual public MeowCat { ... };    // 左边挂上那一手（右边也照做）
| Baby b2("小P");

step 摊开底座类定义
at: 1
say: 先摊开底座 `MeowCat`：会的对象。一个类定义本身不占地，所以这会儿底座份数还是 0 —— 照着它做出来的对象才带底座。
meow: 基类 MeowCat 定义好了。
pose: welcome
底座份数 = 0
直接调用 = 还没轮到

step 左边那条路照着底座画下来
at: 2
say: 会打输出这张类定义照着底座画。从这一笔起，凡是照它做出来的对象，状态里都自带一份会的底座。
meow: Purr 继承 MeowCat。
pose: expect
底座份数 = 1
直接调用 = 还没轮到

step 右边那条路**也**照着同一张底座画
at: 3
say: 注意看：会踩初始化值这张**不是接着左边画的**，而是又照着底座画了一遍。底座这一份是两条路各自带的 —— 所以这是第二份。
meow: Knead 也继承 MeowCat。
pose: think
底座份数 = 2
直接调用 = 还没轮到

step 最后拼回一个对象
at: 4
say: 「两样都会」这张类定义照着左右两张一起画。它自己没碰底座，可左右两边各带一份进来 —— 两份都跟着落到它状态里了。
meow: Baby 同时继承两者，有两份基类。
pose: busy
底座份数 = 2
直接调用 = 说不清（两条路都找得到）

step 照它创建一个张三
at: 5
say: 真做出来的对象：左边那份底座先搭、左边那一半，再右边那份底座、右边那一半，最后才是它自己那一半 —— 「搭一份会的底座」会印两遍。
meow: 构造时基类部分构造两次。
pose: remind
底座份数 = 2
直接调用 = 说不清（两条路都找得到）

step 给照着画的那一行挂上 virtual
at: 6
say: 挂的地方是「照着底座画」的那一行：`class Purr : virtual public MeowCat`。写在 `public` 前面后面都行，但左右两条路都要挂。
meow: virtual 继承共用一份基类。
pose: guide
底座份数 = 2
直接调用 = 说不清（两条路都找得到）

step 再照它创建一个：底座只剩一份
at: 7
say: 这一回整个对象只留一份底座 —— 不管中间岔了几条路，挂过那一手的底座只搭一次，「直接调用」也不再说不清了。
meow: 虚继承后只有一份基类。
pose: yay
底座份数 = 1
直接调用 = 清楚（只剩一条路）
```

## 三、两条路都找得到，编译器说「说不清」

那要是不点路牌，直接调用 `b.meow()` 呢？我们真跑过：

```cpp
#include <iostream>
#include <string>
using namespace std;

class MeowCat {
protected:
    string name;
public:
    MeowCat(const string& n) : name(n) {}
    void meow() const {
        cout << name << "：" << endl;
    }
};

class Purr : public MeowCat {
public:
    Purr(const string& n) : MeowCat(n) {}
};

class Knead : public MeowCat {
public:
    Knead(const string& n) : MeowCat(n) {}
};

class Baby : public Purr, public Knead {
public:
    Baby(const string& n) : Purr(n), Knead(n) {}
};

int main() {
    Baby b("张三");
    b.meow();
    return 0;
}
```

```text
main.cpp:32:7: error: request for member 'meow' is ambiguous
```

编译器的原话是「**`meow` 说不清**」（`ambiguous` 就是「有好几种解释、我们挑不出来」）。

注意它说的**不是「没有」**：两条路上都找得到 `meow`，左边那份底座有、右边那份底座也有 —— 正因为**都找得到**，它才挑不出来。哪一份都不比另一份更该被选中。

这一跤有个好处：**它当场就拦住你**，程序根本编不出来。上一阶段那些「拆一半不报错」「改一处不吭声」的坑，起码不会在这儿出现。

那怎么把话说清楚？两条路：

1. **点路牌**：`b.Purr::meow()` —— 明说走左边那条路。缺点是每调用一次都得点，哪天忘了点，又是一模一样的报错。
2. **让底座只留一份** —— 只剩一条路，也就没什么可挑的了。这才是这一课的正主，下一节。

## 四、挂上 `virtual`，底座只留一份

给「照着底座画」的那一行挂上一个词：

```cpp
#include <iostream>
#include <string>
using namespace std;

class MeowCat {
protected:
    string name;
public:
    static int built;
    MeowCat(const string& n) : name(n) {
        built = built + 1;
        cout << "搭一份会的底座：" << name << endl;
    }
    void meow() const {
        cout << name << "：" << endl;
    }
};

int MeowCat::built = 0;

class Purr : virtual public MeowCat {
public:
    Purr(const string& n) : MeowCat(n) {}
    void rename(const string& n) { name = n; }
    void purr() const { cout << name << "：输出输出" << endl; }
};

class Knead : virtual public MeowCat {
public:
    Knead(const string& n) : MeowCat(n) {}
    void rename(const string& n) { name = n; }
    void knead() const { cout << name << "：踩踩踩" << endl; }
};

class Baby : public Purr, public Knead {
public:
    Baby(const string& n) : MeowCat(n), Purr(n), Knead(n) {}
};

int main() {
    Baby b("张三");
    cout << "底座份数 = " << MeowCat::built << endl;
    b.Purr::rename("小P");
    b.meow();
    b.purr();
    b.knead();
    return 0;
}
```

```text
搭一份会的底座：张三
底座份数 = 1
小P：
小P：输出输出
小P：踩踩踩
```

跟第二节那段一比，只多了两个词，输出全变了：

- **`class Purr : virtual public MeowCat`** —— 就在「照着底座画」那一行上，多挂一个 `virtual`。念作「照着底座画，**但这份底座整个对象里只留一份**」。
- **底座只搭了一次**：`底座份数 = 1`，而且「搭一份会的底座」只印了一遍。
- **`b.meow()` 不用点路牌了。** 只剩一条路，编译器再也不用挑。
- **改名字的影响面也变了**：还是从左边那条路改（`b.Purr::rename("小P")`），可这回三条路输出**全是小P** —— 因为从头到尾只有一份底座，左边改的就是大家看的那一份。

**规矩：左右两条路都要挂。** 只给一边挂上，岔路口还是说不清 —— 我们真跑过那种写法，编译器照样报 `request for member 'meow' is ambiguous`。那一边挂过的那份是共用的，可另一边还带着自己那份，状态里依旧是两份。

::: tip 提示
`virtual` 这个词你在上一阶段见过一次 —— 那次是挂在**函数**前面（「这一手别急着定死，看屋里住的是谁」）。这一次它挂在**照着画的那一行**上，管的是完全另一件事：「这份底座只留一份」。

同一个词，两个位子，两件事。看它挂在哪儿就知道在说哪件事。
:::

## 五、那份共用的底座，由最外面的类定义喂料

挂上 `virtual` 之后，多出一条新规矩：**那份共用的底座，由最外面那张类定义负责搭。**

```cpp
#include <iostream>
#include <string>
using namespace std;

class MeowCat {
protected:
    string name;
public:
    MeowCat(const string& n) : name(n) {
        cout << "搭那份共用的底座：" << name << endl;
    }
    void meow() const {
        cout << name << "：" << endl;
    }
};

class Purr : virtual public MeowCat {
public:
    Purr() : MeowCat("打输出的底座") {
        cout << "搭会打输出的那一半" << endl;
    }
    void purr() const { cout << name << "：输出输出" << endl; }
};

class Knead : virtual public MeowCat {
public:
    Knead() : MeowCat("踩初始化值的底座") {
        cout << "搭会踩初始化值的那一半" << endl;
    }
    void knead() const { cout << name << "：踩踩踩" << endl; }
};

class Baby : public Purr, public Knead {
public:
    Baby(const string& n) : MeowCat(n) {}
};

int main() {
    Baby b("张三");
    b.meow();
    cout << "---- 单独照会打输出那张画一个 ----" << endl;
    Purr p;
    p.meow();
    return 0;
}
```

```text
搭那份共用的底座：张三
搭会打输出的那一半
搭会踩初始化值的那一半
张三：
---- 单独照会打输出那张画一个 ----
搭那份共用的底座：打输出的底座
搭会打输出的那一半
打输出的底座：
```

看仔细，这里有一件「明明写了却被无视」的事：

- `Purr` 和 `Knead` 的构造函数里，**各自都写了一句话给底座喂料**：一个喂「打输出的底座」、一个喂「踩初始化值的底座」。
- 可拼装成 `Baby` 的时候，**这两句话都不算数**。第一行印的是「张三」—— 那是 `Baby` 自己那句 `MeowCat(n)` 传入的。共用的那份底座，只有**最外面那张类定义**说了算。
- 等我们**单独**照 `Purr` 画一个（`Purr p;`），它才是那个对象的最外面一个类定义 —— 于是它那一句「打输出的底座」立刻生效（最后三行）。**同一个构造函数，站在不同的位子上，说的话一个算数一个不算数。**
- **顺序也一并记住了**：共用的底座**最先**搭，然后左边、右边，最后自己那一半。输出前四行就是这个顺序。拆的时候正好倒过来：先拆自己那一半，最后才拆那份共用的底座。

那要是**忘了喂**呢？我们真跑过 —— 把 `Baby` 构造函数里那一小段 `MeowCat(n)` 删掉：

```cpp
#include <iostream>
#include <string>
using namespace std;

class MeowCat {
protected:
    string name;
public:
    MeowCat(const string& n) : name(n) {
        cout << "搭那份共用的底座：" << name << endl;
    }
    void meow() const {
        cout << name << "：" << endl;
    }
};

class Purr : virtual public MeowCat {
public:
    Purr(const string& n) : MeowCat(n) {}
    void purr() const { cout << name << "：输出输出" << endl; }
};

class Knead : virtual public MeowCat {
public:
    Knead(const string& n) : MeowCat(n) {}
    void knead() const { cout << name << "：踩踩踩" << endl; }
};

class Baby : public Purr, public Knead {
public:
    Baby(const string& n) : Purr(n), Knead(n) {}
};

int main() {
    Baby b("张三");
    b.meow();
    return 0;
}
```

```text
main.cpp:31:45: error: no matching function for call to 'MeowCat::MeowCat()'
```

编译器说的是「**找不到一个不用喂料的搭法**」：`Baby` 那句里没喂料，`Purr`、`Knead` 里写的那两句又**被无视了**，而底座那张类定义的构造函数**要求喂一个名字**（它没有「什么都不用喂」的那一种）—— 于是它当场停下。

注意这条报错**站的位置**：它指着 `Baby` 自己那一行。因为「最外面那张类定义负责喂料」这条规矩，责任也在它头上。

::: warn 注意
**这一跤有两种长相，第二种是安静的：**

- **底座要求喂料**（上面这段）→ 编不过。编译器当场拦你，这种最好办。
- **底座本来就有一个「什么都不用喂」的构造函数** → **一次都不吭**。我们真跑过：忘了喂照样编得过、跑得起来，只是底座里那一格用的是它自己默认的值（我们那次印出来是「(还没起名字)：」）。**安静地错，才是这一课最贵的坑。**

所以挂上 `virtual` 之后，第一件事就是回头看 `Baby` 那一行：**共用的底座，我们喂料了吗？**
:::

## 六、这笔账：多出来的块头，和什么时候别用它

两份底座不只是「名字说不清」的问题，它还**占地方**。我们把两种写法摆在一块儿量了一次：

```cpp
#include <iostream>
#include <string>
using namespace std;

class MeowCat {
protected:
    string name;
public:
    MeowCat(const string& n) : name(n) {}
};

class PurrPlain : public MeowCat {
public:
    PurrPlain(const string& n) : MeowCat(n) {}
};

class KneadPlain : public MeowCat {
public:
    KneadPlain(const string& n) : MeowCat(n) {}
};

class BabyPlain : public PurrPlain, public KneadPlain {
public:
    BabyPlain(const string& n) : PurrPlain(n), KneadPlain(n) {}
};

class PurrVirt : virtual public MeowCat {
public:
    PurrVirt(const string& n) : MeowCat(n) {}
};

class KneadVirt : virtual public MeowCat {
public:
    KneadVirt(const string& n) : MeowCat(n) {}
};

class BabyVirt : public PurrVirt, public KneadVirt {
public:
    BabyVirt(const string& n) : MeowCat(n), PurrVirt(n), KneadVirt(n) {}
};

int main() {
    cout << "两份底座那个对象的块头：" << sizeof(BabyPlain) << endl;
    cout << "合并成一份那个对象的块头：" << sizeof(BabyVirt) << endl;
    return 0;
}
```

```text
两份底座那个对象的块头：64
合并成一份那个对象的块头：48
```

（这两行是我们在这台机器上真跑出来的读数。左边的 64 里保存**两份**底座，右边的 48 里只装一份外加一点「记着那份共用在哪儿」的账本 —— 数字会随机器和写法变，记住**方向**就行：合并之后省下一整份底座。）

那是不是说明 `virtual` 一定更划算？**不是。** 它省下一份底座，代价是多了一层「先查账本、再找到那份共用的」的间接，而且多出一条「最外面的类定义负责喂料」的规矩要记。写代码的时候，这几件事要一起称一称：

| 情形 | 我们的建议 |
|---|---|
| 两样本事分在两张**不相干**的类定义上，你要的对象确实两样都是 | 该用 —— 这正是照着两张类定义画最拿手的活 |
| 只是想把现成的东西**再捡一点回来** | **别用**。单链的继承就够了，而且不会有岔路口 |
| 两条路最后要回到**同一张底座** | 两条路上**都挂上那一手**，让底座只留一份；不然就得处处点路牌 |
| 已经挂了那一手 | 记住：**共用的底座由最外面那张类定义喂料**，别指望里面那两句 |

::: tip 提示
今天记住六句话：

1. **`class Baby : public Purr, public Knead`** —— 照着两张类定义一起画，中间用逗号隔开，两边前面的 `public` 都不能省。
2. **初始化顺序按我们写的先后**，最后才是自己那一半；拆的时候正好倒过来。
3. **两条路都照着同一张底座画 = 岔路口**：状态里的底座有两份，名字也会说不清（`ambiguous`）。
4. **点路牌**（`b.Purr::meow()`）能说清走哪条路，但每调用一次都要点。
5. **挂上 `virtual`**（`class Purr : virtual public MeowCat`）—— 那份底座整个对象只留一份，两条路都要挂，挂完就能直接调用。
6. **挂过 `virtual` 之后，共用的底座由最外面那张类定义喂料**；忘了喂，要么编不过，要么安静地用上默认值。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `class Baby : public Purr, public Knead { ... };` | 照着两张类定义一起画 —— 两样本事都到手 |
| `class Purr : Cat { ... };` | **漏了 `public`** —— 上一阶段那一跤，两张类定义上都不能犯 |
| 初始化顺序 | 按写在后面的名单从左到右，**最后才是自己那一半** |
| 拆的顺序 | 正好倒过来：自己那一半先拆，共用的底座最后拆 |
| `b.Purr::meow();` | 岔路口上点路牌：我们说的是左边那条路上那一份 |
| `b.meow();`（岔路口上） | 两条路都找得到 —— 编译器报 `ambiguous`，程序编不出来 |
| `class Purr : virtual public MeowCat { ... };` | 照着底座画，但**这份底座整个对象只留一份** |
| 两条路只挂一条 | 不管用 —— 那一份共用了，另一条路上还带着自己那份，照样说不清 |
| `Baby(...) : MeowCat(n), Purr(n), Knead(n)` | 共用的底座由最外面那张类定义喂料；里面那两句会被无视 |
| 忘了喂料 | 底座要求喂 → 编不过；底座有默认搭法 → **一次不吭地用默认值** |
| `sizeof` 那两个数 | 两份底座 64、合并成一份 48（本机读数，方向比数字要紧） |

## 小任务

1. 把第二节那段抄进练习场跑一次，数一数「搭一份会的底座」印了几遍；再把左右两张类定义里**照着底座画的那一行**各加一个 `virtual`（顺便把 `Baby` 那一行的 `MeowCat(n)` 补上）跑一次，看它变成几遍。`b.Purr::rename("小P")` 那一句留着别删 —— 两次输出一比，你就亲眼看见「两份」和「一份」的差别了。
2. 把第三节那段抄进去，确认编译器真的报 `ambiguous`；然后把 `b.meow()` 换成 `b.Purr::meow();` 和 `b.Knead::meow();` 各一句，看它编不编得过、印出来是什么。**点路牌这一手能救急，但记住它治不了「两份底座」。**
3. 把第五节那段抄进去，然后把 `Baby` 构造函数里 `MeowCat(n)` 那一小段**删掉**再跑一次，把编译器的原话抄进记录表；再给底座添一个什么都不用喂的构造函数，重跑一遍 —— 这回它不吭声了，你猜输出会变成什么？
4. 先猜再跑：把第六节那段里，给底座再添一格 `int weight;`，那两个数会怎么变？先写下你的猜测，再真跑一次对照。想想看：为什么「合并成一份」的那个数**不是**简单地把两份加起来砍一半？

下一课我们要教你照 X 光：手里只有一张写着「对象」的名称时，怎么看清屋里住的到底是哪个对象 —— 那一手叫照 X 光看清是哪个对象（`dynamic_cast`） 
