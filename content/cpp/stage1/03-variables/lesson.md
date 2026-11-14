---
id: cpp-stage1-03
lang: cpp
stage: 1
order: 3
title: C++ 的变量与数据类型
tags: [变量, 类型]
required: [cpp-stage1-02]
crossRefs: [common-04, c-stage1-03, java-stage1-03, python-stage1-03]
estMinutes: 22
keywords: [int, double, bool, string, const]
compare: [common-04]
---

## 学习目标

本课学习C++ 的变量与数据类型。重点包括声明与初始化、常见基础类型、标识符与命名、const 与不可修改对象、类型转换与错误诊断。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 声明与初始化

C++ 变量声明包含类型和名称，可以同时给出初值。初始化与后续赋值是不同阶段；优先显式初始化变量。表达式先按语言规则求值，再根据目标类型进行必要转换。

```cpp
int fish = 3;
```

以下是本节的另一段示例或诊断信息。

```cpp
#include <iostream>
using namespace std;

int main() {
    int fish = 3;
    cout << fish << endl;
    return 0;
}
```

```text
3
```

## 常见基础类型

int、double、char、bool 和 string 分别用于常见的整数、浮点数、字符、布尔值与文本。string 是标准库类型，需要相应头文件及命名空间限定。字符与字符串的引号形式不同。

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int fish = 3;
    double price = 2.5;
    char grade = 'A';
    bool hungry = true;
    string name = "计算机";

    cout << fish << endl;
    cout << price << endl;
    cout << grade << endl;
    cout << hungry << endl;
    cout << name << endl;
    return 0;
}
```

```text
3
2.5
A
1
计算机
```

以下是本节的另一段示例或诊断信息。

```cpp
#include <iostream>
using namespace std;

int main() {
    int fish;
    fish = 3;
    fish = fish + 1;
    cout << fish << endl;
    return 0;
}
```

```text
4
```

以下是本节的另一段示例或诊断信息。

```demo
title: 这段「搬运」是按什么顺序走的
code:
| int fish;
| fish = 3;
| fish = fish + 1;
| cout << fish << endl;

step 盖屋挂牌：屋里还空着
at: 1
say: `int fish;` 只干一件事 —— 盖一个变量、挂上 `int` 的名称，屋里**什么都还没装**。留个心：空屋里的东西**不是 0**（课末那间 warn 专门讲它）。
meow: 声明 fish，还没有赋值。
pose: expect
fish 屋里 = 还空着（不是 0）
我们手上 = （空）
标准输出 = 还没印

step 第一次搬运：把 3 搬进去
at: 2
say: `fish = 3;` 读作「**把右边的货搬进左边该变量**」。这里没有「等于」这回事，只有一个动作。屋里从此保存 3。
meow: 把 3 存入 fish。
pose: busy
fish 屋里 = 3
我们手上 = （空）
标准输出 = 还没印

step 轮到下一句：先看等号右边
at: 3
say: 又出现一个 `=`。电脑的规矩是**先把右边看完**：右边那个 `fish` 是引用名称，把屋里的货读取 —— 取到的是 **3**。**此刻屋里还是 3，一点没动。**
meow: 先读取 fish，取到 3。
pose: busy
fish 屋里 = 3
我们手上 = 3
标准输出 = 还没印

step 右边算完：3 + 1 得 4
at: 3
say: 读取的 3 加上 1，右边算完是 **4**，先捏在我们手上。**这一步屋里还是 3** —— 数学里的 `fish = fish + 1` 是胡说八道，可搬运还没开始。
meow: 3 + 1 = 4，还没存回去。
pose: busy
fish 屋里 = 3
我们手上 = 4
标准输出 = 还没印

step 再搬回左边同一个变量
at: 3
say: 右边**全部算完**，才把 4 搬回左边该变量。原来的 3 **被顶掉**，屋里换成 4 —— 同一个变量，先后保存两个不同的数，这就是「搬运」而不是「相等」。
meow: 把 4 存回 fish。
pose: yay
fish 屋里 = 4
我们手上 = （空）
标准输出 = 还没印

step 输出：4
at: 4
say: 最后 `cout << fish << endl;` 引用名称，把屋里的货递到屏幕上 —— **4**。四门语言这段跑出来都是这个 4，差别只在搬运的规矩严不严。
meow: 输出 4。
pose: proud
fish 屋里 = 4
我们手上 = （空）
标准输出 = 4
```

## 标识符与命名

名称区分大小写，不能以数字开头或使用保留关键字。选择能表达含义的名称，避免只为缩短代码而使用难以理解的缩写。编码和命名应符合项目的统一约定。

```cpp
#include <iostream>
using namespace std;

int main() {
    int 3fish = 3;
    cout << 3fish << endl;
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:5:9: error: expected unqualified-id before numeric constant
```

## const 与不可修改对象

const 用于表达初始化后不通过该对象修改值的约束。const 变量通常需要初始化，随后对它直接赋值会被拒绝。注意 const 修饰对象、指针本身或指针所指类型时，含义并不相同。

```cpp
const int maxFish = 10;
```

以下是本节的另一段示例或诊断信息。

```cpp
#include <iostream>
using namespace std;

int main() {
    const int maxFish = 10;
    maxFish = 20;
    cout << maxFish << endl;
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:6:13: error: assignment of read-only variable 'maxFish'
```

## 类型转换与错误诊断

编译器会检查表达式和目标类型是否兼容。数值转换可能丢失精度；字符串不能随意当作整数使用。阅读错误时定位最先报告的相关行，并检查声明、字面量和输出表达式。

```cpp
#include <iostream>
using namespace std;

int main() {
    int fish = 3;
    fish = "示例文本";
    cout << fish << endl;
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:6:12: error: invalid conversion from 'const char*' to 'int' [-fpermissive]
```

以下是本节的另一段示例或诊断信息。

```cpp
#include <iostream>
using namespace std;

int main() {
    int fish;
    cout << fish << endl;
    return 0;
}
```

## 练习

定义数量、单价、字符和状态变量，输出它们的值。给常量赋值的错误示例用于观察诊断，不要把它改写为可变变量来绕过 const 的含义。
