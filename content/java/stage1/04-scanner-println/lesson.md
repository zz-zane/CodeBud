---
id: java-stage1-04
lang: java
stage: 1
order: 5
title: Scanner 与 println
tags: [输入输出, Scanner, printf]
required: ["java-stage1-03"]
crossRefs: ["common-08","c-stage1-04","cpp-stage1-04","python-stage1-05"]
estMinutes: 22
keywords: [Scanner, nextInt, nextLine, printf, print]
compare: ["common-08"]
---

## 学习目标

本课学习Scanner 与 println。重点包括System.out.println、Scanner 读取、格式化输出。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 三位「嘴」：`println`、`print`、`printf`

前面用的一直是 `println`，它念完会顺手**换一行**。另外两位也认识一下：

- `System.out.println("...")` —— 念完**换行**；
- `System.out.print("...")` —— 念完**不换行**，下一句紧跟着往后面挤；
- `System.out.println()` —— 括号空着，就是**单纯换一行**。

一句话里连用，差别一眼就看得出来：

```java
public class Main {
    public static void main(String[] args) {
        System.out.print("我们");
        System.out.print("在等你");
        System.out.println();
        System.out.println("换行了");
    }
}
```

```text
我们在等你
换行了
```

看出门道了吗：前两句 `print` 挤在同一行里，拼成了 `我们在等你`；空着括号的 `println()` 只是把车头调回行首；最后那句 `println` 才在自己那行念完，又换了一行。

::: tip 提示
**只想换行、不想念字**的时候，写空着括号的 `println()`——这比 `println("")` 干净（后者是「念一句空的」，两者结果一样，但前者一眼就看得出你的意图）。
:::

## `printf`：先给话留好空位，再把东西塞进去

想要「数字跟着话一起念」，前面我们都是用加号往一起拼。还有一种更整齐的写法，叫 `printf`——它让你**先在话里留好空位**，再把东西塞进去：

```java
public class Main {
    public static void main(String[] args) {
        int fish = 3;
        double price = 2.5;
        System.out.printf("张三要了 %d 条，一共 %.2f 元%n", fish, fish * price);
    }
}
```

```text
张三要了 3 条，一共 7.50 元
```

三件事看仔细：

1. `%d` 是**整数**的空位——`fish` 正好是 `3`，塞进去；
2. `%.2f` 是**小数**的空位，那个 `.2` 的意思是「**小数只留两位**」——`7.5` 被整整齐齐地印成了 `7.50`；
3. `%n` 是 `printf` 里的换行（注意它是 `%n`，不是 `\n`）。

写法上也有一点不同：`printf` 念完**不会自己换行**，要换行就得自己写 `%n`。

（看出来了吧，`fish * price` 那一下用到了乘号——乘号自己的故事下一课讲，今天先当它是一台会算账的小机器。）

## 让程序学会「听」：请一位 `Scanner`

Java 里替程序听东西的小帮手叫 **`Scanner`**。它不住在我们的类定义里，得**点名去厢房把它请出来**——在文件最上面写这么一行：

```java
import java.util.Scanner;
```

（这行的门道在下一课细讲，今天先照抄，一个字都别改。）

请它出来的写法是：

```java
Scanner sc = new Scanner(...);
```

`sc` 是我们给它起的名字（随你起，短一点顺手）。**注意 `new` 这个词和括号**——这是「新请一位」的意思，别漏。

括号里塞什么，它就听什么：

- 塞**一根纸条**（一串字），它就从纸条上读——练习台里就用这个写法，每次跑出来结果都一样，方便对答案；
- 塞 `System.in`（键盘那个口子），它就从键盘听——你在自己电脑上跑的时候用这个。

先看纸条的版本。递给它一根写着 `42` 的纸条：

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner("42");
        int n = sc.nextInt();
        System.out.println(n + 1);
    }
}
```

```text
43
```

`sc.nextInt()` 这一个方法是「**从纸条上读一个整数**」，读出来 `42` 装进 `n` 这个变量，`n + 1` 自然是 `43`。

读小数用 `sc.nextDouble()`：

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner("2.5");
        double price = sc.nextDouble();
        System.out.println(price * 2);
    }
}
```

```text
5.0
```

读一整行（一串字符串那种）用 `sc.nextLine()`：

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner("张三");
        String name = sc.nextLine();
        System.out.println("名字是[" + name + "]");
    }
}
```

```text
名字是[张三]
```

那两对方括号是干嘛的？它把读到的内容**团团围住**，好让你一眼看出「读到的是空的还是有东西」——下一段马上就知道它有多好用了。

## 经典中的经典：`nextInt()` 后面接 `nextLine()`

练习中将名称换成 计算机 时，同样要先消耗 nextInt() 后剩余的换行，再用 nextLine() 读取名称。

这是 Java 新手摔得最狠的一跤，我们专门留了一整段给它。

递一根写着 `3` 和 `张三` 的纸条，先读数字，再读名字：

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner("3\n张三");
        int n = sc.nextInt();
        String name = sc.nextLine();
        System.out.println("数字是 " + n);
        System.out.println("名字是[" + name + "]");
    }
}
```

```text
数字是 3
名字是[]
```

数字好好读出来了，**名字却是空的**！张三去哪了？

原因是这样：`nextInt()` 读数字的时候，只把 `3` 取走，**后面那个换行还留在原地**。轮到 `nextLine()` 伸手一摸——摸到的正是那个剩下的换行，于是它老老实实地汇报：「这一行读完了，内容是空的。」

我们把那根纸条摊开，一步一步走给你看——盯着纸条上还剩什么：

```demo
title: 那根纸条上到底还剩什么
code:
| Scanner sc = new Scanner("3\n张三");
| int n = sc.nextInt();
| String name = sc.nextLine();
| System.out.println("数字是 " + n);
| System.out.println("名字是[" + name + "]");

step 递纸条：上面写着三样东西
at: 1
say: `new Scanner("3\n张三")` 递进去的是**一根纸条**，上面写着三样东西：一个 `3`、一个换行、一串 `张三`。Scanner 的变量按在纸条最头上。
meow: Scanner 读取这段字符串。
pose: expect
纸条上还剩 = 3\n张三
n 这个变量 = （还没读）
name 这个变量 = （还没读）
标准输出 = （空）

step `nextInt()`：把 3 取走，换行不动
at: 2
say: `nextInt()` 只认数字，把 `3` 取走装进 `n` 这个变量。**注意它返回完就停在 3 后面** —— 那个换行它碰都没碰，还留在纸条上。这一步一点错都没有。
meow: nextInt 读到 3，换行符还在。
pose: busy
纸条上还剩 = \n张三
n 这个变量 = 3
name 这个变量 = （还没读）
标准输出 = （空）

step `nextLine()`：一伸手就摸到了那个换行
at: 3
say: 轮到 `nextLine()` 了。它要的是「一整行」，于是从变量按住的地方往后摸，一直摸到换行就收手 —— 摸到的正是上一步留下的那个换行。
meow: nextLine 从换行符处开始读。
pose: think
纸条上还剩 = 张三
n 这个变量 = 3
name 这个变量 = （还没读）
标准输出 = （空）

step 它如实汇报：这一行是空的
at: 3
say: 摸到换行，它就当这一行读完了，读到的东西**是空的**。它一点也不觉得自己错，把空串装进 `name` 这个变量 —— **这一步照样不报错**。
meow: 读到空字符串，name 是空的。
pose: busy
纸条上还剩 = 张三
n 这个变量 = 3
name 这个变量 = （空的）
标准输出 = （空）

step 印数字：稳稳当当
at: 4
say: 印的第一句没问题：`n` 里就是 `3`，屏幕上出现「数字是 3」。
meow: 数字正确，输出 3。
pose: yay
纸条上还剩 = 张三
n 这个变量 = 3
name 这个变量 = （空的）
标准输出 = 数字是 3

step 印名字：方括号里一片空白
at: 5
say: 方括号把读到的东西团团围住 —— 围住的是一片空白。数字有、名字没了，而程序从头到尾**一句错都没报**。张三没丢，它还好端端站在纸条上，只是没人摸到它。
meow: 名字为空，张三还没被读取。
pose: think
纸条上还剩 = 张三
n 这个变量 = 3
name 这个变量 = （空的）
标准输出 = 数字是 3 ／ 名字是[]
```

**看清楚这两拍**：`nextInt()` 只返回数字、把换行留在纸条上；下一句 `nextLine()` 上手摸到的就是它，于是「读到一行空的」。车没翻、错没报，结果却是错的 —— 这就是它难查的地方。办法只有四个字：**先把空行消耗**。在两句之间补一句没有名字的 `sc.nextLine();`：

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner("3\n张三");
        int n = sc.nextInt();
        sc.nextLine();
        String name = sc.nextLine();
        System.out.println("数字是 " + n);
        System.out.println("名字是[" + name + "]");
    }
}
```

```text
数字是 3
名字是[张三]
```

多出来的那一句 `sc.nextLine();` 什么也没接住——它的任务就是**把剩下的换行处理干净**，这样下一句 `nextLine()` 才能读到真正的名字。

::: warn 注意
**先读数字、再读一整行**的时候，中间那句「消耗空行」的 `nextLine()` 几乎是必备的。忘了它，程序不会报错，只会**安安静静地读到一个空行**——这是最难查的那一类错：它不翻脸，它给你一个看起来很正常的结果。
:::

## 忘写 `import`，它会说不认识这个名字

那个请小帮手的 `import` 要是漏了，编译器当场就不认识 `Scanner` 是谁：

```java
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner("42");
        System.out.println(sc.nextInt());
    }
}
```

```text
Main.java:3: error: cannot find symbol
        Scanner sc = new Scanner("42");
        ^
  symbol:   class Scanner
  location: class Main
Main.java:3: error: cannot find symbol
        Scanner sc = new Scanner("42");
                         ^
  symbol:   class Scanner
  location: class Main
2 errors
```

`cannot find symbol` 就是「**不认识这个名字**」（第 1 课那个没带引号的错也是它）。`symbol: class Scanner` 说得更明白：它压根没听说过有那么一位叫 `Scanner` 的小帮手。

记住了：`Scanner` 住在 `java.util` 那间厢房里，**不写 `import` 点名，它不会自己冒出来**。所以看到 `cannot find symbol`，第一件事就是回头检查最上面那行 `import` 写了没有。

## 纸条上什么都没有的时候，它会当场翻脸

要是括号里递的是键盘口子 `System.in`，而主人一个键都没敲，`Scanner` 伸手一摸——空的。它会**直接翻脸**，把一大串错误信息甩给你：

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(n);
    }
}
```

```text
Exception in thread "main" java.util.NoSuchElementException
	at java.base/java.util.Scanner.throwFor(Scanner.java:945)
	at java.base/java.util.Scanner.next(Scanner.java:1602)
	at java.base/java.util.Scanner.nextInt(Scanner.java:2267)
	at java.base/java.util.Scanner.nextInt(Scanner.java:2221)
	at Main.main(Main.java:6)
```

`Exception ... NoSuchElementException` 的意思是「**该有的东西没有**」——它想读一个整数，可纸条上空空如也，什么也没保存，只好罢工。下面那一摞缩进去的行，是它**从哪儿一路走过来的**（越往下越靠近你写的那一行），最后一行的 `Main.main(Main.java:6)` 就是在说：「我们是从第 6 行开始叫它干活的。」

::: tip 提示
所以课文里我们一直用 `new Scanner("42")` 这种**递纸条**的写法：练习台里没有键盘给你敲，递一根写好的纸条，程序每次跑出来的结果才一样、才好对答案。等你在自己电脑上跑，把纸条换成 `System.in`，它就开始听键盘了。
:::

## 和 Python 比一比

| | Python 那边 | Java 的小帮手 |
|---|---|---|
| 念一句话 | `print("...")` 念完换行 | `println` 换行、`print` 不换行，两位分工 |
| 带格式念 | `f"{price:.2f}"` | `printf` 里留 `%.2f` 的空位 |
| 请听筒 | `input()` 一句就够 | 先 `import`、再 `new Scanner`，两步 |
| 读到的数字 | `input()` 永远是字符串，要自己 `int(...)` 转 | `nextInt()` **直接给你整数** |
| 先读数字再读整行 | 没这个坑 | **有个空行的坑**，要补一句把它消耗 |

最后两行是 Java 这边的特色：好处是读数字不用自己转，代价是 `nextInt()` 后面那个换行得自己收拾干净。

::: warn 注意
- `import java.util.Scanner;` 要写在**类定义外面、文件最上面**，别塞进 `public class` 里面；
- `Scanner sc = new Scanner(...);` 请一次就够，别每读一样东西就请一位；
- 老规矩：分号、英文引号、英文括号，一个都不能少。
:::

## 小任务

让程序**问主人**要两样东西：数据的条数、单价，然后算出一共多少钱，用 `printf` 印成两位小数。

先在练习台里用递纸条的写法跑通（纸条上写 `3` 和 `2.5`），再把纸条换成 `System.in`，换成你自己敲：

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner("3\n2.5");
        int fish = sc.nextInt();
        double price = sc.nextDouble();
        System.out.printf("一共 %d 条，花了 %.2f 元%n", fish, fish * price);
    }
}
```

跑通之后试着捣两个乱：① 把 `import` 那行删掉，看编译器说什么；② 把纸条写成 `"3 2.5"`（同行、用空格隔开），看看还读不读得出来 
