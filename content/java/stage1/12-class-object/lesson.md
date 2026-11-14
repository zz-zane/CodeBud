---
id: java-stage1-12
lang: java
stage: 1
order: 16
title: 类与对象
tags: [面向对象, 类与对象, 构造方法]
required: [java-stage1-11]
crossRefs: ["common-10", "c-stage2-05", "cpp-stage2-01", "python-stage1-14"]
compare: ["common-10"]
estMinutes: 25
keywords: [class, new, field, method]
---

## 学习目标

本课学习类与对象。重点包括定义字段与实例方法、多个独立实例、字段默认值、引用声明与对象创建、实例方法与 static。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 定义字段与实例方法

Java 类把字段与方法组织为一个类型。示例的 `name` 和 `fish` 是实例字段，每个对象各有一份值；没有 `static` 的方法需要一个实例作为接收者。类定义说明成员结构，`new` 表达式才会创建实例并调用构造方法。

```java
class Cat {
    String name;
    int fish;

    void meow() {
        System.out.println(name + "：我们当前记录了 " + fish + " 条数据");
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat();
        c.name = "张三";
        c.fish = 3;
        c.meow();
    }
}
```

```text
张三：我们当前记录了 3 条数据
```

## 多个独立实例

两次 `new Cat()` 创建两个不同对象。给一个对象的字段赋值不会自动修改另一个对象的字段；通过 `c.name` 或 `c.meow()` 访问的是引用 `c` 当前指向的对象。

```java
class Cat {
    String name;
    int fish;

    void eat(int n) {
        fish = fish + n;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c1 = new Cat();
        c1.name = "张三";
        Cat c2 = new Cat();
        c2.name = "李四";

        c1.eat(3);
        c2.eat(1);
        c1.eat(2);

        System.out.println(c1.name + " 处理了 " + c1.fish + " 条");
        System.out.println(c2.name + " 处理了 " + c2.fish + " 条");
    }
}
```

```text
张三 处理了 5 条
李四 处理了 1 条
```

## 字段默认值

实例字段在显式初始化之前先取得默认值：数值为零，boolean 为 false，引用为 null。局部变量没有可直接读取的默认初始化值，使用前必须按 Java 的确定赋值规则完成赋值。

```java
class Cat {
    String name;
    int fish;
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat();
        System.out.println(c.fish);
        System.out.println(c.name);
    }
}
```

```text
0
null
```

## 引用声明与对象创建

`Cat c;` 只声明一个局部引用变量，并不创建 Cat 对象，也不允许立刻读取未赋值的 c。`Cat c = new Cat();` 才会创建对象并把引用赋给 c。

```java
class Cat {
    String name;
}

public class Main {
    public static void main(String[] args) {
        Cat c;
        System.out.println(c.name);
    }
}
```

```text
Main.java:8: error: variable c might not have been initialized
        System.out.println(c.name);
                           ^
1 error
```

```demo
title: 从类定义到两个实例，new 那一下到底做了什么
code:
| class Cat {
|     String name;
|     int fish;
|     void eat(int n) {
|         fish = fish + n;
|     }
| }
| Cat c1 = new Cat();
| c1.name = "张三";
| Cat c2 = new Cat();
| c2.name = "李四";
| c1.eat(3);
| c2.eat(1);
| c1.eat(2);
| System.out.println(c1.name + " 处理了 " + c1.fish + " 条");
| System.out.println(c2.name + " 处理了 " + c2.fish + " 条");

step 定义类：一个实例都还没有
at: 1
say: `class Cat { ... }` 这一整块就是类定义：上面写着「照它创建后的对象自带两样」和「会一个方法 `eat`」。**类定义不是对象** —— 它不包含独立执行过程、也不会处理数据，这一刻一个实例都没有。
meow: 类定义好了，对象还没创建。
pose: expect
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 还没生
c2 的两样家当 = 还没生
标准输出 = 还没印

step Cat c1 = new Cat();：new 那一下
at: 8
say: 这一行是**两件事并成一句**：右边 `new Cat()` 根据类创建出一个实例（`new` 就是「创建一个」的口令），左边把名称 `c1` 挂到它身上。刚创建后什么都没挂时，名字名称是 `null`，数码名称默认是 `0`。
meow: new 创建对象，c1 保存引用。
pose: busy
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称 null、数据名称 0
c2 的两样家当 = 还没生
标准输出 = 还没印

step c1.name = "张三"：挂给这一个
at: 9
say: 前面顶着 `c1.`，动的就是**这一个**：名字名称从 `null` 换成「张三」。旁边那块数据名称还是 `0` —— 两块名称各归各的，挂一块不动另一块。
meow: 给 c1 的 name 赋值。
pose: busy
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称「张三」、数据名称 0
c2 的两样家当 = 还没生
标准输出 = 还没印

step Cat c2 = new Cat();：再 new 一个
at: 10
say: 类定义还是那一张，一个字都没改。`new Cat()` 又创建一个 —— **类定义不会用旧**。回头看一眼 `c1`：它那两样**一点没动**。
meow: new 创建第二个对象。
pose: expect
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称「张三」、数据名称 0
c2 的两样家当 = 名字名称 null、数据名称 0
标准输出 = 还没印

step c2.name = "李四"：换一个挂
at: 11
say: 同样是挂名字，可这回名称前面写的是 `c2` —— 换的是**第二只**的名字名称。第一个那串「张三」动都不动。
meow: 给 c2 的 name 赋值，c1 不受影响。
pose: busy
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称「张三」、数据名称 0
c2 的两样家当 = 名字名称「李四」、数据名称 0
标准输出 = 还没印

step c1.eat(3)：张三自己处理
at: 12
say: **先说哪个对象，再调用方法名**。`c1.eat(3)` 让张三去做 `eat` 这一个方法，传入 3 —— 这一次要跳回类定义上画的方法里跑一趟。
meow: 调用 c1.eat(3)。
pose: expect
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称「张三」、数据名称 0
c2 的两样家当 = 名字名称「李四」、数据名称 0
标准输出 = 还没印

step 方法里那一行跑起来：谁调用就动谁
at: 5
say: `fish = fish + n;` 里的 `fish` 前面**什么前缀都没有**，说的就是**正在做这一个方法的那个对象**的数据名称：张三那格本来是 0，加上传入的 3，成了 3。**李四那格一动不动。**
meow: 这里的 fish 是 c1 的字段。
pose: yay
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称「张三」、数据名称 3
c2 的两样家当 = 名字名称「李四」、数据名称 0
标准输出 = 还没印

step c2.eat(1)：同一段方法，这回李四做
at: 13
say: `c2.eat(1)` 跑的是**同一段方法代码**，一个字都没变；变的只有「这一趟谁在做」—— `fish` 指的是李四的数据名称，0 加 1 得 1。**这就是「先说是谁」的用处**。
meow: 调用 c2.eat(1)，fish 是 c2 的字段。
pose: busy
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称「张三」、数据名称 3
c2 的两样家当 = 名字名称「李四」、数据名称 1
标准输出 = 还没印

step c1.eat(2)：又轮到张三
at: 14
say: 再调用一次张三。这回 `fish` 是她自己那格的 **3**，加上 2 得 5 —— 张三处理了两顿，账是叠起来的；李四那格还是 1。
meow: c1 再加 2，变成 5。
pose: yay
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称「张三」、数据名称 5
c2 的两样家当 = 名字名称「李四」、数据名称 1
标准输出 = 还没印

step 打印张三的账
at: 15
say: `c1.name` 和 `c1.fish` 各从**张三自己**那两块名称上返回一样出来，拼成一句话交给 `println` 印出去。
meow: 输出 c1 的数据。
pose: expect
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称「张三」、数据名称 5
c2 的两样家当 = 名字名称「李四」、数据名称 1
标准输出 = 张三 处理了 5 条

step 打印李四的账：两个各记各的
at: 16
say: 换 `c2` 再返回一遍，印出来是「李四 处理了 1 条」。两个实例**各带各的家当**，从头到尾谁也没串到谁头上。
meow: 输出 c2 的数据。
pose: proud
类定义 Cat = 画好了（本身不是对象）
c1 的两样家当 = 名字名称「张三」、数据名称 5
c2 的两样家当 = 名字名称「李四」、数据名称 1
标准输出 = 张三 处理了 5 条／李四 处理了 1 条
```

## 实例方法与 static

实例方法通过对象调用，并可直接访问该对象的实例字段。静态方法属于类，没有隐含的当前实例；`main` 是静态方法，要访问实例成员必须先获得相应对象引用。

```java
class Cat {
    String name;

    void meow() {
        System.out.println("");
    }
}

public class Main {
    public static void main(String[] args) {
        Cat.meow();
    }
}
```

```text
Main.java:11: error: non-static method meow() cannot be referenced from a static context
        Cat.meow();
           ^
1 error
```

```java
Cat c = new Cat();
c.name = "张三";
c.meow();
```

## 构造方法与初始化

构造方法与类同名且没有返回类型，用于初始化新对象。未声明任何构造方法时，编译器可提供默认无参构造方法；一旦声明了构造方法，是否还存在无参形式取决于代码是否显式提供。



## 源文件与类名

在常见文件系统编译环境中，public 顶层类的名称应与源文件名一致。练习环境可能使用 Main.java，因此完整程序使用 public class Main；辅助类可在同一文件中声明为非 public。



## 成员访问对照

类声明定义类型，引用变量保存对象引用，`new` 创建实例，点号选择成员。区分变量的声明类型、引用是否已赋值和对象的实际状态。



## 练习

创建两个对象并设置不同字段值，分别调用实例方法。再比较只声明引用与执行 new 的区别，并观察未显式赋值的实例字段默认值。
