---
id: java-stage1-10
lang: java
stage: 1
order: 13
title: 方法重载与作用域
tags: [函数, 作用域]
required: [java-stage1-09]
crossRefs: []
estMinutes: 25
keywords: [overload, scope, block]
---

## 学习目标

本课学习方法重载与作用域。重点包括重载规则、局部变量作用域、块。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、同一个招名，几种喂法

先看我们把「打招呼」写成两招，名字都叫 `greet`：

```java
public class Main {
    public static void greet() {
        System.out.println("你好");
    }

    public static void greet(String name) {
        System.out.println("你好，" + name + "");
    }

    public static void main(String[] args) {
        greet();
        greet("张三");
    }
}
```

```text
你好
你好，张三
```

类定义上现在住着**两招同名**的 `greet`，编译器一点也不生气。凭什么？因为这两招的**输入接口不一样**：

| 方法 | 输入接口 | 怎么调用 |
|---|---|---|
| 第一个方法 | `()` —— 什么也不喂 | `greet();` |
| 第二招 | `(String name)` —— 喂一串字符串 | `greet("张三");` |

调用 `greet()` 的时候，我们后面那对小括号里**空着**，电脑就挑了不带输入接口的那一个方法；调用 `greet("张三")` 时我们喂了一串字符串，它就挑了收字符串的那一个方法。**你喂什么料，它挑什么招** —— 这一步是电脑替你干的，我们一个字都不用管。

这两声调用里「挑」的那一下，平时根本看不见。我们把它拆成一步一步，走给你看：

```demo
title: 两声 greet，电脑怎么知道该走哪一个方法
code:
| public static void greet() {
|     System.out.println("你好");
| }
| public static void greet(String name) {
|     System.out.println("你好，" + name + "");
| }
| public static void main(String[] args) {
|     greet();
|     greet("张三");
| }

step 第一次：括号里空着
at: 8
say: 程序从 `main` 里那一行开跑。`greet();` 后面那对小括号里**空着** —— 一样料都没喂。电脑挑招，只看这里。
meow: 调用 greet()，没有参数。
pose: expect
引用的是哪一次 = greet()，括号里空着
电脑挑中哪一个方法 = 还在挑
标准输出 = 还没印

step 拿括号里的东西去对输入接口：空对空
at: 1
say: 类定义上住着**两支都叫 `greet`** 的招（第 1 行和第 4 行）。电脑拿「括号里有几样料」去对两支护的输入接口：一样都没有 → 挑中输入接口也是空的第 1 支。**它只看打头那一行，不看方法里干了什么。**
meow: 按参数列表选择无参版本。
pose: think
引用的是哪一次 = greet()，括号里空着
电脑挑中哪一个方法 = 第 1 支（输入接口空着）
标准输出 = 还没印

step 挑定了才跳进去跑：印出「你好」
at: 2
say: 挑完才轮到跑：电脑跳进第 1 支的花括号里，印出「你好」。**挑招永远排在跑身子前面** —— 先定去哪一支，再动身。
meow: 输出「你好」。
pose: yay
引用的是哪一次 = greet()，括号里空着
电脑挑中哪一个方法 = 第 1 支（输入接口空着）
标准输出 = 你好

step 落回 main，接着调用第二声
at: 8
say: 跑完落回**刚才那一行**，下一句就是第 9 行 `greet("张三");`。这一回括号里**递进去了一样料，还是一串字符串**。
meow: 调用 greet("张三")。
pose: busy
当前调用 = greet("张三")，实参类型为String
电脑挑中哪一个方法 = 还在挑
标准输出 = 你好

step 个数对上了，类型也对上了：挑中第 2 支
at: 4
say: 第 1 支的输入接口是空的，收不下这串字符串；第 2 支的输入接口写着 `String` —— 个数对上了、类型也对上了，电脑挑中它（第 4 行）。**名字一样，靠括号里递的东西分家。**
meow: 匹配 String 参数的版本。
pose: think
当前调用 = greet("张三")，实参类型为String
匹配的重载方法 = 第2个（参数类型为String）
标准输出 = 你好

step 跳进去跑：方法里现摆一个元素接住「张三」
at: 5
say: 方法里现摆一个叫 `name` 的元素，「张三」就装在里面 —— 这个元素是**方法自己的**，只活在 `greet` 那对大括号里，调用结束就撤走。接着印出「你好，张三」。
meow: name 是方法内的局部变量。
pose: yay
当前调用 = greet("张三")，实参类型为String
匹配的重载方法 = 第2个（参数类型为String）
标准输出 = 你好、你好，张三

step 收工：两声调用结束，各走各的
at: 10
say: 落回 `main`，大括号合上，程序收工。两次引用的**名字一模一样**，走的却是两支不同的招 —— 分岔全在括号里递的东西：先数**个数**，再看**类型**。
meow: 两次调用走了不同的重载。
pose: proud
引用的是哪一次 = 两声都调用结束了
电脑挑中哪一个方法 = 各自挑了一支
标准输出 = 你好、你好，张三
```

**记住两件事**：电脑挑招，只拿括号里递的东西去对输入接口 —— 先数**个数**，再看**类型**，两把尺子都对上才是它；它**不看方法里写了什么**，也不看你打算把结果装进哪只元素。另一件：方法里现摆的元素（比如那个 `name`）是方法自己的，**元素跟着那对大括号走** —— 调用结束就撤，外面根本没有这个名字。

## 二、电脑怎么挑：看个数，也看类型

挑招的两把尺子是**个数**和**类型**。先看个数：

```java
public class Main {
    public static int add(int a, int b) {
        return a + b;
    }

    public static int add(int a, int b, int c) {
        return a + b + c;
    }

    public static void main(String[] args) {
        System.out.println(add(1, 2));
        System.out.println(add(1, 2, 3));
    }
}
```

```text
3
6
```

两招都叫 `add`，一个收两样料、一个收三样。喂两样就走两样的那招，喂三样就走三样的那招 —— **个数一数就分得清**。

再看类型。同一件事，喂整数和喂小数，我们想走两条路：

```java
public class Main {
    public static void add(int a, int b) {
        System.out.println("整数版：" + (a + b));
    }

    public static void add(double a, double b) {
        System.out.println("小数版：" + (a + b));
    }

    public static void main(String[] args) {
        add(1, 2);
        add(1.5, 2.5);
    }
}
```

```text
整数版：3
小数版：4.0
```

`add(1, 2)` 传入的两样是**整数**，走 `int` 那招；`add(1.5, 2.5)` 传入带小数点，走 `double` 那招。**两把尺子合起来用**：先数个数，对上了再看类型，都对得上才是它要的那一个方法。

### 只有两样东西算数

我们把判据写成一句话：**招名 + 输入接口（几样料、每样什么料）**。这两样合起来叫这一个方法的「签名」。签名不一样，就能重名；签名一样，就是写重了。

那**返回值**算不算判据？我们试了试，写两招同名的：一个方法返回整数、一个方法返回字符串 —— 编译器当场犯难：

```java
public class Main {
    public static int get() {
        return 1;
    }

    public static String get() {
        return "字";
    }

    public static void main(String[] args) {
        System.out.println(get());
    }
}
```

```text
Main.java:6: error: method get() is already defined in class Main
    public static String get() {
                         ^
1 error
```

原话是 `method get() is already defined in class Main` —— **「`get()` 这一个方法在 `Main` 里已经写过了。」** 两招的输入接口都是空的，签名一模一样，只有返回的料不同 —— 这**不算**两种喂法。为什么？因为调用 `get()` 的时候，我们手上没喂任何料，电脑**没法从你喂的东西里**看出你要哪一份结果：它只能看喂料挑招，看不到你打算把结果装进哪只元素。

## 三、写重了会怎样

上一节那一句 `already defined` 就是「写重了」的报错。我们再撞一次最典型的：两招名字一样、输入接口也一样，只是**料的名字**不一样（一个叫 `name`、一个叫 `who`）：

```java
public class Main {
    public static void greet(String name) {
        System.out.println("你好，" + name + "");
    }

    public static void greet(String who) {
        System.out.println("嗨，" + who);
    }

    public static void main(String[] args) {
        greet("张三");
    }
}
```

```text
Main.java:6: error: method greet(String) is already defined in class Main
    public static void greet(String who) {
                       ^
1 error
```

看清楚：`String name` 和 `String who` 在编译器眼里**是同一个签名** —— 它只认「一样什么类型的料」，**料在招里叫什么名字，它不管**。这种错**编译当场就拦下**，不用等跑起来。

::: warn 注意
重载的判据只有两样，背下来就够：**招名一样、输入接口不一样**。常见三种写重了的姿势：

- 输入接口的**类型和个数都一样**，只有料的名字不同 —— 签名一样，写重了。
- 输入接口的类型和个数都一样，**只有返回值不同** —— 还是签名一样，写重了。
- 想用「方法里干的活不一样」来区分 —— 编译器不看身子，只看打头那一行。

报错原话都是同一句：`method xxx is already defined in class xxx`。看到 `already defined` 就是这里撞了，回去数一数两个输入接口。
:::

## 四、地盘（作用域）：谁的名称活在谁那儿

上半场说完了「重名」，下半场说**名称活在哪块地方**。

我们先摆两招，各自在身子里摆一个叫 `n` 的元素：

```java
public class Main {
    public static int doubleIt(int n) {
        n = n * 2;
        return n;
    }

    public static int square(int n) {
        n = n * n;
        return n;
    }

    public static void main(String[] args) {
        System.out.println(doubleIt(4));
        System.out.println(square(4));
    }
}
```

```text
8
16
```

两个方法里各有一个叫 `n` 的元素，名字撞得结结实实，编译器一次不吭。**因为方法里摆的元素，就活在方法自己那对大括号里**：

- 每调用一次方法，就在方法里面**现摆一套崭新的元素**，调用结束立刻撤走；
- 两个方法各摆各的，谁也看不见谁的元素；
- 所以同名完全不打架 —— 它们是两个**不同的**元素，只是碰巧起了同一个名字。

反过来说：**方法收工之后，外面就别想再调用到它里面的元素了。**

```java
public class Main {
    public static void make() {
        int n = 7;
    }

    public static void main(String[] args) {
        System.out.println(n);
    }
}
```

```text
Main.java:7: error: cannot find symbol
        System.out.println(n);
                           ^
  symbol:   variable n
  location: class Main
1 error
```

`cannot find symbol` 念起来是「**这个名字我们没登记过**」；下面那两行还替我们说清了缺的是什么：`symbol: variable n` —— 缺一块叫 `n` 的名称。

`n` 只在 `make` 该变量子里挂了号。站在 `main` 里称呼它，等于**跑到别人家门口调用自家对象的名字**，谁也听不懂。这套「谁看得见谁」的规矩，正式的说法叫**地盘**（作用域）。

这一条其实我们前面就撞过一回：「for 与 while」那一课绕圈那段，我们在 `for` 的小括号里摆了一块 `i`，出了圈再调用 `i`，编译器就说认不出它。现在有名字了 —— **那不是它记性差，是 `i` 的地盘只有那个圈**。

## 五、花括号就是一张地盘的边界

上一节说的是「方法」这层地盘。其实**每一对大括号都是一张地盘**：`if` 的花括号、`for` 的花括号、你随手写的一对空花括号，各是一块小地方。

里层能看见外层，外层看不见里层：

```java
public class Main {
    public static void main(String[] args) {
        int fish = 5;
        if (fish > 0) {
            int bonus = 2;
            System.out.println(fish + bonus);
        }
        System.out.println(fish);
    }
}
```

```text
7
5
```

- 花括号**里面**那句用到了 `fish` 和 `bonus` 两个元素 —— `fish` 摆在外面（里层看得见外层），`bonus` 摆在里面。里层两个都够得着，印出 `7`。
- 花括号**外面**那句只调用 `fish`，印出 `5`；它要是敢调用 `bonus`，就是上一节那句 `cannot find symbol`。

这两层里外怎么进出、哪只元素活到哪一步，我们也拆成一步一步，走给你看：

```demo
title: if 的大括号里外：两个元素各活在哪一层
code:
| public static void main(String[] args) {
|     int fish = 5;
|     if (fish > 0) {
|         int bonus = 2;
|         System.out.println(fish + bonus);
|     }
|     System.out.println(fish);
| }

step 外层先摆一个 fish，装进 5
at: 2
say: `main` 这对大括号就是**外层** —— 我们自己的地盘。第 2 行在这儿摆一个叫 `fish` 的元素，装进 5，这个元素归外层管。
meow: fish 在外层作用域。
pose: expect
外面的 fish = 5
里面的 bonus = 还没摆
标准输出 = 还没印

step 碰到 if：先看眼色，再进里层
at: 3
say: 第 3 行这对花括号要开一块**里层**。进门前先看眼色 `fish > 0` —— 这一眼读得到 `fish`，正因为**里层看得见外层**。5 比 0 大，答真，我们进去。
meow: 内层可以读取 fish。
pose: busy
外面的 fish = 5
里面的 bonus = 还没摆
标准输出 = 还没印

step 里层自己摆一个 bonus，装进 2
at: 4
say: 进了里层，第 4 行在这儿摆一个叫 `bonus` 的元素，装进 2。这个元素**只在里层** —— 外层根本没有这个名字。
meow: bonus 只属于 if 块。
pose: busy
外面的 fish = 5
里面的 bonus = 2
标准输出 = 还没印

step 里层这一行：两个元素都够得着，印出 7
at: 5
say: 第 5 行要印 `fish + bonus`。`fish` 为什么够得着？因为**里层看得见外层** —— 够着的是外层**那一个**元素，不是「另一个改了个名的」（Java 里没有这回事）；`bonus` 是里层自己那个。5 加 2，印出 7。
meow: 内层能同时用 fish 和 bonus。
pose: yay
外面的 fish = 5
里面的 bonus = 2
标准输出 = 7

step 里层收工：大括号一合，bonus 就没了
at: 6
say: 第 6 行这对大括号合上，里层这块地盘就**收了** —— `bonus` 跟着这块地盘一起没了。从这一刻起，站在外层调用 `bonus` 也没人认得（就是上一节那句 `cannot find symbol`）。
meow: 离开 if，bonus 不再存在。
pose: think
外面的 fish = 5
里面的 bonus = （跟着里层收了）
标准输出 = 7

step 回到外层：只印得出 fish 那一个
at: 7
say: 回到外层，第 7 行只调用得到 `fish`（外层自己那个），印出 **5**。里层加进去的那点活儿**一点没留在外面** —— 印出来还是 5，不是 7。
meow: 外层输出 fish：5。
pose: busy
外面的 fish = 5
里面的 bonus = （跟着里层收了）
标准输出 = 7、5

step 收工：两层的规矩回头看一遍
at: 8
say: `main` 的大括号也合上，程序收工。这一趟的规矩两条：**里层看得见外层**（够着的是同一个元素），**外层看不见里层**（里层添的元素，出了那对大括号就没人认得）。课文下面还有一条更容易踩的：里层连「再摆一个跟外层同名的元素」都不许。
meow: 外层看不到内层的变量。
pose: proud
外面的 fish = 5
里面的 bonus = （跟着里层收了）
标准输出 = 7、5
```

**记住这两层的分工**：里层看得见外层 —— 够着的是**同一个**元素；外层看不见里层 —— 里层添的元素跟着那对大括号一起收了。所以想让一个元素活得久一点，就把它摆到外面那层去。

圈里的 `i` 也是同一个道理：

```java
public class Main {
    public static void main(String[] args) {
        for (int i = 0; i < 3; i++) {
            System.out.println("第 " + i + " 圈");
        }
        System.out.println(i);
    }
}
```

```text
Main.java:6: error: cannot find symbol
        System.out.println(i);
                           ^
  symbol:   variable i
  location: class Main
1 error
```

`i` 是在 `for` 的那对小括号里摆下的，它的地盘就是这一整个圈（从 `for` 的圆括号一直管到圈身子那对花括号）。圈跑完了，这块地盘也收了，站在 `main` 的地盘上再也调用不到它。

**想让圈数跑完之后还能用，就把它摆到圈外面**：先在 `main` 的地盘上摆一个 `int i = 0;`，圈子的小括号里只写 `i = 0; i < 3; i++`（不写 `int`）—— 这样它从头到尾都活在 `main` 的地盘上。

### 同一个地盘里，不能有两个同名的元素

```java
public class Main {
    public static void main(String[] args) {
        int fish = 5;
        int fish = 7;
        System.out.println(fish);
    }
}
```

```text
Main.java:4: error: variable fish is already defined in method main(String[])
        int fish = 7;
            ^
1 error
```

`already defined` 又见面了 —— 这回说的是名称：**`fish` 在 `main` 这一个方法里已经摆过了**。同一个地盘里摆两个同名的元素，第二只是谁、第一个是谁，我们自己都说不清，编译器索性不许。

还有一条更容易踩的：连**里层块里再摆一个同名的**也不行 —— Java 不许内层把外层的名字盖住。所以写块的时候，里层起名字之前，先抬头看一眼外层有没有重名的。

## 一句话对照表

| 我们写下的 | 它的意思 | 什么时候出问题 |
|---|---|---|
| `greet()` 和 `greet(String name)` | 同名两招，输入接口不一样 —— 重载 | 合法，电脑按喂料挑 |
| 两招输入接口**一模一样** | 签名一样 | **编译当场拦**：`method xxx is already defined` |
| 方法里摆的元素 | 地盘只在方法内部，调用一次现摆一套 | 外面称呼它 → `cannot find symbol` |
| `for (int i = ...)` 里的 `i` | 地盘就是那个圈 | 出了圈再称呼它 → `cannot find symbol` |
| 里层块里的元素 | 里层看得见外层，外层看不见里层 | 外面称呼它 → `cannot find symbol` |
| 同一地盘里两个同名的元素 | 摆重了 | **编译当场拦**：`variable xxx is already defined` |

::: tip 提示
今天记住三句话：

1. **重载的判据只有两样：招名一样、输入接口不一样**（几样料、每样什么料）。料的**名字**、返回的**结果**、身子里的干法都不算数。
2. **花括号就是地盘的边界**：方法一层、块一层。里层看得见外层，外层看不见里层。
3. **每层地盘里，同名的元素只能有一个**；想活得久一点，就把它摆到外面那层去。
:::

## 小任务

1. 把第一节那两招 `greet` 抄进练习场，再给我们加第三个方法 `greet(String name, int fish)`（印「你好，张三，今天 3 条」），三个方法一起调用一遍，看看电脑是不是各挑各的。
2. 把第二节 `add` 那两招的顺序**上下对调**（小数版写上面、整数版写下面），再跑一遍 —— 输出变了没有？想一想：电脑挑招，看的是先后顺序吗？
3. 故意把第二招的输入接口改成和第一个方法一样（都写 `String name`，但料名改成 `who`），编译一次，把原话抄进记录表。抄完记得改回来。
4. 写一个方法 `void countTo(int n)`，里面用圈从 1 数到 `n`；再在圈**外面**摆一块名称记「一共数了几个数」，跑完印出来。想想那块名称为什么必须摆在外面（提示：摆进去就是出了圈调用不着）。
5. 给 `countTo` 写成**两招**：一个方法 `countTo(int n)`，从 1 数到 `n`；另一个方法 `countTo()`，什么也不喂，直接印一句「我们不数了」。两招一起写进类定义，调用两声看看电脑挑得对不对。

下一课「递归」，我们要教你一个方法「递归调用」的功夫：方法在自己状态里再调用一遍自己，把大问题一层层啃小——看仔细，它是怎么知道什么时候该停的。去下一课探险 
