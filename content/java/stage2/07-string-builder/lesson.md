---
id: java-stage2-07
lang: java
stage: 2
order: 7
title: String 深入与 StringBuilder
tags: [类型, 字符串, 拼接]
required: ["java-stage2-06"]
crossRefs: []
compare: ["common-13"]
estMinutes: 25
keywords: [String, equals, StringBuilder, append]
---

## 学习目标

本课学习String 深入与 StringBuilder。重点包括字符串池直觉、StringBuilder、拼接性能。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```java
public class Main {
    public static void main(String[] args) {
        String s = "数据";
        String t = s.concat("字");
        System.out.println(s);
        System.out.println(t);
    }
}
```

```text
数据
数据字
```

## 一、字符串是焊死的：想改，只能重新串一条

`String` 创建后之后就**永远不动了**。所谓「改」，其实是**另串一条新的**，原来那条原地不动躺在窝里。这条规矩的正式名字叫「字符串是不可变的」，记住它的两个后果：

1. `s.concat(...)`、`s.toUpperCase(...)`、`s.substring(...)` 这些方法**都不动 `s` 自己**，它们返回一条**新字符串**回来给你。
2. 所以上面那句 `t = s.concat("字")`，其实串了一条新字符串交给 `t`，`s` 还是老样子。

## 二、池子：正文写出来的字符串，住在同一个窝

再看一段**会让零基础学员挠头**的代码：

```java
public class Main {
    public static void main(String[] args) {
        String a = "数据";
        String b = "数据";
        String c = new String("数据");
        System.out.println(a == b);
        System.out.println(a == c);
        System.out.println(a.equals(c));
    }
}
```

```text
true
false
true
```

三行输出：前两行怪，第三行才对得上直觉。原因有两层：

- **`==` 问的是「是不是同一条字符串」**，不是「串上的字一不一样」。`a` 和 `b` 都是我们**直接在源代码上写出来的**同样一段字，编译器很省事：它在自己窝里专门开了一个**配货池**，池子里已经泡着「数据」这条字符串了，就**直接把同一条**递给了 `b`。所以 `a == b` 是 `true` —— 它俩压根是同一条。
- **`c` 是明着调用 `new` 生的**，那就得**另串一条新字符串**，字一样、字符串不一样。所以 `a == c` 是 `false`。
- **`.equals(...)` 问的才是「串上的字一不一样」**，字一样它就是 `true` —— 所以第三行是答案。

::: warn 注意

**比字符串一律用 `.equals(...)`，别用 `==`。** `==` 比的是「是不是同一条」，而两条字符串「字一样、字符串不一样」是家常便饭 —— 从纸条上读进来的、拼出来的、`new` 出来的，统统不是同一条。用 `==` 比字符串，程序**不会报错**，只会安安静静地给你一个 `false`，这种 bug 最难查。

上面那条「`a == b` 恰好是 `true`」，只在**同一段源代码上写出来的两段一样的字**这个特殊情况下成立。别拿特例当规律用。

:::

## 三、字符串上常挂的方法

字符串身上挂着一排现成的方法，认得它们干活就轻松了：

```java
public class Main {
    public static void main(String[] args) {
        String s = "fish";
        String t = "数据结构";
        System.out.println(s.toUpperCase());
        System.out.println(t.length());
        System.out.println(t.charAt(0));
        System.out.println(t.substring(0, 2));
        System.out.println(t.contains("结"));
        System.out.println(t.indexOf("构"));
    }
}
```

```text
FISH
4
数
数据
true
3
```

- **`s.toUpperCase()`** —— 全部变大写。原字符串不动，返回的是新的。
- **`t.length()`** —— 串上**有几颗**数据。注意它是带小括号的方法，后面会见到别家写法写成一个数，别记混。
- **`t.charAt(0)`** —— 摸出**编号 0** 那一颗。**编号从 0 数起**，这条最要紧。
- **`t.substring(0, 2)`** —— 从编号 0 开始剪，剪到**编号 2 之前**（**不含 2**）。所以剪出来是 `数据` 两颗，不是三颗。
- **`t.contains("结")`** —— 串上有没有这一小段。
- **`t.indexOf("构")`** —— 那一小段**从哪个编号开始**；找不到会返回 `-1` 回来（不是报错，是个记号）。

## 四、要拼很多段？换一个「会自己长大的抽屉」

先看这段**两种拼法并排**的代码：

```java
public class Main {
    public static void main(String[] args) {
        String slow = "";
        for (int i = 1; i <= 3; i++) {
            slow = slow + "第" + i + "条 ";
        }
        StringBuilder fast = new StringBuilder();
        for (int i = 1; i <= 3; i++) {
            fast.append("第").append(i).append("条 ");
        }
        System.out.println(slow);
        System.out.println(fast.toString());
        System.out.println(slow.equals(fast.toString()));
    }
}
```

```text
第1条 第2条 第3条 
第1条 第2条 第3条 
true
```

结果**一模一样** —— 最后一行的 `true` 就是证据。既然一样，为什么要多认一个 `StringBuilder`？因为**过程差得远**：

- 上面那种写法，每绕一圈都要**重新串一条新字符串**：`slow + "第"` 串一条、再接 `i` 又串一条…… 三圈下来，窝里躺着一堆**用完就扔的半成品字符串**。
- `StringBuilder` 是一根**会自己长大的抽屉**：创建一个空抽屉，想加就往里塞（`append`），**自始至终只有这一根抽屉**，不产生那堆半成品。

圈数少的时候差别看不出来；**要拼几百上千段**（比如把一整份名单接成一段话）的时候，第一种写法的垃圾会堆成小山。所以记住这条经验：**一次性接两三个，直接 `+` 最舒服；要在一个绕圈的方法里反复接，就换 `StringBuilder`。**

上面这两段并排的写法，我们拆成一步一步走给你看 —— 盯着「窝里的半成品」那一栏数：

```demo
title: 一边每圈重新串一条，一边在同一根抽屉里长
code:
| String slow = "";
| for (int i = 1; i <= 3; i++) {
|     slow = slow + "第" + i + "条 ";
| }
| StringBuilder fast = new StringBuilder();
| for (int i = 1; i <= 3; i++) {
|     fast.append("第").append(i).append("条 ");
| }
| System.out.println(slow);
| System.out.println(fast.toString());

step 先备一条空字符串
at: 1
say: `String slow = "";` 先有一条**空字符串**（一颗字符都没有），交给 `slow`。这条路走的是字符串的老规矩：**它改不了**。
meow: slow 从空字符串开始。
pose: expect
slow 这条字符串 = ""（一条空项链）
fast 这根抽屉 = （还没生）
窝里的半成品 = 0 条

step 第 1 步
at: 3
say: 第 1 圈：`slow + "第"` 这一下**不碰原来那条**，是**另串一条新的**，串完交给 `slow`。原来那条空字符串没人接了，**躺在窝里**成了半成品。
meow: + 创建新字符串，旧的被丢弃。
pose: busy
slow 这条字符串 = "第1条 "（新串的）
fast 这根抽屉 = （还没生）
窝里的半成品 = 1 条

step 第 2 步
at: 3
say: 第 2 圈：老规矩 —— 还是**另串一条**「第1条 第2条 」。上一圈刚串好的那条，这一圈也被丢下了。
meow: 第 2 圈又创建新字符串。
pose: busy
slow 这条字符串 = "第1条 第2条 "（又是新串的）
fast 这根抽屉 = （还没生）
窝里的半成品 = 2 条

step 第 3 步
at: 3
say: 第 3 圈：再串一条「第1条 第2条 第3条 」。三圈跑完，窝里躺着 **3 条用完就扔的半成品字符串** —— 圈数一多，这堆垃圾就堆成小山。
meow: 第 3 圈同样，多次创建。
pose: think
slow 这条字符串 = "第1条 第2条 第3条 "
fast 这根抽屉 = （还没生）
窝里的半成品 = 3 条

step 换一根能自己动的家伙
at: 5
say: 换 `StringBuilder`：`new StringBuilder()` 创建一根**空抽屉**。它不是字符串 —— 字符串是焊死的，抽屉**自己能动**，这是两种东西。
meow: 创建 StringBuilder。
pose: expect
slow 这条字符串 = "第1条 第2条 第3条 "
fast 这根抽屉 = （一根空抽屉）
窝里的半成品 = 3 条

step 第 1 步
at: 7
say: 第 1 圈：`append` 把「第」「1」「条 」塞进**同一根抽屉**，抽屉里变成「第1条 」。是**它自己长了**，没有新东西被创建后 —— 半成品一条都没多。
meow: append 修改同一个对象。
pose: yay
slow 这条字符串 = "第1条 第2条 第3条 "
fast 这根抽屉 = "第1条 "（还是同一根）
窝里的半成品 = 3 条（一条没多）

step 第 2 步
at: 7
say: 第 2 圈：还是**那根抽屉**，里子原地长长一截。看清楚：这一圈**没有生任何新东西**，只是同一根里的字符多了几颗。
meow: 第 2 圈仍是同一个对象。
pose: yay
slow 这条字符串 = "第1条 第2条 第3条 "
fast 这根抽屉 = "第1条 第2条 "（还是同一根）
窝里的半成品 = 3 条

step 第 3 步
at: 7
say: 第 3 圈：同一根抽屉再长一截。三圈下来，抽屉**自始至终就是一开始那一根** —— 这就是它省力气的地方。
meow: 第 3 圈结束，只有一个对象。
pose: yay
slow 这条字符串 = "第1条 第2条 第3条 "
fast 这根抽屉 = "第1条 第2条 第3条 "（还是同一根）
窝里的半成品 = 3 条

step 倒出来对一对：结果一样
at: 10
say: `slow` 和 `fast.toString()` 倒出来的是**一模一样**的整串（课文里那句 `slow.equals(...)` 印的正是 `true`）。**结果一样，过程差远了**：一边扔了 3 条半成品，一边一根抽屉用到头。
meow: 两种方式结果相同。
pose: proud
slow 这条字符串 = "第1条 第2条 第3条 "
StringBuilder fast 转换为字符串 = "第1条 第2条 第3条 "
窝里的半成品 = 3 条（全是上面那条路扔的）
```

所以那条经验要连着两件事记：**字符串是焊死的**（每接一次都另串一条，旧的当场成垃圾），**抽屉是能改的**（所有 `append` 都落在同一根上）。绕圈里反复接就换抽屉；只接两三个，直接 `+` 反而更省事。

抽屉自己也有常用的方法：

```java
public class Main {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();
        sb.append("数据");
        sb.append("结构");
        System.out.println(sb.toString());
        System.out.println(sb.length());
        sb.insert(0, "当前记录");
        System.out.println(sb);
        sb.reverse();
        System.out.println(sb);
    }
}
```

```text
数据结构
4
当前记录数据结构
构结据数录记前当
```

- **`sb.append("...")`** —— 往抽屉里塞一段。
- **`sb.toString()`** —— 把抽屉里攒的东西**倒出来成一条字符串**。字符串和抽屉是两种东西，倒出来之后才能交给只收字符串的地方。
- **`sb.insert(0, "当前记录")`** —— 插在**编号 0** 那个位置。
- **`sb.reverse()`** —— 整根倒过来。
- 和字符串不同，**这些方法改的是抽屉自己**，不产生新的抽屉。

## 五、编号从 0 起，数过了当场炸

```java
public class Main {
    public static void main(String[] args) {
        String s = "数据结构";
        System.out.println(s.length());
        System.out.println(s.charAt(4));
    }
}
```

```text
Exception in thread "main" java.lang.StringIndexOutOfBoundsException: Index 4 out of bounds for length 4
```

念起来是：**「你摸的是编号 4，可这条字符串总共才 4 颗（编号只到 3）。」** 四颗数据的编号是 0、1、2、3 —— 所以能摸到的最大编号是 `length() - 1`。`charAt` 数过了不会给你 `null`，也不给你 `-1`，它**当场炸**。

::: tip 提示

1. **字符串焊死了**：所有「改」的方法都返回**新字符串**，原来那条一个字不动。
2. **比字用 `.equals(...)`**，`==` 比的是「是不是同一条」—— 这个坑不报错、只给假答案，最阴。
3. **编号从 0 起**：`charAt` / `substring` 都按这个规矩，能摸到的最大编号是 `length() - 1`。
4. **拼两三个用 `+`，绕圈里反复拼用 `StringBuilder`** —— 后者的方法和抽屉一样，改的是它自己。

:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `s = "数据";` | 从配货池里拿一条（写出来的同样字共用一条） |
| `new String("数据")` | 另串一条新的，字一样、字符串不一样 |
| `a.equals(c)` | 比**串上的字**一不一样（正确的比法） |
| `a == c` | 比**是不是同一条字符串** —— 不是！ |
| `s.toUpperCase()` / `s.substring(0, 2)` | 返回一条**新**字符串，`s` 自己不动 |
| `t.length()` | 串上有几颗 |
| `t.charAt(0)` | 摸编号 0 那一颗（编号从 0 起） |
| `t.substring(0, 2)` | 剪 [0, 2) —— 不含编号 2 |
| `t.indexOf("构")` | 从哪个编号开始；找不到给 `-1` |
| `slow = slow + "第" + i` | 每圈重新串一条，绕圈多了会堆一堆半成品 |
| `sb.append(...)` / `sb.toString()` | 往抽屉里塞 / 把抽屉倒成一条字符串 |
| `t.charAt(4)`（`t` 只有 4 颗） | 数过了 → 当场炸 `StringIndexOutOfBoundsException` |

## 小任务

1. 把第二节那段抄进练习场，把 `String c = new String("数据");` 改成 `String c = "数据";`，看看 `a == c` 变成什么 —— 体会一下「配货池」这条规矩。
2. 改一改第三节的例子：把 `t.substring(0, 2)` 换成 `t.substring(2, 4)`，先猜猜剪出来是哪几颗，再跑一遍对答案。
3. 把第五节的 `s.charAt(4)` 换成 `s.charAt(3)`，看看错误信息是不是消失了；再换成 `s.charAt(-1)` 试试 —— 猜猜编译器会说什么。
4. 第四节那段两种拼法，把绕圈次数从 `3` 改成 `1000`，各跑一遍感受一下（我们提醒：这点规模两种写法都还很快，差别要更大规模才看得出来，所以**记住的是那条经验，不是这次的秒数**）。

下一课，我们要教你**一排会自己排队的数组元素**：不用事先钉死元素的数量，想加几元素加几元素，还能按编号随手抽一元素出来 —— 以及，什么时候该换另一种排法 
