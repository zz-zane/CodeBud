---
id: java-stage1-03
lang: java
stage: 1
order: 4
title: Java 的变量与数据类型
tags: [变量, 类型]
required: ["java-stage1-18"]
crossRefs: ["common-04","c-stage1-03","cpp-stage1-03","python-stage1-03"]
estMinutes: 20
keywords: [int, double, char, boolean, long]
compare: ["common-04"]
---

## 学习目标

本课学习Java 的变量与数据类型。重点包括声明与初始化、基本类型与引用类型、重新赋值、合法标识符与命名约定、不兼容类型的编译诊断。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 声明与初始化

`int fish = 3;` 声明 int 类型的局部变量 fish 并初始化为 3。声明类型约束随后允许赋给它的值；局部变量在读取前必须完成确定赋值。分号结束语句，不是变量名的一部分。

```java
int fish = 3;
```

## 基本类型与引用类型

Java 的基本类型直接表示相应的数值、布尔值或字符，引用类型变量保存对象引用。String 是引用类型。变量的声明类型不会因为后续赋值自动变成另一个不兼容类型。

```java
public class Main {
    public static void main(String[] args) {
        int fish = 3;
        double price = 2.5;
        char grade = 'A';
        boolean happy = true;
        System.out.println(fish);
        System.out.println(price);
        System.out.println(grade);
        System.out.println(happy);
    }
}
```

```text
3
2.5
A
true
```

## 重新赋值

赋值更新已有变量，不需要再次声明同名局部变量。右侧表达式先求值，再进行目标类型允许的赋值转换。`fish = fish + 1` 使用旧值计算新值；相等比较使用 `==`。

```java
public class Main {
    public static void main(String[] args) {
        int fish = 3;
        fish = fish + 1;
        System.out.println(fish);
    }
}
```

```text
4
```

以下是本节的另一段示例或诊断信息。

```demo
title: 「先算右边，再赋给左边」是怎么走的
code:
| int fish = 3;
| fish = fish + 1;
| System.out.println(fish);

step 开张那一次：挂牌、起名、装 3
at: 1
say: `int fish = 3;` 一次办完三件事：挂 `int` 的名称（这格子只收整数）、起名 `fish`、把 `3` 赋值。**名称只有开张这一次要写**，再往下你就见不到它了。
meow: 声明 int 变量 fish，值是 3。
pose: expect
fish 格子里 = 3
我们手上 = （空）
标准输出 = 还没印

step 第二句开头：一个名称都没有
at: 2
say: 看 `fish = fish + 1;` 这行开头 —— **没有 `int`**。名称只在开张时写一次，往后想换格子里的东西，直接引用名称就行，Java 认得这个变量。
meow: 再次赋值不用写类型。
pose: expect
fish 格子里 = 3
我们手上 = （空）
标准输出 = 还没印

step 先算右边：引用名称，返回出旧值
at: 2
say: Java 的规矩是**先把右边算完**。右边那个 `fish` 是引用名称，把格子里的东西读取 —— 取到的是 **3**。**注意：这一步格子里还是 3。**
meow: 先读取 fish，取到 3。
pose: busy
fish 格子里 = 3
我们手上 = 3
标准输出 = 还没印

step 右边算完：3 + 1 得 4
at: 2
say: 读取的 3 加上 1，右边算完是 **4**，先捏在手上。**这一步格子里还是 3** —— 加号算得再热闹，也一下都没碰过那间格子。
meow: 3 + 1 = 4，还没存回去。
pose: busy
fish 格子里 = 3
我们手上 = 4
标准输出 = 还没印

step 再赋给左边那间格子
at: 2
say: 右边**全部算完**，才把 4 **赋给左边**那间 `fish` 格子。原来的 3 被顶掉，格子里成了 4 —— 课文那句「先算右边，再赋给左边」说的就是这两拍。
meow: 把 4 存回 fish。
pose: yay
fish 格子里 = 4
我们手上 = （空）
标准输出 = 还没印

step println：念的是格子里的东西
at: 3
say: 最后 `System.out.println(fish);` 引用的是 `fish` 这个名字，屏幕上冒出来的却是 **4** —— 因为 `println` 念的永远是**格子里保存的东西**，不是格子的名字。
meow: 输出 4。
pose: proud
fish 格子里 = 4
我们手上 = （空）
标准输出 = 4
```

## 合法标识符与命名约定

标识符区分大小写，不能以数字开头，不能使用关键字。Java 支持许多 Unicode 字符，但项目通常采用一致的英文命名。变量使用表达含义的名称，遵循 lowerCamelCase 等团队约定。

```java
public class Main {
    public static void main(String[] args) {
        int fishCount = 3;
        System.out.println(fishCount);
    }
}
```

```text
3
```

## 不兼容类型的编译诊断

把字符串直接赋给 int 等不兼容操作会触发编译错误。不要仅通过删除报错语句掩盖问题；应根据数据含义选择适当类型或显式解析，并考虑解析失败的情况。

```java
public class Main {
    public static void main(String[] args) {
        int fish = "3";
        System.out.println(fish);
    }
}
```

```text
Main.java:3: error: incompatible types: String cannot be converted to int
        int fish = "3";
                   ^
1 error
```

以下是本节的另一段示例或诊断信息。

```java
public class Main {
    public static void main(String[] args) {
        int fish = 3.5;
        System.out.println(fish);
    }
}
```

```text
Main.java:3: error: incompatible types: possible lossy conversion from double to int
        int fish = 3.5;
                   ^
1 error
```

以下是本节的另一段示例或诊断信息。

```java
public class Main {
    public static void main(String[] args) {
        char grade = "A";
        System.out.println(grade);
    }
}
```

```text
Main.java:3: error: incompatible types: String cannot be converted to char
        char grade = "A";
                     ^
1 error
```

以下是本节的另一段示例或诊断信息。

```java
public class Main {
    public static void main(String[] args) {
        long big = 8000000000;
        System.out.println(big);
    }
}
```

```text
Main.java:3: error: integer number too large
        long big = 8000000000;
                   ^
1 error
```

以下是本节的另一段示例或诊断信息。

```java
public class Main {
    public static void main(String[] args) {
        long big = 8000000000L;
        System.out.println(big);
    }
}
```

```text
8000000000
```

## 与 Python 名称绑定对照

Java 变量具有声明类型，Python 名称可以重新绑定到不同类型的对象。两种语言都需要区分值和类型，但检查时机及允许的赋值规则不同。Python 的灵活绑定不代表其对象没有类型。



## 练习

声明整数、浮点数、布尔值和字符串变量并输出。重新赋值后再次输出，说明声明、赋值、相等比较各自的用途。

```java
public class Main {
    public static void main(String[] args) {
        int fish = 3;
        double price = 2.5;
        char grade = 'A';
        boolean happy = true;
        System.out.println(fish);
        System.out.println(price);
        System.out.println(grade);
        System.out.println(happy);
    }
}
```
