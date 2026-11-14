---
id: java-stage3-04
lang: java
stage: 3
order: 8
title: Stream 流式编程
tags: [Stream, 流水线, 惰性]
required: ["java-stage3-03"]
crossRefs: []
estMinutes: 28
keywords: [stream, filter, map, collect, lazy]
---

## 学习目标

本课学习Stream 流式编程。重点包括Stream 创建、map/filter、collect、惰性求值直觉。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、一条线从哪来：从柜子头上接出来

```java
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>();
        nums.add(3);
        nums.add(8);
        nums.add(1);
        nums.add(9);
        nums.add(4);

        List<Integer> big = nums.stream()
                .filter(n -> n >= 5)
                .map(n -> n * 10)
                .collect(Collectors.toList());

        System.out.println(big);
    }
}
```

```text
[80, 90]
```

一句一句念：

- **`.stream()`** —— 读作「从这个柜子**头上接一条线出来**」。注意它**不是在柜子上动手**，原柜子从头到尾一件都没变；
- **`.filter(n -> n >= 5)`** —— **过筛子**：只让够得上 5 的过去；
- **`.map(n -> n * 10)`** —— **加工**：过去的每一件都翻十倍；
- **`.collect(Collectors.toList())`** —— **收起来**：把流过来的一件件收成**一个新柜子**，返回。

每一道都**挂在上一道后面**，一路接着往下写。最后我们**伸手接住了**返回的那个新柜子（用一个新柜子把它装起来），再印出来就是 `[80, 90]`：原来那五件里够得上 5 的是 8 和 9，翻十倍就是 80 和 90 。

这条线**是怎么流的**？我们拆成一步一步，走给你看 —— 柜子里本来就保存 `3`、`8`、`1`、`9`、`4` 五件：

```demo
title: 五件东西一件一件流过这条线
code:
| List<Integer> big = nums.stream()
|         .filter(n -> n >= 5)
|         .map(n -> n * 10)
|         .collect(Collectors.toList());
| System.out.println(big);

step 从柜子头上接一条线出来
at: 1
say: `nums.stream()` 是从这个柜子**头上接一条线出来**。注意它**不在柜子上动手** —— 原柜子里那五件从头到尾一件都不少，这条线只是接在它头上。
meow: stream() 不会修改原列表。
pose: expect
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = （还没开始流）
够 5 吗 = （还没问）
新柜子里 = （空）

step 头一件 3：筛子把它挡下
at: 2
say: 头一件 `3` 顺着线流到**过筛子**这一站：`3 >= 5` 不成立，**挡下**。被挡下的东西**一步都不会再往下走** —— 它不会去加工，也不会进新柜子。
meow: 3 不满足条件，被过滤。
pose: busy
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = 3（被挡下）
够 5 吗 = 不成立
新柜子里 = （空）

step 第 2 步
at: 2
say: 下一件 `8` 流到筛子：`8 >= 5` 成立，**放过去**。它马上往下一站走 —— 注意是**这一件先走完自己的一趟**，线才回头去接下一件。
meow: 8 通过过滤。
pose: busy
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = 8（过筛子了）
够 5 吗 = 成立
新柜子里 = （空）

step 第 8 步
at: 3
say: `8` 接着流到**加工**这一站：`n * 10` 把它翻十倍，变成 `80`。中间**没有停在任何地方** —— 过完筛子马上加工，一站接着一站。
meow: 8 乘 10 得 80。
pose: busy
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = 8（翻十倍 → 80）
够 5 吗 = 成立
新柜子里 = （空）

step 第 80 步
at: 4
say: `80` 流到最后那一站**收起来**，落进一个**新柜子**。到这儿，头一件东西才算走完这条线的全程。
meow: 80 收集到新列表。
pose: yay
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = 80（走完全程了）
够 5 吗 = 成立
新柜子里 = 80

step 第 3 步
at: 2
say: 线回头接第 3 件：`1` 流到筛子 —— 不够 5，同样**挡下**，一步都没往下走。到这儿能看出来：筛子那一站**每一件都要过**，过不去的当场退场。
meow: 1 被过滤。
pose: think
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = 1（被挡下）
够 5 吗 = 不成立
新柜子里 = 80

step 第 4 步
at: 2
say: 第 4 件 `9` 够得上 5，放过去，接着往加工那一站走。
meow: 9 通过过滤。
pose: busy
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = 9（过筛子了）
够 5 吗 = 成立
新柜子里 = 80

step 第 9 步
at: 3
say: `9` 在加工那一站翻十倍，变成 `90`。**同一站活儿，每件东西各走各的一趟** —— 没有「先把所有件都过完筛子、再统一加工」这回事。
meow: 9 乘 10 得 90。
pose: busy
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = 9（翻十倍 → 90）
够 5 吗 = 成立
新柜子里 = 80

step 第 90 步
at: 4
say: `90` 收进新柜子，柜子里现在有 `80`、`90` 两件。
meow: 90 收集到新列表。
pose: yay
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = 90（走完全程了）
够 5 吗 = 成立
新柜子里 = 80 90

step 最后一件 4：挡下，线走到头
at: 2
say: 最后一件 `4` 流到筛子：不够 5，挡下。柜子里的东西接完了，这条线也走到头 —— **一共只有 8 和 9 两件走完了全程**。
meow: 4 被过滤，流结束。
pose: think
原柜子里 = 3 8 1 9 4
正在流过去的那一件 = 4（被挡下）
够 5 吗 = 不成立
新柜子里 = 80 90

step 把新柜子印出来
at: 5
say: `System.out.println(big)` 印出来是 `[80, 90]`。回头再看一眼原柜子 —— **还是 `3 8 1 9 4`，一件都没少**。
meow: 输出 [80, 90]，原列表不变。
pose: proud
原柜子里 = 3 8 1 9 4（一件都没少）
正在流过去的那一件 = （流完了）
够 5 吗 = （问完了）
新柜子里 = 80 90
```

**一件东西，一站接着一站走完全程**；中途不在任何地方落脚，被筛子挡下的那几件一步都不往下走。这就是流水线和「挨个过一遍」最不一样的地方。

## 二、中间那几道挂上去的时候，一件都还没动

这条线有个很特别的脾气，得单独讲：

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>();
        nums.add(1);
        nums.add(2);
        nums.add(3);

        nums.stream().map(n -> {
            System.out.println("被加工了 " + n);
            return n * 2;
        });

        System.out.println("没挂收尾那一道，中间这几道一道都没跑");
    }
}
```

```text
没挂收尾那一道，中间这几道一道都没跑
```

那句「被加工了」**一次都没印出来**。

道理是这样：中间那两道（过筛子、加工）写下去的时候，**只是把「要做什么」登记在这条线身上** —— 一件东西都不会真的过。非得挂上**收尾那一道**（`collect`、`count`、`sum` 这种**要给你吐出点结果**的），前面登记的才真的动起来跑一遍。

所以这条线可以这么理解：**中间几道是记账，收尾那一道才是开工。** 没挂收尾，整条线一次不吭 —— 不是坏了，是它还没开工。

这条脾气有个很实在的好处：中间那几道可以放心**一路拼成一长条**，编译器会自己安排哪一道先走、哪几道能顺手合并掉。我们只管把「要做什么」写清楚。

## 三、把结果弄丢了：一个不红、但是错的写法

这条线上最容易踩的一脚，是**收尾那一道返回的东西没伸手接**：

```java
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>();
        nums.add(3);
        nums.add(8);
        nums.add(1);
        nums.add(6);

        nums.stream()
                .filter(n -> n >= 5)
                .map(n -> n * 10)
                .collect(Collectors.toList());

        System.out.println("撑过筛子的：");
    }
}
```

```text
撑过筛子的：
```

它**跑得成功**，一个字红都没有。可印出来**后面空着** —— 我们要的那一串不见了。

要害在：`.collect(...)` 这一手**是要返回东西回来的**（返回一个新柜子）。我们没伸手接，它返回的东西**当场就丢了**，谁也没拿到。于是下一句只能印出一句空话。

这种错**没有错误信息**，只能靠我们自己盯着 —— 跟上一课那句「交出去之后不许再改」不一样，那一种编译器会拦，这一种它**一次不吭**。分清这两类，是这一课最要紧的一件事。

改法就一句话：**伸手接住它**。

```java
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>();
        nums.add(3);
        nums.add(8);
        nums.add(1);
        nums.add(6);

        List<Integer> big = nums.stream()
                .filter(n -> n >= 5)
                .map(n -> n * 10)
                .collect(Collectors.toList());

        System.out.println("撑过筛子的：" + big);
    }
}
```

```text
撑过筛子的：[80, 60]
```

返回的东西被一个新柜子接住了，再拼到印的那句后面，那串就出来了。今天这一脚踩下去**不红不响**，只让我们少看见一串东西 —— 所以养成一个习惯：**收尾那一道写完，先看一眼它返回的东西被谁接住了。**

## 四、两笔小账：不另起绕圈也能算

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>();
        nums.add(3);
        nums.add(8);
        nums.add(1);
        nums.add(9);
        nums.add(4);

        long count = nums.stream().filter(n -> n >= 5).count();
        int sum = nums.stream().mapToInt(n -> n).sum();

        System.out.println("够大的有 " + count + " 件");
        System.out.println("加起来是 " + sum);
    }
}
```

```text
够大的有 2 件
加起来是 25
```

- **`.count()`** 是一道收尾，报的是**流过来几件**；
- **`.mapToInt(n -> n).sum()`** 里，`mapToInt` 是中间那一道（把每一件从「装东西的口袋」换成**光溜溜的整数**），`.sum()` 才是收尾 —— 求和那一手**只认光溜溜的整数**，所以中间必须加那一小截。

有个细节要看出来：这里我们**从原柜子重新接了两次线**（写了两次 `.stream()`）。为什么？因为**收尾那一道一条线只能挂一次，挂完这条线就用过了** —— 想在同一个柜子上算两笔账，就得重新接一条出来。

顺带记一句：这两笔账要是用「挨个过一遍」的写法，我们得自己立两个攒数的小篮子；这里两句话就完了，而且**一个编号都没写**。

## 五、这套写法好在哪：一串儿字符串

```java
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("张三");
        names.add("计算机");
        names.add("李四");

        List<String> longOnes = names.stream()
                .filter(n -> n.length() >= 3)
                .collect(Collectors.toList());

        System.out.println(longOnes);
    }
}
```

```text
[计算机]
```

这串字符串里只有 `计算机` 够得上三个字，所以筛完只剩它。

一路看下来，这条线的好处其实就是**读起来像一句话**：「**从这堆东西里，挑出够大的、每一件翻十倍、收起来**」—— 写下来的顺序**就是**我们脑子里想的顺序。换成「挨个过一遍」，我们得先把绕圈、条件、攒数的小篮子一一摆好，读的人得自己在脑子里把它们还原成一句话。

**代价也说清楚**：线短的时候（就一两道活儿）它并不比绕圈省事，反倒多了一层要理解的东西。三五道活儿串起来的时候，它的好处才真正显出来。

::: warn 注意

- **不挂收尾，整条线一次不吭。** 中间那几道只是登记，一件东西都不动。看着「没反应」不是坏了，是还没开工。
- **收尾返回的东西必须伸手接住。** 常见的收尾是 `collect`、`count`、`sum` 这几个 —— 它们**都给东西**，不接就当场丢了，而且**一个字都不会红**。
- **一条线只能挂一次收尾。** 挂过一次的线再用第二次，**翻译源代码这一关根本不管** —— 编译器只认类型，这条线有没有被用过它看不见。所以是**跑到第二道那儿才炸**：`IllegalStateException: stream has already been operated upon or closed`，而且**第一道的结果早就印出来了**，前面半截活干完了它才翻脸。（反过来，把第二道**直接接在**第一道返回的东西上，比如 `.count().sum()`，编译时确实会红 —— 可那是**类型不对**的红：`count()` 返回的是光溜溜的整数，整数身上没有 `.sum()`，不是它在查你用没用过。）想算两笔账，就写两次 `.stream()` 重新接一条。
- **`.stream()` 不会弄脏原柜子。** 过筛子和加工动的都是**流过去的那些东西**，原柜子从头到尾一件不少 —— 这也是它比直接在路上改更稳的地方。
- **过筛子和加工这两小截里别去动外面的东西。** 上一课那条「交出去之后不许再改」这里照样管用，而且这里更严：这两小截可能会被编译器**挪到别的时候**去跑，动了外面的东西，什么时候动的就说不清了。

:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `.stream()` | 从柜子**头上接一条线出来**（原柜子一件不动） |
| `.filter(n -> n >= 5)` | **过筛子**：只让够得上 5 的过去 |
| `.map(n -> n * 10)` | **加工**：过去的每一件都翻十倍 |
| `.collect(Collectors.toList())` | **收起来**：收成一个新柜子返回 |
| 中间两道挂了、`collect` 没接住 | **跑得成功、一个字不红**，可东西当场丢了 |
| `nums.stream().filter(n -> n >= 5).map(n -> n * 10).collect(Collectors.toList())` | 一整条线连着写下来的样子：接出来 → 过筛子 → 加工 → 收起来 |
| 只写 `.stream().map(...)`、不挂任何收尾 | **一件都不跑**：中间那几道只是在登记 |
| `.count()` | 一道收尾：报**流过来几件** |
| `.mapToInt(n -> n).sum()` | 先换成光溜溜的整数，再求和 |
| 一条线上挂两道收尾 | 挂的时候不红，**跑到第二道才炸**：`IllegalStateException` |
| 同一个柜子算两笔账 | 写两次 `.stream()`，重新接一条线出来 |

::: tip 提示

- **一条线上，中间那几道是记账，收尾那一道才是开工** —— 没挂收尾，整条线一次不吭，不是它坏了。
- **收尾返回的东西必须伸手接住**：不接就当场丢了，而且一个字都不会红 —— 写完先看一眼它被谁接住了。
- **一条线只能挂一次收尾**：想在同一个柜子上算两笔账，就写两次 `.stream()` 重新接一条。
- **`.stream()` 不会弄脏原柜子**：过筛子和加工动的都是流过去的那些东西。
- **线短的时候它并不比绕圈省事** —— 三五道活儿串起来，好处才真正显出来。

:::

## 小任务

1. 把第一节那条线抄进练习场，把过筛子那一句改成「**只要偶数**」（`n % 2 == 0`），先猜结果再跑一遍。
2. 把第二节那个例子**原样跑一遍**，确认那句「被加工了」一次都没印出来；然后给它补一道收尾（`.count()` 就行），再跑一遍，看看印了几行、什么顺序。
3. 第三节那个「丢结果」的例子原样跑一遍，确认它**真的不红**；再把接住的那一句补上，比较两次的输出。
4. 同一道收尾**挂两次**试试：把线接出来在一旁收着（`Stream<String> s = names.stream();`），挂一道 `.count()`，再挂一道 `.count()`。**先猜** —— 是编译时就红，还是先好好印出第一道的结果、再翻脸？跑一遍看谁猜对了，再去注意那一栏核对原因。
5. 用一条线把「柜子里够大的那些加起来」写出来（过筛子 + `.mapToInt` + `.sum`），跟上一课那种自己立小篮子的写法比一比行数。
6. 想一想：为什么「中间几道先登记、收尾才开工」这件事，能让编译器有机会**把好几道活儿合并着跑**？

下一课，我们要处理一件让所有对象都头疼过的事：**要找的东西可能压根不在**。从前这种事只能靠我们心里记着，忘了就是一行错误信息；下一课要把它**写在名分上**，让用的人非交代一句不可 
