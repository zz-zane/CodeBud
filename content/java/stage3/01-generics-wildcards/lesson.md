---
id: java-stage3-01
lang: java
stage: 3
order: 2
title: 泛型深入与通配符
tags: [泛型, 通配符, 边界]
required: ["java-stage2-15"]
crossRefs: []
estMinutes: 26
keywords: [bounded type parameter, wildcard, PECS]
---

## 学习目标

本课学习泛型深入与通配符。重点包括泛型边界、通配符 ?、PECS 原则直觉。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、给尺码加一道门槛：只收数字那一家的

「泛型初步」那一课那招是「一个方法伺候所有类型」：喂字符串印字符串，喂数字印数字。可有些方法**不能**什么都要 —— 比如我们想让东西**翻一倍**，那就得先会算数。字符串是不能翻倍的（`"张三" * 2` 是啥？），所以这一个方法的门槛得写清楚：**只收数字那一家的**。

```java
public class Main {
    static <T extends Number> void show(String label, T value) {
        System.out.println(label + " 的两倍是 " + (value.doubleValue() * 2));
    }

    public static void main(String[] args) {
        show("整数", 21);
        show("小数", 2.5);
    }
}
```

```text
整数 的两倍是 42.0
小数 的两倍是 5.0
```

念法是：方法名后面那对尖括号里，尺码那一块写的是 `T extends Number` —— **`T` 这块尺码，只能填 `Number` 那一家的成员**（`Integer`、`Double`……）。填进来的东西就**保证**带着这一家都会的那手本事，所以方法里那句 `value.doubleValue()` 永远找得到主儿。

同样的道理：方法里想用「比大小」，门槛就写成 `T extends Comparable`（会跟同类比大小那一家的）；想用「按名字输出」，门槛就写 `CharSequence` 那一家的。**门槛写什么，方法里就敢用什么** —— 这就是它存在的全部理由。

那要是不听话，硬往里填一个不在那个家族里的东西呢：

```java
public class Main {
    static <T extends Number> void show(T value) {
        System.out.println(value.doubleValue() * 2);
    }

    public static void main(String[] args) {
        show("字");
    }
}
```

编译器当场犯难：

```text
Main.java:7: error: method show in class Main cannot be applied to given types;
        show("字");
        ^
  required: T
  found:    String
  reason: inference variable T has incompatible bounds
    upper bounds: Number
    lower bounds: String
  where T is a type-variable:
    T extends Number declared in method <T>show(T)
1 error
```

错误信息里那两行才是要害：**`upper bounds: Number`**（你说过只收 `Number` 那一家的）跟 **`lower bounds: String`**（你手上这个偏偏是字符串）**对不上**。上下两条线碰不到一起，尺码就定不下来，编译器只能摆手。

注意它的**报错位置**：那句 `show("字");` 本身一点毛病没有（语法完全合法），错的是**填进去的尺码不合门槛**。所以以后看到 `incompatible bounds` 这两个词，先往「我喂的东西对不对得上门槛」那里想。

## 二、问号：一张「装什么都行」的通行证

第二个花样出场。先给你看一个写得很顺、但编译器**不认**的写法：

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static void printAll(List<Object> box) {
        for (Object x : box) {
            System.out.println(x);
        }
    }

    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("张三");
        printAll(names);
    }
}
```

```text
Main.java:14: error: incompatible types: List<String> cannot be converted to List<Object>
        printAll(names);
                 ^
Note: Some messages have been simplified; recompile with -Xdiags:verbose to get full output
1 error
```

「万物都能装的那种口袋」不就是老大吗，怎么装字符串的柜子反而递不进去？

因为它**不是**老大。「尺码填万物」的柜子和「尺码填字符串」的柜子是**两种不同的柜子名分**，谁也不是谁的爹 —— 你仔细想：要是我把一个「装字符串的柜子」当成「装万物的柜子」收下，然后**往里塞一个数字**，那个柜子的尺码可就当场破了。编译器宁可一开始就拦，也不背这个锅。

那「想收下所有柜子」这桩心事该怎么写？**写一个问号**：

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static void printAll(List<?> box) {
        for (Object x : box) {
            System.out.println(x);
        }
    }

    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("张三");
        List<Integer> nums = new ArrayList<>();
        nums.add(7);
        printAll(names);
        printAll(nums);
    }
}
```

```text
张三
7
```

`List<?>` 念作「一个柜子，里面保存**某种**尺码的东西，具体是哪种我不问」。装字符串的也收，装数字的也收 —— 两种柜子都递得进去，一次都不用改。

代价在这句话的另一半：**你不问里面是什么，就不能往里塞。** 方法里那句 `for (Object x : box)` 只是**往外返回**（读取的东西一律先当成万物那种口袋接着），完全合法。可要是你敢写一句 `box.add("煤球");` —— 编译器立刻拦下，理由很硬：连里面保存的是哪种尺码都不知道，谁知道你塞的这条字符串对不对得上尺寸？

一句话记住：**问号是「装什么都行」的通行证，但它只管往外返回，不管往里塞。**

## 三、往外返回的写 `extends`，往里塞的写 `super`

问号单独用太笼统了。绝大多数时候你要的是「只收数字这一家的柜子」，那就在问号后面补上那句门槛。这里有个**很容易搞反**的分岔，我们用两个方法摆在一起给你看：

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static double total(List<? extends Number> box) {
        double sum = 0;
        for (Number n : box) {
            sum = sum + n.doubleValue();
        }
        return sum;
    }

    static void fill(List<? super Integer> box) {
        box.add(1);
        box.add(2);
    }

    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>();
        fill(nums);
        System.out.println(total(nums));
    }
}
```

```text
3.0
```

两个方法，两种问号，一眼看去差不多，其实做的事正相反：

- `total` 是**只管往外返回**的：它把柜子里的东西一件件读取加一加。所以它写 `? extends Number` —— 「里面保存的是 `Number` 这一家**往下**的某一种（`Integer` 也行、`Double` 也行）」。**读取的东西保证是数字那一家的**，`n.doubleValue()` 才叫得动。
- `fill` 是**只管往里塞**的：它往柜子里塞 `1`、塞 `2`。所以它写 `? super Integer` —— 「这是一个**能装得下 `Integer`** 的柜子，上方是谁我不挑」。塞进去的 `1`、`2` 一定对得上尺寸。

这就是已有实现对象传下来的一句口诀，英文首字母凑成 **PECS**：

> **只管往外返回的写 `extends`，只管往里塞的写 `super`。**

这份口诀在刚才那两个方法身上是怎么走出来的？我们把**同一个柜子**从两头过一遍给你看：

```demo
title: 同一个柜子，从两头各过一遍
code:
| static double total(List<? extends Number> box) {
|     double sum = 0;
|     for (Number n : box) {
|         sum = sum + n.doubleValue();
|     }
|     return sum;
| }
| static void fill(List<? super Integer> box) {
|     box.add(1);
|     box.add(2);
| }
|
| List<Integer> nums = new ArrayList<>();
| fill(nums);
| System.out.println(total(nums));

step 先备一个装数字的柜子
at: 13
say: `List<Integer> nums = new ArrayList<>()` —— 尺码填 `Integer`，一个**装数字的柜子**，此刻空着。
meow: 创建 Integer 列表 nums。
pose: expect
nums 柜子里 = （空）
这一步读取的 n = （还没返回）
total 要算的总数 = 还没开始算
标准输出 = 还没印

step 递给 fill：这是只管往里塞的活
at: 14
say: `fill(nums)` 把柜子递进去。**这一个方法只管往里塞**（方法里干的是 `box.add(1)`），所以它头上写的是 `? super Integer` —— 「一个装得下整数的柜子」，门槛往下放。装数字的柜子正合尺寸，收下了。
meow: fill 只写入，用 ? super。
pose: busy
nums 柜子里 = （空）
这一步读取的 n = （还没返回）
total 要算的总数 = 还没开始算
标准输出 = 还没印

step 塞进第一个
at: 9
say: `box.add(1)` 往柜子里塞一个 `1`。`? super` 这一头**保证塞得进去** —— 这个柜子至少装得下整数，塞的尺寸一定对得上。
meow: 添加 1。
pose: busy
nums 柜子里 = 1
这一步读取的 n = （还没返回）
total 要算的总数 = 还没开始算
标准输出 = 还没印

step 再塞一个
at: 10
say: `box.add(2)` 再塞一个 `2`。`fill` 从头到尾**只管往里塞**，柜子里原来有什么它一个字都不问。
meow: 添加 2。
pose: busy
nums 柜子里 = 1、2
这一步读取的 n = （还没返回）
total 要算的总数 = 还没开始算
标准输出 = 还没印

step 换 total 出场：这是只管往外返回的活
at: 15
say: `total(nums)` 把**同一个柜子**递给另一个方法。这一个方法只管往外返回，所以它头上写 `? extends Number` —— 「里面保存的是数字这一家往下的某一种」。一样东西，两头的问号正好相反。
meow: total 只读取，用 ? extends。
pose: expect
nums 柜子里 = 1、2
这一步读取的 n = （还没返回）
total 要算的总数 = 还没开始算
标准输出 = 还没印

step 进方法第一件事：总数先归 0
at: 2
say: `double sum = 0;` 方法里先立一个装总和的 `sum`，洗成 `0` —— 此刻**一件都还没读取**。
meow: sum 从 0 开始。
pose: busy
nums 柜子里 = 1、2
这一步读取的 n = （还没返回）
total 要算的总数 = 0.0
标准输出 = 还没印

step 从柜子里返回出第一个
at: 3
say: `for (Number n : box)` 开始一件件往外返回。**读取的先接在 `Number` 这个名分上** —— 门槛保证了「一定是数字这一家的」，这一手接得稳。
meow: 取出第一个元素：1。
pose: busy
nums 柜子里 = 1、2
这一步读取的 n = 1
total 要算的总数 = 0.0
标准输出 = 还没印

step 加进总数
at: 4
say: `sum = sum + n.doubleValue()` 把读取的这个加进总数：`0.0 + 1.0 = 1.0`。**`n.doubleValue()` 叫得动，全靠门槛** —— 门槛写的是什么，方法里就敢用什么。
meow: sum 变成 1.0。
pose: busy
nums 柜子里 = 1、2
这一步读取的 n = 1
total 要算的总数 = 1.0
标准输出 = 还没印

step 绕回 for，再返回一个
at: 3
say: 加完绕回 `for` 那一行：柜子里还剩一件，**再返回一个** —— `2`。返回一次加一次，这就是这一个方法从头到尾的走法。
meow: 取出第二个元素：2。
pose: busy
nums 柜子里 = 1、2
这一步读取的 n = 2
total 要算的总数 = 1.0
标准输出 = 还没印

step 再加一次，总数到 3.0
at: 4
say: `1.0 + 2.0 = 3.0`，柜子里没下一件了，这一圈就是最后一圈。注意：这一整趟**从来没往柜子里塞过东西** —— 所以 `? extends` 那头放放心心让我们往外返回。
meow: sum 变成 3.0，元素取完。
pose: yay
nums 柜子里 = 1、2
这一步读取的 n = 2
total 要算的总数 = 3.0
标准输出 = 还没印

step 把答案交回去
at: 6
say: `return sum;` 方法跑到这儿，把 **3.0** 交回给称呼它的那一行，方法里的活就算干完了。
meow: 返回 3.0。
pose: proud
nums 柜子里 = 1、2
这一步读取的 n = 2
total 要算的总数 = 3.0（交回去了）
标准输出 = 还没印

step 印出来
at: 15
say: `System.out.println(total(nums))` 把返回的答案印在屏幕上：`3.0`。和上面 TEXT 块跑出来的一模一样。
meow: 输出 3.0。
pose: proud
nums 柜子里 = 1、2
这一步读取的 n = 2
total 要算的总数 = 3.0（交回去了）
标准输出 = 3.0
```

把这段走位记住，口诀就不用背了：`fill` 拿这个柜子当**入口**，一门心思往里塞，所以问号写成 `? super Integer`；`total` 拿**同一个**柜子当**出口**，一门心思往外返回，所以写成 `? extends Number`。**入口写 `super`、出口写 `extends`** —— 搞反了不是跑出怪结果，是编译的时候就红。

反过来写会怎样？试试往「往外返回」的那种柜子里塞东西：

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static void bad(List<? extends Number> box) {
        box.add(3);
    }

    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>();
        bad(nums);
    }
}
```

```text
Main.java:6: error: incompatible types: int cannot be converted to CAP#1
        box.add(3);
                ^
  where CAP#1 is a fresh type-variable:
    CAP#1 extends Number from capture of ? extends Number
Note: Some messages have been simplified; recompile with -Xdiags:verbose to get full output
1 error
```

`CAP#1` 那个词看着唬人，翻译过来就一句话：**「`?` 是什么，编译器自己是当场抓阄定的 —— 可它抓到的是 `Double` 呢？」** 你塞的那个 `3` 是整数，抓阄抓到 `Double` 就对不上尺寸。既然定不下来，它干脆不让你塞。

::: warn 注意

- **「尺码填万物」的柜子不是万能的爹。** 想收下所有柜子就写 `List<?>`，别写尺码填 `Object` 的那种 —— 后者只收「尺码正好是万物那种口袋」的柜子，装字符串的递不进去。
- **两个问号别搞反。** 往外返回用 `? extends`，往里塞用 `? super`。搞反了不会跑出奇怪结果，而是**翻译源代码的时候就红**（`int cannot be converted to CAP#1`），这算好事。
- **`?` 不能写在 `new` 后面。** `new ArrayList<?>()` 是错的 —— 建柜子的时候尺码必须说清楚，`?` 只是**收东西那一侧**的写法。
- **门槛只放「方法里真要用到的那样本事」。** 用不上 `Number` 就别把门槛写成 `T extends Number` —— 门槛越紧，别人越喂不进来，那是在给自己添堵。

:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| 尖括号里写 `T extends Number` | 给空尺码加门槛：只收数字那一家的 |
| `show("字")`（门槛是 `Number`） | 翻译源代码时就红：`upper bounds: Number` 跟 `lower bounds: String` 对不上 |
| 门槛写成 `T extends Comparable` | 门槛是「会跟同类比大小」的那一手本事 |
| 拿「尺码填万物」的柜子去收「尺码填字符串」的柜子 | **不合法**：两种柜子不是一家，谁也不是谁的爹 |
| `List<?>` | 「里面保存某种尺码，具体哪种我不问」的柜子 |
| `for (Object x : box)`（`box` 是 `List<?>`） | 往外返回合法：读取的先当万物那种口袋接着 |
| `box.add(...)`（`box` 是 `List<?>`） | **不合法**：不知道尺码，不知道你塞的对不对 |
| `? extends Number` | 只往外返回的写 `extends`：读取的保证是数字那一家 |
| `? super Integer` | 只往里塞的写 `super`：保证塞得下整数 |
| `box.add(3)`（`box` 是 `List<? extends Number>`） | 编译不过：`int cannot be converted to CAP#1` |
| `new ArrayList<?>()` | 不合法：建柜子时尺码必须说清楚 |

::: tip 提示

- **门槛写什么，方法里就敢用什么** —— 只放方法里真要用到的那样本事，门槛越紧，别人越喂不进来。
- **「尺码填万物」的柜子不是万能的爹**：想收下所有柜子，写一个问号就对了。
- **问号只管往外返回，不管往里塞** —— 这是它最要紧的一副脾气。
- **口诀记两头**：只管往外返回的写 `extends`，只管往里塞的写 `super`；搞反了不会跑出奇怪结果，编译的时候就红。
- **`?` 只是收东西那一侧的写法**：建柜子的时候，尺码必须说清楚。

:::

## 小任务

1. 把第一节那一个方法的门槛改成 `T extends Comparable`（会跟同类比大小那一家），方法里把那两个东西**对着比一比**（`a.compareTo(b) > 0`），再拿字符串喂一次 —— 看看它能收到什么、又是怎么被拦下的。
2. 第二节的 `printAll` 抄进练习场，试着在里面加一句 `box.add("煤球");`（`box` 是 `List<?>`）—— 先把编译器的原话抄进记录表，再把它删掉。
3. 把第三节那两个方法凑成一对：写一个方法「把柜子里的东西倒进另一个柜子」（从 `? extends` 那个往外返回、往 `? super` 那个里塞），想想为什么这样的两头写法是**唯一**能成立的一种。
4. 想一想：为什么 `? extends` 那个柜子**返回**得出来、**塞**不进去；而 `? super` 那个正好反过来？想通了，PECS 那句口诀就不用背了。

下一课，我们带你给一堆东西**排排坐** —— 三种最老实的排法：冒泡、选择、插入，一个一个拆开摆给你看。顺便，咱们拿刚学会的圈数尺子量一量：数据一多，这三种排法各要走多少步 
