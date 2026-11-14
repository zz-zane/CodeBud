---
id: java-stage2-04
lang: java
stage: 2
order: 4
title: 接口
tags: [面向对象, 接口]
required: ["java-stage2-03"]
crossRefs: []
estMinutes: 25
keywords: [interface, implements, default, override]
---

## 学习目标

本课学习接口。重点包括接口与实现类、实现方法的约束、接口与抽象类、default 与其他接口方法、类型与调用对照。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 接口与实现类

接口声明一组可依赖的操作。普通抽象实例方法只声明签名，由实现类提供实现；实现接口的具体类必须满足未实现的抽象方法要求。可以通过接口类型引用不同实现类的对象，并进行动态方法调用。

```java
interface Speaker {
    void speak();
}

class Cat implements Speaker {
    public void speak() {
        System.out.println("你好");
    }
}

class Robot implements Speaker {
    public void speak() {
        System.out.println("嘀嘀，我是机器人");
    }
}

public class Main {
    public static void main(String[] args) {
        Speaker[] crowd = { new Cat(), new Robot() };
        for (Speaker s : crowd) {
            s.speak();
        }
    }
}
```

```text
你好
嘀嘀，我是机器人
```

下面是另一段示例或诊断对照。

```demo
title: 签了字才干活：约定自己一个字都没干
code:
| interface Speaker {
|     void speak();
| }
|
| class Cat implements Speaker {
|     public void speak() {
|         System.out.println("你好");
|     }
| }
|
| class Robot implements Speaker {
|     public void speak() {
|         System.out.println("嘀嘀，我是机器人");
|     }
| }
|
| Speaker[] crowd = { new Cat(), new Robot() };
| for (Speaker s : crowd) {
|     s.speak();
| }

step 立一份约定，不是定义类
at: 1
say: interface Speaker —— 这不是类定义，是一份字（约定）。它不写家当、也不写初始化那一手：它只管说清楚「必须会哪几手」。
meow: interface 定义行为约定。
pose: expect
这份约定里有几手 = 1 手（speak）
谁签了字 = （还没有）
跑的是谁写的那一版 = （还没调用）

step 约定里只有名头：它不干活
at: 2
say: void speak(); 后面没有花括号，直接一个分号收尾 —— 意思是「这一手必须有，可怎么出声一个字都没说」。这就是约定和类定义最大的差别：约定不干活。
meow: 抽象方法没有方法体。
pose: think
这份约定里有几手 = 1 手（只有名头，没写怎么干）
谁签了字 = （还没有）
跑的是谁写的那一版 = （还没调用）

step 对象签字
at: 5
say: implements Speaker 读作「认下这份约定」—— 对象签了字。签字是认约定、不是认亲：签字的对象还是它自己，不必套在谁身上。
meow: Cat implements Speaker。
pose: expect
这份约定里有几手 = 1 手（只有名头，没写怎么干）
谁签了字 = Cat
跑的是谁写的那一版 = （还没调用）

step 签了字，就得自己把活干出来
at: 7
say: 约定里空着的那一手，得由签字的自己写一版补上 —— 印出「喵！」是对象自己写的。约定一个字都没帮它干。
meow: Cat 必须自己实现 speak。
pose: yay
这份约定里有几手 = 1 手（只有名头，没写怎么干）
谁签了字 = Cat（把那一手补上了）
跑的是谁写的那一版 = （还没调用）

step 机器人也签同一份字
at: 11
say: 铁也 implements Speaker。它是台机器，跟 Animal 那家人八竿子打不着 —— 照样能签。约定只认签字，不认血缘。
meow: Robot 也可以实现这个接口。
pose: expect
这份约定里有几手 = 1 手（只有名头，没写怎么干）
谁签了字 = Cat、Robot（两个都补上了）
跑的是谁写的那一版 = （还没调用）

step 一排写约定名的名称，收下签过字的
at: 17
say: Speaker[] crowd = { ... } 名称那一头写的是约定名，赋值的却是对象和机器：它俩站进同一排，靠的是同一份字。创建对象的那一头还是真类定义（new Cat()、new Robot()）—— 名称能写约定，生不出来。
meow: 接口类型的数组放不同的类。
pose: yay
这份约定里有几手 = 1 手（只有名头，没写怎么干）
谁签了字 = Cat、Robot（站进同一排）
跑的是谁写的那一版 = （还没调用）

step 第 1 步
at: 18
say: 名称那一排排好了，for 每一圈领一个出来，装进写 Speaker 的名称 s。名称管得着哪些方法，是照着名称上写的那份约定查的。
meow: s 的类型是 Speaker。
pose: expect
这份约定里有几手 = 1 手（只说要有）
谁签了字 = Cat、Robot
跑的是谁写的那一版 = （还没调用）

step 拿名称调用一次：跑的是签字那个自己写的
at: 19
say: s.speak(); 输出，跑的是名称底下那一个自己签了字、自己写的那一版 —— 对象写的：。约定在这一步还是一个字都没干。
meow: 调用 Cat 的实现。
pose: yay
这份约定里有几手 = 1 手（只说要有）
谁签了字 = Cat、Robot
跑的是谁写的那一版 = 第 1 只 Cat 写的（）

step 第 2 步
at: 18
say: 绕回 for 领下一个 —— 名称还是那块写 Speaker 的，底下换成了机器人。名称只认一件事：签过字的才装得进来。
meow: 下一个对象是 Robot。
pose: expect
这份约定里有几手 = 1 手（只说要有）
谁签了字 = Cat、Robot
跑的是谁写的那一版 = （上一版印完了）

step 同一句输出，这回跑机器那版
at: 19
say: 还是 s.speak(); 同一句，这回跑的是 Robot 自己写的那一版：嘀嘀，我是机器人。从头到尾，约定只负责「谁签了字谁站进来」，活全是签字的自己干的。
meow: 调用 Robot 的实现。
pose: proud
这份约定里有几手 = 1 手（只说要有）
谁签了字 = Cat、Robot
跑的是谁写的那一版 = 第 2 只 Robot 写的（嘀嘀）
```

## 实现方法的约束

接口的公有抽象方法由实现类实现时必须保持兼容签名与足够的访问权限，不能降低为包级可见。接口不能直接实例化。类使用 implements 实现接口，接口之间使用 extends 扩展。

```java
interface Speaker {
    void speak();
}

class Robot implements Speaker {
}

public class Main {
    public static void main(String[] args) {
        Speaker s = new Robot();
    }
}
```

```text
Main.java:5: error: Robot is not abstract and does not override abstract method speak() in Speaker
class Robot implements Speaker {
^
1 error
```

下面是另一段示例或诊断对照。

```java
interface Speaker {
    void speak();
}

class Robot implements Speaker {
    void speak() {
        System.out.println("嘀嘀，我是机器人");
    }
}

public class Main {
    public static void main(String[] args) {
        Speaker s = new Robot();
        s.speak();
    }
}
```

```text
Main.java:6: error: speak() in Robot cannot implement speak() in Speaker
    void speak() {
         ^
  attempting to assign weaker access privileges; was public
1 error
```

下面是另一段示例或诊断对照。

```java
interface Speaker {
    void speak();
}

public class Main {
    public static void main(String[] args) {
        Speaker s = new Speaker();
        s.speak();
    }
}
```

```text
Main.java:7: error: Speaker is abstract; cannot be instantiated
        Speaker s = new Speaker();
                    ^
1 error
```

下面是另一段示例或诊断对照。

```java
interface Speaker {
    void speak();
}

class Robot extends Speaker {
    void speak() {
        System.out.println("嘀嘀");
    }
}

public class Main {
    public static void main(String[] args) {
        Robot r = new Robot();
        r.speak();
    }
}
```

```text
Main.java:5: error: no interface expected here
class Robot extends Speaker {
                    ^
1 error
```

## 接口与抽象类

抽象类可以保存实例字段、定义构造方法并提供部分实现；接口主要描述类型契约。Java 类只能直接继承一个类，但可以实现多个接口。应按状态复用与契约需求选择，不能把接口等同于未完成的普通类。

```java
interface Speaker {
    void speak();
}

interface Walker {
    void walk();
}

class Cat implements Speaker, Walker {
    public void speak() {
        System.out.println("你好");
    }

    public void walk() {
        System.out.println("四个变量走过去了");
    }
}

public class Main {
    public static void main(String[] args) {
        Speaker s = new Cat();
        Walker w = new Cat();
        s.speak();
        w.walk();
    }
}
```

```text
你好
四个变量走过去了
```

## default 与其他接口方法

default 方法可以提供默认实例实现，冲突时须按 Java 规则显式解决。接口还可以具有 static 方法；较新 Java 版本也支持私有辅助方法。接口字段是常量，不能把接口当作保存每个实例独立状态的容器。

```java
interface Greeter {
    void greet();

    default void greetTwice() {
        greet();
        greet();
    }
}

class Cat implements Greeter {
    public void greet() {
        System.out.println("你好");
    }
}

public class Main {
    public static void main(String[] args) {
        Greeter g = new Cat();
        g.greetTwice();
    }
}
```

```text
你好
你好
```

## 类型与调用对照

接口类型约束调用者可使用的操作，实现类决定执行的具体行为。引用的声明类型和对象实际类型不同，并不影响对已声明接口方法的多态调用。



## 练习

定义一个接口和两个实现类，各自输出不同的中性消息。把对象放入接口类型数组，通过同一方法调用观察不同实现。
