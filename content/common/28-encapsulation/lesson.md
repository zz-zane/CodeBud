---
id: common-28
lang: common
stage: 0
order: 25
title: 封装与访问控制
tags: [面向对象, 封装]
required: ["common-27"]
crossRefs: ["java-stage2-01", "cpp-stage2-04"]
estMinutes: 17
keywords: [encapsulation, private, public]
---

## 学习目标

本课学习封装与访问控制。重点包括盖子：从自觉到硬规矩、同一笔坏账同一次「不收」、同一个伸手四个下场、-999 递不进来、口子露行为不搬数据。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```c
#include <stdio.h>

typedef struct {
    int fish;
} FishBank;

int main(void) {
    FishBank bank = {0};
    bank.fish = -999;
    printf("账上 %d 条\n", bank.fish);
    return 0;
}
```

```text
账上 -999 条
```

## 盖子不是嘴上说说：从「自觉」到硬规矩

术语表里早就有这么一样东西：**封装** —— 数据装进带盖的盒子，盖子开给谁，主人说了算。前面的课里它也露过脸。

今天我们要把这一手**落到实处**：让「谁碰得」从一句口头约定，变成类定义上写死的一条规矩。类定义语言里，这条规矩用两个词写成：

- **`private`** —— 「**只有类定义自己的函数碰得着**」。写在格子前面，就是给这一格扣上盖子：外面的变量伸不进来。
- **`public`** —— 「**留给外面的口子**」。写在函数前面，就是在盒子上开一扇门：外面想办事，只从门上走。

一句话记牢：**盖子扣在数据上，口子开在行为上** —— 这正是前几课一路立下来的那句判据句：**藏数据、露行为**。

对照开篇那笔账：C 里的「盖子」是一张纸条，那是**口头约定**，谁都可以不认；类定义里的盖子，是**编译的时候就会被编译器或解释器拦下的硬规矩**。差多远，下一节摆给你看。

## 四位编译器或解释器摆一桌：同一笔坏账，同一次「不收」

同一个任务，四位编译器或解释器各写一遍：**开一家数据银行，递一笔 -999（该不收），再存 3 条（该收下），最后报一报账**。

```compare
c::
#include <stdio.h>

typedef struct {
    int fish;
} FishBank;              /* C 的盒子没有盖子：这一格敞着 */

void save(FishBank *b, int n) {   /* 函数站在盒子外面，名称靠自觉 */
    if (n < 0) {
        return;
    }
    b->fish = b->fish + n;
}

int main(void) {
    FishBank bank = {0};
    save(&bank, -999);
    save(&bank, 3);
    printf("账上 %d 条\n", bank.fish);
    return 0;
}

cpp::
#include <iostream>
using namespace std;

class FishBank {
private:
    int fish = 0;             // 盖子扣上：只有类定义自己的函数碰得着

public:
    void save(int n) {        // 口子：存一笔 —— 负数不收
        if (n < 0) {
            return;
        }
        fish = fish + n;
    }

    int check() {             // 口子：报账
        return fish;
    }
};

int main() {
    FishBank bank;
    bank.save(-999);
    bank.save(3);
    cout << "账上 " << bank.check() << " 条" << endl;
    return 0;
}

java::
class FishBank {
    private int fish = 0;         // 盖子扣上

    public void save(int n) {     // 口子：存一笔 —— 负数不收
        if (n < 0) {
            return;
        }
        fish = fish + n;
    }

    public int check() {          // 口子：报账
        return fish;
    }
}

public class Main {
    public static void main(String[] args) {
        FishBank bank = new FishBank();
        bank.save(-999);
        bank.save(3);
        System.out.println("账上 " + bank.check() + " 条");
    }
}

python::
class FishBank:
    def __init__(self):
        self._fish = 0            # 一笔下划线：盖子，靠家规守着

    def save(self, n):            # 口子：存一笔 —— 负数不收
        if n < 0:
            return
        self._fish += n

    def check(self):              # 口子：报账
        return self._fish

bank = FishBank()
bank.save(-999)
bank.save(3)
print(f"账上 {bank.check()} 条")
```

```text
账上 3 条
```

看出来了吗：**同一笔 -999，四段代码都没让它进门**，账上都是 3 条。可「拦」这件事，四门语言给它安的砖不一样：

- **C**：盒子敞着，收鱼的函数站在**外面** —— 那块「负数不收」的名称只是一份自觉。谁绕过它直接伸变量写 `bank.fish = -999;`，照样编得过、跑得动（开篇那笔账就是这么坏的）。
- **C++ 和 Java**：格子前面写 `private`、口子前面写 `public` —— 这一次盖子是真的，下一节我们就让你看变量撞上去。
- **Python**：`self._fish` 前面那一笔下划线就是盖子 —— 不过它是**家规**，不是锁：别的对象一律不掀；你要硬掀，谁也拦不住。

## 同一个伸手，四个下场

四段并排看完，来试最要紧的一件事：**不绕口子，直接伸变量去够那一格**。同样一句 `bank.fish = -999;`，四个语言的下场：

**C 的下场**，开篇已经看过了：编得过、跑得动，账当场坏 —— C 里连一块能拦人的砖都没有。

**Java 的下场**，我们把那一版端上来，变量就伸给你看：

```java
class FishBank {
    private int fish = 0;

    public void save(int n) {
        if (n < 0) {
            return;
        }
        fish = fish + n;
    }

    public int check() {
        return fish;
    }
}

public class Main {
    public static void main(String[] args) {
        FishBank bank = new FishBank();
        bank.fish = -999;
        System.out.println("账上 " + bank.check() + " 条");
    }
}
```

编译器或解释器当场把那一行拦下：

```text
Main.java:19: error: fish has private access in FishBank
1 error
```

原话念起来是：**「`fish` 是 `FishBank` 自己的私房格子，你现在站的这个地方碰不着它。」** 看清楚这跟 C 差多远：C 是**悄悄改掉了**，Java 是**编都编不过** —— 这颗钉子钉在**编译的时候**，程序一趟都别想跑起来。C++ 那堵墙长得一个样，下一节我们把它拆成一步一步，让你亲眼看着它拦人。

**Python 的下场**，我们也伸一次手：

```python
class FishBank:
    def __init__(self):
        self._fish = 0

    def save(self, n):
        if n < 0:
            return
        self._fish += n

    def check(self):
        return self._fish

bank = FishBank()
bank._fish = -999      # 跑得动 —— 可这一伸手，违背了家规
print(f"账上 {bank.check()} 条")
```

```text
账上 -999 条
```

看：**跑得动，账照样坏** —— 拦住它的只剩那条「别人的格子不掀」的家规，而家规靠自觉。所以我们要把这句话刻进你脑子里：

- **有编译这一关的语言（C++、Java）里，「藏」是一堵硬墙** —— 编译的时候就拦下你；
- **没有这一关的语言（Python）里，「藏」是一条家规** —— 靠的不是墙，是守规矩。谁把「没有真锁」当成「无所谓」，谁的账迟早坏成 -999。

## 走一遍：一笔 -999 递不进来

Java 撞墙那一下你已经看见了。C++ 我们拆成一步一步走给你看 —— 从扣盖子开始，到那笔 -999 被挡在门外：

```demo
title: 一笔 -999 从数据银行门口被挡回去的全过程
code:
| #include <iostream>
| using namespace std;
|
| class FishBank {
| private:
|     int fish = 0;
|
| public:
|     void save(int n) {
|         if (n < 0) {
|             return;
|         }
|         fish = fish + n;
|     }
|
|     int check() {
|         return fish;
|     }
| };
|
| int main() {
|     FishBank bank;
|     bank.save(-999);
|     bank.save(3);
|     cout << "账上 " << bank.check() << " 条" << endl;
|     return 0;
| }

step 扣盖子：格子归类定义自己管
at: 5
say: `private:` 一落笔，底下的格子（第 6 行 `int fish = 0;`）就归**类定义自己**管了 —— 外面的变量伸不进来。「这一格从哪一刻起有数」也顺手交代了：真银行创建后的时候就把 0 装好。
meow: fish 设为 private，只有类内部能访问。
pose: expect
类定义 FishBank = 盖子扣上了
账上的数 = 还没有银行
递给口子的料 = （还没递）
编译器或解释器 = （没出场）
标准输出 = （还没印）

step 开两道口子，门口立块名称
at: 9
say: `void save(int n)` 是留给外面的第一道口子：想存一笔，只能从这儿递进来。口子里第一句就是我们立的名称（第 10~12 行）：`n < 0` 的一律不收 —— 规矩写在类定义里，不指望别人自觉。
meow: save 是公开接口，入口处有校验。
pose: expect
类定义 FishBank = 盖子扣上、两道口子开好
账上的数 = 还没有银行
递给口子的料 = （还没递）
编译器或解释器 = （没出场）
标准输出 = （还没印）

step 根据类创建实例真银行
at: 22
say: `FishBank bank;` —— 真银行创建后了。初始化那一手上一课刚学过：它自己带着那一格，账上是 0。
meow: 对象创建好，余额是 0。
pose: busy
类定义 FishBank = 盖子扣上、两道口子开好
账上的数 = 0
递给口子的料 = （还没递）
编译器或解释器 = （没出场）
标准输出 = （还没印）

step 不服气：伸变量直接够格子
at: 6
say: 我们故意伸一次手，写下 `bank.fish = -999;`，看它拦不拦。编译器或解释器当场拦下，原话：`error: 'int FishBank::fish' is private within this context` —— 「这是类定义自己的私房格子，你现在站的这个地方碰不着它」，底下还跟着一句 `note: declared private here`，指给你看盖子扣在哪一行。**程序一趟都没跑起来** —— 这颗钉子钉在编译的时候。
meow: 直接访问 private 成员，编译器报错。
pose: think
类定义 FishBank = 盖子扣上、两道口子开好
账上的数 = 0
递给口子的料 = （伸手被拦）
编译器或解释器 = 拦下了直接伸手
标准输出 = （还没印）

step 改走口子，把 -999 递进去
at: 23
say: 伸不进就规矩点，走口子：`bank.save(-999);` —— 门外的人只能把料**递过来**，收不收，由类定义里那一个方法说了算。
meow: 改为调用 save，传入 -999。
pose: expect
类定义 FishBank = 盖子扣上、两道口子开好
账上的数 = 0
递给口子的料 = -999（正递着）
编译器或解释器 = 拦下了直接伸手
标准输出 = （还没印）

step 名称一算：小于 0，不收
at: 11
say: 口子里那块名称当场一算：-999 小于 0 吗 —— 答「是」。`return;` 的意思就是「这一手到此为止」，底下装数那句（第 13 行）根本没轮到，账上一动没动。
meow: -999 没通过校验，被拒绝。
pose: think
类定义 FishBank = 盖子扣上、两道口子开好
账上的数 = 0（没动）
递给口子的料 = -999（被挡回）
编译器或解释器 = （没出场）
标准输出 = （还没印）

step 同一道口子，这回递 3 条
at: 24
say: `bank.save(3);` 又递一笔。名称放行，装数那句真的跑到了 —— 账从 0 变成 3。同一道口子，一笔进不来、一笔进来，差别全在门口那块名称上。
meow: 3 通过校验，余额变成 3。
pose: yay
类定义 FishBank = 盖子扣上、两道口子开好
账上的数 = 3
递给口子的料 = 3（收下了）
编译器或解释器 = （没出场）
标准输出 = （还没印）

step 隔着口子报账
at: 25
say: 外面够不着那一格，只能调用 `bank.check()` 让类定义自己报账 —— 屏幕上印出「账上 3 条」。这就是扣盖子最值钱的地方：数怎么变，规矩说了算。
meow: 只能通过 check 读取，余额是 3。
pose: proud
类定义 FishBank = 盖子扣上、两道口子开好
账上的数 = 3
递给口子的料 = 3（收下了）
编译器或解释器 = （没出场）
标准输出 = 账上 3 条
```

## 口子要露行为，不是搬数据

盖子扣上，就万事大吉了吗？我们亲手画一张「假认真」的类定义给你看 —— 它确实写了 `private`，也确实开了一对口子：

```cpp
#include <iostream>
using namespace std;

class FishBank {
private:
    int fish = 0;

public:
    int getFish() {        // 口子：把格子里的数搬出来
        return fish;
    }

    void setFish(int n) {  // 口子：把外面递的数搬进去
        fish = n;
    }
};

int main() {
    FishBank bank;
    bank.setFish(-999);
    cout << "账上 " << bank.getFish() << " 条" << endl;
    return 0;
}
```

```text
账上 -999 条
```

看出来了吗：它**照旧收下了 -999**。这一对光板口子，一个把数据原样搬出去、一个把数据原样搬进来 —— 跟 C 里直接伸变量写 `bank.fish = -999;` 的下场，一模一样。

所以我们给你一把尺子，往后每开一道口子，都先量一量 —— 一句自查的话：

> **「这个方法暴露的是行为，还是只是把数据搬出来？」**

- **「存一笔」是行为**：它收下你要存的东西，**替你把关** —— 负数不收、来路不明的不收。门口有名称，才叫露行为。
- **「把数搬进来」是搬运**：它不过手、不设卡，只是给 C 那一步「直接伸手掏格子」换了扇门。**等于没藏。**

把这条记牢，你就比不少学过几年的人还清醒：`private` 只是盖子；盖子底下留的那几道口子长什么样，才是这门手艺的正经功夫。

::: tip 提示
今天这一课，三句话：

1. **盖子扣在数据上**：`private` 一写，格子归类定义自己管，外面的变量伸不进来。
2. **口子开在行为上**：`public` 留给外面的，应该是**办了事的一个方法**（存一笔、报个账），不是把数据原样搬进搬出。
3. **判据句随身带**：藏数据、露行为。每开一道口子，先拿自查句量一量 —— 「这个方法暴露的是行为，还是只是把数据搬出来？」
:::

::: warn 注意
三个坑，标给你：

- **光板 getter/setter 不算真盖子。** 写了 `private`、又配一对「搬数据」的光板口子，坏账照样大摇大摆进来 —— 只是给 C 那一步直接伸手掏格子换了扇门。
- **Python 没有编译这一关，不等于「无所谓」。** `_fish` 前面那一笔是全体对象守的家规；没有一道硬墙替你拦人，守不守全看写下这一行的人。
- **「被拦下」和「跑坏了」不在同一个时刻。** C++/Java 是**编译的时候**就被拦（程序一趟没跑）；Python 是**跑到那一行**才出的事。往后见到报错先问自己一句：是没编过，还是跑起来才坏的。
:::

## 一句话对照表

| 谁写的 | 盖子长什么样 | 直接伸变量够格子，什么下场 |
|---|---|---|
| C | 一张纸条：「请勿乱改」 | 编得过、跑得动 —— 账悄悄坏掉 |
| C++ | `private:` 一块标签管着 | 编译的时候就被拦下：编译不过 |
| Java | `private` 写在那一格前面 | 同上 —— 编译不过 |
| Python | 名字前面一笔 `_`（家规） | 跑得动 —— 账坏不坏，全看守不守规矩 |

## 小任务

1. **伸手试试**：把本课 compare 里 C++ 那一版抄进练习场，先把 `bank.save(-999);` 删掉、换成 `bank.fish = -999;` 跑一次，把编译器或解释器拦你的原话抄回来（提示：跟你本课见过的那句长得像，行号不一样）。抄完再换回走口子的写法。
2. **给口子立名称**：照着「光板」那一版改 —— 给 `setFish` 加上我们那块名称（负数不收）。动手之前先想一想：光改 `setFish` 够不够？`getFish` 要不要动？
3. **想一想**：如果我们想把银行做成「只许看、不许改」—— 把 `setFish` 整道口子撤掉、只留 `getFish`，外面会难过成什么样？

下一课，我们拆一块天天见、却一直没人敢问的砖：**为什么每个程序一上来都是 `public static void main`？`static` 到底是块什么砖？** 这个问题我们先留在这儿，下一课《main 只是一扇门》见分晓 
