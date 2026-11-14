---
id: cpp-stage2-13
lang: cpp
stage: 2
order: 13
title: 类模板与 vector 初步
tags: [模板, STL, vector]
required: ["cpp-stage2-12"]
crossRefs: []
estMinutes: 32
keywords: [class template, vector, push_back, size]
---

## 学习目标

本课学习类模板与 vector 初步。重点包括类模板、std::vector 常用操作。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、空位从函数挪到整张类定义上

上一课的空位立在**函数**那一行。今天我们把它立到**整张类定义**上：

```cpp
#include <iostream>
#include <string>
using namespace std;

template <typename T>
class Box {
public:
    Box(T x) : v(x) {}
    T get() { return v; }
private:
    T v;
};

int main() {
    Box<int> a(3);
    Box<string> b(string("数据"));
    cout << a.get() << endl;
    cout << b.get() << endl;
    return 0;
}
```

```text
3
数据
```

要紧的有两件事：

- **立空位那一行，一个字都没变**：还是 `template <typename T>`。上一课那句话在这一课照样管用 —— **先立空位，再定义类。**
- **空位落在了整张类定义上**：它落在盒子里那一格 `T v;`，也落在生类定义那一手和 `get` 那一手上。同一个 `T`，指的是同一个空位 —— 塞整数裁出来的是装整数的盒子，塞字符串裁出来的是装字符串的盒子。

它的正式名字是 类模板（整张类定义留个空位）。

::: tip 提示
**用整张类定义的时候，我们得自己点名。**

`Box<int> a(3);` —— 我们点名要整数款；`Box<string> b(...);` —— 我们点名要字符串款。

这跟上一条正好相反：上一课我们**不点名**，让编译器按料自己猜（裁的是函数）；这一课是**我们自己点名**（裁的是整张类定义）。
:::

::: warn 注意
编译器**这一课的类定义一概不猜**。我们在本机真跑过 `Box a(3);` 这一句 —— 料都递到它手边了，它照样当场拦下：`error: missing template arguments before 'a'`（`a` 前面那个空位我们没点名）。

上一课的**函数**它肯按料自己反推，这一课的**整张类定义**它一律不推（两个编译器上都量过）—— 所以我们用整张类定义的时候，**老老实实点名**是唯一的路。
:::

## 二、一个会自己变长的元素

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v;
    v.push_back(3);
    v.push_back(5);
    v.push_back(7);
    cout << v.size() << endl;
    cout << v[0] << endl;
    cout << v.back() << endl;
    for (int x : v) {
        cout << x << " ";
    }
    cout << endl;
    return 0;
}
```

```text
3
3
7
3 5 7
```

**我们一个格数都没写死。** 放三个进去它就是三格，放十只它就是十格 —— 它自己会长。这个元素的正式名字是 `std::vector`，我们平时写 `vector` 就够。

一句一句念：

| 我们写下的 | 它的意思 |
|---|---|
| `#include <vector>` | 端元素上桌 —— 这一句不能漏（漏了看摔法一） |
| `vector<int> v;` | 端一个**空元素**，元素里保存的是整数 |
| `v.push_back(3)` | 放一个进去，放在**最末尾** —— 元素自己长大一格 |
| `v.size()` | 元素里现在有几个 |
| `v[0]` | 第 0 格里的那一个（格子是从 0 数起的） |
| `v.back()` | **最后放进去**的那一个 |
| `for (int x : v) { }` | 一个一个挨着过一遍 |
| `v.pop_back()` | 把最后那一个**拿走** |
| `v.empty()` | 元素空不空（空是 `1`，不空是 `0`） |
| `v.clear()` | 一口气倒空 |

元素里那些格子是**怎么来的**？我们拆成一步一步走给你看：

```demo
title: 元素里的格子，是放一个长一格的
code:
| vector<int> v;                     // 端一个空元素
| v.push_back(3);                    // 放一个进去，放在最末尾
| v.push_back(5);
| v.push_back(7);
| cout << v.size() << endl;          // 元素里现在有几个
| cout << v[0] << endl;              // 第 0 格里的那一个
| cout << v.back() << endl;          // 最后放进去的那一个

step 端一个空元素
at: 1
say: `vector<int> v;` 是「端一个**空元素**，元素里保存的是整数」。这会儿元素里**一个格子都没有** —— 我们也没跟它说过「先摆三个空位」。
meow: 创建空的 vector<int>。
pose: expect
元素里有几格 = 0
元素里的数据 = （空元素）
元素自己管的地方 = （还没要地方）
标准输出 = 还没印

step 放第一个：先得要到一块地方
at: 2
say: `v.push_back(3)` 是「放一个进去，放在**最末尾**」。元素里一格都没有，它得**先要一块摆得下数据的地方**，才把 3 摆进第 0 格 —— **格子是放一个、长一格的**，不是一开始就摆好三个。
meow: push_back 分配空间，存入 3。
pose: busy
元素里有几格 = 1
元素里的数据 = 3
元素自己管的地方 = 刚要到一块（摆得下这一格）
标准输出 = 还没印

step 说句悄悄话：地方不够的时候
at: 2
say: 那块地方**不是要多大就永远多大**。等哪一次放进去、地方**一格空位都不剩**了，元素会**先另要一块更大的**，把已经放好的数据**原样搬过去**，再把原来那块**还掉**（用的就是前面学的「动态内存」那一手）—— 这一整套我们一行都没写。
meow: 容量不够时会重新分配并搬移。
pose: remind
元素里有几格 = 1
元素里的数据 = 3
元素自己管的地方 = 不够的时候：自己再要一块更大的
标准输出 = 还没印

step 再放一个
at: 3
say: 又放一个：**元素自己长大一格**。上一个摆在第 0 格，这一个就排在它后面，是第 1 格。元素里的数据排成了 3、5。
meow: 存入 5，共两个元素。
pose: busy
元素里有几格 = 2
元素里的数据 = 3 5
元素自己管的地方 = 我们没写，元素自己管
标准输出 = 还没印

step 第三个
at: 4
say: 再放一个，元素里 3 格。三个**都没指定过摆哪儿** —— `push_back` 一律摆在最末尾，格号就是它们进来的先后顺序。
meow: 存入 7，共三个元素。
pose: busy
元素里有几格 = 3
元素里的数据 = 3 5 7
元素自己管的地方 = 我们没写，元素自己管
标准输出 = 还没印

step 数一数：元素里现在有几个
at: 5
say: `v.size()` 问的是「元素里现在**有几个**」—— 3。它数的是**格数**，不是格号：格号从 0 数到 2，一共 3 格。
meow: size() 返回 3。
pose: yay
元素里有几格 = 3
元素里的数据 = 3 5 7
元素自己管的地方 = 我们没写，元素自己管
标准输出 = 3

step 第 0 步
at: 6
say: `v[0]` 返回的是**第 0 格**里那一个 —— 印出来也是 3，可它跟上一步那个 3 **不是一回事**：上一步说的是「有几个」，这一步说的是「第 0 格里的那一个」。格子是从 **0** 数起的。
meow: v[0] 是 3。
pose: think
元素里有几格 = 3
元素里的数据 = 3 5 7
元素自己管的地方 = 我们没写，元素自己管
标准输出 = 3

step 最后放进去的那一个
at: 7
say: `v.back()` 是「**最后放进去**的那一个」—— 7。它不看格号、只看谁排在最后；这件事也是元素自己记着的，我们一个格号都没写过。
meow: back() 是 7。
pose: proud
元素里有几格 = 3
元素里的数据 = 3 5 7
元素自己管的地方 = 我们没写，元素自己管
标准输出 = 7
```

一句话记住：**格子是放一个、长一格的** —— 我们一个格数都没写死；元素自己那块地方够不够、不够了去哪儿另要一块更大的、数据怎么搬过去，**全是它自己办**。

再看一遍「拿走」和「倒空」：

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v;
    for (int i = 1; i <= 5; i++) {
        v.push_back(i * i);
    }
    cout << v.size() << endl;
    v.pop_back();
    cout << v.size() << endl;
    cout << v.empty() << endl;
    v.clear();
    cout << v.empty() << endl;
    return 0;
}
```

```text
5
4
0
1
```

**「空不空」这件事，编译器是用 `0` 和 `1` 回答我们的**：`0` 是「不空」，`1` 是「空」。

::: warn 注意
元素有两种端法，赋值的东西**不一样**：

- `vector<int> a(3);` —— **圆括号**：先摆好 3 个空位（格子里是 3 个 `0`）。
- `vector<int> b{3};` —— **花括号**：放进去**一个 `3`**。

我们真跑过这一对：`a.size()` 印 `3`，`b.size()` 印 `1`。**一次不吭**，两种都编得过、跑得完 —— 端错了不会有人提醒我们，全靠自己盯着屏幕。
:::

**自己数着格号一格格走的时候，编译器会嘀咕一句。** 我们在本机真跑过这一段：

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v;
    v.push_back(3);
    for (int i = 0; i < v.size(); i++) {
        cout << v[i] << endl;
    }
    return 0;
}
```

```text
3
```

屏幕上印的 `3` 一点没错，可编译器在旁边嘀咕了这么一句：

```text
main.cpp:8:23: warning: comparison of integer expressions of different signedness: 'int' and 'std::vector<int>::size_type' {aka 'long long unsigned int'} [-Wsign-compare]
```

念作：「**你拿来当格号的那个 `int`、和元素里数的个数，不是同一款 —— 一个带正负、一个只会往正数长。**」

这个是一句嘀咕：程序照样跑完，屏幕上的答案照样对。想让它闭嘴，最省事的办法是**别自己数格号**，用 `for (int x : v)` 一个一个过 —— 那样我们根本不写格号。

## 三、把元素画进类定义里

```cpp
#include <iostream>
#include <vector>
using namespace std;

template <typename T>
class Pouch {
public:
    void put(T x) { goods.push_back(x); }
    int count() { return goods.size(); }
    T at(int i) { return goods[i]; }
private:
    vector<T> goods;
};

int main() {
    Pouch<int> p;
    p.put(3);
    p.put(5);
    cout << p.count() << endl;
    cout << p.at(0) << endl;
    Pouch<double> q;
    q.put(1.5);
    cout << q.at(0) << endl;
    return 0;
}
```

```text
2
3
1.5
```

**这一整只窝，是一个类定义裁出来的。** 元素里装什么（`vector<T>`）、`put` 收什么料、`at` 返回什么 —— 全是**同一个空位** `T`。我们点名整数，它就是一个整数窝；点名小数，它就换成一个小数窝。

同一个类定义，还能裁出两个**不一样的窝**放在一块儿：

```cpp
#include <iostream>
#include <string>
#include <vector>
using namespace std;

template <typename T>
class Pouch {
public:
    void put(T x) { goods.push_back(x); }
    int count() { return goods.size(); }
    T at(int i) { return goods[i]; }
private:
    vector<T> goods;
};

int main() {
    Pouch<int> nums;
    nums.put(3);
    nums.put(5);
    nums.put(7);
    Pouch<string> names;
    names.put(string("张三"));
    names.put(string("计算机"));
    cout << nums.count() << endl;
    cout << names.count() << endl;
    cout << names.at(0) << endl;
    return 0;
}
```

```text
3
2
张三
```

一个窝装整数、一个窝装名字牌，两张都出自同一个类定义。上一课的手感是「一个类定义裁好几款料」，这一课是「**一个类定义裁好几个窝**」。

::: tip 提示
**类定义里的函数，没人调用就不查。**

我们在本机真跑过这么一个类定义：里面有一手写错了（把一句话塞进「只有整数才装得下」的那一格），可 `main` 里**一次都没称呼它** —— 编译器**一个字都没说**，程序跑完，屏幕上印 `跑完了`。

等我们真的称呼它一次，它才报 `error: invalid conversion from 'const char*' to 'int'`，还带一句「就是这个空位、就是这一手」。

意思就是：**类定义是照料的款式裁的，我们不裁它、它就不查。** 一张很少被用到的类定义里藏着错，可能很久都不会露头 —— 这也是为什么我们平时总要把每张类定义都调用一遍。
:::

## 四、四种摔法

### 摔法一：元素没端上桌

```cpp
#include <iostream>
using namespace std;

int main() {
    vector<int> v;
    v.push_back(3);
    cout << v.size() << endl;
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:5:5: error: 'vector' was not declared in this scope
main.cpp:2:1: note: 'std::vector' is defined in header '<vector>'; this is probably fixable by adding '#include <vector>'
```

编译器的原话是 `error: 'vector' was not declared in this scope` —— 念作：「**`vector` 是什么东西？我们没见过这个名字。**」它后面还贴心地跟了一句 `note`，把该添的那一行原样输出：`'std::vector' is defined in header '<vector>'; this is probably fixable by adding '#include <vector>'`。

修法就是**把元素端上桌**：在文件最上面补一行 `#include <vector>`。

### 摔法二：函数画在类定义外，漏了立空位那一行

```cpp
#include <iostream>
using namespace std;

template <typename T>
class Box {
public:
    Box(T x) : v(x) {}
    T get();
private:
    T v;
};

T Box<T>::get() {
    return v;
}

int main() {
    Box<int> a(7);
    cout << a.get() << endl;
    return 0;
}
```

```text
main.cpp:13:1: error: 'T' does not name a type
```

编译器的原话是 `error: 'T' does not name a type` —— 念作：「**`T` 是什么东西？我们没见过这个名号。**」

为啥？因为**空位是 `template <typename T>` 那一行立出来的**。类定义里面写的时候，我们站在类定义上，`T` 看得见；可我们跑到类定义外面来画这一手，**空位就不在手边了** —— 得在它上面**重新立一次**：

```cpp
#include <iostream>
using namespace std;

template <typename T>
class Box {
public:
    Box(T x) : v(x) {}
    T get();
private:
    T v;
};

template <typename T>
T Box<T>::get() {
    return v;
}

int main() {
    Box<int> a(7);
    cout << a.get() << endl;
    return 0;
}
```

```text
7
```

**记牢这一对：类定义里面画函数，我们站在类定义上；跑到类定义外面画，立空位那一行要再写一遍。**

### 摔法三：不点名

```cpp
#include <iostream>
using namespace std;

template <typename T>
class Box {
public:
    Box(T x) : v(x) {}
    T get() { return v; }
private:
    T v;
};

int main() {
    Box b;
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:14:9: error: missing template arguments before 'b'
```

编译器的原话是 `error: missing template arguments before 'b'` —— 念作：「**`b` 前面那个空位没点名 —— 你还没告诉我们它该是哪一款料做的。**」

上一课的**函数**它能按料反推空位；这一课的**类定义**它不推 —— 我们不点名，当场拦下。补一句：就算把料递进去它也不推（上面「注意」那段真跑过）。

修法就是**点名**，同时把这一手要的那个料递进去：`Box<int> b(3);`。

### 摔法四：空元素里减一

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v;
    cout << v.size() << endl;
    cout << v.size() - 1 << endl;
    return 0;
}
```

```text
0
18446744073709551615
```

我们想算「最后一个格子是第几号」—— 元素里几个数、减 1 就是它。空元素的时候我们心里想的是「一个格子都没有，那就印 `0` 吧」，可屏幕上印出来的是 **`18446744073709551615`**。

根子在元素里那个「个数」的脾气上：它**只会往正数长，不会变负**。`0` 再减 `1`，它不往回绕成 `-1`，而是绕到了这一款能表示的**最大值**去。

**这一路一个错都不报**：编译器安安静静让程序跑完了。要防它，动手减之前先问一句元素空不空：

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v;
    int n = 0;
    if (!v.empty()) {
        n = v.size() - 1;
    }
    cout << n << endl;
    v.push_back(3);
    v.push_back(5);
    if (!v.empty()) {
        n = v.size() - 1;
    }
    cout << n << endl;
    return 0;
}
```

```text
0
1
```

**先问一句 `v.empty()`，再动手减** —— 空元素就老老实实待在 `0`，不往最大值那边绕。

## 五、什么时候该给整张类定义留空位

我们把话收成三条：

1. **一整套（元素 + 好几手）、好几款料 → 留空位。** 我们这一课的窝就是：元素里装什么、放进去什么、返回什么，全是同一个空位。
2. **只是几款料换来换去、身上没有元素 → 上一课那种函数类定义就够了。** 别为了比个大小去画一整张类定义。
3. **只有一款料 → 别留空位。** 我们这辈子只装整数，那直接用现成的 `vector<int>` 就好，最省事也最好读。

还有一句要紧的：**先看看现成的够不够用。** `vector` 本身就是别人画好的一个类定义 —— 装什么料都能裁（`vector<int>`、`vector<string>`、`vector<double>`）。我们真要自己画一整张的时候，是「**元素 + 我们自己那几手**」要打包成一个整体的时候。

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `template <typename T> class Pouch { ... };` | 整张类定义留一个空位，代号 `T` |
| `Pouch<int> p;` | 用整张类定义时**自己点名**：整数款 |
| `Pouch<int>` / `Pouch<string>` | 同一个类定义裁两款（整数窝 / 名字窝） |
| `p.put(3)` / `p.count()` / `p.at(0)` | 类定义自己的几手 —— 放料 / 数数 / 取第几个 |
| `#include <vector>` | 端元素上桌，不能漏 |
| `vector<int> v;` | 端一个装整数的空元素 |
| `v.push_back(3)` | 放到最末尾，元素自己长大一格 |
| `v.size()` / `v[0]` / `v.back()` | 有几个 / 第 0 格 / 最后放进去的那个 |
| `for (int x : v) { }` | 一个一个挨着过 |
| `v.pop_back()` / `v.empty()` / `v.clear()` | 拿走最后一个 / 空不空 / 一口气倒空 |
| `error: 'vector' was not declared in this scope` | 漏了 `#include <vector>` |
| `error: 'T' does not name a type` | 函数画在类定义外，漏了立空位那一行 |
| `error: class template argument deduction failed:` | 用整张类定义时一个料都不给 |
| `18446744073709551615` | 空元素里减一 —— 绕到最大值去了 |

## 小任务

1. 把第一节那段抄进练习场跑一遍，确认屏幕上真是 `3`、`数据` 两行。
2. 把 `Box<int> a(3);` 那一句改成 `Box a(3);` 再跑一次 —— 编译器照样认。再把圆括号里的料去掉（写成 `Box b;`）跑一次，看看它说什么。
3. 把 `vector<int> b{3};` 换成 `vector<int> b(3);` 再跑一次，看 `b.size()` 印出来是几。
4. 往元素里放五个，再用 `v.clear()` 倒空，确认 `v.empty()` 印的是 `1`。
5. 想一想：我们这张 `Pouch` 类定义上，`at` 那一手能不能改成「把第 i 个**换掉**」？改起来会多出什么麻烦？先记在心里。

下一课我们要办一场大工程：把今天这个元素、上一课那张类定义，再加上前面学过的**名称**、**约定**，全用在一块儿 —— 给一变量对象做一套**学生信息管理系统**。类定义、元素、菜单怎么摆到一块儿，去下一课探险 
