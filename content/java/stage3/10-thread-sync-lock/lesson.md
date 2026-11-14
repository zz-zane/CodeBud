---
id: java-stage3-10
lang: java
stage: 3
order: 14
title: 线程同步与锁
tags: [多线程, 同步, 锁]
required: ["java-stage3-09"]
crossRefs: []
estMinutes: 26
keywords: [synchronized, Lock, ReentrantLock, unlock, deadlock]
---

## 学习目标

本课学习线程同步与锁。重点包括数据竞争、synchronized、Lock、死锁直觉。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、同一本账、两个对象一起记：数会少

一个对象每记一笔，机器要替它做三下：**把账本上的数读出来、加上一、再写回去**。

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Cat 甲 = new Cat("张三", 100000);
        Cat 乙 = new Cat("李四", 100000);

        甲.start();
        乙.start();

        甲.join();
        乙.join();

        System.out.println("账本：" + Cat.账本 + " 条");
    }
}

class Cat extends Thread {
    static int 账本 = 0;

    String 名字;
    int 要记;

    Cat(String 名字, int 要记) {
        this.名字 = 名字;
        this.要记 = 要记;
    }

    public void run() {
        for (int i = 0; i < 要记; i++) {
            账本 = 账本 + 1;
        }
    }
}
```

`账本` 那一格摆在类定义上，还带了个 `static`，读作「**这一格只有一份，照这张类定义长的对象都共用它**」—— 两个对象记的是同一本账。一个十万笔、另一个也十万笔，加起来该是 `200000`。

我们连跑了十趟，机器给回来的数是 `155425`、`115001`、`133833`、`155807`、`155281`、`140005`、`140703`、`131162`、`149183`、`136272` —— **一趟都没到 `200000`**，最惨的一趟连十五万五都摸不到。

不是哪个对象偷懒，是那三下**中间被插了队**：两个对象同时读到 `100000`，各自加一，各自写回 `100001` —— 其中一次加数就这么凭空没了。就像两个人同时写同一本账，甲写完、乙又照着自己刚才看到的旧数写了一遍。

::: warn 注意

**这一节我们一个字的标准答案都没写。** 十趟十个样，写死哪一个都是假的。

这一课的坑跟上一课不一样：上一课是活**没人干**；这一课是活**干了、记丢了**。它不红不响、跑完收工，只有账本上的数不对 —— 所以更难发现。

:::

## 二、给这段活上锁

毛病出在「读出来、加一、写回去」这一套动作**不许两个对象一起做**。那就立个规矩：**一次只许一个对象进去记，进去的那一个没出来之前，别的对象在门口等。**

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Cat 甲 = new Cat("张三", 100000);
        Cat 乙 = new Cat("李四", 100000);

        甲.start();
        乙.start();

        甲.join();
        乙.join();

        System.out.println("账本：" + Cat.账本 + " 条");
    }
}

class Cat extends Thread {
    static final Object 账本锁 = new Object();
    static int 账本 = 0;

    String 名字;
    int 要记;

    Cat(String 名字, int 要记) {
        this.名字 = 名字;
        this.要记 = 要记;
    }

    public void run() {
        for (int i = 0; i < 要记; i++) {
            synchronized (账本锁) {
                账本 = 账本 + 1;
            }
        }
    }
}
```

```text
账本：200000 条
```

多出来的就是那一对括号里的东西：`synchronized (账本锁) { ... }`，读作「**这一段，一次只许一个对象进来**」。

- **`账本锁` 是我们专门造出来当锁用的**：`static final Object 账本锁 = new Object();` —— 它上面不记任何东西，就管「谁在里面」。
- **要抢的必须是同一把锁。** `账本锁` 带 `static`，所以照这张类定义长的对象共用这一把；要是每个对象各造一把自己留着，就成了各锁各的门，谁也拦不住谁。
- **进不去的对象在门口等**，等到里面那个出来再进去 —— 等，不是丢下活走了。
- **锁只护住这一小段。** 那十万次转圈在锁外面，一次一次地进去、记一笔、出来。锁是「一圈只放一个对象」用的，不是把整段活全锁上。

这一对括号到底是怎么护住那三下的，我们拆成一步一步走给你看：

```demo
title: 一把锁一次只放一个对象：谁在里面、谁在门口等
code:
| class Cat extends Thread {
|     static final Object 账本锁 = new Object();
|     static int 账本 = 0;
|
|     String 名字;
|     int 要记;
|
|     Cat(String 名字, int 要记) {
|         this.名字 = 名字;
|         this.要记 = 要记;
|     }
|
|     public void run() {
|         for (int i = 0; i < 要记; i++) {
|             synchronized (账本锁) {
|                 账本 = 账本 + 1;
|             }
|         }
|     }
| }
|
| Cat 甲 = new Cat("张三", 100000);
| Cat 乙 = new Cat("李四", 100000);
|
| 甲.start();
| 乙.start();
|
| 甲.join();
| 乙.join();
|
| System.out.println("账本：" + Cat.账本 + " 条");

step 先造那把锁
at: 2
say: `static final Object 账本锁 = new Object();` —— 这把锁是我们专门造出来当锁用的：它上面不记任何东西，就管「谁在里面」。**`static` 是最要紧的一笔**，照这张类定义长的对象**共用这一把**。
meow: 静态 final 对象作为锁。
pose: expect
账本 = （还没摆出来）
两个对象 = （还没画）
锁在谁手上 = （刚造好，没人拿）
门口等着谁 = （没人）

step 账本也只有一份
at: 3
say: `static int 账本 = 0;` 也带 `static`，读作「**这一格只有一份，照这张类定义长的对象都共用它**」。两个对象记的是**同一本**账 —— 这一节要护住的就是它。
meow: 账本是共享的静态变量。
pose: expect
账本 = 0
两个对象 = （还没画）
锁在谁手上 = （还没人拿）
门口等着谁 = （没人）

step 画两个对象，各领十万笔
at: 22
say: `Cat 甲 = new Cat("张三", 100000);` 和紧接着的下一行，各画一个对象：递名字、递「这一趟要记**十万笔**」。两个要记的笔数一样多，都记完该是 `200000`。
meow: 创建两个线程，各加十万次。
pose: expect
账本 = 0
两个对象 = 甲、乙都画好了，各要记 100000 笔
锁在谁手上 = （还没人拿）
门口等着谁 = （没人）

step 派两个出去，各转各的
at: 25
say: `甲.start();`、`乙.start();` 两句把它们派出去 —— **派完我们就往下走了**。两个对象各转各的十万圈，谁先转到第几圈，我们写不了保证书。
meow: 启动两个线程。
pose: busy
账本 = 0
两个对象 = 都派出去了，各转各的
锁在谁手上 = （还没人拿）
门口等着谁 = （没人）

step 甲撞上锁：门里没人，进去
at: 15
say: 甲转到某一圈，撞上 `synchronized (账本锁) {`：门里没人，甲**推门进去了**。这一对括号读作「**这一段，一次只许一个对象进来**」。
meow: 甲获得锁，进入同步块。
pose: busy
账本 = 0
两个对象 = 都在转圈（甲撞上锁，进去了）
锁在谁手上 = 甲（张三）
门口等着谁 = （还没人）

step 乙也撞上同一句：门口等
at: 15
say: 乙也转到同一句，可门里有人 —— **乙进不去，在门口等**。注意是「等」，不是把活丢下走了：等甲出来，乙立刻接上。（这一趟是甲先到；也可能乙先到，门里永远只有一个就对了。）
meow: 乙等待锁。
pose: think
账本 = 0
两个对象 = 都在转圈（乙也到了门口）
锁在谁手上 = 甲（张三）
门口等着谁 = 乙（李四）

step 甲在门里记这一笔：先读出来、加上一
at: 16
say: 门里做的是 `账本 = 账本 + 1;`。机器替甲做三下：**读出来**（读到 0）、**加上一**（手里捏着 1）、**写回去**。这一步只做完前两下 —— **账本那一格还是 0**，我们手里捏着 1。
meow: 甲读取并加一。
pose: busy
账本 = 0（还没写回去）
两个对象 = 都在转圈
锁在谁手上 = 甲（张三）
门口等着谁 = 乙（李四）

step 第三下：写回去
at: 16
say: 第三下**写回去**：账本从 0 变成 1。**这三下是被那对括号圈成一整块的** —— 甲做完整块之前，乙连第一下都别想开始。第一节丢数丢的就是这道缝，这里它没了。
meow: 写回 1，操作不会被打断。
pose: yay
账本 = 1
两个对象 = 都在转圈
锁在谁手上 = 甲（张三）
门口等着谁 = 乙（李四）

step 甲出锁，乙立刻接手
at: 17
say: 甲出了这一对括号，锁放下 —— 门口等着的乙**立刻接手进去**。一圈就是这么走完的：撞锁、等、三下、出锁。
meow: 甲释放锁，乙进入。
pose: busy
账本 = 1
两个对象 = 都在转圈（乙进去了）
锁在谁手上 = 乙（李四）
门口等着谁 = （没人）

step 一圈一圈，十万圈都这么来
at: 14
say: 一圈走完，控制回到 `for` 那一行接着转 —— 后面九万九千九百九十九圈，每一圈都是刚才这四步。锁护着的只是「读-加-写」那一小段：**十万次转圈都在锁外面**，一次一次地进去、记一笔、出来。
meow: 循环重复这个过程。
pose: busy
账本 = 一圈一笔地涨（还没数完）
两个对象 = 各转各的，轮着进出锁
锁在谁手上 = 甲、乙轮着拿
门口等着谁 = 轮着等

step 站门口等两个都回来
at: 28
say: `甲.join();`、`乙.join();` 是「**站门口等它俩都回来**」。两句都过了才轮到印 —— 不 join 就印，印出来的数说不准（第一节那十趟就是这么飘的）。
meow: join 等待两者结束。
pose: expect
账本 = 200000（两半都记完了）
两个对象 = 都转完了，各十万圈
锁在谁手上 = （没人拿）
门口等着谁 = （没人）

step 印出账本
at: 31
say: 印出来是 `账本：200000 条` —— **一笔都没丢**。对照第一节那把没上锁的版本：课文里连跑十趟，十趟都没到 200000。同一段活，差别只在那对括号上。
meow: 输出 200000，没有丢失。
pose: proud
账本 = 200000
两个对象 = 都转完了
锁在谁手上 = （没人拿）
门口等着谁 = （没人）
```

**这一节就记一件事**：`synchronized (账本锁) { ... }` 把「读出来、加一、写回去」三下圈成一整块，一次只放一个对象进去；门口等着的对象是**等**，不是丢下活走了。第一节那把没上锁的版本，丢数就丢在这道缝里。

## 三、把锁上在「记一笔」这件事上

上一节那把锁是我们自己造的。还有一种写法：**把锁直接上在「记一笔」这件事上**，谁要记谁就得先经过这儿。

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Cat 甲 = new Cat("张三", 100000);
        Cat 乙 = new Cat("李四", 100000);

        甲.start();
        乙.start();

        甲.join();
        乙.join();

        System.out.println("账本：" + Cat.账本 + " 条");
    }
}

class Cat extends Thread {
    static int 账本 = 0;

    String 名字;
    int 要记;

    Cat(String 名字, int 要记) {
        this.名字 = 名字;
        this.要记 = 要记;
    }

    public void run() {
        for (int i = 0; i < 要记; i++) {
            记一笔();
        }
    }

    static synchronized void 记一笔() {
        账本 = 账本 + 1;
    }
}
```

```text
账本：200000 条
```

`static synchronized void 记一笔()` 里的 `synchronized` 读作「**这一刻只许一个对象进来**」：两个对象都得排这一把锁，排到了才能记上一笔。这里的锁不是我们造的，是**这张类定义自己**—— 照它长的对象共用的还是同一把。

::: warn 注意

**那个 `static` 千万不能漏。** 我们试过把 `static` 去掉（写成 `synchronized void 记一笔()`）：锁就从「这张类定义」变成了「**每一个对象自己**」—— 两个对象各锁各的，等于没锁。

去掉 `static` 之后我们连跑五趟，数分别是 `186957`、`188092`、`194944`、`172659`、`177409`，一趟都没到 `200000`。**看着有锁，其实拦不住谁。**

:::

## 四、自己拿自己放：`Lock`

还有一路写法：**锁不用关键字，改成一个手动的**。我们自己拿、自己放，但拿和放必须配对。

```java
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class Main {
    public static void main(String[] args) throws Exception {
        Cat 甲 = new Cat("张三", 100000);
        Cat 乙 = new Cat("李四", 100000);

        甲.start();
        乙.start();

        甲.join();
        乙.join();

        System.out.println("账本：" + Cat.账本 + " 条");
    }
}

class Cat extends Thread {
    static final Lock 锁 = new ReentrantLock();
    static int 账本 = 0;

    String 名字;
    int 要记;

    Cat(String 名字, int 要记) {
        this.名字 = 名字;
        this.要记 = 要记;
    }

    public void run() {
        for (int i = 0; i < 要记; i++) {
            锁.lock();
            try {
                账本 = 账本 + 1;
            } finally {
                锁.unlock();
            }
        }
    }
}
```

```text
账本：200000 条
```

- **`static final Lock 锁 = new ReentrantLock();`** —— 造一把手动锁。它跟 `synchronized` 干的是一件事，只是**拿和还要我们自己写**。
- **`锁.lock();` 是拿**：别人拿着的时候，这一句会一直等着，等到拿上为止。
- **`锁.unlock();` 是还**：记完必须还，不然别的对象永远等在门口。
- **`unlock` 摆在 `finally` 里最稳**：`finally` 读作「**不管中间顺不顺，收尾这一下都得做**」。万一加数那一段出了岔子，锁照样还回去；直接写在后面，出了岔子就还不上了。

## 五、一次要拿两把锁：次序要统一

有时候一个对象要动两样东西：先拿元素、再拿账本，两样都拿到了才记一笔。这时候**次序**成了天大的事。

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Cat 甲 = new Cat("张三");
        Cat 乙 = new Cat("李四");

        甲.start();
        乙.start();

        甲.join();
        乙.join();

        System.out.println("账本：" + Cat.账本 + " 条");
    }
}

class Cat extends Thread {
    static final Object 元素锁 = new Object();
    static final Object 账本锁 = new Object();
    static int 账本 = 0;

    String 名字;

    Cat(String 名字) {
        this.名字 = 名字;
    }

    public void run() {
        synchronized (元素锁) {
            synchronized (账本锁) {
                账本 = 账本 + 1;
            }
        }
    }
}
```

```text
账本：2 条
```

这一份里，**两个对象都是先拿元素、再拿账本** —— 次序一模一样，所以谁也等不到谁，两笔都记上了。

要是次序反着来呢？一个先拿元素、另一个先拿账本，那就有可能：**甲攥着元素不放、等着账本；乙攥着账本不放、等着元素** —— 两个都在等对方先撒手，永远等下去。书上管这个叫「**死锁**」。

::: warn 注意

**那个反着次序的版本我们不在这里真跑。** 它不红、不报错、也不自己停 —— 我们这边的机器会一直等到超时，白等一场，什么也看不见。

所以你只要记住一条：**要拿两把锁，就所有对象都按同一个次序拿**；要动两样东西，就把次序在类定义上写死。次序统一，就没有「各攥一把互不相让」的机会。

:::

## 六、空锁：光起了名字，没造锁

最后说一个最容易栽的跟头：

```java
public class Main {
    public static void main(String[] args) throws Exception {
        Cat 一个 = new Cat("张三", 5);

        一个.start();
        一个.join();

        synchronized (Cat.锁) {
            Cat.账本 = Cat.账本 + 1;
        }

        System.out.println("账本：" + Cat.账本 + " 条");
    }
}

class Cat extends Thread {
    static Object 锁;
    static int 账本 = 0;

    String 名字;
    int 要记;

    Cat(String 名字, int 要记) {
        this.名字 = 名字;
        this.要记 = 要记;
    }

    public void run() {
        for (int i = 0; i < 要记; i++) {
            synchronized (锁) {
                账本 = 账本 + 1;
            }
        }
    }
}
```

```text
Exception in thread "main" java.lang.NullPointerException: Cannot enter synchronized block because "Cat.锁" is null
```

机器这句话读作「**这个叫 `Cat.锁` 的东西是空的，进不去**」。我们只写了 `static Object 锁;` —— **名字起了，锁没造**。空着的东西当然不能当锁用。

造一把锁得写全：`static final Object 锁 = new Object();`（`new Object()` 那一下才是真造出来）。顺一句：那个对象也偷偷在旁边报了同样的一句话 —— 它比母对象更早撞上这堵墙，只是母对象这边也撞了，才闹到整段程序停住。

::: tip 提示

1. **书上管这一套叫「同步」**：几个对象按规矩轮流用同一个东西，不抢、不丢。
2. **抢同一本账 = 记丢**：读出来、加一、写回去，这三下中间被插队就少一笔。
3. **`synchronized (锁) { ... }` 一次只许一个对象进去**，别的对象在门口等。
4. **锁必须是同一把**：`static` 那一把才是大家共用的。每个对象各造一把 = 没锁。
5. **`Lock` 要自己拿自己放**，`unlock` 摆在 `finally` 里最稳。
6. **要拿两把锁，次序统一**，不然可能僵住（死锁）。

:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `static int 账本 = 0;` | 大家一起用的那一格账 |
| `static final Object 账本锁 = new Object();` | 造一把大家共用的锁 |
| `synchronized (账本锁) { ... }` | 这一段一次只许一个对象进来 |
| `static synchronized void 记一笔()` | 把锁上在「记一笔」这件事上 |
| 把那个 `static` 去掉 | 锁变成每个对象自己那一把 = 没锁 |
| `锁.lock();` | 拿锁（拿不到就在门口等） |
| `锁.unlock();` | 还锁（摆在 `finally` 里最稳） |
| 两个对象按**不同**次序拿两把锁 | 可能僵住（死锁） |

## 小任务

1. 第一节那个不上锁的版本多跑几趟，看印出来的数一趟一个样（我们跑十趟，十趟没重过样）。
2. 第二节那个版本，把 `账本锁` 改成每个对象自己造一把（把 `static` 去掉、在类定义上 `new Object()`），跑几趟看看锁还管不管用。
3. 第三节那个版本，把 `static` 去掉再跑几趟 —— 亲眼看看「有锁也拦不住」是什么样。
4. 第四节那个版本，把 `finally` 那一句挪出来、直接写在加数后面，想想我们为什么非要它待在 `finally` 里。
5. 第五节那个版本，把两个对象拿两把锁的次序改成一正一反，跑一下感受「僵住」—— 跑之前先想好怎么停它（我们这边的规矩是别让闸门等到超时）。

下一课，我们不再一个一个地派人：工作区边上备**一队随叫随到的对象**，干完一趟不散伙、下回接着使；还有几样现成的家什，能让几个对象「等齐了一起走」。队伍怎么排、排多长、等不齐怎么办，下课我们细说。
