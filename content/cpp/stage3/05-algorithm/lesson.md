---
id: cpp-stage3-05
lang: cpp
stage: 3
order: 9
title: algorithm 算法库
tags: [STL, 算法]
required: ["cpp-stage3-25"]
crossRefs: []
estMinutes: 27
keywords: [sort, find, count, transform, lambda]
---

## 学习目标

本课学习algorithm 算法库。重点包括sort、find、transform、lambda 初识。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、`sort`：给一堆货排排坐

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v;
    v.push_back(9);
    v.push_back(2);
    v.push_back(7);
    sort(v.begin(), v.end());
    for (int x : v) {
        cout << x << endl;
    }
    return 0;
}
```

```text
2
7
9
```

**`sort`** 念「索特」，就是「排排坐」。它处理**两个输入接口，两个都是变量**：

- 第一个是**从哪儿起**（`v.begin()`）；
- 第二个是**到哪儿为止**（`v.end()`）。

第二个输入接口写成 `v.end()` 的时候，我们想起第一课那句话：**`end()` 是「到此为止」那把变量**，它指的位置不是最后一格、而是最后一格的后面 —— 可放到这里，它正好就是「**一直排到走完为止**」。所以这一句念作：**「从第一格起，到走完为止，整个柜子排一遍。」**

### 想从大到小：给它加一个「怎么比」的函数

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v;
    v.push_back(9);
    v.push_back(2);
    v.push_back(7);
    sort(v.begin(), v.end(), [](int a, int b) {
        return a > b;
    });
    for (int x : v) {
        cout << x << endl;
    }
    return 0;
}
```

```text
9
7
2
```

多出来的那一坨 `[](int a, int b) { return a > b; }` 是**顺手写出来的一个函数**（行话叫 lambda，念「兰布达」）。拆开看：

- **`[]`** —— 一对**空变量**：意思是「这个函数不抓外面的东西」（今天照着写一对空的就行，别的写法是后面的课的事）；
- **`(int a, int b)`** —— 它处理**两个**输入接口，就是摆在一起要比的那两件货；
- **`{ return a > b; }`** —— 它返回一句「**`a` 该排在 `b` 前面吗**」的答复（真 / 假）。

我们的记法：**写 `a > b` 就是「谁大谁先站」**（从大到小）；反过来写 `a < b` 就是小的先站（和不加它一个样）。**怎么比，是你说了算的。**

### 少写一格会怎样

我们手滑，把第二个输入接口写成了 `v.end() - 1`，心里想的是「少排一格、省点事」：

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v;
    v.push_back(9);
    v.push_back(2);
    v.push_back(7);
    sort(v.begin(), v.end() - 1);
    for (int x : v) {
        cout << x << endl;
    }
    return 0;
}
```

```text
2
9
7
```

印出来是 `2 9 7`：前面两格排好了，**最后那一格原样待着** —— 因为 `v.end() - 1` 的意思是「排到最后一格**为止**（不含它）」，那一格被排除在外了。整个柜子看起来还是乱的，而且**编译器一句话都没说**（我们拿最啰嗦的那档 `-Wall` 真跑过）。

记住：`sort` 的第二个输入接口要的就是 `v.end()` —— 它是「排到走完为止」那句话本身，**不用你减一**。

## 二、翻东西：`find` 和 `count`

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v;
    v.push_back(4);
    v.push_back(7);
    v.push_back(7);
    cout << count(v.begin(), v.end(), 7) << endl;
    if (find(v.begin(), v.end(), 4) != v.end()) {
        cout << "有 4" << endl;
    }
    if (find(v.begin(), v.end(), 9) == v.end()) {
        cout << "没有 9" << endl;
    }
    auto it = find(v.begin(), v.end(), 7);
    cout << *it << endl;
    return 0;
}
```

```text
2
有 4
没有 9
7
```

- **`count(v.begin(), v.end(), 7)`** —— 数一数柜子里有几个 `7` → 印 `2`。（和上一课名单柜的 `count` 是**同一个词**，可那个只回答 0 或 1，这个真的会数。）
- **`find(v.begin(), v.end(), 4)`** —— 在一堆货里翻 `4`。**它交出来的不是「有没有」，是一把变量**（指着翻到的那一格）！
- 所以「有没有」得拿它跟 `v.end()` 比：`!= v.end()` 是**翻到了**；`== v.end()` 是**翻遍了也没见着** —— 因为 `end()` 是那个「到此为止」的路标，变量停在那儿就说明它把整个柜子都走完了。
- 翻到的变量照样能用星星取货：`auto it = find(...)` 之后再 `*it`，印出 `7`。

光看这几行，看不出那个变量是怎么走的 —— 我们把它放慢，一格一格翻给你看：

```demo
title: find 交出来的是一个变量，不是「有没有」
code:
| vector<int> v;
| v.push_back(4);
| v.push_back(7);
| v.push_back(7);
| cout << count(v.begin(), v.end(), 7) << endl;
| if (find(v.begin(), v.end(), 4) != v.end()) {
|     cout << "有 4" << endl;
| }
| if (find(v.begin(), v.end(), 9) == v.end()) {
|     cout << "没有 9" << endl;
| }

step 起点：先开一个空柜子
at: 1
say: `vector<int> v;` 先开一个**空**柜子。今天我们不盯格号，只盯那个**变量** —— 它从哪儿起、在哪儿停，才是这一节要讲的事。
meow: 创建空 vector。
pose: expect
柜子里的货 = （空柜子）
变量停在 = （还没伸变量）
数到几个 7 = （还没数）
印出来 = （还没印）

step 塞第 0 格：4
at: 2
say: `push_back(4)` 往后塞一格，`4` 住进**第 0 格**。格号还是从 0 数起 —— 这是前面那排数组元素的老规矩。
meow: 4 存入 0 号。
pose: busy
柜子里的货 = 4
变量停在 = （还没伸变量）
数到几个 7 = （还没数）
印出来 = （还没印）

step 塞第 1 格：7
at: 3
say: 再塞一格 `7`，住进**第 1 格**。柜子自己长了一格，我们没提前说过要几格。
meow: 7 存入 1 号。
pose: busy
柜子里的货 = 4 7
变量停在 = （还没伸变量）
数到几个 7 = （还没数）
印出来 = （还没印）

step 塞第 2 格：又是一个 7
at: 4
say: 第 2 格又是一个 `7`。三条货到齐：`4 7 7` —— 记牢这个「两个 7」，下一步立刻要用上。
meow: 7 存入 2 号。
pose: yay
柜子里的货 = 4 7 7
变量停在 = （还没伸变量）
数到几个 7 = （还没数）
印出来 = （还没印）

step count：它真的会数
at: 5
say: `count(v.begin(), v.end(), 7)` 数一数这个范围里有几个 `7`。范围和排排坐用的是同一对变量：「从第 0 格起、到走完为止」。它**真的会数**，交出来的是个数：`2`。
meow: count 统计到 2 个 7。
pose: busy
柜子里的货 = 4 7 7
变量停在 = （还没伸变量）
数到几个 7 = 2
印出来 = （还没印）

step find 4：变量一格一格翻
at: 6
say: `find(v.begin(), v.end(), 4)` —— 变量从**第 0 格**起，一格一格往后翻。第 0 格正好就是 `4`，它当场**停住**。看清楚：它交出来的**不是「有没有」，就是这个停下来的变量**。
meow: find 在 0 号找到 4。
pose: expect
柜子里的货 = 4 7 7
变量停在 = 第 0 格（那儿是 4）
数到几个 7 = 2
印出来 = （还没印）

step 拿这个变量去比路标
at: 6
say: 「有没有」得**拿这个变量去比**：`!= v.end()` 问的是「你停在的地方，是不是那块『到此为止』的路标？」—— 它停在**第 0 格**，不是路标，答真。
meow: 结果不等于 end，表示找到。
pose: expect
柜子里的货 = 4 7 7
变量停在 = 第 0 格（那儿是 4）
数到几个 7 = 2
印出来 = （还没印）

step 答真才进花括号
at: 7
say: 答真才轮到花括号里那一行，屏幕上印出 `有 4`。**这里和排排坐不一样**：排排坐从来看你的眼色，它埋头把整个柜子排完就走。
meow: 输出「有 4」。
pose: yay
柜子里的货 = 4 7 7
变量停在 = 第 0 格（那儿是 4）
数到几个 7 = 2
印出来 = 有 4

step 换个 9 再翻：一路走到走完为止
at: 9
say: 换 `9` 再翻一遍：第 0 格是 `4`、第 1 格是 `7`、第 2 格还是 `7` —— 都不是。变量只能一格一格往下走，一直走到**走完为止**，停在 `v.end()` 那块路标上。
meow: 找 9，一直到 end 都没找到。
pose: busy
柜子里的货 = 4 7 7
变量停在 = 停在 v.end() 那块路标上
数到几个 7 = 2
印出来 = 有 4

step 停在路标上 = 翻遍了也没有
at: 10
say: `== v.end()` 答真 —— **变量停在路标上，就是「翻遍了也没有」**，于是印出 `没有 9`。一句话记牢：`find` 交出来的是变量，**变量停哪儿，就是它想跟你说的话**。
meow: 等于 end，输出「没有 9」。
pose: proud
柜子里的货 = 4 7 7
变量停在 = 停在 v.end() 那块路标上
数到几个 7 = 2
印出来 = 没有 9
```

::: warn 注意
**这里的 `find` 和上一课一串字的 `find` 不是一回事**：

- 一串字身上的 `find`，交出来的是一颗**编号**（第几颗开始），找不到给 `string::npos`；
- 这个函数格子里的 `find`，交出来的是一把**变量**，找不到给 `v.end()`。

两边的「有没有」写法也不一样：那边写 `!= string::npos`，这边写 `!= v.end()`。**别串门。**
:::

### 拿变量当「有没有」用，编译器当场拦下

我们偷懒的时候会这么写：

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v;
    v.push_back(1);
    v.push_back(2);
    v.push_back(3);
    if (find(v.begin(), v.end(), 9)) {
        cout << "找到了" << endl;
    } else {
        cout << "没有" << endl;
    }
    return 0;
}
```

```text
main.cpp:11:13: error: could not convert 'std::find<__gnu_cxx::__normal_iterator<int*, vector<int> >, int>(v.std::vector<int>::begin(), v.std::vector<int>::end(), 9)' from '__gnu_cxx::__normal_iterator<int*, std::vector<int> >' to 'bool'
    11 |     if (find(v.begin(), v.end(), 9)) {
```

念作：**「你要我们拿这句话条件判断，可它交出来的是一把变量 —— 变量没法当『真 / 假』使。」** 那串拗口的 `__gnu_cxx::__normal_iterator` 就是我们一直说的**变量**的本名。看到 `could not convert` 后面跟着它，就是把「翻到的位置」当成「有没有」用了。

## 三、整柜换货：`transform`

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v;
    v.push_back(1);
    v.push_back(2);
    v.push_back(3);
    transform(v.begin(), v.end(), v.begin(), [](int x) {
        return x * 2;
    });
    for (int x : v) {
        cout << x << endl;
    }
    return 0;
}
```

```text
2
4
6
```

**`transform`** 念「传斯佛姆」，它处理**四个**输入接口，按顺序念一遍就懂了：

1. **从哪儿起**（`v.begin()`）；
2. **到哪儿为止**（`v.end()`）；
3. **换好的货放到哪儿** —— 这里写的是 `v.begin()`，意思是**换回原地**（自己覆盖自己）；写别的柜子的变量，就是整柜换到那边去；
4. **怎么换** —— 就是那个顺手写的函数：处理一格、返回一格新的。

上面那个函数是 `[](int x) { return x * 2; }`：处理**一个**输入接口（不像排排坐那个处理两个），返回翻了一倍的数。

### 函数里那句 `return` 少不得

我们干过一件蠢事：把 `return` 漏掉，只写了一句 `x * 2;`。真跑一遍（最啰嗦的那档 `-Wall`），编译器先在那句话那一行**嘀咕了一句** `statement has no effect`（大意：「这句话写了跟没写一样」），然后**当场编不过** —— 最后那条报错还滚进了算法库自己的状态里，说 `void value not ignored as it ought to be`，大意是：**「你递进来的这个函数啥都没返回，可这儿要的是有东西返回的那种。」**

所以函数的套路是固定的：**执行一次 → `return` 一口**。少了 `return`，它就成了个空手的函数，哪个函数都不敢收。

## 四、一串字的货也能排排坐

```cpp
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

int main() {
    vector<string> names;
    names.push_back("张三");
    names.push_back("王五");
    names.push_back("李四");
    sort(names.begin(), names.end());
    for (auto s : names) {
        cout << s << endl;
    }
    return 0;
}
```

```text
张三
李四
王五
```

一排货是**一串字**的时候，`sort` 照样能排 —— 比法和上一课说的一样：**按编号码一位一位地比**。整数按数字大小、一串字按编号码，`sort` 两种都认。

::: tip 提示
「现成函数」还有一个很好用的地方：**它们只认变量，不认柜子**。也就是说，同一句 `sort(v.begin(), v.end())`，放在列表上用、放在一串字上用、放在别的柜子上用，都成立 —— 因为函数只跟**从哪儿起、到哪儿为止**打交道。这正是第一课说的那句：**变量是把柜子和函数缝在一起的那根线。**
:::

## 五、我们今天记住的三句话

::: tip 提示
1. **现成函数装在 `algorithm` 里**，用之前先写一句 `#include` 把它借出来。
2. **`sort` 处理两个变量**（从哪起、到哪止，第二个就写 `v.end()`，**别减一**）；想从大到小，就再递一个「怎么比」的函数（`a > b` 谁大谁先站）。
3. **`find` 交出来的是变量、不是「有没有」**（判断要写 `!= v.end()`）；`count` 数个数；`transform` 四个输入接口，第三个写回 `v.begin()` 就是原地换货。函数**别忘了 `return`**。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `#include` + `algorithm` | 把「现成函数」那个工具格子借出来 |
| `sort(v.begin(), v.end());` | 整个柜子从小到大排排坐 |
| `sort(v.begin(), v.end(), 比法);` | 按你给的比法排 |
| `[](int a, int b) { return a > b; }` | 函数：谁大谁先站（从大到小） |
| `sort(v.begin(), v.end() - 1);` | **坑**：最后一格被排除在外，它不参与排排坐 |
| `find(v.begin(), v.end(), x)` | 翻 `x`，交出来的是一把变量 |
| `find(...) != v.end()` | 翻到了 / 没翻到 —— 那个变量有没有停在「到此为止」的路标上 |
| `if (find(...))` | **坑**：变量当不了真 / 假 —— `could not convert` |
| `count(v.begin(), v.end(), 7)` | 数一数有几个 7 |
| `transform(v.begin(), v.end(), v.begin(), 怎么换)` | 从哪起、到哪止、换到哪儿去、怎么换 |
| `[](int x) { return x * 2; }` | 函数：执行一次、翻一倍、返回 |

## 小任务

1. 把第一节那段排排坐的代码里的 `sort` 那一句**删掉**，真跑一次 —— 印出来的顺序是不是又变回我们塞进去的顺序了？
2. 把第二段那个函数里的 `a > b` 改成 `a < b`，真跑一次 —— 从大到小又变回从小到大了吗？（提示：**怎么比是你说了算的**，这一句就是开关。）
3. 我们说「第二个输入接口别减一」，你亲手验一遍：把 `sort(v.begin(), v.end())` 改成 `sort(v.begin(), v.end() - 1)`，真跑一次，看看最后那一格有没有参与排排坐。
4. 写一段代码：开一个装整数的柜子，塞进 `5`、`1`、`9`、`5` 四个数，然后**先数一数有几个 5**、**再排一次**、最后走一圈印出来。
5. 想一想：我们说 `find` 交出来的是一把**变量** —— 那我们为什么能拿它去 `*it` 取货？（提示：上一课走柜子那套里的星星，就是干这个用的。）再想一想：要是柜子里有**两个** `7`，`find` 交出来的变量会指着哪一格？

到这里，STL 三样家当我们都带你摸过一遍了：**柜子**赋值、**变量**指路、**现成函数**干活。后面的课会有别的对象接着讲 —— 下一课讲的是「**自动管理资源的智能指针**」，专门解决「借出来的东西忘了还」这种麻烦事 
