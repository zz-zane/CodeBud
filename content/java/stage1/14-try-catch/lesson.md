---
id: java-stage1-14
lang: java
stage: 1
order: 18
title: 异常处理
tags: [异常, try-catch, finally]
required: [java-stage1-13]
crossRefs: []
estMinutes: 25
keywords: [try, catch, finally, exception]
---

## 学习目标

本课学习异常处理。重点包括异常概念、try/catch/finally、常见异常。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、没人管的时候：当场断气

先看一次没人管的翻车：

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("处理前先数一下元素");
        int fish = 5;
        int cats = 0;
        System.out.println(fish / cats);
        System.out.println("这句跑不到了");
    }
}
```

```text
处理前先数一下元素
Exception in thread "main" java.lang.ArithmeticException: / by zero
	at Main.main(Main.java:6)
```

三行要读明白：

- **第一行印出来了** —— 说明翻车发生在它后面。
- **第二行**念起来是「**`main` 里翻了一路车：算数算不成，除以 0 了**」。`Exception in thread "main"` 就是「在 `main` 里翻的车」，后面那个长长的 `java.lang.ArithmeticException` 是**这一路翻车的名字**。
- **第三行**是出事地点：`Main.java` 的第 6 行 —— 就是我们做除法那一行。
- 最后那句「这句跑不到了」，**一个字都没印出来**。程序当场断气，后面全都不算数了。

这就是翻车最要命的地方：**它不挑地方**。可能发生在我们写的第一行，也可能在最后一行 —— 一旦断气，剩下的活儿全撂了。

## 二、`try` 里看着办：把翻车接住

今天的主角上场：**把可能翻车的活儿放进 `try` 里，翻车之后要干什么写进 `catch` 里。**

```java
public class Main {
    public static void main(String[] args) {
        int fish = 5;
        int cats = 0;
        try {
            System.out.println(fish / cats);
        } catch (ArithmeticException e) {
            System.out.println("除数不能是 0 ，这份数据先不分了");
        }
        System.out.println("分账结束");
    }
}
```

```text
除数不能是 0 ，这份数据先不分了
分账结束
```

同样的「除以 0」，这次没断气。拆开看这两块：

- **`try { ... }`** —— 「这几句我们心里没底，先盯着」。真翻了车，`try` 里**没跑完的句子**直接跳过。
- **`catch (ArithmeticException e) { ... }`** —— 「要是翻的是**算数算不成**这一路车，我们就这么办」。括号里写的名字，就是第二节见过的那**一路翻车的名字**。
- 最后那句「分账结束」照常跑 —— **这就是接住翻车的全部意义**：这一路翻过去了，后面的账接着记。

::: tip 提示
`catch (...)` 那对小括号里，最后那个 `e` 是我们给「这一路翻车」起的名字 —— 它就是**翻车现场递过来的一块名称**，第四节会用它。前面那段 `ArithmeticException` 则是「**哪一路**」：一路车一个名字，写错了就接不住（第六节撞给你看）。
:::

## 三、常撞的几路翻车，各有各的名字

`catch` 里该写哪一路名字，得先知道常见的有哪几路：

| 翻的哪一路 | 什么时候翻 | 名字 |
|---|---|---|
| 一串字变不成数 | `Integer.parseInt("字")` | `NumberFormatException` |
| 算不成 | 除以 0 | `ArithmeticException` |
| 一排元素的编号越界 | `bowls[3]`（只有三个元素） | `ArrayIndexOutOfBoundsException` |
| 一串字符的编号越界 | `"鱼".charAt(3)`（第 15 课撞的那次） | `StringIndexOutOfBoundsException` |

先看「一串字变不成数」这一路。我们让学员把数据数当字输进来，结果他打了个「字」：

```java
public class Main {
    public static void main(String[] args) {
        try {
            int n = Integer.parseInt("字");
            System.out.println(n);
        } catch (NumberFormatException e) {
            System.out.println("这串字变不成数字，我们先记 0 吧");
        }
        System.out.println("记账继续");
    }
}
```

```text
这串字变不成数字，我们先记 0 吧
记账继续
```

再看「一排元素的编号越界」这一路：三个元素的编号只有 `0`、`1`、`2`，我们偏要 `bowls[3]`：

```java
public class Main {
    public static void main(String[] args) {
        int[] bowls = {3, 5, 7};
        try {
            System.out.println(bowls[3]);
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("越界了");
        }
        System.out.println("这句照跑");
    }
}
```

```text
越界了
这句照跑
```

两段都是一个套路：**先在 `try` 里干那个没底的活儿，再在 `catch` 里写明翻的是哪一路、怎么办**。名字对上了，它就接住；接住之后，程序照常往下走。

## 四、`e.getMessage()`：翻车递过来的字条

第三节那个 `e` 一直没用上。翻车现场其实会递过来一张**字条**，上面写着它到底为什么翻：

```java
public class Main {
    public static void main(String[] args) {
        try {
            Integer.parseInt("字");
        } catch (NumberFormatException e) {
            System.out.println("出岔子了：" + e.getMessage());
        }
    }
}
```

```text
出岔子了：For input string: "字"
```

`e.getMessage()` 返回的就是那张字条：**`For input string: "字"`** —— 翻车的家伙把「是哪个字惹的事」写在了上面。把它接在自家的话后面印出来，排查起来快得多。

::: warn 注意
两个字别写混：

- **`e.getMessage()`** —— 一张说人话的字条，建议印它。
- **光写 `e`** —— 印出来的只有**一行**：`java.lang.NumberFormatException: For input string: "字"`。它其实就是第一节那三行里的**第二行**，只是开头那句 `Exception in thread "main"` 是「没人接住」时才有的，接住了就没有。**这一行只有名字和字条，没有出事地点** —— 想知道它是从哪一行摔下去的，得再调用一句 `e.printStackTrace()`。本对象处理过「盯着字条猜半天」的亏。
:::

## 五、`finally`：不管翻没翻车，这一句都要跑

还有一块收尾的活儿：**不管这次翻没翻车，都得干的那几句**（收元素、关账、把借来的东西还回去）。这种活儿放进 `finally`：

```java
public class Main {
    public static void main(String[] args) {
        int[] bowls = {3, 5, 7};
        try {
            System.out.println(bowls[1]);
            System.out.println(bowls[3]);
            System.out.println("这句跑不到");
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("越界了");
        } finally {
            System.out.println("元素收好了");
        }
    }
}
```

```text
5
越界了
元素收好了
```

照跑的顺序读一遍，这一块特别能说明白三块各自管什么：

| 跑的顺序 | 屏幕上 | 说明 |
|---|---|---|
| ① | `5` | `try` 里第一句，`bowls[1]` 没越界，正常印 |
| ② | `越界了` | `bowls[3]` 越界翻车 → `try` 里**剩下那句**（「这句跑不到」）**被跳过**，跳到 `catch` |
| ③ | `元素收好了` | 不管翻没翻车，`finally` 都跑 |

**「这句跑不到」一个字没印** —— 这正是 `try` 那块地盘的脾气：里面哪一句翻了车，它**后面**的句子就全都不跑了，直接跳到 `catch`（本课第一节那个断气，就是「没人接住」版的同一件事）。

这一段跑的顺序最值得盯住，我们一步一步走给你看 —— 看车翻在哪一句、又弹到哪儿去：

```demo
title: 翻车之后，活是怎么一句一句往外弹的
code:
| int[] bowls = {3, 5, 7};
| try {
|     System.out.println(bowls[1]);
|     System.out.println(bowls[3]);
|     System.out.println("这句跑不到");
| } catch (ArrayIndexOutOfBoundsException e) {
|     System.out.println("越界了");
| } finally {
|     System.out.println("元素收好了");
| }

step 开场：先摆好那排元素
at: 1
say: `int[] bowls = {3, 5, 7};` 是摆上三个元素，编号从 `0` 起：0 号装 `3`、1 号装 `5`、2 号装 `7`。**编号最大只到 2** —— 这一点等一下要命。
meow: 数组有 3 个元素，下标 0 到 2。
pose: expect
bowls 那排元素 = {3, 5, 7}，编号 0、1、2
接下来跑到哪一句 = try 门口（还没进去）
翻的哪一路车 = （还没翻）
标准输出 = （空）

step 进门：`try {` 这块地盘开始盯着
at: 2
say: `try {` 是「这几句我们心里没底，先盯着」。进门这一刻一切正常，里面的句子按从上往下的老规矩一句一句跑。
meow: 进入 try 块。
pose: expect
bowls 那排元素 = {3, 5, 7}，编号 0、1、2
接下来跑到哪一句 = try 里第 1 句（`bowls[1]`）
翻的哪一路车 = （还没翻）
标准输出 = （空）

step `bowls[1]`：没越界，正常印
at: 3
say: `bowls[1]` 伸手去拿 1 号元素，里面有 `5`，编号也在范围里 —— 正常印出来，屏幕上先出现一个 `5`。
meow: bowls[1] 正常，输出 5。
pose: yay
bowls 那排元素 = {3, 5, 7}，编号 0、1、2
接下来跑到哪一句 = try 里第 2 句（`bowls[3]`）
翻的哪一路车 = （还没翻）
标准输出 = 5

step `bowls[3]`：没有这个元素，当场翻车
at: 4
say: `bowls[3]` 伸手要 **3 号元素** —— 根本没有这个元素，编号到 2 就没了。这一句当场翻车，翻的是「一排元素编号越界」那一路。**车到这儿就弹出去了**，`try` 这块地盘里剩下的事它不再管。
meow: bowls[3] 越界，抛出异常。
pose: think
bowls 那排元素 = {3, 5, 7}，编号 0、1、2
接下来跑到哪一句 = （车正从 try 里往外弹）
翻的哪一路车 = ArrayIndexOutOfBoundsException（编号越界）
标准输出 = 5

step `try` 里排在它后面的那一句：跳过
at: 5
say: 排在翻车那一句**后面**的「这句跑不到」，**一个字都不跑**，直接从头顶上跳过去。这就是 `try` 那块地盘的脾气：里面哪一句翻了车，它后面的句子就全不作数了。
meow: try 内剩余语句被跳过。
pose: busy
bowls 那排元素 = {3, 5, 7}，编号 0、1、2
接下来跑到哪一句 = 第 5 行被跳过，车弹到 catch
翻的哪一路车 = ArrayIndexOutOfBoundsException（编号越界）
标准输出 = 5

step 弹到 `catch` 的括号上：名字对上了
at: 6
say: 车一路弹到 `catch` 的括号上。括号里写的 `ArrayIndexOutOfBoundsException`，跟刚才翻的那一路**名字一模一样** —— 对上了，它才肯被接住。名字写错（比如写成「一串字变不成数」那一路），车不认这块名称，还会照样断气。
meow: catch 匹配到这个异常。
pose: yay
bowls 那排元素 = {3, 5, 7}，编号 0、1、2
接下来跑到哪一句 = catch 的括号上：名字对上了
翻的哪一路车 = ArrayIndexOutOfBoundsException（编号越界）
标准输出 = 5

step `catch` 里那一句：接住之后接着干
at: 7
say: 接住之后，`catch` 大括号里那句就轮到了 —— 屏幕上多出「越界了」。**接住的意思就是「这一路翻过去了，后面的账接着记」**。
meow: 输出「越界了」。
pose: busy
bowls 那排元素 = {3, 5, 7}，编号 0、1、2
接下来跑到哪一句 = catch 里那一句（印「越界了」）
翻的哪一路车 = ArrayIndexOutOfBoundsException（编号越界）
标准输出 = 5 ／ 越界了

step `finally`：翻没翻车都要跑
at: 9
say: 最后轮到 `finally` —— **不管这次翻没翻车，它都要跑**（收元素、关账这类活儿都放这儿）。屏幕上多出「元素收好了」。
meow: finally 总会执行。
pose: busy
bowls 那排元素 = {3, 5, 7}，编号 0、1、2
接下来跑到哪一句 = finally 里那一句（印「元素收好了」）
翻的哪一路车 = ArrayIndexOutOfBoundsException（编号越界）
标准输出 = 5 ／ 越界了 ／ 元素收好了

step 收工：车接住了，程序还活着
at: 10
say: 走到最后那个 `}`，程序**活着走完了**。回头数一遍屏幕：`5`、`越界了`、`元素收好了` —— 和上面那张表一模一样。跟第一节那次「当场断气」比一比，差别就在这一条：这一路的车有人接住了。
meow: 程序继续，没有崩溃。
pose: proud
bowls 那排元素 = {3, 5, 7}，编号 0、1、2
接下来跑到哪一句 = main 里收工，程序活着
翻的哪一路车 = ArrayIndexOutOfBoundsException（编号越界）
标准输出 = 5 ／ 越界了 ／ 元素收好了
```

**把这三拍的顺序记住**：越界那一句翻车 → `try` 里排在它**后面**的句子全跳过 → 车往外弹到 `catch`、名字对上才接住 → 不管翻没翻，`finally` 都跑。屏幕上那三行，就是这么一句一句走出来的。

那要是**只写 `finally`、不写 `catch`** 呢？我们试过：

```java
public class Main {
    public static void main(String[] args) {
        try {
            System.out.println(10 / 0);
        } finally {
            System.out.println("元素收好了");
        }
    }
}
```

```text
元素收好了
Exception in thread "main" java.lang.ArithmeticException: / by zero
	at Main.main(Main.java:4)
```

`finally` 照样跑了（收元素的活儿没落下），可**没人接住这一路车** —— 程序最后还是断气了。想让程序活着把活干完，`catch` 那一块不能省。

## 六、接错了路：翻车还是翻

`catch` 括号里写的名字，必须是**它真翻的那一路**：

```java
public class Main {
    public static void main(String[] args) {
        try {
            System.out.println(10 / 0);
        } catch (NumberFormatException e) {
            System.out.println("这串字变不成数字");
        }
        System.out.println("这句跑不到了");
    }
}
```

```text
Exception in thread "main" java.lang.ArithmeticException: / by zero
	at Main.main(Main.java:4)
```

我们守着「一串字变不成数」那一路（`NumberFormatException`），可翻的是「算不成」那一路（`ArithmeticException`）—— **车不认这块名称，照样断气**。连 `catch` 里那句「这串字变不成数字」和最后那句「这句跑不到了」都没印出来，一眼就能看出是「接错了路」而不是「没接」。

**看到自己的程序还是断气、而 `catch` 里的活儿一句没干，第一个要查的就是：括号里的名字是不是它真翻的那一路。** 拿不准的时候，看断气那行字写的是什么 —— 那上面就是这一路车真正的名字。

## 七、兜底那张大网（先知道有这回事）

`catch` 括号里还能写一个「大网」的名字 —— 所有路子的翻车它都接：

```java
public class Main {
    public static void main(String[] args) {
        try {
            System.out.println(10 / 0);
        } catch (Exception e) {
            System.out.println("不管翻的哪一路车，我们都接住了");
        }
        System.out.println("继续记账");
    }
}
```

```text
不管翻的哪一路车，我们都接住了
继续记账
```

网是大，可它有个坏处：**接住之后我们不知道翻的是哪一路**，也就没法对着某一路上心的活儿单独补救。初学阶段我们的建议是：**先老老实实写明是哪一路**（`ArithmeticException` 这种），实在拿不准再用这张大网兜底。

## 一句话对照表

| 我们写下的 | 它干了什么 |
|---|---|
| 没人管（不写 `try`） | 一翻车就**当场断气**，后面的句子全不跑 |
| `try { ... }` | 把没底的活儿放进来盯着；哪句翻了车，**后面**的句子就跳过 |
| `catch (ArithmeticException e) { ... }` | 翻的是**这一路**就接住，接住之后接着往下跑 |
| `e.getMessage()` | 翻车递过来的字条，写着为什么翻 |
| 光写 `e` | 印出**一行**「名字 + 字条」，没有出事地点（想看地点用 `e.printStackTrace()`） |
| `finally { ... }` | 不管翻没翻车都要干的那几句（收元素、关账） |
| 只有 `finally` 没有 `catch` | 收尾干了，但没人接住 → **还是断气** |
| `catch` 里写错那一路的名字 | 接不住 → **还是断气**，`catch` 里的活儿一句不干 |
| `catch (Exception e)` | 兜底的大网，什么路子都接 —— 代价是分不清翻的哪一路 |

::: tip 提示
今天记住四句话：

1. **翻车不可怕，断气才可怕**：不接住的话，程序当场撂挑子，后面的账全不记了。
2. **`try` 里放没底的活儿，`catch` 里写明「翻的是哪一路、怎么办」** —— 名字对得上才接得住。
3. **`try` 里翻了车，它后面的句子会跳过**；想让收尾的活儿无论如何都干，就放进 `finally`。
4. **看报错那行字就知道翻的是哪一路**（`ArithmeticException`、`NumberFormatException`……），拿它去写 `catch` 的括号。
:::

::: warn 注意
三个最容易摔的地方：

- **`catch` 里写错名字**：程序照样断气，而且 `catch` 里的活儿一句没干 —— 别以为写了 `catch` 就万事大吉。
- **`try` 里翻车后剩下的句子不会跑**：我们见过有人把「该干的活儿」写在可能翻车那行的后面，翻一次就整段跳过。
- **别拿大网当习惯**：`catch (Exception e)` 一写，翻哪一路都看不出来了，后面想单独补救都没处下手。
:::

## 小任务

1. 把第一节那段抄进练习场跑一遍，把断气那三行原话记在记录表上；再把 `cats` 改成 `1` 跑一遍，看看这次顺到什么程度。
2. 给第一节那段加上 `try` / `catch (ArithmeticException e)`：`catch` 里印一句「我们知道除数不能是 0 」，跑一遍看看能不能把剩下那句「这句跑不到了」救回来。
3. 写一段自己会翻车的活儿（比如 `Integer.parseInt("字")`），`catch` 里印 `e.getMessage()`，看看那张字条上写了什么。
4. 拿第五节那段，把 `finally` 里那句挪到 `try` 的**最后一句**，再跑一遍 —— 想想为什么这次「元素收好了」没印出来（提示：`bowls[3]` 翻车之后，`try` 里后面的句子会怎样）。
5. 故意接错路：拿第六节那段，把 `catch` 括号里的名字换成 `ArithmeticException`，跑一遍 —— 那句「这句跑不到了」这次印出来了吗？为什么？

到这儿，我们的 Java 第一段路就走完了：从第一次「你好，！」到今天的接住翻车，名称和方法、类定义和实例、一圈一圈和一排一排的元素，我们都摸过一遍了。下一课我们要把这些攒起来，做一件**真家伙** —— 一个能在控制台上算账的计算器 
