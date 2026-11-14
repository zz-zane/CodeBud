---
id: java-stage1-16
lang: java
stage: 1
order: 6
title: Java 的包与 import
tags: [包, 导入, 工程组织]
required: [java-stage1-04]
crossRefs: [java-stage1-01, java-stage1-04, java-stage1-08]
estMinutes: 12
keywords: [package, import, java.util, Scanner]
---

## 学习目标

本课学习Java 的包与 import。重点包括为什么要有包、import 到底干了什么、java.util 这个外卖箱、同名的两个类怎么办、不用 import 的例外：java.lang。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## `import` 到底干了什么

前面几课你见过 `Scanner` 吧？我们当时直接写 `Scanner sc = ...`，结果编译器一脸茫然：

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
```

（我们把 `System.in` 换成了 `"42"`，这样不用等你敲键盘，程序自己就能跑。）

`cannot find symbol` 就是「找不到这个符号」。编译器不笨，只是自带的类定义太多，它**不会挨只箱子替你翻**。你得明确告诉它：去这个箱子拿——

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner("42");
        System.out.println(sc.nextInt() + 1);
    }
}
```

输出 `43`。这行 `import java.util.Scanner;` 的意思就是：**我们要用 `java.util` 这个箱子里的 `Scanner`。**

## `java.util` 这个外卖箱

`java.util` 是 Java 自带的一个大箱子，装的全是「日常小工具」：`Scanner`（读你敲的字）、`Random`（摇随机数）、`Arrays`（伺候一整排元素的帮手）……都住在里面。

## 写全名也行：`import` 只是省字

`import` **不搬任何东西，只负责省字**。你不嫌麻烦，每次都写全名，照样跑得欢：

```java
public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner("42");
        System.out.println(sc.nextInt() + 1);
    }
}
```

输出同样是 `43`。`import java.util.Scanner;` 和「每次都写全名」是**同一件事**，前者只是让你后面少打一截。

这一行 `import` 到底在哪个时刻起作用、又到底搬没搬东西进来，我们拆成一步一步走给你看：

```demo
title: import 那一行到底在什么时候干活
code:
| import java.util.Scanner;
| Scanner sc = new Scanner("42");
| System.out.println(sc.nextInt() + 1);

step 编译开工：第一行只是记个名字
at: 1
say: 编译器从文件最上面念起，头一行就是 `import`。它在自己的本子上**记一笔**：「往后见到 `Scanner` 这个简名，指的就是 `java.util` 那个箱子里的」。**它不搬任何东西进来**，只是登记个名字。
meow: import 让简名可用。
pose: expect
编译器的本本 = （还空着）
sc 面前的纸条 = （还没请出来）
返回的 = （还没动字段）
标准输出 = （空）

step 念到 `Scanner`：翻本子，认出来了
at: 2
say: 念到 `Scanner sc = ...`。`Scanner` 是个**简名**，编译器翻本子对了一下，认出它是 `java.util` 那个箱子里的 —— 第 1 步记的那一笔，就是这时候派上用场。**要是没写 `import`，本子上没这一笔**，它当场报 `cannot find symbol`。
meow: Scanner 解析为 java.util.Scanner。
pose: busy
编译器的本本 = Scanner → java.util.Scanner
sc 面前的纸条 = （还没请出来）
返回的 = （还没动字段）
标准输出 = （空）

step `new Scanner("42")`：请一位小帮手，递上纸条
at: 2
say: 名字认出来之后，`new Scanner("42")` 请出一位小帮手，让它对着写着 `42` 的纸条。这一句跟 `import` 已经没关系了 —— 本子上那一笔的用处，在上一步就用完了。
meow: 创建 Scanner，读取字符串「42」。
pose: busy
编译器的本本 = Scanner → java.util.Scanner
sc 面前的纸条 = 42
返回的 = （还没动字段）
标准输出 = （空）

step `sc.nextInt()`：从纸条上返回一个整数
at: 3
say: `sc.nextInt()` 让这位小帮手从纸条上返回一个整数回来，复制到的是 `42`。纸条上就这两个字，返回完就空了。
meow: nextInt 读到 42。
pose: yay
编译器的本本 = Scanner → java.util.Scanner
sc 面前的纸条 = （读走一个 42）
返回的 = 42
标准输出 = （空）

step `+ 1`：两个整数相加
at: 3
say: 返回的 `42` 再加上 `1`，得 `43`。这一步就是两个整数相加，跟 `import`、跟 Scanner 都没关系了。
meow: 42 + 1 = 43。
pose: busy
编译器的本本 = Scanner → java.util.Scanner
sc 面前的纸条 = （读走一个 42）
返回的 = 43
标准输出 = （空）

step 印出来，`import` 早退场了
at: 3
say: 最后 `System.out.println` 把 `43` 印到屏幕上。回头数一遍整趟活：**`import` 那一行只在第 1 步露过一面** —— 屏幕上没有它，翻出来的通用话里也没有它。它干的活就是「给编译器记个名字」，记完就退场了。
meow: 输出 43。
pose: proud
编译器的本本 = Scanner → java.util.Scanner
sc 面前的纸条 = （读走一个 42）
返回的 = （印完了，放字段）
标准输出 = 43
```

**记住这一条**：`import` 只在**编译**那一刻起作用 —— 它给编译器记个名字，自己不搬东西、也不会出现在跑起来的时候。所以把它换成老老实实写全名 `java.util.Scanner`，跑出来一模一样。

## 不用 `import` 的例外：`java.lang`

那为什么 `System.out.println`、`String`、`Math.max` 从来没人让我们 `import` 过？因为它们住的箱子叫 `java.lang`——**Java 最贴身的那个**，编译器默认就先翻它。所以这个箱子里的东西，永远不用打招呼：

```java
public class Main {
    public static void main(String[] args) {
        System.out.println(Math.max(3, 7));
        System.out.println("字".length());
    }
}
```

输出 `7` 和 `1`。

## 两个箱子里有同名怎么办

`java.util` 里有个 `Date`，`java.sql` 里也有个 `Date`。要是两个箱子一起打了招呼：

```java
import java.util.*;
import java.sql.*;

public class Main {
    public static void main(String[] args) {
        Date d = new Date(0);
        System.out.println(d.getTime());
    }
}
```

编译器当场犯难：

```text
Main.java:6: error: reference to Date is ambiguous
        Date d = new Date(0);
        ^
  both class java.sql.Date in java.sql and class java.util.Date in java.util match
```

`ambiguous` 就是「拿不准」。规矩很简单：**简名一旦打架，就只能老老实实写全名**——想用哪个就写 `java.util.Date` 或 `java.sql.Date`，别指望它猜。

::: tip 提示
三句话记牢：**包 = 一个只贴好名字的外卖箱**；**`import` 只省字、不搬东西**；**`java.lang` 是贴身箱子，永远不用打招呼**。
:::

::: warn 注意
`import` 要写在文件最上面、`public class` 之前。还有两个常见坑：同一个箱子里的类定义要拿两样，得写**两行** `import`，不能拿逗号挤在一行；行尾的分号少一个，报的错会跑到十万八千里外。
:::

## 小任务

新建一个 `Main.java`，第一行敲上 `import java.util.Scanner;`，用 `Scanner` 读一读 `"2026"`；再把它改成全名 `java.util.Scanner` 的写法，一行 `import` 都不留。两版都跑一跑，看看输出是不是一模一样 
