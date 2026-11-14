---
id: c-stage2-06
lang: c
stage: 2
order: 6
title: 结构体与指针
tags: [结构体, 指针]
required: ["c-stage2-05"]
crossRefs: []
compare: ["common-10"]
estMinutes: 25
keywords: [struct, pointer, arrow, malloc]
---

## 学习目标

本课学习结构体与指针。重点包括结构体指针、-> 运算符、动态创建结构体。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、给一个对象写一块名称

名称的写法是在类定义名字后面加一颗星，再给名称起个名：

```c
#include <stdio.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    struct Cat a = {"张三", 3};
    struct Cat *p = &a;

    printf("%s 处理了 %d 条\n", p->name, p->fish);
    p->fish = 9;
    printf("改完之后 a.fish = %d\n", a.fish);
    return 0;
}
```

```text
张三 处理了 3 条
改完之后 a.fish = 9
```

一行一行读：

- **`struct Cat *p`** —— 一颗星，意思是「我们要的是一块名称，不是一个对象」。整句话念作：「`p` 是一块**指着一个对象**的名称」。星号跟 `struct Cat` 绑在一起，说的是牌的**类型**：这个名称只认对象。
- **`&a`** —— 问地址的动作。上一课 `a` 是那个实例本身，`&a` 是「`a` 住在哪」这个信息。整句就是：创建一个对象 `a`，再写一块名称指着它。
- **`p->name`** —— 顺着名称找到那个对象，再进它的 `name` 那一格。
- **`p->fish = 9;`** —— 顺着名称进去**改**。改完立刻回头看看原对象：`a.fish` 印出来是 `9`。

这就是名称最要紧的脾气：**顺着名称改，改的是原来那个对象**。跟上一课 `b = a;` 那种「抄一份副本」完全不是一回事。

## 二、小箭头 `->`：点号的省字写法

同一格东西，下面两种写法**一模一样**：

```c
#include <stdio.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    struct Cat a = {"张三", 3};
    struct Cat *p = &a;

    printf("%d\n", (*p).fish);
    printf("%d\n", p->fish);
    (*p).fish = 8;
    printf("%d\n", a.fish);
    return 0;
}
```

```text
3
3
8
```

`(*p).fish` 读作「先把名称指向的那个对象拿出来，再进它的 `fish` 格」；`p->fish` 是它的省字版：**一根小箭头 `->`**，意思是「顺着名称过去，进那一格」。两个都印 `3`，最后那行印 `8`，说明改的还是同一个对象 `a`。

### 那对括号为什么不能省

初学者最容易把 `(*p).fish` 写成 `*p.fish`（括号一丢，字少一半，看着还挺顺眼）。编译器会当场拦下来，我们把它的原话抄在这儿：

```c
#include <stdio.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    struct Cat a = {"张三", 3};
    struct Cat *p = &a;

    printf("%d\n", *p.fish);
    return 0;
}
```

```text
main.c:12:22: error: 'p' is a pointer; did you mean to use '->'?
   12 |     printf("%d\n", *p.fish);
```

编译器的原话很有意思：**「`p` 是一块名称呀 —— 你是不是想用 `->`？」** 它不光拦下来，还在底下画了个小箭头指着 `->`，等于把答案写在卷子上了。

它为什么会这么想？因为 C 的排队规矩里，**点号 `.` 排在星星 `*` 前面**。你写的 `*p.fish` 会被它读成「先`p.fish`，再给结果加颗星」—— 可 `p` 是块名称，名称哪来的 `fish` 格？于是它猜：你其实是想顺着名称进那一格吧。

记住这条就够了：**名称上进门，用 `->`；实例上进门，用 `.`**。写 `(*p).fish` 也对，两个是一个意思，只是多打三个字符。

## 三、把对象交对函数，改的是本人

现在回到钩子里那个烦恼。函数收一块名称，就能改到外面那个对象：

```c
#include <stdio.h>

struct Cat {
    char name[20];
    int fish;
};

void feed(struct Cat *c, int n) {
    c->fish = c->fish + n;
}

int main(void) {
    struct Cat a = {"张三", 3};

    feed(&a, 5);
    printf("%s 处理了 %d 条\n", a.name, a.fish);
    return 0;
}
```

```text
张三 处理了 8 条
```

`feed` 的头上写着 `struct Cat *c` —— 收的是**名称**，不是对象。所以 `main` 里要递 `&a` 进去。函数里 `c->fish` 一改，外面那个 `a` 的食量就从 `3` 变成了 `8`。

对照一下上一课：函数要是收一整个对象，你在函数里怎么改，外面那个都不动 —— 因为函数拿到的是**副本**。**递名称 = 改本人，递整只 = 改副本**，这一对差别往后天天要用，收下。

那么这块名称递进去以后，到底改到了谁身上？我们拆成一步一步走给你看：

```demo
title: 递名称进去，为什么改到的是外面那个
code:
| void feed(struct Cat *c, int n) {
|     c->fish = c->fish + n;
| }
| struct Cat a = {"张三", 3};
| feed(&a, 5);
| printf("%s 处理了 %d 条\n", a.name, a.fish);

step 函数先立规矩：只收名称，不收整个对象
at: 1
say: 头一行只是**定下** `feed` 这招的规矩：`struct Cat *c` 说明它收的是一块**名称**。这一行此刻并不执行 —— 函数写在那儿，等着被调用。
meow: 函数接收结构体指针。
pose: expect
名称 c 指着 = 还没轮到
那个的第 1 格 name = 还没创建后
那个的第 2 格 fish = 还没创建后

step 在外面创建一个实例
at: 4
say: `struct Cat a = {"张三", 3};` 在外面创建一个实例，两格都填好了。注意它跟函数**还没发生关系** —— 函数此刻根本不知道有这个对象。
meow: 创建结构体变量 a。
pose: expect
名称 c 指着 = 还没轮到
那个的第 1 格 name = 张三
那个的第 2 格 fish = 3

step 调用函数：递过去的是一个名称，不是整个对象
at: 5
say: `feed(&a, 5)` —— `&a` 问来的是**地址**，所以递进去的是一块名称，**不是复印一整个对象**。递名称比递整只便宜得多；便宜还不是全部好处，往下看。
meow: &a 传递地址，不复制结构体。
pose: busy
名称 c 指着 = 外面那个 a
那个的第 1 格 name = 张三
那个的第 2 格 fish = 3

step 进了函数：c 拿到的就是那块名称
at: 1
say: 现在人在函数里面。`c` 收到的就是刚才那块名称，指着**外面那一个** `a`（不是复印件）；`n` 的小元素里保存 5。
meow: c 指向外面的 a，n 是 5。
pose: think
名称 c 指着 = 外面那个 a
那个的第 1 格 name = 张三
那个的第 2 格 fish = 3

step 先顺着名称看一眼：右边取到旧值 3
at: 2
say: `c->fish` 读作「先**顺着名称**走到那个对象，再进它的**第 2 格**」—— 它就是 `(*c).fish` 的省字写法。右边先取旧值 **3**，加上 `n` 的 5 得 8；**这一刻外面那格还是 3**。
meow: c->fish 读取 3，加 5 得 8。
pose: think
名称 c 指着 = 外面那个 a
那个的第 1 格 name = 张三
那个的第 2 格 fish = 3

step 写回去：改的就是外面那一格
at: 2
say: 右边算完了才写回去。因为顺着名称走到的是**外面那个** `a`，所以这 8 落在外面那个的第 2 格上 —— 不是落在什么副本上。
meow: 结果写回 a.fish。
pose: yay
名称 c 指着 = 外面那个 a
那个的第 1 格 name = 张三
那个的第 2 格 fish = 8

step 印的是 a，出来的却是 8
at: 6
say: 这一行印的是 `a.name` 和 `a.fish` —— 外面那个实例。出来「张三 处理了 8 条」，只有一个解释：函数改的就是它本人。
meow: 输出 a，fish 已经是 8。
pose: proud
名称 c 指着 = 外面那个 a
那个的第 1 格 name = 张三
那个的第 2 格 fish = 8
```

**把这几拍记牢**：`&a` 递过去的是一块**名称**（地址），`c` 拿到的是外面那位的地址，不是复印件；`c->fish` 先顺名称走到那个对象、再进第 2 格，所以写回去的 8 落在外面那个身上。要是函数头上写的是 `struct Cat c`（一整只），递进去的就是一整个对象的**副本** —— 里面怎么改，外面这个 `a` 都一点不动，那正是上一课 `b = a;` 那个「抄一份」的样子。

## 四、类定义也能现要现租

一个对象也是一样东西，所以上一课那套「动态内存」照样适用。尺子量一下一个类定义（`sizeof(struct Cat)`），乘上一个，就租到一块刚好放得下对象的地方：

```c
#include <stdio.h>
#include <stdlib.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    struct Cat *p = (struct Cat *)malloc(sizeof(struct Cat));

    if (p == NULL) {
        printf("变量没租到\n");
        return 1;
    }
    p->fish = 7;
    printf("%d\n", p->fish);
    free(p);
    p = NULL;
    return 0;
}
```

```text
7
```

三处值得盯一眼：

- **`malloc(sizeof(struct Cat))`** —— 先量一个类定义多大，再伸手租这么多格。租不租得到，看它返回的是不是 `NULL`。
- **`(struct Cat *)`** —— 租变量的函数返回的名称**不认类型**（它只说「这儿有一块地方」）。前面这一小段就是在名称上补写一行字：「这块地方要按一个对象来读」。补好了以后，`p->fish` 这种写法才认得。
- **`free(p)` 之后还要 `p = NULL;`** —— 上一课学的规矩，原样照做，别把擦不干净的名称留着。

要租一排对象也简单：**先量一个、再乘只数**，跟上一课一模一样。

```c
#include <stdio.h>
#include <stdlib.h>

struct Cat {
    char name[20];
    int fish;
};

int main(void) {
    struct Cat *cats = (struct Cat *)malloc(sizeof(struct Cat) * 2);

    if (cats == NULL) {
        printf("变量没租到\n");
        return 1;
    }
    cats[0].fish = 4;
    cats[1].fish = 6;
    printf("%d\n", cats[0].fish + cats[1].fish);
    free(cats);
    cats = NULL;
    return 0;
}
```

```text
10
```

注意这里用的是**点号**：`cats[0]` 已经先把第一个对象拿出来了，拿出来的是一个实例，进门当然用点号。**箭头配名称，点号配实例** —— 上面那句话又应验了一次。

## 五、一排对象 + 一块名称

最后把这节课的两样东西拼起来：一排实例摆好，再拿一块名称从头走到尾。

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
    struct Cat *p = cats;
    int total = 0;

    for (int i = 0; i < 3; i++) {
        printf("%s 处理了 %d 条\n", p->name, p->fish);
        total = total + p->fish;
        p++;
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

三句关键的话：

- **`struct Cat *p = cats;`** —— 一排对象的名字交出来的时候，交的就是**第一个对象的地址**。所以这段话没说错，名称一创建后就指着第一个。
- **`p->name`** —— 顺着名称进第一个对象，念它的名字。
- **`p++`** —— 名称往后挪。挪多远？上一课讲过：**名称上写着它指的是哪种东西，就跨一整只那么多**。这里指着一个对象，所以 `p++` 跨的是一整个对象，正好落到第二只头上。三趟走完，三个对象一个不漏。

::: warn 注意
名称**必须先指着实例**，才能往它指的地方读写。要是你写了 `struct Cat *p;` 就紧接着来一句 `p->fish = 3;` —— 这块名称上什么地址都没有，顺着它写进去，就是往不知道哪块地方乱写。

我们真跑过这一段。编译器其实**嘀咕了一句**（原话）：`warning: 'p' is used uninitialized [-Wuninitialized]` —— 它看得出这块名称还没指地方。

但它只是**警告**，不是拦路虎：编译照样过，跑起来一个字都不印，直接断气（屏幕上一片空白，退出码是异常的那个）。这种「安安静静就没了」的毛病最难查，**而编译器只负责出声、不负责拦住你** —— 往后看到 `warning:` 开头那几行，别当背景音划过去。我们的规矩是：**名称当场声明、当场指着某个对象**。

顺带一句：`->` 和 `.` 千万别用混。看到名称的名字，就用箭头；看到实例的名字，就用点号。用错了，编译器一般都会拦你（像第二节那样），但别指望它每次都站在你这边。
:::

::: tip 提示
今天收四句话：

1. **`struct Cat *p = &a;`** 是给一个对象写名称：星号说明「这是名称」，`&a` 把地址问过来。
2. **`p->fish` 就是 `(*p).fish`** 的省字写法：**名称用箭头，实例用点号**。写成 `*p.fish` 会被拦下来，编译器还会顺手提示你用 `->`。
3. **递名称 = 改本人；递整个对象 = 改副本。** 函数想动到外面的对象，头上就写 `struct Cat *c`，调用时递 `&a`。
4. **类定义也能现要现租**：`malloc(sizeof(struct Cat))`，租一排就先量一个再乘只数；前面补一句 `(struct Cat *)`，用完 `free` 再把名称擦成 `NULL`。
:::

## 小任务

1. 把第一节那段里的 `p->fish = 9;` 改成 `p->fish = p->fish + 1;`，跑一跑，看看 `a.fish` 印出来是几。
2. 把第二节里的 `p->fish` 换成 `(*p).fish`，再把 `(*p).fish = 8;` 换成 `p->fish = 8;` —— 两种写法互相换一换，输出应该一个字都不变。
3. 用第四节那句 `malloc` 现租一个对象，租到以后先看它是不是 `NULL`，然后给它填上 `p->fish`，跑完记得 `free` 再把名称擦干净。
4. 想一想（**先猜再跑**）：第五节那段跑完以后，`p` 指着哪儿？要是紧接着再来一句 `p->name`，我们能读到什么？

下一课我们要给类定义加两个新花样：一种「几样东西共用同一名称」的类定义，和一种「一串起好名字的编号」 
