---
id: c-stage3-15
lang: c
stage: 3
order: 16
title: 综合项目：学生成绩管理系统
tags: [综合项目, 工程实践, 数据管理]
required: [c-stage3-14]
crossRefs: []
estMinutes: 35
keywords: [struct, typedef, 链子, fopen, fprintf]
---

## 学习目标

本课学习综合项目：学生成绩管理系统。重点包括链表/数组、文件、排序查找、完整工程。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 第一步：一份档案长什么样

一位学员有**两样**东西要记：名字和分数。我们用一个**档案盒**把它们装在一起：

```c
typedef struct Node {
    char *name;
    int score;
    struct Node *next;
} Node;
```

三行说明白：

- `char *name`：名字是字符串，盒子里放的是**指向它的那张名称**（不是把字符串整个塞进去）；
- `int score`：分数，一个整数；
- `struct Node *next`：**下一节的指针** —— 这就是「链子」的关节处：每一节都记得下一节在哪儿。

`typedef ... Node;` 是给这个档案盒起个短名字，后头就不用老写 `struct Node` 了。

## 第二步：把学员串成一条链子

```c
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    char *name;
    int score;
    struct Node *next;
} Node;

Node *add_last(Node *head, char *name, int score) {
    Node *fresh = malloc(sizeof(Node));
    if (fresh == NULL) {
        return head;
    }
    fresh->name = name;
    fresh->score = score;
    fresh->next = NULL;
    if (head == NULL) {
        return fresh;
    }
    Node *p = head;
    while (p->next != NULL) {
        p = p->next;
    }
    p->next = fresh;
    return head;
}

void print_all(Node *head) {
    for (Node *p = head; p != NULL; p = p->next) {
        printf("%s：%d 分\n", p->name, p->score);
    }
}

int main(void) {
    Node *head = NULL;
    head = add_last(head, "张三", 90);
    head = add_last(head, "陈七", 85);
    head = add_last(head, "阿花", 95);
    print_all(head);
    return 0;
}
```

```text
张三：90 分
陈七：85 分
阿花：95 分
```

三处值得停下来看：

1. **`add_last` 先验货**：`malloc` 租不到变量（`NULL`）就原样把链子还回去，别硬冲（上一课刚学的守卫）。
2. **头一节要单独处理**：链子还空着的时候（`head == NULL`），新租的这节**就是**链子的头 —— 这种情况下把 `head` 交回去，门口那句 `head = add_last(head, ...)` 才能把新头接上。
3. **走链子的标准写法是这一句**：`for (Node *p = head; p != NULL; p = p->next)` —— 从第一节走到「下一步没有」为止。它和走一排元素的跑圈是亲兄弟，区别只在：一排元素靠编号往前走（`i++`），链子靠**每节自己记着下一节在哪儿**（`p = p->next`）。

`add_last` 每加一位都要从头走到尾，性子慢；我们先用着它 —— 它好读，而**加进来的顺序就是链子的顺序**，这一点待会儿印表、排座都要用到。

## 第三步：按名字找一位学员

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct Node {
    char *name;
    int score;
    struct Node *next;
} Node;

Node *add_last(Node *head, char *name, int score) {
    Node *fresh = malloc(sizeof(Node));
    if (fresh == NULL) {
        return head;
    }
    fresh->name = name;
    fresh->score = score;
    fresh->next = NULL;
    if (head == NULL) {
        return fresh;
    }
    Node *p = head;
    while (p->next != NULL) {
        p = p->next;
    }
    p->next = fresh;
    return head;
}

Node *find_by_name(Node *head, char *name) {
    for (Node *p = head; p != NULL; p = p->next) {
        if (strcmp(p->name, name) == 0) {
            return p;
        }
    }
    return NULL;
}

int main(void) {
    Node *head = NULL;
    head = add_last(head, "张三", 90);
    head = add_last(head, "陈七", 85);
    head = add_last(head, "阿花", 95);

    char want[16] = "陈七";
    Node *it = find_by_name(head, want);
    if (it != NULL) {
        printf("找到：%s %d 分\n", it->name, it->score);
    } else {
        printf("名单里没有这位\n");
    }

    it = find_by_name(head, "大黄");
    if (it != NULL) {
        printf("找到：%s %d 分\n", it->name, it->score);
    } else {
        printf("名单里没有这位\n");
    }
    return 0;
}
```

```text
找到：陈七 85 分
名单里没有这位
```

比名字有个**千古大坑**要看清楚：

- 名字是**一串字符串**，比它得用 `strcmp(...) == 0`（这个函数一件一件比内容，全一样才返回 `0` 回来）；
- 千万别写 `p->name == name` —— 那是拿**两张名称**在比（比的是「你指的变量在哪儿」），跟字符串里保存了什么一个字都不相干。我们试过：拿一个**另外装好**的名字去查，回的是「名单里没有这位」；可**直接拿字面量去查**（`find("陈七")`）它**居然找着了** —— 因为编译器瞧见两处一模一样的字面量，就**只留了一份**，两个名称正好指到同一块地方。**「有时候碰巧对」才是最坏的情况**：它让你以为这么写能行，换一处调用就翻车。**比内容只能用 `strcmp`，一次都不能赌。**

还有一处是**找不到时返回什么回去**：这里返回 `NULL`（「没有这一节」），门口就靠 `it != NULL` 分辨 —— 跟上一课 `-1` 当暗号的道理一模一样：**选一个不可能是真结果的记号**。

## 第四步：按分数排排坐

```c
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    char *name;
    int score;
    struct Node *next;
} Node;

Node *add_last(Node *head, char *name, int score) {
    Node *fresh = malloc(sizeof(Node));
    if (fresh == NULL) {
        return head;
    }
    fresh->name = name;
    fresh->score = score;
    fresh->next = NULL;
    if (head == NULL) {
        return fresh;
    }
    Node *p = head;
    while (p->next != NULL) {
        p = p->next;
    }
    p->next = fresh;
    return head;
}

void print_all(Node *head) {
    for (Node *p = head; p != NULL; p = p->next) {
        printf("%s：%d 分\n", p->name, p->score);
    }
}

void sort_by_score(Node *head) {
    for (Node *a = head; a != NULL; a = a->next) {
        for (Node *b = a->next; b != NULL; b = b->next) {
            if (b->score > a->score) {
                int ts = a->score;
                a->score = b->score;
                b->score = ts;
                char *tn = a->name;
                a->name = b->name;
                b->name = tn;
            }
        }
    }
}

int main(void) {
    Node *head = NULL;
    head = add_last(head, "张三", 90);
    head = add_last(head, "陈七", 85);
    head = add_last(head, "阿花", 95);
    sort_by_score(head);
    print_all(head);
    return 0;
}
```

```text
阿花：95 分
张三：90 分
陈七：85 分
```

这就是冒泡那一套（Stage 3 前半学过的），只是这回**装在链子上**：`a` 挑一节，`b` 从它后头一路比过去，谁分高谁往前提。

最要紧的一处是**交换**：档案盒里保存**名字和分数两样**，换的时候**两样得一起换**。只换分数、不动名字会怎样？分数排好了，可名字还是原来的位置 —— 于是「张三 95 分」这种**张冠李戴**就出来了。两样一起换的写法就是上面那四句（先抄进临时的记录表 `ts`、`tn`，再互相覆盖）。

## 第五步：存进档案，下次读回来

```c
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    char *name;
    int score;
    struct Node *next;
} Node;

Node *add_last(Node *head, char *name, int score) {
    Node *fresh = malloc(sizeof(Node));
    if (fresh == NULL) {
        return head;
    }
    fresh->name = name;
    fresh->score = score;
    fresh->next = NULL;
    if (head == NULL) {
        return fresh;
    }
    Node *p = head;
    while (p->next != NULL) {
        p = p->next;
    }
    p->next = fresh;
    return head;
}

void save_to_file(Node *head, const char *path) {
    FILE *fp = fopen(path, "w");
    if (fp == NULL) {
        printf("档案开不了\n");
        return;
    }
    for (Node *p = head; p != NULL; p = p->next) {
        fprintf(fp, "%s %d\n", p->name, p->score);
    }
    fclose(fp);
}

void free_all(Node *head) {
    while (head != NULL) {
        Node *next = head->next;
        free(head);
        head = next;
    }
}

int main(void) {
    Node *head = NULL;
    head = add_last(head, "张三", 90);
    head = add_last(head, "陈七", 85);
    head = add_last(head, "阿花", 95);
    save_to_file(head, "scores.txt");

    FILE *fp = fopen("scores.txt", "r");
    if (fp == NULL) {
        printf("档案丢了\n");
        return 1;
    }
    char name[16];
    int score;
    int n = 0;
    while (fscanf(fp, "%15s %d", name, &score) == 2) {
        n++;
        printf("第 %d 位：%s %d 分\n", n, name, score);
    }
    fclose(fp);
    printf("一共 %d 位\n", n);
    free_all(head);
    return 0;
}
```

```text
第 1 位：张三 90 分
第 2 位：陈七 85 分
第 3 位：阿花 95 分
一共 3 位
```

四件事：

1. **写档案**：`fprintf(fp, "%s %d\n", ...)` —— 一行一位，名字和分数之间一个空格。这个格式是**存和读两边的约定**，谁改谁就得两边都改。
2. **读档案**：`while (fscanf(fp, "%15s %d", name, &score) == 2)` —— 一次读进来「一串字符串 + 一个整数」，读够两样就继续，读不动了（档案到底）就停。
3. **开门就要验货**：`fopen` 返回 `NULL`（档案开不了）也要拦住 —— `fopen` 和 `malloc` 是同一个脾气，都会返回个「干不了」的记号回来。
4. **收摊要收干净**：整条链子是**一节一节现要现租**来的，用完得**一节一节还回去**（`free_all`）。这是调试进阶那一课那个笨办法的正经用法：**谁租的谁还，一节都不落**。

## 拼成完整工程：还差一张菜单

上面四段合起来就是这台成绩册的全部零件，还差一张**菜单**：印一行提示「加一位 / 找一位 / 排座 / 存档案 / 读回来 / 收工」，让主人敲数字挑。菜单那一套（`scanf` 读选择、`while` 转到收工、每个分支调用对应的函数）在 Stage 1 的计算器里已经写过一遍了 —— 把它搬过来，再把上面这几个函数接上去，就是一件**完整工程**。

我们再做三件「工程」上的小事，这一件才算交得出手：

1. **`main` 短一点**：菜单在 `main` 里，别把加、找、排、存的活儿全塞进去 —— 一件活儿一个方法，`main` 只负责「听主人点单、调用对应的函数」；
2. **守卫摆齐**：`malloc`、`fopen` 进门都验货；元素数是 `0`、名字没找到、分数是负数都算边界，先想好印什么；
3. **起名和格式照上一课来**：`head`、`fresh`、`next` 这种名字，三天后的自己还认得出。

::: tip 提示
这件工程验收前，我们会挨着走一遍这五步：

1. **加**：连着加三位，印表看看顺序对不对（`add_last` 是往后接的，不是插在前头）；
2. **找**：找一位在的、再找一位不在的 —— 两边的回话都要像人话；
3. **排**：排完印出来，盯着**名字和分数有没有张冠李戴**（交换时两样一起换）；
4. **存 / 读**：存完**另开一次**程序读回来（别在同一个程序里自说自话地「读完顺带把链子印一遍」—— 那等于没验）；
5. **收摊**：走一遍 `free_all`，一节都不落下。

对了：**别用 `==` 比名字**（那是拿名称比名称），也**别在档案里写死分数** —— 存进去的每一行都得是链子上真实的那位。
:::

## 小任务

1. 把第二段（骨架）敲进去跑一遍，再改成加四位学员 —— 顺序对不对？
2. 给这份成绩册加一个方法 `count_pass(head, 60)`：数一数有几个**及格**（分数大于等于 `60` —— 边界上的数算不算，看仔细这个等号）；
3. 加上菜单（照 Stage 1 的计算器的写法），让它成为一件真能用的成绩册；
4. 最后一步：把整条链子收摊收干净，再跑一遍 `print_all` 看看 —— 收完摊还去碰链子会发生什么？（别在验收的源代码里留这句，想清楚再动手。）
