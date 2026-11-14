---
id: java-stage2-12
lang: java
stage: 2
order: 12
title: 异常进阶与自定义异常
tags: [异常, 报错]
required: ["java-stage2-11"]
crossRefs: []
compare: ["common-12"]
estMinutes: 28
keywords: [throw, throws, try, catch, finally, exception]
---

## 学习目标

本课学习异常进阶与自定义异常。重点包括异常体系、throw、自定义异常、使用原则。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、「调用一次」：把出事这件事本身扔出去

引用的写法就一个词：

```java
throw new Exception("变量空了");
```

拆开看：`new Exception(…)` 是**根据类创建实例专门代表「出事了」的实例**，括号里那串话是留给别人的口信；前面的 `throw` 是**把这个对象往外扔**。

扔出去之后会怎样？它会**顺着调用我们的那条路一路往上飞**：我们的方法里不接，就飞到调用我们的那个对象那儿；它也不接，就再往上飞；一路飞到最外面都没人接，程序就当场断气，把这个对象的名字和口信印出来，最后留下一串「出事的时候谁在干活」的脚印。

```java
public class Main {
    static void takeFish(int n) {
        if (n <= 0) {
            throw new RuntimeException("变量空了");
        }
        System.out.println("拿到 " + n + " 条");
    }

    public static void main(String[] args) {
        takeFish(0);
    }
}
```

```text
Exception in thread "main" java.lang.RuntimeException: 变量空了
	at Main.takeFish(Main.java:4)
	at Main.main(Main.java:10)
```

这一串怎么读：第一行是**出事那一个的名字 + 口信**；下面每一行 `at …` 是一格脚印，**从出事的地方往外排** —— 先 `takeFish` 第 4 行扔的，再 `main` 第 10 行引用的。倒着读就是一路下来的顺序。

## 二、出事的东西分两档，编译器的态度完全不一样

上面那段代码**编得过**，是跑到那一步才炸的。可如果我们把 `RuntimeException` 换成 `Exception`，同一个位置连编都编不过 —— 我们真跑过：

```java
public class Main {
    static void takeFish(int n) throws Exception {
        if (n <= 0) {
            throw new Exception("变量空了");
        }
        System.out.println("拿到 " + n + " 条");
    }

    public static void main(String[] args) {
        takeFish(0);
    }
}
```

```text
Main.java:10: error: unreported exception Exception; must be caught or declared to be thrown
```

念起来是：**「这个对象会出事，可你没说清出了事怎么办。」** `unreported` 是「没有交代」，后面那句 `must be caught or declared to be thrown` 是编译器给的**两条出路**：要么当场接住，要么在方法头上声明「我们不接，往上扔」。

为什么同样是出事，一个拦一个不拦？因为出事的东西**分两档**：

| 档 | 谁在这一档 | 编译器的态度 |
|---|---|---|
| **要表态的** | `Exception` 这一家（不算它下面那个特例） | **你不写清怎么办，源代码就退回来** |
| **不表态也编得过** | `RuntimeException` 这一家 | 编得过，跑到那一步才炸 |
| **机器自己的病** | `Error` 这一家（机器没内存了之类） | 我们管不了，**也别去接** |

第一档之所以要表态，是因为那些事**本来就该有个说法**：文件读不到、东西没找到、数字转不动 —— 这些不是「程序写错了」，是「外面的世界不配合」，所以Java 逼我们**在写源代码的时候就先想一遍**。第二档（`RuntimeException` 这一家）通常是**我们自己的源代码写错了** —— 比如拿一个空口袋去取东西、拿 0 当除数、下标越界 —— 那就该让程序当场炸给我们看，别捂着。

::: tip 提示
记住这两档的**分界线**：**「外面世界不配合」→ 要表态；「我们自己写错了」→ 编得过、当场炸。**

所以我们写方法的时候，凡是「外面的东西可能不配合」的地方（读文件、找东西、把字符串转成数字），都要么接住、要么在方法头上声明；而「下标越界」这类自己写错的，让它在跑的时候炸出来反而更省事 —— 那是调试的线索，不是要藏起来的东西。
:::

## 三、接住它：`try` / `catch`

要接住，用的是一对兄弟词 `try` 和 `catch`。

```java
public class Main {
    public static void main(String[] args) {
        try {
            System.out.println("开门");
            int x = 10 / 0;
            System.out.println("数出来 " + x);
        } catch (ArithmeticException e) {
            System.out.println("接住了：" + e.getMessage());
        } finally {
            System.out.println("关门");
        }
    }
}
```

```text
开门
接住了：/ by zero
关门
```

三块各管一段：

- **`try { … }`** 里放「可能出事的活」。出事的那一行往后就不跑了 —— 所以 `数出来 …` 那句**一个字都没印**。
- **`catch (出事的东西 e) { … }`** 里放「接住了怎么办」。括号里写清**我们要接哪一个**（这里是 `ArithmeticException`），接住的那一个被接在了名字 `e` 上，`e.getMessage()` 就是它带来的口信。
- **`finally { … }`** 里放「不管出没出事都要干的事」—— 收摊子用。上面例子里不管有没有出事，`关门` 都会印。

这三块的先后不是「写完的顺序」，是**真跑出来的顺序**。我们按真实走位一步一步走给你看：

```demo
title: 三块是怎么按顺序走下来的
code:
| try {
|     System.out.println("开门");
|     int x = 10 / 0;
|     System.out.println("数出来 " + x);
| } catch (ArithmeticException e) {
|     System.out.println("接住了：" + e.getMessage());
| } finally {
|     System.out.println("关门");
| }

step 先划一块「我们盯着」的地盘
at: 1
say: `try {` 划出一块地盘：里面的活儿照常一行行往下跑，**出了事就在这块地盘上截住**，不让它直接飞到外面去。
meow: 进入 try 块。
pose: expect
标准输出 = 还没印
现在走到哪 = 刚进 try
出事了吗 = 还没
x 有值了吗 = 还没有

step 出事之前那一行：印出「开门」
at: 2
say: `System.out.println("开门")` 跑到了 —— 因为它在出事之前。屏幕上的第一行就是它。
meow: 输出「开门」。
pose: busy
标准输出 = 开门
现在走到哪 = try 里，第 2 行跑完
出事了吗 = 还没
x 有值了吗 = 还没有

step 撞上除数是 0
at: 3
say: `10 / 0` 出事就在这一行：除数是 0，**算数当场调用一次**（`ArithmeticException`，口信是 `/ by zero`）。注意：输出的这一刻，这个值**还没交到 `x` 手上**。
meow: 除以 0，抛出 ArithmeticException。
pose: think
标准输出 = 开门
现在走到哪 = try 里，第 3 行出事
出事了吗 = 出事了：ArithmeticException（口信 / by zero）
x 有值了吗 = 还没有（值没交出来）

step 这一行往后就不跑了
at: 4
say: 出事那一行**往后全部作废**：第 4 行 `数出来 …` 一个字都没印。飞出来的那个对象**顺着称呼它的这条路往外找**，去找接它的人。
meow: 后面的语句被跳过。
pose: expect
标准输出 = 开门
现在走到哪 = 从 try 里往外飞
出事了吗 = 出事了：ArithmeticException（口信 / by zero）
x 有值了吗 = 还没有（永远不会有）

step 门口名称对上了：接住
at: 5
say: `catch (ArithmeticException e)` 是**门口的名称**：我们要接的正是「算数出岔子」这一个。飞出来的就是它，**当场接住**，接住的那个从此挂在名字 `e` 上。
meow: catch 匹配这个异常。
pose: yay
标准输出 = 开门
现在走到哪 = catch 里，接住的那个叫 e
出事了吗 = 接住了（口信在 e 身上：/ by zero）
x 有值了吗 = 还没有

step 把接住那个的口信印出来
at: 6
say: `e.getMessage()` 把**接住那个带来的口信**读取印出去：`接住了：/ by zero`。这句话不是我们另写的字，是出事那个自己带来的。
meow: getMessage 返回 / by zero。
pose: yay
标准输出 = 开门、接住了：/ by zero
现在走到哪 = catch 里
出事了吗 = 接住了（口信在 e 身上：/ by zero）
x 有值了吗 = 还没有

step finally：这一块必定要走
at: 7
say: `finally {` 这一块**不管出没出事都要走一趟**：接住了要走，没人接也要走；连方法里提前 `return`，都得等它跑完才放行 —— 收摊子的活就该放这儿。
meow: finally 总会执行。
pose: milestone
标准输出 = 开门、接住了：/ by zero
现在走到哪 = finally 里
出事了吗 = 已经接住了
x 有值了吗 = 还没有

step 印出「关门」
at: 8
say: `System.out.println("关门")` 印出来了。三段输出到这儿齐了：`开门` → `接住了：/ by zero` → `关门`，和上面跑出来的一模一样。
meow: 输出「关门」。
pose: busy
标准输出 = 开门、接住了：/ by zero、关门
现在走到哪 = finally 里，最后一行跑完
出事了吗 = 已经接住了
x 有值了吗 = 还没有

step 三块走完，接着往下跑
at: 9
say: 最后那个 `}` 收掉整个这一段。出事已经被接住，**程序不会在这儿断气**，接着往下走 —— 这一条正是「接住」和「没接住」的差别。
meow: 异常已处理，程序继续。
pose: proud
标准输出 = 开门、接住了：/ by zero、关门
现在走到哪 = 三块走完，接着往下
出事了吗 = 已经接住了（程序没断气）
x 有值了吗 = 还没有（这一趟永远不会有）
```

三块的**时机**各不相同：`try` 里一行行按顺序跑、出事那一行往后的活儿全部作废；`catch` 只接住飞出来的那一个，接住之后程序照常往下走；`finally` 是收摊子的一格，**不管出没出事都跑得掉**。

`finally` 有个不小的本事：**连方法里提前 `return` 了，它也要跑完才走。** 我们真跑过这一段：

```java
public class Main {
    static int peek() {
        try {
            return 1;
        } finally {
            System.out.println("finally 还是跑了");
        }
    }

    public static void main(String[] args) {
        System.out.println("结果 " + peek());
    }
}
```

```text
finally 还是跑了
结果 1
```

看顺序：`finally` 里那句**先**印出来，然后才轮到外面印「结果 1」。所以想把「用完的管子关掉」这类收尾放在 `finally` 里，是**靠得住**的。

::: warn 注意
接东西有个**先小后大**的规矩。我们要是先写 `catch (Exception e)`、再写 `catch (ArithmeticException e)`，编译器会翻脸：

```java
public class Main {
    public static void main(String[] args) {
        try {
            int x = 10 / 0;
            System.out.println(x);
        } catch (Exception e) {
            System.out.println("大的先接");
        } catch (ArithmeticException e) {
            System.out.println("小的后接");
        }
    }
}
```

```text
Main.java:8: error: exception ArithmeticException has already been caught
```

道理不绕：**能接住 `ArithmeticException` 的那个对象，本来就能接住它的所有小辈** —— 上面那个 `Exception` 已经把它一网打尽了，下面那个**永远轮不到**。所以顺序得反过来：**越具体的越写前面**。
:::

## 四、自己画一张专门报这种事的类定义

用现成的出事类定义有个毛病：**一把抓**。别人接住一个 `Exception`，压根不知道是我们的变量空了，还是文件读不到 —— 只能去翻口信。

办法是**自己画一张**。下面这段的上半截，就是新画出来的那张类定义；下半截是它的用法：

```java
class FishEmptyException extends Exception {
    FishEmptyException(String msg) {
        super(msg);
    }
}

public class Main {
    static void takeFish(int n) throws FishEmptyException {
        if (n <= 0) {
            throw new FishEmptyException("变量空了");
        }
        System.out.println("拿到 " + n + " 条");
    }

    public static void main(String[] args) {
        try {
            takeFish(0);
        } catch (FishEmptyException e) {
            System.out.println("我们接住了：" + e.getMessage());
        }
    }
}
```

```text
我们接住了：变量空了
```

新类定义那三行，每一行都有用：

- **`extends Exception`** —— 「认谁当师父」。这一句决定了我们这张类定义归**哪一档**：认 `Exception` 当师父，新类定义就归「**要表态的**」那一档；要是认 `RuntimeException` 当师父，就归「编得过、当场炸」那一档。**师父是谁，这一档就跟着谁**。
- **`FishEmptyException(String msg)`** 是初始化那一手，它接住别人递进来的那句口信。
- **`super(msg)`** 是把口信**往上交给师父**（上一课学过 `super` 这个词）。交给它之后，`e.getMessage()` 才返回得回那句话 —— 不交上去，那个对象就是一个**空口信**的对象，接住它的人什么也读不到。

再看下半截是**怎么用起来**的：`takeFish` 头上多了一句 `throws FishEmptyException`（我们自己先声明「出了事我们不在这儿处理」），`main` 里的 `catch` 只接我们自家这一个。别人家的出事类定义飘到我们这儿，**接不住，也不该接** —— 这正是「画一张专门报这种事的类定义」的用意：**名字一亮出来，接的人就知道出了什么事**。

## 五、使用原则：四条

1. **接得住才接，接不住就往上扔。** 方法头上那句 `throws`，是**我们自己先声明**：「这招可能出事，出了事我们不在这儿处理，谁调用我们谁接着」。硬接一个我们处理不了的对象，等于把麻烦藏在自己的变量里。
2. **别吞。** 接住了、括号里什么都不写，程序会**照常往下走**，而且**编译器一个字都不说**（我们真跑过）。出事的那一格脚印从此断在这儿，等以后出问题的时候，我们连「它是在哪儿丢的」都找不着。
3. **别拿它当跳转用。** 能用「条件判断」判出来的正常分支（该印哪句话、该走哪条路），就老老实实用分支 —— 出事的东西是留给**意外**的，不是用来抄近路的。
4. **类定义要画得有意义。** 一张专门代表「变量空了」的类定义，比一个什么都代表的 `Exception` 值钱得多：**看到名字就知道出了什么事**，接住的人不用去猜口信。反过来，什么都能装的那种万能类定义，等于回到了「一把抓」。

## 六、小任务

1. 给上面那个「变量空了」的类定义再加一格家当：比如「当时还剩几条」。想一想，存进去之后接住它的对象要怎么读出来？
2. 把取货方法改成「变量不够 `n` 条也得调用一次」，看看同一张出事类定义能不能用在两种情形上。
3. 想一想：我们把「变量空了」那张类定义的师父从 `Exception` 换成 `RuntimeException`，`takeFish` 头上那句 `throws` 还留着会怎样？编译器会拦吗？

下一课我们要带你去碰**真正待在硬盘上的东西**了：怎么在代码里指着一个文件说话、怎么把一句话写进去、怎么把它读回来 —— 那里面有一类特别容易踩的坑，正好用得上这一课学的本事 
