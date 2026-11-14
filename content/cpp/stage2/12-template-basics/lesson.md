---
id: cpp-stage2-12
lang: cpp
stage: 2
order: 12
title: 模板初步
tags: [模板, 泛型, 类型推导]
required: ["cpp-stage2-11"]
crossRefs: []
estMinutes: 28
keywords: [template, typename, deduction, generic]
---

## 学习目标

本课学习模板初步。重点包括函数模板、模板参数推导、使用场景。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、类定义上留一个空位

```cpp
template <typename T>
T bigger(T a, T b) {
    return a > b ? a : b;
}
```

要紧的全在**上面那一行**：

```text
template <typename T>
```

它的意思是：**这张类定义上有一个空位，空位的代号叫 `T`**。至于 `T` 到底是整数、小数还是字符串 —— 我们**不写死**，留给塞料的人决定。

看清楚 `T` 出现在哪儿：它出现在**动作回来的那一款**上，也出现在**两个塞料**上。这三处是**同一个 `T`** —— 一个类定义上同一个代号，指的是同一个空位，这才是这张类定义能「量体裁衣」的根子。

它的正式名字是 模板（模板）。我们在本机真跑过这一个类定义：

```cpp
#include <iostream>
#include <string>
using namespace std;

template <typename T>
T bigger(T a, T b) {
    return a > b ? a : b;
}

int main() {
    cout << bigger(3, 5) << endl;
    cout << bigger(1.5, 2.5) << endl;
    cout << bigger(string("数据"), string("计算机")) << endl;
    return 0;
}
```

```text
5
2.5
计算机
```

**一段代码、一个类定义、三款料、三个答案。** 我们一个字都没为「整数版」和「小数版」分别写过。

这三份东西是**什么时候**出来的？我们拆成一步一步走给你看 —— 一路分清楚两件事：**类定义**，和**照料裁出来的那一份**：

```demo
title: 类定义先立空位，用到哪一款才裁哪一款
code:
| template <typename T>                                        // 立一个空位，代号 T
| T bigger(T a, T b) {
|     return a > b ? a : b;
| }
| cout << bigger(3, 5) << endl;                                // 第一次用：递两个整数
| cout << bigger(1.5, 2.5) << endl;                            // 第二次用：递两个小数
| cout << bigger(string("数据"), string("计算机")) << endl;   // 第三次用：递两条字符串

step 先立一个空位
at: 1
say: `template <typename T>` 立起一个空位，代号 `T`。**光有这一行，一份东西都不会生成** —— 空位是立给类定义的，不是立给某一款料的。
meow: 声明模板参数 T。
pose: expect
编译器裁出来的 = （一份都还没有）
这一次递的料 = （还没递）
标准输出 = 还没印

step 类定义上三处是同一个空位
at: 2
say: 看清 `T` 出现在哪儿：**回来的那一款**上、**两处塞料**上。三处是**同一个 `T`** —— 一个类定义上同一个代号，指的是同一个空位，这才是它能量体裁衣的根子。这会儿还是一份都没生成。
meow: 三处 T 必须是同一种类型。
pose: think
编译器裁出来的 = （还是一份都没有：光有类定义不算）
这一次递的料 = （还没递）
标准输出 = 还没印

step 第一次用它：照整数裁一份
at: 5
say: `bigger(3, 5)` 是我们第一次用它。编译器**这才**照着递进去的两个整数，裁出第一份：整数版。跑这一份，`a > b ? a : b` 印出 5。这一份是**照整数裁的**，跟别的料没关系。
meow: int 版本，输出 5。
pose: busy
编译器裁出来的 = 整数版（一份）
这一次递的料 = 两个整数 3、5
标准输出 = 5

step 第二次用它：另裁一份小数版
at: 6
say: 这一回递进去的是两个小数。已经裁出来的那一份是**照整数裁的**，它只认自己那一款 —— 所以编译器照着这两串小数**另裁一份**小数版，跑它，印出 2.5。**两份各管各的，谁也不串谁。**
meow: double 版本，输出 2.5。
pose: busy
编译器裁出来的 = 整数版 + 小数版（两份）
这一次递的料 = 两个小数 1.5、2.5
标准输出 = 2.5

step 第三次用它：再裁一份字符串版
at: 7
say: 递进去的是两条字符串（`string(...)` 是把它裹成一条字符串）。前两份都用不上，编译器再裁**第三份**，跑它，印出 计算机 —— **三款料，三份生成物。**
meow: string 版本，再生成一份。
pose: yay
编译器裁出来的 = 整数版 + 小数版 + 字符串版（三份）
这一次递的料 = 两条字符串
标准输出 = 计算机

step 回头看：一个类定义，三份
at: 7
say: 我们写下的只有那四行类定义 —— **类定义本身是一段跑不起来的东西**。是每一次「用它」的时候，编译器才照着递进去的料现裁一份；裁好的那一份会留着，下次递一样的料就不用再裁。
meow: 每种类型按需实例化。
pose: proud
编译器裁出来的 = 三份（各管各的，互不串门）
这一次递的料 = （三款都递完了）
标准输出 = 5、2.5、计算机（三行）
```

认出这一条就不会再绕：**类定义不是一段能跑的东西，它是一张留着空位的底稿**；编译器在看到你用它的时候，才照着递进去的料现裁一份 —— 三款料，三份各管各的。

## 二、我们不点名，编译器自己猜

上面三次输出，我们**一次都没说 `T` 是谁**：

| 我们塞进去的 | 编译器猜出来的 `T` | 印出来的 |
|---|---|---|
| `bigger(3, 5)` | 整数 | `5` |
| `bigger(1.5, 2.5)` | 小数 | `2.5` |
| `bigger(string("数据"), string("计算机"))` | 字符串 | `计算机` |

编译器干的这件事，叫**按料猜款式**：它盯着我们塞进去的东西，自己推出 `T` 该是什么。所以我们**平时根本不用写 `T`**，它猜得比我们快。

::: tip 提示
猜的规矩只有一条：**同一个类定义上同一个代号，几处必须凑得成同一款。**

`bigger(3, 5)` 里两处都是整数 —— 凑得成，猜 `T` = 整数。
`bigger(1.5, 2.5)` 里两处都是小数 —— 凑得成，猜 `T` = 小数。
可要是两处**不是同一款**，它就猜不出来了 —— 下一节第一个摔法就是这个。
:::

## 三、四种摔法

### 摔法一：两种料凑不到一起

我们写了一张加法类定义，然后传入两种料：

```cpp
#include <iostream>
using namespace std;

template <typename T>
T add(T a, T b) {
    return a + b;
}

int main() {
    cout << add(1, 2.5) << endl;
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:10:16: error: no matching function for call to 'add(int, double)'
```

编译器的原话是 `error: no matching function for call to 'add(int, double)'` —— 念作：「**你引用的这声 `add` 要的是同一种料，可你一手递的是整数、一手递的是小数，我们不知道 `T` 该算哪一款。**」

后面那一大串 `candidate` 和 `template argument deduction/substitution failed` 说的也是同一件事：**照这张类定义裁不出这么一个版本**。

修法有两条，我们都真跑过：

1. **把料凑成同一款**：`add(1.0, 2.5)` —— 两处都是小数。
2. **我们自己点名**：`add<double>(1, 2.5)` —— 尖括号里明写 `T` 是谁。

### 摔法二：漏了那一行

```cpp
#include <iostream>
using namespace std;

T add(T a, T b) {
    return a + b;
}

int main() {
    cout << add(2, 3) << endl;
    return 0;
}
```

```text
main.cpp:4:1: error: 'T' does not name a type
main.cpp:9:13: error: 'add' was not declared in this scope
```

编译器的原话是 `error: 'T' does not name a type` —— 念作：「**`T` 是什么东西？我们没见过这个名号。**」

因为**空位是 `template <typename T>` 那一行立出来的**：没有那一行，`T` 在我们眼里就只是一个凭空冒出来的字母。它后面还会跟一句 `error: 'add' was not declared in this scope` —— 类定义都没立起来，称呼它当然调用不着。

**记牢这一对：先立空位，再定义类。**

### 摔法三：点名之后，料被悄悄改小

我们真跑过这一段，屏幕上印出来的是两行：

```cpp
#include <iostream>
using namespace std;

template <typename T>
T add(T a, T b) {
    return a + b;
}

int main() {
    cout << add<int>(1, 2.5) << endl;
    cout << add<double>(1, 2.5) << endl;
    return 0;
}
```

```text
3
3.5
```

**两行的料一模一样，答案不一样。** 第一行我们点名 `T` = 整数，于是 `2.5` 被**悄悄改成 `2`** 才传入，算出来是 `3`；第二行点的是小数，才是我们心里那个 `3.5`。

这里**一次都不吭**：编译器不报错、不警告。因为「把小数塞进整数那一格」这件事它本来就允许 —— 只是我们点了名，它就不再替我们核实料对不对了。

::: warn 注意
**点名是件很硬气的事：我们说 `T` 是谁，它就把料硬塞进那一款里。** 平时能不点名就别点名 —— 让编译器按料自己猜，猜不出来它会拦下我们；我们一点名，它就不拦了。
:::

### 摔法四：换位换了个寂寞

我们想画一张「把两个东西换个个儿」的类定义：

```cpp
#include <iostream>
using namespace std;

template <typename T>
void swap2(T a, T b) {
    T t = a;
    a = b;
    b = t;
}

int main() {
    int x = 3;
    int y = 5;
    swap2(x, y);
    cout << x << " " << y << endl;
    return 0;
}
```

```text
3 5
```

**换了个寂寞。** 屏幕上还是 `3 5`，而且**一个错都不报**。

根子在塞料上：`T a, T b` 收的是**照料的样子又抄的一份**。类定义里那三行确实换得热火朝天，可换的是**两份抄件**，`x` 和 `y` 这两个真身从头到尾没被人碰过。

补法就是上一课那个记号 —— **加一个 `&`**：

```cpp
#include <iostream>
using namespace std;

template <typename T>
void swap2(T& a, T& b) {
    T t = a;
    a = b;
    b = t;
}

int main() {
    int x = 3;
    int y = 5;
    swap2(x, y);
    cout << x << " " << y << endl;
    return 0;
}
```

```text
5 3
```

一模一样的一段动作，只多了一个字符，屏幕上就真的换了。**类定义上留空的只是「料的款式」，`&` 这件事跟类定义没关系** —— 上一课的规矩，在这一课照样管用。

## 四、起名字要避开现成的

我们起初把那张比大小的类定义叫 `max`，结果：

```cpp
#include <iostream>
using namespace std;

template <typename T>
T max(T a, T b) {
    return a > b ? a : b;
}

int main() {
    int x = 3;
    int y = 5;
    cout << max(x, y) << endl;
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:12:16: error: call of overloaded 'max(int&, int&)' is ambiguous
```

编译器的原话是 `error: call of overloaded 'max(int&, int&)' is ambiguous` —— 念作：「**叫 `max` 的有两位，我们不知道该听谁的。**」

原因是我们头上一直写着 `using namespace std;` —— 它把现成那一位也叫 `max` 的函数**摊到了桌面上**。我们自己再画一张同名类定义，两位就撞上了。

修法最简单：**使用另一个名称**。我们把类定义叫 `bigger`，谁也不撞。（这也是我们这一课一开始就用 `bigger` 的原因。）

## 五、什么时候该画这类型定义

我们把话收成三条：

1. **同一套动作、好几款料 → 定义类。** 比大小、换位、挑最大的 —— 动作一个字都不变，只是料的款式不同，这就是它的主场。
2. **只有一款料 → 别硬画。** 我们这辈子只给整数比大小，那就直接写死整数版 —— 多一层空位、多一层猜，读的人反而更累。
3. **类定义是「照料的款式收」的**：塞进去的第一款料，就定下了整张类定义这一版长什么样。想换一款，就再调用一次、让它照新料再裁一版。

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `template <typename T>` | 立一个空位，代号 `T` —— 类定义上留的位子 |
| `T bigger(T a, T b)` | 空位出现在回来的那一款和两处塞料上，共用一个 `T` |
| `bigger(3, 5)` | 我们不点名，编译器按料猜 → `T` = 整数 |
| `bigger(1.5, 2.5)` | 同一个类定义，猜出来 `T` = 小数 |
| `bigger<int>(1, 2.5)` | 我们点名 `T` = 整数 —— `2.5` 被悄悄改成 `2` |
| `error: no matching function for call to 'add(int, double)'` | 两种料凑不到同一个空位上 |
| `error: 'T' does not name a type` | 漏了立空位的那一行 |
| `error: call of overloaded 'max(int&, int&)' is ambiguous` | 类定义名跟现成的函数撞了 |
| `swap2(T& a, T& b)` | 料要真改得动，`&` 不能漏（漏了它换的是抄件） |

## 小任务

1. 把第一节那段抄进练习场跑一次，确认屏幕上真是 `5`、`2.5`、`计算机` 三行。
2. 把 `bigger(1.5, 2.5)` 改成 `bigger(1.5, 2)` 再跑一次，看看编译器说什么。
3. 把摔法四那段抄进去、**先漏掉那个 `&`** 跑一次，确认屏幕上真是 `3 5`；再把 `&` 补上，看它变成 `5 3`。
4. 给第一节那张类定义**再塞一款新料**（比如一个字母 `'a'` 和一个字母 `'b'`），看看同一个类定义还能不能裁出来。我们不告诉你结果 —— 自己跑一次才知道。
5. 想一想：我们这张类定义，能不能裁**一整套「数据 + 函数」**，而不只是裁一款料？先记在心里。

下一课我们要把这张类定义用在**一整个盒子**上：一个类定义，裁出一整排**想装几个装几个、会自己变长**的格子。我们还会顺手教你怎么往里放、怎么往外拿。去下一课探险 
