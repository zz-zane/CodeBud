#include <stdio.h>

int main(void) {
    int a = 5;
    int *p = &a;
    *p = 10;
    printf("%d\n", a);
    return 0;
}
