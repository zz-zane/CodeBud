---
id: java-stage2-03
lang: java
stage: 2
order: 3
title: 多态与抽象类
tags: [面向对象, 多态]
required: ["java-stage2-02"]
crossRefs: []
estMinutes: 25
keywords: [polymorphism, abstract, override, instanceof]
---

## 学习目标

本课学习多态与抽象类。重点包括多态概念、向上转型、抽象类、abstract。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、一句话输出，各对象各样

看 Java 给的答案：

```java
class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }

    void speak() {
        System.out.println(name + "：……");
    }
}

class Cat extends Animal {
    Cat(String name) {
        super(name);
    }

    @Override
    void speak() {
        System.out.println(name + "：喵！");
    }
}

class Dog extends Animal {
    Dog(String name) {
        super(name);
    }

    @Override
    void speak() {
        System.out.println(name + "：汪！");
    }
}

public class Main {
    public static void main(String[] args) {
        Animal[] pets = { new Cat("张三"), new Dog("大黄"), new Cat("李四") };
        for (Animal pet : pets) {
            pet.speak();
        }
    }
}
```

```text
张三：喵！
大黄：汪！
李四：喵！
```

盯着中间那三行看：我们**只写了一句 `pet.speak();`**，写的时候压根不知道 `pet` 会是谁 —— 是对象就、是狗就汪，**同一句话，各对象各样**。这件事的正式名字叫**多态调用（多态）**。

它的道理其实很简单：

- `pet` 这块名称底下，**保存的是一个实例**（照哪张类定义生的，它自己知道）。
- 调用 `pet.speak()` 的时候，Java 是**照着那个实例自己的类定义**去找这一个方法的 —— 不是照着 `Animal` 那张父类找，也不是照着我们写代码时脑子里想的那张找。
- 所以我们只管写「调用 `speak`」，**具体还是汪，交给那个会自己决定**。

这份省心，正是套类定义最值钱的地方：**我们加的宠物越多，那个 `for` 一个字都不用改**。往后你添一个鸭子，只要它照着 `Animal` 画、自己重写一版 `speak`，上面那三行照样不用动。

那三行里最要紧的就是 `pet.speak();` 这一句 —— 它凭什么「各对象各样」？我们把三轮拆开，走给你看：

```demo
title: 同一句 pet.speak()，三轮怎么挑出三版
code:
| Animal[] pets = { new Cat("张三"), new Dog("大黄"), new Cat("李四") };
| for (Animal pet : pets) {
|     pet.speak();
| }

step 三个真身，全装进写 Animal 的名称
at: 1
say: 左边写的是 Animal，右边 new 出来的却是对象和狗 —— 这一行通得过，因为照 Cat 生的本来就也是一个 Animal（上一课学的认亲）。
meow: 父类数组可以放子类对象。
pose: expect
名称上的类定义名 = Animal
名称底下那个 = （还没领出来）
跑的是哪一版 = （还没调用）

step 第 1 步
at: 2
say: for 每一圈从这一排里领一个，装进名称 pet。名称上的类定义名一直是 Animal，可名称底下换人了 —— 这一圈领到的是张三。
meow: pet 的声明类型是 Animal。
pose: expect
名称上的类定义名 = Animal
名称底下那个 = 张三（照 Cat 生的）
跑的是哪一版 = （还没调用）

step 编译时：先看名称
at: 3
say: 我们写下 pet.speak(); 这一行的时候，Java 只查一件事：Animal 这块名称上有没有 speak。有 —— 这一行过得去。至于跑哪一版，这一眼还管不着。
meow: 编译时检查 Animal 有 speak。
pose: think
名称上的类定义名 = Animal
名称底下那个 = 张三（照 Cat 生的）
跑的是哪一版 = 编译这一关过了

step 运行时：看真身挑版本
at: 3
say: 真输出的那一瞬，看的是名称底下那个的真身 —— 张三的真身是 Cat，就跑 Cat 重写过的那版 speak：喵！。
meow: 运行时按实际类型调用 Cat 版本。
pose: yay
名称上的类定义名 = Animal
名称底下那个 = 张三（照 Cat 生的）
跑的是哪一版 = Cat 那版（）

step 第 2 步
at: 2
say: 绕回 for 这一行领下一位：这回名称底下是大黄 —— 名称还是那块写 Animal 的，真身换成了狗。
meow: 下一个对象是 Dog。
pose: expect
名称上的类定义名 = Animal
名称底下那个 = 大黄（照 Dog 生的）
跑的是哪一版 = （上一版印完了）

step 同一行字，这回挑狗那版
at: 3
say: 还是 pet.speak(); 这一行，一个字都没改 —— 可真身是狗，挑中的就是 Dog 那一版：汪！同一句调用，跑哪一版全看真身。
meow: 同一行调用 Dog 版本。
pose: yay
名称上的类定义名 = Animal
名称底下那个 = 大黄（照 Dog 生的）
跑的是哪一版 = Dog 那版（汪！）

step 第 3 步
at: 2
say: 再领一个：李四。名称依旧，真身又换回了对象。
meow: 下一个对象是 Cat。
pose: expect
名称上的类定义名 = Animal
名称底下那个 = 李四（照 Cat 生的）
跑的是哪一版 = （上一版印完了）

step 又挑回对象那版
at: 3
say: 第三声还是同一行字，真身是对象，挑中的又变回 Cat 那一版：喵！。屏幕上三行正好是：喵！、汪！、喵！。
meow: 又调用 Cat 版本。
pose: yay
名称上的类定义名 = Animal
名称底下那个 = 李四（照 Cat 生的）
跑的是哪一版 = Cat 那版（）

step 排尾了：圈停
at: 2
say: 第 4 次绕回 for，这一排里一个都不剩了，圈就停了。三个都按自己的真身出过声，而 for 那一行、pet.speak(); 那一行，一个字都没改。
meow: 数组遍历结束。
pose: proud
名称上的类定义名 = Animal
名称底下那个 = （排空了）
跑的是哪一版 = 对象、狗汪，各是各的
```

**这两眼看清楚就不会再绕晕**：**编译时认的是名称上写的类定义名**（它管着你调用得动哪些方法），**运行时认的是名称底下那个的真身**（它管着跑哪一版）。`pet` 每一圈换一个真身，同一行字就挑出不同的版本 —— 写这一行的人压根不用知道它是谁。

## 二、名称上的类定义名，可以和实例不一样

第一节里有个细节我们故意没说破：`Animal[] pets` 那一排名称上写的是 **`Animal`**，可赋值的明明是对象和狗。这就是 Java 里最要紧的一步操作 —— **向上转型**：

```java
class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }

    void speak() {
        System.out.println(name + "发出了一次叫");
    }
}

class Cat extends Animal {
    Cat(String name) {
        super(name);
    }

    @Override
    void speak() {
        System.out.println(name + "：喵！");
    }
}

class Dog extends Animal {
    Dog(String name) {
        super(name);
    }

    @Override
    void speak() {
        System.out.println(name + "：汪！");
    }
}

public class Main {
    public static void main(String[] args) {
        Animal a = new Cat("张三");
        Animal b = new Dog("大黄");
        a.speak();
        b.speak();
    }
}
```

```text
张三：喵！
大黄：汪！
```

**`Animal a = new Cat("张三");`** 这一句，左边名称写 `Animal`、右边生的却是 `Cat` —— 竟然通得过！道理是上一课学的认亲：**照 `Cat` 生的对象，本来也是一个 `Animal`**。名称要的是「动物」，你给了一个对象，比它要的还具体，当然收下。

这一手的好处立刻显现：**一块写 `Animal` 的名称，能装下任何照 `Animal` 画出来的实例**。写这个 `for` 的人不需要知道院子里养了什么，只管调用 `speak`。

### 但名称上的名字，管着你能调用哪些方法

Java 是**认字**的：我们在代码里调用得出哪些方法，**是照着名称上写的类定义名查的**。名称写 `Animal`，就只调用得动 `Animal` 上也画着的方法：

```java
class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }

    void speak() {
        System.out.println(name + "发出了一次叫");
    }
}

class Cat extends Animal {
    Cat(String name) {
        super(name);
    }

    void sleep() {
        System.out.println(name + "睡着了");
    }
}

public class Main {
    public static void main(String[] args) {
        Animal a = new Cat("张三");
        a.sleep();
    }
}
```

```text
Main.java:26: error: cannot find symbol
        a.sleep();
         ^
  symbol:   method sleep()
  location: variable a of type Animal
1 error
```

念起来是：**「`a` 这块名称写的是 `Animal`，我们翻遍了这张类定义，没找到叫 `sleep` 的方法。」**

注意底下那三行是它给的线索：`symbol: method sleep()` 是「你在找的方法名」，`location: variable a of type Animal` 是「你是在哪块名称上找的」。这一句错话我们见过太多次了，学会读它，能省下半小时抓头的时间。

想调用 `sleep` 也不是没办法：先用 `instanceof` 问一句「你是不是对象」，确认之后再换一块 `Cat` 的名称（这叫**向下转型**），就能调用了：

```java
if (a instanceof Cat) {
    Cat c = (Cat) a;
    c.sleep();
}
```

## 三、只画了一半的类定义

回到院子里那窝宠物。我们想让父类立个规矩：**凡是动物，都必须会出个声** —— 但「出声」这件事本身，我们写不出一个统一的样子（对象狗汪，各有各的），只能空着，让每张子类自己去补。

Java 给这件事留了一手：

```java
abstract class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }

    abstract void speak();
}

class Cat extends Animal {
    Cat(String name) {
        super(name);
    }

    @Override
    void speak() {
        System.out.println(name + "：喵！");
    }
}

public class Main {
    public static void main(String[] args) {
        Animal a = new Cat("张三");
        a.speak();
    }
}
```

```text
张三：喵！
```

这一手的正式名字叫**只画了一半的类定义（抽象类）**，样子只有两处跟平时不一样：

- **类定义头上多一个 `abstract`**：`abstract class Animal` —— 明明白白告诉编译器「这张类定义**不许直接拿来生实例**」。
- **那一个方法只有个头、没有身子**：`abstract void speak();` —— 后面**没有一对花括号**，直接一个分号收尾。意思就是「这一个方法**必须**有，但怎么写，留给往下画的子类自己定」。

规矩很硬气：**凡是从这张类定义往下画的，都得把这一个方法补上**；补不上，编译器当场翻脸（下一节撞给你看）。

## 四、半张类定义不许直接创建对象

我们试过直接照着半张类定义创建一个：

```java
abstract class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }

    abstract void speak();
}

public class Main {
    public static void main(String[] args) {
        Animal a = new Animal("计算机");
        a.speak();
    }
}
```

```text
Main.java:13: error: Animal is abstract; cannot be instantiated
        Animal a = new Animal("计算机");
                   ^
1 error
```

念起来是：**「`Animal` 是张只画了一半的类定义，不能拿来生实例。」**

这一条其实很合理：「出声」这一个方法**还没写呢**，现在创建后的对象，称呼它出声的时候该干什么？编译器宁可不让你生，也不想让一个「不知道该干什么」的对象跑到你的院子里。

## 五、子类没交那半张，也生不出来

那我们照规矩画一张子类，可偏偏忘了补上那一个方法：

```java
abstract class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }

    abstract void speak();
}

class Cat extends Animal {
    Cat(String name) {
        super(name);
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三");
        c.speak();
    }
}
```

```text
Main.java:11: error: Cat is not abstract and does not override abstract method speak() in Animal
class Cat extends Animal {
^
1 error
```

念起来是：**「`Cat` 自己没写 `speak`，又不肯当半张类定义 —— 那它到底会不会出声？」**

编译器给了两条路，我们必须二选一：

1. **补上那一个方法**（大多数时候选这条）—— 在子类里写一版 `speak`，就完事了。
2. **自己也在头上写 `abstract`** —— 意思是「我们这张也是半张，接着往下传」。可这样一路传下去，总得有一个类定义把话说完 —— 不然永远生不出实例。

## 六、半张类定义上，也能有画完的方法

`abstract` 管的**只是那些没写完的方法**，别的一概照旧：家当、初始化那一手、画完了的方法，全都能照常写在上面。

```java
abstract class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }

    abstract void speak();

    void sleep() {
        System.out.println(name + "睡着了，输出输出");
    }
}

class Cat extends Animal {
    Cat(String name) {
        super(name);
    }

    @Override
    void speak() {
        System.out.println(name + "：喵！");
    }
}

public class Main {
    public static void main(String[] args) {
        Animal[] pets = { new Cat("张三") };
        for (Animal pet : pets) {
            pet.speak();
            pet.sleep();
        }
    }
}
```

```text
张三：喵！
张三睡着了，输出输出
```

`speak` 是子类补的，`sleep` 是父类上就画好了的 —— 一块名称调用两招，都走得通。

::: tip 提示

1. **名称上的类定义名管着你调用哪些方法**：写 `Animal` 就只调用得动 `Animal` 上有的；要调用子类新加的，先 `instanceof` 问一句、再换名称。
2. **向上转型随时可以**：照 `Cat` 生的对象本来就是 `Animal`，装进 `Animal` 的名称天经地义。
3. **`abstract` 写头上** = 这张类定义不许直接创建对象；**`abstract` 写方法上** = 这一个方法只有个头，谁往下画谁补。
4. **补不上就翻脸**：子类要么把那一个方法写出来，要么自己也在头上写 `abstract`。
5. **具体干什么活，由实例的类定义说了算** —— 这就是「一句话输出，各对象各样」的全部秘密。
:::

::: warn 注意

- **半张类定义不能 `new`** —— 撞的是 `Animal is abstract; cannot be instantiated`，别以为是构造方法写错了。
- **方法只有个头时，后面一个花括号都不能有**：`abstract void speak();` 是分号收尾。写成 `abstract void speak() { }`，编译器**当场就拦**，原话是 `abstract methods cannot have a body`（「只有个头的方法不许带身子」），`javac` 一行程序都不给你生成 —— 我们真跑过，连 `.class` 都是零个。
- **`cannot find symbol` 先看最后一行**：`location: variable a of type ...` 会告诉你我们是在哪块名称上找的 —— 十有八九是名称的类定义名写小了。
- **`@Override` 照旧要写**。补那一个方法的时候写错名字，编译器只会说「你又画了一个方法新的」，而真正该有的那一个方法**还是空着**，报出来的原话会指向别处，绕一大圈才找得到。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `Animal[] pets = { new Cat("张三"), new Dog("大黄") };` | 一排写 `Animal` 的名称，装下照它画出来的各种实例 |
| `pet.speak();` | 是对象就、是狗就汪 —— 写的人不用管它是谁 |
| `Animal a = new Cat("张三");` | 向上转型：对象本来就是动物，收得下 |
| `a.sleep();`（`sleep` 只有子类才有） | 调用不动 → `cannot find symbol` |
| `abstract class Animal { ... }` | 只画了一半的类定义，不许直接拿来生实例 |
| `abstract void speak();` | 这一个方法只有个头、没有身子，谁往下画谁补 |
| 子类没补那一个方法 | `Cat is not abstract and does not override abstract method speak() in Animal` |
| `new Animal("计算机")`（半张类定义） | `Animal is abstract; cannot be instantiated` |
| `a instanceof Cat` 之后再 `(Cat) a` | 先认亲、再换名称，才调用得动子类新加的方法 |

## 小任务

1. 照第一节那样，再画一张子类 `Fish`（出个声是「咕噜」），往那排宠物里加一个 —— 试试那个 `for` 要不要动（答案是：一个字都不用改）。
2. 把第二节最后那段 `if` 抄进练习场，先跑一遍 `a.sleep();` 记下原话，再补上 `instanceof` 和换名称那两句，让它真的调用出声。
3. 给半张类定义再添一个方法没写完的 `abstract void play();`，然后**只补 `speak` 不补 `play`**，编译一次，看看原话里点名的是哪一个方法。
4. 把父类头上的 `abstract` 拿掉（方法那一行的 `abstract` 留着），编译一次，把原话抄下来 —— 想想编译器为什么不许你这么做。
5. 想一想：我们要是想立一条规矩，说「会出声的不一定都是动物，机器人也会出声」，那该怎么办？（下一课揭晓）

下一课，我们要认识一张**立规矩的清单**：它不画家当、不管初始化，只写「凡是认下这份约定的，必须会这几手」。有了它，一个完全不是动物的机器人，也能和对象站进同一排名称里 
