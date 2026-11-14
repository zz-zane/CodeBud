---
id: java-stage1-13
lang: java
stage: 1
order: 17
title: 构造方法与 this
tags: [面向对象, 构造方法, this]
required: [java-stage1-12]
crossRefs: []
estMinutes: 25
keywords: [constructor, this, overload]
---

## 学习目标

本课学习构造方法与 this。重点包括构造方法、重载构造、this 关键字。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、自己画第一手：和类定义同名的那一个方法

类定义上第一次动笔，我们想给对象加一手「初始化」，让它保存名字和数据数进来：

```java
class Cat {
    String name;
    int fish;

    Cat(String name, int fish) {
        this.name = name;
        this.fish = fish;
    }

    void report() {
        System.out.println(this.name + " 处理了 " + this.fish + " 条");
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三", 3);
        c.report();
    }
}
```

```text
张三 处理了 3 条
```

看这一手 `Cat(String name, int fish)`，三条规矩记牢：

- **名字和类定义一模一样**（都叫 `Cat`）—— 这是它唯一能叫的名字，改一个字母编译器就不认识了。
- **前面没有 `void` 那一截，也没有任何类型** —— 别的手艺写 `void meow()`、`int add(...)`，它打头光秃秃的，就一个名字。
- **它在 `new Cat("张三", 3)` 那一刻跑一遍**，我们一次都没称呼它，它自己就动了。

它跑到哪去了？看身子里的两句：`this.fish = fish;` 把传入的 `3` 收进这个对象自己的家当。等 `c.report()` 的时候，印出来的就是这个对象自己的名字和它的数据数。

## 二、看着它初始化：那一刻真跑了一遍

嘴上说「自动跑一遍」太空，我们让它在身子里印一句话：

```java
class Cat {
    String name;
    int fish;

    Cat(String name, int fish) {
        this.name = name;
        this.fish = fish;
        System.out.println("一个新对象初始化了：" + this.name);
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c1 = new Cat("张三", 3);
        Cat c2 = new Cat("李四", 1);
        System.out.println(c1.name + " 和 " + c2.name + " 都到家了");
    }
}
```

```text
一个新对象初始化了：张三
一个新对象初始化了：李四
张三 和 李四 都到家了
```

前两行就是证据：每一次 `new`，那一手都**当场跑了一遍**。第一行印在 `c1` 初始化的时候，第二行印在 `c2` 初始化的时候，最后一行才是 `main` 里我们自己写的。

上一课说「你一个都不写，Java 送你一个空手方法」，现在可以把它说明白了：**送了那一手，我们才 `new` 得出一个什么都没有的空对象**；我们自己画了这一手，初始化的时候就能顺手把名字和数据数收好。

## 三、`this` 就是「这一个」

`this` 用自然语言解释就是**「这一个」**。看上一节那一手活儿里最要紧的一句 —— `this.fish = fish;`：

这一句左右两边看着像在绕口令，其实清清楚楚：

- **右边的 `fish`** —— 是初始化那一刻**从外面传入**的料（`new Cat("张三", 3)` 里的 `3`）。
- **左边的 `this.fish`** —— 是「**这一个**对象随身带着的那件家当」。
- 整句的意思：把传入的 3，收进这个对象自己的账上。

**为什么要写 `this.` 这么一个前缀？** 因为我们偷懒不写的时候，就是今天最大的那个坑 —— 下一节就撞。

## 四、最容易踩的坑：`name = name;`

我们把上面那手活儿偷个懒，把 `this.` 去掉看看：

```java
class Cat {
    String name;

    Cat(String name) {
        name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三");
        System.out.println(c.name);
    }
}
```

```text
null
```

我们明明喂了「张三」，印出来却是 `null` —— **编译器一次都没吭**，这句错不报错、不拦下，只给一个错结果。

原因在这里：**方法里面的料，和类定义上的家当，摆在两层不同的地方。** 传入的料也叫 `name`，它在我们眼前那一层，把类定义上那件家当**整个挡住了**。所以：

- 方法里的 `name = name;` 里的两个 `name`，**指的都是传入的那块料**：把「张三」写进「张三」自己，等于原地转了一圈，什么也没发生。
- 类定义上那件家当从头到尾**没被人碰过**，还是刚初始化时的默认值 `null`（上一课说过：装一串字的名称，默认就是 `null`）。
- 我们后来印 `c.name`，印的是类定义上那件家当 —— 它当然还是空的。

**记住一句话：只要传入的料和类定义上的家当同名，就老老实实写 `this.`。** `this.name = name;` 才是「**这一个**的名字，等于传入的名字」。

顺一句老账：「方法重载与作用域」那一课说过「同一个方法里，两块名称不能重名」—— 那说的是**同一层**里的两块名称；类定义上的家当和方法里的料**不是同一层**，所以同名不报错，只悄悄地挡住。**不报错，才更吓人。**

从 `new` 那一下开始，到两个元素各归各，我们把它拆成一步一步走给你看：

```demo
title: new 的那一刻：从腾地方到两个元素各归各
code:
| class Cat {
|     String name;
|     int fish;
|
|     Cat(String name, int fish) {
|         this.name = name;
|         this.fish = fish;
|     }
|
|     void report() {
|         System.out.println(this.name + " 处理了 " + this.fish + " 条");
|     }
| }
|
| Cat c = new Cat("张三", 3);
| c.report();

step 类定义先摆好，一个对象都还没生
at: 1
say: class Cat 是张类定义 —— 家当和初始化那一手都画在上面。注意：类定义不等于对象，这一刻实例一个都没有，那两件家当也就没人拥有。
meow: 类定义好了，对象还没创建。
pose: expect
家当 name = （还没有这一个）
料 name = （还没有料）
家当 fish = （还没有这一个）

step new 的第一件事：给新对象腾一块地方
at: 15
say: new Cat("张三", 3) 跑起来，头一件事不是跑那一手，而是先腾出一块地方给这个新对象 —— 类定义上那两件家当在这儿各就各位，只是都还是默认值：装一串字的元素是 null，装整数的元素是 0。
meow: new 先分配对象空间。
pose: expect
家当 name = null
料 name = 张三（还捏在手上）
家当 fish = 0

step 初始化那一手自己动了
at: 5
say: 我们一次都没称呼它 —— 是 new 把这手 Cat(String name, int fish) 叫起来的。它一进来，喂的两样料「张三」和「3」就归这一手管。
meow: 自动调用构造方法。
pose: busy
家当 name = null（还没装）
料 name = 张三
家当 fish = 0（还没装）

step 同一行上的两个元素：左、右各是谁的
at: 6
say: 看这一行的左右两边：左边的 this.name 是这一个自己的家当元素，右边的 name（没写 this. 的那个）是传入的料。两位同名，却是两个元素。
meow: this.name 是字段，name 是参数。
pose: think
家当 name = null（还没装）
料 name = 张三
家当 fish = 0（还没装）

step 倒进去：这一个的名字到手
at: 6
say: 等号把右边那元素倒进左边那个元素：这一个的 name 从 null 变成「张三」。能倒对元素全靠那个 this. —— 少了它，两边就成了同一个元素，原地转一圈，什么也没发生。
meow: 参数值赋给字段。
pose: yay
家当 name = 张三
料 name = 张三
家当 fish = 0（还没装）

step 第二件家当照办
at: 7
say: this.fish = fish; 一模一样的规矩：左边那个是这一个的数组元素，右边那块是传入的 3。装完这一句，这个新对象的家当就齐了。
meow: fish 同样赋给字段。
pose: yay
家当 name = 张三
料 name = 3
家当 fish = 3

step 初始化那一手跑完，new 才收工
at: 15
say: 那一手一结束，new 这一下就收工了 —— 它把刚收拾好的这个对象交到我们手上，c 这块名称底下就是它：名字张三、数据 3 条，两件家当都是初始化那一刻装好的。
meow: 构造完成，c 引用这个对象。
pose: proud
家当 name = 张三
料 name = （这一手跑完了）
家当 fish = 3

step 报账时读的还是这一个自己的元素
at: 16
say: c.report() 里那句 this.name，读的还是名称底下这一个的家当 —— 所以印出来是「张三 处理了 3 条」，不是别的对象，也不是传入的料。
meow: report 读取这个对象的字段。
pose: proud
家当 name = 张三
料 name = （这一手跑完了）
家当 fish = 3
```

**这条链子记住就不会再写漏 `this.`**：`new` 先腾地方 → 初始化那一手**自动**跑一遍 → 里面每一句 `this.xxx = xxx`，左边是**这一个**的家当元素、右边是**传入的料**。换句话说，`this` 指的永远是「**正在做这件事的这一个**」。

## 五、一组对象，两种初始化法：重载构造

有的对象是主人抱着进门的（有名字、有数据数），有的对象是路边捡的（还没名字）—— 我们想给这两种初始化法各写一手：

```java
class Cat {
    String name;
    int fish;

    Cat() {
        this("无名氏", 0);
    }

    Cat(String name, int fish) {
        this.name = name;
        this.fish = fish;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c1 = new Cat();
        Cat c2 = new Cat("张三", 3);
        System.out.println(c1.name + " " + c1.fish);
        System.out.println(c2.name + " " + c2.fish);
    }
}
```

```text
无名氏 0
张三 3
```

两手的名字都叫 `Cat`，靠**喂料不一样**分开 —— 上一课学的挑招规矩（招名一样、输入接口不一样）在这儿又用上了：`new Cat()` 走空手那一手，`new Cat("张三", 3)` 走收两样料的这一手。

第一手身子里那句 `this("无名氏", 0);` 是个省事的写法：**把这一个的活儿转给另一手干**。这样「挂名字、记数据数」这套活儿只写一遍，以后要改也只改一处。

它的死规矩只有一条：**必须是身子的第一句。** 转给另一手之前，这一个还没被收拾好，所以我们不能先干别的、再回头转。

## 六、四处必撞的报错

### 1. 名字写错了

```java
class Cat {
    String name;

    Cat2(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三");
        System.out.println(c.name);
    }
}
```

```text
Main.java:4: error: invalid method declaration; return type required
    Cat2(String name) {
    ^
1 error
```

念起来是：**「这一手既不是正经方法（没写返回什么），名字又不是类定义名 —— 那它到底算什么？」**

编译器认方法有一套死规矩：要么名字和类定义同名（那是初始化那一手），要么前面写清「返回什么」（`void`、`int` 这些，那是普通方法）。`Cat2(...)` 两条都不占，它只能拦下来问我们要个说法。

### 2. 多写了一截 `void`

```java
class Cat {
    String name;

    void Cat(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三");
        System.out.println(c.name);
    }
}
```

```text
Main.java:11: error: constructor Cat in class Cat cannot be applied to given types;
        Cat c = new Cat("张三");
                ^
  required: no arguments
  found:    String
  reason: actual and formal argument lists differ in length
1 error
```

这一处特别值得看：我们头一句明明写的是 `Cat`，可**多了一截 `void`**，它就从「初始化那一手」变成了**一个碰巧叫 `Cat` 的普通方法**，身子里的活儿再也不会在初始化那一刻跑了。

于是初始化的时候，还是 Java 送的那个**空手方法**在管事（不收料、不干活），而我们喂了「张三」进去 —— `required: no arguments` 是「初始化这一手一样东西都不收」，`found: String` 是「你却喂了一样东西」。

### 3. 初始化时喂的料对不上

```java
class Cat {
    String name;

    Cat(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat();
        System.out.println(c.name);
    }
}
```

```text
Main.java:11: error: constructor Cat in class Cat cannot be applied to given types;
        Cat c = new Cat();
                ^
  required: String
  found:    no arguments
  reason: actual and formal argument lists differ in length
1 error
```

和上一处的报错长得一模一样，只是 `required` 和 `found` **对调了**：

| | required（初始化那一手要什么） | found（我们喂了什么） |
|---|---|---|
| 第 2 处：多写 `void` | `no arguments`（空手） | `String`（喂了一样） |
| 第 3 处：少喂料 | `String`（要一样） | `no arguments`（一次没喂） |

看到 `constructor ... cannot be applied to given types`，就照这两行读一遍：**要什么、给了什么**，对不上就是它。第 3 处的正路很简单：`new Cat("张三")`，把料喂上。

### 4. `this(...)` 没放在第一句

```java
class Cat {
    String name;
    int fish;

    Cat() {
        System.out.println("先印一句");
        this("无名氏", 0);
    }

    Cat(String name, int fish) {
        this.name = name;
        this.fish = fish;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat();
        System.out.println(c.name);
    }
}
```

```text
Main.java:7: error: call to this must be first statement in constructor
        this("无名氏", 0);
            ^
1 error
```

念起来是：**「调用 `this(...)` 那一句必须是初始化这一手的第一句。」** 我们先印了一句才转手，编译器就在转手那一行拦下了 —— 不是它小气，是「转手」这件事的含义就是「这一个从头按另一手来收拾」，中间夹了别的活儿，就说不清了。

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `Cat(String name, int fish) { ... }` | **初始化那一手**：名字和类定义同名、前面不带 `void` 那一截 |
| `new Cat("张三", 3)` | 根据类创建实例，并且**当场**把这一手跑一遍 |
| `this.name = name;` | 「**这一个**的名字」＝传入的名字 |
| `name = name;`（忘了 `this.`） | 料把类定义上的家当挡住了 → 家当还是 `null`（**不报错**） |
| `Cat() { this("无名氏", 0); }` | 空的初始化法，把活儿转给另一手干 |
| `this(...)` 的位置 | **必须是身子的第一句** |
| `Cat2(...)` | 名字既不是类定义名、又没写返回什么 → `invalid method declaration` |
| `void Cat(...)` | 变普通方法了，不再管初始化 → `constructor ... cannot be applied` |

::: tip 提示
今天记住四句话：

1. **初始化那一手＝名字和类定义同名、不带 `void` 那一截、在 `new` 的那一刻自动跑一遍。**
2. **`this` 就是「这一个」**：`this.name` 是这个对象自己的家当，光写 `name` 是我们眼前那块料。
3. **料和家当同名，一律写 `this.`** —— 忘了它不报错，只给一个错结果。
4. **`this(...)` 转手必须是第一句**；空手 / 带料两种初始化法同名不同料，电脑按喂料自己挑（重载那一套）。
:::

::: warn 注意
三个最容易摔的地方：

- **`name = name;` 这种「原地转一圈」**是本课最阴的坑：编译器不吭声，我们得自己看出来 —— 印出来是 `null`、不是传入的名字，就是它。
- **`void Cat(...)` 看着像初始化那一手，其实已经被降级成普通方法了**；初始化时用的还是 Java 送的空手那一手。
- **`new Cat()` 喂的料必须和某一手初始化法对得上**，对不上就撞 `cannot be applied to given types`；读了 `required` / `found` 两行就知道差在哪。
:::

## 小任务

1. 给我们的 `Cat` 写一手初始化法 `Cat(String name)`（只收名字），身子里把数据数记成 `0`。再生两个对象，印出它们的名字和数据数看看。
2. 把第四节那个坑`name = name;` 抄进去、跑一遍，确认印出来是 `null`；再把 `this.` 补上，再跑一遍，把两次的输出抄在记录表上对照。
3. 故意把初始化那一手的名字写成 `Cat2`，编译一次，把原话抄下来；再把 `void` 加回去（变普通方法），编译一次，看看第二句原话里 `required` / `found` 各写了什么。
4. 给类定义写**三手**初始化法：`Cat()`、`Cat(String name)`、`Cat(String name, int fish)`。让前两手都把活儿转给最后一手干（`this(...)`），自己动手试出「转手必须是第一句」这条规矩（提示：把 `this(...)` 挪到印字后面，看看原话是什么）。
5. 想一想：`this.fish = fish;` 里的 `this` 和上一课 `c.meow()` 里的 `c`，说的是不是同一个对象？（下一课揭晓）

下一课是本阶段的最后一课，我们要教一件**保命**的本事：程序跑到一半翻车了怎么办 —— 不会用这一手的人，写出来的东西一撞上意外就当场断气；会用的人，能让它翻完车接着把账记完。去下一课探险 
