---
id: java-stage2-10
lang: java
stage: 2
order: 10
title: 泛型初步
tags: [泛型, 类定义]
required: ["java-stage2-09"]
crossRefs: []
compare: ["common-10"]
estMinutes: 28
keywords: [generics, type parameter, erasure]
---

## 学习目标

本课学习泛型初步。重点包括泛型类、泛型方法、好处、类型擦除直觉。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、先看看没有它的日子有多难受

要理解它好在哪，先看不填那块尺码的时候，日子是怎么过的：

```java
import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        ArrayList box = new ArrayList();
        box.add("数据");
        int n = (Integer) box.get(0);
        System.out.println(n);
    }
}
```

```text
Exception in thread "main" java.lang.ClassCastException: class java.lang.String cannot be cast to class java.lang.Integer (java.lang.String and java.lang.Integer are in module java.base of loader 'bootstrap')
```

念起来是：**「你贴上『数字』的标签要把它当数字用，可口袋里保存的是字符串。」**

那对尖括号不写的时候，柜子是个**万能口袋**：什么东西都收，因为收进去的时候都当成了 `Object`（万物都能装的那种口袋）。麻烦在后面 —— **取出来的时候，我们得自己贴标签**：`(Integer) box.get(0)` 这一笔就是「我们保证它是数字」。可柜子里装的其实是字符串，保证落空，**跑到这一步才炸**。

最气人的是：**这个错写的时候看不出来、编译也不拦**，非得等程序跑到那一行才翻车。

我们把这个**万能口袋**从领到手到翻车，一步一步走给你看：

```demo
title: 没填尺码的柜子，错在哪一步才炸
code:
| ArrayList box = new ArrayList();
| box.add("数据");
| int n = (Integer) box.get(0);
| System.out.println(n);

step 领一个不填尺码的柜子
at: 1
say: `ArrayList box = new ArrayList()` 尖括号一个字都没写 —— 这个柜子是**万能口袋**，什么都收。此刻柜子还空着，我们手上也空着。
meow: 没有泛型，什么都能放。
pose: expect
柜子里保存 = （空）
我们手上 = （空）
标准输出 = 还没印
炸了吗 = 还没有

step 塞一条字符串进去：收的时候当成「万物口袋」
at: 2
say: `box.add("数据")` 把字符串塞进去。没填尺码，**收进去的东西一律当成万物那种口袋（`Object`）** —— 柜子自己不记着这是字符串，也不拦我们塞什么。
meow: 字符串存入，按 Object 保存。
pose: busy
柜子里保存 = 数据（记成 Object）
我们手上 = （空）
标准输出 = 还没印
炸了吗 = 还没有

step 先把第 0 件读取
at: 3
say: `box.get(0)` 把柜子里第 0 件读取。**读取的东西一律是「万物那种口袋」** —— 柜子不说它是什么，编译器也没处问。
meow: get 返回 Object。
pose: busy
柜子里保存 = 数据（记成 Object）
我们手上 = 数据（当成 Object）
标准输出 = 还没印
炸了吗 = 还没有

step 贴上「数字」标签：当场翻车
at: 3
say: `(Integer)` 这一笔是**我们自己贴标签**：拍胸脯保证它是数字。可手上其实是字符串 —— **一贴就露馅，当场炸 `ClassCastException`**。这一笔编译的时候编译器一个字都没说。
meow: 强转 Integer，运行时抛异常。
pose: think
柜子里保存 = 数据（记成 Object）
我们手上 = 贴上「数字」，对不上
标准输出 = 还没印
炸了吗 = 炸了（ClassCastException）

step 最后一行一个字都没印
at: 4
say: `System.out.println(n)` **一个字都没印** —— 程序在上一行就断了气，这一行压根没轮到。屏幕上留下的只有出事那一个的名字和脚印，不是 `n` 的数。
meow: 异常已抛出，这行不执行。
pose: think
柜子里保存 = 数据（记成 Object）
我们手上 = （炸没了）
标准输出 = 没有数，只有出事那个的名字和脚印
炸了吗 = 炸了（ClassCastException）
```

这一段最要紧的是**时机**：没填尺码，编译器一路放行，错要等程序跑到 `(Integer)` 那一笔才当场露头 —— 而且**那一炸之后，后面的活儿全部作废**。填了尺码以后这个时机往前挪到哪儿，第二节和第四节接着说。

## 二、泛型：尖括号里那块空尺码

这种「什么都收」的柜子当然有用 —— 明明只是想装一串东西，为什么非要挑一种？Java 的答案不是「别挑」，而是：**类定义上留一块空尺码，用的时候再填。**

```java
class Bowl<T> {
    private T thing;

    void put(T thing) {
        this.thing = thing;
    }

    T take() {
        return thing;
    }
}

public class Main {
    public static void main(String[] args) {
        Bowl<String> fish = new Bowl<>();
        fish.put("数据");
        System.out.println(fish.take());

        Bowl<Integer> num = new Bowl<>();
        num.put(3);
        System.out.println(num.take() + 1);
    }
}
```

```text
数据
4
```

- **类定义名字后面那对尖括号** —— 里面那个 `T` 就是**空着的尺码**。类定义上凡是写 `T` 的地方（口袋的形状、`put` 收什么、`take` 返回什么），都读作「**用的时候填什么，这里就是什么**」。
- **尖括号里填 `String` 的那一句**（`fish` 那个柜子）—— 尺码填成字符串：这个柜子只装字符串。
- **尖括号里填 `Integer` 的那一句**（`num` 那个柜子）—— 尺码填成数字。于是 **`num.take() + 1` 可以直接做加法** —— 因为 `take` 返回的时候，Java 已经知道它是数字，**不用我们再贴标签**。
- 那一对写在类定义上的 `T`，行话叫**占位符**：它自己**不是**某种具体的东西，只是「这里会有一块尺码」的记号。

这套会量体裁衣的本事有个正式名字，叫**泛型（泛型）**。

## 三、方法也能量体裁衣

类定义能这样，方法也能 —— 在方法名字**前面**加一对尖括号：

```java
public class Main {
    static <E> void printTwice(E item) {
        System.out.println(item);
        System.out.println(item);
    }

    public static void main(String[] args) {
        printTwice("字");
        printTwice(7);
    }
}
```

```text
字
字
7
7
```

- **方法名字前面那对尖括号** —— 它写在**返回什么之前**，括号里那个 `E` 是这一个方法的空尺码；传入进来的 `item` 和方法里用到它的地方，都跟着这块尺码走。
- **`printTwice("字")`** —— 喂一条字符串进去，`E` 当场定成 `String`。
- **`printTwice(7)`** —— 喂一个数字进去，`E` 当场定成 `Integer`（自动装箱也在悄悄干活）。
- 一个方法就能伺候所有类型，**不用为每样东西各写一个方法**。

## 四、最大的好处：做错了当场就告诉我们

回头看第一节那个错 —— 有尺码之后会怎么样：

```java
import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        ArrayList<String> names = new ArrayList<>();
        names.add("张三");
        names.add(3);
        System.out.println(names);
    }
}
```

```text
Main.java:7: error: incompatible types: int cannot be converted to String
        names.add(3);
                  ^
Note: Some messages have been simplified; recompile with -Xdiags:verbose to get full output
1 error
```

念起来是：**「这柜子填的尺码是字符串，你塞进来一个数字，尺寸对不上。」**

这就是最值钱的地方：**错从「跑到那一行才炸」，提前到了「翻译源代码的时候就拦下」** ——

| | 不填尺码 | 填了尺码 |
|---|---|---|
| 塞错东西 | 照塞不误 | **编译期当场报错** |
| 取出来用 | 得自己贴标签 `(Integer)`，贴错就炸 | 直接就是那个类型，**不用贴标签** |
| 什么时候发现错 | 跑到那一行 | 翻译源代码的时候 |

## 五、擦除：跑起来的时候，尺码其实被擦掉了

最后一件事，**能帮你少走很多弯路**。看这段：

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        List<Integer> nums = new ArrayList<>();
        System.out.println(names.getClass() == nums.getClass());
    }
}
```

```text
true
```

两个柜子**明明是两种尺码**，可它们「是哪种柜子」居然答 `true` —— 同一个。原因叫**类型擦除**：

> 尺码是给**编译器在编译的时候**看的。翻完之后，尖括号里的东西**被擦掉了** —— 跑起来的时候，两个柜子都只是「一个 `ArrayList`」，柜子自己**不记得**里面保存的是什么。

所以有两件事照着记：

- **好处**：带尖括号的名分**不会在跑的时候多花力气**，尺码只在翻译阶段站岗。
- **要留心的**：跑起来之后就**问不出**「这个柜子里保存的是什么尺码」了。所以 `new T()`、`new T[10]` 这种「跑的时候还想用尺码」的写法**根本不合法**，写出来编译器当场就拦 —— 那是它本来就做不到的事。

::: warn 注意

- **尖括号里只能填「实例那种」**（类定义、字符串、装数字的类定义……），**不能填光溜溜的家当**：把 `int` 那种裸类型写进尖括号是错的，得写成装数字的那张类定义 `Integer` —— 尖括号只认实例，这也是为什么上一课那种装数字的类定义这么常用。
- **`T` / `E` 只是记号，随便起名也行**（`T`、`E` 是大家约定俗成的叫法），但**一旦起名就前后一致**，别半路换个字母，编译器会对不上号。
- **填了尺码就不要想着「跑起来再问它是什么」** —— 类型擦除之后问不出来，这是本课的坑，也是设计上刻意的取舍。

:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| 类定义名 `Bowl` 后面挂一对尖括号、里面写个 `T` | 类定义上留一块空尺码，用的时候再填 |
| 尖括号里填 `String` 的那个柜子（`fish` 那个） | 尺码填字符串：这个柜子只装字符串 |
| 尖括号里填 `Integer` 的那个柜子（`num` 那个） | 尺码填数字：`take()` 返回就能直接算 |
| 方法名前面挂一对尖括号、里面写个 `E` | 方法也能量体裁衣（尖括号写在返回什么之前） |
| `printTwice("字")` / `printTwice(7)` | 一个方法伺候所有类型，尺码当场定 |
| `ArrayList box = new ArrayList();` | 不填尺码 = 万能口袋，什么都收 |
| `(Integer) box.get(0)` | 取出来自己贴标签 —— 贴错了跑到那一步才炸 |
| `names.add(3)`（尺码是字符串） | 编译期当场报错：`incompatible types` |
| `names.getClass() == nums.getClass()` | 尺码被擦掉了 —— 跑起来两个柜子是同一种 |
| 尖括号里写 `int` 那种**裸类型** | 不合法：尖括号里只认实例，得写装数字的那张类定义 `Integer` |

::: tip 提示

- **尖括号里那一块，就是类定义上留的空尺码** —— 用的时候填什么，类定义上写 `T` 的地方就是什么。
- **不填尺码的柜子是万能口袋**：塞什么都收，可取出来得自己贴标签，贴错了跑到那一步才炸。
- **填了尺码，错就提前到编译那一步**：塞错东西当场被拦下，取出来也直接就是那个尺码，不用贴标签。
- **方法也能量体裁衣**：尖括号写在「返回什么」的前面，一个方法就能伺候所有尺码。
- **尺码是给编译器在编译的时候看的**，翻完就被擦掉了 —— 跑起来之后问不出柜子里保存的是哪种尺码，所以「跑起来还想用尺码」的写法根本不合法。

:::

## 小任务

1. 把第二节的类定义抄进练习场，再量一个尺码填成 `Double`（小数那种）的柜子，塞个 `3.5` 进去取出来印出来 —— 看看同一个类定义是不是真的能量出第三种尺寸。
2. 照第三节那招的样子自己写一个方法：方法名**前面**挂一对尖括号、里面写个别的字母，把同一件东西连印三遍，分别喂字符串和数字各试一次。
3. 把第四节的 `names.add(3);` 删掉，看看错误信息是不是消失了；再把它改成 `names.add(3 + "")` 试试 —— 猜猜这样为什么就过了（提示：数字和字符串相加，会变成什么）。
4. 想一想：既然跑起来之后尺码被擦掉了，那两个柜子（一个填的尺码是字符串、一个填的是数字），**在翻译源代码的时候**是靠什么被区分开的？

下一课，我们要教两种「起名字」的写法：一种是把**一串定好的选项**起个正式名字（比如「周一到周日」），另一种是把**一张子类直接塞进另一个类定义里**当零件 —— 都是往后写大程序时天天要用的东西 
