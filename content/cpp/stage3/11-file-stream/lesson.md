---
id: cpp-stage3-11
lang: cpp
stage: 3
order: 15
title: 文件流操作
tags: [文件, IO]
required: ["cpp-stage3-10"]
crossRefs: []
estMinutes: 25
keywords: [ofstream, ifstream, getline, close, ios::binary]
---

## 学习目标

本课学习文件流操作。重点包括ofstream/ifstream、文本与二进制、读写实践。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、先把东西写进记录表

```cpp
#include <iostream>
#include <fstream>
using namespace std;

int main() {
    ofstream out("fish.txt");
    out << "数据" << endl;
    out << "商品" << endl;
    out << "毛线球" << endl;
    out.close();

    cout << "记好了" << endl;
    return 0;
}
```

```text
记好了
```

三件事记住：

- 开头那一句 `#include <fstream>` 是把这两件工具请进门。只写 `<iostream>` 的话，编译器压根不认识 `ofstream` 这个名字。
- 用起来的姿势和 `cout` 一模一样：`out << "数据"` 就是「把这条数据写进本子」。`endl` 还是那个「换一行」。
- `out.close()` 是**合上本子**。合上之前，写进去的东西不一定已经落到本子上。

::: tip 提示
记录表的名字（`"fish.txt"`）是**你自己起的**，写什么就用什么名字。它落在程序干活的该变量子里。名字起错、或者变量不一样，后面读的时候就会找不到 —— 这正是第四节的坑。
:::

## 二、再把它读回来

写进去的东西长什么样？读一遍就知道了。我们把「写」和「读」放在同一个程序里，这样一趟就能看见效果：

```cpp
#include <iostream>
#include <fstream>
#include <string>
using namespace std;

int main() {
    ofstream out("fish.txt");
    out << "数据" << endl;
    out << "商品" << endl;
    out << "毛线球" << endl;
    out.close();

    ifstream in("fish.txt");
    string line;
    while (getline(in, line)) {
        cout << "读到：" << line << endl;
    }
    return 0;
}
```

```text
读到：数据
读到：商品
读到：毛线球
```

拆开看：

- `ifstream in("fish.txt");` 是**翻开**那本小本子。
- `getline(in, line)` 一次返回**一整行**（行尾那个换行不算在里面）。它执行两次：从哪本本子里返回、读取放哪儿。
- `while (getline(in, line))` 念作「**只要还能返回一行，就接着干**」。本子读到头了，`getline` 返回不动了，这一圈自然就停 —— 不用你自己数行数。

```demo
title: 写进去三行，是怎么一行行返回的
code:
| ofstream out("fish.txt");
| out << "数据" << endl;
| out << "商品" << endl;
| out << "毛线球" << endl;
| out.close();
|
| ifstream in("fish.txt");
| string line;
| while (getline(in, line)) {
|     cout << "读到：" << line << endl;
| }

step 起点 · 拉开只管写的那本
at: 1
say: `ofstream out("fish.txt");` —— 名字里的 `of` 是 out file，这本**只管往外送**。名字是我们自己起的，本子不在它顺手新建一本。
meow: ofstream 打开文件用于写入。
pose: expect
文件 = fish.txt（只管写）
本子上排着 = （还空着）
这一趟返回的 = （还没翻开）
还能返回吗 = （还没到读的地方）

step 同一句话写三遍
at: 2
say: 第 2、3、4 行是同一句话写三遍 —— 姿势和 `cout` 一模一样，只是送的地方换成了本子。每一句末尾都跟着一个 `endl`，那就是「换一行」：所以本子上排着的是**三行**，不是挤成一条。
meow: 写入三行内容。
pose: busy
文件 = fish.txt（只管写）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = （还没翻开）
还能返回吗 = （还没到读的地方）

step 合上本子
at: 5
say: `out.close();` 是**合上本子**。第一节那句要紧的话就在这儿：**合上之前，写进去的东西不一定已经落到本子上** —— 这一句就是让它真落下去的动作。
meow: close 确保内容写入文件。
pose: milestone
文件 = fish.txt（合上了）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = （还没翻开）
还能返回吗 = （还没到读的地方）

step 同一个名字，换只读的翻开
at: 7
say: `ifstream in("fish.txt");` —— `if` 是 in file，这回请的是**只管读**的那一件。名字一模一样，翻开的就是刚才合上的那一本。
meow: 准备 line，打开文件读取。
pose: expect
文件 = fish.txt（只管读）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = （还没返回）
还能返回吗 = 还没问

step 头一趟：返回一行就能进圈
at: 9
say: `while (getline(in, line))` 这一行**一次做两件事**：`getline` 先返回**一整行**（行尾那个换行不算在里面），复制到了就算「能」，放行进圈。
meow: getline 读到第一行。
pose: think
文件 = fish.txt（只管读）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = 数据
还能返回吗 = 能

step 第 1 步
at: 10
say: 圈里那一行把刚返回的东西印出去 —— 「读到：数据」。本子上的一行字，到这儿变成了屏幕上的一行字。
meow: 输出第一行。
pose: yay
文件 = fish.txt（只管读）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = 数据
还能返回吗 = 能（这圈已放行）

step 又转回来：返回第 2 行
at: 9
say: 跑完一圈**回到第 9 行**再问一次 —— `getline` 从刚才停下的地方接着返回，这回返回「商品」。
meow: getline 读到第二行。
pose: busy
文件 = fish.txt（只管读）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = 商品
还能返回吗 = 能

step 第 2 步
at: 10
say: 屏幕上多出第二行「读到：商品」。**代码只写了一遍，跑几遍全看本子上排着几行** —— 我们一行行数都不用自己数。
meow: 输出第二行。
pose: yay
文件 = fish.txt（只管读）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = 商品
还能返回吗 = 能（这圈已放行）

step 又转回来：返回第 3 行
at: 9
say: 又回到这一行再问一次 —— 这是本子里最后一行了，`getline` 把它返回：「毛线球」，还是「能」，进最后一圈。
meow: getline 读到第三行。
pose: busy
文件 = fish.txt（只管读）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = 毛线球
还能返回吗 = 能

step 第 3 步
at: 10
say: 同一行代码跑第三遍：屏幕上印出「读到：毛线球」—— 本子里的三条，一条不落全印出来了。
meow: 输出第三行。
pose: yay
文件 = fish.txt（只管读）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = 毛线球
还能返回吗 = 能（这圈已放行）

step 第 4 步
at: 9
say: 又回到第 9 行问一次 —— 这回本子读到头了，`getline` **返回不动了**，这一圈自然就停。**不用我们自己数行数**：本子里有几行，它就转几圈加一趟。
meow: 读到文件末尾，循环结束。
pose: proud
文件 = fish.txt（只管读）
本子上排着 = 数据 / 商品 / 毛线球
这一趟返回的 = （没有下一行了）
还能返回吗 = 不能了，收工
```

## 三、一次返回一个数

本子里存的是数的时候，还有更省事的写法：`in >> x`。它能把数直接返回进变量，前面的空格和换行它自己会跳过。

```cpp
#include <iostream>
#include <fstream>
using namespace std;

int main() {
    ofstream out("nums.txt");
    out << 4 << " " << 6 << " " << 2 << endl;
    out.close();

    ifstream in("nums.txt");
    int x = 0;
    int total = 0;
    while (in >> x) {
        total = total + x;
    }
    cout << "一共 " << total << " 条" << endl;
    return 0;
}
```

```text
一共 12 条
```

`while (in >> x)` 和上一节的 `getline` 是一对好兄弟：**读得动就继续，读不动就散会**。这一行把「读几个数」这件事交回给本子自己说了算 —— 本子里有几个，就返回几个。

::: tip 提示
`getline` 和 `>>` 有一个要紧的差别：`getline` **连空格一起取走**（它认的是「一行」），`>>` **遇到空格就停**（它认的是「一样东西」）。想让一整句话原样读回来，用 `getline`；想从一串数里挨个返回，用 `>>`。
:::

## 四、本子没打开怎么办

要是那本小本子压根不在呢？比如名字打错了、或者被计算机取走了。C++ **不会当场摔** —— 它只会把本子留在「没打开」的状态，然后安安静静地什么都不读。你不问，就什么都发现不了。

所以翻开本子之后，**先问一句**：

```cpp
#include <iostream>
#include <fstream>
using namespace std;

int main() {
    ifstream in("meiyou.txt");
    if (!in.is_open()) {
        cout << "本子没找着" << endl;
        return 0;
    }
    cout << "本子打开了" << endl;
    return 0;
}
```

```text
本子没找着
```

`in.is_open()` 念作「**本子打开了吗**」。本子不在的时候它老老实实给出 `0`（假），那句话就被印出来了。

写的那一件工具也用同一句话查：`ofstream out("fish.txt");` 之后接一句 `if (!out.is_open()) { ... }`，变量没写权限、盘满了，都能当场发现，而不是等合上本子才发现一个字都没记上。

::: warn 注意
我们这里要老实交代一件事：**查本子在不在，别只写 `if (!in)`**。

我们把它和 `in.is_open()` 摆在一起真跑了一遍：本子不在的时候，`in.is_open()` 给 `0`（没打开），而 `!in` **给 `0`** —— 它答「没事」，**压根抓不到**。可它们**问的不是同一件事**：`is_open()` 只问「本子开没开」，`!in` 问的是「这本子还顺不顺」，本子读到一半坏了也一样答「不顺」。**这一节要的是「开没开」，所以写 `is_open()`。**

至于它为什么答「没事」，我们没刨到底 —— 你只要记住结论：**要问「本子开没开」，就写 `is_open()`，别绕道 `!in`。**（同一支程序我们还试了「先声明、再单独开一次」和「本子确实在」两种形状，`!in` 都是 `0`；`is_open()` 才是那个老实回答的。）
:::

::: warn 注意
**查与不查，程序都不会报错** —— 这是这一节最阴的地方。不查的话，读不到东西的程序照样跑完、照样印出「一共 0 条」，看起来一切正常。所以我们的习惯是：**翻开本子之后立刻 `if (!in.is_open())` 一下**，把「本子不在」和「本子是空的」这两件事分开。
:::

## 五、文字版还是二进制版

同样是那个 `3`，记进记录表有两条路：

- **文字版**：把 `3` 当成一个字写进去。本子翻开，你一眼就能看懂，用记事本也能改。
- **二进制版**：把 `3` 在机器里那串字节**原样**倒进去。本子翻开是一堆看不懂的符号，但它跟机器里放着的样子一模一样。

开二进制版，只要在翻开本子的时候多说一句话：`ios::binary`。

```cpp
#include <iostream>
#include <fstream>
#include <string>
using namespace std;

int main() {
    int n = 3;

    ofstream textOut("text.txt");
    textOut << n << endl;
    textOut.close();

    ofstream binOut("num.dat", ios::binary);
    binOut.write((char*)&n, sizeof(n));
    binOut.close();

    string s;
    ifstream textIn("text.txt");
    getline(textIn, s);

    int back = 0;
    ifstream binIn("num.dat", ios::binary);
    binIn.read((char*)&back, sizeof(back));

    cout << "文字版读回来：" << s << endl;
    cout << "二进制版读回来：" << back << endl;
    return 0;
}
```

```text
文字版读回来：3
二进制版读回来：3
```

两边读回来的东西**一模一样**，本子里躺着的却是两副样子。三件事记住：

- `write((char*)&n, sizeof(n))` 执行两次：**货在哪儿**（`&n`）、**几个字节**（`sizeof(n)`）。合起来的意思是「从 `n` 那儿起，原样倒出这么多字节」。
- `read((char*)&back, sizeof(back))` 是它的反向操作：从本子里倒进 `back` 这么多字节。
- 二进制版**不认字**，它只认「当初我倒了几个字节、什么形状」。所以读回来必须**还是同一个类型**：当初倒的是 `int`，就得读进 `int`。

那要是把两条路混着走呢？我们真跑了一次 —— 把二进制那本本子用文字的方式读：

```cpp
#include <iostream>
#include <fstream>
using namespace std;

int main() {
    int n = 3;
    ofstream out("num.dat", ios::binary);
    out.write((char*)&n, sizeof(n));
    out.close();

    ifstream in("num.dat");
    int x = 0;
    if (in >> x) {
        cout << "读到了：" << x << endl;
    } else {
        cout << "读不动" << endl;
    }
    return 0;
}
```

```text
读不动
```

二进制那本本子里躺着的是 `3` 的字节 `03 00 00 00`，而文字读法要去认「数字的长相」—— 它连第一个字节都对不上，于是当场放弃了。

::: tip 提示
选哪一条路，看你要什么：**要给人看、要能拿记事本改** → 文字版；**要原样存回来**（图片、一串数的原样备份）→ 二进制版。两边不能混读，混了就是上面那句「读不动」。
:::

## 一句话对照表

| 想干什么 | 写什么 |
|---|---|
| 请一个只写的记录表 | `ofstream out("文件名");` |
| 请一个只读的记录表 | `ifstream in("文件名");` |
| 往本子里写字 | `out << 内容 << endl;` |
| 从本子里返回一整行 | `getline(in, line)` |
| 从本子里返回一个数 | `in >> x` |
| 合上本子 | `out.close();` |
| 查本子打开没有 | `if (!in.is_open()) { ... }` |
| 开二进制版 | `ios::binary` ，再配 `write` / `read` |

## 小任务

1. 把第一节那段改一改：往本子里写**五行**数据的名字，再翻开数一数到底有几行（用 `while (getline(in, line))` 转圈，数一个加一）。
2. 我们在第三节里往本子里写了 `4 6 2` 三个数。你自己加两个数进去，先猜一猜 `一共` 后面会是多少，再真跑对答案。
3. 试着把第四节那个文件名 `meiyou.txt` 换成真的本子名 —— 「本子没找着」那句是不是就不出现了？
4. 想一想：为什么我们把「写」和「读」塞进同一个程序里？如果分成两个程序，第二个程序一跑起来，它还看得见第一本本子吗？

下一课我们要干一件更热闹的事：**叫好几个对象同时干活**。可它们抢同一本账的时候会出事 —— 那正是下一课要收拾的场面 
