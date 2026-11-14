---
id: java-stage2-05
lang: java
stage: 2
order: 5
title: static 与 final
tags: [关键字, 静态成员, 常量]
required: ["java-stage2-04"]
crossRefs: []
compare: ["common-10"]
estMinutes: 25
keywords: [static, final, constant]
---

## 学习目标

本课学习static 与 final。重点包括静态成员、final 变量/方法/类、常量。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、整张类定义共用一份：`static` 格子

先把「一共初始化了几个」这件事办成：

```java
class Cat {
    static int count = 0;
    String name;

    Cat(String name) {
        this.name = name;
        count = count + 1;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat a = new Cat("张三");
        Cat b = new Cat("李四");
        Cat c = new Cat("王五");
        System.out.println("一共初始化了 " + Cat.count + " 只");
    }
}
```

```text
一共初始化了 3 只
```

这段里有三处要拿记录表抄下来：

1. **类定义里**：`static int count = 0;`——前面那个 `static` 是宣告「这一格**整张类定义共用**」，不属于任何一个对象；后面那个 `= 0` 是它的**起步的数**。
2. **初始化那一手里**：`count = count + 1;`——每创建一个对象都去**同一个**格子上加一。生三个，加三次，所以是 `3`。
3. **读数的时候**：`Cat.count`——写成「类定义名 `.` 格子名」。

念法上，`Cat.count` 念作「**`Cat` 这张类定义上的 `count`**」。多写那个类定义名不是啰嗦：它一眼就告诉读代码的人「这一格不是某个对象自己的东西」。

::: tip 提示
**共用的那一份，一律用类定义名去念**（`Cat.count`）。写下 `Cat.` 这几个字符，读的人立刻知道「这不是某个对象自己的东西」——这条规矩能帮你省下很多想不明白的工夫。
:::

## 二、它真的只有一份

光听我们说「共用」不算数，得亲手撞一次才踏实。下面这段是**故意使坏**：我们拿一个对象去改那个数，再看看另外两位怎么看。

```java
class Cat {
    static int count = 0;
    String name;

    Cat(String name) {
        this.name = name;
        count = count + 1;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat a = new Cat("张三");
        Cat b = new Cat("李四");
        a.count = 100;
        System.out.println(Cat.count + " " + b.count);
    }
}
```

```text
100 100
```

我们只写了 `a.count = 100;`，可印出来的是 `100 100`——`b` 那一侧也变了。

**因为它压根不是 `a` 的东西**：`a.count`、`b.count`、`Cat.count` 三种写法指的是**同一份**，一共就这一格。

我们把两遍都真跑了，结果得分开说：

- **不拧开关**：编译器**一个字都没说**——编得过、跑得动，就这么放过去了。
- **拧上挑刺的开关**（`-Xlint:static`）：它**当场念了两句**，点着的正是上面那两处：

> `warning: [static] static variable should be qualified by type name, Cat, instead of by an expression`

两句都是 `warning`，程序照旧印出 `100 100`。编译器这话翻过来就是——**「共用的那一格，请拿类定义名去调用」**：它认得 `a.count` 这种写法，只是嫌它绕。

所以我们给自己立一条规矩：**共用的那份只写 `Cat.count`**。`a.count` 这种念法编译器认，可它会让读代码的人（包括三天后的你自己）以为这是 `a` 自己的一格。

（跟别的语言不一样的地方顺带说一句：Java 的共用的那些格子，**起步的数就写在类定义里那一行**，不用在类定义外面再补一行。少写一处，少一处忘。）

再说回印出来的那个 `100 100`：我们只动了 `a` 那一侧，`b` 那边怎么也变了？我们把这段拆成一步一步，走给你看：

```demo
title: 共用的那一格 —— 为什么我们动了 a，b 也跟着变
code:
| class Cat {
|     static int count = 0;
|     String name;
|     Cat(String name) {
|         this.name = name;
|         count = count + 1;
|     }
| }
| public static void main(String[] args) {
|     Cat a = new Cat("张三");
|     Cat b = new Cat("李四");
|     a.count = 100;
|     System.out.println(Cat.count + " " + b.count);
| }

step 类定义上先躺着那一格
at: 2
say: `static int count = 0;` 是写在**类定义里**的一格，起步的数是 `0`。要盯紧的是：这一格**不在任何一个对象身上** —— 此刻院子里一个对象都还没生。
meow: count 属于类，起始值是 0。
pose: expect
Cat.count 那一格 = 0（起步的数）
b 那边看见的 = （还没生）
标准输出 = 还没印

step 生第一个：张三
at: 10
say: `new Cat("张三")` 会去调用初始化那一手。先盯住它待会儿动的是**哪一格** —— 加一还没轮到，这一格现在还是 `0`。
meow: 创建 a，调用构造方法。
pose: busy
Cat.count 那一格 = 0（还没加）
b 那边看见的 = （还没生）
标准输出 = 还没印

step 初始化那一手：加的是共用那一格
at: 6
say: `count = count + 1;` 加的是**类定义上那一格**，加完变成 `1`。同一手里那句 `this.name = name;` 保存的是「张三」，那是**它自己的一格**，跟共用那格不在一处。
meow: count 变成 1。
pose: yay
Cat.count 那一格 = 1
b 那边看见的 = （还没生）
标准输出 = 还没印

step 生第二只：李四
at: 11
say: 第二个对象落地，走的还是同一手。它**不是**在张三那本账上加 —— 这一手待会儿要去动的，还是**那一格**。
meow: 创建 b。
pose: busy
Cat.count 那一格 = 1（还没加）
b 那边看见的 = （还没生完）
标准输出 = 还没印

step 李四也加一次：还是那一格
at: 6
say: 加完变成 `2`。看仔细：我们一次都没碰过每个对象自己那格，可 `b` 那边看见的也是 `2` —— 它俩看的是**同一格**。
meow: count 变成 2，所有对象共享。
pose: yay
Cat.count 那一格 = 2
b 那边看见的 = 2
标准输出 = 还没印

step 我们拿 a 去改：改的还是那一格
at: 12
say: `a.count = 100;` —— 我们写的是 `a`，可 `a.count`、`b.count`、`Cat.count` 三种写法指的是**同一格**。这一改，谁都看得见。
meow: a.count 改的也是同一个静态字段。
pose: think
Cat.count 那一格 = 100
b 那边看见的 = 100
标准输出 = 还没印

step 印出来：100 100
at: 13
say: `System.out.println(Cat.count + " " + b.count);` 印出 `100 100`。我们一个字都没碰过 `b`，可 `b` 那边看见的也是 `100` —— **压根只有一格**。这就是课文那句「它真的只有一份」。
meow: 两种写法都读到 100。
pose: proud
Cat.count 那一格 = 100
b 那边看见的 = 100
标准输出 = 100 100
```

所以 `a.count` 这种写法编译器认，可改的**还是那一格** —— 共用的那一份，一律拿类定义名去念（`Cat.count`），读代码的人才不会被骗。

## 三、`static` 方法：没有「我们自己」的方法

有些活**不需要哪个对象也能干**——比如「报一报一共初始化了几个」。这种活就该写成 `static` 方法：前面加 `static`，称呼它的时候不需要先有一个对象。

```java
class Cat {
    static int count = 0;
    String name;

    Cat(String name) {
        this.name = name;
        count = count + 1;
    }

    static int howMany() {
        return count;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat a = new Cat("张三");
        Cat b = new Cat("李四");
        System.out.println("一共有 " + Cat.howMany() + " 只");
    }
}
```

```text
一共有 2 只
```

注意两件事：

- 称呼它的时候，名字前面挂的是**类定义名**：`Cat.howMany()`。这件事不属于任何一个对象，所以从类定义上调用最自然。
- 它状态里碰的是 `count`（共用的那一份），完全没问题。

（我们也试过拿一个对象去调用：`a.howMany()`。编译器照样放行，可读起来像是「这是 `a` 自己那一手」，我们劝你别这么写。）

可要是它去碰**某个对象自己那一格**呢？编译器当场拦下：

```java
class Cat {
    static int count = 0;
    String name;

    Cat(String name) {
        this.name = name;
        count = count + 1;
    }

    static int howMany() {
        return name.length();
    }
}

public class Main {
    public static void main(String[] args) {
        Cat a = new Cat("张三");
        System.out.println(Cat.howMany());
    }
}
```

```text
Main.java:11: error: non-static variable name cannot be referenced from a static context
        return name.length();
```

念作：**「`name` 是每个对象自己的一份，可你现在站的是 `static` 方法——称呼它的时候压根没有对象站在旁边，你要用的是哪个对象的 `name`？」**

`this` 也是同一个道理。上一课说过，`this` 就是「调用这一个方法的那个对象」；可 `static` 方法挂在类定义上，称呼它的时候手里**根本没有对象**：

```java
class Cat {
    static int count = 0;

    Cat() {
        count = count + 1;
    }

    static int howMany() {
        return this.count;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat a = new Cat();
        System.out.println(Cat.howMany());
    }
}
```

```text
Main.java:9: error: non-static variable this cannot be referenced from a static context
        return this.count;
```

念作：**「`static` 方法里没有『我们自己』这个东西——`this` 在这儿是空的。」**

一句话记住：**`static` 方法里，共用的格子随便碰，每个对象自己的格子一个都不能碰**（`this` 就更不能写）。

### 回到导入：入口那一行为什么非得是这个 `static`

现在再回头看第一行，我们一下就想通了：**`main` 本身就是一个 `static` 方法**。

道理特别朴素：程序刚起步那一刻，院子里**一个对象都还没创建后**。没有对象，就调用不动「哪个对象的方法」；能引用的只有那种挂在类定义上、不需要对象的方法。所以入口必须写成 `static` 的。

要是我们在入口里忍不住去碰某个实例自己的格子，撞的就是刚才那句话：

```java
public class Main {
    String name = "张三";

    public static void main(String[] args) {
        System.out.println(name + "：");
    }
}
```

```text
Main.java:5: error: non-static variable name cannot be referenced from a static context
        System.out.println(name + "：");
```

（把入口那一行的 `static` 抠掉，它其实**编得过**——那一行本身是个合法方法。可一按运行，`java` 会拦下来说一句 `Error: Main method is not static in class Main, please define the main method as: public static void main(String[] args)`：入口不是 `static`，它就没法在没有对象的时候被调用。）

## 四、`final`：钉死了就不许改

`static` 管的是「**只有一份**」，接下来这个东西管的是「**只许填一次，往后谁都不许改**」——写法是在前面加 `final`。

```java
class Cat {
    final String name;

    Cat(String name) {
        this.name = name;
    }

    void greet() {
        System.out.println(name + "：");
    }
}

public class Main {
    public static void main(String[] args) {
        Cat a = new Cat("张三");
        a.greet();
    }
}
```

```text
张三：
```

这一手叫**初始化时钉死**：`final String name;` 报个名字，**具体是哪个名字，在初始化那一手里填进去、填完就锁死**。要是名字天生就定好了，也可以当场填：

```java
class Cat {
    final String name = "无名对象";

    void greet() {
        System.out.println(name + "：");
    }
}

public class Main {
    public static void main(String[] args) {
        Cat a = new Cat();
        a.greet();
    }
}
```

```text
无名对象：
```

两条路都行，但**必须二选一**：要么在初始化那一手里填满，要么在声明那一行就填好。两条都不占，编译器照样拦：

```java
class Cat {
    final String name;

    Cat() {
        System.out.println("一个子对象初始化了");
    }
}

public class Main {
    public static void main(String[] args) {
        new Cat();
    }
}
```

```text
Main.java:6: error: variable name might not have been initialized
```

念作：**「这一格你说好了钉死——那它到底钉的是哪个名字？我们等到初始化那一手写完，也没见你填过。」**

钉死之后还想改呢？当场挨拦：

```java
class Cat {
    final String name;

    Cat(String name) {
        this.name = name;
    }

    void rename() {
        name = "王五";
    }
}

public class Main {
    public static void main(String[] args) {
        Cat a = new Cat("张三");
        a.rename();
    }
}
```

```text
Main.java:9: error: cannot assign a value to final variable name
        name = "王五";
```

念作：**「这一格你初始化时已经填过、锁上了——现在谁都不许再往里塞东西。」**

这一格「初始化时钉死」是怎么钉上的，我们也拆成一步一步，走给你看：

```demo
title: final 那一格：初始化时填一次，往后就锁死
code:
| class Cat {
|     final String name;
|     Cat(String name) {
|         this.name = name;
|     }
|     void greet() {
|         System.out.println(name + "：");
|     }
| }
| public static void main(String[] args) {
|     Cat a = new Cat("张三");
|     a.greet();
| }

step 报个名字，说好钉死
at: 2
say: `final String name;` 只报名字、不定内容 —— 说好这一格**只许填一次**。此刻它还空着。
meow: final 字段只能赋值一次。
pose: expect
name 那一格 = （还空着）
锁 = 还没上
标准输出 = 还没印

step 生张三：把名字递进初始化那一手
at: 11
say: `new Cat("张三")` 把「张三」递给初始化那一手。这是**唯一**能填这一格的机会 —— 过了这一手就再没门了，所以此刻它**还是空着**。
meow: 构造方法是赋值的机会。
pose: busy
name 那一格 = （还空着）
锁 = 还没上
标准输出 = 还没印

step 填进去的这一下，锁就上了
at: 4
say: `this.name = name;` 把「张三」装进那一格 —— **填过就锁死**。课文说的「初始化时钉死」，钉的就是这一下。
meow: name 赋值后不能再改。
pose: yay
name 那一格 = 张三（填过、锁了）
锁 = 锁上了
标准输出 = 还没印

step 输出：张三还在里面
at: 12
say: `a.greet()` 去念这一格，印出「张三：」—— 填进去的东西**一直都在**，只是谁都不许再改它。
meow: greet 读取 name。
pose: yay
name 那一格 = 张三（锁着）
锁 = 锁上了
标准输出 = 张三：

step 想填第二次？封条在那儿
at: 2
say: 回头看这一行：`final` 就是我们贴的封条。课文里 `rename` 那一手想在别处再填一次，编译器当场拦下：`cannot assign a value to final variable name`。**声明那一行、初始化那一手，两条总得占一条；占过就锁死。**
meow: 再次赋值会编译报错。
pose: proud
name 那一格 = 张三（谁都改不了）
锁 = 锁上了（第二次填 → 挨拦）
标准输出 = 张三：
```

所以 `final` 那两句话要连起来记：**要么在声明那一行填，要么在初始化那一手里填**，两条都不占，编译器会说 `variable name might not have been initialized`；占了一条之后，这一格就再也填不进第二次了。

## 五、`final` 方法与 `final` 类定义：不许别人往下改

`final` 还能挂在**方法**和**类定义**头上，意思是「这一手/这张类定义，到此为止，不许别人接着改」：

```java
class Animal {
    final void speak() {
        System.out.println("……");
    }
}

class Cat extends Animal {
    void speak() {
        System.out.println("");
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat();
        c.speak();
    }
}
```

```text
Main.java:8: error: speak() in Cat cannot override speak() in Animal
    void speak() {
  overridden method is final
```

念作：**「长辈那一手是钉死的——它不许你盖掉。」**

挂在类定义头上，就是不许别人拿它往下套：

```java
final class Animal {
    String name;
}

class Cat extends Animal {
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat();
        c.name = "张三";
    }
}
```

```text
Main.java:5: error: cannot inherit from final Animal
class Cat extends Animal {
```

念作：**「这张类定义钉死了，不许再往下套新类定义。」**

这两条听起来像在跟别人过不去，其实用意是**上锁**：我们写好的关键那一手（比如算钱、算数据数量的那一手），不想被谁顺手改掉；我们画好的一个类定义，不想被人套出个奇奇怪怪的后代。`final` 就是我们自己贴上去的封条。

## 六、常量：全院子共用、又钉死的那一份

把今天学的两样合起来用，就得到了一个特别常见的东西——**常量**：

```java
class Cat {
    static final int MAX_FISH = 3;

    String name;

    Cat(String name) {
        this.name = name;
    }

    void eat(int fish) {
        if (fish > MAX_FISH) {
            System.out.println(name + "：太多啦，一顿最多 " + MAX_FISH + " 条");
        } else {
            System.out.println(name + "：处理了 " + fish + " 条");
        }
    }
}

public class Main {
    public static void main(String[] args) {
        Cat a = new Cat("张三");
        a.eat(2);
        a.eat(9);
        System.out.println("上限是 " + Cat.MAX_FISH + " 条");
    }
}
```

```text
张三：处理了 2 条
张三：太多啦，一顿最多 3 条
上限是 3 条
```

`static final int MAX_FISH = 3;` 这一行是两个词各管一半：

- **`static`**：整张类定义一共就这一格，全院子共用；
- **`final`**：钉死，谁都不许改。

两样加起来就是「**全院子共用、又谁都改不了**」的一条规矩——这正是「一顿最多三条」这种数该待的地方：**要改就只改这一处，改完全院立刻都按新规矩来**。

我们给自己定的写法：常量的名字**全用大写字母，词和词之间用小下划线**（`MAX_FISH`），念的时候挂上类定义名（`Cat.MAX_FISH`）。这样一眼就看得出「这不是哪个对象的格子，是全院子钉死的规矩」。

想改它？编译器拦得比 `final` 家当还严一点：

```java
class Cat {
    static final int MAX_FISH = 3;
}

public class Main {
    public static void main(String[] args) {
        Cat.MAX_FISH = 5;
    }
}
```

```text
Main.java:7: error: cannot assign a value to static final variable MAX_FISH
        Cat.MAX_FISH = 5;
```

顺手对上上一课：我们在那张对照表里写过「约定里写下的家当，天然是全院子共用、谁都不许改的」——现在你知道那句话说的是什么了，就是这里的 `static final` 。

::: tip 提示

1. **只跟「类定义」有关、跟具体哪个对象无关的事**，就请 `static` 出来：一共初始化了几个、全院子共用的上限、总开关。
2. **共用的那一份一律用类定义名念**：`Cat.count`、`Cat.MAX_FISH`。别写 `a.count`——它改的还是同一份，只会骗到读代码的人。
3. **`main` 是 `static` 方法**：程序起步时一个对象都没有，所以入口只能是不需要对象也能引用的那种方法。
4. **`final` 是「只填一次、往后锁死」**：要么在声明那一行填，要么在初始化那一手里填，两条总得占一条。
5. **常量 = `static final`**，名字全大写加下划线，要改只改一处。
:::

::: warn 注意

- **`static` 方法里碰每个对象自己的格子**，撞的是 `non-static variable name cannot be referenced from a static context`——连 `this` 都写不了。
- **共用的格子忘了挂类定义名**（在 `main` 里直接写 `count`），撞的是 `cannot find symbol`，底下那行 `location: class Main` 会告诉你「我们是在 `Main` 里找的，可这一格不在 `Main` 上」。
- **钉死的格子没人填**，撞的是 `variable name might not have been initialized`——注意它指的是**初始化那一手写完的时候**还没填上。
- **改钉死的格子**，撞的是 `cannot assign a value to final variable ...`；改的是全院子共用的那种，还会多出来一个词：`cannot assign a value to static final variable ...`。
- **盖掉钉死的方法**、**往下套钉死的类定义**，撞的是 `... cannot override ...`（底下跟一句 `overridden method is final`）和 `cannot inherit from final ...`。
- **别给每个对象各有一份的东西加 `static`**：名字、这个对象自己的条数加了它，三个对象会互相覆盖，只剩下最后生的那一个。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `static int count = 0;`（类定义里） | 整张类定义共用一份的格子，起步的数就写在这儿，不用在外面再补一行 |
| `Cat.count` | 「`Cat` 这张类定义上的 `count`」，一共只有一份 |
| `a.count = 100;` | 编译器认这种写法，可改的还是**那同一份**——不是 `a` 自己的一格 |
| `static int howMany() { return count; }` | 挂在类定义上的方法：碰共用的格子没问题 |
| `static int howMany() { return name.length(); }` | 挨拦：`non-static variable name cannot be referenced from a static context` |
| `return this.count;`（在 `static` 方法里） | 挨拦：`non-static variable this cannot be referenced from a static context` |
| `public static void main(String[] args)` | 入口必须是这种「不需要对象也能调用」的方法 |
| `final String name;`（在初始化那一手里填） | 初始化时钉死：填过一次，往后谁都不许改 |
| `name = "王五";`（改钉死的家当） | 挨拦：`cannot assign a value to final variable name` |
| `final void speak()` | 这一手钉死了，子类不许重写：`overridden method is final` |
| `final class Animal` | 这张类定义钉死了，不许往下套：`cannot inherit from final Animal` |
| `static final int MAX_FISH = 3;` | 常量：全院子共用、又谁都改不了的那一份 |
| `Cat.MAX_FISH = 5;` | 挨拦：`cannot assign a value to static final variable MAX_FISH` |

## 小任务

1. 把第一节那段里的 `Cat.count` 换成 `a.count`，真跑一次看看结果变不变；再把 `a.count = 100;` 那一手自己试一遍，看看另外一个对象是不是也「看见」了。
2. 给类定义加一格共用的 `static int total;`，在初始化那一手里把这个对象的条数加进去；再写一个 `static int getTotal()` 把它返回。**起步的数别忘了写在类定义里。**
3. 把第三节「回到钩子」那段里的 `name` 改成 `this.name`，真跑一次，把编译器的原话抄进记录表——重点是记住：`static` 方法里没有「我们自己」。
4. 试着把第四节那段初始化那一手里的 `this.name = name;` 删掉（`final` 那一行留着），真跑一次，看看编译器说什么。这一条就是为了让你记住：**钉死的格子必须有人填，而且只在初始化那一手填一次**。
5. 把第六节那段里的 `static final` 拆成两半试两次：先只留 `static`（改成 `static int MAX_FISH = 3;`），真跑一次，看看 `Cat.MAX_FISH = 5;` 那一行还拦不拦；再只留 `final`，看看 `Cat.MAX_FISH` 这种念法还认不认。想一想这两个词各自管的是什么。

下一课，我们要讲一件怪事：本该只是「一颗数据」的一个数，怎么摇身一变，成了**会自己出招的实例**——还有它跟「数组」之间那种自动来回的本事 
