# 🔑 C 語言關鍵字與綜合題庫 (Keywords & Algorithms)

> **學習目標**
> 1.  精通 C 語言四大天王關鍵字：`static`, `volatile`, `const`, `extern`。
> 2.  建立清晰的 **Compilation Process** Mental Model (從 Source Code 到 Executable)。
> 3.  熟練 **Preprocessor** 黑魔法 (`#define`, `inline`, `##`)。
> 4.  手寫標準庫函式 (`memcpy`, `strcpy`, `atoi`) 與經典演算法 (Linked List)。

---

## 📌 Context: 為什麼面試官愛問關鍵字？

因為關鍵字揭示了你對 **變數生命週期 (Life Cycle)**、**記憶體可見性 (Visibility)** 以及 **編譯器行為 (Optimization)** 的理解。寫出能跑的 Code 只是 60 分，寫出正確使用 `volatile` 和 `static` 的 Code 才是 100 分。

---

## 🧠 Mental Model (核心觀念圖解)

### 1. 編譯流程 (The Build Process)

從 `.c` 到 `.exe` 經歷了四個階段，每個階段都由不同的工具負責。

```text
File:      [main.c]        [main.i]        [main.s]        [main.o]        [main.elf]
Tool:         │               │               │               │               │
      Preproc(CPP)    Compiler(CC)    Assembler(AS)    Linker(LD)      Loader
              │               │               │               │               │
Action:    Replace #      Translate       Translate       Combine         Run
           Expand Macro   C to ASM        ASM to Machine  Symbols         (OS)
```

-   **Preprocessor**: 文書處理。`#include` 只是把檔案複製貼上，`#define` 只是搜尋取代。
-   **Linker**: 拼圖工。把分散在各個 `.o` 檔的變數 (`extern`) 和函式接起來。

---

## 🔷 Logic I: 存儲類別 (Storage Classes)

### 1. `static` 的三重人格
| 作用域 | 意義 | 記憶體位置 |
| :--- | :--- | :--- |
| **函式內 (Local)** | **保持數值**。函式結束後變數不消失，下次呼叫時保留上次的值。 | .data / .bss |
| **全域變數 (Global)** | **限制可見性**。只有這個 `.c` 檔看得到，其他檔案不能 `extern` 它。 | .data / .bss |
| **函式 (Function)** | **限制可見性**。只有這個 `.c` 檔能呼叫此函式 (Private Function)。 | .text |

### 2. `extern`
-   告訴編譯器：「這個變數即使現在沒看到定義，但別急著報錯，它一定在某個地方，Linker 會找到它的。」
-   **陷阱**: `extern` 只是宣告 (Declaration)，不分配記憶體。

---

## 🔷 Logic II: 型別修飾詞 (Type Qualifiers)

### 1. `volatile` (易變的) — 嵌入式必考
-   **定義**: 告訴編譯器「別自作聰明優化我，每次都要乖乖去讀記憶體」。
-   **場景**:
    1.  **MMIO**: 硬體暫存器 (狀態隨時會變，如 `STATUS_REG`)。
    2.  **ISR Shared Var**: 中斷服務程式會改的 Flag。
    3.  **Multithreading**: 執行緒間的溝通變數 (雖不保證原子性，但保證可見性)。

### 2. `const` (唯讀的)
-   **陷阱**: `const` 只是編譯器層面的檢查 (Read-only variable)，不是真常數。透過指標強制轉型還是可以改 (但在 .rodata區會 Crash)。
-   **指標口訣**:
    -   `const int *p`: 可以改 `p` (指針)，不能改 `*p` (內容)。(Content is const)
    -   `int * const p`: 不能改 `p` (指針)，可以改 `*p` (內容)。(Pointer is const)

---

## 🔷 Logic III: 預處理器 (Preprocessor)

### 1. `#define` vs `inline`
-   `#define`: 文字替換。容易有副作用 (e.g. `SQUARE(a++)` -> `a++ * a++`)，無型別檢查。
-   `inline`: 真正的函式。編譯器優化，有型別檢查，安全。
-   **結論**: 盡量用 `inline`，除非你要做的是 Token 拼接。

### 2. 黑魔法 `#` 與 `##`
-   `#`: Stringify (變字串)。`#x` -> `"x"`。
-   `##`: Concatenate (連接)。`var_ ## n` -> `var_n`。

---

## 🔷 Logic IV: 標準庫實作 (Standard Library Implementation)

### 1. `strcpy`
重點是判斷 `\0` 結束符。
```c
char *my_strcpy(char *dest, const char *src) {
    char *saved = dest;
    while ((*dest++ = *src++) != '\0'); // 賦值表達式的結果是左值
    return saved;
}
```

### 2. `memcpy` vs `memmove`
-   `memcpy`: 假設來源與目的 **不重疊** (速度快)。
-   `memmove`: 處理 **重疊 (Overlap)** 情況 (安全)。如果 `dest > src` 且重疊，要從後面往前複製。

---

## 🔷 Logic V: 經典演算法

### 1. 反轉 Linked List
```c
Node* reverse(Node* head) {
    Node *prev = NULL, *curr = head, *next;
    while (curr) {
        next = curr->next; // 1. 備份
        curr->next = prev; // 2. 反轉
        prev = curr;       // 3. 前進
        curr = next;       // 4. 前進
    }
    return prev;
}
```

### 2. 判斷 Linked List 有環 (Cycle Detection)
**龜兔賽跑 (Floyd's Algorithm)**: 快指標一次兩步，慢指標一次一步。如果有環，它們遲早會相遇。

---

## 📝 精選面試題 (Interview Questions)

### Q1: `static` 函式有什麼好處？
-   **封裝 (Encapsulation)**: 限制函式只在當前檔案可見，避免污染全域 Namespace。
-   **優化**: 編譯器知道這個函式不會被外部呼叫，可能進行更激進的優化 (如 Inline)。

### Q2: 下面這行 Code 對嗎？ `int square(volatile int *ptr) { return *ptr * *ptr; }`
-   **錯/危險**: `*ptr` 有 `volatile` 修飾。編譯器會生成兩次讀取指令。
-   如果在兩次讀取之間，硬體改變了 `*ptr` 的值，結果就不是平方了 (e.g. `3 * 4`)。
-   **修正**: `int val = *ptr; return val * val;` (讀取一次到 Local 變數)。

### Q3: Big Endian vs Little Endian? 如何用 C 判斷？
-   **Big Endian**: MSB 存低位址 (人類閱讀順序)。網路傳輸常用。
-   **Little Endian**: LSB 存低位址 (Intel/ARM default)。
-   **判斷**:
    ```c
    int x = 1;
    if (*(char*)&x == 1) printf("Little Endian");
    ```

### Q4: 預處理器 `#error` 有什麼用？
-   用來在編譯期間檢查設定。例如檢查架構是否正確：
    ```c
    #if !defined(__ARM__)
    #error "This code is for ARM only!"
    #endif
    ```

### Q5: 實作 `offsetof` 巨集。
-   `offsetof(type, member)` 回傳成員在結構中的偏移量。
-   **原理**: 假設有一個結構體在位址 0，成員的位址就是偏移量。
    ```c
    #define my_offsetof(type, member)  ((size_t)&(((type*)0)->member))
    ```
