---
id: common-04
lang: common
stage: 0
order: 4
title: 变量与数据类型
tags: [变量, 类型, 入门]
required: [common-03]
crossRefs: [c-stage1-03, cpp-stage1-03, java-stage1-03, python-stage1-03]
estMinutes: 15
keywords: [变量, 赋值, 整数, 小数, 字符串]
---

## 学习目标

本课学习变量与数据类型。重点包括变量的定义与赋值、标识符与命名、常见数据类型、取值、计算与重新赋值。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```text
今日数据 = 3
今日数据 = 今日数据 + 1      ← 报名字，取出 3，加 1，再放回去
现在变量里是 4
```

## 变量的定义与赋值

变量用于通过名称访问一个值。Python 的 `fish = 3` 将名称 `fish` 绑定到整数对象 `3`；C、C++、Java 的 `int fish = 3;` 则声明并初始化一个整数变量。赋值号 `=` 表示先计算右侧表达式，再更新左侧变量；它不表示数学等式。

```python
fish = 3
```

### 各语言的声明语法对照

下面是声明语法，不是上一段代码的输出。

```text
C        int fish = 3;
C++      int fish = 3;
Java     int fish = 3;
Python   fish = 3           ← 不用写 int，电脑自己看
```

## 标识符与命名

标识符区分大小写，不能以数字开头，也不能使用语言保留的关键字。具体可用字符由语言规定：Python、Java 等支持部分 Unicode 标识符，因此“所有语言都不能用中文”并不准确。建议使用清晰的英文名称和一致的命名规范；`print` 在 Python 中是内置函数名而非关键字，重用它虽合法但会遮蔽内置函数。



## 常见数据类型

整数、浮点数、字符串和布尔值表示不同种类的数据。`3` 是整数，`"3"` 是字符串；字符串字面量需要引号。C/C++/Java 的变量有声明类型，Python 的名称绑定到具有类型的对象。

```python
count = 3
price = 2.5
catName = "计算机"
print(count, price, catName)
```

```text
3 2.5 计算机
```

## 取值、计算与重新赋值

读取变量时使用其当前值。执行 `fish = fish + 1` 时，先读取旧值并加一，再把结果赋给 `fish`。如果初值为 3，执行后为 4。不要把赋值操作理解成要求等式两边同时成立。

```compare
c::
#include <stdio.h>

int main() {
    int fish = 3;
    fish = fish + 1;
    printf("%d\n", fish);
    return 0;
}

cpp::
#include <iostream>

int main() {
    int fish = 3;
    fish = fish + 1;
    std::cout << fish << std::endl;
    return 0;
}

java::
public class Main {
    public static void main(String[] args) {
        int fish = 3;
        fish = fish + 1;
        System.out.println(fish);
    }
}

python::
fish = 3
fish = fish + 1
print(fish)
```

```text
4
```

```demo
title: fish = fish + 1 这个变量经历了什么
code:
| fish = 3
| fish = fish + 1
| print(fish)

step 变量贴上名字，装进 3
at: 1
say: `fish = 3` 是两步并成一步：拿一个新变量贴上 fish，再把 3 放进去。此刻变量里保存 3。
meow: 变量 fish 建好，里面是 3。
pose: expect
fish 变量里 = 3
我们手上 = （空）
标准输出 = 还没印

step 读右边：报名字，取出旧值
at: 2
say: 轮到 `fish = fish + 1` 了。电脑**先看等号右边**：右边那个 `fish` 是报名字，把变量里的旧值读取 —— 取到的是 **3**。
meow: 读取 fish，取到 3。
pose: busy
fish 变量里 = 3
我们手上 = 3
标准输出 = 还没印

step 右边算完：3 + 1 得 4
at: 2
say: 取出来的 3 加上 1，等号右边算完是 **4**。**注意：这一步变量里还是 3，一点没变** —— 电脑还没往变量里放东西。
meow: 3 加 1 得 4，还没存回去。
pose: busy
fish 变量里 = 3
我们手上 = 4
标准输出 = 还没印

step 赋给左边那个变量
at: 2
say: 等号**右边全部算完**，才把结果整个装进左边那个变量。fish 从 3 变成 4，手上的东西放下了 —— 这就是课文说的「两步动作」。
meow: 把 4 存回 fish。
pose: yay
fish 变量里 = 4
我们手上 = （空）
标准输出 = 还没印

step 报出变量里的数
at: 3
say: 最后一行 `print(fish)` 也是报名字，把变量里的数读取印在屏幕上 —— **4**。上面四门语言的 compare 块跑出来都是这个 4。
meow: fish 现在是 4，输出它。
pose: proud
fish 变量里 = 4
我们手上 = （空）
标准输出 = 4
```

## 练习

定义一个初值为 3 的变量，将其加一并输出。再分别定义整数、浮点数和字符串，观察它们的值与类型。
