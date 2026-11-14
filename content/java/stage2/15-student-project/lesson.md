---
id: java-stage2-15
lang: java
stage: 2
order: 15
title: 综合项目：学生信息管理系统
tags: [综合项目, 学生信息]
required: ["java-stage2-14"]
crossRefs: []
estMinutes: 32
keywords: [extends, super, instanceof, ArrayList, FileWriter]
---

## 学习目标

本课学习综合项目：学生信息管理系统。重点包括封装、继承、集合、文件。请结合示例观察程序状态、执行顺序和结果，并通过练习检查理解。

```java
class Person {
    private String name;

    Person(String name) {
        this.name = name;
    }

    String getName() { return name; }

    String intro() {
        return "我们叫 " + name;
    }
}

class Student extends Person {
    private int score;

    Student(String name, int score) {
        super(name);
        this.score = score;
    }

    int getScore() { return score; }

    @Override
    String intro() {
        return super.intro() + "，考了 " + score + " 分";
    }
}

public class Main {
    public static void main(String[] args) {
        Person a = new Person("计算机");
        Student b = new Student("张三", 92);
        System.out.println(a.intro());
        System.out.println(b.intro());
    }
}
```

```text
我们叫 计算机
我们叫 张三，考了 92 分
```

## 一、父类：工作区里的每一个

先画**父类**。工作区里每一个都有名字，都会自我介绍：

```java
class Person {
    private String name;

    Person(String name) {
        this.name = name;
    }

    String getName() { return name; }

    String intro() {
        return "我们叫 " + name;
    }
}

public class Main {
    public static void main(String[] args) {
        Person a = new Person("计算机");
        System.out.println(a.intro());
    }
}
```

```text
我们叫 计算机
```

三件事照老规矩办：

- **家当盖上盖子**（`private`，第一课那条老规矩），想看得调用 `getName()`；
- **初始化那一手**把名字赋值（第二课）；
- **`intro()` 那一个方法是「把话串好返回」**，不是自己印。这样用的人自己决定拿去干什么 —— 直接印也行、接在别的字后面也行。写在类定义里的方法，最好**只负责把话串好**。

## 二、子类：学员，套在父类上

学员**也是一个**（都有名字），只是**多一格分数**，自我介绍还得带上分数。这种「多一点点」的情形，不用另画一张，**套在父类上画**就行：

```java
class Person {
    private String name;

    Person(String name) {
        this.name = name;
    }

    String getName() { return name; }

    String intro() {
        return "我们叫 " + name;
    }
}

class Student extends Person {
    private int score;

    Student(String name, int score) {
        super(name);
        this.score = score;
    }

    int getScore() { return score; }

    @Override
    String intro() {
        return super.intro() + "，考了 " + score + " 分";
    }
}

public class Main {
    public static void main(String[] args) {
        Student b = new Student("张三", 92);
        System.out.println(b.intro());
        System.out.println("名字还调用得动：" + b.getName());
    }
}
```

```text
我们叫 张三，考了 92 分
名字还调用得动：张三
```

五个关节，我们挨个说：

- **一句话认亲**：`class Student extends Person` —— 「照 `Student` 生的东西**也是一个 `Person`**」（第二课）。认了这门亲，**父类上画着的方法、家当，子类上就都有了** —— 所以 `b.getName()` 这种没在子类上写过的方法，调用照样有人应。
- **初始化那一手的第一句 `super(name)`**：父类的初始化那一手**不会自己跑**，得我们点名请它（第二课那条）；请完再装自己的那一格（`this.score = score;`）。**先请父类，再装自己的**，顺序反了编译器会拦。
- **`@Override` 那顶小帽子**：提醒「我们在重写父类上也有的那一个方法」。名字写错了，编译器会当场指出来。
- **`super.intro()`**：不是换掉父类那一句，而是**先请它把「我们叫 …」串一遍**，我们再把「，考了 92 分」接上去。写成 `this.intro()` 就坏事 —— 那会绕回自己那一个方法，**一层一层叠上去，叠到摞不下为止**，程序当场摔下来（我们真跑过，见下面那个框）。
- **盖子那条老规矩还在**：`name` 盖在类定义里，子类也**伸不进手**（`name` 这个写法在子类里根本看不见）—— 所以子类那边一律走 `getName()` 或者 `super.intro()`。

::: warn 注意
`super.intro()` 和 `this.intro()` 差一个字，下场差得远：`this.intro()` 是「调用我们自己那一个方法」—— 可我们现在站的**就是**这一个方法，它会**一圈套一圈地继续调用**，每调用一次就在半路上多摞一个元素，摞到自己摞不下为止。我们真跑了一遍：屏幕上跳出 `java.lang.StackOverflowError`，程序**当场摔下来** —— 不是印个不停，是直接断气，一句正经话都没印出来。想请上一层那张类定义出手，只有 `super.` 这一条路。
:::

## 三、一个柜子收两样东西

现在是这一课的第一件大事：**一个柜子，两样东西**。

```java
import java.util.ArrayList;
import java.util.List;

class Person {
    private String name;

    Person(String name) {
        this.name = name;
    }

    String getName() { return name; }

    String intro() {
        return "我们叫 " + name;
    }
}

class Student extends Person {
    private int score;

    Student(String name, int score) {
        super(name);
        this.score = score;
    }

    int getScore() { return score; }

    @Override
    String intro() {
        return super.intro() + "，考了 " + score + " 分";
    }
}

public class Main {
    public static void main(String[] args) {
        List<Person> mingdan = new ArrayList<>();
        mingdan.add(new Person("计算机"));
        mingdan.add(new Student("张三", 92));
        mingdan.add(new Student("李四", 78));
        for (Person p : mingdan) {
            System.out.println(p.intro());
        }
        System.out.println("名单上一共 " + mingdan.size() + " 只");
    }
}
```

```text
我们叫 计算机
我们叫 张三，考了 92 分
我们叫 李四，考了 78 分
名单上一共 3 只
```

三处要害：

- **`List<Person>` 收得下学员**。尖括号里那块名称写的是父类名 —— 可学员**也是一个**，比它要的还具体，当然收下（第三课那一步：名称上的类定义名可以和实例不一样）。要是反过来写 `List<Student>`，我们这一条就塞不进去了。
- **绕圈里引用的都是 `intro()`，印出来却各对象各样**：我们那条是父类那一版，学员那两条是子类盖掉的那一版。这就是第三课那句话 —— **一句话输出，各对象各样**：引用的是哪一个方法，看我们引用的名字；**念的是哪一版，看实例是谁**。
- **名称上的名字，管着你调用得动哪些方法**（第三课读过这句）。柜子里的东西名称写 `Person`，所以绕圈里只调用得动 `Person` 上也画着的方法。

::: warn 注意
所以绕圈里**不能**直接问分数。我们真编过这一版：把 `p.getScore()` 写进那个绕圈里，编译器当场把源代码退回来了，原话里给着两条线索 —— `symbol:   method getScore()` 是「你在找的方法名」，`location: variable p of type Person` 是「你是在哪块名称上找的」。

合起来的意思就是：**`p` 这块名称写的是 `Person`，我们翻遍 `Person` 这张类定义，没找到叫 `getScore` 的方法**（这一个方法只画在子类上）。想称呼它，得先**认亲**、再**换名称** —— 下一节就办这件事。
:::

## 四、算平均分：先认亲，再换名称

名单上谁有分数？**只有学员**。所以算平均分（以及数出几个学员）得这么走：

```java
import java.util.ArrayList;
import java.util.List;

class Person {
    private String name;

    Person(String name) {
        this.name = name;
    }

    String getName() { return name; }

    String intro() {
        return "我们叫 " + name;
    }
}

class Student extends Person {
    private int score;

    Student(String name, int score) {
        super(name);
        this.score = score;
    }

    int getScore() { return score; }

    @Override
    String intro() {
        return super.intro() + "，考了 " + score + " 分";
    }
}

public class Main {
    public static void main(String[] args) {
        List<Person> mingdan = new ArrayList<>();
        mingdan.add(new Person("计算机"));
        mingdan.add(new Student("张三", 92));
        mingdan.add(new Student("李四", 78));
        int sum = 0;
        int n = 0;
        for (Person p : mingdan) {
            if (p instanceof Student) {
                Student s = (Student) p;
                sum += s.getScore();
                n++;
            }
        }
        System.out.println("学生 " + n + " 只，平均 " + (sum / n) + " 分");
    }
}
```

```text
学生 2 只，平均 85 分
```

拆开看这四句：

- **`p instanceof Student`** 是**认亲**（第二课）：问一句「`p` 指向的那个，是不是照 `Student`（或者它的下游）生的」。是，才放进去。
- **`Student s = (Student) p;`** 是**换名称**（第三课那个「向下」）：把一个名称写 `Person` 的东西，换一块写 `Student` 的名称。换完之后，子类上那一个方法 `getScore()` 就调用得动了。
- **`sum` 和 `n` 分开攒**：`sum` 只加学员的分数，`n` 只数学员。名字那一格谁都有，分数那一格只有学员有 —— 分开攒才不会算歪。
- **`(sum / n)`** 就是平均分（我们这两组分数加起来正好是偶数，除得整整齐齐）。

::: warn 注意
**认亲那一句千万别省。** 我们把 `if (p instanceof Student)` 拆掉、直接换名称真跑过：名单上第一个是**我们自己**（不是学员），换名称那一下编译器当场翻脸，原话是

`Exception in thread "main" java.lang.ClassCastException: class Person cannot be cast to class Student`。

念起来是：**「我们拿了一块 `Student` 的名称，要套在照 `Person` 生的东西头上 —— 它压根不是学员呀。」** 所以换名称这条路上，顺序永远是**先认亲、再换名称**：问过那一句，换的时候才一定换得动。
:::

## 五、册子：两种东西都落盘

名单要活得比今晚长，还得靠册子（上一课那本）。两种东西都要存，我们定的格式是**一行的开头一格标记**：

```text
1|张三|92
0|计算机
1|李四|78
```

开头的 `1` 是「学员」（后面还跟着分数那一格），`0` 是「不是学员」（后面只有名字）。存和读的本事还是课里那套，只有一处是新面孔：**一条竖线切一刀，两条竖线就得切两刀**。

```java
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        try (FileWriter w = new FileWriter("mingdan.txt")) {
            w.write("1|张三|92\n");
            w.write("0|计算机\n");
            w.write("1|李四|78\n");
        }
        try (BufferedReader r = new BufferedReader(new FileReader("mingdan.txt"))) {
            String hang = r.readLine();
            while (hang != null) {
                int cut = hang.indexOf("|");
                String flag = hang.substring(0, cut);
                String rest = hang.substring(cut + 1);
                if (flag.equals("1")) {
                    int cut2 = rest.indexOf("|");
                    String mingzi = rest.substring(0, cut2);
                    String fenshu = rest.substring(cut2 + 1);
                    System.out.println("学员：" + mingzi + "，分数 " + fenshu);
                } else {
                    System.out.println("不是学员：" + rest);
                }
                hang = r.readLine();
            }
        }
    }
}
```

```text
学员：张三，分数 92
不是学员：计算机
学员：李四，分数 78
```

拆这一步：

- **第一刀切出标记和「剩下的一整截」**：`cut` 是第一根竖线的位置，`flag` 是它左边那格（`1` / `0`），`rest` 是它右边那一整截（`张三|92` 或者 `计算机`）。
- **认了标记再切第二刀**：`rest.indexOf("|")` 找的是「剩下那一截里还有没有竖线」，有就再切一次、分出手的名字和分数。
- **为什么第二刀必须等认完标记**：`0|计算机` 这一行**只有一根竖线**。我们要是闭着眼睛切第二刀，`indexOf` 会返回 `-1`，`substring(0, -1)` 当场就把程序摁死了 —— 我们真跑过这一版，原话是 `StringIndexOutOfBoundsException: Range [0, -1) out of bounds for length 3`。
- **读回来照各自那张类定义生**：`1` 那一行用 `new Student(名字, 分数)`，`0` 那一行用 `new Person(名字)`。**「认亲」这件事在册子上变成了一格标记**：存的时候问一次「你是不是学员」，读的时候看那格标记，两条路走出来的是同一样东西。

## 六、串起来：完整的小系统

四件事凑齐，就是下面这一段：

```java
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

class Person {
    private String name;

    Person(String name) {
        this.name = name;
    }

    String getName() { return name; }

    String intro() {
        return "我们叫 " + name;
    }
}

class Student extends Person {
    private int score;

    Student(String name, int score) {
        super(name);
        this.score = score;
    }

    int getScore() { return score; }

    @Override
    String intro() {
        return super.intro() + "，考了 " + score + " 分";
    }
}

public class Main {
    static final String BOOK = "mingdan.txt";

    public static void main(String[] args) throws IOException {
        List<Person> mingdan = load();
        System.out.println("册子上原有 " + mingdan.size() + " 只");
        mingdan.add(new Student("张三", 92));
        mingdan.add(new Student("李四", 78));
        System.out.println("现在有 " + mingdan.size() + " 只");
        for (Person p : mingdan) {
            System.out.println(p.intro());
        }
        int sum = 0;
        int n = 0;
        for (Person p : mingdan) {
            if (p instanceof Student) {
                Student s = (Student) p;
                sum += s.getScore();
                n++;
            }
        }
        System.out.println("学生 " + n + " 只，平均 " + (sum / n) + " 分");
        save(mingdan);
    }

    static void save(List<Person> mingdan) throws IOException {
        try (FileWriter w = new FileWriter(BOOK)) {
            for (Person p : mingdan) {
                if (p instanceof Student) {
                    Student s = (Student) p;
                    w.write("1|" + s.getName() + "|" + s.getScore() + "\n");
                } else {
                    w.write("0|" + p.getName() + "\n");
                }
            }
        }
    }

    static List<Person> load() throws IOException {
        List<Person> out = new ArrayList<>();
        File f = new File(BOOK);
        if (!f.exists()) {
            return out;
        }
        try (BufferedReader r = new BufferedReader(new FileReader(f))) {
            String hang = r.readLine();
            while (hang != null) {
                int cut = hang.indexOf("|");
                String flag = hang.substring(0, cut);
                String rest = hang.substring(cut + 1);
                if (flag.equals("1")) {
                    int cut2 = rest.indexOf("|");
                    String mingzi = rest.substring(0, cut2);
                    int fenshu = Integer.parseInt(rest.substring(cut2 + 1));
                    out.add(new Student(mingzi, fenshu));
                } else {
                    out.add(new Person(rest));
                }
                hang = r.readLine();
            }
        }
        return out;
    }
}
```

```text
册子上原有 0 只
现在有 2 只
我们叫 张三，考了 92 分
我们叫 李四，考了 78 分
学生 2 只，平均 85 分
```

第一行那个 `0` 还是老样子：**这一段跑起来的时候册子还不存在**，所以 `load()` 走的是「交一个空柜子」那条路（`exists()` 先守门，上一课讲过）。跑到最后 `save()` 把两条都写进册子 —— **你再跑一遍，第一行就变成 `册子上原有 2 只` 了**（我们这边每趟都是干净的机器，所以我们看到的一直是 `0`）。

`save()` 里那两路，正是这一课最关键的一处呼应：**存的时候用「认亲」分岔**（学员写三格、不是学员的写两格），**读的时候用「标记」分岔**（看开头那格 `1` / `0`）。两处岔口对上了，名单才能原样回来 —— 谁是谁、谁有分数，一格都不差。

::: tip 提示
第二阶段这一路攒的家当，这个小系统里全用上了：

1. **盖子**（第一课）：家当关起来，只留几个正经门；
2. **继承**（第二课）：`extends` 认亲、`super(...)` 先请父类、`@Override` 盖掉、`super.` 请上一层；
3. **名称**（第三课）：`List<Person>` 收得下学员、引用的是哪一个方法看名字、念的是哪一版看实例；先认亲（`instanceof`）再换名称（`(Student) p`）；
4. **柜子**（第八课）：会自己长大的清单；
5. **一串字的几个方法**（`indexOf` / `substring`）：切一刀不够就切两刀；
6. **册子**（第十三课）：`exists()` 守门、一行一条、`readLine()` 读到 `null` 为止、`throws IOException` 表态；
7. **菜单骨架**（上一课）：我们这个系统要是配上菜单，就是「照着命令一条条办」那一套，一个字都不用改。
:::

## 小任务

1. 给父类添一个方法 `String tag()`：`Person` 那一版返回 `工作区里的一个`，`Student` 盖掉它返回 `学员`。然后在绕圈里跟着 `intro()` 一起印出来 —— 看看「各对象各样」是不是又中了一回。
2. 名单里再加一个 `Student`（分数取一个**单数**），看看平均分那一行会变成什么样 —— 你会发现 `sum / n` 把小数点后面那半扔掉了，这是另一件值得记下来的事。
3. 把第四节的 `if (p instanceof Student)` 拆掉再跑一遍，把编译器那句 `ClassCastException` 的原话抄下来；看完记得加回去。
4. 给册子再加一格：`1|张三|92|三年级` 这样，读的时候要在 `rest` 上**切第三刀**；想想「先认标记再切」这条顺序为什么更省心了。
5. 把完整版跑两遍（第二遍别看第一行）；再给 `save()` 里那一个方法加一句「存了几条」，看看两遍各印了几。

第二阶段到这儿就收工啦。下一站第三阶段，我们先带你学**数圈数**——同一件活儿，哪种写法更省力气，拿数字说话；再回头把**柜子那块名称**琢磨琢磨（泛型还有更讲究的写法），最后让名单**自己站成一排**，不用我们一条条比过去，按分数从高到低站好 
