---
id: java-stage3-13
lang: java
stage: 3
order: 17
title: 注解初步
tags: [注解, 小纸条, 照 X 光]
required: ["java-stage3-12"]
crossRefs: []
estMinutes: 26
keywords: [Override, Deprecated, Retention, Target, getAnnotation]
---

## 学习目标

本课学习注解初步。重点包括注解是什么、自定义注解、常见注解。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、纸条长什么样

纸条在代码里就一个形状：`@` 后面跟个名字。我们见过的都在这三行里：

- `@Override` —— 光秃秃一张，后面什么都不带；
- `@Deprecated` —— 同上，也是光秃秃一张；
- `@纸条("处理了")` —— 名字后面拖一对圆括号，括号里夹着**纸条上写的字**。

三条规矩先记下：

- **`@` 开头。** 一眼就跟叫方法、开变量那些区分开（叫方法后面不会跟个 `@`）。
- **括号里可以什么都不写，也可以写一样、写好几样。** 写的到底是什么，第六节说。
- **纸条自己不干活 —— 这是本课最要紧的一句。** 贴上去之后，它不会执行任何东西、不会印一个字、也不会替我们改哪根骨头。它就是**贴在那儿的一行字**；有没有人读它、读完干什么，全看贴在了谁身上。

## 二、编译器本来就知道的那种：`@Override`

先看一张不用自己画、编译器就认得的纸条。

我们的类定义是套着画的（第 16 课那张 `Main$子对象` 就是这么画出来的）。套法是这样的：我们照着上一代那张类定义画一张新的，**上一代的方法我们可以照原样盖掉、换上自己这版**。但凡这么盖的，我们都在方法头上贴一张 `@Override`，意思是「这一个方法，是盖掉上一代那一个方法、换上自己这版的」。

贴对了两边都没事。我们手一抖，把上一代的「打招呼」写成了「打招乎」：

```java
public class Main {
    static class 父对象 {
        void 打招呼() {
        }
    }

    static class 子对象 extends 父对象 {
        @Override
        void 打招乎() {
        }
    }

    public static void main(String[] args) {
        new 子对象().打招呼();
    }
}
```

```text
Main.java:8: error: method does not override or implement a method from a supertype
```

编译器本来**根本不管**这种错：名字不一样，那就是我们新添的一个方法，爱叫什么叫什么。可它一眼扫到我们头上那张 `@Override`，纸条上写着「这招是盖掉上一代那招的」—— 它回头一查上一代那张类定义，**上面压根没有『打招乎』这一个方法**，当场拦下。

把「打招乎」改回「打招呼」，纸条一个字都不用动，它就一次不吭了。**同一个程序，贴不贴这张纸条，过不过得了关是不一样的** —— 纸条的全部本事就在这儿：它替不了我们干活，但它能**给编译器递话**。

## 三、还有一张，是给「看对象的人」看的：`@Deprecated`

`@Deprecated` 的意思是「这一个方法过时了，尽量别再用」。我们本以为它也会像上面那样拦人，特意试了一回 —— **它不拦**：错误信息一个都没有，编得过、跑得完。（至于它会不会**嘀咕两句**，得看类定义怎么摆 —— 我们把量出来的原话记在下面「对象在院里踩的坑」里了。）

那这张纸条到底留给谁看？我们拿第 16 课那手照 X 光试了试：

```java
import java.lang.reflect.Method;

public class Main {
    public static void main(String[] args) throws Exception {
        Method 一个方法 = 父对象.class.getDeclaredMethod("老招呼");
        System.out.println("光片上看得到「过时了」吗：" + 一个方法.isAnnotationPresent(Deprecated.class));
    }
}

class 父对象 {
    @Deprecated
    void 老招呼() {
    }
}
```

```text
光片上看得到「过时了」吗：true
```

`一个方法.isAnnotationPresent(Deprecated.class)` 问的是「这张纸条贴了没」，返回的是 `true` 或 `false`。这一印就说明：**纸条贴上去之后是留在光片上的** —— 走照 X 光那条路，我们自己就能把纸条读出来。

> **对象在院里踩的坑：别指望编译器替你念 `@Deprecated`。**
> 我们头一回试的时候，特意把「用老方法」那段摆成两种样子，结果**两种还真不一样** ——
>
> - 方法跟用法写在**同一个最外层类定义**里（哪怕方法住在同一张最外层类定义里的**内嵌**子类里）—— stderr **0 字节**，一个字都没说；
> - 一旦**拆成两张顶层类定义**（在同一个文件里并排摆两张、还是分成两个文件 —— 我们量出来都是 **107 字节**）—— 它会印**两行**，原话是 `Note: Main.java uses or overrides a deprecated API.` 和 `Note: Recompile with -Xlint:deprecation for details.`
>
> 所以得更正我们自己那句话：它不是「不说」，是**只在跨出最外层类定义的时候才说**，而且用的是 `Note:` 这种口气 —— **不是错误信息、也不拦你**，照样编得出来。这句话在不在，取决于类定义怎么摆、取决于你用哪套家伙编，**靠不住** —— 所以「会挨骂」这种画面我们不写给你们看：那一课的重点是纸条本身，**纸条在哪儿都读得出来**，这才是真的。

## 四、自己画一张纸条：`@interface`

纸条也能自己画。写法就是**在定义类的写法前面多一个 `@`**：`@interface 纸条 { ... }`。

纸条上可以留几栏字，写法像方法，但**没有方法的身子**（后面直接跟分号，不跟那对花括号）。比如我们想要一张写着备注的纸条：

```java
import java.lang.annotation.ElementType;
import java.lang.annotation.Target;
import java.lang.reflect.Method;

public class Main {
    @Target(ElementType.METHOD)
    @interface 纸条 {
        String value();
    }

    static class 子对象 {
        @纸条("处理了")
        void 打招呼() {
        }
    }

    public static void main(String[] args) throws Exception {
        Method 一个方法 = 子对象.class.getDeclaredMethod("打招呼");
        纸条 小纸条 = 一个方法.getAnnotation(纸条.class);
        System.out.println("照 X 光看得见吗：" + (小纸条 == null ? "看不见" : 小纸条.value()));
    }
}
```

```text
照 X 光看得见吗：看不见
```

（头一行那支 `@Target` 先当没看见，第八节专门说它。）

纸条画出来了，也贴到方法上了，照 X 光却**看不见**。为什么？

**因为纸条默认只留到「翻译那一步」。** 编译器编译的时候纸条它是看得见的（第二节那张 `@Override` 就是这么被它抓住的）；翻完之后，纸条不跟着上路了 —— 照 X 光是在**跑起来之后**才读的，这时候光片上没这张纸条，`getAnnotation(...)` 交回来的就是 `null`，所以印的是「看不见」。

## 五、想让它留到跑的时候，得自己写一句说明书

在纸条上补一张说明书：`@Retention(RetentionPolicy.RUNTIME)`，意思就是「**留到跑的时候**」。

```java
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Main {
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.METHOD)
    @interface 纸条 {
        String value();
    }

    static class 子对象 {
        @纸条("处理了")
        void 打招呼() {
        }

        @纸条("别烦我")
        void 睡觉() {
        }

        void 发呆() {
        }
    }

    public static void main(String[] args) throws Exception {
        List<String> 表 = new ArrayList<>();
        for (Method 一个方法 : 子对象.class.getDeclaredMethods()) {
            纸条 小纸条 = 一个方法.getAnnotation(纸条.class);
            表.add(一个方法.getName() + "：" + (小纸条 == null ? "没贴纸条" : 小纸条.value()));
        }
        Collections.sort(表);
        for (String 一行 : 表) {
            System.out.println(一行);
        }
    }
}
```

```text
发呆：没贴纸条
打招呼：处理了
睡觉：别烦我
```

几件事记下：

- **`@Retention` 有三档，我们只用得上两档。** `RUNTIME` 是「留到跑的时候」，`CLASS` 是「翻完就不带了」。**这一句不写的时候，就停在 `CLASS` 那一档** —— 我们两回都试了（明写 `CLASS` 的、干脆不写的），照 X 光都是「看不见」。
- **`getAnnotation(...)` 交回来的是一张纸条，不是 `true`/`false`。** 没贴的时候给 `null`，所以得先看它是不是 `null`，再往下读纸条上那行字。要只问「贴了没」，用第三节那个 `isAnnotationPresent(...)` 更省事。
- **三个方法里只有贴了纸条的两招读得出字。** `发呆` 头上什么都没贴，印的就是「没贴纸条」—— 纸条不贴，光片上就空着，这很正常，别把它当出错。

## 六、`@纸条("处理了")` 这种省事写法，有个前提

上面几支纸条，我们都是「括号里只写一样东西、连栏名都不写」。这叫省事写法，它**只认一个栏名：`value`**。

我们给纸条上那一栏起名叫「值」，照样只写一样东西试试 —— 编译器两条一起报：

```java
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;

public class Main {
    @Retention(RetentionPolicy.RUNTIME)
    @interface 纸条 {
        String 值();
    }

    static class 子对象 {
        @纸条("处理了")
        void 打招呼() {
        }
    }

    public static void main(String[] args) {
        System.out.println("字");
    }
}
```

```text
Main.java:11: error: cannot find symbol
symbol:   method value()
Main.java:11: error: annotation @纸条 is missing a default value for the element '值'
```

两句连起来就是它的心思：

- 第一句「**找不到叫 `value` 的东西**」—— 名字对不上，省事写法那一手就不成立了；
- 第二句「**`值` 这一栏没给东西**」—— 它把括号里那串字当成「连栏名都没写」，于是按「一样都没填」算；可 `值` 这栏又没留默认值（第七节说默认值），两头对不上，只好一起报出来。

修法两条，我们都验过，两条都立得住：栏名改回 `value`；或者**老老实实把栏名写上** —— `@纸条(值 = "处理了")`。后一条我们跑了一遍：

```java
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.reflect.Method;

public class Main {
    @Retention(RetentionPolicy.RUNTIME)
    @interface 纸条 {
        String 值();
    }

    static class 子对象 {
        @纸条(值 = "处理了")
        void 打招呼() {
        }
    }

    public static void main(String[] args) throws Exception {
        Method 一个方法 = 子对象.class.getDeclaredMethod("打招呼");
        纸条 小纸条 = 一个方法.getAnnotation(纸条.class);
        System.out.println("读出来了：" + 小纸条.值());
    }
}
```

```text
读出来了：处理了
```

## 七、纸条上能留好几栏，还能留默认值

一栏不够用的时候，纸条上可以留好几栏，**每栏后面能加一句 `default ...`**，意思是「贴的时候不写这栏，就当它是这个」：

```java
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.reflect.Method;

public class Main {
    @Retention(RetentionPolicy.RUNTIME)
    @interface 记录 {
        String 谁();
        int 根数() default 1;
    }

    static class 子对象 {
        @记录(谁 = "张三", 根数 = 3)
        void 加餐() {
        }

        @记录(谁 = "煤球")
        void 点心() {
        }
    }

    public static void main(String[] args) throws Exception {
        for (String 名字 : new String[]{"加餐", "点心"}) {
            Method 一个方法 = 子对象.class.getDeclaredMethod(名字);
            记录 小纸条 = 一个方法.getAnnotation(记录.class);
            System.out.println(名字 + "：" + 小纸条.谁() + " 给了 " + 小纸条.根数() + " 根");
        }
    }
}
```

```text
加餐：张三 给了 3 根
点心：煤球 给了 1 根
```

- **贴的时候栏名要写全**：`@记录(谁 = "张三", 根数 = 3)`。好几栏的时候没有省事写法可占，老老实实写名字最稳。
- **`点心` 那支没写 `根数`，读出来是 `1`** —— 那就是 `default 1` 顶上的。
- **读的时候是调用栏名**：`小纸条.谁()`、`小纸条.根数()`。写法跟叫方法一样，其实是**纸条在回答我们**。
- 栏上**既没写 `default`、贴的时候又没填**，编译器就不放行 —— 第六节第二句报的就是这个。

## 八、纸条贴哪儿，编译器会管：`@Target`

第五节那张纸条上还有一张说明书：`@Target(ElementType.METHOD)`，意思是「**这张纸条只许贴在方法上**」。我们偏要把它贴到类定义上试试：

```java
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

public class Main {
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.METHOD)
    @interface 纸条 {
        String value();
    }

    @纸条("处理了")
    static class 子对象 {
    }

    public static void main(String[] args) {
        System.out.println("字");
    }
}
```

```text
Main.java:13: error: annotation interface not applicable to this kind of declaration
```

原话的意思是「这张纸条**不适用于这种声明**」。想贴的地方不一样，说明书上写的名字就不一样：

| 想贴哪儿 | 说明书里写 |
| --- | --- |
| 方法上 | `ElementType.METHOD` |
| 骨头上 | `ElementType.FIELD` |
| 类定义本身上 | `ElementType.TYPE` |
| 产房上 | `ElementType.CONSTRUCTOR` |
| 传入的那样东西上 | `ElementType.PARAMETER` |

**这张说明书不写，纸条就哪儿都能贴。** 我们试过：不写 `@Target` 的纸条，贴到类定义上、贴到骨头上、贴到方法上，编译器全都放行。反过来，写了 `METHOD` 就只认方法 —— 贴错地方它当场拦，第八节第一段那段报错就是这么来的。

## 九、什么时候该贴纸条

回头看一眼这一课：纸条**从头到尾没有替我们干过一件事**。第二节能拦住错字，是**编译器**读了纸条在干活；第五节那张三行的表能印出来，是**我们自己写的绕圈**一个方法一个方法去问、再自己排排坐印出来的。

所以纸条的位置很清楚：

- **它是「留给别的对象看的话」，不是本事。** 想让它起点作用，得有人读 —— 要么是编译器（编译那一步，读错了当场拦），要么是我们自己用照 X 光那手读（跑起来之后，读到之后干什么自己写）。
- **该贴的地方，是「我们想让别人知道、但代码本身说不出来的事」。** 比如「这招是盖掉上一代那招的」（`@Override`）、「这招过时了」（`@Deprecated`）、「这张纸条留到跑的时候」（`@Retention`）。
- **不该拿它当注释用。** 纸条是给编译器和反射看的，不是给人看的；要给人留话，写给人看的注释就够了 —— 顺带说一句，注释里写错的东西没人拦你，纸条写错是要挨拦的，这恰恰是它的好处。

## 一句话小抄

| 我们想干什么 | 写法 |
| --- | --- |
| 画一张纸条 | `@interface 纸条 { String value(); }` |
| 纸条留到跑的时候 | `@Retention(RetentionPolicy.RUNTIME)` |
| 纸条只许贴方法 | `@Target(ElementType.METHOD)` |
| 贴纸条（省事写法，栏名得叫 `value`） | `@纸条("处理了")` |
| 贴纸条（栏名写全） | `@纸条(值 = "处理了")` |
| 这一栏不写就按这个算 | `int 根数() default 1;` |
| 问「贴了没」 | `一个方法.isAnnotationPresent(纸条.class)` |
| 把纸条读出来 | `一个方法.getAnnotation(纸条.class)` |
| 没贴纸条 | `getAnnotation(...)` 交回来的是 `null` |
| 编译器本来就认得的 | `@Override`、`@Deprecated` |

::: tip 提示

- **纸条自己不干活** —— 这是本课最要紧的一句。想让它起点作用，得有人读：要么是编译器在编译那一步读，要么是我们拿照 X 光那手读。
- **不写说明书，纸条就停在「翻完不带了」那一档**：编译的时候编译器看得见，跑起来照 X 光却是空的。
- **省事写法只认 `value` 这一个栏名**；栏名不叫这个，就老老实实把栏名写全。
- **问「贴了没」用 `isAnnotationPresent`，要读纸条上的字用 `getAnnotation`** —— 后者没贴的时候交回来的是 `null`。
- **该贴的地方**是「我们想让别人知道、可代码本身说不出来的事」；拿它当给人看的注释用，就贴错地方了。

:::

## 小任务

1. 给第四节那张纸条再添一栏（比如 `int 根数() default 1;`），贴的时候改成把栏名写全的写法，跑一遍看看读出来对不对。
2. 把第五节那段里 `@Retention(RetentionPolicy.RUNTIME)` 那一行删掉，再跑一遍 —— 表上三行变成什么样了？想想为什么。
3. 自己画一张「只许贴骨头」的纸条（`@Target(ElementType.FIELD)`），贴到 `子对象` 的一根骨头上，再用第五节那手照 X 光把它读出来。
