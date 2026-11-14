---
id: cpp-stage3-08
lang: cpp
stage: 3
order: 12
title: 移动语义与右值引用
tags: [现代 C++, 内存]
required: ["cpp-stage3-07"]
crossRefs: []
estMinutes: 26
keywords: [移动语义, 右值引用, move, 移动构造, 拷贝构造, 性能]
---

## 学习目标

本课学习移动语义与右值引用。重点包括复制与移动的区别、std::move 的作用、移动后对象的有效性、移动操作与复制回退、容器中的移动。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 复制与移动的区别

复制通常产生具有独立值语义的目标对象；移动允许在类型契约允许时转移内部资源。移动不保证完全没有数据复制，其成本取决于类型实现和所保存内容。示例通过构造函数中的日志区分选择了哪种操作。

```cpp
#include <iostream>
#include <string>
using namespace std;

struct Box {
    string goods;
    Box(string g) : goods(g) { cout << "装好 " << goods << endl; }
    Box(const Box& other) : goods(other.goods) { cout << "拷贝一份 " << goods << endl; }
    Box(Box&& other) : goods(move(other.goods)) { cout << "移动构造 " << goods << endl; }
};

int main() {
    Box a("数据");
    Box b = a;
    Box c = move(a);
    cout << b.goods << " / " << c.goods << endl;
    return 0;
}
```

```text
装好 数据
拷贝一份 数据
移动构造 数据
数据 / 数据
```

下面是另一段示例或诊断对照。

```demo
title: 两条路：抄一份，还是搬过去
code:
| struct Box {
|     string goods;
|     Box(string g) : goods(g) { cout << "装好 " << goods << endl; }
|     Box(const Box& other) : goods(other.goods) { cout << "拷贝一份 " << goods << endl; }
|     Box(Box&& other) : goods(move(other.goods)) { cout << "移动构造 " << goods << endl; }
| };
|
| int main() {
|     Box a("数据");
|     Box b = a;
|     Box c = move(a);
|     cout << b.goods << " / " << c.goods << endl;
| }

step 生 a：构造函数印「装好 数据」
at: 9
say: 第 9 行 `Box a("数据");` —— a 初始化，构造函数当场跑，印出「装好 数据」。记住一件事：**a 是个活着的名字**，这一点是下面挑路的关键。
meow: 创建 a。
pose: expect
a 手里的货 = 一条长数据
b 手里的货 = （还没有 b）
c 手里的货 = （还没有 c）
走的是哪条路 = （还没走）

step b = a：a 还活着，只能走「抄一份」那条
at: 10
say: 第 10 行要照抄一个。类定义上摆着**两条路**：第 4 行 `Box(const Box&)` 是「抄一份」，第 5 行 `Box(Box&&)` 是「搬过去」。`a` 是个**还活着的名字**（最后一行还要拿它印字），这份货丢不得 —— 于是挑「抄一份」那条。
meow: b 由 a 拷贝构造。
pose: think
a 手里的货 = 一条长数据
b 手里的货 = （正在抄）
c 手里的货 = （还没有 c）
走的是哪条路 = 抄一份那条（第 4 行）

step 第 4 步
at: 4
say: 跳到第 4 行。`goods(other.goods)` 干的是「**照着 a 那条长数据另抄一份**」—— 抄完就有了两条：a 手里一条，新抄的这条先捏在手里。印出「拷贝一份 数据」。
meow: 拷贝构造复制一份数据。
pose: busy
a 手里的货 = 一条长数据
b 手里的货 = 刚抄好的一条
c 手里的货 = （还没有 c）
走的是哪条路 = 抄一份那条（刚抄完）

step 落回第 10 行：b 接住抄出来的那份
at: 10
say: 照抄函数跑完，落回第 10 行，`b` 接住抄出来的那一份。现在 **a、b 手里各有各的一条**，是两条货 —— 这就是拷贝那条路的样子。
meow: a 和 b 各有一份。
pose: yay
a 手里的货 = 一条长数据
b 手里的货 = 抄来的一份
c 手里的货 = （还没有 c）
走的是哪条路 = 抄一份那条（走完了）

step 打招呼：move(a) 只改名分，什么都没搬
at: 11
say: 第 11 行 `Box c = move(a);` —— `move(a)` 念作「转换为可参与移动重载选择的表达式」。**注意这一步尚未由 std::move 自身执行资源转移**：长数据还在 a 手里，它只是把 `a` 的**名分**从「我们还要用」改成了「允许选择移动操作」。
meow: move(a) 让移动构造可被选中。
pose: think
a 手里的货 = 一条长数据（名分改成「允许选择移动操作」）
b 手里的货 = 抄来的一份
c 手里的货 = （还没有 c）
走的是哪条路 = （还没挑）

step 第 5 步
at: 5
say: 有了这个招呼，编译器就挑中第 5 行那条 **`Box&&`** 的近路：`goods(move(other.goods))` —— 长数据**过手**给新盒子，**按该类型的移动实现处理资源**。印的是「移动构造 数据」。
meow: 移动构造接管 a 的内容。
pose: busy
a 手里的货 = （过手给 c 了，空了）
b 手里的货 = 抄来的一份
c 手里的货 = 刚接过手的那一份
走的是哪条路 = 搬过去那条（第 5 行）

step 落回第 11 行：c 接住过手过来的货
at: 11
say: 落回第 11 行，`c` 接住过手过来的长数据。**同一份货，换了主人** —— 从 a 手里过到了 c 手里，中间没有第二条被造出来。
meow: c 得到数据，没有再复制。
pose: yay
a 手里的货 = （空了，剩个空壳）
b 手里的货 = 抄来的一份
c 手里的货 = 过手过来的那一份
走的是哪条路 = 搬过去那条（走完了）

step 印两样：看着一样，来路不同
at: 12
say: 第 12 行印出 `数据 / 数据`。两样看着一模一样，来路却完全不同：`b` 手里是**抄来的**，`c` 手里是**过手来的**；而 `a` 已经剩个空壳了 —— 搬过的名字就别再拿它取货。
meow: 输出 b 和 c。
pose: yay
a 手里的货 = （空了，别再拿它取货）
b 手里的货 = 抄来的一份
c 手里的货 = 过手过来的那一份
走的是哪条路 = （两条都走完了）

step main 到头：屏幕上就这四行
at: 13
say: `main` 的括号到头，屏幕上正好四行，和上面 TEXT 对得上。回头想一句：**要是类定义上没画第 5 行那条近路**，`Box c = move(a);` 会退回去走拷贝那条，「移动构造」就永远不会印出来 —— 招呼白打。
meow: 程序结束，四行输出完成。
pose: proud
a 手里的货 = （空了，别再拿它取货）
b 手里的货 = 抄来的一份
c 手里的货 = 过手过来的那一份
走的是哪条路 = （两条都走完了）
```

## std::move 的作用

std::move 本身不转移资源，它把表达式转换为可参与移动重载选择的值类别。是否发生移动，由后续选择的构造函数或赋值运算符决定；也可能调用复制操作。

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string a = "好长好长的一条数据";
    string b = move(a);
    cout << "b 拿到：" << b << endl;
    cout << "a 还剩几个字：" << a.size() << endl;
    return 0;
}
```

```text
b 拿到：好长好长的一条数据
a 还剩几个字：0
```

## 移动后对象的有效性

移动后的源对象仍有生命周期。标准库对象通常保持有效但状态未指定，应仅执行其当前状态满足前置条件的操作，例如销毁或重新赋值。不能断言旧名称不能使用，也不能把某次 string 运行后长度为零当作所有类型的通用保证。

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> a = {1, 2, 3};
    int* before = a.data();
    vector<int> b = move(a);
    cout << "b 现在有几件：" << b.size() << endl;
    cout << "a 现在有几件：" << a.size() << endl;
    cout << "变量还是同一间吗：" << (b.data() == before ? "是" : "不是") << endl;
    return 0;
}
```

```text
b 现在有几件：3
a 现在有几件：0
变量还是同一间吗：是
```

## 移动操作与复制回退

如果类型没有适用的移动操作，接收该表达式的操作可能选择复制。自定义移动构造和移动赋值时，应维护类不变量，并避免资源重复释放。根据类型特征正确使用 noexcept 可影响容器的操作选择。

```cpp
#include <iostream>
#include <string>
using namespace std;

struct Box {
    string goods;
    Box(string g) : goods(g) { cout << "装好 " << goods << endl; }
    Box(const Box& other) : goods(other.goods) { cout << "拷贝一份 " << goods << endl; }
};

int main() {
    Box a("数据");
    Box b = move(a);
    return 0;
}
```

```text
装好 数据
拷贝一份 数据
```

## 容器中的移动

把对象放入容器时，传入的值类别与构造函数集合会影响复制或移动选择。push_back、emplace_back 的差别应结合参数与目标类型理解，不是固定保证某个调用永远零复制。

```cpp
#include <iostream>
#include <string>
#include <vector>
using namespace std;

int main() {
    vector<string> basket;
    string s = "好长好长的一条数据";
    basket.push_back(s);
    basket.push_back(move(s));
    cout << basket[0] << " / " << basket[1] << endl;
    cout << "s 还剩几个字：" << s.size() << endl;
    return 0;
}
```

```text
好长好长的一条数据 / 好长好长的一条数据
s 还剩几个字：0
```

## 术语对照

左值和右值是表达式分类，引用类型与表达式类别应区分。std::move 是转换，移动构造是初始化新对象，移动赋值则更新已有对象。源对象状态按相应类型契约处理。



## 练习

为自定义类型记录复制和移动构造日志，比较传入左值与 std::move 后表达式的结果。移动后重新给源对象赋值并安全使用它，说明为什么源对象并未消失。
