---
id: c-stage2-05
lang: c
stage: 2
order: 5
title: 定义结构体
tags: [结构体, 类定义, 成员访问]
required: ["c-stage2-04"]
crossRefs: ["common-10", "cpp-stage2-01", "java-stage1-12", "python-stage1-14"]
compare: ["common-10"]
estMinutes: 25
keywords: [struct, member, dot, strcpy]
---

## 学习目标

本课学习定义结构体。重点包括定义结构体类型、声明结构体变量并访问字段、结构体初始化、结构体数组、结构体赋值。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 定义结构体类型

C 的 struct 把多个相关字段组织成一个类型。结构体不是 C++ 或 Java 的类，不具有成员方法、继承或访问修饰符语法。定义字段说明数据结构，声明结构体变量才会为具体对象提供存储。

```c
struct Cat {
    char name[20];
    int fish;
};
```

## 声明结构体变量并访问字段

使用 `struct 类型名 变量名` 声明结构体对象，通过点号访问字段。字段表达式的类型由字段声明决定。修改一个结构体变量的字段不会自动改变另一个独立结构体变量。

```c
#include <stdio.h>
#include <string.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    struct Cat a;

    strcpy(a.name, "张三");
    a.fish = 3;
    printf("%s 当前记录了 %d 条\n", a.name, a.fish);
    return 0;
}
```

```text
张三 当前记录了 3 条
```

以下是本节的另一段示例或诊断信息。

```demo
title: 类定义 → 真的一个 → 两格里各保存了什么
code:
| struct Cat {
|     char name[20];
|     int fish;
| };
| struct Cat a;
| strcpy(a.name, "张三");
| a.fish = 3;
| printf("%s 当前记录了 %d 条\n", a.name, a.fish);

step 先定义类：说清将来切成几格
at: 1
say: `struct Cat {` 一落笔，类定义就开了个头 —— 下面那两行会说清将来切成几格：第 1 格住 `name`、第 2 格住 `fish`。类定义只说明「照它创建后的对象长什么样」，**本身不是对象**。
meow: 开始定义结构体类型。
pose: expect
类定义 Cat = 画好了（本身不是对象）
a 的第 1 格 name = 还没创建后
a 的第 2 格 fish = 还没创建后

step 类定义画完，还是一格都没占
at: 4
say: 两行都写完了，收尾的分号也点上了 —— 可**还是没有一格被占**。类定义停在纸上，`a` 这个对象还不存在，这一步谁也没动。
meow: 类型定义完成，还没有变量。
pose: expect
类定义 Cat = 画好了（本身不是对象）
a 的第 1 格 name = 还没创建后
a 的第 2 格 fish = 还没创建后

step 根据类创建实例：这一下才真的占下地方
at: 5
say: `struct Cat a;` 一创建后，就按类定义占下一块**连在一起**的地方、接着切成两格：第 1 格叫 `name`、第 2 格叫 `fish`。两格都还空着，谁也没占谁的地方。
meow: 声明变量 a，分配两个成员的空间。
pose: busy
类定义 Cat = 画好了（本身不是对象）
a 的第 1 格 name = 空格子（还没写）
a 的第 2 格 fish = 空格子（还没写）

step 先填第 1 格：名字要一颗一颗搬进去
at: 6
say: `strcpy` 把「张三」**一颗一颗字符**搬进第 1 格 —— 名字是一排元素，不能整个换掉。**注意这一刻第 2 格 `fish` 还是空的**：点号进了哪一格，就只动哪一格。
meow: strcpy 把名字复制进 name。
pose: busy
类定义 Cat = 画好了（本身不是对象）
a 的第 1 格 name = 张三
a 的第 2 格 fish = 空格子（还没写）

step 再填第 2 格：这一格是普通的整数元素
at: 7
say: `a.fish = 3;` 第 2 格是只普通整数元素，直接写就行。填完回头看一眼第 1 格：那串「张三」**一点没动** —— 两格各归各的。
meow: 给 fish 赋值 3。
pose: yay
类定义 Cat = 画好了（本身不是对象）
a 的第 1 格 name = 张三
a 的第 2 格 fish = 3

step 报出两格：一格一格读取
at: 8
say: `a.name` 取第 1 格、`a.fish` 取第 2 格，按顺序填进 `%s` 和 `%d`，印出「张三 当前记录了 3 条」。两个点号各进自己那一格，互不串门。
meow: 输出两个成员的值。
pose: proud
类定义 Cat = 画好了（本身不是对象）
a 的第 1 格 name = 张三
a 的第 2 格 fish = 3
```

## 结构体初始化

可以在声明时使用初始化列表设置字段；未显式指定成员的处理应按相应初始化规则理解。字符数组字段不能在声明后用普通赋值整体接收字符串，应使用适当的数组或字符串操作并注意容量。

```c
#include <stdio.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    struct Cat a = {"张三", 3};

    printf("%s 当前记录了 %d 条\n", a.name, a.fish);
    return 0;
}
```

```text
张三 当前记录了 3 条
```

## 结构体数组

数组元素可以是结构体。先用下标选择一个元素，再用点号选择其字段。遍历时同时检查数组边界和字段含义，不要把字段索引与元素索引混淆。

```c
#include <stdio.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    struct Cat cats[3] = {
        {"张三", 3},
        {"李四", 5},
        {"计算机", 9}
    };
    int total = 0;

    for (int i = 0; i < 3; i++) {
        printf("%s 处理了 %d 条\n", cats[i].name, cats[i].fish);
        total = total + cats[i].fish;
    }
    printf("一共 %d 条\n", total);
    return 0;
}
```

```text
张三 处理了 3 条
李四 处理了 5 条
计算机 处理了 9 条
一共 17 条
```

## 结构体赋值

同一结构体类型的对象可以整体赋值，字段值被复制。若字段包含指针，复制的是指针值，不会自动深拷贝所指向资源；字符数组成员则随结构体值一同复制。

```c
#include <stdio.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    struct Cat a = {"张三", 3};
    struct Cat b;

    b = a;
    b.fish = 99;
    printf("%d\n", a.fish);
    printf("%d\n", b.fish);
    return 0;
}
```

```text
3
99
```

## struct 名称与类型别名

没有 typedef 时，结构体标签通常需要带 struct 关键字使用。typedef 可以引入类型别名，但不会创建一个新对象，也不会改变原结构体的字段布局。

```c
#include <stdio.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    Cat a;

    a.fish = 3;
    printf("%d\n", a.fish);
    return 0;
}
```

```text
main.c:9:5: error: unknown type name 'Cat'; use 'struct' keyword to refer to the type
    9 |     Cat a;
```

## 练习

定义包含名称与数量字段的结构体，创建两个对象并输出字段。再进行结构体赋值，检查复制后哪些值独立、哪些指针仍可能指向同一资源。
