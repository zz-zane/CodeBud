---
id: java-stage3-02
lang: java
stage: 3
order: 6
title: 迭代器、比较器与排序
tags: [集合, 向导, 帮工]
required: ["java-stage3-23"]
crossRefs: []
estMinutes: 28
keywords: [iterator, comparable, comparator, sort]
---

## 学习目标

本课学习迭代器、比较器与排序。重点包括Iterator、Comparable、Comparator、sort。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、向导：一个一个顺着往下问

先看最普通的走法：

```java
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("张三");
        names.add("李四");
        names.add("煤球");

        Iterator<String> it = names.iterator();
        while (it.hasNext()) {
            String name = it.next();
            System.out.println("这一件是 " + name);
        }
        System.out.println("摸完了，一共 " + names.size() + " 件");
    }
}
```

```text
这一件是 张三
这一件是 李四
这一件是 煤球
摸完了，一共 3 件
```

`names.iterator()` 这一手的意思是「**派一位向导出来**」。向导站在柜子最前面，脑子里记着一件事：**我走到哪儿了**。它只认两句话：

- `it.hasNext()` —— 读作「**还有下一件吗**」，答的是真或者假；
- `it.next()` —— 读作「**把下一件返回给我**」，同时**它自己往前挪一格**。

所以那个绕圈的形状就是：**只要它还答「有」，就返回一件出来**。挪格这件事是向导自己干的 —— 我们从头到尾**一个编号都没写过**，也没数过柜子一共几件。

跟上一课那个「挨个过一遍」的写法比一比：两种都能走完整个柜子，而且**背后站着的其实是同一位向导** —— 「挨个过一遍」只是把这套问话藏了起来，让我们写得短一点。

## 二、边走边拿：只有向导本人能动手

现在往里面加一件事：走着走着，**顺手把某一件拿走**。先看一个看着特别顺、其实会炸的写法：

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("张三");
        names.add("李四");
        names.add("煤球");

        for (String name : names) {
            if (name.equals("张三")) {
                names.remove(name);
            }
        }
        System.out.println(names);
    }
}
```

```text
Exception in thread "main" java.util.ConcurrentModificationException
	at java.base/java.util.ArrayList$Itr.checkForComodification(ArrayList.java:1095)
	at java.base/java.util.ArrayList$Itr.next(ArrayList.java:1049)
	at Main.main(Main.java:11)
```

念一下这串错误信息：头一行那个词里藏着「**改着改着撞车了**」的意思；底下那三行 `at ...` 是**出事的位置一路往回追**，最底下那行 `at Main.main(Main.java:11)` 指的就是我们亲手写的那句 `names.remove(name);`。

要害是**向导和柜子对不上账了**。向导脑子里记着「我走到第几格、柜子现在几件」，我们却在它背后**直接动了柜子**。向导每回返回东西之前都会先**核对一眼账本**（柜子有没有被人偷偷改过）—— 一对不上，它当场翻脸，把这串错误信息扔出来。

**注意它是跑起来才炸的，不是编译的时候红的。** 这一点最烦：写的时候编译器一句话都不说，等真跑才炸；而且错误信息指着的那行 `names.remove(name);` 语法上完全合法，看着一点毛病没有。

那是不是一定会炸？再看一个：

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("张三");
        names.add("李四");
        names.add("煤球");

        for (String name : names) {
            if (name.equals("李四")) {
                names.remove(name);
            }
        }
        System.out.println(names);
    }
}
```

```text
[张三, 煤球]
```

**它跑通了。** 一样是「挨个过一遍的时候顺手拿走一件」，这一个偏偏**没被抓住**：拿走的正好是第二件，向导挪过去之后发现后面没东西了，那句「还有下一件吗」直接答了「没有」—— 于是它**再也没张嘴**。没张嘴，自然也没核对账本，错误信息就没机会露面。

所以这句话要记牢：**「这么写偶尔能跑通」不等于「这么写是对的」。** 换一组数据、换个位置，它照样炸，而且**炸不炸取决于数据长什么样** —— 这种错最难抓。我们宁可要一个**每次都稳**的写法。

稳的写法只有一条：**让向导自己动手**。

```java
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("张三");
        names.add("李四");
        names.add("煤球");

        Iterator<String> it = names.iterator();
        while (it.hasNext()) {
            String name = it.next();
            if (name.equals("李四")) {
                it.remove();
            }
        }
        System.out.println(names);
    }
}
```

```text
[张三, 煤球]
```

`it.remove()` 读作「**把向导手上刚读取的那一件拿走**」。这件事是向导自己干的，所以**账本它自己顺手就改好了** —— 一举两得：柜子里少一件，账目还照样对得上。下一回它再核对，两边还是一致的，错误信息永远不会出现。

一句话记住：**边走边拿的活儿，必须交给带路的那位自己干。**

## 三、排排坐：东西自己会，或者请个帮工

现在换第三件事：给一堆东西**排排坐**。这件事有两种完全不同的写法，很多新手分不清该用哪个。

### 写法一：让东西自己会排

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

class Fish implements Comparable<Fish> {
    String name;
    int weight;

    Fish(String name, int weight) {
        this.name = name;
        this.weight = weight;
    }

    public int compareTo(Fish other) {
        return this.weight - other.weight;
    }

    public String toString() {
        return name + "(" + weight + ")";
    }
}

public class Main {
    public static void main(String[] args) {
        List<Fish> pond = new ArrayList<>();
        pond.add(new Fish("张三", 5));
        pond.add(new Fish("煤球", 2));
        pond.add(new Fish("李四", 8));

        Collections.sort(pond);
        System.out.println(pond);
    }
}
```

```text
[煤球(2), 张三(5), 李四(8)]
```

类定义名后面挂着的那个 `Comparable<Fish>`，读作**一张挂在类定义上的承诺**：「这张类定义创建后的每一个实例，**都会跟同类比大小**」。

承诺的具体内容写在 `compareTo` 里：

```java
public int compareTo(Fish other) {
    return this.weight - other.weight;
}
```

这一手报的是一个整数，意思是「**我们该排在它前面还是后面**」：报负数就是「我们轻，我们站前面」，报正数就是「我们重，我们站后面」。照着这份承诺，`Collections.sort(pond)` 这一手才叫得动 —— 它收的**只有挂过这份承诺的柜子**。

### 写法二：请个帮工

如果东西自己**没挂那份承诺**（或者不想挂），那就请个帮工来替它排：

```java
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

class Fish {
    String name;
    int weight;

    Fish(String name, int weight) {
        this.name = name;
        this.weight = weight;
    }

    public String toString() {
        return name + "(" + weight + ")";
    }
}

class HeavyFirst implements Comparator<Fish> {
    public int compare(Fish a, Fish b) {
        return b.weight - a.weight;
    }
}

public class Main {
    public static void main(String[] args) {
        List<Fish> pond = new ArrayList<>();
        pond.add(new Fish("张三", 5));
        pond.add(new Fish("煤球", 2));
        pond.add(new Fish("李四", 8));

        pond.sort(new HeavyFirst());
        System.out.println(pond);
    }
}
```

```text
[李四(8), 张三(5), 煤球(2)]
```

这张类定义上挂的承诺不一样：`Comparator<Fish>` 的意思是「**我们会替两个同类比一比**」。它不挂在对象身上，它是一张**单独的类定义**，专门干「当裁判」这一件事。

`pond.sort(new HeavyFirst())` 读作「**这个柜子，请这个帮工来排**」。同一堆东西，换上另一个帮工就能换一种排法 —— **东西自己一个字都不用改**。这就是请帮工最大的好处：我们的对象不用一辈子只会一种站法。

两种写法的分岔，记这一句就够：

> **东西自己会排，就用 `Collections.sort(pond)`；想换个排法又不想动东西，就请个帮工、写 `pond.sort(...)`。**

这位帮工到底是**什么时候**被引用的？我们把这一次排排坐拆开，一步一步走给你看：

```demo
title: 排排坐的时候，帮工被调用了几次、都问了什么
code:
| class HeavyFirst implements Comparator<Fish> {
|     public int compare(Fish a, Fish b) {
|         return b.weight - a.weight;
|     }
| }
|
| pond.sort(new HeavyFirst());
| System.out.println(pond);

step 先看这位帮工是谁
at: 1
say: `class HeavyFirst implements Comparator<Fish>` 是一张**单独的类定义** —— 它不挂在对象身上，专管一件差事：**替两个同类当裁判**。纸上只有那一手 `compare`。此刻它一个字都还没干。
meow: 比较器单独定义排序规则。
pose: expect
柜子里 = 张三(5) 煤球(2) 李四(8)
帮工被调用了几声 = 0
这一次问的是谁 = （帮工还没递过去）
帮工报的数 = （还没报）

step 把帮工递给柜子：一次还没调用
at: 7
say: `pond.sort(new HeavyFirst())` 读作「这个柜子，请这个帮工来排」。**递进去不等于干起来** —— 这一刻它被调用了 **0 声**；什么时候调用、调用几次，都是排排坐那一手自己说了算。
meow: sort 接收比较器，自己决定何时调用。
pose: busy
柜子里 = 张三(5) 煤球(2) 李四(8)（还没动）
帮工被调用了几声 = 0（刚递进去）
这一次问的是谁 = （还没调用）
帮工报的数 = （还没报）

step 第 1 步
at: 3
say: 第 1 声引用的是 **煤球**（头一位）和 **张三**（第二位）。帮工伸手量两边的 `weight`：`b.weight - a.weight` 算出来是 5 − 2 = **+3**，报了个**正数** —— 意思是「头一位站到后面去」，也就是张三在前、煤球在后。
meow: 第 1 次比较：结果为正。
pose: busy
柜子里 = 张三(5) 煤球(2) 李四(8)
帮工被调用了几声 = 1
这一次问的是谁 = 煤球（头一位）和 张三
帮工报的数 = +3（正数：头一位站后面）

step 第 2 步
at: 3
say: 第 2 声引用的是 **李四** 和 **煤球**：`b.weight - a.weight` 就是 2 − 8 = **−6**，**负数** —— 「头一位站前面」，李四排到煤球前头去。
meow: 第 2 次比较：结果为负。
pose: busy
柜子里 = 张三(5) 煤球(2) 李四(8)
帮工被调用了几声 = 2
这一次问的是谁 = 李四（头一位）和 煤球
帮工报的数 = −6（负数：头一位站前面）

step 第 3 步
at: 3
say: 第 3 声引用的**还是李四和煤球**，报的还是 **−6**。别以为它问重了 —— **调用谁、调用几次，是排排坐那一手自己的算盘**，我们管不着也数不清；帮工只管每一次都照实答。
meow: 第 3 次比较，调用次数由算法决定。
pose: think
柜子里 = 张三(5) 煤球(2) 李四(8)
帮工被调用了几声 = 3
这一次问的是谁 = 李四 和 煤球（又问了一遍）
帮工报的数 = −6（负数：头一位站前面）

step 第 4 步
at: 3
say: 第 4 声引用的是 **李四** 和 **张三**：`b.weight - a.weight` 就是 5 − 8 = **−3**，负数，李四再往前站。咱这台电脑上，这件活儿一共就调用了这 **4 声**。
meow: 第 4 次比较：结果为负。
pose: busy
柜子里 = 张三(5) 煤球(2) 李四(8)
帮工被调用了几声 = 4
这一次问的是谁 = 李四（头一位）和 张三
帮工报的数 = −3（负数：头一位站前面）

step 调用结束了：挪东西的是排排坐那一手
at: 7
say: 4 声调用结束，排排坐那一手才**自己动手**，按报回来的那几个数把三件东西摆好。**帮工从头到尾一个指头都没碰过柜子** —— 它只负责报数。
meow: 比较结束，sort 完成排序。
pose: proud
柜子里 = 李四(8) 张三(5) 煤球(2)
帮工被调用了几声 = 4（调用结束了）
这一次问的是谁 = （问完了）
帮工报的数 = （报完了）

step 印出来：重的排前面
at: 8
say: 最后一句把柜子印出来 —— `[李四(8), 张三(5), 煤球(2)]`，重的站前面，跟帮工报的那几个数对得上。东西自己**一个字都没改**。
meow: 输出：重的在前。
pose: yay
柜子里 = 李四(8) 张三(5) 煤球(2)（印出来就是它）
帮工被调用了几声 = 4
这一次问的是谁 = （问完了）
帮工报的数 = （报完了）
```

一句话收住：**帮工是被调用来的裁判** —— 称呼它的是排排坐那一手，调用几次、按什么顺序调用都由那一手自己定（换一组数据就不一样）；帮工要做的只有一件事：每一次都照实报一个数。

### 两样都没有会怎样

要是一个东西**自己没挂那份承诺**，我们也**没请帮工**，就直接调用排排坐呢：

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

class Fish {
    String name;

    Fish(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        List<Fish> pond = new ArrayList<>();
        pond.add(new Fish("张三"));
        pond.add(new Fish("煤球"));

        Collections.sort(pond);
        System.out.println(pond);
    }
}
```

```text
Main.java:19: error: no suitable method found for sort(List<Fish>)
        Collections.sort(pond);
                   ^
    method Collections.<T#1>sort(List<T#1>) is not applicable
      (inference variable T#1 has incompatible bounds
        equality constraints: Fish
        upper bounds: Comparable<? super T#1>)
    method Collections.<T#2>sort(List<T#2>,Comparator<? super T#2>) is not applicable
      (cannot infer type-variable(s) T#2
        (actual and formal argument lists differ in length))
  where T#1,T#2 are type-variables:
    T#1 extends Comparable<? super T#1> declared in method <T#1>sort(List<T#1>)
    T#2 extends Object declared in method <T#2>sort(List<T#2>,Comparator<? super T#2>)
1 error
```

错误信息里有两句是要害：

- **`no suitable method found for sort(...)`** —— 「没找着一双能收下这个柜子的手」；
- **`upper bounds: Comparable<? super T#1>`** —— 那双手里写着「**只收挂过那份承诺的东西**」，而我们这些东西一个都没挂。

注意这一回是**编译的时候就红**，不是跑起来才炸 —— 跟第二节那种「写的时候没事、跑起来才炸」正好是两类。**早红是好事**：我们还没跑，就知道自己漏了一件事。

::: warn 注意

- **边走边拿，只能交给向导本人。** 用 `it.remove()`，别在「挨个过一遍」的时候直接对柜子动手 —— 后者**有时候会炸、有时候不炸**，而「有时候」是最坏的一种错。
- **「偶尔能跑通」不等于「写对了」。** 第二节那个第二件被拿走的例子真跑是通的，可它随时能炸。判断一段代码对不对，看的不是「这次跑通没有」。
- **比大小别顺手用减法。** `return b.weight - a.weight;` 这种写法在小数字上完全正确，可数字一大就会**算出完全相反的结果**（两个很大的数相减，结果会绕一圈变成一个正数）。要稳当，就老老实实写「谁大就报谁大」那种比法。
- **一份承诺只写一种排法。** 东西自己挂的那份承诺是**跟着它一辈子**的；想按别的规矩排，别去改它，**请个帮工**就对了。
- **帮工是拿来比的，不是拿来改东西的。** 帮工那一手只管**报谁前谁后**，绝不能在里头动手脚改东西 —— 排排坐的过程中东西被改了，排出来的顺序就不可信了。

:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `names.iterator()` | 从柜子头上**派一位向导出来** |
| `it.hasNext()` | 「还有下一件吗」—— 答真或者假 |
| `it.next()` | 「把下一件返回给我」，向导自己往前挪一格 |
| 一边「挨个过一遍」一边 `names.remove(...)` | **跑起来才炸**：`ConcurrentModificationException`（有时候偏偏不炸） |
| `it.remove()` | 让**向导自己**拿走刚读取的那一件，账目照样对得上 |
| `implements Comparable<Fish>` | 挂在类定义上的承诺：这东西**自己会跟同类比大小** |
| `compareTo` 报负数 / 正数 | 负数 = 我们站前面；正数 = 我们站后面 |
| `Collections.sort(pond)`（东西没挂承诺） | **编译时就红**：`no suitable method found for sort(...)` |
| `implements Comparator<Fish>` | 一张**单独的类定义**：我们会替两个同类当裁判 |
| `pond.sort(new HeavyFirst())` | 「这个柜子，请这个帮工来排」—— 东西一个字不用改 |
| `return b.weight - a.weight;`（数字很大时） | 结果绕一圈变成反的 —— 比大小别顺手用减法 |

::: tip 提示

- **向导只认两句话**：`hasNext()` 问「还有下一件吗」、`next()` 把下一件返回给我们 —— 挪格是它自己干的，一个编号都不用写。
- **边走边拿，必须交给带路的那位自己干**（`it.remove()`）：我们在它背后直接动柜子，它一核对账本当场就翻脸。
- **「偶尔能跑通」不等于「写对了」** —— 那种错炸不炸取决于数据长什么样，是最难抓的一种。
- **排排坐有两种写法**：东西自己会排就 `Collections.sort(...)`；想换个排法又不想动东西，就请个帮工、写 `pond.sort(...)`。
- **两样都没有就直接调用排排坐，编译的时候就红** —— 早红是好事。

:::

## 小任务

1. 把第一节那位向导抄进练习场，在绕圈里加一句话：**只印出名字里带「橘」的那些**（`name.contains("橘")`）。想想这跟「挨个过一遍 + 一句 `if`」是不是同一件事。
2. 把第二节那个「第二件被拿走」的例子原样跑一遍，确认它能跑通；然后把拿走的那一件改成**第一件**，再跑一遍。同一个写法，两种结果 —— 把两次的真实输出都抄进记录表。
3. 给第三节那些对象再请一个帮工：这次按**名字的长短**排（短的站前面）。想想为什么这样的排法**只能**用请帮工来实现，不能靠改东西自己那份承诺。
4. 想一想：要是我们一边用向导走着、一边**用别的方式**把柜子里的东西拿走，向导会发现吗？为什么它「每回返回东西前先核对账本」这个习惯是**在保护我们**？

下一课，我们要把「方法」本身当成东西来使唤：**一段没名字的方法，可以当场写出来、当场递给别人用** —— 写起来比请帮工还短，而且能一路传到柜子那头去 
