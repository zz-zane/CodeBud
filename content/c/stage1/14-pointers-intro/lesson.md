---
id: c-stage1-14
lang: c
stage: 1
order: 14
title: 初识指针
tags: [指针, 地址, 解引用]
required: ["c-stage1-13"]
crossRefs: []
estMinutes: 25
keywords: [pointer, address, dereference, ampersand]
---

## 学习目标

本课学习初识指针。重点包括通过指针读取与修改变量、指针的声明与类型、指针参数、空指针、未初始化指针与生命周期、地址与值对照。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```c
#include <stdio.h>

int main(void) {
    int fish = 5;
    int *p = &fish;

    printf("%d\n", p == &fish);
    printf("%d\n", *p);
    return 0;
}
```

```text
1
5
```

## 通过指针读取与修改变量

指针保存对象的地址。`&fish` 获取变量 `fish` 的地址，`int *p = &fish;` 用该地址初始化一个整型指针。对有效的 `p` 使用 `*p` 可以访问它所指向的整数；执行 `*p = 99;` 会修改原变量 `fish` 的值，而不是修改指针本身保存的地址。

```c
#include <stdio.h>

int main(void) {
    int fish = 5;
    int *p = &fish;

    *p = 99;
    printf("%d\n", fish);
    return 0;
}
```

```text
99
```

```demo
title: 一块名称是怎么改到原元素的
code:
| int fish = 5;
| int *p = &fish;
| *p = 99;
| printf("%d\n", fish);

step 先摆一个元素
at: 1
say: 变量 fish 已初始化为 5。fish 的值与它占用存储空间的地址是不同概念。
meow: fish 的值是 5。
pose: expect
fish = 5
p = 未声明
*p 的值 = 未解引用

step 去问地址
at: 2
say: 表达式 &fish 取得 fish 的地址，不是读取 fish 中保存的整数 5。
meow: &fish 取得 fish 的地址。
pose: think
fish = 5
p = 未声明
*p 的值 = 未解引用
&fish = fish 的地址

step 把名称立起来
at: 2
say: 声明 int *p = &fish 创建整型指针 p，并把 fish 的地址赋给它；p 与 fish 是两个不同变量。
meow: p 保存 fish 的地址。
pose: busy
fish = 5
p = &fish
*p 的值 = 未解引用

step 顺着名称看一眼
at: 3
say: 表达式 *p 解引用有效指针 p，访问其所指向的 fish。此时读取到 5，并未修改 fish 或 p。
meow: *p 访问 p 指向的 fish。
pose: think
fish = 5
p = &fish
*p 的值 = 5

step 顺着名称放东西
at: 3
say: 赋值 *p = 99 修改 p 指向的整数对象，所以 fish 的值变为 99；p 保存的地址不变。
meow: *p = 99 把 fish 改成 99。
pose: yay
fish = 99
p = &fish
*p 的值 = 99

step 印的是 fish，出来的却是 99
at: 4
say: printf 直接读取 fish，输出 99。这验证通过 *p 的修改确实作用于原变量。
meow: 输出 fish：99。
pose: proud
fish = 99
p = &fish
*p 的值 = 99
印出来 = 99
```

```c
#include <stdio.h>

int main(void) {
    int fish = 5;
    int *p = &fish;
    int *q = p;

    *q = 42;
    printf("%d\n", fish);
    printf("%d\n", *p);
    return 0;
}
```

```text
42
42
```

## 指针的声明与类型

在声明 `int *p` 中，`p` 的类型是指向 int 的指针。注意声明中的 `*` 与表达式中的解引用操作所处语境不同。指针类型决定解引用时访问的数据类型，也影响指针算术的步长。

```c
#include <stdio.h>

int main(void) {
    int a = 1, b = 2;
    int *p, q;

    p = &b;
    q = 7;
    printf("%d %d %d\n", a, *p, q);
    return 0;
}
```

```text
1 2 7
```

## 指针参数

C 函数参数按值传递；传递指针时复制的是地址值。函数可以通过复制得到的地址访问调用者提供的对象，因此能借助 `*p` 修改该对象。只有地址有效且指向可写对象时，这种修改才有定义。

```c
#include <stdio.h>

void treat(int *p) {
    *p = *p * 10;
}

int main(void) {
    int fish = 3;
    treat(&fish);
    printf("%d\n", fish);
    return 0;
}
```

```text
30
```

```c
#include <stdio.h>

void treat(int *p) {
    *p = 99;
}

int main(void) {
    int bowl[3] = {1, 2, 3};
    treat(bowl);
    printf("%d\n", bowl[0]);
    return 0;
}
```

```text
99
```

## 空指针、未初始化指针与生命周期

未初始化的指针不能直接解引用，空指针也不能解引用。局部变量生命周期结束后，其地址不能继续作为有效对象地址使用。应在使用指针前明确它指向什么、对象是否仍存在，以及是否允许写入。

```c
#include <stdio.h>

int main(void) {
    int fish = 5;
    printf("%d\n", *fish);
    return 0;
}
```

```text
main.c:5:20: error: invalid type argument of unary '*' (have 'int')
    5 |     printf("%d\n", *fish);
```

```c
#include <stdio.h>

int main(void) {
    double price = 3.5;
    int *p = &price;
    printf("%d\n", *p);
    return 0;
}
```

```text
main.c:5:14: error: initialization of 'int *' from incompatible pointer type 'double *' [-Wincompatible-pointer-types]
    5 |     int *p = &price;
```

```c
#include <stdio.h>

int main(void) {
    int *p = &5;
    printf("%d\n", *p);
    return 0;
}
```

```text
main.c:4:14: error: lvalue required as unary '&' operand
    4 |     int *p = &5;
```

## 地址与值对照

`fish` 是整数值，`&fish` 是该变量的地址，`p` 保存地址，`*p` 表示访问该地址所指向的整数。修改 `p` 与修改 `*p` 是两种不同操作。



## 练习

声明一个整数和指向它的指针，先通过指针读取，再通过指针修改，最后直接输出原变量。解释两次输出为什么不同。
