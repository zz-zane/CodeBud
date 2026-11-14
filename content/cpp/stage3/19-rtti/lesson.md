---
id: cpp-stage3-19
lang: cpp
stage: 3
order: 22
title: RTTI 与类型转换
tags: ["多态","类型转换"]
required: ["cpp-stage3-18"]
crossRefs: ["cpp-stage2-10","cpp-stage3-18"]
estMinutes: 25
keywords: [RTTI, dynamic_cast, typeid, static_cast, bad_cast]
---

## 学习目标

本课学习RTTI 与类型转换。重点包括静态与动态类型、dynamic_cast、typeid 与 RTTI、四类型型转换对照、该用哪一个。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

## 一、名称上写一栏，屋里住的另一位

先把那一课那套摆出来，看一件很要紧的事：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
public:
    Cat(const string& n) : name(n) {}
    virtual ~Cat() {}
    virtual void speak() const {
        cout << name << "：" << endl;
    }
};

class OrangeCat : public Cat {
public:
    OrangeCat(const string& n) : Cat(n) {}
    void speak() const override {
        cout << name << "：我们是学生甲，！" << endl;
    }
};

class TabbyCat : public Cat {
public:
    TabbyCat(const string& n) : Cat(n) {}
    void speak() const override {
        cout << name << "：我们是学生乙，呜" << endl;
    }
};

int main() {
    OrangeCat o("张三");
    TabbyCat t("李四");
    Cat* p = &o;
    p->speak();
    p = &t;
    p->speak();
    return 0;
}
```

```text
张三：我们是学生甲，！
李四：我们是学生乙，呜
```

两行都对 —— 挂了招牌的那一手会低头看屋里住的是谁，所以输出的台词各不相同。**可这个是「它做了自己那件事」**，不是「我们问出了它是谁」。

看 `p` 这张名称：从头到尾写的都是 `Cat`。这两行输出能印出来，靠的是**屋里那一位自己**会做这件事；名称上仍然只有「对象」这一栏。我们要是想写「如果是学生甲，就多喂一条数据」，编译器当场答不上来 —— 它手里只有名称，名称上没写这一栏。

::: tip 提示
**纸面上那一栏**（静态类型）= 写代码时名称上写死的字，编译器翻的时候只认它。
**屋里那一位**（动态类型）= 真跑起来那一刻，该变量里实际住着的那个对象。

第二阶段「多态调用」那一课那句「名字定终身」说的是**该跑哪一手**；这一课要问的是另一个问题：**跑起来之后，怎么把屋里那一位认出来**。这是两件事。
:::

## 二、照光那一手：`dynamic_cast` 到名称

照 X 光有专门的写法，它长这样：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    Cat(const string& n) : name(n) {}
    virtual ~Cat() {}
};

class OrangeCat : public Cat {
public:
    OrangeCat(const string& n) : Cat(n) {}
};

class TabbyCat : public Cat {
public:
    TabbyCat(const string& n) : Cat(n) {}
};

int main() {
    OrangeCat o("张三");
    Cat* p = &o;

    OrangeCat* a = dynamic_cast<OrangeCat*>(p);
    cout << (a == nullptr ? "空名称" : "照出来了") << endl;

    TabbyCat* b = dynamic_cast<TabbyCat*>(p);
    cout << (b == nullptr ? "空名称" : "照出来了") << endl;
    return 0;
}
```

```text
照出来了
空名称
```

尖括号里写的是**我们想照成哪张类定义**（这里是 `OrangeCat*`），括号里是**手上那张名称**。念作：「照着这张名称，看看屋里那个是不是一张学生甲类定义做的。」

- **第一次照到了。** 屋里住的确实是张三，`dynamic_cast<OrangeCat*>(p)` 递给我们一张写着「学生甲」的名称 `a`，不是空的。
- **第二次照空了。** 换一张目标再照 —— 屋里那个明明不是学生乙。这一回我们拿到的是一张**空名称**（`nullptr`）。
- **照不出来的时候，它不报错、也不崩** —— 它只是把一张空名称递给我们，由我们自己决定怎么办。所以紧接着那一步永远是查一查：`a == nullptr` 就是「没照出来」。
- 拿到了 `a` 之后，我们才敢调用学生甲才有的那一手、才能多喂那条数据。**照光是「先确认、再动手」那个确认。**

::: warn 注意
`dynamic_cast<OrangeCat*>(p)` 里的 `p` **从头到尾一个字都没变**。照光这一步不改名称本身，它只是**另外递给我们一张新名称**。所以照完要接住（`OrangeCat* a = ...`），不接住就等于白照了。
:::

## 三、照到「不必还的名字」上：失败是抛出来的

我们刚才照的是**名称**（`OrangeCat*`）。要是照到**不必还的名字**上呢？写法少一个星号：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    Cat(const string& n) : name(n) {}
    virtual ~Cat() {}
};

class OrangeCat : public Cat {
public:
    OrangeCat(const string& n) : Cat(n) {}
};

class TabbyCat : public Cat {
public:
    TabbyCat(const string& n) : Cat(n) {}
};

int main() {
    OrangeCat o("张三");
    Cat* p = &o;

    try {
        TabbyCat& r = dynamic_cast<TabbyCat&>(*p);
        cout << "照出来了：" << r.name << endl;
    } catch (const bad_cast& e) {
        cout << "照不出来：" << e.what() << endl;
    }

    TabbyCat* q = dynamic_cast<TabbyCat*>(p);
    cout << (q == nullptr ? "名称是空的" : "名称有货") << endl;
    return 0;
}
```

```text
照不出来：std::bad_cast
名称是空的
```

**同样一件事、同样照不出来，两种写法给的东西完全不一样：**

| 照成什么 | 照不出来的时候 |
|---|---|
| 名称：`dynamic_cast<TabbyCat*>(p)` | 递给我们**一张空名称**，`q == nullptr` |
| 不必还的名字：`dynamic_cast<TabbyCat&>(*p)` | **当场抛出来**一个 `bad_cast`，我们得接住 |

「不必还的名字」这一边**没有一个「空」可以表示失败** —— 名字本来就不许是空的。所以它只能用另一种办法认输：**抛**。接不住的话，程序当场就没收场了。上面那两行输出正好把两种结果摆在一起：上面那行是接住的（`e.what()` 报出来的话是 `std::bad_cast`），下面那行是空名称。

::: tip 提示
`e.what()` 是这一手自带的「一句话说明」。`std::bad_cast` 就是它报的名字 —— 意思很直白：「这一照，没照成」。
:::

::: warn 注意
**这两种失败方式千万别记混**，我们见过太多对象在这里栽：

- 照**名称**失败 → **给空名称**，不抛。忘了查 `== nullptr` 就用，那才是真的出事。
- 照**不必还的名字**失败 → **抛 `bad_cast`**，不给空。忘了包起来，程序当场停在那儿。

至于为什么会失败 —— 屋里那个确实不是我们要的那张类定义做的，这不是「出错了」，是**照实回答**。
:::

## 四、`typeid(x).name()` 报出来的名字

照光回答的是「**是不是**某一个类定义」，还有一种问法是「**你到底是哪一张**」：

```cpp
#include <iostream>
#include <string>
#include <typeinfo>
using namespace std;

class Cat {
public:
    string name;
    Cat(const string& n) : name(n) {}
    virtual ~Cat() {}
};

class OrangeCat : public Cat {
public:
    OrangeCat(const string& n) : Cat(n) {}
};

class TabbyCat : public Cat {
public:
    TabbyCat(const string& n) : Cat(n) {}
};

int main() {
    OrangeCat o("张三");
    TabbyCat t("李四");
    Cat* p = &o;

    cout << typeid(*p).name() << endl;
    p = &t;
    cout << typeid(*p).name() << endl;
    cout << typeid(p).name() << endl;
    cout << (typeid(*p) == typeid(TabbyCat) ? "是学生乙类定义" : "不是学生乙类定义") << endl;
    return 0;
}
```

```text
9OrangeCat
8TabbyCat
P3Cat
是学生乙类定义
```

一行一行看：

- `typeid(*p).name()` 跟着名称变：先报 `9OrangeCat`，名称改指学生乙之后报 `8TabbyCat`。**它问的是屋里那一位**，所以它答得出来。
- **前面那个数字是名字的长度**：`OrangeCat` 九个字母，所以前面站着个 9；`TabbyCat` 八个字母，前面站着个 8。这是本机上编译器（g++）的写法。
- **它是「实现定义」的**：`name()` 报出来的这串字**不是**保证原样印出类定义的名字，换个编译器可能换一种写法，可能不带那个数字。**我们要提醒的是：别把它当成「一定印出原来的名字」** —— 它对得上就对，对不上不代表程序错了。
- 第三行 `typeid(p).name()` 报的是 `P3Cat` —— 这次问的是**名称本身**（`P` 就是名称的意思，3 是 `Cat` 三个字母）。**写 `p` 问名称，写 `*p` 问屋里那一位**，差一个星号，答案完全不同。
- **真正拿来判断的时候，用比较、不要比字**：`typeid(*p) == typeid(TabbyCat)` 才是我们要的写法。它问的是「两张类定义是不是同一张」，跟名字被改写成什么样没关系，换个编译器照样对。

::: warn 注意
`typeid(*p).name()` 报出来的那串字，**只适合给人看，不适合拿来做判断**。要判断就写 `typeid(*p) == typeid(TabbyCat)`，或者干脆用第二节的照光那一手。

还有一个更隐蔽的坑：`typeid` **必须写在 `*p` 上**。写在 `p` 上，它问的是名称；我们第一版就是这么写的，屏幕上印出来一串 `P3Cat`，我们盯着看了半天才反应过来 —— 被问的是名称，不是对象。
:::

## 五、不照光那一手：`static_cast`

同样是「把写着对象的名称换成写着学生甲的名称」，还有一手**不照光**的写法：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
protected:
    string name;
public:
    Cat(const string& n) : name(n) {}
    virtual ~Cat() {}
    virtual void speak() const {
        cout << name << "：" << endl;
    }
};

class OrangeCat : public Cat {
public:
    int weight;
    OrangeCat(const string& n) : Cat(n), weight(7) {}
    void speak() const override {
        cout << name << "：我们是学生甲，！" << endl;
    }
};

class TabbyCat : public Cat {
public:
    int stripes;
    TabbyCat(const string& n) : Cat(n), stripes(13) {}
    void speak() const override {
        cout << name << "：我们是学生乙，呜" << endl;
    }
};

int main() {
    TabbyCat t("李四");
    Cat* p = &t;

    OrangeCat* hard = static_cast<OrangeCat*>(p);
    OrangeCat* soft = dynamic_cast<OrangeCat*>(p);

    cout << (hard == nullptr ? "名称是空的" : "名称有货") << endl;
    cout << (soft == nullptr ? "名称是空的" : "名称有货") << endl;

    hard->speak();
    cout << "学生甲的体重 = " << hard->weight << endl;
    return 0;
}
```

```text
名称有货
名称是空的
李四：我们是学生乙，呜
学生甲的体重 = 13
```

屋里住的明明是学生乙。**同一张名称、同一个目标，两手的差别一眼就看出来了：**

- **`static_cast` 给了「名称有货」** —— 它不照光：编译器在纸上就把地址算好了（从「对象」那一份挪到「学生甲」那一份该加多少，它是知道的），压根不看屋里住的是谁。于是我们手里拿到一张写着「学生甲」的名称，**而且一个错都不报**。
- **`dynamic_cast` 给了「名称是空的」** —— 它照了光，照实回答：不是学生甲。
- **第三行更有意思**：我们拿着那张硬换来的名称调用了一次 `speak()`，居然调用出的是**学生乙**的台词。因为那一手是「会看屋里住的是谁」的，继续调用还是低头看了屋里那一位 —— **虚的那一手反而把这次转错遮住了**，看着一切正常。
- **第四行露馅了**：我们要读「学生甲的体重」，印出来是 `13` —— 那根本不是学生甲的体重（张三那一格是 7），那是**学生乙身上那一格的数**。因为 `static_cast` 算的是「从这一份挪到那一份」，屋里那位身上压根没有「学生甲的体重」这一格，我们读到的就是隔壁那一格。

这就是 `static_cast` 的脾气：**它能算得快，是因为它压根不检查**。转对了皆大欢喜；转错了不报错、不抛、也不给空名称 —— 它给我们一张**看着挺正常的名称**，等我们真去用的时候，读出来的东西已经不对了。

::: warn 注意
上面第四行那个 `13` 是**我们在这台机器上真跑出来的读数**，换个写法、换个编译器，读到的可能是别的数。**别去背那个数字** —— 要背的是它的方向：

**转错了，`static_cast` 一次不吭。** 拿了那张名称去读一格不属于它的东西，我们读到的会是别人身上的数；要是那格是张名称（地址），顺着它再调用一手，可能当场就崩。这中间**没有任何一处会告诉我们「你转错了」**。

上一课那些「拆一半不报错」「忘了喂料不吭声」的坑，和这是同一类：**它安安静静，就等着我们自己发现。**
:::

## 六、把四样摆在一起看一遍

下面这段演示把我们今天照的四样东西摊开：照成功、照失败、问名字，再加上那手不照光的。跟着 `at:` 一步一步走，右边那一栏会跟着变。

```demo
title: 照 X 光：一张写着「对象」的名称，照出屋里住的是谁
code:
| Cat* p = &o;                                  // 名称上写「对象」，屋里住的是学生甲
| OrangeCat* a = dynamic_cast<OrangeCat*>(p);
| TabbyCat*  b = dynamic_cast<TabbyCat*>(p);
| cout << typeid(*p).name() << endl;
| Cat* q = &t;                                  // 这一次屋里住的是学生乙
| OrangeCat* c = static_cast<OrangeCat*>(q);

step 我们手里只有一张写着「对象」的名称
at: 1
say: `p` 是一张「对象」的名称，它指着学生甲张三。名称上写死的是「对象」这一栏，屋里住的是谁，名称上一个字都没写。
meow: 基类指针 p 指向派生类对象。
pose: welcome
这次照出来是哪一个 = 还没开始照
名称空不空 = 还没开始照
它报出来的名字 = 还没问

step 对着学生甲照一次「是不是学生甲」
at: 2
say: 照光那一手低头看了屋里那一位，对上了 —— 递给我们一张写着「学生甲」的名称。照完记得接住，不然就白照了。
meow: dynamic_cast 成功，得到指针。
pose: yay
这次照出来是哪一个 = 学生甲
名称空不空 = 不空
它报出来的名字 = 还没问

step 对着同一个对象，再照一次「是不是学生乙」
at: 3
say: 换一张目标再照。屋里明明是学生甲 —— 这一回照不出来。注意它不报错、不崩，递给我们的是一张空名称，我们自己查 `== nullptr`。
meow: 类型不符，返回 nullptr。
pose: think
这次照出来是哪一个 = 照不出来（空名称）
名称空不空 = 空
它报出来的名字 = 还没问

step 问一句「你到底是哪张类定义做的」
at: 4
say: `typeid(*p).name()` 报的是 `9OrangeCat` —— 前面那个 9 是名字的长度。这串字是**实现定义**的，换个编译器可能换个写法，只能给人看，不能拿来比。
meow: typeid 报告实际类型。
pose: expect
这次照出来是哪一个 = 学生甲
名称空不空 = 不空
它报出来的名字 = 9OrangeCat

step 换一个对象，名称还是写着「对象」
at: 5
say: 同一张名称改指着学生乙。名称上写的那一栏一辈子不变，变的只有屋里那一位 —— 所以光看名称，我们永远认不出屋里是谁。
meow: q 指向另一个派生类对象。
pose: remind
这次照出来是哪一个 = 还没照
名称空不空 = 还没照
它报出来的名字 = 还没问

step 这回不照光，硬当它是学生甲
at: 6
say: `static_cast` 在纸上就把地址算好了，压根不看屋里住的是谁。名称照样拿到手、一个错都不报 —— 可屋里住的明明是学生乙，我们已经拿着一张写着「学生甲」的错名称了。
meow: static_cast 不做运行时检查。
pose: soothe
这次照出来是哪一个 = 纸上说是学生甲（其实不是）
名称空不空 = 不空（这才是最危险的）
它报出来的名字 = 8TabbyCat（问名字还是准的）
```

## 七、照光有个硬门槛：底座至少得有一手挂了招牌

照光那一手是从哪儿知道「屋里住的是谁」的？**得有人记着这件事。** 记着它的地方，是挂了招牌（`virtual`）的那一手带来的 —— 所以门槛来了：**底座类定义上至少得有一手挂着招牌**，照光才照得动。我们把前面那套里那行 `virtual ~Cat() {}` 删掉试了一次：

```cpp
#include <iostream>
#include <string>
using namespace std;

class Cat {
public:
    string name;
    Cat(const string& n) : name(n) {}
    void speak() const {
        cout << name << "：" << endl;
    }
};

class OrangeCat : public Cat {
public:
    OrangeCat(const string& n) : Cat(n) {}
};

int main() {
    OrangeCat o("张三");
    Cat* p = &o;
    OrangeCat* a = dynamic_cast<OrangeCat*>(p);
    cout << (a == nullptr ? "空名称" : a->name) << endl;
    return 0;
}
```

```text
main.cpp:22:20: error: cannot 'dynamic_cast' 'p' (of type 'class Cat*') to type 'class OrangeCat*' (source type is not polymorphic)
```

编译器的原话里，最要紧的三个词是 `source type is not polymorphic` —— 它说的是「**我们拿来照的这份料，不是会变的那种**」。我们的话：这张底座类定义上一手挂招牌的都没有，所以**它压根没带「我是谁」的记录**，照光这一手没法开工。程序根本编不出来，编译器当场拦住。

**这条门槛是好事**：它出错的时候是当场拦人，不是安安静静地错。

## 八、同一道门槛也管着 `typeid`

那把招牌删掉之后，`typeid` 编得过吗？我们真跑过：

```cpp
#include <iostream>
#include <string>
#include <typeinfo>
using namespace std;

class Cat {
public:
    string name;
    Cat(const string& n) : name(n) {}
};

class OrangeCat : public Cat {
public:
    OrangeCat(const string& n) : Cat(n) {}
};

int main() {
    OrangeCat o("张三");
    Cat* p = &o;
    cout << "照名称看见的：" << typeid(*p).name() << endl;
    cout << "照实例看见的：" << typeid(o).name() << endl;
    return 0;
}
```

```text
照名称看见的：3Cat
照实例看见的：9OrangeCat
```

**编得过，可它看错了地方。** `typeid(*p)` 本来该报屋里那一位，可底座没有挂招牌的那一手，也就没有「我是谁」的记录可以查 —— 于是它只好照着**名称上写的那一栏**回答：`3Cat`。同一个对象，我们直接问它自己（`typeid(o)`）就是 `9OrangeCat`。

**一句话记住：`dynamic_cast` 和 `typeid` 认的是同一份记录，所以它俩要的是同一道门槛** —— 底座类定义上至少有一手挂着招牌。挂了，两个都灵；没挂，一个是编不过，另一个是**照名称的字回答，安安静静地答错**。

那警告算不算数？我们也顺手试了一种写歪的接法 —— 照不必还的名字、接住的时候把「不必还」那个 `&` 写漏了：

```cpp
#include <iostream>
#include <string>
#include <typeinfo>
using namespace std;

class Cat {
public:
    string name;
    Cat(const string& n) : name(n) {}
    virtual ~Cat() {}
};

class OrangeCat : public Cat {
public:
    OrangeCat(const string& n) : Cat(n) {}
};

class TabbyCat : public Cat {
public:
    TabbyCat(const string& n) : Cat(n) {}
};

int main() {
    OrangeCat o("张三");
    Cat* p = &o;
    try {
        TabbyCat& r = dynamic_cast<TabbyCat&>(*p);
        cout << "照出来了：" << r.name << endl;
    } catch (bad_cast e) {
        cout << "照不出来：" << e.what() << endl;
    }
    return 0;
}
```

```text
照不出来：std::bad_cast
```

接是接住了，可编译器顺口念叨了一句：

```text
main.cpp:29:23: warning: catching polymorphic type 'class std::bad_cast' by value [-Wcatch-value=]
```

它的意思是「这份料身上挂着招牌，我们接住的却是一份**抄本**，不是原来那一份」。**注意这是警告、不是错误** —— 程序照样编出来、照样跑。只是那句 `catch (bad_cast e)` 少了那个小小的 `&`，接住的就不是原来那一位了。

::: tip 提示
`catch (const bad_cast& e)` 里那个 `&` 不能省 —— 和我们在上一课写 `const string& n` 是同一个道理：**不必还的接法**，才不会接住一份抄本。
:::

## 九、四种写法对照

书上把这一课的写法归成一桌四手。我们把它们摆出来，顺便说清各自该什么时候上：

| 我们写下的 | 它干什么 | 什么时候用 |
|---|---|---|
| `static_cast<...>` | **不照光**：纸上算好怎么挪，不做运行期检查 | 数值换算、朝着底座那一边走（上行）、我们心里有数的时候 |
| `dynamic_cast<...>` | **照光**：真跑起来低头看屋里住的是谁，认的是那份「我是谁」的记录 | 手里只有底座的名称，要确认是不是某一张子类 —— 有运行期代价 |
| `const_cast<...>` | 只动「许不许改」这一条，别的什么都不改 | 极少用；我们只在收拾老代码的时候见过它，动了不该动的格子是自找麻烦 |
| `reinterpret_cast<...>` | 把同一块地方**硬当另一种东西**看，比 `static_cast` 还不管不顾 | 基本不碰。要用之前先想三遍，再想一遍 |

我们最想让你带走的三句话：

1. **朝着底座那一边走（上行），`static_cast` 就够了** —— 子对象本来就是对象，这一步没有照光的必要。
2. **反着走（下行）才要当心**：要么用 `dynamic_cast` 照一照（慢一点，可它照实回答），要么用 `static_cast` 硬来（快，可**转错了它一次不吭**）。写之前先问自己一句：这一位**一定是**那张子类做的吗？答不上来就照光。
3. **后两种基本不碰。** `const_cast` 和 `reinterpret_cast` 属于「我们确实知道自己在干什么」时才用的那一档；初学阶段遇到它们的地方，九成是换个写法会更好。

::: warn 注意
**照光不是免费的。** `dynamic_cast` 真跑起来要低头查那份记录，所以它比 `static_cast` 慢一点点。我们的规矩是：**只有「我们真的不确定」的时候才照光**。

反过来更贵的是另一种：明明不确定，却为了省那一点点用了不照光的写法 —— 转错了不报错，等我们发现的时候，屏幕上已经是一个查不出原因的怪数字了。
:::

## 一句话对照表

| 我们写下的 | 它的意思 |
|---|---|
| `Cat* p = &o;` | 一张写着「对象」的名称，屋里住的是学生甲 —— 纸面一栏，屋里一位 |
| `dynamic_cast<OrangeCat*>(p)` | 照光，照的是**名称**：对上给新名称，对不上给**空名称** |
| `dynamic_cast<TabbyCat&>(*p)` | 照光，照的是**不必还的名字**：对上给名字，对不上**抛 `bad_cast`** |
| `catch (const bad_cast& e)` | 把上面那一抛接住；`e.what()` 报出来的是 `std::bad_cast` |
| `typeid(*p).name()` | 问「你到底是哪张类定义做的」，报出来的是**实现定义**的名字（本机上是 `9OrangeCat`，9 是名字长度） |
| `typeid(p).name()` | 问的是**名称**，报出来是 `P3Cat` —— 差一个星号，问的东西完全不同 |
| `typeid(*p) == typeid(TabbyCat)` | 要判断就用这个：它问「是不是同一个类定义」，换个编译器照样对 |
| `static_cast<OrangeCat*>(p)` | **不照光**：直接换一张名称，不做检查 —— 转错了名称照样是「有货」 |
| 那张转错的名称读出来的 `13` | 读到了别人那一格的数；**转错了不报错**，这才是最贵的坑 |
| 底座上没挂招牌就照光 | `source type is not polymorphic` —— 编不过（当场拦人，这条最好） |
| 底座上没挂招牌就 `typeid` | 编得过，可它照着**名称上那一栏**回答：`3Cat`（安静地答错） |

## 小任务

1. 把第二节那段抄进练习场跑一次，把两次照光的结果对一遍：一次「照出来了」、一次「空名称」。然后把第二次照光的目标改成 `OrangeCat*` —— 猜猜这回是什么，再跑一次对照。
2. 把第三节那段抄进去跑一遍，确认它真的印出 `照不出来：std::bad_cast`；再把 `catch (const bad_cast& e)` 那一整段 `try` / `catch` **删掉**再跑一次 —— 看看程序是怎么收场的。那一堆话里有没有一句是 `bad_cast`？
3. 先猜再跑：把第四节那段里第三行 `typeid(p).name()` 改成 `typeid(*p).name()`，两个数字会怎么变？然后**把 `virtual ~Cat() {}` 那一行删掉**，再跑一次，看看 `typeid(*p)` 报出来的名字变成了什么 —— 先写下猜测，再真跑对照。
4. 把第五节那段抄进去跑一次，数一数「名称有货」「名称是空的」各印了几遍；再想想：要是把 `hard->weight` 那一行换成 `hard->speak()`，输出会不会露出马脚？（我们上面那段已经演过答案了，自己跑一遍才算数。）

下一课我们要往前再走一步：**给特定材料开小灶** —— 那张模板，碰上某些特别的料子时，我们想让它的裁法变一变。去下一课探险 
