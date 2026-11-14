---
id: python-stage1-14
lang: python
stage: 1
order: 15
title: 类与对象
tags: [面向对象, 类与对象, 方法]
required: ["python-stage1-13"]
crossRefs: ["common-10", "c-stage2-05", "cpp-stage2-01", "java-stage1-12"]
estMinutes: 25
keywords: [class, __init__, self, def]
compare: ["common-10"]
---

## 学习目标

本课学习类与对象。重点包括定义类与初始化实例、self 与当前实例、实例方法、不同实例的状态、__str__ 与字符串表示。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 定义类与初始化实例

`class` 定义类，调用类通常会创建实例并运行初始化过程。`__init__` 用于初始化已创建实例的属性，并不是返回新对象的构造工厂。通过 `self.name = name` 等赋值保存实例状态。

```python
class Cat:
    def __init__(self, name, fish):
        self.name = name
        self.fish = fish

cat1 = Cat("学生甲", 3)
print(cat1.name)
print(cat1.fish)
```

```text
学生甲
3
```

## self 与当前实例

self 是实例方法第一个参数的惯用名称，方法调用时由绑定过程传入接收该调用的实例。它不是关键字，也不表示所有实例共享同一份状态；实例方法应通过 self 访问当前实例属性。



## 实例方法

在类中定义的函数经实例访问后可以形成绑定方法。调用 `obj.method()` 时，当前实例被传给方法的第一个参数。方法可以读取和修改实例状态，也可以返回结果；返回值与打印输出应区分。

```python
class Cat:
    def __init__(self, name, fish):
        self.name = name
        self.fish = fish

    def meow(self):
        print(f"{self.name}：我们当前记录了 {self.fish} 条数据")

cat1 = Cat("学生甲", 3)
cat2 = Cat("学生乙", 1)
cat1.meow()
cat2.meow()
```

```text
学生甲：我们当前记录了 3 条数据
学生乙：我们当前记录了 1 条数据
```

## 不同实例的状态

两次调用类通常创建两个不同实例。每个实例可以保存不同 name 与数量值，修改其中一个实例的属性不会自动修改另一个实例的独立属性。类属性与实例属性的共享规则将在后续课程区分。

```python
class Cat:
    def __init__(self, name, fish):
        self.name = name
        self.fish = fish

cat1 = Cat("学生甲", 3)
cat2 = Cat("学生乙", 1)
print(cat1.name, cat1.fish)
print(cat2.name, cat2.fish)
cat1.fish = 5
print(cat1.fish, cat2.fish)
```

```text
学生甲 3
学生乙 1
5 1
```

以下是本节的另一段示例或诊断信息。

```demo
title: self 到底指着谁——两个对象各调用一次的全过程
code:
| class Cat:
|     def __init__(self, name, fish):
|         self.name = name
|         self.fish = fish
|     def meow(self):
|         print(f"{self.name}：我们当前记录了 {self.fish} 条数据")
| cat1 = Cat("学生甲", 3)
| cat2 = Cat("学生乙", 1)
| cat1.meow()
| cat2.meow()

step 定义类：元素边一个对象都没有
at: 1
say: `class Cat:` 是**定义类**的口令。类定义上写着一条说明（创建对象时先传入名字和数据数）和一张函数（`meow`）。**类定义上写的字不会自己变成对象** —— 这一刻元素边一个活的都没有。
meow: 类定义好了，对象还没创建。
pose: expect
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 还没生
cat2 的两个变量 = 还没生
标准输出 = 还没印

step cat1 = Cat("学生甲", 3)：生第一个
at: 7
say: 右边 `Cat("学生甲", 3)` 根据类创建出一个实例，生的那一刻**自动跑一遍 `__init__`**。传入的是「学生甲」和 3；`cat1` 是我们给这个新对象起的称呼。
meow: 创建对象，自动执行 __init__。
pose: busy
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 刚创建后，两样都还没装
cat2 的两个变量 = 还没生
标准输出 = 还没印

step self.name = name：self 就是「我们自己」
at: 3
say: `self` 指的是**正在被生的那一个**。这一句读作「把传入的名字，放进我们自己的变量，标签写 `name`」—— 等号右边那个光秃秃的 `name` 才是外面传入的那份。
meow: self 就是正在创建的对象。
pose: busy
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 名字「学生甲」、数据（还没装）
cat2 的两个变量 = 还没生
标准输出 = 还没印

step self.fish = fish：数据数也进它自己的变量
at: 4
say: 同一套动作再来一遍，3 装进 `cat1` 自己的变量。到这儿第一个收拾好了：两样都在**它自己**身上，不在类定义上。
meow: 3 也存进 cat1 自己。
pose: yay
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 名字「学生甲」、数据 3
cat2 的两个变量 = 还没生
标准输出 = 还没印

step 生第二只：类定义还是那一张
at: 8
say: `Cat("学生乙", 1)` 又调用了一回初始化那一个方法 —— **类定义不会用旧**，想创建几个创建几个。回头看一眼 `cat1`：它那两个变量**一点没动**。
meow: 同一个类，创建第二个对象。
pose: expect
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 名字「学生甲」、数据 3
cat2 的两个变量 = 刚创建后，两样都还没装
标准输出 = 还没印

step 同一行又跑一遍：这回 self 是 cat2
at: 3
say: 又是 `self.name = name` 这一行，代码一个字没变 —— 可这回 `self` 指的是 `cat2`，保存的是「学生乙」。**`cat1` 那份纹丝不动**，还是「学生甲」。
meow: 同一行代码，这回 self 是 cat2。
pose: busy
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 名字「学生甲」、数据 3
cat2 的两个变量 = 名字「学生乙」、数据（还没装）
标准输出 = 还没印

step 第二只也装满 —— 第一个没变
at: 4
say: `self.fish = fish` 再跑一遍，1 装进 `cat2`。两个对象各有一套：`cat1` 是「学生甲、3」，`cat2` 是「学生乙、1」，**谁也不碰谁**。
meow: 两个对象各有一份数据。
pose: yay
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 名字「学生甲」、数据 3
cat2 的两个变量 = 名字「学生乙」、数据 1
标准输出 = 还没印

step cat1.meow()：先说哪个对象，再调用函数名
at: 9
say: 这一次让 `cat1` 施展 `meow` —— Python 会把 `cat1` **悄悄塞进第一个位置当 `self`**。回想创建对象那两句：我们只喂了两样，`self` 从来没喂过。
meow: 调用方法，cat1 自动作为 self。
pose: expect
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 名字「学生甲」、数据 3
cat2 的两个变量 = 名字「学生乙」、数据 1
标准输出 = 还没印

step 函数里那一行跑起来：self 指向 cat1
at: 6
say: `f"{self.name}：……"` 里那个 `self.name`，取的是**正在的这一个**的名字。这一趟 `self` 是 `cat1`，读取的是「学生甲」和 3。
meow: 这次 self 是 cat1，取它的数据。
pose: yay
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 名字「学生甲」、数据 3
cat2 的两个变量 = 名字「学生乙」、数据 1
标准输出 = 学生甲：我们当前记录了 3 条数据

step cat2.meow()：同一个方法，换一个做
at: 10
say: `cat2.meow()` 跑的是**类定义上同一张函数**，一个字都没变；`self` 这回指向 `cat2`，所以报出来是「学生乙」和 1 —— **同一个类定义上的一个方法，两个对象各调用各的**。
meow: 同一个方法，这回 self 是 cat2。
pose: proud
类定义 Cat = 画好了（本身不是对象）
cat1 的两个变量 = 名字「学生甲」、数据 3
cat2 的两个变量 = 名字「学生乙」、数据 1
标准输出 = 学生乙：我们当前记录了 1 条数据
```

## __str__ 与字符串表示

`__str__` 应返回字符串，供 str 或 print 等需要可读表示的操作使用。它不能只打印内容而不返回字符串；否则隐式返回 None 会违反协议要求。

```python
class Cat:
    def __init__(self, name, fish):
        self.name = name
        self.fish = fish

    def __str__(self):
        return f"对象 {self.name}，当前记录了 {self.fish} 条数据"

cat1 = Cat("学生甲", 3)
print(cat1)
```

```text
对象 学生甲，当前记录了 3 条数据
```

## 语法与职责对照

类组织属性和方法，实例保存具体状态，self 表示当前实例，__init__ 初始化属性，__str__ 提供可读字符串。每项机制都有明确用途，不应混同为对象创建或输出的同一个操作。



## 练习

定义包含名称与数量的类，创建两个实例并调用方法输出状态。为类实现 __str__，确认它返回字符串，并比较返回值与直接 print 的差别。

```python
class Cat:
    def __init__(self, name, fish):
        self.name = name
        self.fish = fish

    def eat(self, n):
        self.fish = self.fish + n
        print(f"{self.name}又处理了 {n} 条，今天一共 {self.fish} 条")

cat1 = Cat("学生甲", 3)
cat1.eat(2)
cat1.eat(1)
```
