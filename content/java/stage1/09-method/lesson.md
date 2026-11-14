---
id: java-stage1-09
lang: java
stage: 1
order: 12
title: 方法
tags: [方法, 方法, 参数, 返回值]
required: [java-stage1-08]
crossRefs: ["common-07", "c-stage1-12", "cpp-stage1-09", "python-stage1-11"]
compare: ["common-07"]
estMinutes: 25
keywords: [方法, 参数, 返回值, static]
---

## 学习目标

本课学习方法。重点包括方法定义、调用、参数、返回值、main 的签名。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 我们的第一个方法：`greet()`

```java
public class Main {
    public static void greet() {
        System.out.println("你好");
    }

    public static void main(String[] args) {
        System.out.println("上课前");
        greet();
        System.out.println("下课后");
    }
}
```

```text
上课前
你好
下课后
```

看看我们把这一个方法摆在**哪儿**：它写在 `main` 的**上面**，而且——注意看大括号——它和 `main` 是**平起平坐的两段**，各自带着自己的花括号：

- **上面那段**就是新方法：`public static void greet()` 打头，后面跟着一对花括号，里面是这一个方法要干的活儿。
- **下面那段**还是老朋友 `main`，我们程序的入口。
- 中间那句 `greet();` 就是**调用这一个方法**：写名字，后面跟**一对小括号**，再一个分号。

调用一次，电脑就跑到 `greet` 那对花括号里，把里面的活儿干完，再回来接着跑下一句。所以屏幕上先是「上课前」、再是方法里那句「你好」、最后「下课后」——**调用一次只干一遍，回来接着往下走**。

### 方法名不是变量名

`greet()` 后面那对小括号是「调用」的记号，**不能省**。省了写成 `greet`，编译器会以为你在叫一块名称（里面保存一串字或者一个数），可是我们从来没摆过这样一块名称。

再记一条：**方法名也算我们自己起的名字**，跟摆名称的名字一样，起了 `greet` 就一路调用 `greet`；大小写也不能乱换。调用错名字，编译器照样拦。

## 把一个方法拆成五个零件

拿我们下一个方法来拆——它会返回东西回来。这一个方法的**打头那一行**是 `public static int add(int a, int b) {`，**身子最后一句**是 `return a + b;`——下面那张表就按它们的位置，一格一格讲给你听（整招拼起来的样子，紧接着就有完整的一段）。

| 零件 | 这一段的原话 | 它负责什么 |
|---|---|---|
| 开门口号 | `public` | 「谁都能调用我们这一个方法」。先跟着写，往后讲类定义的时候再细说 |
| 不用实例 | `static` | 「不用先造出一个实例，直接调用就行」的记号 |
| 结果的类型 | `int` | 这一个方法要**返回**什么料。写 `void`（空）就是「干完活不返回东西回来」 |
| 方法名 | `add` | 我们起的名字 |
| 输入接口 | `(int a, int b)` | **参数（参数）**：引用的时候要传入的料，写「类型 + 名字」，几样就写几样，逗号隔开 |

再加上身子那两句：花括号里写活儿，`return a + b;` 是**返回的那一刻**——`return` 后面那个东西，就是这一个方法「返回值（返回值）」。

会返回结果的招，输出的结果**能当值用**，像这样：

```java
public class Main {
    public static int add(int a, int b) {
        return a + b;
    }

    public static void main(String[] args) {
        int total = add(3, 5);
        System.out.println(total);
        System.out.println(add(10, 1) + add(1, 1));
    }
}
```

```text
8
13
```

- `add(3, 5)` 调用一次，传入 `3` 和 `5`，这一个方法返回 `8`——我们把它装进 `total` 里再印。
- `add(10, 1) + add(1, 1)` 是调用了两遍：一遍返回 `11`、一遍返回 `2`，两个数再相加，印出 `13`。**调用方法的写法跟一个值一样好使**，想放哪儿放哪儿。

这一趟来回（跳进去、跑完、落回原处）看不见，我们把它拆成一步一步，走给你看：

```demo
title: 调用一次 add(3, 5)：电脑到底跑去了哪儿
code:
| public static int add(int a, int b) {
|     return a + b;
| }
| public static void main(String[] args) {
|     int total = add(3, 5);
|     System.out.println(total);
| }

step 起点：方法先住着，程序从 main 开跑
at: 4
say: `add` 这一个方法早就写在类定义上了（第 1 行打头那一行），可它**自己不会动** —— 没人调用，它一行都不跑。程序永远从 `main` 开跑，第一件活儿在下面。
meow: 程序从 main 开始。
pose: expect
现在跑到哪 = main 里等着
方法里的两个元素 = 还没摆
total 保存了吗 = 还没装

step 调用一次 add(3, 5)：先把回来的路记下
at: 5
say: 轮到 `int total = add(3, 5);` 了。电脑**先算等号右边**：调用一次 `add`。输出之前，它先在心里记下这一行的位置 —— 方法跑完，要落回这儿。
meow: 调用 add(3, 5)。
pose: busy
现在跑到哪 = 正往 add 里跳
方法里的两个元素 = 还没摆
total 保存了吗 = 还没装

step 递料：方法里现摆两个元素接住 3 和 5
at: 1
say: 括号里的 `3` 和 `5` 是**复印一份**递进去的：方法里现摆两个元素 `a`、`b` 接住 —— `a` 里是 3，`b` 里是 5。这个是方法**自己的**两个元素，外面那两个数一点没动。
meow: a 是 3，b 是 5。
pose: busy
现在跑到哪 = add 的身子里
方法里的两个元素 = a = 3，b = 5
total 保存了吗 = 还没装

step 方法体：算 a + b，return 把 8 返回起来
at: 2
say: 方法里先算右边 `a + b`：3 加 5 得 **8**，`return` 把 8 返回起来。**注意：这一步外面的 `total` 还是「还没装」，一点没变** —— 方法里跑的活儿，管不着外面那个元素。
meow: a + b 算出 8，return 返回。
pose: yay
现在跑到哪 = add 的身子里
方法里的两个元素 = a = 3，b = 5
total 保存了吗 = 还没装

step 回来：落回称呼它的那一行，装进 total
at: 5
say: 方法保存 8 落回**刚才称呼它的那一行**，把 8 装进左边的 `total`。`total` 到这一刻才第一次有值 —— 方法在里头跑着的时候，外面这个元素一直是空的。
meow: total 接收 8。
pose: busy
现在跑到哪 = 落回 main
方法里的两个元素 = （撤走了）
total 保存了吗 = 保存了 8

step 报出 total：屏幕上印出 8
at: 6
say: 最后一行 `System.out.println(total)` 报出 `total`，屏幕上印出 **8** —— 课文上面那段结果里的第一个 8，就是它。这个 8 是 `add` 返回的，不是 `main` 自己算的。
meow: 输出 8。
pose: yay
现在跑到哪 = main 的最后一行
方法里的两个元素 = （撤走了）
total 保存了吗 = 保存了 8

step 收工：main 跑完，方法里的元素撤走了
at: 7
say: `main` 的大括号合上，程序收工。回头看一眼这一趟：**调用一次 → 跳进方法里跑完 → 落回原处接着跑**。方法里的元素是调用一次现摆一次、调用结束就撤，所以换样料再调用一遍，它会重新摆两个。
meow: main 结束，程序退出。
pose: proud
现在跑到哪 = 程序收工
方法里的两个元素 = （撤走了）
total 保存了吗 = 保存了 8
```

**记住这一趟来回**：调用一次 = 电脑跳到方法里跑一趟，跑完**落回刚才称呼它的那个地方**接着跑（调用声要是单独占一行，落回来的就是它的下一行）；递进去的料是**复印一份**，方法里那两个元素跟外面互不相干。所以上面那句 `int total = add(3, 5);` 里，`total` 一直要等到方法回来才装上东西。

### 两招长得很像，脾气不一样

| 打头写的 | 它是什么性格 | 调用结束能得到什么 |
|---|---|---|
| `void` | 只干活、不返回东西 | 「没结果」——只能当一句话用，不能装进名称 |
| `int` / `String` / … | 干完活还要返回一样料 | 一样 `int`（或那样料），能装名称、能进算式 |

看个 `void` 的：

```java
public class Main {
    public static void add(int a, int b) {
        System.out.println(a + b);
    }

    public static void main(String[] args) {
        add(3, 5);
    }
}
```

```text
8
```

这一个方法自己也印了 `8`，可它**啥也没返回**——我们要是写成 `int x = add(3, 5);`，编译器就要拦人了：那一个方法没有结果，你装什么？**要返回东西就用 `return` 挑一样出来，并且在打头那儿写清是什么料**，两边说好才作数。

### `return` 一出场，这一个方法就结束

`return` 还有第二个身份：**它一出现，这一个方法立刻收工**，后面再排着多少句子都不跑了。

```java
public class Main {
    public static String check(int n) {
        if (n > 0) {
            return "还有数据";
        }
        System.out.println("这句只在没结果可返回的时候才轮到");
        return "元素空了";
    }

    public static void main(String[] args) {
        System.out.println(check(5));
        System.out.println(check(0));
    }
}
```

```text
还有数据
这句只在没结果可返回的时候才轮到
元素空了
```

第一次调用 `check(5)`：眼色答真，`return` 立刻把「还有数据」返回——**那一个方法当场收工**，底下那句提示语没轮到。第二次调用 `check(0)`：眼色答假，往下走，先把提示语印出来，最后才用 `return` 返回「元素空了」。

上一课学的眼色和绕圈，从今天起就能包进方法里；`return` 跟 `break` 有点像——**都是「不干了、走人」**，只是 `return` 是整招收工，手里还带一样东西走。

## 为什么方法必须住在类定义里

这是今天最要紧的一问。我们从第一天起就一直在写 `public class Main { ... }`，你有没有想过：**这一层壳是干嘛的？**

答案就一句话：**在 Java 里，方法不许飘在空气里，它必须写在某一个类定义的花括号里面。**

（类定义在代码里的记号就是 `class` 这个词——`public class Main` 的意思正是「我们要画一张叫 `Main` 的类」。我们今天先立住这一条，往后几课会一直用。）

- **类定义就是 `public class Main { ... }` 那一对大括号。** 方法写在这对大括号**里面**，跟 `main` 平起平坐；`main` 也不例外，它只是「Main 这张类定义上、专门给电脑当入口的那一个方法」。
- **为什么这么定？** 因为 Java 把「东西」和「本事」看作**一家人的**：本事长在谁身上，就写进谁那张类定义里。往后我们会画自己的类定义（比如「对象」类定义、「数据变量」类定义），每张类定义里住着它自己的一堆招——**方法是类定义的成员，不是空气里的流浪对象**。
- **那 `Main` 呢？** 它是 Java 替我们准备好的类型定义：`java Main` 这句命令的意思就是「去 `Main` 这张类定义里找入口」。所以我们的程序现在是清清楚楚的两层：**类定义（类的花括号）在外，方法（方法）在内**。

类定义名这件事，我们在命令行上撞过一次：文件叫 `Main.java`、类定义却写成 `public class Cat`，编译器当场就说了 ——

> `class Cat is public, should be declared in a file named Cat.java`

念起来是：**「这张类定义叫 `Cat`，那它就得住在一个叫 `Cat.java` 的文件里。」** 我们这些课的文件一直叫 `Main.java`，所以类定义也就跟着叫 `Main`——**类定义名和文件名必须对得上**。想给类定义起别的名字，就把文件也改成那个名字，两边一起改。（我们的练习场里，编译器会替你按类定义名把文件摆好，所以这一条你平时不太撞得到；但它在命令行上是铁规矩，记着总没错。）

### 那 `static` 是干嘛的

`main` 身上挂着 `static`，我们新写的每一个方法也照着挂了。它的意思是：**这一个方法不用先按类定义创建一个实例，直接调用就行。**

还有一条配套的规矩，我们撞给你看过就知道深浅：

```java
public class Main {
    public void greet() {
        System.out.println("你好");
    }

    public static void main(String[] args) {
        greet();
    }
}
```

```text
Main.java:7: error: non-static method greet() cannot be referenced from a static context
        greet();
        ^
1 error
```

翻译过来是：**「没挂 `static` 的招，站在没挂 `static` 的地方调用不出来。」** 我们的土规矩先记成一句：**今天写的每一个方法都跟着 `main` 挂上 `static`**——挂了 `static` 的招，直接调用同样挂了 `static` 的招，两边都省事。往后学会按类定义创建对象之后，另一半规矩自然就懂了。

## 方法能被调用好多遍

打包的好处就体现在这儿：**同一个方法，换个料，调用几遍都行**。

```java
public class Main {
    public static void greet(String name) {
        System.out.println("你好，" + name + "");
    }

    public static void main(String[] args) {
        greet("张三");
        greet("李四");
    }
}
```

```text
你好，张三
你好，李四
```

方法名一个没改，只是每次传入的料不一样（`"张三"`、`"李四"`），屏幕上就换了名字。**这就是「打包一套动作」的意义**：动作写一遍，料每次现喂。调用十遍就是十个对象，我们一句都不用重抄。

## 拿错料会怎样

**第一种：说好要返回东西，却空着手回来。**

```java
public class Main {
    public static int add(int a, int b) {
        int sum = a + b;
    }

    public static void main(String[] args) {
        System.out.println(add(3, 5));
    }
}
```

```text
Main.java:4: error: missing return statement
    }
    ^
1 error
```

翻译过来是：**「你说好要返回一个 `int` 回来的，可这一路上一个 `return` 都没有。」** 打头写了 `int`，身子里的每一条路都得能返回一样 `int`——少写一个 `return`，编译器**编译的时候就把你拦下**，不让你带着这个窟窿往下跑。

**第二种：喂的料数目对不上。** 我们的 `add` 要两样料（`int a, int b`），只喂一样会怎样？编译器的原话是：

`method add in class Main cannot be applied to given types; required: int,int`

念起来是：**「`add` 这一个方法要两个 `int`，你只喂了一个。」** 喂多了、喂少了、喂错料（比如本该喂整数却喂了一串字符串），都是这一句——**调用方法的时候，几样、什么料，都得跟打头那儿写的一模一样**。

| 我们写错的 | 编译器说什么 | 啥时候出问题 |
|---|---|---|
| 打头写 `int`，身子没有 `return` | `missing return statement` | **编译当场拦** |
| 喂的料数目/类型跟打头不符 | `cannot be applied to given types` | **编译当场拦** |
| 方法没挂 `static`，直接在 `main` 里调用 | `non-static method ... cannot be referenced from a static context` | **编译当场拦** |
| 名字调用错、大小写不对 | `cannot find symbol` | **编译当场拦** |

方法写错**全都在编译时就被拦下**——这一点比上一课的越界省心：错了就跑不起来，不会偷偷给你一个错答案。

::: tip 提示
今天记住这五句话：

1. **方法 = 打头那行 + 一对花括号**：打头写清「谁能调用、返回不返回东西、叫什么、要喂什么」，花括号里写活儿。
2. **`void` 是干完活不返回东西，`int` 那些是要返回一样料**；要返回就在身子里的**每条路**上都写 `return`。
3. **`return` 一出场，这一个方法立刻收工**，后面的句子都不跑了。
4. **方法必须写在类定义（类）的花括号里面**，跟 `main` 平起平坐；`java Main` 找的就是 `Main` 这张类定义，所以**类定义名要和文件名对上**。
5. **今天每一个方法都跟着挂 `static`**，这样它们能互相直接调用；喂料时，几样、什么料，都按打头那儿写的来。
:::

## 小任务

1. 把 `greet` 那一段抄进练习场，在 `main` 里多调用两句 `greet();`，看看屏幕上多印了几行。
2. 给 `add` 加一样料（比如变成 `add(int a, int b, int c)`，把三样加起来），改完在 `main` 里调用一遍——记得喂三样，我们想看你会不会漏（漏了就是那句 `cannot be applied to given types`）。
3. 写一个方法 `int maxOf(int a, int b)`：返回两个数里大的那个（提示：「if 与 switch」那一课的小眼色，`? :` 那对记号在这儿正合适）。
4. 写一个方法 `void printRow(int n)`：调用 `printRow(3)` 就印三行「绕圈」（提示：上一课的绕圈搬进来）。
5. 故意把 `greet` 前面那个 `static` 删掉再编译一次，把编译器的原话抄给记录表；抄完记得**加回去**。

下一课，我们要对函数**加兄弟**：同一个名字、不同的输入接口，引用的时候电脑自己挑该用哪一个方法（Java 管这叫**重载**）；还要把「哪块名称活在哪一层」这件事讲透——「for 与 while」那一课我们撞过的那个「`i` 出了圈就不认识」，到那儿就有正式答案啦。去下一课探险 
