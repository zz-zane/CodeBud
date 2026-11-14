---
id: java-stage2-14
lang: java
stage: 2
order: 14
title: 综合项目：待办事项管理器
tags: [综合项目, 待办事项]
required: ["java-stage2-13"]
crossRefs: []
estMinutes: 30
keywords: [class, ArrayList, toString, FileWriter, Scanner]
---

## 学习目标

本课学习综合项目：待办事项管理器。重点包括类设计、ArrayList、文件、菜单。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> zhi = new ArrayList<>();
        zhi.add("喂鱼");
        System.out.println("现在有 " + zhi.size() + " 件");
    }
}
```

```text
现在有 1 件
```

## 一、给一条事项定义类

一条事项要装两样东西：**内容**（喂鱼）和**办完了没**（是 / 否）。先定义类：

```java
class Todo {
    private String what;
    private boolean done;

    Todo(String what, boolean done) {
        this.what = what;
        this.done = done;
    }

    String getWhat() { return what; }
    boolean isDone() { return done; }
    void markDone() { done = true; }

    @Override
    public String toString() {
        return (done ? "[x] " : "[ ] ") + what;
    }
}

public class Main {
    public static void main(String[] args) {
        Todo t = new Todo("喂鱼", false);
        System.out.println(t);
        t.markDone();
        System.out.println(t);
        System.out.println("办完了没：" + t.isDone() + "，内容：" + t.getWhat());
    }
}
```

```text
[ ] 喂鱼
[x] 喂鱼
办完了没：true，内容：喂鱼
```

这张类定义上有五样活，我们挨个说：

- **两格家当都关在类定义里**（`private`）。外面想看，得调用 `getWhat()` / `isDone()` 这两招 —— 这是第 1 课那条「家当关起来，留几个正经门」的老规矩。
- **`markDone()`** 是「办完了」这个动作：把里面那格改成 `true`。外面**不许直接改**，只能调用这一个方法 —— 有一天我们想给「办完」加点花样（记个时间什么的），只改这一处就够了。
- **造物方法的两样重名**：括号里传入的叫 `what`，类定义里那格也叫 `what`。**`this.what` 指的是类定义里那一格**，光写 `what` 指的是传入那一样。这一课最容易摔的地方就在这儿，我们下面还要拿它出一道题。

还有最后那一个方法 `toString()`：我们**没称呼它**，可 `System.out.println(t)` 印出来的就是 `[ ] 喂鱼`。这是编译器和我们的一个约定：**印一个类定义的时候，它先去问这张类定义有没有 `toString()`**，有就照那个来。`@Override` 那顶小帽子是提醒「我们在重写师父就有的那一个方法」（下面第 15 课还会跟它打交道）。

`(done ? "[x] " : "[ ] ") + what` 这一行是「二选一」的老写法：办完了就用 `[x] `，没办就用 `[ ] `，再接上内容。

## 二、把事项收进储物柜

一条事项画好了，一堆事项就交给储物柜：

```java
import java.util.ArrayList;
import java.util.List;

class Todo {
    private String what;
    private boolean done;

    Todo(String what, boolean done) {
        this.what = what;
        this.done = done;
    }

    void markDone() { done = true; }

    @Override
    public String toString() {
        return (done ? "[x] " : "[ ] ") + what;
    }
}

public class Main {
    public static void main(String[] args) {
        List<Todo> zhi = new ArrayList<>();
        zhi.add(new Todo("喂鱼", false));
        zhi.add(new Todo("清理", true));
        zhi.add(new Todo("买商品", false));
        for (Todo t : zhi) {
            System.out.println(t);
        }
        System.out.println("一共 " + zhi.size() + " 件");
        zhi.get(0).markDone();
        System.out.println("第 1 件现在长这样：" + zhi.get(0));
    }
}
```

```text
[ ] 喂鱼
[x] 清理
[ ] 买商品
一共 3 件
第 1 件现在长这样：[x] 喂鱼
```

三处值得盯一眼：

- **`List<Todo>` 尖括号里写的是类定义名** —— 这个柜子**只收 `Todo` 类定义生的东西**（第 10 课那块名称，今天派上大用场了）。
- **`zhi.get(0).markDone()`** 这一行连着两下：`get(0)` 从柜子里**取出第 1 件**（编号从 `0` 起），后面那个 `.markDone()` 是**称呼它自己那一个方法**。柜子里保存的是实例，调用本事直接调用得着。
- **`System.out.println(t)` 里那句是 `t` 本身**，可它印得好好的 —— 还是 `toString()` 的功劳。

::: warn 注意
**编号从 `0` 起，可是菜单上的「第几件」是从 `1` 起的。** 我们在屏幕上看到「1. 喂鱼」，引用的却是 `zhi.get(0)`；看到「第 2 件」引用的是 `zhi.get(1)`。**这两个数差 1**，是这一课最爱摔跤的地方 —— 我们自己就摔过（等下那道改错题就是它）。
:::

## 三、菜单：一条条命令分岔走

现在轮到「我们敲命令」这件事了。真机上是一行行读键盘，可我们在课文里没法等你敲 —— **所以我们先把要敲的命令收进一个储物柜，代码照着一条条取就行**。逻辑一模一样：

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> zhi = new ArrayList<>();
        List<String> orders = new ArrayList<>();
        orders.add("add 喂鱼");
        orders.add("add 清理");
        orders.add("list");
        orders.add("q");

        for (String line : orders) {
            if (line.equals("q")) {
                break;
            }
            if (line.startsWith("add ")) {
                zhi.add(line.substring(4));
                System.out.println("记下了：" + line.substring(4));
            } else if (line.equals("list")) {
                for (int i = 0; i < zhi.size(); i++) {
                    System.out.println((i + 1) + ". " + zhi.get(i));
                }
            }
        }
        System.out.println("收工，一共 " + zhi.size() + " 件");
    }
}
```

```text
记下了：喂鱼
记下了：清理
1. 喂鱼
2. 清理
收工，一共 2 件
```

拆开看这几样新东西：

- **`line.startsWith("add ")`** —— 认「这条命令是不是以 `add ` 开头」。「敲的是 `add 喂鱼`」，那我们要的内容就是**开头那四个字母之后的部分**：`line.substring(4)`（`substring` 是从第几个字母起、把后面全切下来）。
- **`line.equals("q")`** —— 「这条命令是不是就是 `q`」。
- **`break`** —— **这一圈跳出去，绕圈到此为止**。敲了 `q` 就靠它收摊，后面就算还有命令也不理了。
- **`(i + 1) + ". "`** —— 印给我们看的编号从 `1` 起；`zhi.get(i)` 里那个 `i` 是从 `0` 起的。**括号里那个 `+ 1` 就是这道缝**。

真机上怎么用？把「从一个储物柜里一条条取」换成「从传入里一行行读」，其余一模一样：

```text
import java.util.Scanner;

Scanner sc = new Scanner(System.in);
while (sc.hasNextLine()) {
    String line = sc.nextLine().trim();
    ... 里面一模一样 ...
}
```

`while (sc.hasNextLine())` 是「纸上还有下一行吗」—— **一行行读到没有为止**（这就是上一课那本册子读到头的那套办法，只不过这回读的是我们敲的字）。`trim()` 把两头看不见的空白剃掉，免得手滑多敲一个空格就认不出来了。

::: tip 提示
菜单的骨架就这一套：**绕圈取一行 → 一条条比过去（`if` / `else if`）→ 比中就干活 → 敲 `q` 就 `break`**。以后做什么小工具，换的只是「比出来之后干什么」，骨架一个字不用改。
:::

## 四、册子：存进去、读回来

上一课的册子终于派上用场了。清单要存下来，我们定的格式是**一行一条**，写成 `办完了没|内容` 的样子：

```text
0|喂鱼
1|清理
```

左边那个 `0` / `1` 就是「办完了没」（`0` 没办、`1` 办了），中间一根**竖线**把两样东西隔开。为什么要这根竖线？因为我们**得有能力把它切回两样东西**呀 —— 光写「0喂鱼」的话，读回来就分不清哪儿是标记、哪儿是内容了。

存和读各写成一个方法（这一课的完整版里就是这么写的）：

```text
static void save(List<Todo> zhi) throws IOException {
    try (FileWriter w = new FileWriter(BOOK)) {
        for (Todo t : zhi) {
            w.write((t.isDone() ? "1" : "0") + "|" + t.getWhat() + "\n");
        }
    }
}

static List<Todo> load() throws IOException {
    List<Todo> out = new ArrayList<>();
    File f = new File(BOOK);
    if (!f.exists()) {
        return out;
    }
    try (BufferedReader r = new BufferedReader(new FileReader(f))) {
        String hang = r.readLine();
        while (hang != null) {
            int cut = hang.indexOf("|");
            String flag = hang.substring(0, cut);
            String what = hang.substring(cut + 1);
            out.add(new Todo(what, flag.equals("1")));
            hang = r.readLine();
        }
    }
    return out;
}
```

四个地方是我们特意这么写的：

- **`if (!f.exists()) return out;`** —— 册子**不在**的时候直接交一个空柜子。第一次用这本册子的时候它当然不在 —— 上一课学过：册子不在还硬去拉，编译器会当场断气（`FileNotFoundException`）。**这是一个空柜子，不是空想：`new ArrayList<>()` 已经在那儿了。**
- **`hang.indexOf("|")`** —— 那根竖线在第几个字母上。`substring(0, cut)` 是竖线**左边**那一截（标记），`substring(cut + 1)` 是竖线**右边**那一截（内容）—— 加一那一下是为了**把竖线本身跳过去**。
- **`flag.equals("1")`** —— 读回来的「办完了没」得**从册子上读出来**，不能一律当成没办。存的是什么，读回来就该是什么，这是这一课的一条硬规矩。
- **两个方法头上都有 `throws IOException`** —— 册子那套本事全归「要表态的」那一档（上一课的老规矩）。

## 五、串起来：完整的小管家

四样凑齐，就是下面这一段（我们把命令摆在储物柜里演示，真机上换成读键盘那三行就行）：

```java
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

class Todo {
    private String what;
    private boolean done;

    Todo(String what, boolean done) {
        this.what = what;
        this.done = done;
    }

    String getWhat() { return what; }
    boolean isDone() { return done; }
    void markDone() { done = true; }

    @Override
    public String toString() {
        return (done ? "[x] " : "[ ] ") + what;
    }
}

public class Main {
    static final String BOOK = "zhi.txt";

    public static void main(String[] args) throws IOException {
        List<Todo> zhi = load();
        System.out.println("册子上原有 " + zhi.size() + " 件");

        List<String> orders = new ArrayList<>();
        orders.add("add 喂鱼");
        orders.add("add 清理");
        orders.add("done 1");
        orders.add("list");
        orders.add("q");

        for (String line : orders) {
            if (line.equals("q")) {
                break;
            }
            if (line.startsWith("add ")) {
                zhi.add(new Todo(line.substring(4), false));
                System.out.println("记下了：" + line.substring(4));
            } else if (line.startsWith("done ")) {
                int k = Integer.parseInt(line.substring(5));
                zhi.get(k - 1).markDone();
                System.out.println("办完了：" + zhi.get(k - 1).getWhat());
            } else if (line.equals("list")) {
                for (int i = 0; i < zhi.size(); i++) {
                    System.out.println((i + 1) + ". " + zhi.get(i));
                }
            }
        }
        save(zhi);
        System.out.println("收工，一共 " + zhi.size() + " 件");
    }

    static List<Todo> load() throws IOException {
        List<Todo> out = new ArrayList<>();
        File f = new File(BOOK);
        if (!f.exists()) {
            return out;
        }
        try (BufferedReader r = new BufferedReader(new FileReader(f))) {
            String hang = r.readLine();
            while (hang != null) {
                int cut = hang.indexOf("|");
                String flag = hang.substring(0, cut);
                String what = hang.substring(cut + 1);
                out.add(new Todo(what, flag.equals("1")));
                hang = r.readLine();
            }
        }
        return out;
    }

    static void save(List<Todo> zhi) throws IOException {
        try (FileWriter w = new FileWriter(BOOK)) {
            for (Todo t : zhi) {
                w.write((t.isDone() ? "1" : "0") + "|" + t.getWhat() + "\n");
            }
        }
    }
}
```

```text
册子上原有 0 件
记下了：喂鱼
记下了：清理
办完了：喂鱼
1. [x] 喂鱼
2. [ ] 清理
收工，一共 2 件
```

第一行那个 `0` 是我们特意让你看的：**这一段跑起来的时候册子还不存在**，所以 `load()` 走的是「交一个空柜子」那条路。跑到最后 `save()` 把两件都写进册子 —— **你再跑一遍，第一行就变成 `册子上原有 2 件` 了**（我们这边每趟都是干净的机器，所以我们看到的一直是 `0`；你那边不一样，正好把「真的存下来了」这件事亲眼看一遍）。

`done 1` 那一条也值得看一眼：菜单上写 `1`，我们引用的是 `zhi.get(k - 1)` —— **`- 1` 那一下就是缝的位置**，漏了它，办的就是第 2 件；要是敲 `done 2` 又漏了它，办的就成了第 3 件（我们想办的那一条还空着）。

::: tip 提示
这一课的四样东西，一句话串起来：

1. **一条事项**画成类定义：家当关起来、造物方法里用 `this.` 分清楚、`toString()` 管印出来的样子；
2. **一堆事项**收进 `List<Todo>`：编号从 `0` 起，屏幕上写给我们看的编号从 `1` 起；
3. **菜单**一套骨架：绕圈取一行 → `if` / `else if` 一条条比 → `q` 就 `break`；
4. **存进册子**一行一条、竖线分开，**读回来**接着切、`exists()` 先查、头上 `throws IOException`。
:::

## 小任务

1. 把第二节的储物柜多添两件，跑一遍；再把 `zhi.get(0).markDone()` 改成 `zhi.get(2).markDone()`，看看勾挪到哪儿去了。
2. 自己在类定义上加一个方法 `undone()`（把「办完了没」改回没办），让菜单里也能敲 `undone 1` —— 想想它该动哪一格家当。
3. 把第三节那个储物柜换成真的读键盘（`while (sc.hasNextLine())` 那三行），自己敲几条命令试试：`add 喂鱼`、`list`、`done 1`、`q`。
4. 把完整版跑两遍：第一遍跑完，**把程序关掉再开**，看看第一行变成几件了 —— 这就是「存下来了」的证据。
5. 故意把 `load()` 里的 `flag.equals("1")` 换成 `false`，再跑一遍，看看册子上记的「办完了」是不是白记了。

下一课，我们要拿这一路的本事做一个**更热闹的** —— 类定义不止一张、还要分个亲疏远近，来「学生信息管理系统」探险 
