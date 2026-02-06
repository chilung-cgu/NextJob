# 📊 Linux 核心概念 (Kernel Core Concepts)

> **學習目標**
> 1.  建立 **User Space / Kernel Space** 的邊界觀念與互動機制 (System Call)。
> 2.  深入理解 **Process Management** (task_struct, Context Switch) 與 **CFS Scheduler**。
> 3.  掌握 **Kernel Module** 的動態載入機制。
> 4.  建立作業系統核心子系統 (Memory, Synchronization) 的全景圖。

*(註：記憶體管理與同步機制有專屬章節 `記憶體管理.md` 與 `Kernel同步機制.md`，本章重點在於 Process 與核心架構)*

---

## 📌 Context: 為什麼需要 Kernel？

**Kernel (核心)** 是硬體的「大管家」與應用程式的「保母」。

-   **資源抽象化**：應用程式不需要知道 SSD 是 NVMe 還是 SATA，也不需要知道 RAM 在哪條 DIMM 上，只要操作「檔案」與「記憶體位址」。
-   **隔離與保護**：防止一個崩潰的 Browser App 搞掛整個系統，或偷看別人的密碼。
-   **多工 (Multitasking)**：讓一顆 CPU 看起來像同時在跑 100 個程式。

---

## 🧠 Mental Model (核心觀念圖解)

### 1. 虛擬化抽象 (The Process Abstraction)

每個 Process 都以為自己獨佔了整台電腦。

```text
┌─────────────────────────┐     ┌─────────────────────────┐
│       Process A         │     │       Process B         │
│ (Virtual CPU, Virtual RAM)    │ (Virtual CPU, Virtual RAM)
└────────────┬────────────┘     └────────────┬────────────┘
             │                               │
             ▼                               ▼
       ┌───────────────────────────────────────────┐
       │               Linux Kernel                │
       │  (Scheduler, MMU, File Systems, Drivers)  │
       └─────────────────────┬─────────────────────┘
                             │
                             ▼
                     Hardware Platform
               (Physical CPU, Physical RAM, SSD)
```

-   **Virtual CPU**: 透過 **Scheduler** (排程器) 實現 Time-sharing。
-   **Virtual RAM**: 透過 **MMU** (記憶體管理單元) 實現 Virtual Memory。

### 2. User Space vs Kernel Space (邊界)

ARM64 架構透過 **Exception Levels (EL)** 實作硬體隔離。

```text
  Privilege Level
       High
        ▲         ┌─────────────────────┐
        │         │ EL0: User Space     │  (App, glibc)
        │         └──────────┬──────────┘
    Barrier                  │ ⚡ System Call (SVC #0) / Interrupt
        │         ┌──────────▼──────────┐
        │         │ EL1: Kernel Space   │  (Process Mgmt, Drivers)
        ▼         └─────────────────────┘
       Low
```

---

## 🔷 Logic I: Process Management (進程管理)

### 1. 描述符：task_struct

在 Linux 中，無論是 Process 還是 Thread，核心都用 `struct task_struct` 來表示 (稱為 Task)。

-   **Process**: 擁有獨立資源 (Address Space) 的 Task。
-   **Thread**: 與其他 Thread 共享資源 (`mm_struct`) 的 Task。

**關鍵欄位**:
```c
struct task_struct {
    volatile long state;     /* R, S, D, Z... */
    void *stack;            /* Kernel Stack (8KB/16KB) */
    struct mm_struct *mm;   /* 記憶體描述符 (Thread 共享這個！) */
    struct sched_entity se; /* 排程實體 (for CFS) */
    pid_t pid;
    pid_t tgid;             /* Thread Group ID (同 Process 的 Thread 有相同 tgid) */
    /* ... 數百個欄位 */
};
```

### 2. 排程器：CFS (Completely Fair Scheduler)

Linux 預設 Scheduler，目標是「完全公平」。

-   **核心概念**: **vruntime (Virtual Runtime)**。
-   **邏輯**:
    1.  記錄每個 Task 已經跑了多久 (vruntime)。
    2.  總是挑選 **vruntime 最小** (最缺 CPU) 的 Task 來跑。
    3.  **Nice 值** (優先級) 透過權重影響 vruntime 的增加速度。
        -   高優先權 (Nice -20): 跑很久，vruntime 才增加一點點 (Time pass slowly)。
        -   低優先權 (Nice +19): 跑一下，vruntime 就爆增 (Time pass quickly)。

**資料結構**: **紅黑樹 (Red-Black Tree)**。
-   Key: vruntime。
-   Pick: 最左下角的節點 (`rb_first_cached`)，複雜度 O(1)。
-   Insert/Delete: 複雜度 O(log N)。

### 3. Context Switch (上下文切換)

當 CPU 從 Process A 切換到 Process B 時，必須保存現場。

**開銷來源**:
1.  **Register Saving**: 保存 A 的 x0-x30, PC, SP 到記憶體，載入 B 的。
2.  **Memory overhead**: 切換 Page Table (TTBR0)，導致 **TLB Flush** (除非有 ASID 優化)。
3.  **Cache Pollution**: 新 Process 需要的資料不在 L1/L2 Cache 中 (Cold Cache)。

**為何 Thread 切換比 Process 快？**
因為 Thread 共享 `mm_struct`，**不需要切換 Page Table，也不用 Flush TLB**。

---

## 🔷 Logic II: System Call (系統呼叫)

這是 User 進入 Kernel 的唯一合法大門。

### 1. ARM64 執行流程

當你在 C 語言呼叫 `read(fd, buf, len)`：

1.  **User Space**:
    -   將參數放入暫存器 `x0`~`x5`。
    -   將 Syscall Number (如 63) 放入 `x8`。
    -   執行指令 `svc #0` (Supervisor Call)。
2.  **CPU 硬體**:
    -   觸發 Synchronous Exception。
    -   切換模式 EL0 -> EL1。
    -   保存 PC 到 `ELR_EL1`，PSTATE 到 `SPSR_EL1`。
3.  **Kernel Entry (`entry.S`)**:
    -   跳轉到 Vector Table 的 `el0_sync`。
    -   保存所有通用暫存器到 Kernel Stack (`pt_regs`)。
    -   呼叫 `el0_svc`。
4.  **Handler**:
    -   查表 `sys_call_table[x8]` 找到 `sys_read`。
    -   執行 `sys_read`。
5.  **Return**:
    -   結果放入 `x0`。
    -   `eret` 指令回到 EL0。

### 2. vDSO (加速機制)

對於 `gettimeofday` 這種極高頻的呼叫，陷入 Kernel (Context Switch) 太慢了。
**vDSO** 將 Kernel 的唯讀變數 (如當前時間) 映射到 User Space，讓 App **直接讀取記憶體** 就拿到時間，完全不進 Kernel。速度快 10 倍。

---

## 🔷 Logic III: Kernel Module (可載入模組)

Linux 是 **Monolithic Kernel** (單核心)，但具備 **Modular** 能力。

### 1. 運作機制
-   **insmod / modprobe**: 呼叫 `init_module` syscall。
-   **Kernel**:
    1.  分配記憶體 (`vmalloc`/`kmalloc`)。
    2.  將 `.ko` 檔案內容搬入 Kernel Space。
    3.  **Relocation** (符號重定位): 將程式碼中的變數引用指向正確的 Kernel 位址。
    4.  執行模組的 `init` 函數。

### 2. Symbol Versioning (版本控制)
為了防止模組亂用不相容的 API，Kernel 對每個 Export Symbol 計算 CRC Checksum (`Module.symvers`)。載入時若 CRC 不符，拒絕執行，避免 Kernel Panic。

---

## 🔷 Logic IV: 核心子系統摘要

*(詳細內容請見專屬章節)*

### 1. Kernel Synchronization (同步)
-   **Spinlock**: 忙等待，不可睡眠，用於中斷 Context。
-   **Mutex**: 會睡眠，用於 Process Context。
-   **RCU**: 讀者無鎖，寫者複製更新。適合讀多寫少。

### 2. Memory Management (記憶體)
-   **MMU**: 硬體，負責 VA -> PA 轉換。
-   **Page Table**: 軟體維護的映射表 (ARM64 通常 4 級)。
-   **Page Fault**: 當存取無效或不在 RAM 的 Page 時觸發 (Demand Paging / COW)。

---

## 📝 精選面試題 (Interview Questions)

### Q1: 請解釋 fork() 和 clone() 的區別？Thread 是怎麼產生的？
-   **fork()**: 產生一個全新的 Process，複製父 Process 的所有資源 (Copy-on-Write)，擁有獨立的 PID 和 Address Space。
-   **clone()**: 是 `fork` 的底層實作，允許細粒度控制要「共享」哪些資源。
-   **Thread 產生**: `pthread_create` 底層呼叫 `clone()` 帶上 `CLONE_VM` (共享記憶體)、`CLONE_FILES` (共享 fd)、`CLONE_SIGHAND` 等旗標。對 Kernel 來說，Thread 只是「共享了記憶體的 Process」。

### Q2: 什麼是 Context Switch？為什麼 Thread 切換比 Process 快？
-   **Context Switch**: CPU 從一個 Task 切換到另一個 Task，需保存暫存器、PC、SP。
-   **原因**:
    1.  Thread 共享 `mm_struct` (Address Space)，**不需要切換 Page Table** (暫存器 TTBR0 不變)。
    2.  這意味著 **TLB (Translation Lookaside Buffer) 不需要 Flush**，Cache Locality 得以保留，記憶體存取效能遠高於 Process 切換。

### Q3: 解釋一下 System Call 的執行流程 (以 ARM64 為例)？
1.  App 設定暫存器 `x0-x5` (參數), `x8` (Syscall ID)。
2.  執行 `svc #0` 指令，觸發 Exception。
3.  CPU 切換至 EL1，跳轉至 Vector Table (`el0_sync`)。
4.  Kernel 保存 User Context (`pt_regs`)。
5.  根據 `x8` 查表 `sys_call_table`，執行對應 C 函數。
6.  `eret` 返回 EL0。

### Q4: 什麼是 CFS Scheduler？vruntime 是什麼？
-   **CFS**: Linux 預設排程器，目標是讓每個 Task 獲得公平的 CPU 時間。
-   **vruntime (Virtual Runtime)**: 記錄 Task 實際運行的時間 (經過權重標準化)。
-   **邏輯**:
    -   紅黑樹維護所有 Runnable Tasks，以 vruntime 為 Key。
    -   每次排程器挑選 **vruntime 最小** (樹最左邊) 的 Task 執行，確保沒跑夠的人優先跑。
    -   **Nice 值** 控制 vruntime 增加的快慢：高優先級 (Nice低) vruntime 增加慢，因此能佔用更多 CPU。

### Q5: 在 Interrupt Handler (Top-half) 中可以呼叫 `mutex_lock` 嗎？
-   **不行**。`mutex_lock` 在拿不到鎖時會讓當前 Task 進入睡眠 (Sleep)。
-   Interrupt Context 不屬於任何 Process，沒有 `task_struct` 可以被 Schedule Out 再喚醒。
-   這會導致 Kernel Crash 或 Deadlock。應使用 `spinlock_irqsave`。

### Q6: 什麼是 copy_to_user / copy_from_user？為什麼不能直接 memcpy？
-   **安全性**: Kernel 不能信任 User 傳入的指標 (可能是 NULL，或指向 Kernel 記憶體)。`copy_x_user` 包含地址合法性檢查 (`access_ok`)。
-   **Page Fault 處理**: User 記憶體可能被 Swap Out 或尚未分配 (Demand Paging)。直接存取會導致 Kernel Panic，而這些專用 API 能正確捕捉 Page Fault 並修復。
