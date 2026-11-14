---
id: java-stage3-18
lang: java
stage: 3
order: 21
title: 垃圾回收与 JVM 内存模型
tags: ["JVM", "内存"]
required: ["java-stage3-17"]
crossRefs: ["java-stage1-12", "java-stage2-01", "c-stage3-01"]
estMinutes: 30
keywords: [jvm-memory, heap, stack, garbage-collection, gc-root]
---

## 学习目标

本课学习垃圾回收与 JVM 内存模型。重点包括JVM 运行时数据区域、对象与引用、可达性与回收资格、回收时机、分代思想。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## JVM 运行时数据区域

JVM 运行时数据区域包括堆、线程栈和方法区等。对象通常在堆中分配，方法调用使用栈帧保存局部变量与执行状态；实际优化可能改变具体存储实现，不能把教学图当作所有 JVM 的物理布局保证。

```java
class Cat {
    String name;

    Cat(String name) {
        this.name = name;
    }
}

public class Main {
    static Cat 创建一个对象() {
        Cat 屋里那个 = new Cat("张三");
        return 屋里那个;
    }

    public static void main(String[] args) {
        Cat 外面拿着的 = 创建一个对象();
        System.out.println(外面拿着的.name);
        System.out.println(外面拿着的 == 创建一个对象());
    }
}
```

```text
张三
false
```

## 对象与引用

引用变量与对象本身是不同概念。多个引用可以指向同一个对象，修改对象状态会通过这些引用观察到；重新赋值一个引用不会自动改变其他引用。null 表示没有引用对象。

```demo
title: 名称、盒子与垃圾回收器
code:
| Cat 张三 = new Cat("张三");
| Cat 另一张牌 = 张三;
| 张三 = null;
| 另一张牌 = null;

step 一个新盒子搬进院子
at: 1
say: `new` 出来的这个实例住在**堆**里；栈上立起一张名称，写着它在院子里的位置。从这一刻起，它「够得着」。
meow: 对象在堆上，引用在栈上。
pose: expect
堆里剩几个盒子 = 1
栈上几张牌 = 1

step 又立了一张名称
at: 2
say: 这一步是**又拿了一张牌**，不是又造了一个对象 —— 两张牌指着堆里同一个盒子，所以盒子还是 1 只。
meow: 两个引用指向同一个对象。
pose: guide
堆里剩几个盒子 = 1
栈上几张牌 = 2

step 放下第一张牌
at: 3
say: 放下的是名称，盒子一动不动。第二张牌还指着它，清理官顺着路走一遍：还走得到，先留着。
meow: 一个引用设为 null，对象仍可达。
pose: think
堆里剩几个盒子 = 1
栈上几张牌 = 1

step 最后一张牌也放下
at: 4
say: 现在从根上出发，没有任何一条路走得到这个盒子了。它从「够得着」变成了「没人要」——可以铲了。
meow: 不再可达，可以被回收。
pose: milestone
堆里剩几个盒子 = 1（没人要了）
栈上几张牌 = 0

step 清理官动手
at: 4
say: 我们调用了一输出方法。**这个是建议**：清理官可以现在扫，也可以等院子满了再扫。第四节那段真跑里，它这回确实动了手。
meow: System.gc() 只是建议。
pose: yay
堆里剩几个盒子 = 0（扫走了）
栈上几张牌 = 0
```

以下是本节的另一段示例或诊断信息。

```java
class Cat {
    String name;

    Cat(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat 张三 = new Cat("张三");
        Cat 另一张牌 = 张三;
        张三 = null;
        System.out.println(另一张牌.name);
        System.out.println(张三 == null);
    }
}
```

```text
张三
true
```

以下是本节的另一段示例或诊断信息。

```java
class Cat {
    String name;

    Cat(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat 张三 = new Cat("张三");
        张三 = null;
        System.out.println("张三的名字是：" + 张三.name);
    }
}
```

以下是本节的另一段示例或诊断信息。

```text
Exception in thread "main" java.lang.NullPointerException: Cannot read field "name" because "<local1>" is null
at Main.main(Main.java:13)
```

## 可达性与回收资格

垃圾回收器从 GC Roots 等起点检查对象的可达性。没有可达路径的对象可成为回收候选；对象间即使互相引用，只要整个对象集合已不可达，仍可被回收。

```java
class Cat {
    String name;
    Cat 朋友;

    Cat(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat 甲 = new Cat("张三");
        Cat 乙 = new Cat("李四");
        甲.朋友 = 乙;
        乙.朋友 = 甲;
        System.out.println("甲的朋友是：" + 甲.朋友.name);
        System.out.println("乙的朋友是：" + 乙.朋友.name);
        甲 = null;
        乙 = null;
        System.out.println("外面两张牌都放下了");
    }
}
```

```text
甲的朋友是：李四
乙的朋友是：张三
外面两张牌都放下了
```

## 回收时机

对象失去可达引用不代表立刻释放内存，实际回收时机由收集器和运行时决定。System.gc 不是立即完成回收的保证。不能把 GC 当作关闭文件、连接等外部资源的确定性机制。

```java
public class Main {
    static String report(Runtime rt) {
        return "院子一共 " + rt.totalMemory() / 1024 / 1024 + " MB，还空着 "
                + rt.freeMemory() / 1024 / 1024 + " MB";
    }

    public static void main(String[] args) {
        Runtime rt = Runtime.getRuntime();
        System.out.println("刚开跑：" + report(rt));

        for (int round = 0; round < 3; round++) {
            String[] pile = new String[100000];
            for (int i = 0; i < pile.length; i++) {
                pile[i] = new String("数据" + i);
            }
            System.out.println("堆了 " + (round + 1) + " 轮：" + report(rt));
            pile = null;
        }

        System.gc();
        System.out.println("调用结束 System.gc() 之后：" + report(rt));
    }
}
```

## 分代思想

分代收集利用大量对象生命周期较短的经验，区分新生代和老年代等区域。不同收集器的区域组织和策略不同，不能假定所有 Java 版本都使用同一固定布局。



## 常见误解

将一个引用设为 null 不一定让对象立即不可达，还需要检查是否存在其他引用。内存被自动管理不等于程序不会发生内存泄漏；长期保留不再需要的可达对象仍会增加内存占用。

```java
public class Main {
    public static void main(String[] args) {
        String a = "字";
        String b = "字";
        String c = new String("字");
        System.out.println(a == b);
        System.out.println(a == c);
        System.out.println(a.equals(c));
    }
}
```

```text
true
false
true
```

## 练习

画出两个引用指向同一对象的关系，依次重新赋值并判断对象是否仍可达。解释为什么文件和网络连接仍需要明确关闭。
