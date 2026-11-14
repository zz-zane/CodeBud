---
id: python-stage2-07
lang: python
stage: 2
order: 7
title: 面向对象深入
tags: [面向对象, 继承]
required: ["python-stage2-06"]
crossRefs: []
estMinutes: 25
keywords: [class, super, isinstance, override]
compare: ["common-10"]
---

## 学习目标

本课学习面向对象深入。重点包括继承、方法重写、多态、super。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 继承：一句话认亲

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        print(f"{self.name}发出了一次叫")

class Cat(Animal):
    pass

a = Animal("计算机")
c = Cat("学生甲")
a.speak()
c.speak()
print(isinstance(c, Animal))
print(isinstance(a, Cat))
```

```text
计算机发出了一次叫
学生甲发出了一次叫
True
False
```

逐行看：

- **`class Animal:`** —— 先画一张父类，写的是**所有动物都有的那部分**：有名字（`__init__`），提供输出方法（`speak`）。
- **`class Cat(Animal):`** —— **最要紧的一行**！类定义名后面**多了一对小括号，里面填着另一个类定义的名字**，读作「**照 `Animal` 那张类定义，再画一张 `Cat` 类定义**」。这一句话，术语表里给它的原名是**继承**。
- **`pass`** —— 「**这里先空着**」。Python 不许类定义里面一个字都不写，所以子类一时没东西可加的时候，就摆一个 `pass` 占位。
- **`c = Cat("学生甲")`** —— 子类上**根本没写 `__init__`**，可名字照样喂得进去！因为父类上有，**子类天生就会**。这就是套类定义最大的好处：父类上的说明和函数，子类**不用再写一遍**。
- **`c.speak()`** —— 印出「学生甲发出了一次叫」，用的也是父类那一个方法。
- **`print(isinstance(c, Animal))`** —— `isinstance(一个对象, 一个类定义)` 读作「**这个对象是不是照这张类定义（或它的下游类定义）创建后的**」。`c` 是照 `Cat` 生的，而 `Cat` 是套在 `Animal` 上画的，所以它**也是**一个 `Animal`，返回 `True`。
- **`print(isinstance(a, Cat))`** —— 反过来就不成立了：`a` 是照着最上面那张父类直接生的，它**不是** `Cat`，所以是 `False`。套类定义是**从上往下认亲，不往上看**。

## 子类能把父类那一个方法盖掉

套来的函数有时不合心意。学生甲叫起来可不是「发出了一次叫」，是我们最熟悉的「喵！」。那就**在子类上把这一个方法再写一遍**：

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        print(f"{self.name}发出了一次叫")

class Cat(Animal):
    def speak(self):
        print(f"{self.name}：喵！")

c = Cat("学生甲")
c.speak()
```

```text
学生甲：喵！
```

- 子类上**又写了一遍 `def speak(self):`**，名字一模一样、传入的东西也一模一样。
- 这么一写，**子类这一版就把父类那一版盖住了**：凡是从 `Cat` 创建后的对象，调用 `speak` 走的是子类这一版，父类那版安安静静躺在那儿，不再出声。
- 这个动作，我们叫它**重写（重写）**：同一个函数名，子类上重新画一遍，换成我们想要的样子。
- 注意父类**一点都没被改动**。照 `Animal` 直接创建后的动物，调用 `speak` 还是那一次「发出了一次叫」—— **盖住只盖住这一条下游的路**。

## `super()`：先请父类把活干一遍

现在学生甲有自己的数据数了。我们想给它单独加一段 `__init__`：

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        print(f"{self.name}发出了一次叫")

class Cat(Animal):
    def __init__(self, name, fish):
        super().__init__(name)
        self.fish = fish

    def speak(self):
        print(f"{self.name}：我们有 {self.fish} 条数据")

c = Cat("学生甲", 3)
c.speak()
```

```text
学生甲：我们有 3 条数据
```

- **子类自己写了 `__init__`，父类那一版就被盖住了**。所以「把名字放进变量」这一步，**不会自动发生**了 —— 得我们自己请回来干。
- **`super().__init__(name)`** 读作「**先请上一层类定义，把它那版 `__init__` 跑一遍**」。`super()` 就是「上一层」的意思。
- `super()` 后面**不用喂 `self`**：我们正站在哪张子类上，Python 自己清楚，它会替我们把 `self` 递过去。
- 顺序很讲究：**先 `super().__init__(name)` 把名字放好，再 `self.fish = fish` 放自己的那一份**。要是漏了 `super()` 这一句，`self.name` 这个变量**压根没被建起来**，等下 `speak` 里一调用 `self.name` 就翻脸。

「先请上一层跑一遍、再跑自己那一句」这个顺序，我们拆成一步一步走给你看：

```demo
title: 创建一个对象的时候，两层类定义谁先跑
code:
| class Animal:
|     def __init__(self, name):
|         self.name = name
|     def speak(self):
|         print(f"{self.name}发出了一次叫")
| class Cat(Animal):
|     def __init__(self, name, fish):
|         super().__init__(name)
|         self.fish = fish
|     def speak(self):
|         print(f"{self.name}：我们有 {self.fish} 条数据")
| c = Cat("学生甲", 3)
| c.speak()

step 最上面那张父类先立好
at: 1
say: `class Animal:` 是**先立父类**：上面写着凡是动物都有名字（`__init__`）、都提供输出方法（`speak`）。**类定义上写的字不会自己变出动物** —— 这一刻一个对象都还没有。
meow: 定义父类 Animal。
pose: expect
c 这个对象 = 还没生
名字变量 = 还没建
数据变量 = 还没建

step 子类照着父类画
at: 6
say: `class Cat(Animal):` 是最要紧的一行：类定义名后面括号里填着 `Animal`，读作「**照 Animal 那张，再画一张 Cat**」。父类上的说明和函数子类天生就会 —— 可它也**自己写了一版** `__init__`（下一行）。
meow: Cat 继承 Animal。
pose: expect
c 这个对象 = 还没生
名字变量 = 还没建
数据变量 = 还没建

step 照子类创建一个：引用的是子类那一版
at: 12
say: `Cat("学生甲", 3)` 照子类创建一个实例。生的时候 Python 会调用一个方法 `__init__` —— 引用的是**子类自己这一版**（第 7 行），因为子类写了，父类那一版就被**盖住**了。
meow: 创建 Cat 对象，调用 __init__。
pose: busy
c 这个对象 = 刚创建后，变量还空着
名字变量 = 还没建
数据变量 = 还没建

step 传入的两样先接在手上
at: 7
say: 高亮这就**跳进了子类那一个方法**：传入的「学生甲」和 3 分别接在两个名字上 —— `name` 是「学生甲」、`fish` 是 3。**可它们此刻只是拿在手上**，还没进这个对象的变量。
meow: name 和 fish 接收传入的值。
pose: busy
c 这个对象 = 刚创建后，变量还空着
名字变量 = 「学生甲」拿在手上（还没进变量）
数据变量 = 还没建

step 撞上 super()：先请上一层跑
at: 8
say: 第一句就是 `super().__init__(name)`：`super()` 是「**上一层类定义**」的意思，这一句读作「先请父类把它那版 `__init__` 跑一遍」。括号里**不用喂 `self`** —— 我们站在哪张子类上，Python 自己清楚。
meow: 调用父类的初始化方法。
pose: expect
c 这个对象 = 刚创建后，变量还空着
名字变量 = 「学生甲」拿在手上（父类马上来建）
数据变量 = 还没建

step 跳回父类：名字这就进变量
at: 3
say: 高亮**跳回父类**那一行 —— 「学生甲」装进了这个对象的名字变量。**这一趟是子类请回来的**：子类自己写了 `__init__`，父类那版不会自动跑，全靠刚才那句 `super()`。
meow: 名字存进这个对象。
pose: busy
c 这个对象 = 名字装好了
名字变量 = 「学生甲」
数据变量 = 还没建

step 回子类，跑自己那一句
at: 9
say: 父类那版跑完，**回到子类接着往下**：`self.fish = fish` 把 3 装进子类自己加的那个变量。**两层谁先谁后就写在这两句的先后上**：请回来的那层先跑，自己这句后跑。
meow: fish 存进这个对象。
pose: yay
c 这个对象 = 两层都装好了
名字变量 = 「学生甲」
数据变量 = 3

step 调用 speak：两个变量都齐了
at: 13
say: `c.speak()` 走的是**子类这一版** `speak`（父类那一版被盖住了，安安静静躺着）。它要念 `self.name` 和 `self.fish` —— 两层的变量**都装好了**，所以这句能完整输出声。
meow: 调用子类重写的 speak。
pose: proud
c 这个对象 = 两层都装好了，出声了
名字变量 = 「学生甲」
数据变量 = 3
```

**顺序就这四拍**：照子类创建一个 → 子类那一版 `__init__` 先跑 → 撞上 `super()` 请父类跑一趟（名字这才进变量）→ 再回来跑自己那一句。**父类那部分先装好、子类自己那份后装**；整段里少得了别的，少不得 `super()` 那一句。

## 多态调用

```python
class Animal:
    def speak(self):
        print("……")

class Cat(Animal):
    def speak(self):
        print("")

class Dog(Animal):
    def speak(self):
        print("汪！")

pets = [Cat(), Dog(), Cat()]
for pet in pets:
    pet.speak()
```

```text

汪！

```

看这三行输出：我们从头到尾**只写了一句 `pet.speak()`**，写的时候压根不知道 `pet` 会是谁 —— 是对象就、是狗就汪，**同一句话，各对象各样**。

术语表里给这件事的原名是**多态（多态调用）**。它的道理其实很简单：

- `pet` 这个名字底下，**保存的是一个实例**（照哪张类定义生的，它自己知道）。
- 调用 `pet.speak()` 的时候，Python 是**照着那个实例自己的类定义**去找这一个方法的 —— 不是照着 `Animal` 父类找，也不是照着我们写代码时脑子里想的那张找。
- 所以我们只管写「调用 `speak`」，**具体还是汪，交给那个会自己决定**。

这份省心，正是套类定义最值钱的地方：**我们加的宠物越多，`for` 那一行越不用改**。以后你再添一个鸭子，只要它照着 `Animal` 画、自己盖一版 `speak`，上面这三行一行都不用动。

::: tip 提示
- **`class Cat(Animal):`** —— 括号里填父类名，就是「照它画」；父类上的说明和函数，子类天生就会，不用重抄。
- **`pass`** —— 子类一时没东西可加，摆一个占位，不然 Python 不许。
- **重写** —— 子类上把同一个方法再写一遍，就把父类那版盖住了，父类本身不受影响。
- **`super().__init__(name)`** —— 子类自己写了 `__init__` 时，用这一句请父类把它那版先跑一遍；别忘了喂东西进去。
- **`isinstance(这个, 类定义名)`** —— 认亲用：从上往下认，不往上看。
- **各对象各样** —— 同一句 `pet.speak()`，是对象就、是狗就汪，写的人不用管它是谁。
:::

::: warn 注意
三个最容易踩的坑：

- **套了类定义，不等于父类的活会自动干。** 子类只要**自己写了** `__init__`，父类那一版就被盖住了 —— 名字不会自己进变量。这时候必须自己补一句 `super().__init__(name)`。
- **`super()` 后面别加 `self`。** 写成 `super(self).__init__(name)` 解释器会当场翻脸。
- **盖住的只是这一条路。** 子类把函数改了，父类和它的其他下游**一点都不受影响** —— 这正是我们想要的分寸，别误以为改了小的就等于改了大的。
:::

## 一句话对照表

| 写下的这一句 | 它干了什么 |
|---|---|
| `class Cat(Animal):` | 照着 `Animal` 那张父类，再画一张 `Cat` 子类 |
| `pass` | 子类里先空着，占个位 |
| `def speak(self):`（写在子类里） | **盖掉、换自己那版**：把父类那一版盖住，换成自己的画法 |
| `super().__init__(name)` | 先请上一层类定义，把它那版 `__init__` 跑一遍 |
| `super()` | 「上一层类定义」，不用喂 `self` |
| `isinstance(c, Animal)` | 认亲：`c` 是不是照这张类定义（或它的下游）创建后的 |
| `pet.speak()` | 是对象就、是狗就汪，写的人不用管它是谁 |

## 小任务

我们把计算机也请进宠物队伍里了 —— 它照着同一张父类画，但自己加了一段 `__init__`，还把 `speak` 盖成了自己那版：

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        print(f"{self.name}发出了一次叫")

class Cat(Animal):
    def speak(self):
        print(f"{self.name}：喵！")

class Fish(Animal):
    def __init__(self, name, fat):
        super().__init__(name)
        self.fat = fat

    def speak(self):
        print(f"{self.name}：，本鱼有 {self.fat} 斤")

pets = [Cat("学生甲"), Fish("计算机", 9)]
for pet in pets:
    pet.speak()
```

```text
学生甲：喵！
计算机：，本鱼有 9 斤
```

**试着改一改**：

1. 再画一张 `Dog` 子类，也盖一版 `speak` 印出「汪！」；然后往 `pets` 那一排里加一个 `Dog("大黄")` —— 看看底下那个 `for` 要不要动（答案是：一个字都不用改）。
2. 在 `Cat` 子类里加一个方法 `def sleep(self):`，然后写一句 `Cat("学生甲").sleep()` 试试。再想想看：`Fish("计算机", 9).sleep()` 能不能调用得动？为什么？
3. 把 `Fish` 里那句 `super().__init__(name)` **注释掉**再跑一遍 —— 看看报的是什么错，就知道这一句为什么少不得了。

下一课，我们要给类定义上那些名字被两条下划线夹着的函数排排队 —— `__str__`、`__add__` 这些，Python 会在什么时刻**自动**替你称呼它们 
