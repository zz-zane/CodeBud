---
id: java-stage1-01
lang: java
stage: 1
order: 1
title: 认识 Java 与第一个程序
tags: [入门, 程序结构]
required: ["common-01"]
crossRefs: ["common-01", "common-02"]
estMinutes: 15
keywords: [class, main, println]
compare: ["common-02"]
---

## 学习目标

本课学习认识 Java 与第一个程序。重点包括Java 是什么、JVM 概念、hello world、public class 规则。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## Java 是什么

Java 是一门**编程语言**。它的脾气和 Python 不太一样，先认识三点就够：

- **规矩多，但稳当。** 写 Java 得把每样东西的「类型」提前讲清楚，写起来比 Python 啰嗦一点；好处是它**翻脸之前常常先提醒你**——很多错还没跑就被它拦下来了，后面几课你会亲眼见到。
- **一切代码都要住在类定义里。** 哪怕只想念一句话，也得先画一张**类定义**、给类定义起个名字。术语表里管这张类定义叫**类**，往后我们就用「类定义」两个字称呼它。
- **一次写好，哪儿都能跑。** 这是 Java 最出名的本事，靠的是一位住在每台电脑里的编译器，它的正式名字叫 **JVM**（Java 虚拟机）。

### JVM：揣着一口「通用话」的随身翻译

别的语言的编译器，常常直接把你的源代码翻成**这一台电脑的方言**——换一台电脑，就得重翻一遍。

Java 的编译器精一些：它先把源代码翻成一种**全世界的对象都认得的通用话**（这门通用话的正式名字叫**字节码**），再由每台电脑上住着的那个 **JVM**，当场把通用话讲给这台电脑听。

所以同一份翻译稿，Windows 上的 JVM 念得出来，Mac 上的 JVM 也念得出来——这就是「一次写好，哪儿都能跑」。

（JVM 还随身带着一位**垃圾回收器**，会悄悄替你清走不要的东西。那是很深的话题，今天先知道有这么一位就够啦。）

## 第一个程序：让电脑念一句「你好，！」

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("你好，！");
    }
}
```

```text
你好，！
```

恭喜！这就是你的第一个 Java 程序。它比 Python 的版本身材长了不少，别慌，我们一行一行拆给你看：

1. **`public class Main {` … `}`** —— 这是那张**类定义**，名字叫 `Main`；一对花括号把类定义里的内容整个圈起来。`public` 的意思是「谁都能用」，今天照抄就好。
2. **`public static void main(String[] args)`** —— 这是**入口**。程序跑起来，第一脚就踩在这一行上。这一整行是**固定写法**：一个词都不能少、一个字母都不能改，括号里那段 `String[] args` 也是它的一部分。含义我们以后再拆，今天先把它当口诀背下来。
3. **`System.out.println("你好，！");`** —— 这是**嘴**。`System` 是 Java 自带的一件系统工具，`out` 指的是往外念的那个口子，`println` 是方法名（念完还会顺手**换一行**）。括号里用**引号**圈住要念的内容——引号里的话原样输出，**引号本身不念**。
4. **行尾那个分号 `;`** —— 它是 Java 的**句号**，每句话说完都得点上。漏了它，Java 会当场翻脸（下一课你就看到它翻脸的样子）。

## 一行一行往下念

想让它念两句，就写两行：

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("拿数据");
        System.out.println("放进元素里");
    }
}
```

```text
拿数据
放进元素里
```

和 Python 一样：**从上往下一行一行做**，谁写在前面谁先出声。把这两行换个个儿，输出的顺序也跟着换。

## 引号里是话，不带引号是名字

`println` 的括号里，除了引号包着的文字，还能直接放**数字**：

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("数据有");
        System.out.println(3);
        System.out.println("条");
    }
}
```

```text
数据有
3
条
```

数字**不用加引号**，Java 照样念得出来。可要是把一句话的引号也去掉——写成 `System.out.println(你好)`——事情就不一样了：

```java
public class Main {
    public static void main(String[] args) {
        System.out.println(你好);
    }
}
```

编译器当场摇头，甩给我们这么一段：

```text
Main.java:3: error: cannot find symbol
        System.out.println(你好);
                           ^
  symbol:   variable 你好
  location: class Main
1 error
```

`cannot find symbol` 就是「**不认识这个名字**」：不带引号的东西，Java 一律当成一个**名字**去找——它先看看有没有哪个变量、哪张类定义叫这个名字，一个都没找着，就报错给你看。

**记住这条分界：引号里的是「一句话」，不带引号的是「一个名字」。** 这一条往后天天要用。

## 两条要背下来的死规矩

### 规矩一：文件名必须和 `public class` 的名字一模一样

上面那段代码，我们把它存成一个文件，文件名就得叫 **`Main.java`** ——因为类定义名叫 `Main`。屋名和类定义名要**一个字都不差**，大小写也算。

要是我们手一抖，写成 `public class Hello` 却存进 `Main.java`，编译器连代码内容都不看，直接甩脸：

```text
Main.java:1: error: class Hello is public, should be declared in a file named Hello.java
1 error
```

这句话的意思是：「`Hello` 是公开的，就该住在叫 `Hello.java` 的文件里。」所以名字这件事，第一天就要养成习惯：**先想好类定义名，再用同一个名字存文件。**

### 规矩二：入口那一行，一个字都别改

`public static void main(String[] args)` ——大小写、空格、括号里的内容，全是固定的。最容易摔的正好是两下：

- **`main` 和 `Main` 是两回事。** Java 认死理：大小写不同，就是两个不同的名字。
- **少一个词都不行。** 漏掉哪个词，要么翻不过去，要么翻过去了却「找不到入口」。

::: tip 提示
今天记住三件事就够：

1. Java 代码住在**类定义**里，类定义要起名字，而且**文件名和类定义名一模一样**（`Main.java` ↔ `public class Main`）；
2. 入口是 `public static void main(String[] args)`，**固定写法，当口诀背**；
3. 想让电脑念话，调用 `System.out.println("...")`，行尾别忘了那个分号。
:::

::: warn 注意
Java 里的引号 `"` 和分号 `;` 必须是**英文的**。中文输入法手滑打出来的「，」「；」「”」长得像，Java 却一个都不认，报出来的错还会指向别处。写完一行回头瞄一眼输入法，能省下你不少抓耳挠腮。
:::

## 小任务

新建一个文件，就叫 `Main.java`，把下面这段敲进去（引号里的字随你改）：

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("我们会写 Java 啦");
    }
}
```

跑通之后，故意捣两个乱：① 把某一行末尾的分号删掉再跑，看看编译器说什么；② 把类定义名改成 `Hello`、文件却还叫 `Main.java`，再跑一次。

两个报错都亲眼见一遍，下一课我们就带你拆解：你的源代码到底是怎么被翻出来、又是怎么跑起来的 
