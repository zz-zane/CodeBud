---
id: java-stage3-09
lang: java
stage: 3
order: 13
title: 多线程：Thread 与 Runnable
tags: [多线程, 并发, 生命周期]
required: ["java-stage3-08"]
crossRefs: []
estMinutes: 26
keywords: [Thread, Runnable, start, join, run]
---

## 学习目标

本课学习多线程：Thread 与 Runnable。重点包括线程概念、创建方式、生命周期。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、派一个对象：`Thread`

先看一个对象是怎么派出去的：

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Cat 一个 = new Cat("张三");

        一个.start();
        一个.join();

        System.out.println("我们这边接着干活");
    }
}

class Cat extends Thread {
    String 名字;

    Cat(String 名字) {
        this.名字 = 名字;
    }

    public void run() {
        System.out.println(名字 + "捞到一条");
    }
}
```

```text
张三捞到一条
我们这边接着干活
```

三个动作，各管一件：

- **`class Cat extends Thread`** —— 类定义名字后面接上 `extends Thread`，读作「**照这张类定义长出来的，就是一个会干活的对象**」。`Thread` 是 Java 里「一路活」的家什，我们不用自己造它，只要在类定义上多写一段：
- **`public void run()`** —— 这段里写的是「**这个对象要去干的那件活**」。我们这个对象的活很简单：捞一条，印一行，干完自己就结束了。注意它**没有** `static`、也**不能少** `public` —— 它就是类定义上的一段活，写法是定死的。
- **`一个.start()`** —— 「派它出去开跑」。这一句一调用，我们这条线继续往下走，被派出去的对象**自己也在往下走** —— 两路同时进行，这就是今天的全部魔法。

还有第四样，落在最后：

- **`一个.join()`** —— 「**站在这儿等它干完**」。我们要是把这一句去掉，母对象很可能在对象还没印出那一行之前就跑到下面去了（「我们这边接着干活」先冒出来）。要按次序印，就得等。

## 二、两个一起派：谁先说话，说不准

再看派两个：

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Cat 甲 = new Cat("张三");
        Cat 乙 = new Cat("李四");

        甲.start();
        乙.start();

        甲.join();
        乙.join();

        System.out.println("两个都回来了");
    }
}

class Cat extends Thread {
    String 名字;

    Cat(String 名字) {
        this.名字 = 名字;
    }

    public void run() {
        System.out.println(名字 + "捞到一条");
    }
}
```

这两句 `println` 的**先后，我们不写给你** —— 因为写不了。

我们自己连跑了五趟：其中两趟是李四那一行先冒出来，另外三趟是张三先冒出来。同一份代码、同一台机器，先后就是这么飘。原因不神秘：`start()` 只负责「把它派出去」，派出去之后，两个对象**各自**往下走，谁先跑到印那一句，看机器当时先轮到谁。

::: warn 注意

**这一节的输出我们一个字都没写。** 这不是偷懒 —— 一份代码要是今天印这个次序、明天印那个次序，那**任何写死的次序都是假的**。往后你也会遇到这种程序：**它跑得对，只是先后不由你定**。

有一点可以放心：我们这两个对象各自只印**一整行**，所以不会出现「张三李四」这种粘在一起的怪行。飘的只是**行与行之间**的先后。

:::

## 三、等它们都回来：`join()` 和各自的小格子

更常见的情形是：好几个对象各自干活，母对象**等它们都回来**再汇总。这时候每一个都得有自己的**小格子**记账：

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Cat 甲 = new Cat("张三");
        Cat 乙 = new Cat("李四");

        甲.start();
        乙.start();

        甲.join();
        乙.join();

        System.out.println(甲.名字 + "捞到：" + 甲.捞到 + " 条");
        System.out.println(乙.名字 + "捞到：" + 乙.捞到 + " 条");
        System.out.println("一共：" + (甲.捞到 + 乙.捞到) + " 条");
    }
}

class Cat extends Thread {
    String 名字;
    int 捞到 = 0;

    Cat(String 名字) {
        this.名字 = 名字;
    }

    public void run() {
        for (int i = 0; i < 3; i++) {
            捞到 = 捞到 + 1;
        }
    }
}
```

```text
张三捞到：3 条
李四捞到：3 条
一共：6 条
```

这一份的次序是**稳的**，因为两处都做了安排：

- **每个对象记在「类定义上的那一格」里。** `捞到` 画在类定义上，所以**每一个对象都有一份自己的 `捞到`**：张三那个数它的三下，李四那个数它的三下，互不干扰。汇总的时候母对象问的是「张三那一个对象的格子」和「李四那一个对象的格子」，两份都对得上。
- **汇总之前先 `join()`。** 两句 `甲.join(); 乙.join();` 就是「站门口等它俩都回来」。要是把这两句挪到印汇总的后面去，母对象可能在两个对象数完之前就报数 —— 那就是另一回事了。

**哪一步是稳的、哪一步我们写不了保证书**，我们拆成一步一步走给你看：

```demo
title: 两个对象同时往下走：谁先数完说不准，join 之后才定死
code:
| class Cat extends Thread {
|     String 名字;
|     int 捞到 = 0;
|
|     Cat(String 名字) {
|         this.名字 = 名字;
|     }
|
|     public void run() {
|         for (int i = 0; i < 3; i++) {
|             捞到 = 捞到 + 1;
|         }
|     }
| }
|
| Cat 甲 = new Cat("张三");
| Cat 乙 = new Cat("李四");
|
| 甲.start();
| 乙.start();
|
| 甲.join();
| 乙.join();
|
| System.out.println(甲.名字 + "捞到：" + 甲.捞到 + " 条");
| System.out.println(乙.名字 + "捞到：" + 乙.捞到 + " 条");
| System.out.println("一共：" + (甲.捞到 + 乙.捞到) + " 条");

step 类定义上先摆好一格「捞到」
at: 16
say: `Cat 甲 = new Cat("张三");` —— `new` 一调用，类定义上那行 `int 捞到 = 0;` 就跟着摆好，装名字的 `名字` 也填上「张三」。这一格是**画在类定义上的**，所以每个对象将来各有一份自己的。
meow: 创建甲，字段是 0。
pose: expect
甲的捞到 = 0（刚摆好）
乙的捞到 = （还没画）
谁先数完 = （还没派出去）
标准输出 = 还没印

step 乙也画一个，两份格子各管各的
at: 17
say: 再画一个。乙也有一份**自己的** `捞到`，同样是 0 —— 不是跟甲共用一格。往后两个对象各数各的，谁也踩不着谁。
meow: 创建乙，有自己的字段。
pose: expect
甲的捞到 = 0
乙的捞到 = 0（也刚摆好）
谁先数完 = （还没派出去）
标准输出 = 还没印

step 派甲出去：母对象不等它
at: 19
say: `甲.start();` 读作「派它出去开跑」。这一句调用结束，我们**不等它**，立刻往下走 —— 甲在另一路跑它自己的 `run()`。从这一刻起甲数到几，我们根本不知道：可能还没动，也可能三圈都数完了。
meow: start 启动线程，主线程继续。
pose: busy
甲的捞到 = 说不准（0 到 3 之间）
乙的捞到 = 0
谁先数完 = （还不能比）
标准输出 = 还没印

step 两个都在跑了：谁先谁后说不准
at: 20
say: 第二只也派出去。**从这里开始两路同时在走**：谁先往下走、谁先数完，机器当时先轮到谁就是谁 —— 我们写不了保证书。（第二节那两个对象的先后，就是在这儿飘的。）
meow: 两个线程并发运行。
pose: busy
甲的捞到 = 说不准（0 到 3 之间）
乙的捞到 = 说不准（0 到 3 之间）
谁先数完 = 说不准（机器说了算）
标准输出 = 还没印

step 镜头切到对象那一路：同一段活跑了两份
at: 10
say: 两个对象跑的**是同一段 `run()`，跑了两份**。`for (int i = 0; i < 3; i++)` 各转各的三圈 —— 两个对象的圈与圈之间**没有任何固定次序**，我们也不给你编一个。
meow: 各自执行 run()。
pose: busy
甲的捞到 = 正在转圈（数到几都有可能）
乙的捞到 = 正在转圈（数到几都有可能）
谁先数完 = 说不准（机器说了算）
标准输出 = 还没印

step 各在自己那一格上加一
at: 11
say: 每转一圈就在**自己那一格**上加一：甲加的是甲的，乙加的是乙的，两格谁也不碰谁。两个格子跑完都会停在 3 —— 可**哪一格先到 3**，我们写不了保证书。
meow: 各加各的字段，互不影响。
pose: yay
甲的捞到 = 甲自己那一格在涨（说不准涨到几）
乙的捞到 = 乙自己那一格在涨（说不准涨到几）
谁先数完 = 说不准（机器说了算）
标准输出 = 还没印

step 镜头切回母对象：join 甲
at: 22
say: `甲.join();` 是「**站门口等甲干完**再往下走」。等它回来，甲的格子就**一定是 3** 了 —— 这是 join 给的保证。乙那边呢？还是说不准：可能也完了，可能才数到一半。
meow: join 等待甲结束。
pose: expect
甲的捞到 = 3（join 等到了，一定准）
乙的捞到 = 说不准（0 到 3 之间）
谁先数完 = 说不准（机器说了算）
标准输出 = 还没印

step 再 join 乙：两个都回来了
at: 23
say: 再等乙。两句 join 都过了，才有「两个都回来了」这句话。注意 join 只告诉你**都**回来了，**没告诉你谁先回来的** —— 那个我们到现在还是不知道。
meow: 再等待乙结束。
pose: yay
甲的捞到 = 3
乙的捞到 = 3（也等到了）
谁先数完 = 说不准（都完了，可谁先完的不知道）
标准输出 = 还没印

step 印甲那一格
at: 25
say: 现在才轮到印甲那一格：**3 条**。要是前面少写一句 `甲.join();`，这一行印出来可能是 1 或者 2 —— 母对象赶在甲数完之前就报数了。
meow: 甲的结果是 3。
pose: yay
甲的捞到 = 3
乙的捞到 = 3
谁先数完 = 说不准（都完了，可谁先完的不知道）
标准输出 = 张三捞到：3 条

step 印乙那一格
at: 26
say: 乙那一格同样是 3。两份格子各记各的才有得对 —— 这也是第一节说「每个对象的东西要放在类定义的格子里」的原因：放在母对象那边一路共用的地方，就不是这么回事了。
meow: 乙的结果也是 3。
pose: busy
甲的捞到 = 3
乙的捞到 = 3
谁先数完 = 说不准（都完了，可谁先完的不知道）
标准输出 = 张三捞到：3 条 / 李四捞到：3 条

step 汇总：6 条
at: 27
say: 汇总：3 加 3 得 6。**这一份的输出次序是稳的** —— 每个对象记自己的格子、汇总之前又先 join 等齐，两处安排都在。飘的只是「谁先数完」，不是结果。
meow: 汇总 3 + 3 = 6。
pose: proud
甲的捞到 = 3
乙的捞到 = 3
谁先数完 = 说不准（都完了，可谁先完的不知道）
标准输出 = 张三捞到：3 条 / 李四捞到：3 条 / 一共：6 条
```

**定死的只有一处**：`甲.join();`、`乙.join();` 都过了之后，两个对象各自格子里的数才作数。至于「谁先数完」—— 那个我们到收工也说不出来，机器说了算。

## 四、另一种派法：把**一段活**交给一个对象

上一节是「新定义一个类，类定义本身就是一个会跑的对象」。还有另一种派法：**不用新画对象的类定义，把一段活交给一个现成的对象**。

先说那段活长什么样 —— 它也是一个类定义，只是这张类定义上没有别的，只有一段 `run()`：

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Thread 一个 = new Thread(new FishJob("张三"));

        一个.start();
        一个.join();

        System.out.println("家什收好了");
    }
}

class FishJob implements Runnable {
    String 名字;

    FishJob(String 名字) {
        this.名字 = 名字;
    }

    public void run() {
        System.out.println(名字 + "这一趟捞完了");
    }
}
```

```text
张三这一趟捞完了
家什收好了
```

对照着看，两种派法的差别只有一处：

| | 类定义上写的 | 派出去的那一句 |
|---|---|---|
| 第一种 | `class Cat extends Thread` | `new Cat("张三").start()` |
| 第二种 | `class FishJob implements Runnable` | `new Thread(new FishJob("张三")).start()` |

- 第一种是「**对象的类定义**」：类定义名字后面接 `extends Thread`，长出来的就是一个对象。
- 第二种是「**活的类定义**」：类定义名字后面接 `implements Runnable`，读作「这张类定义写的是**一段可以交给对象去干的活**」；它自己不会跑，得**塞给一个对象**（`new Thread(那张活的类定义)`），那个对象才有名字、才能 `start()`。
- 两种派法里，那段活**都叫 `run()`**、都得是 `public void` —— 这一点是共通的。

什么时候用哪种？**只想干一段活、不打算给它记别的**，第二种更省事（不用为一段活特意画一张对象的类定义）；**这个对象身上还要带点它自己的东西**（比如我们这里要给每个对象记一个名字、记一个 `捞到`），第一种写起来更顺手。

## 五、自己动手，和派一个对象，是两件事

`run()` 和 `start()` 长得像，干的事差得远。我们真跑给你看 —— 这一份**故意**引用的是 `run()`：

```java
public class Main {
    public static void main(String[] args) {
        Cat 一个 = new Cat("张三");

        一个.run();
        System.out.println(Thread.currentThread().getName() + "：我们这边也在干活");
    }
}

class Cat extends Thread {
    String 名字;

    Cat(String 名字) {
        this.名字 = 名字;
    }

    public void run() {
        System.out.println(Thread.currentThread().getName() + "：在捞鱼");
    }
}
```

```text
main：在捞鱼
main：我们这边也在干活
```

两行**都是 `main`**。`Thread.currentThread().getName()` 问的是「**现在这一句是谁在干**」，答出来的是那路活的名字 —— 我们自己这一路叫 `main`。两行都是它，说明**根本没有对象被派出去**：那句 `一个.run()` 只是「母对象照着那张类定义，自己动手把这段活干了」。

把那一句换成 `start()`，同一段活就是对象在干了：

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Cat 一个 = new Cat("张三");

        一个.start();
        一个.join();

        System.out.println("我们这边接着干活");
    }
}

class Cat extends Thread {
    String 名字;

    Cat(String 名字) {
        this.名字 = 名字;
    }

    public void run() {
        System.out.println(Thread.currentThread().getName() + "：在捞鱼");
    }
}
```

```text
Thread-0：在捞鱼
我们这边接着干活
```

第一行变成了 `Thread-0` —— 这是机器给第一个派出去的对象起的名字，看到它就说明**这一行真的是一个对象在干**。

记住这一条：**`run()` 是「这段活本身」，`start()` 才是「派一个对象去干这段活」。** 直接调用 `run()` 不红不响、活也真干了，只是**没多出一路** —— 往后想同时干活却发现「怎么还是串着的」，多半就是这一脚。

## 六、同一个对象，不许派两次

一个对象只有一辈子。派出去、干完，它就结束了：

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Thread 一个 = new Thread(new FishJob("张三"));

        一个.start();
        一个.join();
        一个.start();

        System.out.println("这边还在往下走");
    }
}

class FishJob implements Runnable {
    String 名字;

    FishJob(String 名字) {
        this.名字 = 名字;
    }

    public void run() {
        System.out.println(名字 + "这一趟捞完了");
    }
}
```

```text
张三这一趟捞完了
Exception in thread "main" java.lang.IllegalThreadStateException
```

读作：**「这个对象的状态不对，不许再派」**。第一趟干得好好地印了一行，第二句 `start()` 当场翻脸 —— 因为它已经**干完结束了**，一个结束了的对象不能重新开跑。

想再干一趟，就得**另派一个**：`new Cat("张三").start()` 是你的事，别指望叫醒同一个。

顺一遍今天这个对象的一生：

| 时候 | 它是什么状态 | 我们做的事 |
|---|---|---|
| `new Cat("张三")` | 刚画出来，还没动 | 递名字 |
| `一个.start()` | 出去干活了 | 派它走 |
| `run()` 跑完 | 干完，结束了 | —— |
| `一个.join()` | 结束了 | 站门口等它回来 |

::: tip 提示

1. **书上管这套叫「多线程」**：好几路活同时往前走。我们这边就说「同时派好几个对象」。
2. **`run()` 写活，`start()` 派对象**，两个不能换着用。
3. **要按次序印东西、要汇总，就得先把对象 `join()` 回来。** 不 join 就直接汇总，汇总里可能少几个对象干的活。
4. **每个对象的东西要放在类定义的格子里**（`名字`、`捞到`），这样每个对象各有一份；放在母对象那边一路共用的地方就不一样了。
5. **对象干了多少活，机器说了算。** 两个对象谁先谁后、谁先印，我们写不了保证书。

:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `class Cat extends Thread` | 画一张「会干活的对象」的类定义 |
| `class FishJob implements Runnable` | 画一张「一段活」的类定义 |
| `public void run()` | 类定义上那段活本身 |
| `一个.start()` | 派一个对象出去开跑 |
| `一个.join()` | 站门口等它干完再往下走 |
| `一个.run()` | 母对象自己动手干那段活（**没派对象**） |
| `new Thread(一段活)` | 把一段活塞给一个对象 |
| `Thread.currentThread().getName()` | 问「现在这一句是谁在干」 |
| 同一个对象第二次 `start()` | 当场红：`IllegalThreadStateException` |

## 小任务

1. 把第一节那个对象原样跑一遍，再把 `join()` 那一句去掉跑一遍 —— 看看「我们这边接着干活」是不是跑到前面去了（多跑几趟，感受一下）。
2. 第二节那两个对象多跑几趟，数一数张三先冒头几趟、李四先冒头几趟 —— 亲眼确认「说不准」是什么意思。
3. 第三节那份改成三个对象：类定义不用动，多创建一个、多 `join` 一次、汇总多问一格。
4. 第五节那个 `run()` 的版本，把 `Thread.currentThread().getName()` 换成把这一行直接写死成 `"张三"` —— 想想为什么这么一改，这个坑就更难发现了。
5. 第六节那个坑，改成「另派一个新对象」再跑一遍 —— 确认第二趟干活的是一个**新**对象（名字会变成 `Thread-1` 或者别的，看机器给它起什么）。

下一课，池塘边就要热闹了：好几个对象**抢同一口元素**、记**同一本账** —— 那时候光是「派出去」还不够，我们得给它们立规矩：谁先拿到元素谁处理、拿到元素的那一个没放下之前别人不许动。要不要拿锁、锁在哪儿、锁错了会怎么样，下一课我们一次讲清。
