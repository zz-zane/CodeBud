---
id: python-stage1-03
lang: python
stage: 1
order: 3
title: Python 的变量与数据类型
tags: [变量, 类型]
required: ["python-stage1-02"]
crossRefs: ["common-04","c-stage1-03","cpp-stage1-03","java-stage1-03"]
estMinutes: 20
keywords: [type, int, float, str, bool]
compare: ["common-04"]
---

## 学习目标

本课学习Python 的变量与数据类型。重点包括变量赋值与读取、动态类型与名称重新绑定、常见类型：int、float、str、bool、使用 type 检查类型。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```pretest
title: 变量课前小测
question: 在 Python 里执行 fish = 3 时，等号 = 的含义是什么？
option: 检查两边是否相等
option: 将名称 fish 绑定到整数对象 3
option: 创建一个名为 3 的变量
answer: B
explanation: 在 Python 赋值语句中，等号 = 表示把名称绑定到对象上，相等比较使用的是 ==。
```

## 变量赋值与读取

Python 赋值语句将名称绑定到对象。`fish = 3` 将名称 `fish` 绑定到整数 `3`，`print(fish)` 读取该名称当前关联的值并输出。执行 `fish = fish + 1` 时，先用旧值计算右侧，再更新绑定；`=` 不是相等比较，相等比较使用 `==`。

```python
fish = 3
```

```python
fish = 3
print(fish)
```

```text
3
```

```python
fish = 3
fish = fish + 1
print(fish)
```

```text
4
```

```flash-cards
title: 变量核心闪卡
card:
q: Python 的变量名需要预先声明类型吗？
a: 不需要。类型属于对象本身，变量只是贴在对象上的名称标签。
hint: 动态类型的特性
card:
q: fish = fish + 1 是如何计算的？
a: 先计算等号右边的旧值加 1，再把新结果绑定回 fish 变量名。
hint: 右侧先求值
```

## 动态类型与名称重新绑定

Python 中类型属于对象，不是预先固定在变量名上。先执行 `fish = 3`，再执行 `fish = "示例文本"`，同一名称会从整数对象重新绑定到字符串对象；这并没有把原整数对象变成字符串。C、C++、Java 中声明为 `int` 的变量不能直接赋为字符串，应由各自编译器的类型规则判断，而不是由 Python 解释器处理。

```python
fish = 3
fish = "示例文本"
print(fish)
```

```text
示例文本
```

```demo
title: 同一名称绑定不同类型的值
code:
| fish = 3
| fish = "示例文本"
| print(fish)

step 先看东西，再定类型
at: 1
say: 执行 fish = 3 后，名称 fish 绑定到整数对象 3；对象的类型是 int，而不是变量名预先声明了 int 类型。
meow: fish 绑定到整数 3，类型是 int。
pose: expect
fish 的值 = 3
值的类型 = 整数（int）
标准输出 = 还没印

step 第二行右边：一串带引号的文字
at: 2
say: 读取第二行右侧的字符串字面量，得到 str 对象。此时还没有完成对 fish 的重新赋值。
meow: 右侧得到一个字符串对象。
pose: busy
fish 的值 = 3
值的类型 = 整数（int）
标准输出 = 还没印

step 到这儿为止，变量一点没动
at: 2
say: 在第二次赋值完成前，fish 仍关联整数 3，因此读取它仍得到整数值。
meow: 赋值还没完成，fish 仍是 3。
pose: busy
fish 的值 = 3
值的类型 = 整数（int）
标准输出 = 还没印

step 不查名称、不比对类型，直接装
at: 2
say: 赋值完成后，fish 改为绑定字符串对象。旧整数没有被改造成字符串，改变的是名称与对象的关联。
meow: fish 改为绑定字符串。
pose: busy
fish 的值 = 示例文本
值的类型 = 字符串（str）
标准输出 = 还没印

step print：读取的是变量当前的东西
at: 3
say: print(fish) 读取当前关联的字符串并输出其内容。相同名称在重新赋值前后可以关联不同类型的对象。
meow: 同一个名称，现在输出字符串。
pose: proud
fish 的值 = 示例文本
值的类型 = 字符串（str）
标准输出 = 示例文本
```

## 常见类型：int、float、str、bool

`int` 表示整数，`float` 表示浮点数，`str` 表示字符串，`bool` 表示真或假。`3` 与 `3.0` 的类型不同；`"3"` 是字符串。引号是代码语法的一部分，输出字符串内容时不会自动输出这些界定引号。

```python
count = 3
price = 2.5
```

```python
catName = "计算机"
```

```python
isFish = True
```

## 使用 type 检查类型

`type(value)` 返回该值的类型对象。可以分别检查整数、浮点数、字符串和布尔值；比较变量重新绑定前后的结果，确认是关联对象的类型发生了变化。

```python
print(type(3))
print(type(2.5))
print(type("计算机"))
print(type(True))
```

```text
<class 'int'>
<class 'float'>
<class 'str'>
<class 'bool'>
```

```python
fish = 3
print(type(fish))
fish = "示例文本"
print(type(fish))
```

```text
<class 'int'>
<class 'str'>
```

## 练习

为数量、单价、说明文字和状态分别定义变量并输出。尝试先让一个名称绑定整数，再绑定字符串，并使用 `type()` 检查两次结果。

```python
fish = 3
print(type(fish))
fish = "示例文本"
print(type(fish))
fish = True
print(type(fish))
```
