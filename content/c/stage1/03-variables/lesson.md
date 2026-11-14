---
id: c-stage1-03
lang: c
stage: 1
order: 3
title: C 的变量与数据类型
tags: [变量, 类型]
required: [c-stage1-02]
crossRefs: [common-04, cpp-stage1-03, java-stage1-03, python-stage1-03]
estMinutes: 20
keywords: [int, double, char, 类型]
compare: [common-04]
---

## 学习目标

本课学习C 的变量与数据类型。重点包括声明、初始化与赋值、int、double 与 char、字符字面量与整数值、标识符与可读命名、类型不匹配诊断。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 声明、初始化与赋值

`int fish = 3;` 声明一个 int 类型的变量 fish，并把初值设为 3。类型、标识符、初始化表达式与末尾分号各有语法作用。后续赋值使用现有变量名，不重复声明；读取未初始化的自动存储期变量可能产生未定义行为。

```c
#include <stdio.h>

int main(void) {
    int fish = 3;
    printf("变量中存着 %d 条数据\n", fish);
    return 0;
}
```

```text
变量中存着 3 条数据
```

## int、double 与 char

int 用于整数，double 用于浮点数，char 表示一个字符单位。类型决定可表示的值、运算规则及存储要求；具体大小需要结合实现和 sizeof 判断，不能假定所有平台完全相同。输出时选择与参数类型对应的 printf 格式说明符。

```c
#include <stdio.h>

int main(void) {
    int fish = 3;
    double price = 2.5;
    char grade = 'A';
    printf("数据 %d 条\n", fish);
    printf("价钱 %.1f 元\n", price);
    printf("等级 %c\n", grade);
    return 0;
}
```

```text
数据 3 条
价钱 2.5 元
等级 A
```

以下是本节的另一段示例或诊断信息。

```c
#include <stdio.h>

int main(void) {
    printf("%f\n", 2.5);
    printf("%.2f\n", 2.5);
    printf("%f\n", 10.0 / 3.0);
    printf("%.2f\n", 10.0 / 3.0);
    printf("%.0f\n", 10.0 / 3.0);
    return 0;
}
```

```text
2.500000
2.50
3.333333
3.33
3
```

## 字符字面量与整数值

单引号界定字符字面量，双引号界定字符串字面量。char 参与整数运算时会发生整型提升。`%c` 按字符形式输出，`%d` 输出整数形式；字符编码值应按执行字符集理解。

```c
#include <stdio.h>

int main(void) {
    char grade = 'A';
    printf("%c\n", grade);
    printf("%d\n", grade);
    printf("%c\n", 66);
    return 0;
}
```

```text
A
65
B
```

## 标识符与可读命名

变量名区分大小写，不能以数字开头，不能使用保留关键字。优先采用可读的英文名称和一致风格。语言对扩展字符的支持与工具链有关，因此应区分规范允许范围与项目命名约定。

```c
#include <stdio.h>

int main(void) {
    int fish_2 = 3;
    int _cat = 5;
    int Fish = 7;
    int fish = 9;
    printf("%d %d %d %d\n", fish_2, _cat, Fish, fish);
    return 0;
}
```

```text
3 5 7 9
```

## 类型不匹配诊断

给变量提供不符合类型要求的表达式可能触发编译诊断。阅读错误时先确定声明类型和右侧表达式类型，再检查是否需要改变类型、格式或转换方式。示例中的错误程序用于观察编译器诊断，不应作为正确程序复制。

```c
#include <stdio.h>

int main(void) {
    int fish = "示例文本";
    printf("%d\n", fish);
    return 0;
}
```

```text
main.c: In function 'main':
main.c:4:16: error: initialization of 'int' from 'char *' makes integer from pointer without a cast [-Wint-conversion]
```

以下是本节的另一段示例或诊断信息。

```c
#include <stdio.h>

int main(void) {
    int 2fish = 3;
    printf("%d\n", 2fish);
    return 0;
}
```

```text
main.c: In function 'main':
main.c:4:9: error: invalid suffix 'fish' on integer constant
main.c:4:9: error: expected identifier or '(' before numeric constant
```

以下是本节的另一段示例或诊断信息。

```c
#include <stdio.h>

int main(void) {
    printf("%d\n", fish);
    return 0;
}
```

```text
main.c: In function 'main':
main.c:4:20: error: 'fish' undeclared (first use in this function)
```

以下是本节的另一段示例或诊断信息。

```c
#include <stdio.h>

int main(void) {
    char grade = "A";
    printf("%c\n", grade);
    return 0;
}
```

```text
main.c: In function 'main':
main.c:4:18: error: initialization of 'char' from 'char *' makes integer from pointer without a cast [-Wint-conversion]
```

## 浮点数转换为整数

浮点值转换为整数时会丢弃小数部分，而不是自动四舍五入。需要保留小数时使用适当浮点类型，并检查输出格式。超出目标整数类型可表示范围的转换还存在额外风险。

```c
#include <stdio.h>

int main(void) {
    int n = 2.9;
    printf("%d\n", n);
    return 0;
}
```

```text
2
```

以下是本节的另一段示例或诊断信息。

```demo
title: 2.9 是怎么变成 2 的
code:
| int n = 2.9;
| printf("%d\n", n);

step 挂上 int 类型，接过 2.9
at: 1
say: `int n = 2.9;` 一开场，编译器先看类型：`int` 该变量**只装整数**。可我们手里递过去的货是 `2.9` —— 带小数点的。此刻屋还是空的。
meow: int 只能保存整数，2.9 有小数。
pose: expect
n 屋里 = 还没装
我们手上 = 2.9
标准输出 = 还没印

step 类型说了算：2.9 进不去
at: 1
say: 类型不是贴好看的，**它决定了能剩下多少货**。整数屋的门只放得下整数，带零头的 `2.9` 得先改成整数才进得去。
meow: 需要先转换成整数。
pose: think
n 屋里 = 还没装
我们手上 = 2.9
标准输出 = 还没印

step 砍掉零头：2.9 变 2
at: 1
say: 关键就在这一下：**不是四舍五入，是直接砍**。`.9` 那半截被扔掉，我们手上只剩 `2`。**注意：这时候屋还是空的**，砍完还没往里装。
meow: 小数部分被直接截断。
pose: busy
n 屋里 = 还没装
我们手上 = 2
标准输出 = 还没印

step 把 2 装进 n 该变量
at: 1
say: 改成整数之后才装得进去，n 屋里从此放着 `2`。那半截 `.9` **再也回不来了** —— 而编译器从头到尾一个字都没说。
meow: n 保存的是 2。
pose: yay
n 屋里 = 2
我们手上 = （空）
标准输出 = 还没印

step 输出：屏幕上只有一个 2
at: 2
say: 最后 `printf("%d\n", n);` 把屋里的数输出 —— **2**，不是 2.9。翻得过去、跑得起来，安静得让人察觉不到出错。这种「不说话的错」比报错难查得多。
meow: 输出 2，编译器没有报错。
pose: think
n 屋里 = 2
我们手上 = （空）
标准输出 = 2
```

以下是本节的另一段示例或诊断信息。

```c
#include <stdio.h>

int main(void) {
    int fish;
    printf("%d\n", fish);
    return 0;
}
```

## 练习

声明数量、价格和字符变量，输出它们的值。再比较把 3.8 赋给 int 与赋给 double 的结果，并解释原因。
