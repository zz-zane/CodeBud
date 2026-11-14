---
id: cpp-stage2-09
lang: cpp
stage: 2
order: 9
title: 继承
tags: [面向对象, 继承]
required: ["cpp-stage2-08"]
crossRefs: []
compare: ["common-10"]
estMinutes: 26
keywords: [extends, protected, override, base]
---

## 学习目标

本课学习继承。重点包括定义派生类、继承方式与访问权限、构造与析构顺序、继承语法对照。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 定义派生类

`class Student : public Person` 定义从 `Person` 公有继承的派生类。派生对象包含基类子对象，并可以增加自己的成员。派生类可以使用基类中允许访问的成员；基类私有成员不能被派生类成员直接访问。

```cpp
#include <iostream>
#include <string>
using namespace std;

class Person {
public:
    string name;
    void introduce() const {
        cout << name << "介绍自己：" << endl;
    }
};

class Student : public Person {
public:
    void study() const {
        cout << name << " 开始学习" << endl;
    }
};

int main() {
    Student k;
    k.name = "张三";
    k.introduce();
    k.study();
    return 0;
}
```

```text
张三介绍自己：
张三 开始学习
```

```demo
title: 子对象创建后的时候，基类子对象先摆好
code:
| class Person { ... };                    // 基类定义：一格 name、一手 introduce
| class Student : public Person { ... };    // 子类定义：照基类画下来，自己再添一手 study
| Student k;                             // 照子类定义创建一个
| k.name = "张三";                      // 装料：保存的是基类那一格
| k.introduce();                             // 调用基类那一手
| k.study();                              // 调用子对象自己添的那一手

step 基类定义摊开
at: 1
say: `Person` 类定义上只有两样：一格 `name`、一手 `introduce`。**类定义本身不占地** —— 它摊在这儿，场上还没有一个对象。
meow: 基类有 name 和 introduce。
pose: welcome
这个对象身上 = （还没有对象）
name 那一格 = （还没有对象）
这一步跑的是 = （还没调用）

step 子类定义照着基类画
at: 2
say: 这一行就是全部的秘密：`class Student : public Person` 念作「子对象这张类定义，**照着 `Person` 画下来**」。子类定义上**没写** `name`、**没写** `introduce` —— 它写的是「基类子对象也跟着来」。
meow: Student 公有继承 Person。
pose: expect
这个对象身上 = （还没有对象）
name 那一格 = （还没有对象）
这一步跑的是 = 子类定义上写着：基类那份也跟着来

step 创建一个：先摆基类那一整份
at: 3
say: `Student k;` 要把这个对象摆出来。摆的顺序是钉死的：**先摆下基类那一整份** —— `name` 那一格就在这一份里，这一手 `introduce` 也在里头。
meow: 先构造基类部分。
pose: busy
这个对象身上 = 基类那一半（先摆好）
name 那一格 = （空着）
这一步跑的是 = （还没调用）

step 再摆子对象自己添的那一份
at: 3
say: 基类那份摆完，才摆子对象自己添的那一份。它**不是另起一间**，是紧挨着基类子对象、摆在同一个对象身上 —— 所以子类定义上那句 `name`，一伸手就够得着。注意 `name` 那一格**还是空的**，摆完也不会自己装上东西。
meow: 再构造派生类部分。
pose: busy
这个对象身上 = 基类那一半 + 子对象那一半（study）
name 那一格 = （空着）
这一步跑的是 = （还没调用）

step 给基类那一格装料
at: 4
say: `k.name = "张三";` 装进的是**基类子对象里的那一格** —— 子类定义上根本没写这一格，可它够得着，因为那一格就在它身上。
meow: name 来自基类。
pose: yay
这个对象身上 = 基类那一半 + 子对象那一半（study）
name 那一格 = 张三
这一步跑的是 = （还没调用）

step 调用一次基类那一手
at: 5
say: `k.introduce()` —— 子类定义上**根本没有写这一手**，跑起来的是基类那一手。它印出来的 `name`，就是刚装进基类那一格的那个字。
meow: 调用继承的 introduce。
pose: proud
这个对象身上 = 基类那一半 + 子对象那一半（study）
name 那一格 = 张三
这一步跑的是 = 基类那一手 introduce（印「张三介绍自己：」）

step 调用一次自己添的那一手
at: 6
say: `k.study()` 是子对象自己添的那一手，基类类定义上没有它。它里面印的 `name` 同样是基类那一格 —— 两个手伸向的，是同一个对象身上的同一格。
meow: study 是派生类新增的。
pose: yay
这个对象身上 = 基类那一半 + 子对象那一半（study）
name 那一格 = 张三
这一步跑的是 = 子对象自己添的 study（印「张三 开始学习」）
```

## 继承方式与访问权限

公有继承保留基类公有成员和保护成员相应的访问级别；保护继承和私有继承会进一步限制从派生类外部的访问。`class` 默认采用私有继承，`struct` 默认采用公有继承，因此省略 `public` 可能改变可访问性与类型转换规则。

```cpp
#include <iostream>
#include <string>
using namespace std;

class Person {
    string name;
protected:
    int fish;
public:
    Person(string n, int f) : name(n), fish(f) {}
    void showName() const {
        cout << "我们是" << name << "" << endl;
    }
};

class Student : public Person {
public:
    Student(string n, int f) : Person(n, f) {}
    void eat() {
        fish = fish + 1;
        cout << "处理了一条，现在 " << fish << " 条" << endl;
    }
};

int main() {
    Student k("张三", 3);
    k.showName();
    k.eat();
    return 0;
}
```

```text
我们是张三
处理了一条，现在 4 条
```

```cpp
#include <iostream>
#include <string>
using namespace std;

class Person {
    string name;
    int fish;
public:
    Person(string n, int f) : name(n), fish(f) {}
};

class Student : public Person {
public:
    Student(string n, int f) : Person(n, f) {}
    void eat() {
        fish = fish + 1;
        cout << "处理了一条，现在 " << fish << " 条" << endl;
    }
};

int main() {
    Student k("张三", 3);
    k.eat();
    return 0;
}
```

```text
main.cpp:16:9: error: 'int Person::fish' is private within this context
```

```cpp
#include <iostream>
#include <string>
using namespace std;

class Person {
public:
    string name;
    void introduce() const {
        cout << name << "介绍自己：" << endl;
    }
};

class Student : Person {
public:
    void study() const {
        cout << name << " 开始学习" << endl;
    }
};

int main() {
    Student k;
    k.name = "张三";
    k.introduce();
    return 0;
}
```

```text
main.cpp:22:7: error: 'std::string Person::name' is inaccessible within this context
```

## 构造与析构顺序

创建派生对象时，先构造基类，再按声明顺序构造成员，最后执行派生类构造函数体。销毁顺序相反：先执行派生类析构，再销毁成员和基类子对象。需要通过基类指针删除派生对象时，应检查基类析构函数是否为虚函数。

```cpp
#include <iostream>
#include <string>
using namespace std;

class Person {
protected:
    string name;
public:
    Person(string n) : name(n) {
        cout << "对象基类那一半先搭好：" << name << endl;
    }
    ~Person() {
        cout << "对象基类那一半后拆：" << name << endl;
    }
};

class Student : public Person {
public:
    Student(string n) : Person(n) {
        cout << "子对象那一半再搭好：" << name << endl;
    }
    ~Student() {
        cout << "子对象那一半先拆：" << name << endl;
    }
};

int main() {
    Student k("张三");
    cout << "---- 中间过日子 ----" << endl;
    return 0;
}
```

```text
对象基类那一半先搭好：张三
子对象那一半再搭好：张三
---- 中间过日子 ----
子对象那一半先拆：张三
对象基类那一半后拆：张三
```

## 继承语法对照

继承用于表达类型关系，不表示复制某个已有实例的字段值。构造基类子对象与继承成员声明是不同概念。判断某个成员能否访问时，要同时考虑成员声明的访问级别、继承方式及访问发生的位置。



## 练习

定义一个基类和一个公有派生类，在构造函数中分别输出标记，观察初始化顺序。再比较公有继承和省略继承方式时，从类外访问基类公有成员的差别。
