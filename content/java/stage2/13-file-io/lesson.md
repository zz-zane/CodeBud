---
id: java-stage2-13
lang: java
stage: 2
order: 13
title: 文件操作与 IO 流初步
tags: [文件, IO]
required: ["java-stage2-12"]
crossRefs: []
estMinutes: 28
keywords: [File, FileWriter, BufferedReader, readLine, IOException]
---

## 学习目标

本课学习文件操作与 IO 流初步。重点包括File、字节流字符流直觉、读写文本文件。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```java
public class Main {
    public static void main(String[] args) {
        int shouhuo = 3;
        System.out.println("今天收了 " + shouhuo + " 条数据");
    }
}
```

```text
今天收了 3 条数据
```

## 一、`File`：先给册子挂个名牌

要让编译器动某一本册子，先得**说清是哪一本**。说的办法是照一个类定义创建一个**名牌**：

```java
import java.io.File;

public class Main {
    public static void main(String[] args) {
        File f = new File("dangan.txt");
        System.out.println("名牌拿到了，册子叫 " + f.getName());
    }
}
```

```text
名牌拿到了，册子叫 dangan.txt
```

这里有个**第一次一定会想歪**的地方：`new File("dangan.txt")` **不会真的去动硬盘**。它只是照 `File` 这张类定义创建了一个名牌，名称上写着「我们说的是名叫 `dangan.txt` 的那本册子」。册子到底在不在、有几页、多大，名称自己一概不知道 —— 得**拿着名称去问**。

问的本事有四个，都是拿名称引用的：

```java
import java.io.File;
import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        File f = new File("dangan.txt");
        System.out.println("一开始，册子在不在：" + f.exists());
        System.out.println("新建成功了没：" + f.createNewFile());
        System.out.println("新建之后，册子在不在：" + f.exists());
        System.out.println("册子叫什么：" + f.getName());
        System.out.println("册子现在有多少字节：" + f.length());
    }
}
```

```text
一开始，册子在不在：false
新建成功了没：true
新建之后，册子在不在：true
册子叫什么：dangan.txt
册子现在有多少字节：0
```

四个本事逐个看：

| 拿名称调用 | 返回的是 |
|---|---|
| `f.exists()` | 「这本册子在不在」—— 在就 `true`，不在就 `false` |
| `f.createNewFile()` | 当场新建一本**空册子** —— **建成了**返回 `true`，本来就有就返回 `false`（不会把原来那本撕掉） |
| `f.getName()` | 名称上写的名字 |
| `f.length()` | 册子**有多少字节** —— 空册子是 `0` |

第一行那个 `false` 是这一课最值钱的一行：**我们明明没写「删册子」，可册子就是不在。** 因为这是一台**干干净净**的机器 —— 上面从来没建过 `dangan.txt`。往后我们每次跑，都是从这个「不在」开始的（我们特意在真跑台上确认过：每一趟都是从零开始，所以这几行次次一模一样）。

::: tip 提示
`File` 这一个类定义的脾气管到底就一句话：**它是名牌，不是册子本身。** 想动册子，永远得「拿到名牌 → 调用本事去问 / 去建 / 去读 / 去写」。它自己**不存一个字的正文**。
:::

## 二、往册子上写字：`FileWriter`

名牌能回答「在不在」，可它不会写字。写字要请**一支笔**：

```java
import java.io.FileWriter;
import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        try (FileWriter w = new FileWriter("dangan.txt")) {
            w.write("数据 3 条\n");
        }
    }
}
```

`new FileWriter("dangan.txt")` 就是**拉开抽屉、把笔尖搁在纸上**那个动作。括号里喂的名字，就是册子的名字 —— **册子不在，它顺手给你新建一本**（所以这一步不需要先 `createNewFile()`）。

拉开之后，`w.write("…")` 往册子上写字。这里有两件事要记牢：

- **每一句话末尾的换行符 `\n`，得自己写。** `System.out.println` 是「印完自动换一行」，`w.write` **没有这个脾气**：你写什么，册子上就是什么。
- **`\n` 不是「反斜杠加 n 两个字符」，是藏起来的一个换行**（上一课已经见过它了）。

我们把「忘了写 `\n`」这件事真跑了一遍，你看是什么下场：

```java
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        try (FileWriter w = new FileWriter("dangan.txt")) {
            w.write("数据 3 条");
            w.write("商品 1 元素");
        }
        try (BufferedReader r = new BufferedReader(new FileReader("dangan.txt"))) {
            int n = 0;
            String hang = r.readLine();
            while (hang != null) {
                n++;
                System.out.println(n + " 号格子：" + hang);
                hang = r.readLine();
            }
            System.out.println("一共 " + n + " 行");
        }
    }
}
```

```text
1 号格子：数据 3 条商品 1 元素
一共 1 行
```

两条记录**挤成了一条**，行数也跟着错了。这条教训很值钱：**册子上哪一句是自己一行，全看你写没写那个 `\n`。**

### 那支笔用完要收

抽屉一直开着是有代价的。我们拿两个数给你看：

```java
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        File f = new File("dangan.txt");
        try (FileWriter w = new FileWriter(f)) {
            w.write("数据 3 条\n");
            System.out.println("抽屉还开着的时候，册子上有 " + f.length() + " 字节");
        }
        System.out.println("关上抽屉之后，册子上有 " + f.length() + " 字节");
    }
}
```

```text
抽屉还开着的时候，册子上有 0 字节
关上抽屉之后，册子上有 13 字节
```

**抽屉还开着的时候，册子上一个字节都没有。** 我们明明写了字数进去呀？—— 因为写下去的字**还揣在编译器的兜里**，没真的落进册子。它得等抽屉关上的那一刻才把兜里的字一次倒出来。

这就是「用完要收」的理由：**你写的字没落进册子之前，程序要是半路翻车了，那些字就跟着没了。** 上一课学的 `try ( … )` 正好把这个动作焊死 —— **这一段做完，不管出没出事，编译器都会替你把抽屉关上**，`close()` 一个字都不用写，想忘也忘不掉。

顺带看一眼那个 `13`：写进去的是「数据 3 条」加一个换行。两个字 + 两个空格 + 一个数字 + 一个「条」+ 一个换行 = 13 字节 —— 也就是说**一个中文字在这里占 3 个字节**（往后的正文里也一样，我们真数过）。

## 三、把字返回：`BufferedReader` 和 `readLine()`

写字有笔，读字有**一张会返回东西回来的嘴**：

```java
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        try (FileWriter w = new FileWriter("dangan.txt")) {
            w.write("数据 3 条\n");
            w.write("商品 1 元素\n");
        }
        try (BufferedReader r = new BufferedReader(new FileReader("dangan.txt"))) {
            String hang = r.readLine();
            while (hang != null) {
                System.out.println("档案里有：" + hang);
                hang = r.readLine();
            }
        }
    }
}
```

```text
档案里有：数据 3 条
档案里有：商品 1 元素
```

一行一行拆开看：

- **`new FileReader("dangan.txt")`** —— 拉开册子准备**读**。这个动作和写字用同一个册子名字。
- **外面那层 `new BufferedReader( … )`** —— 给这张嘴**加一圈缓冲**：编译器先把册子上一大块字捞进兜里，然后一行一行递给你。名字里的 `Buffered` 就是「带兜的」。
- **`r.readLine()`** —— 返回**一整行**，**不带那个行尾的换行符**（这正是上一课那个「多出一个空行」的老朋友）。而且它知道什么时候到头。
- **到头了返回什么？`null`。** 所以绕圈的条件写成 `hang != null` —— **「读到返回 `null`」就是读完了的信号**。（`null` 是「什么都没有」的意思，我们印出来的时候屏幕上就是 `null` 这四个字母。）

**三句一个骨架**，往后读册子长度一律照这个形状写：

```text
String hang = r.readLine();
while (hang != null) {
    想让每行做什么，写在这里
    hang = r.readLine();
}
```

::: warn 注意
这个骨架有**两处**新手最容易摔的地方：

1. **绕圈里最后那句 `hang = r.readLine();` 忘了写** —— 那么 `hang` 一直是同一行，程序就印同一行印到天荒地老（我们叫它「死绕圈」，只能按停止键）。**它的位置在圈里的最后一格**，不是最前面。
2. **条件写成 `hang != ""`** —— 空行和「读完了」是两件事。这么写**根本停不下来**：读到头之后 `readLine()` 返回的是 `null`，而 `null` 跟一个空字符串**不相等**，圈子就一直转下去，屏幕上刷满 `档案里有：null`（我们真跑过：4 秒钟印了四十七万行，最后是掐掉的）。**认准一个字：读到 `null` 才算读完了。**

对照着看：`readLine()` 自己会跳到下一行，**你要做的只是「再调用一次」**。
:::

```demo
title: 返回一行、问一次：圈子是怎么自己停的
code:
| // 册子上已经排着两行：数据 3 条 / 商品 1 元素
| BufferedReader r = new BufferedReader(new FileReader("dangan.txt"));
| String hang = r.readLine();
| while (hang != null) {
|     System.out.println("档案里有：" + hang);
|     hang = r.readLine();
| }

step 起点 · 拉开册子，加一圈兜
at: 2
say: `new FileReader("dangan.txt")` 是**拉开册子准备读**；外面那层 `new BufferedReader( … )` 给这张嘴**加一圈兜** —— 编译器先把册子上一大块字捞进兜里，再一行一行递给你。
meow: 打开文件，BufferedReader 提供按行读取。
pose: expect
册子上排着 = 数据 3 条 / 商品 1 元素
hang 这个格子 = （还空着）
这一口是 null 吗 = （还没返回）
标准输出 = （还空着）

step 头一口：返回一整行
at: 3
say: `String hang = r.readLine();` —— 头一口就返回**一整行**「数据 3 条」，**不带行尾那个换行**。想接住它，得先有只格子：`String hang`。
meow: readLine 读到第一行。
pose: busy
册子上排着 = 数据 3 条 / 商品 1 元素
hang 这个格子 = 数据 3 条
这一口是 null 吗 = 不是，复制到了
标准输出 = （还空着）

step 问一句：这一口是 null 吗
at: 4
say: `while (hang != null)` 问的正是「这一口是不是 `null`」。格子里保存的是真字，**不是 null** —— 答真，放行进圈。
meow: 不是 null，进入循环。
pose: expect
册子上排着 = 数据 3 条 / 商品 1 元素
hang 这个格子 = 数据 3 条
这一口是 null 吗 = 不是 → 进圈
标准输出 = （还空着）

step 第 1 步
at: 5
say: 圈里那一行把它印到屏幕上 —— 「档案里有：数据 3 条」。册子上的一行字，到这儿变成了屏幕上的一行字。
meow: 输出第一行。
pose: yay
册子上排着 = 数据 3 条 / 商品 1 元素
hang 这个格子 = 数据 3 条
这一口是 null 吗 = 不是 → 进圈
标准输出 = 档案里有：数据 3 条

step 圈里最后一格：再调用一次
at: 6
say: 第 6 行是圈里的**最后一格**：再调用一次 `readLine()`。新手最常漏的就是这一句 —— 漏了它，`hang` 一直是同一行，屏幕就印同一行印到天荒地老。`readLine()` 自己会跳到下一行，**你要做的只是「再调用一次」**。
meow: 继续读下一行，否则会死循环。
pose: busy
册子上排着 = 数据 3 条 / 商品 1 元素
hang 这个格子 = 商品 1 元素
这一口是 null 吗 = 不是，复制到了
标准输出 = 档案里有：数据 3 条

step 又转回来问一次
at: 4
say: 转回判断那一行再问一次：格子里保存「商品 1 元素」，**还不是 `null`** —— 答真，再进一圈。
meow: 第二行不是 null。
pose: expect
册子上排着 = 数据 3 条 / 商品 1 元素
hang 这个格子 = 商品 1 元素
这一口是 null 吗 = 不是 → 进圈
标准输出 = 档案里有：数据 3 条

step 第 2 步
at: 5
say: 同一行代码又跑一遍 —— 屏幕上多出「档案里有：商品 1 元素」，册子上的两条都印完了。
meow: 输出第二行。
pose: yay
册子上排着 = 数据 3 条 / 商品 1 元素
hang 这个格子 = 商品 1 元素
这一口是 null 吗 = 不是 → 进圈
标准输出 = 档案里有：数据 3 条 / 档案里有：商品 1 元素

step 再调用一次：返回的是 null
at: 6
say: 第 6 行再调用一次 `readLine()` —— 册子读到头了，这回它返回的**不是一个字，是 `null`**（「什么都没有」）。
meow: 到文件末尾，返回 null。
pose: think
册子上排着 = 数据 3 条 / 商品 1 元素
hang 这个格子 = null（什么都没有）
这一口是 null 吗 = 是

step 到头了：圈子自己停
at: 4
say: 转回判断那一行：`hang != null` 答**假** —— 圈子到此为止，不再绕。**「读到返回 `null`」就是读完了的信号**，不是空行、不是别的什么。
meow: null 使循环结束。
pose: proud
册子上排着 = 数据 3 条 / 商品 1 元素
hang 这个格子 = null（什么都没有）
这一口是 null 吗 = 是 → 圈子停
标准输出 = 档案里有：数据 3 条 / 档案里有：商品 1 元素
```

## 四、接着写，还是撕掉重写？

账本是天天要添的。我们不想每添一笔就把前面写的全撕掉 —— 可 `new FileWriter(名字)` **每次拉开抽屉的那一刻，都会把册子上原来的字全擦干净**（不是删册子，是**擦干净**）。我们真跑了一遍，给你看擦掉的样子：

```java
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        try (FileWriter w = new FileWriter("dangan.txt")) {
            w.write("第一天：3 条\n");
        }
        try (FileWriter w = new FileWriter("dangan.txt")) {
            w.write("第二天：5 条\n");
        }
        try (BufferedReader r = new BufferedReader(new FileReader("dangan.txt"))) {
            String hang = r.readLine();
            while (hang != null) {
                System.out.println("档案里有：" + hang);
                hang = r.readLine();
            }
        }
    }
}
```

```text
档案里有：第二天：5 条
```

第一天那条**没了**。想要「接着写」，就在名字后面再喂一个 `true`：

```java
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        try (FileWriter w = new FileWriter("dangan.txt")) {
            w.write("第一天：3 条\n");
        }
        try (FileWriter w = new FileWriter("dangan.txt", true)) {
            w.write("第二天：5 条\n");
        }
        try (BufferedReader r = new BufferedReader(new FileReader("dangan.txt"))) {
            String hang = r.readLine();
            while (hang != null) {
                System.out.println("档案里有：" + hang);
                hang = r.readLine();
            }
        }
    }
}
```

```text
档案里有：第一天：3 条
档案里有：第二天：5 条
```

记住这条分界线：**想留住原来的字，喂 `true`；想从白纸开始写，就别喂。** 册子本来不在的时候，两种写法都会顺手新建一本，差别只在那本旧册子上的字留不留。

## 五、册子这套东西，是「要表态的」

上一课学过：出事的东西分两档，一档是**要表态的**（`Exception` 这一家）—— 你不写清怎么办，源代码就退回来。**册子这一套本事，全在这一档里。**

我们把「忘了表态」那版真跑了一遍，编译器当场犯难：

```java
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.FileWriter;

public class Main {
    public static void main(String[] args) {
        try (FileWriter w = new FileWriter("dangan.txt")) {
            w.write("数据 3 条\n");
        }
        try (BufferedReader r = new BufferedReader(new FileReader("dangan.txt"))) {
            System.out.println("写进去的字：" + r.readLine());
        }
    }
}
```

```text
Main.java:7: error: unreported exception IOException; must be caught or declared to be thrown
  exception thrown from implicit call to close() on resource variable 'w'
Main.java:10: error: unreported exception FileNotFoundException; must be caught or declared to be thrown
```

第一条和它下面那一句说的是同一件事：**拉开抽屉（`new FileWriter(…)`）和关上抽屉这几下，都可能出事，你没说清怎么办。** 最后一条是新面孔 —— 册子**不在**的时候，`FileReader` 拉开的是个空抽屉，它报的名字叫 `FileNotFoundException`（「册子没找到」）。

怎么办？两条出路，和上一课一模一样：**当场接住**，或者**在方法头上表态**。我们这边一律选第二条 —— 在 `main` 的头上写一句 `throws IOException` 就行（那个 `import java.io.IOException;` 也别忘）：

```text
public static void main(String[] args) throws IOException {
```

`IOException` 是这一家**总的名字**（`FileNotFoundException` 认它当师父），所以头上写这一句，把上面那三条一并盖住。

为什么册子这套本事这么爱出事？因为它们**都是「外面的世界答不答应」**的事：硬盘有没有空、册子在不在、笔有没有被别的程序抢走 —— 这些都不是我们源代码写得对不对能决定的。Java 逼我们**写源代码的时候就先想一遍**，正是这个道理。

那要是册子真不在，程序会怎么样？我们真跑了一遍「读一本不存在的册子」：

```java
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader r = new BufferedReader(new FileReader("meiyou.txt"));
        System.out.println("读到了：" + r.readLine());
        r.close();
    }
}
```

```text
Exception in thread "main" java.io.FileNotFoundException: meiyou.txt (系统找不到指定的文件。)
```

**当场断气**，和上一课那个没接住的 `RuntimeException` 一模一样的下场（下面还跟着一串 `at …` 的脚印，我们这里省掉了）。所以头上一句 `throws IOException` 的意思**不是「不会出事」**，是「出了事我们不在这儿管，往上报」—— 上一课那条「出事那一行之后的活全都不干」照样成立。

## 六、字节流和字符流：两条管子

最后说一件**名字听着吓人、其实一看就懂**的事。

册子上存的到底是什么？是**字节** —— 一格一格的 0 和 1。所以往外搬字的那套本事，按**怎么搬**分成两条管子：

- **一条一格一格地搬**（一次搬一小格 0/1）—— 这样的管子叫**字节流**。它什么都能搬：照片、压缩包、音乐，反正对着一格一格的字节搬就是了。
- **一条按「字」搬**（一次搬一个字）—— 这样的管子叫**字符流**。它替你把「哪些字节合起来算一个字」这件事办好了，你只管按字读写。

我们这一课用的全是**第二条**：`FileWriter` / `FileReader` 是字符流（看名字：写的是「字」）。上一节那个 `13` 就是它们在背后干的活 —— 我们写「数据」两个字，它们按 UTF-8 的规矩把这两个字拆成 6 个字节落到册子上，读回来的时候再照同一套规矩拼回两个字。**一个有中文字的册子，用字符流是对的**；哪天要搬照片，就轮到字节流上场了（那是后面的事，今天先有个印象就够）。

::: tip 提示
这一课的五件事，一句话串起来：

1. **`new File(名字)`** 只是拿**名牌**，要问「在不在 / 叫什么 / 多大」就称呼它的本事；
2. **`new FileWriter(名字)`** 拉开抽屉写字 —— **册子不在就顺手新建**，`write` **不会自己换行**，`\n` 得自己写；
3. **`new BufferedReader(new FileReader(名字))`** 加一圈兜，`readLine()` **一行一行返回**，返回 `null` 就是到头了；
4. **名字后面喂 `true` 才是接着写**，不喂就是把册子擦干净重来；
5. 这几套本事都归 **`IOException`** 那一档 —— **要么当场接住，要么头上写 `throws IOException`**。
:::

## 小任务

1. 照着第一节的 `File` 那四个本事，把册子名字换成一个你自己的（比如 `zhangben.txt`）跑一遍，亲眼看一遍那个 `false` —— 然后**再跑一遍**，看看第二遍的「一开始在不在」变了没有。（我们这边每次都是新的空机器，你那边可不一样。）
2. 用 `try (FileWriter w = …)` 往册子上写三行数据记录，**每行末尾都写 `\n`**；再换成不写 `\n` 跑一遍，看看那三行是怎么挤成一条的。
3. 用 `readLine()` 的骨架把册子上的字一行行印出来，每行前面加上序号，最后印一行「一共 N 行」。
4. 第三步跑完之后，把写字的 `true` 去掉再跑一遍 —— **亲眼看一眼「撕掉重写」是怎么把前面那些字擦掉的**。
5. 故意把 `throws IOException` 删掉跑一次，把编译器说的那句话抄下来；看完记得加回去。

下一课，我们要把这一路学的东西全用上，做一个**用菜单指挥的小管理器** —— 去「待办事项管理器」探险 
