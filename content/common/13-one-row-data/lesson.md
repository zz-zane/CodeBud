---
id: common-13
lang: common
stage: 0
order: 7
title: 一维数据：数组与列表
tags: [数组, 列表, 一维数据]
required: [common-06]
crossRefs: [common-04, common-06, java-stage1-08]
estMinutes: 12
keywords: [数组, 列表, 下标, 遍历]
---

## 学习目标

本课学习一维数据：数组与列表。重点包括为什么需要一排数据、数组：数组、列表：列表、下标从 0 开始、遍历一整排。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```python
cat1 = 3
cat2 = 1
cat3 = 4
print(cat1 + cat2 + cat3)
```

## 数组

于是我们把十个元素在架子上排成一排，从最左边开始**贴上编号**。这一整排，就叫**数组**。想拿哪一元素，报编号就行：

```python
fish = [3, 1, 4, 1, 5]
print(fish[0])
print(fish[4])
```

输出：

```text
3
5
```

`fish` 是**这一整排**的名字——只要一个名字就够啦；方括号里的数字，就是元素上的编号。`fish[0]` 是左边第一元素，`fish[4]` 是第五元素。

## 列表

有的语言里，这一排元素的个数得先说死：「我们要留五个元素」，之后多一个都塞不进去。而 Python 的这排更省心，它是一台**列表**——想塞就塞，柜子自己会变大：

```python
fish = [3, 1]
fish.append(4)
print(len(fish))
```

输出 `3`。`append` 是「再塞一格」的函数，`len(fish)` 是「数一数柜子里现在有几格」的函数。

## 下标从 0 开始：新手必踩的坑

**编号是从 0 开始的，不是从 1 开始。** 这是我们见过最多人摔跟头的地方：

- 第一元素 → `fish[0]`
- 第二元素 → `fish[1]`
- 第五元素 → `fish[4]`

所以「最后一元素」不是 `fish[5]`（那已经掉出架子外啦，编译器或解释器会气鼓鼓地拦住你），而是 `fish[len(fish) - 1]`。

编号还能用来找元素放东西：

```python
fish = [3, 1, 4]
fish[1] = 99
print(fish)
```

输出 `[3, 99, 4]`——第二元素本来躺着 1 条，现在被我们换成了 99 条。

## 怎么遍历一整排

要是我们想**把每一元素都看一遍**呢？前面学过的**循环**正好派上用场：让代码绕着这一排跑，每跑一圈取一元素：

```python
fish = [3, 1, 4, 1, 5]
total = 0
for n in fish:
    total = total + n
print(total)
```

输出 `14`。`for n in fish` 读作「把这一排里的每一元素，挨个儿交给 `n`」：第一圈 `n` 是 3，第二圈是 1……跑满五圈，`total` 就把五元素全加起来了。

下面这段把五圈**一圈不落**地走一遍。盯着「这一刻的值」那一栏看：`n` 每换一次，就是又有一个元素被返回了过来。

```demo
title: for n in fish 是怎么一元素元素走过去的
code:
| fish = [3, 1, 4, 1, 5]
| total = 0
| for n in fish:
|     total = total + n
| print(total)

step 先摆好这排元素
at: 1
say: 五个元素排成一排，编号从 0 到 4。元素里躺着 3、1、4、1、5。
meow: 五个元素排好了。
pose: expect
fish = [3, 1, 4, 1, 5]
total = 还没洗
n = 还没轮到

step 洗一个小元素装总数
at: 2
say: total 这个小元素先洗成 0。等下每走过一个元素，就往它里面倒一点。
meow: total 清零，从 0 开始累加。
pose: busy
fish = [3, 1, 4, 1, 5]
total = 0
n = 还没轮到

step 第 1 步
at: 3
say: for 从排头开始，把第 0 元素里的 3 交给 n —— 这一圈 n 就是 3。
meow: 取到第一个元素：3。
pose: yay
fish = [3, 1, 4, 1, 5]
total = 0
n = 3

step 第 1 步
at: 4
say: total + n 就是 0 + 3，把结果放回 total。现在小元素里有 3 条了。
meow: total 现在是 3。
pose: busy
fish = [3, 1, 4, 1, 5]
total = 3
n = 3

step 第 2 步
at: 3
say: 绕回 for，下一个元素是编号 1，里面躺着 1 条。n 换成 1。
meow: 下一个元素：1。
pose: yay
fish = [3, 1, 4, 1, 5]
total = 3
n = 1

step 第 2 步
at: 4
say: 3 + 1 = 4，放回 total。小元素里现在 4 条。
meow: total 现在是 4。
pose: busy
fish = [3, 1, 4, 1, 5]
total = 4
n = 1

step 第 3 步
at: 3
say: 编号 2 的元素里是 4 条，n 换成 4。
meow: 这个元素最大：4。
pose: yay
fish = [3, 1, 4, 1, 5]
total = 4
n = 4

step 第 3 步
at: 4
say: 4 + 4 = 8，放回 total。
meow: total 现在是 8。
pose: busy
fish = [3, 1, 4, 1, 5]
total = 8
n = 4

step 第 4 步
at: 3
say: 编号 3 的元素里又是 1 条 —— 这排元素里 1 出现了两次，别数岔了。
meow: 又是一个 1。
pose: think
fish = [3, 1, 4, 1, 5]
total = 8
n = 1

step 第 4 步
at: 4
say: 8 + 1 = 9，放回 total。
meow: total 现在是 9，还剩最后一个。
pose: busy
fish = [3, 1, 4, 1, 5]
total = 9
n = 1

step 第 5 步
at: 3
say: 编号 4 是排尾，里面 5 条。n 换成 5 —— 这是最后一圈了。
meow: 最后一个元素：5。
pose: yay
fish = [3, 1, 4, 1, 5]
total = 9
n = 5

step 第 5 步
at: 4
say: 9 + 5 = 14。五个元素全走完了，for 再绕回来时排尾后面已经没有元素，循环收工。
meow: total 是 14，全部加完。
pose: busy
fish = [3, 1, 4, 1, 5]
total = 14
n = 5

step 把总数输出
at: 5
say: print(total) 输出小元素里的数：14。这就是五个元素加起来的总数。
meow: 结果是 14。
pose: proud
fish = [3, 1, 4, 1, 5]
total = 14
n = 5
输出 = 14
```

要是你还想**知道现在是第几元素**，就让编号陪着一起跑：

```python
fish = [3, 1, 4]
for i in range(len(fish)):
    print(f"第 {i} 元素：{fish[i]} 条")
```

输出：

```text
第 0 元素：3 条
第 1 元素：1 条
第 2 元素：4 条
```

注意它从「第 0 元素」开始报——不是我们数错了，是编号本来就从 0 起。

## 四种语言怎么取出一整排

同一个任务：把一整排数**逐个取出来**。四种语言的写法长这样，看个眼熟就行：

```compare
c::
#include <stdio.h>

int main() {
    int fish[5] = {3, 1, 4, 1, 5};
    for (int i = 0; i < 5; i++) {
        printf("%d\n", fish[i]);
    }
    return 0;
}

cpp::
#include <iostream>

int main() {
    int fish[5] = {3, 1, 4, 1, 5};
    for (int i = 0; i < 5; i++) {
        std::cout << fish[i] << std::endl;
    }
    return 0;
}

java::
public class Main {
    public static void main(String[] args) {
        int[] fish = {3, 1, 4, 1, 5};
        for (int n : fish) {
            System.out.println(n);
        }
    }
}

python::
fish = [3, 1, 4, 1, 5]
for n in fish:
    print(n)
```

四段都会把 `3 1 4 1 5` 竖着念一遍。C 和 Java 的元素得先说好摆几个，Python 的储物柜想长就长；可「报编号取一元素」和「绕圈挨个取」的心思，四个语言一模一样。

::: tip 提示
记三件事：**一整排东西只用一个名字**；**编号从 0 起，最后一元素的编号是 `len(...) - 1`**；**想把整排取一遍，就用循环**。
:::

::: warn 注意
写 `fish[5]` 这种「要第六元素」的写法，编译器或解释器会当场翻脸报 `IndexError: list index out of range`——不是元素里的数不对，是架子上**根本没有这一元素**。落笔写编号前先用字段字段数一遍：最后一元素的编号永远是「总数 − 1」。
:::

## 小任务

把最后那段代码里的 `fish` 换成你自己的五个数，再改一改，让它只打印**偶数编号**的元素（提示：`if i % 2 == 0:`）。这一排的编号规矩，往后学哪门语言都用得上 
