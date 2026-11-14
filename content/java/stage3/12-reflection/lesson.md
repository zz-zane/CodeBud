---
id: java-stage3-12
lang: java
stage: 3
order: 16
title: 反射
tags: [反射, 照 X 光, 骨架图]
required: ["java-stage3-11"]
crossRefs: []
estMinutes: 26
keywords: [Class, getDeclaredFields, getDeclaredMethods, getDeclaredConstructor, newInstance]
---

## 学习目标

本课学习反射。重点包括Class 对象、获取成员、动态创建。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、照 X 光：从「手里有对象」到「手里有类定义」

平时我们写的每一句，都是**手里有对象**才能干的：`橘.名字`、`橘.打招呼()`，前面那个对象必须先抓住。

照 X 光反过来：我们手里先有一张**骨架图**，图上写着这个类定义有哪些骨头、哪些方法。这张图上光靠名字就能输出东西来 —— 不用先抓到对象。

那骨架图从哪儿来？手上有实例的时候，叫一次就行：

```java
public class Main {
    static class 子对象 {
        String 名字 = "张三";
        int 数据 = 3;
    }

    public static void main(String[] args) {
        子对象 橘 = new 子对象();
        Class<?> 甲 = 橘.getClass();
        Class<?> 乙 = 子对象.class;
        System.out.println("两张是同一张吗：" + (甲 == 乙));
        System.out.println("短名字：" + 乙.getSimpleName());
        System.out.println("全名字：" + 乙.getName());
    }
}
```

```text
两张是同一张吗：true
短名字：子对象
全名字：Main$子对象
```

两行字值得停一下：

- **`甲 == 乙` 是 `true`。** 同一个类定义，不管从哪个实例身上照，照出来的**永远是同一张**骨架图 —— 它记的是「这个类定义长什么样」，不是「这个对象现在什么样」。
- **有两套名字。** 短名字 `子对象` 是我们写类定义时起的名字；全名字 `Main$子对象` 是它在整份源代码里的地址。上面那个 `$` 是因为这张类定义是我们**画在 `Main` 里面**的。

`Class<?>` 这一对尖括号里那个问号，就是「我们也不确定是哪张类定义，反正先接住」的意思 —— 跟你前面学过的问号是一个脾气。

## 二、三种拿法

| 我们手上有什么 | 拿骨架图的方法 |
| --- | --- |
| 一个实例 | `橘.getClass()` |
| 类定义本身（写源代码时就写在旁边） | `子对象.class` |
| 只有名字这一串字 | `Class.forName("Main$子对象")` |

第三条要**全名字**，还得接着会出事的那种（`throws Exception`）：名字打错一个字母，跑起来才炸，编译器在翻译那一步**不会**替你多看一眼。

## 三、读骨头：`getDeclaredFields()`

```java
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Main {
    static class 子对象 {
        String 名字 = "张三";
        int 数据 = 3;
        boolean 睡着 = false;
    }

    public static void main(String[] args) {
        Class<?> 骨架图 = 子对象.class;
        List<String> 骨头们 = new ArrayList<>();
        for (Field 骨头 : 骨架图.getDeclaredFields()) {
            骨头们.add(骨头.getType().getSimpleName() + " " + 骨头.getName());
        }
        Collections.sort(骨头们);
        for (String 一行 : 骨头们) {
            System.out.println(一行);
        }
    }
}
```

```text
String 名字
boolean 睡着
int 数据
```

三件事：

- **`getDeclaredFields()` 交回来的是一柜子 `Field`。** 一根骨头一张牌，牌上写着它的名字（`getName()`）和它是哪一种（`getType()`）。
- **先给它们排排坐再印。** 光片上的骨头顺序**我们说了不算**，谁先谁后是机器那边的事。要印出一张每次看都一样的表，就得自己先给名字**排排坐**（`Collections.sort`）—— 这也是为什么上面要多收一个柜子。
- **`getDeclaredFields()` 只列这张类定义自己写的骨头。** 我们试过一张只写了自己 1 根骨头的子类：数出来就是 1 根，上一代传下来的那根**不在里面**。要把上一代的一起列出来，得换 `getFields()` —— 它列的是**别人能看的那些**（`public` 的），跟我们写不写 `private` 无关。

「照 X 光」到底照的是什么、凭什么不用先抓到对象，我们拆成一步一步走给你看：

```demo
title: 手里只有类定义也能输出骨头：照 X 光看一个类有什么
code:
| class 子对象 {
|     String 名字 = "张三";
|     int 数据 = 3;
|     boolean 睡着 = false;
| }
|
| Class<?> 骨架图 = 子对象.class;
| List<String> 骨头们 = new ArrayList<>();
| for (Field 骨头 : 骨架图.getDeclaredFields()) {
|     骨头们.add(骨头.getType().getSimpleName() + " " + 骨头.getName());
| }
| Collections.sort(骨头们);
| for (String 一行 : 骨头们) {
|     System.out.println(一行);
| }

step 先有类定义：三根骨头画在上面
at: 1
say: `class 子对象 { ... }` 这张类定义上画了三根骨头：`名字`、`数据`、`睡着`，每根都标着是哪一种。**到这一步为止一个对象都还没画** —— 照 X 光要的就是类定义，不是对象。
meow: 类有三个字段。
pose: expect
骨架图 = （还没照）
骨头们 = （还没备柜子）
标准输出 = 还没印

step 照类定义拿骨架图：不用先抓对象
at: 7
say: `子对象.class` 就是照 X 光那一下：**不用先抓到对象**，类定义本身就能照出骨架图。手上有实例的时候叫一句 `橘.getClass()`，照出来的是**同一张** —— 它记的是「这类定义长什么样」，不是「哪个对象现在什么样」。
meow: Class 对象描述类的结构。
pose: expect
骨架图 = 子对象这张（一个对象都没抓）
骨头们 = （还没备柜子）
标准输出 = 还没印

step 备一个柜子
at: 8
say: `List<String> 骨头们 = new ArrayList<>();` —— 待会儿一根骨头写一行，先拿它保存，最后才印。
meow: 准备保存字段信息。
pose: expect
骨架图 = 子对象这张（一个对象都没抓）
骨头们 = （空柜子）
标准输出 = 还没印

step 骨架图交回一柜子牌
at: 9
say: `骨架图.getDeclaredFields()` 把类定义上**自己写的**骨头全交回来：一根骨头一张牌（`Field`）。牌上写着它的名字和它是哪一种 —— 骨架图本身不印字，得我们自己一张一张念。
meow: getDeclaredFields 取得全部字段。
pose: busy
骨架图 = 子对象这张（一个对象都没抓）
骨头们 = （空柜子）
标准输出 = 还没印

step 拆牌：问类型、问名字
at: 10
say: `骨头.getType().getSimpleName()` 问「**哪一种骨头**」（`String`、`int`、`boolean`），`骨头.getName()` 问「**叫什么**」。中间那个空格和谁先谁后，是我们自己拼的。
meow: 读取字段的类型和名称。
pose: busy
骨架图 = 子对象这张（一个对象都没抓）
骨头们 = 1 行（机器给的先后，还没排）
标准输出 = 还没印

step 三根骨头，三张牌都写好
at: 10
say: 这个圈转三遍，三根骨头各写一行进了柜子。**表上只有类定义自己写的这三根** —— 从上一代传下来的骨头不在这张表里，跟自己写的那条规矩是一样的。
meow: 只列出本类声明的字段。
pose: yay
骨架图 = 子对象这张（一个对象都没抓）
骨头们 = 3 行（机器给的先后，还没排）
标准输出 = 还没印

step 排排坐：顺序我们说了不算
at: 12
say: `Collections.sort(骨头们);` —— **骨头的先后是机器那边的事**，我们说了不算。要印出一张每次看都一样的表，就得自己先给它们排排坐。
meow: 字段顺序不固定，先排序。
pose: think
骨架图 = 子对象这张（一个对象都没抓）
骨头们 = 3 行（按名字排好序）
标准输出 = 还没印

step 印出来：三根骨头一根不少
at: 14
say: 一行一根印出来：`String 名字`、`boolean 睡着`、`int 数据`。全程**一个对象都没抓** —— 这就是照 X 光：光凭一个类定义，就把上面有什么看清楚了。
meow: 输出字段，没有创建对象。
pose: proud
骨架图 = 子对象这张（一个对象都没抓）
骨头们 = 3 行（按名字排好序）
标准输出 = String 名字 / boolean 睡着 / int 数据
```

**照 X 光看的是类定义，不是对象**：类定义往光下一放，骨头一根一根列出来；表上谁先谁后是机器说了算，所以印之前要自己先排排坐。

## 四、读方法：`getDeclaredMethods()`

```java
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Main {
    static class 子对象 {
        String 名字 = "张三";

        void 打招呼() {
            System.out.println("字");
        }

        int 要数据(int 几根) {
            return 几根 * 2;
        }
    }

    public static void main(String[] args) {
        List<String> 函数 = new ArrayList<>();
        for (Method 一个方法 : 子对象.class.getDeclaredMethods()) {
            函数.add(一个方法.getName() + "，传入 " + 一个方法.getParameterCount() + " 样东西");
        }
        Collections.sort(函数);
        for (String 一行 : 函数) {
            System.out.println(一行);
        }
        System.out.println("一共 " + 函数.size() + " 招");
    }
}
```

```text
打招呼，传入 0 样东西
要数据，传入 1 样东西
一共 2 招
```

牌换成了 `Method`，能问的东西也多了几样：`getName()` 问名字，`getParameterCount()` 问「这一个方法要传入几样东西」。

注意表上**只有我们自己写的 2 招**：类定义上那些从上一代继承来的方法（比如大家都会的那些）不在这张表里，跟自己写的骨头是同一条规矩。

## 五、照类定义接创建一个

光看还不够。骨架图上还画着**产房**：照着它，我们能凭空接创建一个新对象来，根本不用知道类定义上写了什么名字。

```java
import java.lang.reflect.Constructor;

public class Main {
    static class 子对象 {
        String 名字;
        int 数据;

        子对象(String 名字, int 数据) {
            this.名字 = 名字;
            this.数据 = 数据;
        }
    }

    public static void main(String[] args) throws Exception {
        Constructor<?> 产房 = 子对象.class.getDeclaredConstructor(String.class, int.class);
        子对象 新的 = (子对象) 产房.newInstance("煤球", 5);
        System.out.println(新的.名字 + " 有 " + 新的.数据 + " 根数据");
    }
}
```

```text
煤球 有 5 根数据
```

两个新动作：

- **`getDeclaredConstructor(...)` 是「找那间产房」。** 括号里要报的**不是值**，是**样子的名字**：`String.class` 报的是「一间收串字字符串的」，`int.class` 报的是「一间收整数的」。报几样、报什么，都得跟类定义上那间**一模一样**。
- **`newInstance(...)` 才是真接生。** 要传入的东西写在这里，传入几样就得跟产房对得上。它返回的是一个「不知道哪张类定义创建后的对象」，所以要**自己写明白接的是哪一种**：前面那个 `(子对象)` 就是干这个的。

## 六、连私房骨头都能碰：`setAccessible(true)`

骨头上贴着「只给我们看」的标签（`private`），平时外面伸手去拿是会被拦的。照 X 光之后，我们能**掀开盖子**：

```java
import java.lang.reflect.Field;

public class Main {
    public static void main(String[] args) throws Exception {
        子对象 橘 = new 子对象();
        Field 骨头 = 子对象.class.getDeclaredField("名字");
        骨头.setAccessible(true);
        System.out.println("照之前：" + 骨头.get(橘));
        骨头.set(橘, "赵六");
        System.out.println("照之后：" + 骨头.get(橘));
    }
}

class 子对象 {
    private String 名字 = "张三";
}
```

```text
照之前：张三
照之后：赵六
```

- `骨头.get(橘)` 是「从这个对象身上把这根骨头读出来」，`骨头.set(橘, "赵六")` 是「给它改掉」。
- **少了 `setAccessible(true)` 这一句，就会被当场拦下来。** 我们试过：这两张类定义（`Main` 和 `子对象`）是**各自独立**的，我们站在 `Main` 这张图上伸进 `子对象` 那张图里拿私房骨头，不掀盖子是不行的。这一句的意思就是我们**自己**担这个责任：盖子是我们掀的。
- 名字（`getDeclaredField("名字")`）也得跟类定义上**一模一样**，差一个字都找不到。

> **对象在院里踩的坑：类定义套在类定义里面的那种，盖子反而拦不住我们。**
> 我们把 `子对象` 写进 `Main` 里（像第二节那样画在 `Main` 里面）的时候，**不写 `setAccessible(true)` 也照样读得动** —— 画在自己身上的类定义，盖子拦不住自己人。要演示「被拦下来」这件事，就得像上面这段一样，把两张类定义**平着摆**：一张 `Main`、一张 `子对象`，谁都够不着谁的口袋。

## 七、它不是替我们猜的

我们头一回写「找那间收整数的产房」，可类定义上画的是「收一串字的产房」，跑起来就挨了这么一句：

```java
import java.lang.reflect.Constructor;

public class Main {
    static class Kitty {
        Kitty(String name) {
        }
    }

    public static void main(String[] args) throws Exception {
        Constructor<?> 产房 = Kitty.class.getDeclaredConstructor(int.class);
        System.out.println("产房要传入 " + 产房.getParameterCount() + " 样东西");
    }
}
```

```text
Exception in thread "main" java.lang.NoSuchMethodException: Main$Kitty.<init>(int)
```

前半句是「我们照着名字找一圈，没找到」；后半句是它在念我们报的那个名字：`Main$Kitty.<init>(int)` —— 类定义上那间产房明明收的是 `String`，我们报的却是 `int`。**它不会替我们猜「大概想说的是另一间吧」**，找不到就是找不到。

这里顺带说一句那块代码为什么用英文名 `Kitty`：报错原话里会把名字**原样印出来**，我们头一回拿中文名字试，屏幕上印出来的是 `Main$Сè` 这种烤糊了的字 —— 名字本身没错，是报错那一路的字形转了一道手。演示报错的地方用英文名，报错原话才能一个字母不差地抄给你们看。

## 八、什么时候该照 X 光、代价是什么

这门本事不是拿来天天用的。**平时写代码，我们手里都有对象** —— 直接叫它做事，编译器在翻译那一步就能替我们挑错，名字打错、传入的东西不对，全都当场拦下。

照 X 光把这一层保护**绕过去了**：名字是写在字符串里的，翻译那一步看不见它，只有真跑到那一句才发现不对（上面那句报错就是这么来的）。所以它的位置很清楚：

- **只在「写源代码的时候还不知道要碰谁」的地方用** —— 比如一个谁也认不出来的通用工具、一堆类定义挨个照一遍的批量活；
- **能用真正名字写死的，就别用照 X 光。** 它慢，而且错都在跑起来之后才现形。

## 一句话小抄

| 我们想干什么 | 方法 |
| --- | --- |
| 从实例身上拿光片 | `橘.getClass()` |
| 手上有类定义 | `子对象.class` |
| 只有名字这串字 | `Class.forName("全名字")` |
| 读骨头 | `类定义.getDeclaredFields()` → `Field` |
| 读方法 | `类定义.getDeclaredMethods()` → `Method` |
| 找产房 | `类定义.getDeclaredConstructor(String.class, int.class)` → `Constructor` |
| 照类定义接生 | `产房.newInstance("煤球", 5)` |
| 掀开私房盖 | `骨头.setAccessible(true)` |
| 名字对不对 | 全名字长这样：`Main$子对象` |

::: tip 提示

- **手上有实例、有类定义、只有一串字，三条路各有一手**：实例身上叫 `.getClass()`、类定义旁边写 `.class`、只认名字就 `Class.forName(...)` —— 最后那条要报全名字，报错一个字母，跑起来才炸。
- **读骨头、读方法都只列类定义自己写的那些**：从上一代传下来的不在表里。
- **表上谁先谁后我们说了不算**：想印出一张每次看都一样的表，得自己先给名字排排坐。
- **找产房要报「样子的名字」**，还得跟类定义上那间一模一样 —— 报错了它不会替我们猜，找不到就是找不到。
- **能用真正名字写死的，就别照 X 光**：名字写成一串字之后，翻译源代码那一步看不见它，错都留到跑起来才现形。

:::

## 小任务

1. 给第三节那张类定义再加上一根骨头（比如 `double 体重`），再跑一次，看那张表上多出来哪一行、排在第几位。
2. 把第三节的 `getDeclaredFields()` 换成 `getFields()` 跑一遍，数数表上还剩几行 —— 再想想为什么少了（提示：那三根骨头里，哪一根是「别人能看的」？）。
3. 拿第五节那段，把产房换成**只收一样东西**的那间（先照着改类定义，再改报名字的那一处），接创建一个属于你自己的对象。
