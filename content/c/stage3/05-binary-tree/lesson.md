---
id: c-stage3-05
lang: c
stage: 3
order: 6
title: 二叉树
tags: [数据结构, 树]
required: [c-stage3-04]
crossRefs: []
estMinutes: 22
keywords: [node, left, right, inorder, insert]
---

## 学习目标

本课学习二叉树。重点包括二叉树节点、递归创建与访问节点、二叉搜索树插入、前序、中序与后序遍历、完整程序与内存释放。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 二叉树节点

二叉树的每个节点最多有两个子节点。示例 Node 结构体保存 value，以及指向左右子节点的 left、right 指针；空指针表示相应子树不存在。节点、指针和整数值是不同概念。

```c
typedef struct Node {
    int value;
    struct Node *left;    /* 左边的叉 */
    struct Node *right;   /* 右边的叉 */
} Node;
```

下面是另一段示例或诊断对照。

```c
Node *new_node(int value) {
    Node *p = (Node *)malloc(sizeof(Node));
    if (p == NULL) {
        return NULL;
    }
    p->value = value;
    p->left = NULL;
    p->right = NULL;
    return p;
}
```

## 递归创建与访问节点

递归函数把当前节点及其左右子树分别处理。访问字段前先判断节点指针是否为空；否则解引用空指针会产生未定义行为。申请节点后应初始化字段，并在不再使用时释放。



## 二叉搜索树插入

二叉搜索树按比较规则选择左子树或右子树。插入函数返回更新后的子树根指针，因此调用方必须保存返回值。重复值的处理由示例的比较分支决定，不能假定每个二叉树都自动有序。

```c
Node *insert(Node *root, int value) {
    if (root == NULL) {
        return new_node(value);   /* 摸到空位：就挂在这儿 */
    }
    if (value < root->value) {
        root->left = insert(root->left, value);     /* 小的交给左边 */
    } else if (value > root->value) {
        root->right = insert(root->right, value);   /* 大的交给右边 */
    }
    return root;   /* 一样大就不重复挂，原样返回 */
}
```

## 前序、中序与后序遍历

前序按当前节点、左子树、右子树处理；中序按左子树、当前节点、右子树处理；后序按左子树、右子树、当前节点处理。递归调用会为尚未完成的调用保存执行状态，返回后继续执行后续语句。

```c
/* 前序：先自己，再左边，最后右边 */
void preorder(Node *root) {
    if (root == NULL) {
        return;
    }
    printf("%d ", root->value);
    preorder(root->left);
    preorder(root->right);
}

/* 中序：先左边，再自己，最后右边 */
void inorder(Node *root) {
    if (root == NULL) {
        return;
    }
    inorder(root->left);
    printf("%d ", root->value);
    inorder(root->right);
}

/* 后序：左边、右边都走完，最后才是自己 */
void postorder(Node *root) {
    if (root == NULL) {
        return;
    }
    postorder(root->left);
    postorder(root->right);
    printf("%d ", root->value);
}
```

下面是另一段示例或诊断对照。

```demo
title: 中序遍历：为什么报出来正好是从小到大
code:
| void inorder(Node *root) {
|     if (root == NULL) { return; }
|     inorder(root->left);
|     printf("%d ", root->value);
|     inorder(root->right);
| }

step 先看清楚这架二叉树长什么样
at: 1
say: 连接去的顺序是 5、3、8、1、4，按「小的往左、大的往右」长出来：5 在顶；3 是 5 的左子树，8 是 5 的右子树；1 是 3 的左子树，4 是 3 的右子树。
meow: 树的根节点是 5。
pose: expect
这一层的 root = 5（最顶上那层）
走到哪了 = 还没出发
停在哪儿的层 = (暂时空的)
印出来 = (还没印)

step 第 1 步
at: 2
say: 每一层的第一句都是这一句。5 号不是空指针，所以不返回，接着往下走。没有这一句，摸到空指针会当场发生无效指针访问（见下面的警告）。
meow: 节点不是空指针，继续。
pose: think
这一层的 root = 5
走到哪了 = 第 1 层，刚问完空不空
停在哪儿的层 = (暂时空的)
印出来 = (还没印)

step 第 1 步
at: 3
say: 中序的第一件事是走左子树，所以 5 号停在第 3 行等着，控制权交给 3 号。记住这一刻：5 号报了名又没输出节点值，它尚未输出一句「5」。
meow: 先遍历左子树，5 号等待。
pose: busy
这一层的 root = 3（5 号的左子树）
走到哪了 = 进入第 2 层
停在哪儿的层 = ①5 号（欠一句「5」）
印出来 = (还没印)

step 第 2 步
at: 3
say: 3 号照同一套办：先问空不空（不是），再走左子树 —— 也就是 1 号。现在半路上摞着两位了。
meow: 3 号也先走左子树。
pose: busy
这一层的 root = 1（3 号的左子树）
走到哪了 = 进入第 3 层
停在哪儿的层 = ①5 号 ②3 号（都尚未输出自己那一句）
印出来 = (还没印)

step 第 3 步
at: 4
say: 1 号的左边没有叉（空名称）。inorder(NULL) 进去第一句就返回，所以左边这趟等于什么都没干。左边走完，轮到报自己：印「1」。这是屏幕上第一个数。
meow: 1 号没有左子树，输出 1。
pose: yay
这一层的 root = 1
走到哪了 = 第 3 层，报出了自己
停在哪儿的层 = ①5 号 ②3 号
印出来 = 1

step 第 3 步
at: 5
say: 1 号的右边同样是空指针，也是一进去就返回。两叉都走完，1 号这一个方法结束、消失，控制权交回停在第 3 行的 3 号。
meow: 1 号右子树为空，返回 3 号。
pose: milestone
这一层的 root = 3（回到第 2 层）
走到哪了 = 1 号整层走完
停在哪儿的层 = ①5 号（只剩它了）
印出来 = 1

step 第 2 步
at: 4
say: 3 号接着往下跑。它的左边（整棵 1 号）已经全部报完，所以现在轮到报自己：印「3」。
meow: 输出 3。
pose: yay
这一层的 root = 3
走到哪了 = 第 2 层，报出了自己
停在哪儿的层 = ①5 号
印出来 = 1、3

step 第 2 步
at: 5
say: 报完自己才走右子树，这就是「自己夹在两个叉中间」。右边是 4 号。
meow: 接着走 3 号的右子树。
pose: busy
这一层的 root = 4（3 号的右子树）
走到哪了 = 进入 4 号
停在哪儿的层 = ①5 号 ②3 号
印出来 = 1、3

step 第 3 步
at: 4
say: 4 号的两个叉都是空的：一进去就走左边、返回，接着报自己（印「4」），再走右边、返回。4 号这一层结束，控制权交回 3 号 —— 3 号两叉都走完，也跟着结束，交回 5 号。
meow: 输出 4，返回根节点。
pose: milestone
这一层的 root = 5（一路回到最顶上）
走到哪了 = 3 号整棵子树走完了
停在哪儿的层 = (空的 —— 5 号重新开工了)
印出来 = 1、3、4

step 第 1 步
at: 4
say: 5 号等了一路，现在左边整棵都报完了，才轮到它自己：印「5」。顶上那层永远排在中间 —— 这就是中序。
meow: 左子树完成，输出 5。
pose: yay
这一层的 root = 5
走到哪了 = 第 1 层，报出了自己
停在哪儿的层 = (空的)
印出来 = 1、3、4、5

step 第 1 步
at: 5
say: 5 号最后走右子树，也就是 8 号。8 号左右都是空指针，一进去就报自己：印「8」。整棵二叉树走完。
meow: 走右子树，输出 8。
pose: busy
这一层的 root = 8
走到哪了 = 最后一层
停在哪儿的层 = (空的)
印出来 = 1、3、4、5、8

step 走完了：正好从小到大
at: 1
say: 报出来是 1 3 4 5 8 —— 正好排好了。这不是巧合：中序把「自己」夹在左右之间，而规矩又是小的在左、大的在右，于是小的先报、自己居中、大的最后，天生有序。
meow: 中序遍历结果有序：1 3 4 5 8。
pose: proud
这一层的 root = (整棵走完)
走到哪了 = 三个方法共用同一套走法，只差 printf 的位置
停在哪儿的层 = (空的)
印出来 = 1、3、4、5、8
```

## 完整程序与内存释放

运行完整程序对照三种遍历结果。二叉搜索树的中序遍历按其比较规则给出有序序列；一般二叉树不保证这一性质。释放节点时先释放子树，再释放当前节点，避免访问已经释放的对象。

```c
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int value;
    struct Node *left;
    struct Node *right;
} Node;

Node *new_node(int value) {
    Node *p = (Node *)malloc(sizeof(Node));
    if (p == NULL) {
        return NULL;
    }
    p->value = value;
    p->left = NULL;
    p->right = NULL;
    return p;
}

/* 小的往左、大的往右，一路摸到空位就连接去 */
Node *insert(Node *root, int value) {
    if (root == NULL) {
        return new_node(value);
    }
    if (value < root->value) {
        root->left = insert(root->left, value);
    } else if (value > root->value) {
        root->right = insert(root->right, value);
    }
    return root;
}

/* 前序：先自己，再左边，最后右边 */
void preorder(Node *root) {
    if (root == NULL) {
        return;
    }
    printf("%d ", root->value);
    preorder(root->left);
    preorder(root->right);
}

/* 中序：先左边，再自己，最后右边 */
void inorder(Node *root) {
    if (root == NULL) {
        return;
    }
    inorder(root->left);
    printf("%d ", root->value);
    inorder(root->right);
}

/* 后序：左边、右边都走完，最后才是自己 */
void postorder(Node *root) {
    if (root == NULL) {
        return;
    }
    postorder(root->left);
    postorder(root->right);
    printf("%d ", root->value);
}

/* 把整架二叉树还给变量：两个叉也照同样的办法还 */
void free_tree(Node *root) {
    if (root == NULL) {
        return;
    }
    free_tree(root->left);
    free_tree(root->right);
    free(root);
}

int main(void) {
    Node *root = NULL;
    int values[5] = {5, 3, 8, 1, 4};
    for (int i = 0; i < 5; i++) {
        root = insert(root, values[i]);
    }

    printf("前序：");
    preorder(root);
    printf("\n中序：");
    inorder(root);
    printf("\n后序：");
    postorder(root);
    printf("\n");

    free_tree(root);
    root = NULL;
    return 0;
}
```

```text
前序：5 3 1 4 8
中序：1 3 4 5 8
后序：1 4 3 8 5
```

## 练习

插入给定整数建立二叉搜索树，分别输出三种遍历序列。画出每个节点的 left 与 right 指向，最后释放全部节点。
