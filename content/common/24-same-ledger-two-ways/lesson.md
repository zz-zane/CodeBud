---
id: common-24
lang: common
stage: 0
order: 21
title: 结构体与类的记账实现对照
tags: [面向对象, 类与对象, 封装]
required: ["common-23"]
crossRefs: ["cpp-stage2-01","java-stage1-12","python-stage1-14","common-10"]
estMinutes: 17
keywords: [struct, class, public, private]
---

## 学习目标

本课学习结构体与类的记账实现对照。重点包括结构体版：函数站外面、类定义版：函数画进类定义、三个维度说差别、两位学员走一遍。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 结构体版：函数站在外面（上一课那本）

先重温账本的第一版。核心只有三段：一个类定义、一排账、三个方法站在外面：

```c
#include <stdio.h>
#include <string.h>

typedef struct {
    char name[20];
    int score;
} Student;

Student list[100];      /* 一排学员的账，全校共用这一本 */
int count = 0;          /* 已经记了几位 */

void add_student(char name[], int score) {
    strcpy(list[count].name, name);
    list[count].score = score;
    count = count + 1;
}

int find_by_name(char name[]) {
    for (int i = 0; i < count; i++) {
        if (strcmp(list[i].name, name) == 0) {
            return i;
        }
    }
    return -1;
}

void print_all(void) {
    for (int i = 0; i < count; i++) {
        printf("%s %d\n", list[i].name, list[i].score);
    }
}
```

外面用起来是这样：

```c
add_student("张三", 95);
add_student("李四", 88);
print_all();
```

这一版有三处值得盯住看：

1. **三个方法都站在类定义外面**。想记人，把「名字、分数」告诉 `add_student`；想查人，`find_by_name` 报的是「第几位」（找不到回 `-1`）。账是账、招是招，两下是**分家**的。
2. **两格全敞着**。谁都能写一句 `list[0].score = list[0].score + 5;`，改了也没人拦 —— 因为 C 里根本没有「盖子」这回事。
3. **调用方式不用点名**：`add_student(...)`、`print_all()` —— 不用提「跟哪本账说话」，因为账只有全局的这一本。

## 类定义版：函数画进类定义里（同一本账）

同一笔账，这次不换需求，只换写法。我们先画**两张类定义**：

```python
class Student:
    def __init__(self, name, score):
        self._name = name        # 私有：名字
        self._score = score      # 私有：分数

    def get_name(self):          # 口子：报名字
        return self._name

    def add_score(self, delta):  # 口子：加分
        self._score = self._score + delta

    def report(self):            # 口子：报账
        print(f"{self._name}：{self._score} 分")

class Roster:
    def __init__(self):
        self._students = []      # 私有：一排学员

    def add(self, name, score):              # 口子：记一位新学员
        self._students.append(Student(name, score))

    def find(self, name):                    # 口子：按名字找人
        for s in self._students:
            if s.get_name() == name:
                return s
        return None

    def report_all(self):                    # 口子：把账报一遍
        for s in self._students:
            s.report()

roster = Roster()
roster.add("张三", 95)
roster.add("李四", 88)
roster.report_all()
```

```text
张三：95 分
李四：88 分
```

这就是行话里的**面向对象（实例当主角）**：数据与操作绑在一起、长在一位位实例身上，外面只跟口子打交道。这张「学员」的类定义，术语表里叫**类**；照它创建后的每一位，叫**对象** —— 在这本账里，就是一位位真学员。拆开看：

- **学员类定义（`class Student`）**：两格账（名字、分数）都盖上了盖子 —— 名字前那一个下划线 `_` 就是盖子。露在外面的只有几道**口子**：`get_name` 报名字、`add_score` 加分、`report` 报账。
- **档案库类定义（`class Roster`）**：账本自己管自己 —— 它**自带**一排学员（`self._students`，也盖着盖子），露在外面的口子是 `add`（记人）、`find`（按名字找人）、`report_all`（报账）。
- **外面只剩口子可走**：`roster.add("张三", 95)` —— 先说是**哪个档案库**，再调用口子名；比第一版多了一小段「跟谁说话」。

上一课那三个方法，一道道搬进类定义里：`add_student` → 口子 `add`；`find_by_name` → 口子 `find`（上一版报的是「第几位」，这版直接把**那一位学员**递出来，找不到回 `None`）；`print_all` → 口子 `report_all`。报账这件小事还分成了两层：档案库负责「走一圈」（`report_all`），每位学员负责「报自己」（`report`）。

拿一路立下来的判据句量一量：**封装＝藏数据、露行为**。这一版里，数据（两格、一排名单）全藏进盖子，露在类定义外面的是口子 —— 这才叫改造到位。要是你把函数搬进大括号、两格还敞着，那可不算类定义版 —— 那是「**结构体＋函数容器**」，换了个地方收着而已。

## 三个维度，说出两版的差别

两版摆齐了，我们用三个维度说出差别。

**维度一：函数站在哪儿 —— 数据与操作绑没绑在一起。**
第一版的 `add_student`、`find_by_name`、`print_all` 站在类定义**外面**，每次都得自己拎着「哪本账」去干活；第二版里，报账画在学员类定义里面（`report`）、记人画在档案库类定义里面（`add`）—— 谁的数据谁自己动，函数不用再满世界找账本。

**维度二：盖子开不开 —— 默认权限与「标签站哪一行」。**
第一版两格全敞着，不是我们懒 —— 是 C 里没有盖子这个东西。到了有类定义和盖子的语言里，各家的规矩不一样：

- **C++**：开场白是 `struct` 的类定义，默认**敞开**；开场白是 `class` 的类定义，默认**盖着** —— 同一个类定义，就差开头那一个词。没写标签的时候，等于头顶**隐形**站着一块标签，站哪一块由开场白说了算：

```cpp
struct Student {      // 开场白：struct
    int score;        // 默认 = 谁都能碰（头顶隐形站着一句 public:）
};

// 同一个类定义，只换开场那一个词 —— 同一份代码里只立得住一块 Student，
// class 版收在下面，对着「默认」那一列读：
// class Student {
//     int score;      // 默认 = 藏起来（头顶隐形站着一句 private:）
// };
```

写出来的标签（`public:` / `private:`）也有规矩：**一块标签管一段，一直到下一块标签站起来**。这就是「标签站哪一行」的看头 —— 想知道一格归谁管，就往上找**最近的一块标签**。

- **Java**：每一格、每一道口子都习惯**写明** `private` 还是 `public`（不写的那档权限小得很，出了这个圈子就够不着）。
- **Python**：靠名字前面那一个下划线 `_` 把格子盖起来 —— 没有真锁，靠的是全体对象守的家规：谁起了这个头，别的对象就按规矩不掀。

**维度三：口子有几道 —— 「接口约定」和「改需求的改动面」。**
第二版里，外面跟这本账打交道的地方只剩几道口子：`roster.add(...)`、`roster.find(...)`、`roster.report_all()` —— 这几道口子合起来的那份约定，术语表里叫**接口（接口约定）**：说好会这招的对象，都得能用这招。

口子还有个最实在的好处：**改动面收窄**。以后我们想让报账多印一句「（工作区学堂）」，只改类定义里 `report` 那一个方法，外面所有调用口子的地方**一个字都不用动**。第一版遇到同样的改动，账和函数分着站，我们得追着改一串地方 —— 上一课那笔滚起来的账，就是这么来的。

## 四位编译器或解释器，同一笔账

同一件事：给账上记一位学员「张三，95 分」，再请它自己报一报。

```compare
c::
#include <stdio.h>
#include <string.h>

typedef struct {
    char name[20];
    int score;
} Student;

void report(Student s) {          /* 报账这一个方法站在类定义外面 */
    printf("%s：%d 分\n", s.name, s.score);
}

int main(void) {
    Student s;
    strcpy(s.name, "张三");
    s.score = 95;
    report(s);                    /* 把整只盒子传入函数里 */
    return 0;
}

cpp::
#include <iostream>
#include <string>
using namespace std;

class Student {
private:                    // class 默认就是盖着的，这里写明给你看
    string name;
    int score;

public:                     // 这一行起，下面是留给外面的口子
    void fill(string n, int s) {
        name = n;
        score = s;
    }

    void report() {
        cout << name << "：" << score << " 分" << endl;
    }
};

int main() {
    Student s;
    s.fill("张三", 95);      // 填格子走口子
    s.report();              // 报账由这一位自己做
    return 0;
}

java::
class Student {
    private String name;
    private int score;

    public void fill(String n, int s) {
        name = n;
        score = s;
    }

    public void report() {
        System.out.println(name + "：" + score + " 分");
    }
}

public class Main {
    public static void main(String[] args) {
        Student s = new Student();
        s.fill("张三", 95);
        s.report();
    }
}

python::
class Student:
    def __init__(self, name, score):
        self._name = name        # 初始化那一刻就把两格装好
        self._score = score

    def report(self):
        print(f"{self._name}：{self._score} 分")

s = Student("张三", 95)
s.report()
```

```text
张三：95 分
```

看出来了吗：**同一个需求，C 只给得出版本一，后面三位给的都已经是版本二了**。

- **C**：`struct` 装两格，报账这一个方法**站在外面**（`report(s)`），还得把整位学员传入；两格没有盖子，谁都能伸手。
- **C++**：`class` 类定义先写 `private:`（其实 `class` 默认就是盖着的），再写 `public:` 留口子；外面只能 `s.fill(...)`、`s.report()`。C++ 那一线管这样的 `struct` 叫「卡片类定义」—— 它和 `class` 几乎是同一台机器，差别就在开场那一个词。
- **Java**：每一格、每一道口子都**写明** `private` / `public`；创建一个要调用 `new`。
- **Python**：`__init__` 在初始化那一刻就把两格装好；名字前面那一个下划线（像 `_name` 这样的）就是盖子，露在外面的是 `report` 这道口子。

四位编译器或解释器的共识就一条：**数据可以盖起来，口子得写清楚**。

## 走一遍：两位学员，两本账

类定义版转起来是什么样，我们拆成一步一步给你看：

```demo
title: 同一个档案库、两位学员，账是怎么各归各的
code:
| class Student:
|     def __init__(self, name, score):
|         self._name = name
|         self._score = score
|     def report(self):
|         print(f"{self._name}：{self._score} 分")
| class Roster:
|     def __init__(self):
|         self._students = []
|     def add(self, name, score):
|         self._students.append(Student(name, score))
|     def report_all(self):
|         for s in self._students:
|             s.report()
| roster = Roster()
| roster.add("张三", 95)
| roster.add("李四", 88)
| roster.report_all()

step 画学员类定义：两格 + 一道口子先占位
at: 1
say: `class Student:` 一落笔，学员类定义开了个头。类定义上将来有**两格**（第 3、4 行是它们初始化时被装好的样子）、一道报账口子（第 5 行）—— 两格都盖着盖子。对照第一版：结构体版这里只有两格光溜溜的格子，报账那一个方法站在类定义**外面**。
meow: 类开始定义，还没有学员。
pose: expect
类定义 Student = 画好了（本身不是学员）
类定义 Roster = 还没画
roster 的名册 = 还没生
张三的账 = 还没生
李四的账 = 还没生
标准输出 = 还没印

step 初始化那一个方法先画上：一创建后就装好两格
at: 2
say: `def __init__(self, name, score):` 是类定义上的一条说明：照它生学员的时候，先把名字和分数传入。这一刻它还**一次都没跑过** —— 还没有学员初始化。第一版里没有这一个方法，生完还得自己伸手一格一格装。
meow: 初始化方法先记着，创建时才用。
pose: expect
类定义 Student = 画好了（那招还没跑过）
类定义 Roster = 还没画
roster 的名册 = 还没生
张三的账 = 还没生
李四的账 = 还没生
标准输出 = 还没印

step 再画档案库类定义：自带一排名单 + 两道口子
at: 7
say: 第二张类定义 `class Roster:`（档案库）开工。它**自己带**一排学员名单（第 9 行那句 `self._students = []`，名单也盖着盖子），类定义上留了两道口子：`add`（记一位新学员）和 `report_all`（把账报一遍）。
meow: 档案库的类也定义好了。
pose: expect
类定义 Student = 画好了（那招还没跑过）
类定义 Roster = 画好了（自带一排名单）
roster 的名册 = 还没生
张三的账 = 还没生
李四的账 = 还没生
标准输出 = 还没印

step 照档案库类定义创建一个真档案库
at: 15
say: `roster = Roster()` 创建的是**档案库**，不是学员 —— 账上还是一个人都没有：类定义画的是「库该有什么、会什么」，库站在那儿，等你往里记人。
meow: 档案库创建好，名单还是空的。
pose: busy
类定义 Student = 画好了（那招还没跑过）
类定义 Roster = 画好了（自带一排名单）
roster 的名册 = 空的
张三的账 = 还没生
李四的账 = 还没生
标准输出 = 还没印

step 走 add 口子，记第一位
at: 16
say: `roster.add("张三", 95)` —— 外面**不伸手掏格子**，只调用口子。口子里那一句（第 11 行）先照 `Student` 类定义创建一位新学员：类定义上那招初始化法（第 2 行）这时候才真的开始跑。
meow: 调用方法，创建新学员。
pose: busy
类定义 Student = 画好了（那招开始跑了）
类定义 Roster = 画好了（自带一排名单）
roster 的名册 = 空（这一位还在初始化）
张三的账 = 刚初始化，两格还空着
李四的账 = 还没生
标准输出 = 还没印

step 「张三」落进它自己的格子
at: 3
say: `self._name = name` —— 传入的「张三」装进**这一位自己**的名字格。名字前面那一个下划线就是盖子 —— 不过这是全体对象的家规，不是真锁：外面**看得见** `s._name`，可规矩是「别人的格子，不许伸变量」。想知道名字，走它留的口子。
meow: 名字存进这位学员自己。
pose: busy
类定义 Student = 画好了（那招开始跑了）
类定义 Roster = 画好了（自带一排名单）
roster 的名册 = 空（这一位还没收进来）
张三的账 = 名字「张三」、分数（还没装）
李四的账 = 还没生
标准输出 = 还没印

step 第 95 步
at: 4
say: `self._score = score` 同一套动作；装完，第一位学员两格齐了 —— 名字和分数都在**它自己**身上，不在类定义上。生好之后，它才被收进档案库的名册里（第 11 行后半句）。
meow: 两格都存好，加入名单。
pose: yay
类定义 Student = 画好了（那招开始跑了）
类定义 Roster = 画好了（自带一排名单）
roster 的名册 = 张三这一位
张三的账 = 名字「张三」、分数 95
李四的账 = 还没生
标准输出 = 还没印

step 第二声口子：李四也来了
at: 17
say: `roster.add("李四", 88)` —— **同一段口子、同一个类定义**，第二位学员站起来，两格都是它自己的：李四 88 分。回头瞧一眼张三 —— 一点没动，还是 95 分。**同一段代码、两位学员，账各是各的**，这是改造后最值钱的一条。
meow: 同一个方法，创建第二位学员。
pose: yay
类定义 Student = 画好了（那招开始跑了）
类定义 Roster = 画好了（自带一排名单）
roster 的名册 = 张三、李四 两位
张三的账 = 名字「张三」、分数 95
李四的账 = 名字「李四」、分数 88
标准输出 = 还没印

step report_all 一调用，名册从头走到尾
at: 18
say: 报账也不用外面挨个念 —— `roster.report_all()` 这道口子一调用，档案库自己从名册头走到尾（第 13 行那一圈）：轮到谁，谁就报到。
meow: 档案库自己遍历名单。
pose: expect
类定义 Student = 画好了（那招开始跑了）
类定义 Roster = 画好了（自带一排名单）
roster 的名册 = 张三、李四 两位
张三的账 = 名字「张三」、分数 95
李四的账 = 名字「李四」、分数 88
标准输出 = 还没印

step 轮到谁，谁自己报
at: 14
say: 圈里那一句 `s.report()` 是**学员自己**会的一个方法 —— 念的是自己的名字、自己的分。两圈走完，屏幕落下两行。对照第一版：报账的人站在类定义外面，得把整位学员传入函数里，它才念得出来。
meow: 每位学员各报各的，输出两行。
pose: proud
类定义 Student = 画好了（那招开始跑了）
类定义 Roster = 画好了（自带一排名单）
roster 的名册 = 张三、李四 两位
张三的账 = 名字「张三」、分数 95
李四的账 = 名字「李四」、分数 88
标准输出 = 2 行：张三：95 分 / 李四：88 分
```

::: tip 提示
今天记住三句话：

1. **函数站在哪儿**：结构体版的函数站在类定义**外面**（自由函数，得自己拎着账本）；类定义版的函数画在类定义**里面**（口子，谁的数据谁自己动）。
2. **盖子**：结构体版默认全敞着；类定义版的格子默认盖着 —— 在 C++ 里，开口那个词（`struct` / `class`）决定没写标签时头顶**隐形**站着的是哪一块标签。
3. **口子（接口）**：外面只从口子进 —— 于是「改需求」的改动面收窄到类定义和口子里。
:::

::: warn 注意
两个坑，我们标出来：

- **「结构体＋函数容器」不是类定义版**：只把函数搬进大括号、两格照旧敞着，那是换了个地方收着。当场拿判据句量一量：**藏数据、露行为** —— 藏没藏、露没露，两样都得做到。
- **默认权限是一门语言一门规矩**：C 里没有盖子这回事；C++ 里 `class` 默认盖着、`struct` 默认敞开；Java 习惯一格一格写明；Python 的 `_` 是**家规**不是锁。别把一门的规矩当成全世界的规矩，也别把「名字前面划了一道」当成保险箱。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `class Student:` | 画一张「学员」类定义，函数就画在上面（类定义本身不是学员） |
| `self._name = name` | 名字落进「这一位自己」的格子；`_` 开头 = 盖着盖子（家规守的） |
| `def report(self):` | 报账这一个方法画在类定义**里面**，是学员自己会的一个方法 |
| `class Roster:` | 画「档案库」类定义：账本自己管自己那一排名单 |
| `roster.add("张三", 95)` | 走口子记一位新学员 —— 外面不伸手掏格子 |
| `roster.report_all()` | 走口子把账报一遍：轮到谁，谁自己报 |

## 小任务

1. **数一数（动脑）**：从第一版到第二版，我们一共动了哪几处？照着「两格账 → 报账的函数 → 外面调用函数的地方」列一张单子，数出总数。
2. **动手**：把课文里那段类定义版代码抄进练习场，给账上再添一位「王五，91 分」，跑一跑 —— 屏幕上是不是三行了？
3. **再动手**：把 `report` 里印的那句话改一改（比如在名字后面加「（工作区学堂）」），跑一遍。想一想：外面那几声口子（`roster.add`、`roster.report_all`）需要跟着改吗？为什么？

下一课，我们要给「递名称」这门老手艺找个接班人：想改外面的数，老手艺靠的是递进去一张**指针** —— 新来的这位，不写 `*` 也能把同一件活干成。它是谁、长什么样？下一课探险见 
