---
id: java-stage2-01
lang: java
stage: 2
order: 1
title: 封装与访问修饰符
tags: [面向对象, 封装]
required: ["java-stage1-15"]
crossRefs: []
estMinutes: 25
keywords: [private, public, getter, setter]
---

## 学习目标

本课学习封装与访问修饰符。重点包括private/public/protected、getter/setter、封装意义。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```java
class Cat {
    String name;
    int fish;
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat();
        c.name = "张三";
        c.fish = -5;
        System.out.println(c.name + " 有 " + c.fish + " 条数据");
    }
}
```

```text
张三 有 -5 条数据
```

## 一、盖子开了给谁，由我们说了算

盖子的正式名字叫**封装**：家当还是那些家当，只是我们给盒子配了盖子，**盖子开给谁、关着不给谁，是我们自己定的规矩**。别人想动里面的东西，得走我们留的那扇小窗。

Java 的盖子上有四档锁，写在一行家当的最前面：

| 写在最前面 | 谁伸得进手 |
|---|---|
| `private` | **只有这张类定义自己** —— 类定义里写的方法能用，出了这张类定义谁都别想 |
| 什么都不写 | 同一个外卖箱（包）里的邻居也能伸手 —— 我们今天先不用这一档 |
| `protected` | 我们自己，再加上照这张类定义往下再画的子类（下一课就学怎么画） |
| `public` | 谁都能伸手 —— 等于没盖子 |

四个词都叫**访问修饰符**：它管的就是「**这扇门，允许谁进去**」这一件事。

## 二、给账本盖上盖子，再开两扇小窗

我们把两样家当都盖上，另外留两扇小窗：

```java
class Cat {
    private String name;
    private int fish;

    Cat(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public int getFish() {
        return fish;
    }

    public void setFish(int fish) {
        if (fish < 0) {
            System.out.println("数据数不能是负的");
            return;
        }
        this.fish = fish;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三");
        c.setFish(-5);
        c.setFish(3);
        System.out.println(c.getName() + " 有 " + c.getFish() + " 条数据");
    }
}
```

```text
数据数不能是负的
张三 有 3 条数据
```

一行一行看：

- **`private String name;`** —— 名字这盒盖子扣上了，出了这张类定义谁都伸不进手。
- **`Cat(String name) { this.name = name; }`** —— 初始化那一手**在类定义里面**，所以它伸手拿自己的私房家当**完全合法**。可见盖子拦的是「外面的人」，不是「我们自己」。
- **`public String getName() { return name; }`** —— 这就是一扇小窗：外面调用一次 `c.getName()`，我们替它把名字**读**出来。方法的身子在类定义里，所以它伸得进手。
- **`public void setFish(int fish) { ... }`** —— 这是**进货口**。外面想把数据数改掉，只能从这里递进来。我们在门口立了块名称：**小于 0 的一律不收**。
- **`c.setFish(-5);`** —— 递进来的是负数，被门口的名称挡回去了，只印了一句提示，账本上**一个字都没改**。
- **`c.setFish(3);`** —— 这一笔收下了，账本才从 0 变成 3。

最后一行的 `张三 有 3 条数据` 就是证据：那笔坏账**根本没进盒子**。

**这两扇小窗是有名字的**：专门读的叫 `get` 开头的方法（读名字用 `getName`、读数据数用 `getFish`），专门写的叫 `set` 开头的方法（写名字用 `setName`、写数据数用 `setFish`）。这个起名习惯是 Java 世界里传下来的老规矩，谁看都知道它是干什么的，别自己另起名。

那笔坏账到底是在哪一步被挡回去的、盒子里的数有没有偷偷变过，我们拆成一步一步走给你看：

```demo
title: 递一笔坏账进进货口，盒子里的数会不会变
code:
| class Cat {
|     private int fish;
|
|     public int getFish() {
|         return fish;
|     }
|
|     public void setFish(int fish) {
|         if (fish < 0) {
|             System.out.println("数据数不能是负的");
|             return;
|         }
|         this.fish = fish;
|     }
| }
|
| Cat c = new Cat();
| c.setFish(-5);
| c.setFish(3);
| System.out.println(c.getFish());

step 先把盖子扣上
at: 2
say: private int fish; —— 数据数这盒家当扣上了盖子。private 的意思是「只有这张类定义自己伸得进手」：类定义里写的方法能用它，出了这张类定义，谁都别想。
meow: fish 是 private，外部不能直接访问。
pose: expect
盒子里的数 = 0（刚初始化就是这个）
递进来的料 = （还没递）
外面推得动的门 = （一扇都还没有）

step 类定义里的方法伸自己的手，合法
at: 5
say: getFish() 是类定义上留下的一扇读的小窗。它念的 return fish; 是类定义里面的方法 —— 伸自己的手拿自己家的家当，完全合法。盖子拦的是外面的人，不拦自己。
meow: getFish 提供读取入口。
pose: expect
盒子里的数 = 0
递进来的料 = （还没递）
外面推得动的门 = 读窗 getFish（只读）

step 唯一能改数的那扇门：进货口
at: 8
say: setFish(int fish) 是进货口。外面想把数据数改掉，只有这一条路 —— 门开在类定义上，可料必须从门外递进来。
meow: setFish 提供修改入口。
pose: expect
盒子里的数 = 0
递进来的料 = （还没递）
外面推得动的门 = 进货口 setFish（唯一能改）

step 门口立着一个名称
at: 9
say: 进货口里第一句就是我们立的名称：if (fish < 0) —— 小于 0 的一律不收。规矩写在类定义里，不指望别人自觉。
meow: 入口处校验不能小于 0。
pose: think
盒子里的数 = 0
递进来的料 = （还没递）
外面推得动的门 = 进货口 + 门口的名称

step 把一笔 -5 顺着门递进去
at: 18
say: c.setFish(-5); 把 -5 递了进来。这一递，活儿就交给了类定义里那一手：门外的人只能递料，改数那一下得由类定义里的方法自己动手。
meow: 调用 setFish(-5)。
pose: expect
盒子里的数 = 0
递进来的料 = -5（正递着）
外面推得动的门 = 进货口 + 门口的名称

step 名称先问一句
at: 9
say: 门口那块名称当场一算：-5 小于 0 吗 —— 答「是」。名称认出了这笔坏账，下面就不能再往下走了。
meow: -5 小于 0，校验不通过。
pose: think
盒子里的数 = 0
递进来的料 = -5（被名称拦下）
外面推得动的门 = 进货口 + 门口的名称

step return 一跑，装数那句根本没轮到
at: 11
say: return; 的意思是「这一手到此为止」—— 它一跑，底下装数的 this.fish = fish; 就没轮到。所以盒子里一点没动，还是 0：坏账不是「悄悄进去了」，是被拦在门外了。
meow: return 结束，值没有改变。
pose: think
盒子里的数 = 0
递进来的料 = -5（没进去）
外面推得动的门 = 进货口 + 门口的名称

step 再递 3：这回放行
at: 19
say: c.setFish(3); 又递一笔。名称一算，3 不小于 0，没拦它的路 —— 装数那句真的跑到了，盒子里的数这才从 0 变成 3。同一扇门，一笔进不来、一笔进来了，差别全在门口那块名称。
meow: setFish(3) 通过校验。
pose: yay
盒子里的数 = 3
递进来的料 = 3（收下了）
外面推得动的门 = 进货口 + 门口的名称

step 隔着读窗调用一次，屏幕上印出 3
at: 20
say: System.out.println(c.getFish()); 外面自己够不着那盒家当，只能隔着读窗调用一次，由类定义里的方法替它把数取出来 —— 屏幕上印出 3。这就是加盖子最值钱的地方：数字怎么变，规矩说了算。
meow: 通过 getFish 读取 3。
pose: proud
盒子里的数 = 3
递进来的料 = （读窗只取不改）
外面推得动的门 = 读窗 getFish（只读）
```

**能推的门就这几扇**：读的走 `getXxx`、写的走 `setXxx`，坏账连门都进不来。要是不走小窗、直接伸手够外面的 `c.fish` 呢？那是**编译的时候**就被拦下，程序一趟都跑不起来 —— 下一节就撞。

## 三、隔着盖子伸手，编译器当场拦下

我们试过不走小窗、直接伸手 —— 结果连编译那一关都过不去：

```java
class Cat {
    private String name;

    Cat(String name) {
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
Main.java:12: error: name has private access in Cat
        System.out.println(c.name);
                            ^
1 error
```

原话念起来是：**「`name` 是 `Cat` 自己的私房家当，外面的人不许直接碰。」**

有一件事要记牢：这颗钉子是在**编译器编译的时候**就钉下来的 —— 程序**一趟都没跑**，javac 直接不让它初始化。

::: warn 注意

- **盖子拦的是外面，不拦自己。** 类定义里的方法、还有初始化那一手，伸手拿 `private` 家当照样合法 —— 上面第二节那手 `this.name = name;` 就是活证据。
- **这颗钉子是编译期钉的，不是运行期炸的。** 你会先看到 `error:` 原话，然后才发现程序压根没跑起来 —— 和「跑到一半才翻车」完全不一样。
- **四面盖子没有「更安全」的默认值**。什么都不写不是 `private`，是「同一个外卖箱里的邻居也能伸手」。想锁就老老实实写 `private` 。
:::

## 四、只给读的小窗，就是「只能看不能改」

小窗不是必须成对开的。有的家当我们**只想让人看**，那就只开读的那一扇：

```java
class Cat {
    private int fish;

    public int getFish() {
        return fish;
    }

    public void feed(int n) {
        fish = fish + n;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat();
        c.feed(2);
        c.feed(3);
        System.out.println(c.getFish());
    }
}
```

```text
5
```

数据数只有 `feed` 这一条路能改（喂一顿加一点），外面**没有任何一扇窗可以直接写它**。想处理数据？喂就是了 —— 想凭空把数字改成 100？没门儿。

这就是加盖子最值钱的地方：**规矩写在类定义里，而不是写在「大家自觉一点」里**。张三的账本从此只有我们能记账。

::: tip 提示

1. **家当一律先盖盖子**（`private`），要开就开小窗 —— 这是 Java 世界的默认姿势。
2. **小窗分两扇**：`getXxx` 只读、`setXxx` 才写；只开读的那扇，盒子就是「只能看不能改」。
3. **小窗是唯一的口子，也是立规矩的地方** —— 想挡住坏账，就把检查写在 `setXxx` 里（我们那块「小于 0 不收」的名称）。
4. **四个盖子词**：`private`（只有自己）、什么都不写（同外卖箱的邻居）、`protected`（自己 + 往下画的子类）、`public`（谁都能伸）。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `private String name;` | 给这盒家当扣上盖子，出了类定义谁都别想碰 |
| `public String getName() { return name; }` | 开一扇**只读**的小窗 |
| `public void setFish(int fish) { ... }` | 开一扇**可写**的小窗，顺便在门口立规矩 |
| `this.name = name;`（写在类定义里） | 自己人伸手，合法 |
| `c.name`（写在类定义外面） | 隔着盖子伸手 → `name has private access in Cat` |
| `c.setFish(-5);` 被挡回去 | 坏账连盒子都没进 —— 这就是加盖子的意义 |
| `protected` | 自己 + 照这张类定义往下再画的子类能用 |
| 什么都不写 | 同一个外卖箱里的邻居也能伸手（不是「更安全」） |

## 小任务

1. 给我们的 `Cat` 再加一盒盖起来的家当 `private String hobby;`（爱好），配一扇读的小窗和一扇写的小窗，创建一个对象、写下它的爱好、再读出来看看。
2. 把 `setFish` 里那块名称改成「**一次最多只收 5 条**」（超过就只印一句提示、不收），试试 `c.setFish(100)` 之后账本上还是几。
3. 把第三节那段抄进练习场，编译一次，把编译器的原话一字不差地记进记录表；再删掉那个 `private`（变成什么都不写），看看还报不报错 —— 体会一下「盖子是自己扣上的，不是天生就有的」。
4. 想一想：我们这个盒子，**只开读的那扇窗、不开写的那扇**的时候，外面的对象还有没有办法把数字改掉？（提示：实例是根据类创建出来的，我们要看看它自己的家当在哪儿。）

下一课，我们要教一个更省事的办法：**继承** —— 两张类定义上有一模一样的家当和方法，就不用抄两遍了，让小的那张天生就会父类上的一切。另外还要认识 `super` 这个小词，它是继承时最要紧的一句话 
