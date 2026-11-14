---
id: common-10
lang: common
stage: 0
order: 32
title: 面向对象基础：类与对象
tags: [面向对象, 类定义与实例]
required: ["common-34"]
crossRefs: ["c-stage2-05","cpp-stage2-01","java-stage1-12","python-stage1-14"]
estMinutes: 18
keywords: [class, object, method, new]
---

## 学习目标

本课学习面向对象基础：类与对象。重点包括类的定义、创建对象与访问实例成员、封装、继承、多态。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 类的定义

类用于定义同一类对象共同具有的状态与行为。字段或属性表示状态，方法表示可执行的操作。类本身与实例不同：定义一个类并不会自动为业务创建每个实例。



## 创建对象与访问实例成员

调用 Python 类或在 C++/Java 中使用相应的对象创建语法，可以得到实例。初始化参数用于设置新实例的状态。示例中的两个实例各自保存 `name` 和 `fish`，调用方法时读取接收该调用的实例状态；`self` 表示 Python 方法当前接收的实例。

```python
class Cat:
    def __init__(self, name, fish):
        self.name = name
        self.fish = fish

    def meow(self):
        print(f"{self.name}：我们当前记录了 {self.fish} 条数据")

cat1 = Cat("学生甲", 3)
cat2 = Cat("学生乙", 1)
cat1.meow()
cat2.meow()
```

```text
学生甲：我们当前记录了 3 条数据
学生乙：我们当前记录了 1 条数据
```

```demo
title: 一个类定义怎么变成元素边的两个实例
code:
| class Cat:
|     def __init__(self, name, fish):
|         self.name = name
|         self.fish = fish
| cat1 = Cat("学生甲", 3)
| cat2 = Cat("学生乙", 1)

step 定义类：纸上画着对象，元素边一个都没有
at: 1
say: `class Cat:` 是**定义类**的口令。类定义上写着「凡是照它创建后的对象，都有一份名字、一份数据数」—— 可类定义**自己不是对象**，这一刻元素边一个活的都没有。
meow: 类定义好了，对象还没创建。
pose: expect
类定义 Cat = 画好了（本身不是对象）
cat1 自己的变量 = 还没生
cat2 自己的变量 = 还没生

step 类定义上先记下初始化那一个方法
at: 2
say: `def __init__(self, name, fish):` 是对象初始化与资源释放：照它创建对象的时候，先把名字和数据数传入。这一刻它**只是被写在纸上，一次都没跑过** —— 还没有对象初始化，没人称呼它。
meow: 初始化方法先记着，创建时才用。
pose: expect
类定义 Cat = 画好了（那招还没跑过）
cat1 自己的变量 = 还没生
cat2 自己的变量 = 还没生

step 第一次 Cat("学生甲", 3)：生第一个
at: 5
say: `cat1 = Cat("学生甲", 3)` 引用的就是刚才那一个方法：传入名字「学生甲」、数据数 3。新对象刚站起来，**两样都还没装** —— `__init__` 这时候才开始跑。
meow: 创建第一个对象。
pose: busy
类定义 Cat = 画好了（那招还没跑过）
cat1 自己的变量 = 刚创建后，两样都还没装
cat2 自己的变量 = 还没生

step 名字落进「这一个」自己的变量
at: 3
say: `self.name = name` 里那个 `self` 读作「我们自己」，指的就是刚创建后的 `cat1`。传入的「学生甲」装进**它自己**的变量，标签写 `name`。
meow: 名字存进这个对象自己。
pose: busy
类定义 Cat = 画好了（那招还没跑过）
cat1 自己的变量 = 名字「学生甲」、数据（还没装）
cat2 自己的变量 = 还没生

step 数据数也落进它自己的变量
at: 4
say: `self.fish = fish` 同一套动作再来一遍，3 装进 `cat1` 自己的变量。到这儿第一个**收拾好了**：名字和数据数都在它自己身上，不在类定义上。
meow: 3 也存进这个对象自己。
pose: yay
类定义 Cat = 画好了（那招还没跑过）
cat1 自己的变量 = 名字「学生甲」、数据 3
cat2 自己的变量 = 还没生

step 再调用一次：生第二只
at: 6
say: 类定义还是那一张，一个字都没改。`Cat("学生乙", 1)` 又调用了一回初始化那一个方法 —— **类定义不会用旧**，想创建几个创建几个。
meow: 同一个类，创建第二个对象。
pose: expect
类定义 Cat = 画好了（那招还没跑过）
cat1 自己的变量 = 名字「学生甲」、数据 3
cat2 自己的变量 = 刚创建后，两样都还没装

step 同一行又跑一遍，这回保存的是「学生乙」
at: 3
say: 又是 `self.name = name` 这一行 —— 代码一个字没变，可这回 `self` 指的是 `cat2`，装的也是「学生乙」。**注意 `cat1` 那份一点没动**，还是「学生甲」。
meow: 同一行代码，这回操作的是 cat2。
pose: busy
类定义 Cat = 画好了（那招还没跑过）
cat1 自己的变量 = 名字「学生甲」、数据 3
cat2 自己的变量 = 名字「学生乙」、数据（还没装）

step 第二只也装满 —— 第一个纹丝不动
at: 4
say: `self.fish = fish` 再跑一遍，1 装进 `cat2`。收工看一眼两个：`cat1` 是「学生甲、数据 3」，`cat2` 是「学生乙、数据 1」—— **生第二只的时候，第一个一点没变**。
meow: 两个对象各存各的数据。
pose: proud
类定义 Cat = 画好了（那招还没跑过）
cat1 自己的变量 = 名字「学生甲」、数据 3
cat2 自己的变量 = 名字「学生乙」、数据 1
```

## 封装

封装把数据及相关操作放在同一类型中，并通过接口维护约束。调用者应使用公开方法执行操作，避免绕过验证直接修改内部状态。Python 的命名约定与 C++/Java 的访问修饰符机制不同。



## 继承

子类可以继承父类提供的成员并扩展行为。继承适用于真实的可替代类型关系；仅为减少几行重复代码并不足以证明应该继承。



## 多态

对不同类型的对象调用同一约定的方法时，可以执行各类型提供的实现。C++ 的运行时动态分派需要虚函数等条件；Python 与 Java 的方法分派规则应按各自语言理解。



## 跨语言类与对象语法

下面对照 C 结构体、C++ 类、Java 类和 Python 类的写法。C 结构体本身不具有成员方法语法；可以由独立函数操作结构体数据。注意对象创建、实例成员访问以及构造或初始化过程的差别。

```compare
c::
#include <stdio.h>

typedef struct {
    int fish;
} Cat;

int main() {
    Cat cat;
    cat.fish = 3;
    printf("这个对象当前记录了 %d 条数据\n", cat.fish);
    return 0;
}

cpp::
#include <iostream>

class Cat {
public:
    int fish;
};

int main() {
    Cat cat;
    cat.fish = 3;
    std::cout << "这个对象当前记录了 " << cat.fish << " 条数据" << std::endl;
    return 0;
}

java::
public class Main {
    static class Cat {
        int fish;
    }

    public static void main(String[] args) {
        Cat cat = new Cat();
        cat.fish = 3;
        System.out.println("这个对象当前记录了 " + cat.fish + " 条数据");
    }
}

python::
class Cat:
    def __init__(self, fish):
        self.fish = fish

cat = Cat(3)
print(f"这个对象当前记录了 {cat.fish} 条数据")
```

```text
这个对象当前记录了 3 条数据
```

## 练习

创建两个具有不同字段值的实例，分别调用同一个实例方法。说明为什么两个对象能够具有相同的成员名称，却保存不同的值。
