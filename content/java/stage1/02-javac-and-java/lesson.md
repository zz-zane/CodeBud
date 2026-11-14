---
id: java-stage1-02
lang: java
stage: 1
order: 2
title: javac、字节码与 JVM 执行
tags: [编译, 工具链]
required: ["java-stage1-01"]
crossRefs: []
estMinutes: 18
keywords: [javac, java, class, JVM]
---

## 学习目标

本课学习javac、字节码与 JVM 执行。重点包括编译与运行两步、JVM 的角色、在软件里跑 Java 代码。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 第一步：`javac` 把源代码翻成通用话

先指名道姓：编译那位叫 **`javac`**（`java` 后面那个 `c`，是「翻」的意思）。

我们拿上一课那个程序，存成 `Main.java`，然后敲这么一句：

```text
javac Main.java
```

敲完回车，屏幕上**一次不吭**——别慌，这不是它不理你，是它干活本来就安安静静。它去哪儿了？看看文件夹就知道了：

```text
Main.java     ← 你亲手写的稿子，还在
Main.class    ← 编译器翻出来的那份「通用话」
```

多出来的这个 **`Main.class`**，就是那位随身翻译要念的源代码。它不是给机器看的，是**给 JVM 看的**——所以你写的字一个都没变，只是换成了一口 JVM 听得懂的通用话。

现在调用第二位：**`java`**（没有末尾那个字母），让 JVM 把通用话输出：

```text
java Main
```

这回屏幕上就有字了：

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("第一步：翻稿子");
        System.out.println("第二步：输出");
        System.out.println("两步都做完，屏幕上才有字");
    }
}
```

```text
第一步：翻稿子
第二步：输出
两步都做完，屏幕上才有字
```

你瞧，三行代码就是三行字，还是老规矩：从上往下一行一行念。

这两趟活按什么顺序敲、每趟干完之后文件夹和屏幕上各是什么样，我们拆成一步一步走给你看：

```demo
title: 两条命令各干了哪一趟活
code:
| javac Main.java
| java Main

step 敲命令之前：文件夹里只有你写的源代码
at: 1
say: 你亲手写的 `Main.java` 就躺在文件夹里，编译器还没碰过它。此刻文件夹里只有这一份文件，屏幕上当然一个字都没有。
meow: 此时只有 Main.java。
pose: expect
这趟活 = （还没调用）
文件夹里 = Main.java
标准输出 = （空）

step 第一趟：`javac Main.java`，点名编译那位
at: 1
say: `javac` 末尾上那个 `c` 就是「翻」。命令后面跟的是**文件名**，连门牌 `.java` 一起写上 —— 这是在告诉它「翻哪一份」。
meow: javac 把源代码编译成字节码。
pose: busy
这趟活 = 翻稿子（javac）
文件夹里 = Main.java
标准输出 = （空）

step 翻完了：文件夹里多出一份 `Main.class`
at: 1
say: 回车之后屏幕**一次不吭** —— 那是它干活本来的样子，别以为它没理你。去看文件夹：多了一份 `Main.class`，就是翻出来的通用话。**此刻屏幕上还是空的**，因为还没人念它。
meow: 没有报错就是成功，生成 Main.class。
pose: busy
这趟活 = 翻稿子（干完了）
文件夹里 = Main.java + Main.class
标准输出 = （空）

step 第二趟：`java Main`，换一位念源代码
at: 2
say: 这回引用的是**不带末尾**的 `java` —— 让住在这台电脑里的 JVM 把通用话输出。后面跟的是**类定义名**，光秃秃一个 `Main`，不写 `.java` 也不写 `.class`。
meow: java 启动 JVM，后面写类名。
pose: expect
这趟活 = 念稿子（java）
文件夹里 = Main.java + Main.class
标准输出 = （空）

step JVM 念起来了：字才往屏幕上冒
at: 2
say: JVM 念的正是那份 `Main.class`，从固定的入口那一行开始，**从上往下一行一行念**。真正出字是这一刻的事 —— 前一趟只生文件，一个字都不吐。
meow: JVM 从 main 方法开始执行。
pose: busy
这趟活 = 念稿子（正在念）
文件夹里 = Main.java + Main.class
标准输出 = 正在冒字……

step 两趟都干完，三行字齐了
at: 2
say: 三行代码就是三行字，全是这一刻冒出来的。回头看两条命令的分工：**`javac` 那趟只管往文件夹里放东西，`java` 那趟才往屏幕上吐东西**。改完源代码要是只存文件、不重新 `javac`，第二趟念的还是旧的那份 `Main.class`。
meow: 输出三行，运行结束。
pose: proud
这趟活 = 两趟都干完了
文件夹里 = Main.java + Main.class
标准输出 = 第一步：翻稿子 ／ 第二步：输出 ／ 两步都做完，屏幕上才有字
```

**认准这个分工**：先写稿、再翻稿、最后念稿。翻稿那趟只往文件夹里放东西，念稿那趟才往屏幕上吐东西 —— 往后看到一段报错，先想它是哪一趟里冒出来的，答案自己就浮出来了。

## 两条命令，各念各的名字

这两条命令，最容易调用混的就是后面跟的东西，我们列成一张表：

| 命令 | 引用的是谁 | 后面跟什么 |
|---|---|---|
| `javac Main.java` | 编译（编译器） | **文件名**，连门牌 `.java` 一起写上 |
| `java Main` | 念源代码（JVM） | **类定义名**，光秃秃一个名字，不带 `.java`、也不带 `.class` |

再记一句大白话：**`javac` 要的是「哪份文件」，`java` 要的是「哪张类定义」。** 所以第二条命令上**别带末尾**——要是写成 `java Main.class`，JVM 就会一脸茫然地告诉你它找不到这张类定义：

```text
Error: Could not find or load main class Main.class
Caused by: java.lang.ClassNotFoundException: Main.class
```

看出来了吧，它把 `Main.class` **整个当成类定义名**去找了——类定义叫 `Main` 呀，哪有叫 `Main.class` 的类定义。

（顺便说一句：新版的 `java` 还学了一手本事，能直接念一份 `.java` 源代码。那是它的另一个方法，不是我们今天学的两步走——往后一律按两步走写，稳当。）

## 翻不过去，就一句都不念

Java 的编译器有个硬脾气：**源代码里只要有一个字它翻不动，它一句都不念**——不是念一半停一半，是整份退回。

我们故意漏掉一个分号给你看：

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("你好，！")
    }
}
```

编译器当场把源代码退回来，还细心地点出「第几行、缺什么」：

```text
Main.java:3: error: ';' expected
        System.out.println("你好，！")
                                   ^
1 error
```

`error: ';' expected` 就是「**这里该有一个分号，可是没有**」；上面那行 `Main.java:3` 是在说「出问题的是第 3 行」。那个小箭头 `^` 指的就是它觉得不对劲的位置。

别嫌它凶，这其实是**好处**：分号漏了、名字打错了、括号少了一个，好多错**在编译这一步就被拦下了**，根本轮不到程序跑到一半才炸给你看。Python 那边的编译器是「念到哪儿错在哪儿」，Java 这边是「先整本查一遍」，脾气不同，各有各的好。

## 翻过去了，也未必跑得起来

两种报错分得清清楚楚，这是 Java 两趟活最值钱的地方。

有一种错，编译器觉得**语法上没毛病**，源代码照翻；可 JVM 拿起来一跑，发现「没有入口」——程序不知道该从哪一行开始。我们把入口那一行的 `static` 偷偷删掉试试：

```text
Error: Main method is not static in class Main, please define the main method as:
   public static void main(String[] args)
```

这句话的意思是：「`Main` 这张类定义里的 `main` 不是那个固定写法，请把它写成 `public static void main(String[] args)`。」

**这个错，编译那一步是查不出来的**——因为 `public void main(String[] args)` 本身语法合法，只是它不是 Java 认的那个入口而已。所以往后看到报错，先看它出自哪一步：

- 出自 `javac`：源代码本身有问题（拼写、分号、括号……）
- 出自 `java`：源代码翻好了，是**跑起来**的时候出的岔子

::: tip 提示
三步口诀，照着背就行：**写 `Main.java` → `javac Main.java` → `java Main`。** 编译那位带末尾（`c`），要文件名；念源代码那位不带末尾，要类定义名。
:::

::: warn 注意
改完代码**一定要重新翻一次源代码**：只存文件、不重新 `javac`，跑的还是上一版留下的旧 `.class`，你会对着屏幕纳闷「我们明明改了呀」。

还有一个小坑：`javac` 和 `java` 不是敲在代码文件里的，是敲在**命令窗口**（终端）里的。它们属于「调用编译器开工」的话，不属于源代码本身。第二条命令只写类定义名 `Main`——不带 `.java`，也不带 `.class`。
:::

## 在软件里跑 Java 代码

在写代码的软件里，你会看到一个**运行按钮**：按一下，代码就跑起来了。它背后干的活儿，其实就是替你敲了刚才那两条命令——先把 `.java` 交给编译器翻一遍，再调用 JVM 输出。软件只是把命令窗口藏了起来，把结果端到你面前。

**按钮是糖，命令是饭。** 哪天按钮不灵了，命令照样跑得起来；哪天你搞不清出错在哪一步，键盘敲一遍这两条命令，答案自己就冒出来了。

## 小任务

跟着我们走一遍，一步都别跳：

1. 新建 `Main.java`，把下面这段敲进去；
2. 在命令窗口里敲 `javac Main.java`，回头看看文件夹里是不是多出了一个 `Main.class`；
3. 再敲 `java Main`，看屏幕上冒出那句话；
4. 故意捣乱两次：① 删掉一个分号，重新 `javac`，把编译器的原话念一遍；② 把 `main` 改成 `Main`，重新 `javac`（这次它会乖乖翻），再用 `java Main` 跑，看看 JVM 说什么。

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("翻稿子，输出，两步都走完啦");
    }
}
```

下一课，我们带你认识一个箱子上的**三个名字**——写代码用的、跑代码用的、和真正在底下干活的，各归各。认全它们，你就知道自己敲下的每一行要经谁的手 
