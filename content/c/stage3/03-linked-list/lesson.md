---
id: c-stage3-03
lang: c
stage: 3
order: 4
title: 链表
tags: [数据结构, 链表]
required: [c-stage3-02]
crossRefs: [c-stage2-04, c-stage2-05, c-stage3-05]
estMinutes: 18
keywords: [链表, typedef, struct, 节点]
---

## 学习目标

本课学习链表。重点包括节点结构与链接、申请与初始化节点、遍历、插入与删除、完整链表程序。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 节点结构与链接

单链表节点保存数据和指向下一个节点的指针。节点类型中的自引用字段使用指针，避免在结构体内部无限嵌套自身。头指针保存首节点地址，空链表通常以空指针表示。

```c
typedef struct Node {
    int x;              /* 环上挂着的数据 */
    struct Node *next;  /* 牵着下一个环的变量 */
} Node;
```

## 申请与初始化节点

malloc 申请节点所需存储，返回值应检查是否为空。申请成功后必须初始化数据和 next 指针；尚未初始化的链接不能用来遍历。节点不再需要时应由明确的所有者负责 free。

```c
Node *new_node(int x) {
    Node *p = (Node *)malloc(sizeof(Node));  /* 现要现租一个环的地方 */
    if (p == NULL) {
        printf("变量没租到\n");
        return NULL;
    }
    p->x = x;        /* 挂上数据 */
    p->next = NULL;  /* 变量先空着 */
    return p;
}
```

## 遍历、插入与删除

遍历从头指针开始，沿 next 前进，遇到空指针结束。插入时先保存原链接，再更新指针，避免丢失剩余链表。删除时先重新连接前后节点，再释放被删除节点；释放后不得继续解引用该节点。

```c
Node *push_front(Node *head, int x) {
    Node *p = new_node(x);
    if (p == NULL) { return head; }
    p->next = head;   /* 新环牵住旧的第一环 */
    return p;         /* 返回新的第一环 */
}
```

以下是本节的另一段示例或诊断信息。

```demo
title: 往最前面挂一个环，别的环一个都没动
code:
| Node *push_front(Node *head, int x) {
|     Node *p = new_node(x);
|     if (p == NULL) { return head; }
|     p->next = head;
|     return p;
| }

step 手上捏着什么
at: 1
say: 现在外面有一条链子 1 → 2 → 3，末尾那个的变量牵着 NULL（表示到头了）。我们手里捏着的是第一环的名称，也就是 1 号环。
meow: 现有链表：1 → 2 → 3。
pose: expect
head = 捏着 1 号环
p = 还没这个新环
链子 = 1 → 2 → 3 → NULL

step 现要现租一个新环
at: 2
say: new_node(0) 里的 malloc 租的是一整只环那么大（sizeof(Node)）：一格装数据，一格装变量。跟前面学过的变量一模一样，只是这回租的是「一个环」。
meow: malloc 分配一个节点。
pose: busy
head = 捏着 1 号环
p = 刚租到一个新环
链子 = 1 → 2 → 3 → NULL

step 新环挂上数据，变量先空着
at: 2
say: 新环的数据是 0，一个执行线程先设成 NULL —— 它暂时是链子的末尾，后面还没有环。
meow: 新节点的 next 先设为 NULL。
pose: busy
head = 捏着 1 号环
p = 新环：挂着 0，变量空着
链子 = 1 → 2 → 3 → NULL

step 先看一眼租到没有
at: 3
say: 名称到手第一件事永远是看 NULL。租不到就该原样把 head 交回去，一个字都不改。这次租到了，跳过。
meow: 检查分配是否成功。
pose: think
head = 捏着 1 号环
p = 新环：挂着 0，变量空着
链子 = 1 → 2 → 3 → NULL

step 新环的变量转个方向
at: 4
say: p->next = head; 把新环那个空变量，牵到原来捏在手里的第一环上——也就是 1 号环。不是把新环接到链子末尾，是接到最前面。
meow: 新节点的 next 指向原头节点。
pose: yay
head = 捏着 1 号环
p = 新环：变量牵着 1 号环
链子 = 1 → 2 → 3 → NULL

step 再看一眼链子：一个都没动
at: 4
say: 到这一步，2 号环、3 号环一个字都没改，1 号环也没改。变的只有刚租来的那个新环身上的一条变量。这就是链子比元素排省事的地方。
meow: 原有节点都没有被修改。
pose: milestone
head = 捏着 1 号环
p = 新环：变量牵着 1 号环
链子 = 1 → 2 → 3 → NULL

step 把新的第一环返回
at: 5
say: return p 把新环交出去，外面写成 head = push_front(head, 0) 就会把它重新捏在手里。到这一刻链子才变成 0 开头 —— 先改变量、后换名称，顺序反了中间就会出现一段没人认领的环。
meow: 返回新节点，它成为新的头。
pose: proud
head = 捏着新环（0 号）
p = 新环：变量牵着 1 号环
链子 = 0 → 1 → 2 → 3 → NULL
```

以下是本节的另一段示例或诊断信息。

```c
Node *push_back(Node *head, int x) {
    Node *p = new_node(x);
    if (p == NULL) { return head; }
    if (head == NULL) { return p; }   /* 空链子：它就是第一环 */
    Node *cur = head;
    while (cur->next != NULL) {       /* 摸到末尾为止 */
        cur = cur->next;
    }
    cur->next = p;
    return head;
}
```

以下是本节的另一段示例或诊断信息。

```c
Node *remove_value(Node *head, int x, int *found) {
    Node *cur = head;
    Node *prev = NULL;
    *found = 0;
    while (cur != NULL) {
        if (cur->x == x) {
            if (prev == NULL) {
                head = cur->next;       /* 摘的是第一环：名称往下挪一格 */
            } else {
                prev->next = cur->next; /* 上一环跨过去牵住下一环 */
            }
            free(cur);                  /* 摘下来的环还给变量 */
            *found = 1;
            return head;
        }
        prev = cur;
        cur = cur->next;
    }
    return head;   /* 摸到尾也没找到：原样返回 */
}
```

以下是本节的另一段示例或诊断信息。

```c
void print_list(Node *head) {
    Node *cur = head;
    while (cur != NULL) {
        printf("%d -> ", cur->x);
        cur = cur->next;
    }
    printf("NULL\n");
}
```

```anim
id: linked-list-insert
```

## 完整链表程序

运行完整程序观察节点创建、遍历和释放的顺序。每次申请成功的节点应在适当时机释放一次，检查空链表和单节点边界。输出数据序列反映链接顺序，不反映节点在内存中的物理排列。

```c
#include <stdio.h>
#include <stdlib.h>

/* 类定义：一个环 = 一条数据 + 一个牵下一环的变量 */
typedef struct Node {
    int x;
    struct Node *next;
} Node;

/* 造一个新环：数据是 x，变量先空着 */
Node *new_node(int x) {
    Node *p = (Node *)malloc(sizeof(Node));
    if (p == NULL) {
        printf("变量没租到\n");
        return NULL;
    }
    p->x = x;
    p->next = NULL;
    return p;
}

/* 挂到最前面，返回新的第一环 */
Node *push_front(Node *head, int x) {
    Node *p = new_node(x);
    if (p == NULL) {
        return head;
    }
    p->next = head;
    return p;
}

/* 挂到最后面，返回第一环（可能没变） */
Node *push_back(Node *head, int x) {
    Node *p = new_node(x);
    if (p == NULL) {
        return head;
    }
    if (head == NULL) {
        return p;
    }
    Node *cur = head;
    while (cur->next != NULL) {
        cur = cur->next;
    }
    cur->next = p;
    return head;
}

/* 摘掉第一个编号为 x 的环；found 里记下摘到没有，返回第一环 */
Node *remove_value(Node *head, int x, int *found) {
    Node *cur = head;
    Node *prev = NULL;
    *found = 0;
    while (cur != NULL) {
        if (cur->x == x) {
            if (prev == NULL) {
                head = cur->next;
            } else {
                prev->next = cur->next;
            }
            free(cur);
            *found = 1;
            return head;
        }
        prev = cur;
        cur = cur->next;
    }
    return head;
}

/* 从头走到尾，一路报数 */
void print_list(Node *head) {
    Node *cur = head;
    while (cur != NULL) {
        printf("%d -> ", cur->x);
        cur = cur->next;
    }
    printf("NULL\n");
}

/* 把整条链子还给变量 */
void free_list(Node *head) {
    Node *cur = head;
    while (cur != NULL) {
        Node *next = cur->next;   /* 先记牢下一环 */
        free(cur);                /* 再放掉这一环 */
        cur = next;
    }
}

int main() {
    Node *head = NULL;
    int found = 0;

    head = push_back(head, 1);
    head = push_back(head, 2);
    head = push_back(head, 3);
    printf("尾部插 1、2、3：");
    print_list(head);

    head = push_front(head, 0);
    printf("头部插 0：");
    print_list(head);

    head = remove_value(head, 0, &found);
    printf("摘 0（%s）：", found ? "摘到了" : "没找到");
    print_list(head);

    head = remove_value(head, 3, &found);
    printf("摘 3（%s）：", found ? "摘到了" : "没找到");
    print_list(head);

    head = remove_value(head, 99, &found);
    printf("摘 99（%s）：", found ? "摘到了" : "没找到");
    print_list(head);

    free_list(head);
    head = NULL;
    return 0;
}
```

以下是本节的另一段示例或诊断信息。

```text
尾部插 1、2、3：1 -> 2 -> 3 -> NULL
头部插 0：0 -> 1 -> 2 -> 3 -> NULL
摘 0（摘到了）：1 -> 2 -> 3 -> NULL
摘 3（摘到了）：1 -> 2 -> NULL
摘 99（没找到）：1 -> 2 -> NULL
```

## 练习

创建三个节点组成链表并遍历输出。分别在头部插入和删除节点，确认头指针与 next 更新正确，最后释放全部节点。
