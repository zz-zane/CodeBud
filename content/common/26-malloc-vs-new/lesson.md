---
id: common-26
lang: common
stage: 0
order: 23
title: malloc 与 new：内存申请和对象构造
tags: [面向对象, 内存]
required: ["common-25"]
crossRefs: ["c-stage2-04","cpp-stage1-11","java-stage3-18"]
estMinutes: 17
keywords: [malloc, new, free, delete, gc]
---

## 学习目标

本课学习malloc 与 new：内存申请和对象构造。重点包括C 的老办法：先租变量再请对象、C++ 的新办法：new 一调用对象入住、四位编译器或解释器请同一个张三、两声「自己跑」。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## C 的老办法：先租变量，再手动请对象

C 那边的家伙什，我们先摆出来：变量是论字节租的（`malloc`），租完返回一张**指针**；还变量的函数叫 `free`。这一回要住的不是一排整数，是一个对象 —— 类定义（`struct`）先画好，再照它请一个：

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char name[20];
    int fish;
} Cat;

void cat_init(Cat *p, char name[], int fish) {   /* 请对象进门：我们自己写的一个方法 */
    strcpy(p->name, name);
    p->fish = fish;
    printf("%s：我们初始化啦\n", p->name);          /* 报到这一次，也得自己写 */
}

void cat_say(Cat *p) {
    printf("%s：我们有 %d 条数据\n", p->name, p->fish);
}

int main(void) {
    Cat *p = (Cat *)malloc(sizeof(Cat));         /* 只租到一块地方 */
    if (p == NULL) {
        return 1;
    }
    cat_init(p, "张三", 3);                      /* 手动把对象请进去 */
    cat_say(p);
    free(p);                                     /* 还变量 */
    p = NULL;                                    /* 名称擦干净 */
    return 0;
}
```

```text
张三：我们初始化啦
张三：我们有 3 条数据
```

这一版里，**每一件事都是我们亲手办的**，一句一句看：

- **`(Cat *)malloc(sizeof(Cat))`** 只办「租地方」这一件事：先拿 `sizeof(Cat)` 量出一个对象该占多大，再向系统租一块这么大的地方。返回的名称是张**没写牌面的万能牌**（行话 `void *`）—— 是那个 `(Cat *)` 强转把牌面补成「指着装 `Cat` 的变量」。
- **租到手这一刻，里面还不是对象** —— 名字格、数据数格里坐着的，是上任租客留下的东西。地方有了，对象还没有。
- **`cat_init(p, "张三", 3);`** 是「请对象进门」这一步，我们自己写、自己调用：把名字抄进 `name` 格、把数写进 `fish` 格；连那声「我们初始化啦」，也是我们在里面亲手 `printf` 的 —— C 不会替你做任何一步。
- **`cat_say(p);`** 报数这一个方法站在类定义**外面**，得把名称传入，它才知道跟哪个对象说话。
- **`free(p);`** 用完还回去，再把名称擦成 `NULL` —— 老规矩：还完不擦，顺手一用就摸到不再属于你的地方。
- 要是把 `cat_init` 那一行删掉？名字格就一直是那串不认识的东西 —— **具体印出什么，每台机器都不一样**。那不是对象，那是一块「还没有对象」的地方。

看出来了吗：请一个 C 的对象入住，我们得办三件事 —— **量尺寸写牌面**（`sizeof` ＋ 强转）、**请对象**（`cat_init`）、**还账**（`free`）。哪一件忘了，都没人提醒你。

## C++ 的新办法：`new` 一调用，对象自己入住

同一件事搬到 C++，我们是这么写的：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    int fish;

    Cat(string n, int f) {              /* 初始化那一个方法 */
        name = n;
        fish = f;
        cout << name << "：我们初始化啦" << endl;
    }

    ~Cat() {                            /* 回窝那一个方法 */
        cout << name << "：我们回窝啦" << endl;
    }

    void say() {
        cout << name << "：我们有 " << fish << " 条数据" << endl;
    }
};

int main() {
    Cat* p = new Cat("张三", 3);        /* 一句：请对象入住 */
    p->say();
    delete p;                           /* 一句：送对象回窝 + 还地方 */
    return 0;
}
```

```text
张三：我们初始化啦
张三：我们有 3 条数据
张三：我们回窝啦
```

盯住 `new Cat("张三", 3)` 这一句 —— **它一句话藏着两下**：

1. **照类定义租地方。** 该租多大由 `Cat` 这张类定义说了算，我们一句 `sizeof` 都没写；返回的名称本身就是 `Cat*`，也不用强转补牌面。它还顺手核对了一遍：这张类定义上有没有一个方法接得住「名字 ＋ 3」这对料？接不住当场拦下（写成 `new Cat(3)` 连编译都过不去）—— 行话管这叫**类型安全**。
2. **把初始化那一个方法叫来跑。** 地方一到手，`new` 立刻把类定义上那招「初始化」叫来 —— 名字、数当场装好，还替我们打印了一次「我们初始化啦」。**main 里没有任何一句在称呼它** —— 它是 `new` 自己叫来的。

`delete p;` 也是两下：先把「**回窝那一个方法**」叫来跑（屏幕上最后一次「我们回窝啦」就是它），**然后**该变量才真的还回去。对照 C：那边对应的只有 `free` 一下 —— 只有「还地方」，「回窝」这个角色压根不存在。

行话里，初始化那一个方法叫**构造函数（构造函数）**，回窝那一个方法叫**析构函数（析构函数）**。它们为什么会被自动叫、怎么写、一个类定义上能写几个 —— 那是下一课的戏，今天你只要认下这一点：**你没调用，它们真的会自己跑**。

于是那道分水岭，一句话说清：

> **`malloc` 管的是「有没有地方」；`new` 管的是一个对象的一生 —— 初始化、住下、回窝。**

前一句的行话叫「内存管理」；升级后的这一句，叫**对象生命周期管理（从初始化到回窝）** —— 今天你就是站在这句话上的。

## 四位编译器或解释器，请同一个张三

同一件事：请一个叫「张三」的对象、带 3 条数据，让它报到。

```compare
c::
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char name[20];
    int fish;
} Cat;

void cat_init(Cat *p, char name[], int fish) {
    strcpy(p->name, name);
    p->fish = fish;
    printf("%s：我们初始化啦\n", p->name);   /* 这一次，得亲手写 */
}

void cat_say(Cat *p) {
    printf("%s：我们有 %d 条数据\n", p->name, p->fish);
}

int main(void) {
    Cat *p = (Cat *)malloc(sizeof(Cat));   /* 租一个变量 */
    cat_init(p, "张三", 3);                /* 手动请对象 */
    cat_say(p);
    free(p);                               /* 还变量 */
    return 0;
}

cpp::
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    int fish;

    Cat(string n, int f) {
        name = n;
        fish = f;
        cout << name << "：我们初始化啦" << endl;
    }

    void say() {
        cout << name << "：我们有 " << fish << " 条数据" << endl;
    }
};

int main() {
    Cat* p = new Cat("张三", 3);   /* 请对象入住：初始化那一个方法自己跑 */
    p->say();
    delete p;                      /* 还回去 */
    return 0;
}

java::
class Cat {
    String name;
    int fish;

    Cat(String n, int f) {
        name = n;
        fish = f;
        System.out.println(name + "：我们初始化啦");
    }

    void say() {
        System.out.println(name + "：我们有 " + fish + " 条数据");
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三", 3);   // 口令也叫 new
        c.say();
        // 没有 free，也没有 delete
    }
}

python::
class Cat:
    def __init__(self, name, fish):
        self.name = name
        self.fish = fish
        print(f"{self.name}：我们初始化啦")

    def say(self):
        print(f"{self.name}：我们有 {self.fish} 条数据")

cat = Cat("张三", 3)   # 连 new 都不用写
cat.say()
# 也没有 free / delete
```

```text
张三：我们初始化啦
张三：我们有 3 条数据
```

四边屏幕上印的头两行**一模一样**，可第一行「初始化啦」**是怎么来的**，差得远了：

- **C**：这一次是 `cat_init` 里那句**手写的 `printf`** —— 不写就没有；两格也是手动装的；用完 `free(p);`，一句都不少。
- **C++**：这一次是 `new` 自己把**初始化那一个方法**叫来的 —— 我们一个字都没写「初始化」。这段里 `delete p;` 也在（租来的要还）；这张类定义没写回窝那一个方法，所以它还不出声 —— 别急，下一段拆步里我们让它出声给你听。
- **Java**：口令也叫 `new`，初始化那一个方法照样自己跑；可是**没有 `free`、没有 `delete`** —— 院子里养着垃圾回收器（内存回收），谁没人要了它自己来扫（那条线在 java-stage3-18，专门讲它）。
- **Python**：连 `new` 都不用写 —— 调用一次类定义名 `Cat("张三", 3)`，初始化那一个方法自己跑；也没有还的活，同样是清理官看着的。

到这儿，那句「`new` 就是 `malloc` 使用另一个名称」，可以正式判掉了：**换名字的话，对象不会自己出声。**

## 走一遍：`new` 与 `delete` 的两声「自己跑」

```demo
title: new 一句话里的两下，与 delete 的两下
code:
| class Cat {
| public:
|     string name;
|     int fish;
|     Cat(string n, int f) {
|         name = n;
|         fish = f;
|         cout << name << "：我们初始化啦" << endl;
|     }
|     ~Cat() {
|         cout << name << "：我们回窝啦" << endl;
|     }
|     void say() {
|         cout << name << "：我们有 " << fish << " 条数据" << endl;
|     }
| };
| int main() {
|     Cat* p = new Cat("张三", 3);
|     p->say();
|     delete p;
|     return 0;
| }

step 类定义先摊开：两格，加三个方法
at: 1
say: 类定义上一共三个方法：**初始化那一个方法**（第 5 行）、**回窝那一个方法**（第 10 行，名字前带一个小波浪 `~`）、**报数那一个方法**（第 13 行）。这一刻两格都还空着，元素边还没有对象。对照 C：那边的类定义（`struct`）里只有两格，一个方法都进不去。
meow: 类写好了，对象还没创建。
pose: expect
类定义 Cat = 画好了（两格 + 三个方法）
张三 = 还没初始化
张三的变量 = 还没租
标准输出 = 还没印

step new 第一下：照类定义租地方
at: 18
say: `Cat* p = new Cat("张三", 3);` —— 编译器或解释器先照类定义算好该租多大，我们一句 `sizeof` 都没写；然后伸手租回来一间空屋。到这一步为止，C 那边也一样（那句 `malloc`），差别在下半句。
meow: 内存先分配好，接着构造对象。
pose: busy
类定义 Cat = 画好了（两格 + 三个方法）
张三 = 还没初始化
张三的变量 = 租好了（空的 —— 里面还不是对象）
标准输出 = 还没印

step new 第二下：初始化那一个方法自己来了
at: 5
say: 地方一到手，`new` **立刻**把初始化那一个方法叫来跑 —— main 里没有任何一句在称呼它。对照 C：这一步在那边叫 `cat_init(...)`，是**你亲手写、亲手调用**的一个方法。
meow: 没有手动调用，构造函数自动执行。
pose: yay
类定义 Cat = 画好了（两格 + 三个方法）
张三 = 刚初始化，两格还没装
张三的变量 = 租好了（空的）
标准输出 = 还没印

step 两格当场装好
at: 6
say: 初始化那一个方法里，`name = n` 把「张三」装进名字格；下一行 `fish = f` 把 3 装进数据格 —— 传入进来的料，落进的正是**这个对象自己**的两格。
meow: 名字和数量存进对象。
pose: busy
张三 = 两格装好（张三，3 条）
张三的变量 = 租好了（对象住进去了）
标准输出 = 还没印

step 报到那一次
at: 8
say: `cout << name << "：我们初始化啦"` —— 初始化那一个方法里的打印。**这一次不是 main 里输出的**，是类定义上的函数自己跑出来的声音。（对照 C：同一次，是 `cat_init` 里那句亲手写的 `printf`。）
meow: 这句是构造函数自己输出的。
pose: yay
张三 = 两格装好（张三，3 条）
张三的变量 = 租好了（对象住进去了）
标准输出 = 1 行：张三：我们初始化啦

step 顺着名称称呼它报数
at: 19
say: `p->say()` —— `->` 读作「顺着名称，去找它指着的那个对象」，再称呼它那一个方法。念的是**它自己**那份数。对照 C：同样的活写成 `cat_say(p)`，得把名称传入站在外面的函数里。
meow: 沿指针调用对象的方法，输出 3。
pose: expect
张三 = 两格装好（张三，3 条）
张三的变量 = 租好了（对象住进去了）
标准输出 = 2 行：初始化啦 / 有 3 条数据

step delete 第一下：回窝那一个方法自己跑
at: 20
say: `delete p;` 一调用，回窝那一个方法（第 10 行）自己跑起来，印出最后一行。**C 那边没有这一次** —— 「回窝」这个角色，那边压根不存在。
meow: delete 触发析构函数，输出最后一行。
pose: think
张三 = 回窝了
张三的变量 = 马上还回去
标准输出 = 3 行：初始化啦 / 有 3 条 / 回窝啦

step delete 第二下：地方这才真的还了
at: 20
say: 回窝戏唱完，该变量才真的还回去。注意名称 `p` **还在我们手里** —— 顺着它再调用函数，就是摸进已经退租的变量（C 那边同一条规矩：`free` 完把名称擦成 `NULL`）。
meow: 内存已释放，不能再通过 p 访问。
pose: proud
名称 p = 还挂着（可它指的地方已经还了）
张三 = 回窝了
张三的变量 = 还回去了
标准输出 = 3 行（收工）
```

::: tip 提示
今天守好三句：

1. **`malloc` 管地方，`new` 管一个对象的一生** —— 初始化那一个方法与回窝那一个方法，`new`、`delete` 会自己替你叫。
2. **还账要配对**：`malloc` 配 `free`、`new` 配 `delete`；租一排还一排时写 `delete[]`，后面那对方括号别丢。
3. **Java / Python 没有还的活**：清理官（GC）照看；C 与 C++ 里，还的活是你的。
:::

::: warn 注意
三个坑，我们标出来：

- **别在 `malloc` 的变量上调用函数。** 编译那关可能放行，可里面坐着的不是对象 —— 初始化那一个方法一次没跑过，两格是空的。请对象用 `new`，改回来就好。
- **`delete` 与 `delete[]` 别搭错。** 租一间（`new int(7)`、`new Cat(...)`）用光板的 `delete`；租一排（`new int[3]`）用 `delete[]`。账还要一一对：`new` 出来的别拿 `free` 还、`malloc` 出来的别拿 `delete` 还。更深一层的账先记一眼：C 里 `free` 只管还地方，对象身上要是挂着别家租来的东西（比如它自己租的一串数据），得在 `free` 前自己先清干净 —— 那是后头语言线的戏。
- **还完的名称别再用。** `delete p;` 之后名称还在手里，可地方已经还了 —— 顺着它再调用函数，等于摸进已退租的变量（C 那边同一条规矩：`free` 完擦成 `NULL`）。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `(Cat *)malloc(sizeof(Cat))` | 只租地方：尺寸自己量、牌面（强转）自己补；此刻它还不是对象 |
| `cat_init(p, "张三", 3);` | 手动请对象：两格自己装，连报到那一次也自己 `printf` |
| `free(p);` | 还变量（C 的还账方式，还完把名称擦成 `NULL`） |
| `new Cat("张三", 3)` | 请对象入住：量尺寸、租地方、叫初始化那一个方法 —— 一句办完，还顺手核对料对不对 |
| `p->say();` | 顺着名称找到对象，称呼它报数 |
| `delete p;` | 先送对象回窝（回窝那一个方法自己跑），再还地方 |
| Java / Python 那一半 | 只 `new`（Python 连 `new` 都不写），没有还的活 —— 清理官在 |

## 小任务

1. **数一数（动脑）**：C 的三件事（量尺寸写牌面、请对象、还账）搬到 C++，我们只剩两句（`new`、`delete`）。哪几笔是「自动」替你办的？一条条列出来。
2. **动手**：把 C++ 那段抄进练习场，先**删掉 `delete p;` 跑一遍**，记下屏幕上几行；再加回来跑一遍 —— 多出来的那一行，是什么时候出现的？
3. **再动手**：把 `cat_init(p, "张三", 3);` 那一行删掉、原样再跑一遍那段 C，**先猜**屏幕上会印出什么。跑完对一对：那串东西是你写的吗？为什么会这样？

下一课，我们把今天这两声「自己跑」掰开揉碎：那一个方法到底长什么样、为什么你没称呼它也会来、一个类定义上能写几个 —— 《对象初始化与资源释放——构造函数与析构函数》，探险见 
