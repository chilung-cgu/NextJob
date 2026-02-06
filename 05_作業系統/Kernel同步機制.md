# 🔒 Linux Kernel 同步機制 (Synchronization)

> **學習目標**
> 1.  建立 **Race Condition** 與 **Critical Section** 的正確認知。
> 2.  精通 **Spinlock** vs **Mutex** 的選擇標準 (Context, Sleep)。
> 3.  掌握 **RCU** 原理 (Read-sided Scalability)。
> 4.  學會用 **Lockdep** 偵測 Deadlock。

---

## 📌 Context: 為什麼需要同步？

當兩個 CPU 同時對同一個變數做 `count++`，結果可能只加了 1。這就是 **Race Condition**。
-   **Critical Section (臨界區)**: 存取共享資源的程式碼片段，一次只能有一個人進去。
-   **Synchronization (同步)**: 保護臨界區的機制，確保 **互斥 (Mutual Exclusion)** 與 **順序 (Ordering)**。

---

## 🧠 Mental Model (核心觀念圖解)

### 1. 鎖的兩種類型 (The Waiting Strategy)

當你想要的東西被別人拿走了，你有兩種選擇：

1.  **Spinlock (自旋鎖)**:
    -   **策略**:「我就站在門口瞪著你，直到你出來！」(Busy Waiting)
    -   **成本**: CPU 100% 運轉，浪費電，但反應最快。
    -   **場景**: 臨界區很短 (微秒級)，或不能睡覺的地方 (Interrupt Handler)。

2.  **Mutex (互斥鎖)**:
    -   **策略**:「好吧，我去睡個覺，你好了叫我。」(Context Switch)
    -   **成本**: 切換 Process 有開銷 (保存暫存器、Flush TLB...)，但省電且讓出 CPU 給別人用。
    -   **場景**: 臨界區很長，或需要做 I/O (會 Block 的操作)。

---

## 🔷 Logic I: 基礎鎖機制 (Spinlock & Mutex)

### 1. Spinlock (自旋鎖)

**關鍵規則**: 持有 Spinlock 時 **絕對不能睡眠** (No Sleep)。

-   **API**:
    -   `spin_lock(&lock)`: 取得鎖。
    -   `spin_unlock(&lock)`: 釋放鎖。
    -   `spin_lock_irqsave(&lock, flags)`: 取得鎖 + **關閉中斷** + 保存中斷狀態。**(最常用，最安全)**

-   **為什麼要關中斷 (`_irqsave`)？**
    -   如果你在 Process Context 拿了鎖，結果這時來了一個中斷 (Interrupt)，中斷處理函式 (ISR) 也要拿同一把鎖...
    -   ISR 會無限自旋等待 Process 釋放鎖，但 Process 被 ISR 打斷了永遠無法執行。
    -   結果：**Deadlock**。

### 2. Mutex (互斥鎖)

**關鍵規則**: 只能在 **Process Context** 使用，不能在 Interrupt Context 使用。

-   **API**:
    -   `mutex_lock(&lock)`: 取得鎖 (可能睡眠)。
    -   `mutex_unlock(&lock)`: 釋放鎖。
    -   `mutex_trylock(&lock)`: 嘗試取得，不阻塞。

-   **Fast Path vs Slow Path**:
    -   現代 Mutex 實作非常高效。如果沒人競爭，它就是一個 atomic 變數檢查 (Fast Path)，不需要 Context Switch。只有真的發生競爭時，才會進入 Kernel 的 Wait Queue (Slow Path)。

---

## 🔷 Logic II: 進階同步機制

### 1. RCU (Read-Copy-Update)

針對 **讀多寫少** (Read >> Write) 的極致優化。例如：Routing Table, Module List。

-   **Reader**: 完全**無鎖** (`rcu_read_lock` 只是禁止搶佔)，並行性能極高。
-   **Writer**: 
    1.  `kmalloc` 新結構。
    2.  `memcpy` 舊資料，修改新資料。
    3.  `rcu_assign_pointer` 原子替換指針。
    4.  `synchronize_rcu()` 等待所有「舊 Reader」離開。
    5.  `kfree` 舊結構。

### 2. Semaphore (信號量)
-   **計數器**: 允許 N 個人同時進入。
-   **用途**: 資源池管理 (Resource Pool)，或者早期的互斥 (現在都建議用 Mutex)。

### 3. Completion (完成量)
-   **用途**: **A 等待 B 完成某事**。不像 Mutex 是保護資料，Completion 是 **同步執行順序**。
-   **場景**: `vfork()` 等子進程、Driver 等待硬體初始化完成。

---

## 🔷 Logic III: Debugging & Prevention

### 1. Deadlock (死鎖)
-   **AB-BA Deadlock**: Thread 1 拿 A 等 B，Thread 2 拿 B 等 A。
-   **預防**: 嚴格規定 **加鎖順序 (Lock Ordering)**。例如：永遠先拿 A 再拿 B。

### 2. Lockdep (Lock Dependency Validator)
核心最強大的 Debug 工具。它在 Runtime 建立鎖的相依圖。
-   就算 Deadlock 沒真的發生，只要 Lock 順序有潛在風險 (例如某次 A->B，另一次 B->A)，Lockdep 就會噴 **WARNING**。
-   **開啟**: `CONFIG_PROVE_LOCKING=y`.

---

## 🔷 Reference: API Cheatsheet

| 場景 | 推薦機制 (API) | 備註 |
| :--- | :--- | :--- |
| **Interrupt Handler 內** | `spin_lock` / `spin_lock_irqsave` | 絕對不能睡 |
| **Process 與 Interrupt 共享** | `spin_lock_irqsave` | 必須關中斷 |
| **Process Context (長任務)** | `mutex_lock` | 可睡眠 |
| **讀多寫少 (99% Read)** | `rcu_read_lock` | 讀取端無敵快 |
| **等待事件完成** | `wait_for_completion` | 取代 `sleep_on` |
| **分配記憶體時持有鎖** | 用 `GFP_ATOMIC` | 不能用 `GFP_KERNEL` |

---

## 📝 精選面試題 (Interview Questions)

### Q1: Spinlock 和 Mutex 的區別？(必考)
-   **Spinlock**: 忙等待 (Busy Wait)，耗 CPU，不睡眠，可用於 Interrupt Context。
-   **Mutex**: 睡眠等待 (Sleep)，讓出 CPU，會 Context Switch，**不**可用於 Interrupt Context。
-   **選擇**: 鎖持有時間極短用 Spinlock，否則用 Mutex。

### Q2: 為什麼需 `spin_lock_irqsave` 而不是 `spin_lock`？
-   當共享資源可能在 **Interrupt Context** 被存取時，若 Process 持有鎖期間發生中斷，而 ISR 也試圖拿鎖，會導致 ISR 自旋等待 Process (但 Process 被中断停住了)，形成 Deadlock。
-   `irqsave` 會在拿鎖前先 **關閉中斷**，避免這種情況。

### Q3: 什麼是 RCU？Grace Period 是什麼？
-   **RCU**: 讓讀者無鎖存取，寫者透過「複製-修改-切換指針」來更新。
-   **Grace Period**: 從寫者更新指針開始，直到「所有在舊指針上的讀者都離開」這段時間。寫者必須等 Grace Period 結束 (透過 `synchronize_rcu`) 才能釋放舊記憶體。

### Q4: 什麼是 Priority Inversion？如何解決？
-   **現象**: 高優先權 Task 被 低優先權 Task 卡住 (因為低優先權拿了鎖，卻被中優先權搶佔 CPU，導致鎖釋放不了)。
-   **解法**: **Priority Inheritance (PI)**。當高優先權等待鎖時，持有鎖的低優先權 Task 會暫時繼承高優先權，避免被中間人插隊，盡快執行完釋放鎖。Linux `rt_mutex` 支援此機制。
