---
id: common-30
lang: common
stage: 0
order: 27
title: 引用语义与内存关系
tags: [面向对象, 引用]
required: ["common-29"]
crossRefs: ["cpp-stage2-08","java-stage1-13","python-stage2-08"]
estMinutes: 18
keywords: [reference, value-semantics, null, copy]
---

## 学习目标

本课学习引用语义与内存关系。重点包括名称、引用与对象、C 的值复制与指针、跨语言赋值语义、两个引用共享一个对象、空引用与成员访问。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```java
Cat c1 = new Cat();
c1.fish = 3;
```

```java
Cat c2 = c1;
```

## 名称、引用与对象

对象是具有类型和状态的实体；名称或引用用于访问对象。多个名称可以关联同一个对象。应区分重新赋值一个名称与通过引用修改对象状态：前者改变关联，后者改变被引用对象。

```text
   我们手边的名册                对象屋（实例住的地方）
   ─────────────────────        ──────────────────────
   c1 的格子：一支引用 ──▶   张三：名字「张三」、数据 3 条
```

下面是另一段示例或诊断对照。

```text
   图一：两个名字，一个对象
   c1 的格子：一支引用 ─┐
                          ├──▶ 张三（数据 3 条）
   c2 的格子：一支引用 ─┘

   图二：两个对象，各管各的
   c1 的格子：一支引用 ──▶ 张三（数据 3 条）
   c3 的格子：一支引用 ──▶ 李四（数据 1 条）
```

## C 的值复制与指针

C 的标量和结构体赋值复制相应的值；结构体中的指针字段复制的是地址，不会自动复制其指向的数据。需要共享对象时可传递地址，需要独立对象时应明确复制范围和资源所有权。

```c
typedef struct {
    int fish;
} Cat;

Cat c1;
Cat c2;
Cat *p;

c1.fish = 3;
c2 = c1;          /* 值复制：对象屋里多出第二只，往后改 c2 不动 c1 */
p = &c1;          /* 想共享：没有捷径，自己递一张指针 */
p->fish = 88;     /* 顺着名称改 —— 改的是 c1 那一个对象本体 */
```

## 跨语言赋值语义

相同外观的 `c2 = c1` 在不同类型和语言中可能具有不同语义。C/C++ 对象值赋值通常按该类型的赋值规则执行；Java 引用赋值和 Python 名称绑定通常让两者关联同一对象。不要仅凭变量名或语句外观判断是否产生独立对象。

```c
#include <stdio.h>

typedef struct {
    int fish;
} Cat;

int main(void) {
    Cat c1;
    Cat c2;
    c1.fish = 3;
    c2 = c1;              /* 值复制：c2 是第二个对象 */
    c2.fish = 99;
    printf("c1 有 %d 条\n", c1.fish);
    printf("c2 有 %d 条\n", c2.fish);
    return 0;
}
```

```text
c1 有 3 条
c2 有 99 条
```

```cpp
#include <iostream>
using namespace std;

class Cat {
public:
    int fish;
};

int main() {
    Cat c1;
    c1.fish = 3;
    Cat c2 = c1;          // 默认值复制（值语义）
    c2.fish = 99;
    cout << "c1 有 " << c1.fish << " 条" << endl;
    cout << "c2 有 " << c2.fish << " 条" << endl;
    return 0;
}
```

```text
c1 有 3 条
c2 有 99 条
```

```java
public class Main {
    static class Cat {
        int fish;
    }

    public static void main(String[] args) {
        Cat c1 = new Cat();
        c1.fish = 3;
        Cat c2 = c1;      // 抄的是一支引用
        c2.fish = 99;
        System.out.println("c1 有 " + c1.fish + " 条");
        System.out.println("c2 有 " + c2.fish + " 条");
    }
}
```

```text
c1 有 99 条
c2 有 99 条
```

```python
class Cat:
    def __init__(self, fish):
        self.fish = fish

c1 = Cat(3)
c2 = c1               # 两个名字，贴同一个对象
c2.fish = 99
print(f"c1 有 {c1.fish} 条")
print(f"c2 有 {c2.fish} 条")
```

```text
c1 有 99 条
c2 有 99 条
```

## 两个引用共享一个对象

沿示例逐步记录两个引用与对象的关系。通过一个引用修改共享对象的字段，另一个引用可以观察到变化；让其中一个引用改为关联其他对象，并不会自动重绑定另一个引用。

```compare
c::
#include <stdio.h>

typedef struct {
    int fish;
} Cat;

int main(void) {
    Cat c1;
    Cat *c2;              /* 想共享：亲手递一张指针 */
    c1.fish = 3;
    c2 = &c1;
    c2->fish = 99;
    printf("顺着 c1 看：%d 条\n", c1.fish);
    printf("顺着 c2 看：%d 条\n", c2->fish);
    return 0;
}

cpp::
#include <iostream>
using namespace std;

class Cat {
public:
    int fish;
};

int main() {
    Cat c1;
    c1.fish = 3;
    Cat& c2 = c1;         // 明写「同一个的第二个名字」：别名
    c2.fish = 99;
    cout << "顺着 c1 看：" << c1.fish << " 条" << endl;
    cout << "顺着 c2 看：" << c2.fish << " 条" << endl;
    return 0;
}

java::
public class Main {
    static class Cat {
        int fish;
    }

    public static void main(String[] args) {
        Cat c1 = new Cat();
        c1.fish = 3;
        Cat c2 = c1;      // 抄的是一支引用：两个名字，一个对象
        c2.fish = 99;
        System.out.println("顺着 c1 看：" + c1.fish + " 条");
        System.out.println("顺着 c2 看：" + c2.fish + " 条");
    }
}

python::
class Cat:
    def __init__(self, fish):
        self.fish = fish

c1 = Cat(3)
c2 = c1               # 两个名字，贴同一个对象
c2.fish = 99
print(f"顺着 c1 看：{c1.fish} 条")
print(f"顺着 c2 看：{c2.fish} 条")
```

```text
顺着 c1 看：99 条
顺着 c2 看：99 条
```

下面是另一段示例或诊断对照。

```demo
title: 引用复制还是请新对象：一张内存图走到底
code:
| class Cat:
|     def __init__(self, name, fish):
|         self.name = name
|         self.fish = fish
| c1 = Cat("张三", 3)
| c2 = c1
| c2.fish = 99
| print(f"c1 这份看到 {c1.fish} 条")
| print(f"c2 这份看到 {c2.fish} 条")
| c3 = Cat("李四", 1)
| c3.fish = 5
| print(f"c1 还是 {c1.fish} 条")

step 类定义摊开：每个对象都有名字和数据数
at: 1
say: `class Cat:` 画的是**类定义**，不是对象 —— 这一步连一支引用都还没发出去。类定义上写着：照它创建后的每一位都有名字、有数据数（第 3、4 行是初始化那一刻装好的样子）。
meow: 类定义好了，对象还没创建。
pose: expect
对象屋里的实例 = 0 只
c1 的引用 = （还没生）
c2 的引用 = （还没生）
标准输出 = 还没印

step 第一个实例出世：c1 领到引用
at: 5
say: `c1 = Cat("张三", 3)` —— 右边先造出一台**新对象**（名字叫张三、数据 3 条），然后把一支**对着它的引用**装进名册上 `c1` 这一格。这一格从头到尾装的都不是对象，是引用。
meow: 对象创建好，c1 持有它的引用。
pose: expect
对象屋里的实例 = 1 只（张三，数据 3 条）
c1 的引用 = 对着张三
c2 的引用 = （还没生）
标准输出 = 还没印

step `c2 = c1`：抄的是一支引用
at: 6
say: 关键一步来了。`c2 = c1;` 右边那个 `c1` **不是对象**，是一支引用 —— 所以这一句干的事是「照着这支引用，再造一支一模一样的」。**对象屋里一个都没多**：张三还是那一个，只是名册上又多了一支对着它的引用。
meow: 对象还是一个，引用多了一个。
pose: busy
对象屋里的实例 = 1 只（张三，数据 3 条）
c1 的引用 = 对着张三
c2 的引用 = 对着张三（同一个！）
标准输出 = 还没印

step `c2.fish = 99`：顺着引用走进对象屋
at: 7
say: `c2.fish = 99` 不是把引用改掉，是**顺着 c2 这支引用走到对象屋**，把里面那个张三的数据数从 3 改成 99。这一刻 c1 手里那支引用**一个字没动** —— 可它对着的，恰恰就是这个刚被改过的张三。
meow: 引用没变，对象里的值变了。
pose: busy
对象屋里的实例 = 1 只（张三，数据 99 条）
c1 的引用 = 对着张三
c2 的引用 = 对着张三（同一个！）
标准输出 = 还没印

step 印 c1：写 c2 改的，c1 也变 99
at: 8
say: 屏幕这一行的答案就是案发真相：`c1.fish` 印出来 **99**。我们写的是 c2，变的是 c1 —— 因为两支引用对着**同一台对象**，谁伸手改的都是它。
meow: c1 看到的也是 99。
pose: think
对象屋里的实例 = 1 只（张三，数据 99 条）
c1 的引用 = 对着张三
c2 的引用 = 对着张三（同一个！）
标准输出 = c1 这份看到 99 条

step 印 c2：当然也是 99
at: 9
say: `c2.fish` 印出来也是 **99** —— 两支引用报的是同一个对象。到这里「两个名字一个对象」这张图就画完了：名册两格，对象屋一个。
meow: 两个引用指向同一个对象。
pose: busy
对象屋里的实例 = 1 只（张三，数据 99 条）
c1 的引用 = 对着张三
c2 的引用 = 对着张三（同一个！）
标准输出 = 2 行：99 条、99 条

step 再请一个新对象：这回走的是「另造」
at: 10
say: `c3 = Cat("李四", 1)` 右边带上了 `Cat(...)` —— 这是**请一个新对象**的口令：对象屋里又多了一台对象（李四），c3 拿到的是**对着新对象的新引用**。跟第 6 行那句一对照就明白：**带不带 `Cat(...)`，就是生不生新对象的分水岭**。
meow: 这回创建了新对象。
pose: expect
对象屋里的实例 = 2 只（张三 99 条 / 李四 1 条）
c1 的引用 = 对着张三
c2 的引用 = 对着张三（同一个！）
c3 的引用 = 对着李四（新的一个）
标准输出 = 2 行：99 条、99 条

step 改 c3：只动李四，张三纹丝不动
at: 11
say: `c3.fish = 5` 顺着 c3 的引用改的是**李四**。张三那边一根毛都没被碰到 —— 这就是「两个对象各管各」那张图：两支引用，两台对象，改谁就动谁。
meow: 各改各的，互不影响。
pose: busy
对象屋里的实例 = 2 只（张三 99 条 / 李四 5 条）
c1 的引用 = 对着张三
c2 的引用 = 对着张三（同一个！）
c3 的引用 = 对着李四（新的一个）
标准输出 = 2 行：99 条、99 条

step 收工印 c1：还是 99
at: 12
say: 最后一行印 `c1.fish`，出来 **99** —— 跟第 11 行改的 5 一点关系没有。两张内存图这下都亲手走过了：**引用复制 → 共用一个；带 `Cat(...)` 另造 → 各管各的**。
meow: c1 还是 99，两张内存图都走完了。
pose: proud
对象屋里的实例 = 2 只（张三 99 条 / 李四 5 条）
c1 的引用 = 对着张三
c2 的引用 = 对着张三（同一个！）
c3 的引用 = 对着李四（新的一个）
标准输出 = 3 行：99 条 / 99 条 / 99 条
```

## 空引用与成员访问

null 或 None 表示没有相应对象引用或使用特定空值。对其执行不允许的成员访问会触发相应语言的错误。使用前按类型和业务约束检查空值，不把检查失败解释成对象已存在。

```java
Cat c2 = null;
c2.fish = 99;     // 啪 —— 当场崩
```

## 相等、身份与复制深度

对象身份与内容相等是两个概念。Java 引用的 `==` 比较身份，内容比较通常调用合适的 equals；Python 的 is 比较身份，== 由类型定义相等语义。浅拷贝可能共享内部引用，深拷贝则需要明确递归复制与共享资源的策略。



## 语义对照

名称不是对象本身，引用复制不等于对象复制。判断赋值后的关系时，先确定语言和类型，再画出引用与对象关系，并区分对象状态变化和引用重新赋值。



## 练习

建立两个引用关联同一对象，修改字段后观察两处读取值。再重绑定其中一个引用，说明为什么另一个引用没有随之改变。
