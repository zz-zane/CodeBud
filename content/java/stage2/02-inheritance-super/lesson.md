---
id: java-stage2-02
lang: java
stage: 2
order: 2
title: 继承与 super
tags: [面向对象, 继承]
required: ["java-stage2-01"]
crossRefs: []
compare: ["common-10"]
estMinutes: 25
keywords: [extends, super, override, instanceof]
---

## 学习目标

本课学习继承与 super。重点包括extends、super、方法重写、构造链。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、继承：一句话认亲

Java 里让一个类定义照着另一张画，靠的是 `extends` 这个小词：

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
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三");
        c.speak();
    }
}
```

```text
张三发出了一次叫
```

逐行看：

- **`class Animal { ... }`** —— 先画一张父类，上面画着**所有动物都有的那部分**：有名字这盒家当、有初始化那一手、有一个方法 `speak`。
- **`class Cat extends Animal { ... }`** —— **今天最要紧的一行**！类定义名后面多了 `extends`，后面跟着另一个类定义的名字，读作「**照 `Animal` 那张类定义，再画一张 `Cat` 类定义**」。这件事的正式名字叫**继承**。
- **`Cat(String name) { super(name); }`** —— 子类上写了自己的初始化那一手。**`super(name)` 就是「请上一层那张类定义，把它那版初始化那一手跑一遍」** —— 名字这盒家当是它赋值的。
- **`c.speak()`** —— 子类上**根本没写 `speak`**，可它照样调用得动！因为父类上有，**子类天生就会**。

套类定义最值钱的地方就在这儿：父类上的家当和方法，子类**一个字都不用重抄**。

### Java 的一条死规矩：一个类定义只能认一张大的

有件事要先说清楚：**`extends` 后面只能跟一个类定义的名字。** 想让 `Cat` 同时照 `Animal` 和 `Fish` 两张类定义画？编译器会直接拦下你。

这不是 Java 小气，是为了不让「同一个方法名在两张父类上各画了一版」这种糊涂账出现。真需要「认好几份本事」的时候，Java 另有一套办法，我们过两课就教你。

## 二、子类能把父类那一个方法盖掉

套来的方法有时不合心意：学生甲叫起来可不是「发出了一次叫」。那就**在子类上把这一个方法再写一遍**：

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

public class Main {
    public static void main(String[] args) {
        Animal a = new Animal("计算机");
        Cat c = new Cat("张三");
        a.speak();
        c.speak();
    }
}
```

```text
计算机发出了一次叫
张三：喵！
```

- 子类上又写了一遍 `void speak()`，**名字一模一样、传入的料一模一样、返回的东西也一样**。
- 这么一写，**子类这一版就把父类那一版盖住了**：凡是从 `Cat` 创建后的对象，调用 `speak` 走的都是子类这一版。
- 这个动作叫**重写（override）**：同一个方法名，在子类上重新画一遍，换成我们想要的样子。
- 注意父类**一点都没被改动**：`a` 是照着 `Animal` 直接生的，它调用 `speak` 还是那一次「发出了一次叫」。**盖住只盖住这一条往下的路**。
- **`@Override`** 是写给编译器看的一张小纸条，意思是「我们这一手，是**故意**要盖掉上面某一版的」。写错了名字（比如手滑写成 `speek`）它会当场翻脸告诉你「根本没有这一手可盖」—— 这张小纸条能替你挡掉一大半低级错，**每次盖掉父类某一版，都写上它**。

## 三、`super`：先请父类把活干一遍

有时候我们不是要「换掉」父类那一手，而是想「**在它干完之后再添一句**」。这时候用 `super` 点名请它出手：

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
        super.speak();
        System.out.println("……然后补了一次");
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
张三发出了一次叫
……然后补了一次
```

- **`super.speak();`** 读作「**请上一层那张类定义，把它那版 `speak` 跑一遍**」。它跑完，我们再接着添自己的那一句。
- `super` 这个小词要用在**方法里面**，它说的「上一层」永远是**我们现在站的这张类定义的上层**。

## 四、构造链：初始化那一刻，大的先收拾一遍

我们第一次写子类的时候，最想不通的就是：`Cat` 的初始化那一手里为什么要写 `super(name)`？不写会怎样？

答案是：**父类的初始化那一手，不会自己跑。**

```java
class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }
}

class Cat extends Animal {
    Cat(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三");
        System.out.println(c.name);
    }
}
```

```text
Main.java:10: error: constructor Animal in class Animal cannot be applied to given types;
    Cat(String name) {
                     ^
  required: String
  found:    no arguments
  reason: actual and formal argument lists differ in length
1 error
```

念起来是：**「你这张子类初始化的时候，`Animal` 那一手要一样东西（`required: String`），可你一样都没给它（`found: no arguments`）。」**

为什么编译器会这么算账？因为 Java 有一条暗规矩：

- 子类的初始化那一手，**第一句**如果不是 `super(...)`，编译器就**自动替你插一句 `super()`** —— 也就是「请父类的空手那一手」。
- 可父类上**只有** `Animal(String name)` 这一手，压根没有空手那一版 —— 插进去的那句当然对不上，于是当场翻脸。
- 所以正路只有一条：**子类自己写了初始化那一手，第一句就老老实实写 `super(...)`，把父类要的料传给它。**

上一课刚学的盖子在这儿也咬人：父类的初始化那一手才装得进名字这盒家当，子类只是**请它代劳**。

### 顺序：先请父类，再装自己的

子类想**多带一盒自己的家当**（比如数据数），只要在 `super(...)` 后面接着写：

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
    int fish;

    Cat(String name, int fish) {
        super(name);
        this.fish = fish;
    }

    @Override
    void speak() {
        System.out.println(name + "：我们有 " + fish + " 条数据");
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三", 3);
        c.speak();
    }
}
```

```text
张三：我们有 3 条数据
```

顺序很讲究：**先 `super(name)` 把父类那一份收拾好，再 `this.fish = fish` 装自己的那一份**。`super(...)` 必须是身子的**第一句** —— 父类还没收拾完，我们就不能先动别的。

这一串「先请谁、再请谁」，我们拆成一步一步走给你看 —— **顺序**就是这一节最要紧的地方：

```demo
title: 初始化那一刻：先请父类，再装自己那一份
code:
| class Animal {
|     String name;
|
|     Animal(String name) {
|         this.name = name;
|     }
| }
|
| class Cat extends Animal {
|     int fish;
|
|     Cat(String name, int fish) {
|         super(name);
|         this.fish = fish;
|     }
| }
|
| Cat c = new Cat("张三", 3);

step 子类一句话认亲
at: 9
say: class Cat extends Animal 是今天最要紧的一行：照着 Animal 那张类定义再画一张 Cat。子类里从此含着一整个 Animal 的部分（名字这盒家当就是它带来的），自己只多写了 int fish; 这一点。
meow: Cat 继承 Animal。
pose: expect
父类装好的 name = （还没有这一个）
子类装好的 fish = （还没有这一个）
现在跑的是哪一手 = （还没开始）

step new 一个对象，先引用的是子类那一手
at: 18
say: Cat c = new Cat("张三", 3); 引用的是子类的初始化那一手 Cat(String name, int fish)，两样料「张三」和「3」都交到它手上。
meow: new 调用 Cat 的构造方法。
pose: expect
父类装好的 name = （还没装）
子类装好的 fish = （还没装）
现在跑的是哪一手 = Cat 的初始化那一手

step 第一句就是 super(name)
at: 13
say: 我们在子类的初始化那一手里，第一句写的就是 super(name); —— 它不是方法名，是个小词，读作「请上一层那张类定义，把它那版初始化那一手跑一遍」。它必须是身子的第一句：父类那一份还没收拾完，我们就不能先动别的。
meow: super(name) 调用父类构造方法。
pose: busy
父类装好的 name = （还没装）
子类装好的 fish = （还没装）
现在跑的是哪一手 = 正要跳进父类

step 父类那一手接住了料
at: 4
say: 跳进来的这一手，就是父类上的 Animal(String name)。传给子类的那块料「张三」，顺着 super(name) 的手原样转给了它 —— 装名字这活儿从这儿起归父类干。
meow: 进入父类构造方法。
pose: busy
父类装好的 name = （还没装）
子类装好的 fish = （还没装）
现在跑的是哪一手 = Animal 的初始化那一手

step 父类把名字装好
at: 5
say: 父类那一版里跑的是 this.name = name;，把「张三」收进它自己那份家当。注意此刻子类自己那份 fish 还是空的 —— 父先子后，这会儿还没轮到小的。
meow: name 存入父类字段。
pose: yay
父类装好的 name = 张三
子类装好的 fish = （还没装）
现在跑的是哪一手 = Animal 的初始化那一手

step 父类收工，回到子类装自己那一份
at: 14
say: 父类那一手跑完，活儿才回到子类 super(name); 的下一句：this.fish = fish;，把 3 装进子类多出来的那份家当。两层的家当这下都齐了。
meow: 回到子类，设置 fish。
pose: yay
父类装好的 name = 张三
子类装好的 fish = 3
现在跑的是哪一手 = 回到子类这一手

step 两层都齐了，new 才把对象交出来
at: 18
say: 两层家当都装好，初始化这一手才算跑完 —— new 这一下收工，把这个对象交到我们手上。往后 c.speak() 印出来的「张三：我们有 3 条数据」里，名字是父类装的、数据数是子类装的。
meow: 构造完成，对象交给 c。
pose: proud
父类装好的 name = 张三
子类装好的 fish = 3
现在跑的是哪一手 = （初始化这一手跑完了）
```

**顺序颠不得**：`new` 子类上的对象 → 第一句 `super(...)` **先跳进父类** → 父类那一份装好 → 回到子类装自己那一份 → 两层齐了才交到我们手上。`super(...)` 要是不写在第一句，编译器当场就拦 —— 父类没收拾完，这一个就不算收拾好。

## 五、认亲：`instanceof`

套类定义是**从上往下认亲**的：照 `Cat` 生的对象，**也**是一个 `Animal`；可照 `Animal` 直接生的动物，**不是** `Cat`。

```java
class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }
}

class Cat extends Animal {
    Cat(String name) {
        super(name);
    }
}

public class Main {
    public static void main(String[] args) {
        Animal a = new Animal("计算机");
        Cat c = new Cat("张三");
        System.out.println(c instanceof Animal);
        System.out.println(a instanceof Cat);
    }
}
```

```text
true
false
```

`c instanceof Animal` 读作「**`c` 是不是照 `Animal` 这张类定义（或者它的下游类定义）创建后的**」。`c` 是照 `Cat` 生的，而 `Cat` 是套在 `Animal` 上画的，所以**也是**一个 `Animal`；反过来就不成立：`a` 直接照父类生的，它不是 `Cat`，所以是 `false` 。

## 六、盖了盖子的家当，子类也伸不进手

上一课刚学会给家当扣盖子。要是父类把名字盖上了，子类伸得进手吗？

```java
class Animal {
    private String name;

    Animal(String name) {
        this.name = name;
    }
}

class Cat extends Animal {
    Cat(String name) {
        super(name);
        System.out.println(this.name);
    }
}

public class Main {
    public static void main(String[] args) {
        Cat c = new Cat("张三");
    }
}
```

```text
Main.java:12: error: name has private access in Animal
        System.out.println(this.name);
                               ^
1 error
```

**伸不进。** 盖子认的是「**哪张类定义写的方法**」，不是「谁跟谁认了亲」：`name` 是 `Animal` 扣上的，`Cat` 的方法照样在门外。想读？走父类留的那扇小窗 —— `getName()` 。

::: tip 提示

1. **`class Cat extends Animal`** —— 子类照着父类画；父类上的家当和方法，子类天生就会，**一个字都不用重抄**。
2. **一个类定义只能认一张大的**（`extends` 后面只跟一个名字）。
3. **重写** = 在子类上把同一个方法再画一遍，把上面那版盖住；**每次都写上 `@Override`**，那是给你自己上的保险。
4. **`super.speak()`** = 请上一层把它那版跑一遍，跑完我们再接着添。
5. **`super(...)` 必须是初始化那一手的第一句** —— 而且**非写不可**（除非父类上真有空手那一版）。
6. **认亲从上往下**：照 `Cat` 生的也是 `Animal`，反过来不成立，拿 `instanceof` 问一句就知道。
:::

::: warn 注意

- **父类的初始化那一手不会自己跑。** 子类只要自己写了初始化那一手，就必须**第一句** `super(...)` 把料喂过去，否则撞 `constructor ... cannot be applied to given types`。
- **盖着盖子的家当，子类也碰不得** —— 认亲不等于拿到钥匙，`private` 的家当要靠父类留的小窗读。
- **盖掉父类那一版，不是改父类本身。** 照父类直接生的那些动物，调用那一个方法还是老样子；子类改的只是**自己这条往下的路**。
- **`super` 不是方法名**，它是个小词：`super(name)` 请初始化那一手，`super.speak()` 请某一个方法，别写成 `super().speak()` 。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `class Cat extends Animal { ... }` | 照着 `Animal` 那张父类，再画一张 `Cat` 子类 |
| `Cat(String name) { super(name); }` | 子类的初始化那一手，第一句就请父类把它那版跑一遍 |
| `@Override` | 给编译器的小纸条：我们这一手是故意要盖掉上面那版的 |
| `super.speak();` | 请上一层把它那版 `speak` 跑一遍 |
| `c instanceof Animal` | 认亲：`c` 是不是照这张类定义（或它的下游）创建后的 |
| `a instanceof Cat` | 反过来就不成立 —— 认亲只从上往下 |
| `this.name`（在子类里，父类写着 `private`） | 伸不进去 → `name has private access in Animal` |
| 一个类定义只认一张大的 | `extends` 后面只能跟一个名字 |

## 小任务

1. 照第二节那样，给父类再画两张子类：`Dog`（叫起来是「汪！」）和 `Fish`（叫起来是「咕噜」），各创建一个，看看父类那一段有没有被改动过。
2. 把 `Cat` 的初始化那一手里的 `super(name);` **删掉**，编译一次，把编译器的原话抄进记录表 —— 再想想它为什么说 `found: no arguments`。
3. 给 `Cat` 加一个方法 `void sleep()`，然后写一句 `new Cat("张三").sleep()` 试试；再想想：`new Animal("计算机").sleep()` 调用不调用得动？为什么？
4. 把父类的 `String name;` 改成 `private String name;`，然后在 `Cat` 的方法里伸手拿它 —— 编译一次，看看原话是什么；再把伸手改成走小窗，看看是不是就通了。
5. 想一想：如果我们想写一句能装下「对象、狗、计算机」的名称，那句子的**类定义名**该写 `Animal` 还是 `Cat`？（下一课揭晓）

下一课，我们要讲一件更妙的事：写代码的时候**根本不用知道**手里这个到底是对象还是狗，一句「处理完成」输出，是对象就、是狗就汪 —— 一句顶一组。顺便还要认识一种「只画了一半的类定义」 
