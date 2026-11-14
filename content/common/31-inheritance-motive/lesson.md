---
id: common-31
lang: common
stage: 0
order: 28
title: 继承与公共行为提取
tags: [面向对象, 继承]
required: ["common-30"]
crossRefs: ["java-stage2-02","python-stage2-07","cpp-stage2-09"]
estMinutes: 18
keywords: [inheritance, extends, super, override]
---

## 学习目标

本课学习继承与公共行为提取。重点包括没有继承的世界、第一步：两张类定义写全、第二步：提上那半截、第三步：只剩不同处、父类先处理完成。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 先看清楚：没有「继承」的世界长什么样

先别急着看终稿。我们在 C 的地界干活那会儿，干的就是今天这场「抄」—— 而且抄得更惨：连**学生甲**和**学生乙**之间那一点点不同，都得各写一整套。

```c
typedef struct { char name[20]; } OrangeCat;
typedef struct { char name[20]; } TabbyCat;

void orange_eat(OrangeCat c) { printf("%s：处理完成\n", c.name); }
void orange_meow(OrangeCat c) { printf("%s：喵！\n", c.name); }   /* 学生甲那一套 */

void tabby_eat(TabbyCat c)   { printf("%s：处理完成\n", c.name); }
void tabby_meow(TabbyCat c)  { printf("%s：喵喵！\n", c.name); }    /* 学生乙：又一整套 */
```

两个盒子、两套函数，一模一样的句子写了两份。想改「处理完成」那句话？**两处都得动**。想再添一个黑白花？那就是第三套。

C 里没有「继承」这回事，干活的老对象琢磨过一个凑合的办法：**一个 struct 加一格 `int type;`，函数里用 `switch` 分流**：

```c
typedef struct {
    char name[20];
    int type;                /* 1 = 学生甲，2 = 学生乙 */
} Cat;

void cat_meow(Cat c) {
    switch (c.type) {
        case 1: printf("%s：喵！\n", c.name); break;
        case 2: printf("%s：喵喵！\n", c.name); break;
    }
}
```

一个盒子装下所有品种，比抄两套强。可每个函数一进门，先要问一句「你是哪一型」；将来加一种动物，还得回来往每个 `switch` 里再见缝插一行。先看个够 —— 今天这一手学完，你回头再看这两段 C 代码，会觉得它像没装电梯的六楼。

## 第一步：先老老实实把两张类定义写全

到了有类定义的语言里，我们先**不抽象** —— 老老实实按老规矩，把两种动物各写成一张**各自完整**的类定义。先写对象，再写狗：

```python
class Cat:
    def __init__(self, name):
        self.name = name

    def eat(self):
        print(f"{self.name}：处理完成")

    def speak(self):
        print(f"{self.name}：喵！")

class Dog:
    def __init__(self, name):
        self.name = name

    def eat(self):
        print(f"{self.name}：处理完成")

    def speak(self):
        print(f"{self.name}：汪！")

cat = Cat("学生甲")
dog = Dog("大黄")
cat.speak()
dog.speak()
```

```text
学生甲：喵！
大黄：汪！
```

摊开看：`__init__` 那一段、`eat` 那一段，**两段一字不差**；`speak` 两段长得也一样，只有最后一行里的字不同。鸟类定义要是也这么写，就是第三遍。这么写没写错 —— 它**能跑**，把上面那段抄进练习场，屏幕上就是那两行；我们特意先把它摆出来，就是要让你亲眼看见重复 —— 看不见重复，后面的「抽取」就成了变戏法。（先重复、后抽象，是我们这条线上一路立的规矩。）

## 第二步：把一模一样的那半截提上来

下一步是关键动作，也是很多对象一开始就想反的地方：**不是把类定义往下抄，是把共同点往上提。**

我们把两张类定义并排摊开，拿变量一行一行圈：

- 名字那一格 `self.name`：两张类定义一模一样 → 圈走；
- 初始化那一手 `__init__`：一模一样 → 圈走；
- 处理那一个方法 `eat`：一模一样 → 圈走；
- 出一次 `speak`：名字一样、只有叫法不同 → 把「通用版」圈走，具体叫法留给各自。

圈出来的这半截，我们把它重新画到**一张新类定义**上，起名叫 `Animal`（动物）：

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def eat(self):
        print(f"{self.name}：处理完成")

    def speak(self):
        print(f"{self.name}发出了一次叫")      # 通用版：不知道是啥动物时，先这么叫
```

这张 `Animal` 类定义，行话里叫**父类（父类）**；照着它画的子类们，叫**子类（子类）**。这一手 —— 子类照着父类画下来、父类上的东西子类自动全有 —— 的正式名字，术语表里叫**继承**。

顺嘴说清一件事：这几张类定义之间的亲，是**先看见重复、后圈出来的**，不是开场就先写的咒语。图省事先套一张父类、再往里塞东西，那是把顺序整个倒过来了。

## 第三步：子类只剩各自不同处

提上去之后，把三张类定义摆在一起看：两张子类上，只剩「自己独有的那点东西」要写了。

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def eat(self):
        print(f"{self.name}：处理完成")

    def speak(self):
        print(f"{self.name}发出了一次叫")

class Cat(Animal):
    def __init__(self, name):
        super().__init__(name)      # 把名字交给父类那半截去装

    def speak(self):
        print(f"{self.name}：喵！")

class Dog(Animal):
    def __init__(self, name):
        super().__init__(name)

    def speak(self):
        print(f"{self.name}：汪！")
```

`class Cat(Animal):` 这一行读作「**类定义，照着动物类定义画**」。注意看：`Cat` 类定义上现在**没有** `self.name`、**没有** `eat` —— 一个字都没写，却样样都会，因为父类那半截上全有。子类只在**不一样的地方**盖掉重画：对象的 `speak` 是「喵！」，狗的 `speak` 是「汪！」。

子类把父类的一个方法**盖掉**、换上自己这版，这件事行话里叫**重写（override）**。今天只做最小的那种：改掉父类的**一个**方法 —— 别的都白捡。鸟也照这个法子来：`class Bird(Animal):`，只写自身的输出「啾」。

好处立刻看得见：那段公共说明从此**只有一份**，安家在 `Animal` 上。往后想改「处理完成」印的话，只改 `Animal` 那一处，对象、狗、鸟**一起跟着变** —— 改动面从三处收回成一处。

## 初始化那一刻，父类那半截要先处理完成

上面那段代码里藏着一句今天最要紧的话：**子类初始化时，父类那半截要先处理完成** —— `super().__init__(name)` 就是干这个的。

它读作「**上一层那版初始化那一手，也请你跑一遍**」。为什么非写不可？因为名字那一格其实长在父类那半截上：对象自己那手只干一件事 —— 把名字转交出去；父类的初始化手不跑，那个对象的 `name` 格就是空的。

四门语言在这件事上脾气不一样：

- **Java**：`Cat(String name) { super(name); }` —— 不写 `super(...)`，编译器或解释器当场拦下，**编译不过**。因为 `Animal` 只认得「带着名字初始化」这一种生法，没有名字就没法开工，错了立刻知道。
- **Python**：`super().__init__(name)` 忘了写，**当场一点都不炸** —— `Cat("学生甲")` 照样初始化，一直等到哪天用到 `self.name`，才突然报「这个对象没有 `name` 这格」。安安静静埋着，比 Java 那种当场拦下难抓多了。
- **C++**：不写单独的 `super` 一行，写在初始化那一手**冒号后面那一小段**里（行话叫成员初始化列表）：`Cat(string n) : Animal(n) {}`。
- **C**：没有「初始化那一手」这回事 —— 结构体初始化时没人喂，名字得自己一格一格填（`strcpy(cat.name, ...)`）。

还有个一眼就会想歪的地方，我们提前掐掉：初始化那一刻**不是「先造一个动物、再造一个对象」** —— 从头到尾只有一个对象，父类那半截是**它身上先收拾好的那部分**。

我们把初始化这一路的来回，拆成一步一步走给你看：

```demo
title: 一个对象的初始化：父类那半截先处理完成，自己的输出结果再盖上
code:
| class Animal:
|     def __init__(self, name):
|         self.name = name
|     def eat(self):
|         print(f"{self.name}：处理完成")
|     def speak(self):
|         print(f"{self.name}发出了一次叫")
| class Cat(Animal):
|     def __init__(self, name):
|         super().__init__(name)
|     def speak(self):
|         print(f"{self.name}：喵！")
| class Dog(Animal):
|     def __init__(self, name):
|         super().__init__(name)
|     def speak(self):
|         print(f"{self.name}：汪！")
| cat = Cat("学生甲")
| dog = Dog("大黄")
| cat.speak()
| dog.speak()
| cat.eat()

step 先画公共那半截：凡是动物都有的
at: 1
say: `class Animal:` 开工。第 2~3 行是名字那一格与初始化那一手，第 4~5 行是处理，第 6~7 行是「出一次」的通用版 —— 不知道手里是啥动物时，先这么叫。
meow: 父类 Animal 定义好了。
pose: expect
父类 Animal = 摊开了（初始化那手还没跑过）
子类 Cat = 还没画
子类 Dog = 还没画
cat 的变量 = 还没生
dog 的变量 = 还没生
标准输出 = 还没印

step 对象认亲：括号里写着照谁画
at: 8
say: `class Cat(Animal):` —— 类定义自己没有名字格、没有处理招，全在 `Animal` 上。它只写两处自己的话：初始化那一手补一句、输出结果盖一版。
meow: Cat 继承了 Animal 的全部内容。
pose: expect
父类 Animal = 摊开了（初始化那手还没跑过）
子类 Cat = 认了亲（只剩自己那点）
子类 Dog = 还没画
cat 的变量 = 还没生
dog 的变量 = 还没生
标准输出 = 还没印

step 狗也认亲：同一句话，只换叫法
at: 13
say: `class Dog(Animal):` —— 跟对象一模一样的认亲动作。省下来的，正是刚才圈出来的那几处重复：从今往后，「处理完成」这句话只有 `Animal` 上的一份。
meow: Dog 也继承了，重复代码省掉了。
pose: expect
父类 Animal = 摊开了（初始化那手还没跑过）
子类 Cat = 认了亲（只剩自己那点）
子类 Dog = 认了亲（只剩自己那点）
cat 的变量 = 还没生
dog 的变量 = 还没生
标准输出 = 还没印

step 调用一次 Cat("学生甲")：初始化开始
at: 18
say: 新对象先跑到**对象自己**的初始化那一手（第 9 行）。可它手里只有名字，名字那格还长在父类那半截上 —— 对象自己这手第一件事，就是回头去请父类。
meow: 对象创建，先进入子类的初始化。
pose: busy
父类 Animal = 摊开了（初始化那手开跑）
子类 Cat = 认了亲（只剩自己那点）
子类 Dog = 认了亲（只剩自己那点）
cat 的变量 = 刚初始化，名字还没装
dog 的变量 = 还没生
标准输出 = 还没印

step super 一出场：父类那半截先处理完成
at: 10
say: `super().__init__(name)` 读作「上一层那版初始化那一手，也请你跑一遍」—— 跳到**父类**第 2 行去。这一步要是漏掉，名字就没人装；Java 当场编译不过，Python 会安静地拖到用名字那天才炸。
meow: 调用父类的初始化，存入名字。
pose: busy
父类 Animal = 摊开了（初始化那手开跑）
子类 Cat = 认了亲（只剩自己那点）
子类 Dog = 认了亲（只剩自己那点）
cat 的变量 = 刚初始化，名字还没装
dog 的变量 = 还没生
标准输出 = 还没印

step 名字落进这个对象自己的变量
at: 3
say: `self.name = name` 在父类那半截里跑 —— 注意 `self` 一路指的都是**刚初始化的同一个对象**（引用照旧指着它），不是另造了一个动物。「学生甲」装进它自己的变量，跑完才回到对象自己那手收尾。
meow: 名字存进这个对象，初始化完成。
pose: yay
父类 Animal = 摊开了（初始化那手开跑）
子类 Cat = 认了亲（只剩自己那点）
子类 Dog = 认了亲（只剩自己那点）
cat 的变量 = 名字「学生甲」
dog 的变量 = 还没生
标准输出 = 还没印

step 第二只：同一条路，走一遍
at: 19
say: `dog = Dog("大黄")` —— 路线一个字没变：狗自己的初始化手 → 回头请父类 → 名字落进**狗自己**的变量。两个各带各的名字，谁也不碰谁。
meow: 同样的流程，第二个对象也有自己的名字。
pose: yay
父类 Animal = 摊开了（初始化那手开跑）
子类 Cat = 认了亲（只剩自己那点）
子类 Dog = 认了亲（只剩自己那点）
cat 的变量 = 名字「学生甲」
dog 的变量 = 名字「大黄」
标准输出 = 还没印

step 各调用各的 speak：自己那版盖过父类的
at: 20
say: `cat.speak()` 走到对象重写的那一版（第 12 行）—— 父类的通用版被它**盖掉**了，所以是「喵！」；第 21 行的狗一样，走第 17 行：「汪！」。同一句函数名，各应各的，可**靠什么知道该走哪一版**，下一课才揭盖。
meow: 各调用各自重写后的版本。
pose: busy
父类 Animal = 摊开了（初始化那手开跑）
子类 Cat = 认了亲（只剩自己那点）
子类 Dog = 认了亲（只剩自己那点）
cat 的变量 = 名字「学生甲」
dog 的变量 = 名字「大黄」
标准输出 = 2 行：学生甲：喵！ / 大黄：汪！

step 白捡的那一个方法：父类的 eat 照样能调用
at: 22
say: `cat.eat()` —— 类定义上**根本没写这一个方法**，第 4~5 行的处理长在父类上，照样跑得动。这就是「提起共同点」最实在的回报：写的时候省一遍，改的时候也只改一处。
meow: eat 来自父类，子类不用再写。
pose: proud
父类 Animal = 摊开了（初始化那手开跑）
子类 Cat = 认了亲（只剩自己那点）
子类 Dog = 认了亲（只剩自己那点）
cat 的变量 = 名字「学生甲」
dog 的变量 = 名字「大黄」
标准输出 = 3 行：学生甲：喵！ / 大黄：汪！ / 学生甲：处理完成
```

## 是不是亲生的？——「是一种」判据

套类定义不是随便套的，套之前先问一句：**子类「是一种」父类吗？**

- 对象**是一种**动物 ✓、狗**是一种**动物 ✓ —— 套得对，动物类定义上那半截，它们本来就都该有。
- 对象**有一条**末尾 —— 末尾不是对象的「一种」，是对象**拥有**的一样东西。这时候**不许**写 `class Cat(Tail)` 这种怪类定义：照它创建后的对象会带上「末尾的一切设定」，却丢了名字和处理，而且「对象是末尾」这句话本身就说不通。正确的做法是把末尾放进**对象身上的一格**（`self.tail = ...`），或者单独画一张末尾类定义、把它当一格收进来。

一句话：**「是一种」才套类定义，「有一条」放进格子**。套之前拿这句卡一下，能挡下大多数乱认亲。

::: tip 提示
今天记住三句话：

1. **先重复、后抽象**：先照原样把两张类定义各写全、跑通，亲眼看见哪几行一字不差，再把共同的那半截**往上提**成一张公共父类 —— 顺序反过来，就成了变戏法。
2. **初始化那一刻，父类先处理完成**：子类自己的初始化手一动，第一件事就是把料交给父类那半截（`super(...)`；C++ 写在冒号后面那一小段）。漏了它，名字就没人装。
3. **重写**：子类把父类的一个方法盖掉、换成自己这版 —— 今天只盖**一个**方法，别的全是从父类白捡的。
:::

::: warn 注意
两个坑，我们标出来：

- **忘了请父类，一个响一个哑**：Java 里 `super(...)` 不写，编译器或解释器当场拦下、**编译不过**；Python 里 `super().__init__(...)` 不写，**当场一次不响**，一直拖到哪天用到名字才炸。哑的那个难抓得多。
- **「是一种」才套类定义**：对象**是一种**动物，套得；对象**有一条**末尾 —— 末尾不是对象的「一种」，不许写 `class Cat(Tail)` 那种怪类定义，该把末尾放进**对象身上的一格**。
:::

## 四位编译器或解释器，同一张公共类定义

同一件事：动物都有名字、会处理、会出一次；给出一张公共父类，让对象和狗各自只补自身的输出叫，然后各调用各的。

```compare
c::
#include <stdio.h>
#include <string.h>

typedef struct { char name[20]; } Cat;
typedef struct { char name[20]; } Dog;

void cat_speak(Cat c) { printf("%s：喵！\n", c.name); }   /* 对象自己一套 */
void dog_speak(Dog d) { printf("%s：汪！\n", d.name); }   /* 狗再抄一套 */

int main(void) {
    Cat cat; Dog dog;
    strcpy(cat.name, "学生甲");
    strcpy(dog.name, "大黄");
    cat_speak(cat);
    dog_speak(dog);
    return 0;
}

cpp::
#include <iostream>
#include <string>
using namespace std;

class Animal {
public:
    string name;
    Animal(string n) : name(n) {}
    void eat() { cout << name << "：处理完成" << endl; }
    void speak() { cout << name << "发出了一次叫" << endl; }
};

class Cat : public Animal {
public:
    Cat(string n) : Animal(n) {}                        // 冒号后面先喂饱父类那半截
    void speak() { cout << name << "：喵！" << endl; }
};

class Dog : public Animal {
public:
    Dog(string n) : Animal(n) {}
    void speak() { cout << name << "：汪！" << endl; }
};

int main() {
    Cat cat("学生甲");
    Dog dog("大黄");
    cat.speak();
    dog.speak();
    return 0;
}

java::
class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }

    void eat() {
        System.out.println(name + "：处理完成");
    }

    void speak() {
        System.out.println(name + "发出了一次叫");
    }
}

class Cat extends Animal {
    Cat(String name) {
        super(name);                    // 这行不写，编译不过
    }

    void speak() {
        System.out.println(name + "：喵！");
    }
}

class Dog extends Animal {
    Dog(String name) {
        super(name);
    }

    void speak() {
        System.out.println(name + "：汪！");
    }
}

public class Main {
    public static void main(String[] args) {
        Cat cat = new Cat("学生甲");
        Dog dog = new Dog("大黄");
        cat.speak();
        dog.speak();
    }
}

python::
class Animal:
    def __init__(self, name):
        self.name = name

    def eat(self):
        print(f"{self.name}：处理完成")

    def speak(self):
        print(f"{self.name}发出了一次叫")

class Cat(Animal):
    def __init__(self, name):
        super().__init__(name)

    def speak(self):
        print(f"{self.name}：喵！")

class Dog(Animal):
    def __init__(self, name):
        super().__init__(name)

    def speak(self):
        print(f"{self.name}：汪！")

cat = Cat("学生甲")
dog = Dog("大黄")
cat.speak()
dog.speak()
```

```text
学生甲：喵！
大黄：汪！
```

看出来了吗：**四段说的是同一件事，写起来差在「认亲」那一小段**。

- **C**：只有版本一 —— 两个盒子各配一套函数（`cat_speak`、`dog_speak`），改一句话要改两处；C 里没有「把公共半截提上来」这回事。
- **C++**：`class Cat : public Animal` —— 认亲写在子类名字后面；喂饱父类那半截，写在初始化那一手**冒号后面那一小段**（`Cat(string n) : Animal(n) {}`）。顺带埋一句：C++ 认亲之后还藏着一个 `virtual` 的机关，今天先不拆，「多态调用」那一课专门伺候它。
- **Java**：`class Cat extends Animal` —— `extends` 后面跟父类的名字；父类那半截靠 `super(name);` 喂饱，**不写编译不过**。
- **Python**：认亲写在**括号**里（`class Cat(Animal):`），喂饱父类那半截靠 `super().__init__(name)`；**忘了写，当场不报错**，用到名字那天才炸。

四位编译器或解释器的共识就一条：**共同的那半截提上去，子类只写自己的**。

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `class Animal:` | 画一张公共父类：凡是动物都有的那半截写这儿 |
| `class Cat(Animal):` | 类定义照着动物类定义画（Python 的认亲写法） |
| `extends` / `: public` | Java / C++ 里「照着画」的写法 |
| `super().__init__(name)` | 初始化时先请父类那半截处理完成（Java 写 `super(name)`；C++ 写在冒号后面 `Animal(n)`） |
| 子类里再写一遍 `speak` | 重写（override）：把父类那一个方法盖掉，换成自己的叫法 |
| `cat.eat()`（`eat` 长在父类上） | 子类一个字没写也调用得动 —— 提上去的东西自动全有 |

## 小任务

1. **动脑**：我们的伙伴计算机也要入档了。如果要给「对象」和「鲸鱼」抽一张公共父类 `Animal`，上面能写哪几样？（提示：凡是动物都有的 —— 名字、处理、出一次。那「会游泳」呢？它该放哪儿？）
2. **动手**：把课文里 `Animal`、`Cat`、`Dog` 那段抄进练习场，添一张 `Bird` 类定义照 `Animal` 画，只改 `speak`（「啾」），创建一个小啾、称呼它一次 —— 跑起来看看，屏幕上是不是两行变三行？
3. **再想一想**：下面三句话，哪几句该用「套类定义」、哪句该用「放格子」？① 狗是一种动物；② 狗有一条末尾；③ 学生乙是一种对象。

下一课，我们要让这些类定义活起来：站着调用一次「处理完成 —— ！」，不管手里拿的是对象是狗，各处理各的、各应各的；至于我们之前在 C 里用惯的那套 `switch` —— 该请它出去了。下一课「多态调用」见 
