---
id: java-stage1-08
lang: java
stage: 1
order: 11
title: 数组
tags: [数组, 下标, 长度, for-each]
required: [java-stage1-07]
crossRefs: []
estMinutes: 25
keywords: [数组, length, 下标, for-each]
---

## 学习目标

本课学习数组。重点包括数组创建、遍历、多维、Arrays 工具初识。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 摆一排元素

```java
public class Main {
    public static void main(String[] args) {
        int[] bowls = {3, 5, 7};
        System.out.println(bowls[0]);
        System.out.println(bowls[2]);
        System.out.println(bowls.length);
    }
}
```

```text
3
7
3
```

一行 `int[] bowls = {3, 5, 7};`，三个新记号，我们一个一个说：

- **`int[]`** —— `int` 后面跟的那对**方括号**，就是「一排」的记号：这一排元素里装的**都是整数**。
- **`{3, 5, 7}`** —— 一排摆三个元素，里面分别装 3、5、7，用**逗号**隔开。摆好之后这一排的**元素数就定死了**，不长也不短。
- **`bowls[0]`** —— 用方括号加编号，取出其中一个元素。`bowls[0]` 是 `3`，`bowls[2]` 是 `7`。
- **`bowls.length`** —— 这一排有几个元素。三个元素，所以印出 `3`。

| 元素 | 编号 | 怎么念 | 里面保存的是 |
|---|---|---|---|
| 第 1 只 | `0` | `bowls[0]` | `3` |
| 第 2 只 | `1` | `bowls[1]` | `5` |
| 第 3 只 | `2` | `bowls[2]` | `7` |

### 编号从 0 数起

这一条要念三遍：**第一个元素的编号是 `0`，不是 `1`**。三个元素的编号是 `0`、`1`、`2`，所以**最后一个元素的编号永远是「元素数减一」**：3 只元素，最后一个是 `2` 号。上一课绕圈时我们为什么老是从 `0` 摆名称？就是为今天铺的路——**编号天生就从 0 开始**，绕圈看一排元素的时候正好一个不落。

::: warn 注意
`bowls[3]` 这种写法**编译器不拦**：它只管你方括号里写的是不是整数，不管你报的编号有没有那个元素。真正的检查发生在**跑起来的时候**——报了个不存在的编号，程序当场炸给你看。我们把现场留在下面「拿错料会怎样」那一节。
:::

## 三种摆法

**第一种：摆的时候就装好**——就是上面那种 `{3, 5, 7}`。

**第二种：先摆空元素，回头再往里放**：

```java
public class Main {
    public static void main(String[] args) {
        int[] empty = new int[3];
        empty[1] = 5;
        System.out.println(empty[0]);
        System.out.println(empty[1]);
    }
}
```

```text
0
5
```

`new int[3]` 的意思是「给我们摆一排 3 只空元素」——**空元素不空**：装整数的元素一律先垫上一个 `0`（这就是为什么 `empty[0]` 印出 `0`）。然后我们往 `1` 号元素里放了 `5`，它才变成 `5`。上一课那种「先摆一块名称做起点、后面一圈圈往里攒」的路子，换成这一排元素就是这种写法。

**第三种：元素里装的不是数，是别的料**——类型跟着换就行：

```java
public class Main {
    public static void main(String[] args) {
        String[] names = {"张三", "李四"};
        System.out.println(names[1]);
    }
}
```

```text
李四
```

一排元素里装的东西**必须是同一个类型**：整数元素就全是整数，字符串元素就全是字符串。`String[]` 就是「一排装字符串的元素」，`names[1]` 取到第二只元素，里面是「李四」。想一排里既装数又装字符串？我们做不到——**一排元素只认一种料**，这是 Java 的铁脾气。

## 换一个元素里的东西

编号不光能读，还能**往里放**：

```java
public class Main {
    public static void main(String[] args) {
        int[] bowls = {4, 8, 6};
        bowls[1] = 2;
        System.out.println(bowls[1]);
    }
}
```

```text
2
```

`bowls[1] = 2;` 把 1 号元素里的 `8` 倒掉、换成 `2`。这一排还是三个元素（`bowls.length` 照样是 `3`），只是其中一个元素换了内容——**元素数定死，元素里的东西可以换**，这两件事分得清清楚楚。

## `.length`：一排有几个元素，**没有小括号**

上一课学字符串的时候，问「这串字多长」写的是 `.length()`——**带一对小括号**。而今天问一排元素有几个，写的是 `.length`——**光秃秃的，不带小括号**。同是问长度，两边的写法不一样，这是 Java 里最爱绊人的一处不一致，我们特意把它撞给你看：

```java
public class Main {
    public static void main(String[] args) {
        int[] bowls = {3, 5, 7};
        System.out.println(bowls.length());
    }
}
```

```text
Main.java:4: error: cannot find symbol
        System.out.println(bowls.length());
                                ^
  symbol:   method length()
  location: variable bowls of type int[]
1 error
```

翻译过来是：**「`bowls` 身上没有这么个带括号的 `length()` 。」** 一排元素身上挂着的那个叫 `length`，是个**光秃秃的数**，不是要你调用一次才给的活儿。记法一句话：

- **一排元素**：`bowls.length`（没括号）
- **一串字符串**：`word.length()`（有括号）

写错了不用慌——编译器会当场拦下，不会让你带着错往下跑。

## 用绕圈一个一个看过去

一排元素最大的好处，是**配上绕圈**：上一课的 `for` 今天终于找到了最好的搭子。

```java
public class Main {
    public static void main(String[] args) {
        int[] bowls = {3, 5, 7};

        for (int i = 0; i < bowls.length; i++) {
            System.out.println(i + " 号元素里有 " + bowls[i] + " 条");
        }

        int total = 0;
        for (int n : bowls) {
            total = total + n;
        }
        System.out.println(total);
    }
}
```

```text
0 号元素里有 3 条
1 号元素里有 5 条
2 号元素里有 7 条
15
```

第一个圈子就是「从 0 号走到最后一号」的标准走法，眼色那儿藏着今天最重要的一个习惯：

- **`i < bowls.length`** —— 我们**没有把 `3` 写死**，而是问「还有下一个元素吗」。元素多了少了，这一行都不用改，圈子自动跟着走。
- **`i` 从 `0` 摆起**，正好就是第一个元素的编号——上一课那个「从 0 摆名称」的规矩，在这儿成了天造地设的一对。
- 圈里用 `bowls[i]` 取当前这个元素，印一句「几号元素里有几条」。

| 圈次 | `i` | 眼色 `i < bowls.length` | `bowls[i]` | 印出 |
|---|---|---|---|---|
| 第 1 圈 | `0` | `0 < 3` 真 | `bowls[0]` = `3` | 0 号元素里有 3 条 |
| 第 2 圈 | `1` | `1 < 3` 真 | `bowls[1]` = `5` | 1 号元素里有 5 条 |
| 第 3 圈 | `2` | `2 < 3` 真 | `bowls[2]` = `7` | 2 号元素里有 7 条 |
| 再来 | `3` | `3 < 3` **假 → 收工** | 不出场 | —— |

上面这段有两种圈子，我们把两种都放慢走一遍 —— 先看报编号那一种，再看只要元素里东西的那一种。

```demo
title: 一排元素的两种走法：报编号 vs 逐个过一遍
code:
| int[] bowls = {3, 5, 7};
| for (int i = 0; i < bowls.length; i++) {
|     System.out.println(i + " 号元素里有 " + bowls[i] + " 条");
| }
| int total = 0;
| for (int n : bowls) {
|     total = total + n;
| }
| System.out.println(total);

step 摆一排三个元素
at: 1
say: 三个元素标着编号 0、1、2，元素里分别是 3、5、7 条。这一排摆好就定死了，不长也不短。
meow: 数组长度固定为 3。
pose: expect
i = 还没轮到
n = 还没轮到
这一圈拿到 = 还没伸手
total = 还没洗
印出来 = 还没印

step 第 1 步
at: 2
say: i 从 0 摆起。0 < bowls.length 成立，进圈。注意我们没把 3 写死 —— 问的是「还有下一个元素吗」。
meow: i = 0，小于 length。
pose: expect
i = 0
n = 还没轮到
这一圈拿到 = 还没伸手
total = 还没洗
印出来 = 还没印

step 第 1 步
at: 3
say: i 是编号，bowls[i] 是那个元素里的货。这一行印出「0 号元素里有 3 条」。
meow: 输出 0 号元素：3。
pose: yay
i = 0
n = 还没轮到
这一圈拿到 = bowls[0] = 3
total = 还没洗
印出来 = 0 号元素里有 3 条

step 第 2 步
at: 2
say: 回到 for，i 加一变成 1。1 < 3 还是成立，接着进圈。
meow: i = 1，继续。
pose: expect
i = 1
n = 还没轮到
这一圈拿到 = bowls[0] = 3
total = 还没洗
印出来 = 0 号元素里有 3 条

step 第 2 步
at: 3
say: i 是 1，取的是 bowls[1] = 5。印出「1 号元素里有 5 条」。
meow: 输出 1 号元素：5。
pose: yay
i = 1
n = 还没轮到
这一圈拿到 = bowls[1] = 5
total = 还没洗
印出来 = 1 号元素里有 5 条

step 第 3 步
at: 2
say: i 变成 2，2 < 3 成立 —— 这是最后一个元素了。
meow: i = 2，最后一个。
pose: expect
i = 2
n = 还没轮到
这一圈拿到 = bowls[1] = 5
total = 还没洗
印出来 = 1 号元素里有 5 条

step 第 3 步
at: 3
say: bowls[2] = 7，印出「2 号元素里有 7 条」。三个元素全走完了。
meow: 输出 2 号元素：7。
pose: yay
i = 2
n = 还没轮到
这一圈拿到 = bowls[2] = 7
total = 还没洗
印出来 = 2 号元素里有 7 条

step 再判断一次 —— 这次进不去了
at: 2
say: i 加一变成 3，3 < 3 不成立，圈收工。眼色要是写成 i <= bowls.length，这一圈就会去摸 bowls[3] —— 跑起来当场炸。
meow: i = 3，循环结束。
pose: proud
i = 3
n = 还没轮到
这一圈拿到 = bowls[2] = 7
total = 还没洗
印出来 = 2 号元素里有 7 条

step 换个圈子：先把小元素洗成 0
at: 5
say: 第二个圈子不要编号，只要元素里的货。total 先洗成 0，接下来一路把三个元素里的东西攒进来。
meow: total 从 0 开始累加。
pose: busy
i = 3
n = 还没轮到
这一圈拿到 = 还没伸手
total = 0
印出来 = 2 号元素里有 7 条

step 第 1 步
at: 6
say: for (int n : bowls) 从头一个开始，把元素里的货端给 n。这一圈 n 是 3，total 从 0 变成 3。
meow: 增强 for：n 是 3，total 是 3。
pose: yay
i = 3
n = 3
这一圈拿到 = bowls[0] = 3
total = 3
印出来 = 2 号元素里有 7 条

step 第 2 步
at: 6
say: 第二圈 n 自动换成第二只元素里的 5，total 变成 8。这个写法不用管编号，也数不错。
meow: n 是 5，total 是 8。
pose: yay
i = 3
n = 5
这一圈拿到 = bowls[1] = 5
total = 8
印出来 = 2 号元素里有 7 条

step 第 3 步
at: 6
say: 第三圈 n 是 7，total 变成 15。三个元素的货全攒完了。
meow: n 是 7，total 是 15。
pose: yay
i = 3
n = 7
这一圈拿到 = bowls[2] = 7
total = 15
印出来 = 2 号元素里有 7 条

step 格子走完，圈自己停下
at: 6
say: 这一个圈子没有「i < 几」要我们判断 —— 元素里的货走光了它就自己停，比报编号省事。
meow: 元素取完，循环自动结束。
pose: proud
i = 3
n = 7
这一圈拿到 = bowls[2] = 7
total = 15
印出来 = 2 号元素里有 7 条

step 把总数输出
at: 8
say: 印的是 total，不是某一个元素 —— 屏幕上出现的是攒了三圈的总数：15。
meow: 输出总和 15。
pose: milestone
i = 3
n = 7
这一圈拿到 = bowls[2] = 7
total = 15
印出来 = 15
```

### 只看元素里的东西：`for (int n : bowls)`

第二个圈子的写法已经在上面的代码里了：**`for (int n : bowls)`**——小括号里用**冒号**把「名称」和「一排元素」隔开，圈里那句求和就是它的全部用法。

念法是：**「把 `bowls` 这一排里的每一样，挨个拿给 `n` 看一遍」**。它一次把一个元素里的东西端出来放进 `n`，看完全排就收工——上面那个求和就是这么走的：`3`、`8`、`15`，最后印出 `15`。

两种圈子怎么挑，我们的土规矩是：

- **要编号**（比如想印「几号元素」、想改某只元素里的东西）→ 用 `for (int i = 0; i < bowls.length; i++)`，因为 `i` 就是编号。
- **只要元素里的东西**（比如求和、看一遍有没有数据）→ 用 `for (int n : bowls)`，少写一堆括号，也不会手滑写错编号。

## 一排元素里还能摆元素

一排元素的每一个元素里，还能再摆一排小元素——像商品盒里分了格子：

```java
public class Main {
    public static void main(String[] args) {
        int[][] grid = {
            {1, 2},
            {3, 4}
        };
        System.out.println(grid[1][0]);
        System.out.println(grid.length);
        System.out.println(grid[0].length);
    }
}
```

```text
3
2
2
```

- **`int[][]`** 是两个方括号：「一排元素，每个元素里还摆着一排小元素」。
- **`grid[1][0]`** 是两层编号：先找 1 号那个大元素，再找它里面 0 号小元素——里面保存的是 `3`。**方括号里的编号从左往右一层层往里走**。
- **`grid.length`** 数的是**外层**有几个大元素，是 `2`。
- **`grid[0].length`** 是「0 号大元素里面那排有几个小元素」，也是 `2`。

上一课的「圈里套圈」，今天也就有了新活儿：外面一圈走大元素，里面一圈走小元素——**外圈管第几排，内圈管这一排第几个**，跟上一课发数据的排法一模一样。

## 拿错料会怎样

**第一种：报了个不存在的编号。** 一排就三个元素（编号 `0`、`1`、`2`），我们非要去端 `3` 号：

```java
public class Main {
    public static void main(String[] args) {
        int[] bowls = {3, 5, 7};
        System.out.println(bowls[3]);
    }
}
```

```text
Exception in thread "main" java.lang.ArrayIndexOutOfBoundsException: Index 3 out of bounds for length 3
```

这一句念起来是：**「编号 `3` 越界了，这一排只有 3 只元素。」** 要命的是：**编译器编译的时候一句话都不说**，程序照样能编好；非得跑到那一行，它才当场炸掉，后面的活儿全都不干了。上一课那个「圈子多跑一圈」的眼色 `i <= bowls.length`，就是踩这个雷的经典姿势——**眼色写 `i < bowls.length` 才安全**。

**第二种：给 `.length` 添了小括号。** 这个反倒不危险，编译器当场拦住（前面那一节已经真跑给你看过了）。两个错放在一起记最省事：

| 我们写的 | 什么时候出问题 | 出什么样 |
|---|---|---|
| `bowls[3]`（编号越界） | **跑起来才炸** | 一句 `ArrayIndexOutOfBoundsException`，程序当场停下 |
| `bowls.length()`（多了括号） | **编译当场拦** | `cannot find symbol: method length()` |

## 别直接印一整排元素

有只子对象试过 `System.out.println(bowls);`，想看整排元素——屏幕上印出来的是一串 `[I@` 开头的怪字符（后头还跟着一串每次跑都可能不一样的符号），**不是元素里的东西**。Java 在这儿不帮我们翻译，它只告诉你「这是一排整数」。

想看整排，就**用圈子一个一个看过去**（上一节那种走法）——这也是我们往后天天要用的办法：**一排元素配绕圈，天创建一对**。

::: tip 提示
今天记住这五句话：

1. **`int[] bowls = {3, 5, 7};`** —— 类型后面加方括号就是「一排」，大括号里是元素里的东西，逗号隔开。
2. **编号从 `0` 数起**，最后一个是「元素数减一」；`new int[3]` 摆空元素，整数空元素里先垫着 `0`。
3. **一排元素 `.length` 不带括号**，一串字符串 `.length()` 带括号——同是问长度，写法不一样。
4. **绕圈看整排**：要编号用 `for (int i = 0; i < bowls.length; i++)`，要元素里的东西用 `for (int n : bowls)`。
5. **编号越界是跑起来才炸的**——眼色永远写 `i < bowls.length`，别写死数字，也别写 `<=`。
:::

## 小任务

1. 把第一段抄进练习场，把 `bowls[0]` 改成 `bowls[1]`、`bowls[2]` 改成 `bowls.length`，看看屏幕上换成什么。
2. 把 `{3, 5, 7}` 改成 `{3, 5, 7, 9}`，跑一遍——`bowls.length` 变成几？绕圈看整排那段要不要改一个字？（提示：一个字都不用改。）
3. 把绕圈看整排那段的眼色从 `i < bowls.length` 改成 `i <= bowls.length`，跑一遍，把屏幕上那句炸出来的话抄给记录表（这就是昨天踩过的雷嘛）。
4. 写一排 5 只元素的整数，用圈子把里面的数**加起来**印出来；再写一个圈子找出**最大的那个**（提示：先摆一块名称记「目前最大的」，每圈比一次，比它大就换掉）。
5. 给「一排元素里还能摆元素」那段加一句 `grid[0][1]`，猜一猜是几，再跑一遍对照。

下一课，我们要把「一套动作」打包起来**起个名字**，往后使用变量名它就替我们干活——Java 里的自定义方法（方法），而且有个挺讲究的规矩：**它必须住在类里**。去「方法」探险 
