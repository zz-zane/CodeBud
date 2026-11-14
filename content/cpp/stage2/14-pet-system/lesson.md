---
id: cpp-stage2-14
lang: cpp
stage: 2
order: 14
title: 综合项目：学生信息管理系统
tags: [综合项目, 继承, vector, 菜单]
required: ["cpp-stage2-13"]
crossRefs: []
estMinutes: 34
keywords: [class design, inheritance, vector, menu]
---

## 学习目标

本课学习综合项目：学生信息管理系统。重点包括类设计、继承、vector、菜单。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、先把「一个对象」想清楚

类定义不是拿起来就画的。我们动手之前先问自己三句：

1. **它自己得记着哪几格？** —— 一个对象总得知道自己叫什么、几岁；
2. **它会给出去哪几手？** —— 外面想知道名字、想听它说句话，都得靠它自己递出来；
3. **哪几格得扣盖子？** —— 家底不该让外面随手翻。

对着这三句画出来是这样：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
    int age;
public:
    Cat(string n, int a) : name(n), age(a) {}
    string getName() { return name; }
    int getAge() { return age; }
    void greet() {
        cout << "我是" << name << "，今年 " << age << " 岁" << endl;
    }
};

int main() {
    Cat a("张三", 3);
    cout << a.getName() << " / " << a.getAge() << endl;
    a.greet();
    return 0;
}
```

```text
张三 / 3
我是张三，今年 3 岁
```

一句一句看：

- **`Cat(string n, int a) : name(n), age(a) {}`** —— 「初始化的时候先把料传入」那一手（第 02 课学的）。名字和岁数从这一手进来，装进自己的两格家底；
- **`name` 和 `age`** —— 一个对象自己的两格家底。我们没把它们摆在外面，而是扣着盖子（第 04 课那个封装）；
- **`getName()` / `getAge()`** —— 盖子扣上了，外面想过目就得走这两扇小窗。**这就是「类定义设计」的一半功夫**：哪些是家底、哪些是窗子，得先想明白；
- **`greet()`** —— 「提供输出方法」那一手：把两格家底拼成一句话印出来；
- **`protected:`** —— 我们这一格挂的是 `protected`，不是 `private`。外面照样够不着（`main` 里写 `a.name` 会被编译器挡住），**可照着这张类定义画下来的新类定义够得着** —— 下一节就知道我们为什么这么挂了。

## 二、子对象也是对象：继承，不重抄

托儿所里总会来子对象。子对象**也是对象**：有名字、有岁数、提供输出方法。可它还多一样 —— **初始化多少天了**（这么小的对象，按岁数报太粗了，得按天数）。

最笨的办法：把上面那张类定义**整张抄一遍**，改个名字，再加一格天数。抄一遍有什么坏处？**以后老类定义改一个字，两张类定义就对不上了。** 我们真干过这种事：改一处、忘一处，名册上输出的话一半新一半旧，调试抓了半下午。

我们要的是**继承**：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
    int age;
public:
    Cat(string n, int a) : name(n), age(a) {}
    string getName() { return name; }
    int getAge() { return age; }
    void greet() {
        cout << "我是" << name << "，今年 " << age << " 岁" << endl;
    }
};

class Kitten : public Cat {
protected:
    int days;
public:
    Kitten(string n, int a, int d) : Cat(n, a), days(d) {}
    void showDays() {
        cout << name << " 初始化 " << days << " 天啦" << endl;
    }
};

int main() {
    Kitten k("棉花", 1, 20);
    k.greet();
    k.showDays();
    return 0;
}
```

```text
我是棉花，今年 1 岁
棉花 初始化 20 天啦
```

- **`class Kitten : public Cat`** —— 这一行念作「`Kitten` 这张类定义，**照着 `Cat` 画下来**」。老类定义上的格子和手，子对象这张类定义上**自动就有**，一个字都不用重抄；
- **那一小段 `public` 不能少** —— 它管的是「老类定义的公开小手，新类定义对外还公不公开」（第 09 课专门有一节讲这个，少写了就是摔法二）；
- **`Kitten(string n, int a, int d) : Cat(n, a), days(d) {}`** —— 子对象初始化的时候，先把名字和岁数**递回给老类定义那一手**，再管自己多出来的那一格。次序不能颠倒：基类先初始化，子对象后初始化；
- **`protected:` 现在派上用场了** —— 名字当初为什么挂 `protected` 而不是 `private`？因为子对象这一手 `showDays()` 里要**直接调用 `name`**。挂 `private:` 的话子对象够不着（摔法一）；
- **`k.greet()` 印出来了** —— 子对象自己一句都没写，说话这一手是从老类定义那儿接过来的。

::: tip 提示
**「照着一个类定义画下来」的好处，只有改类定义的那天看得见。** 今天我们想给每个对象都加一格「毛色」——挂 `protected:` 的话，子对象那张类定义**一个字都不用动**，跟着就有了。抄是两个地方改，套是改一处。
:::

## 三、名册用会自己变长的元素来装

登记这件事，上一课已经给了答案：用那个**会自己变长的元素**。来一个放一个，来 3 只装 3 只，来 30 只装 30 只，我们一个格数都不用提前数。

```cpp
#include <iostream>
#include <string>
#include <vector>
using namespace std;

class Cat {
protected:
    string name;
    int age;
public:
    Cat(string n, int a) : name(n), age(a) {}
    string getName() { return name; }
    int getAge() { return age; }
    void greet() {
        cout << "我是" << name << "，今年 " << age << " 岁" << endl;
    }
};

int main() {
    vector<Cat> roster;
    roster.push_back(Cat("张三", 3));
    roster.push_back(Cat("王五", 5));
    roster.push_back(Cat("棉花", 1));

    cout << "名册上一共 " << roster.size() << " 只" << endl;
    int k = 0;
    for (Cat& c : roster) {
        k = k + 1;
        cout << k << ". ";
        c.greet();
    }
    return 0;
}
```

```text
名册上一共 3 只
1. 我是张三，今年 3 岁
2. 我是王五，今年 5 岁
3. 我是棉花，今年 1 岁
```

- **`vector<Cat> roster;`** —— 一个装对象的元素。尖括号里点明保存的是哪一款：这里点 `Cat`；
- **`roster.push_back(Cat("张三", 3));`** —— 先根据类创建出一个对象，再把它放进元素里。元素自己会长；
- **`for (Cat& c : roster)`** —— 一个一个挨着过。**那个 `&` 是「别复印、指着真身」的意思**（第 12 课那一手）：名册上的对象就是名册上的对象，念名册不用给每个对象复印一份；
- **`roster.size()` 印的 `3`** —— 元素里现在有几个。我们是靠它数出来的，不是自己数的。

::: warn 注意
**数格号的写法，上一课提醒过一句嘀咕，这里再说一遍。** 我们要是写成

`for (int i = 0; i < roster.size(); i++)`

就得自己数格号。编译器不会拦你，但它会**嘀咕一句**（`-Wsign-compare`）；而且格号数错一格，点名册就从中间某只开始念。**能挨着过就别数格号**——今天这一节一个格号都没写。
:::

## 四、菜单：号码进来，活自己分派

三件事都备好了，现在装菜单。菜单的道理就一句话：

> **读一个号码 → 分派给对应的那一支活 → 干完再看下一个号码，直到有人调用收摊。**

为了让下面这一段**当场就能跑给你看**，我们把「主人今天敲的号码」预先装在一个元素里（`1` 登记、`3` 没学会的号码、`2` 念名册、`0` 收摊、`1` 收摊之后的号码）：

```cpp
#include <iostream>
#include <string>
#include <vector>
using namespace std;

class Cat {
protected:
    string name;
    int age;
public:
    Cat(string n, int a) : name(n), age(a) {}
    string getName() { return name; }
    int getAge() { return age; }
    void greet() {
        cout << "我是" << name << "，今年 " << age << " 岁" << endl;
    }
};

int main() {
    vector<Cat> roster;
    vector<int> keys = {1, 3, 2, 0, 1};

    for (int cmd : keys) {
        if (cmd == 0) {
            cout << "收摊，今天登记了 " << roster.size() << " 只" << endl;
            break;
        } else if (cmd == 1) {
            roster.push_back(Cat("张三", 3));
            cout << "登记了一个，名册上现在 " << roster.size() << " 只" << endl;
        } else if (cmd == 2) {
            int k = 0;
            for (Cat& c : roster) {
                k = k + 1;
                cout << k << ". ";
                c.greet();
            }
        } else {
            cout << "我们还没学会这个号码" << endl;
        }
    }
    return 0;
}
```

```text
登记了一个，名册上现在 1 只
我们还没学会这个号码
1. 我是张三，今年 3 岁
收摊，今天登记了 1 只
```

对着屏幕上的四行看这一段：

- **`for (int cmd : keys)`** —— 号码一个接一个进来。真坐在键盘前的时候，这一行会变成「主人敲一个、我们办一个」（下面那个提示框里就是）；
- **`if (cmd == 0) ... else if (cmd == 1) ... else`** —— **看号码挑一支走**。最后那个 `else` 是兜底：我们还没学会的号码，也得回一句话，不能一次不吭；
- **`break;`** —— **收摊那一支最要紧的一句**。`break` 的意思是「跳出这个走号码的圈」，走到它那儿，后面剩下的号码**一个都不再走**；
- **那个元素里的号码是 `1, 3, 2, 0, 1`** —— 收摊之后**还跟着一个 `1`**。屏幕上只剩四行，第五个 `1` 一个字都没印出来 —— 这就是 `break` 干的事（漏了它的样子在摔法四）。

::: tip 提示
**真坐在键盘前面的时候，只换两行。** 把

`vector<int> keys = {1, 3, 2, 0, 1};`

换成

`int cmd = -1;`

再把

`for (int cmd : keys) {`

换成

`while (cin >> cmd) {`

**圈里剩下的字一个都不用动。** 我们在本机真跑过这一版：传入 `1 1 2 0` 这一串号码，屏幕上就是

```text
登记了一个，名册上现在 1 只
登记了一个，名册上现在 2 只
1. 我是张三，今年 3 岁
2. 我是张三，今年 3 岁
收摊，今天登记了 2 只
```

两件事得先说清楚：

一是**输入接口只认号码**。别照着课文上面那样喂 `1 张三 3` —— 我们实测：号码 `1` 办完，输入接口读到 `张三` 就卡住了（那不是号码），圈当场退出，屏幕上只剩第一行。喂号码就好。

二是**登记那支现在写死了**。`roster.push_back(Cat("张三", 3));` 里的名字和年龄是钉死的，所以上面第三、四行都是张三 —— 你敲什么名字，它收下的都是张三。想让名册收下你敲进去的名字，得先让输入接口把名字和年龄也读进来（想一想 `cin >> n >> a;` 该摆在哪一行）—— 那是你自己动手的地方。

（`while (cin >> cmd)` 念作「**只要还能从输入接口读到号码，就一直办**」。主人敲完收摊那一下，我们走出圈，程序就收工了。）
:::

## 五、四种摔法

这四种都是我们在本机真跑过的，报错原文照抄。

### 摔法一：家底挂 `private:`，子对象够不着

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
private:
    string name;
    int age;
public:
    Cat(string n, int a) : name(n), age(a) {}
    void greet() {
        cout << "我是" << name << "，今年 " << age << " 岁" << endl;
    }
};

class Kitten : public Cat {
public:
    Kitten(string n, int a) : Cat(n, a) {}
    void show() {
        cout << name << endl;
    }
};

int main() {
    Kitten k("棉花", 1);
    k.show();
    return 0;
}
```

```text
main.cpp: In member function 'void Kitten::show()':
main.cpp:20:17: error: 'std::string Cat::name' is private within this context
main.cpp:7:12: note: declared private here
```

念作：「**这一格是私有的，你现在站的这个地方够不着。**」后面那句 `note` 还告诉你**它在哪一行扣的盖子**。

子类定义**不是**老类定义自己 —— 老类定义扣上盖子的格子，连亲生孩子都碰不得。想让子对象直接用，就把那一格挂成 `protected:`（我们在上面就是这么写的）。

### 摔法二：少写了 `public`

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
    int age;
public:
    Cat(string n, int a) : name(n), age(a) {}
    void greet() {
        cout << "我是" << name << "，今年 " << age << " 岁" << endl;
    }
};

class Kitten : Cat {
public:
    Kitten(string n, int a) : Cat(n, a) {}
};

int main() {
    Kitten k("棉花", 1);
    k.greet();
    return 0;
}
```

```text
main.cpp: In function 'int main()':
main.cpp:23:12: error: 'void Cat::greet()' is inaccessible within this context
main.cpp:11:10: note: declared here
main.cpp:23:12: error: 'Cat' is not an accessible base of 'Kitten'
```

念作：「**`greet` 这一手够不着；还有，`Cat` 这个底子对外也不通。**」

`class Kitten : Cat` 少了那一小段 `public`，就是**悄悄把老类定义整张扣上了盖子**：类定义套是套上了，可外面（还有 `main`）什么都够不着。**这一跤在抄写法的时候几乎必踩，两种写法差的就是那一个词。**

### 摔法三：子对象初始化时忘了把料递回给老类定义

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
    int age;
public:
    Cat(string n, int a) : name(n), age(a) {}
    void greet() {
        cout << "我是" << name << "，今年 " << age << " 岁" << endl;
    }
};

class Kitten : public Cat {
public:
    Kitten(string n) : name(n) {}
};

int main() {
    Kitten k("棉花");
    k.greet();
    return 0;
}
```

```text
main.cpp: In constructor 'Kitten::Kitten(std::string)':
main.cpp:18:24: error: class 'Kitten' does not have any field named 'name'
main.cpp:18:30: error: no matching function for call to 'Cat::Cat()'
```

第一句念作「**子对象自己名下没有叫 `name` 这样一格**」（那格是老类定义的，得由老类定义那一手去装）；第二句念作「**你没给老类定义喂料，它不知道该拿什么初始化**」。

修法就是老老实实把料递回去：`Kitten(string n, int a, int d) : Cat(n, a), days(d) {}`。

### 摔法四：收摊忘了跳出去

```cpp
#include <iostream>
#include <string>
#include <vector>
using namespace std;

class Cat {
protected:
    string name;
    int age;
public:
    Cat(string n, int a) : name(n), age(a) {}
    void greet() {
        cout << "我是" << name << "，今年 " << age << " 岁" << endl;
    }
};

int main() {
    vector<Cat> roster;
    vector<int> keys = {1, 0, 1};

    for (int cmd : keys) {
        if (cmd == 0) {
            cout << "收摊，今天登记了 " << roster.size() << " 只" << endl;
        } else if (cmd == 1) {
            roster.push_back(Cat("张三", 3));
            cout << "登记了一个，名册上现在 " << roster.size() << " 只" << endl;
        }
    }
    cout << "号码走完了，名册上 " << roster.size() << " 只" << endl;
    return 0;
}
```

```text
登记了一个，名册上现在 1 只
收摊，今天登记了 1 只
登记了一个，名册上现在 2 只
号码走完了，名册上 2 只
```

**收摊那一句印出来了，收摊却没收成。** 屏幕上看第三行 —— 收摊之后又登记了一个；最后一行更是明说：名册上 2 只。

漏掉的就是 `break;`。这一跤**编译器一个字都不提醒**：编得过、跑得完、每一行都像模像样，只有你盯着屏幕数一遍才发现收摊以后还在干活。（它还是**最轻的一种**：我们的号码是预先装在元素里的，走完就完了；真坐在键盘前面、号码无穷无尽地进来，那就得一直转到主人按 Ctrl+C —— 所以 `break;` 是菜单里最不能忘的一句。）

## 一句话对照表

| 这一课拼起来的零件 | 念作 | 是第几课学的 |
|---|---|---|
| `class Cat { ... };` | 定义一个类 | 第 01 课 |
| `protected:` / `public:` | 哪几格透、哪几格不透 | 第 04、09 课 |
| `Cat(string n, int a) : name(n), age(a) {}` | 初始化时先把料传入 | 第 02 课 |
| `class Kitten : public Cat` | 照着老类定义画一张新的 | 第 09 课 |
| `vector<Cat> roster;` | 一个会自己变长的元素 | 第 13 课 |
| `roster.push_back(...)` / `roster.size()` | 放一个进去 / 现在有几个 | 第 13 课 |
| `for (Cat& c : roster)` | 挨着过一遍，别复印 | 第 12、13 课 |
| `if / else if / else` | 看号码挑一支走 | 第 06 课 |
| `break;` | 跳出这个圈 | 第 07 课 |

## 小任务

1. 给 `Cat` 添一格「毛色」（挂 `protected:`），让 `greet()` 把毛色也输出 —— **子对象那张类定义一个字都不用改**，跑一次验证一下。
2. 把菜单里收摊那一支的 `break;` 删掉，跑一次 —— 屏幕上多了哪一行？为什么？
3. 给菜单加一支 `4`：把「名册上一共有几个」印出来。号码元素里加一个 `4`，看看副不副得出来。
4. 把 `for (Cat& c : roster)` 改成 `for (Cat c : roster)`，跑一次 —— 答案一样吗？（一样。那多出来的那个 `&` 到底省了什么？想想第 08 课那个「复印」的价钱。）
5. 留一问给你：我们现在有**两本名册** —— 一本装成年对象、一本装子对象（因为第二本要多记天数）。念名册得翻两本，加一个对象还得先想清楚放哪本。**能不能只用一本？** 下一课见分晓。

下一课我们要开一家**数据银行**：一本名册里装好几种账户，一句「取钱」各账户各样地应答；要是取多了呢？得学会**铺异常处理分支**接住翻车 —— 那是第一章学过的一手，我们把它跟今天这台机器拼起来。去处理数据 
