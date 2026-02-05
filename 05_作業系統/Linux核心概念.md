# 📊 Linux 核心概念完整指南

> **學習目標**
> 1. 深入理解 Linux Process/Thread 與 task_struct
> 2. 掌握 Context Switch 的底層機制
> 3. 理解 Memory Management (MMU/TLB/Page Table)
> 4. 精通 CFS Scheduler 的 vruntime 計算
> 5. 熟練使用 Spinlock/Mutex/Semaphore/RCU

---

## 📌 第一部分：Process 與 Thread

### 1.1 基本概念

#### (1) 定義
- **Process（進程）**：程式的執行實例。擁有**獨立**的資源（房子）。
  - 獨立的 Memory Space (Virtual Address Space)
  - 獨立的 File Descriptor Table
  - 獨立的 PID
- **Thread（執行緒）**：Process 內的執行單位。是住在房子裡的**人**。
  - **共享** Memory Space (Code, Data, Heap)
  - **各自**擁有 Stack 和暫存器 (CPU Context)
  - **各自**擁有 Thread ID

#### (2) 觀念釐清：房子 vs 住戶
- **Process = 房子**：提供水電、廚房、客廳（資源）。
- **Thread = 住戶**：住在房子裡的人，實際做事情（執行代碼）。
- **共享**：住戶共用客廳和廚房（共享變數、記憶體）。
- **隔離**：不同房子的人無法直接走進別人家（Process 間記憶體隔離，通訊需 IPC）。

#### (3) 實例：YouTube 撥放器 (單一 Process, 3 Threads)
為什麼需要 Thread？想像一個 YouTube 瀏覽器分頁 (Process)：

1.  **Thread A (下載工)**：負責從網路 Buffer 下載影片數據 → 丟入共享記憶體。
2.  **Thread B (解碼工)**：從共享記憶體讀取數據 → 解碼成圖片 → 丟回記憶體。
3.  **Thread C (顯示工)**：從記憶體拿出圖片 → 畫到螢幕上。

**優勢**：如果這三個是不同的 Process，它們就不能直接讀取對方的記憶體，必須透過作業系統複製資料 (IPC)，速度會慢到無法流暢播放。因為它們是 Thread (在同一個 Process 家裡)，資料放在客廳 (Heap) 大家都能直接拿，**零拷貝，速度極快**。

### 1.2 Linux 的 task_struct

```c
/* Linux Kernel 中，Process 和 Thread 統一用 task_struct 表示 */
/* 位於 include/linux/sched.h (Kernel v6.x) */

struct task_struct {
    /* 基本識別 */
    pid_t pid;                    /* Process ID */
    pid_t tgid;                   /* Thread Group ID (主 thread 的 PID) */
    
    /* 狀態 */
    volatile long state;          /* -1 unrunnable, 0 runnable, >0 stopped */
    
    /* 排程相關 */
    int prio;                     /* 動態優先權 */
    int static_prio;              /* 靜態優先權 (nice 值) */
    const struct sched_class *sched_class;  /* 排程類別 */
    struct sched_entity se;       /* CFS 排程實體 */
    
    /* 記憶體 */
    struct mm_struct *mm;         /* 記憶體描述符 */
    
    /* Stack */
    void *stack;                  /* Kernel Stack 指標 */
    
    /* 父子關係 */
    struct task_struct *parent;   /* 父進程 */
    struct list_head children;    /* 子進程列表 */
    
    /* 檔案 */
    struct files_struct *files;   /* 開啟的檔案 */
    
    /* Credentials */
    const struct cred *cred;      /* UID/GID 等 */
    
    /* ... 還有更多 ... */
};
```

### 1.3 Kernel Stack vs User Stack

```
┌──────────────────────────────────────────────────────────────┐
│                    兩種 Stack 的區別                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User Stack：                                                │
│  ┌────────────────┐                                         │
│  │  在 User Space │                                         │
│  │  大小：通常 8MB │                                         │
│  │  用途：函式呼叫、區域變數                                   │
│  │  每個 Thread 一個                                         │
│  └────────────────┘                                         │
│                                                              │
│  Kernel Stack：                                              │
│  ┌────────────────┐                                         │
│  │  在 Kernel Space│                                        │
│  │  大小：通常 8KB  │  ← 很小！不能遞迴太深                    │
│  │  用途：System call、中斷處理                               │
│  │  每個 Thread 一個                                         │
│  └────────────────┘                                         │
│                                                              │
│  為什麼 Kernel Stack 很小？                                   │
│  - Kernel 程式碼應該高效，不需要大 Stack                       │
│  - 減少記憶體使用（每個 thread 都要一個）                      │
│  - 歷史原因：早期記憶體很貴                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 1.4 Process 狀態

```
Linux 進程狀態 (task->state)：

┌──────────┬─────────────────────────────────────────────────┐
│  狀態     │ 說明                                            │
├──────────┼─────────────────────────────────────────────────┤
│ R (Running)      │ 正在執行或在 run queue 等待              │
│ S (Sleeping)     │ 可中斷睡眠，等待事件                      │
│ D (Disk Sleep)   │ 不可中斷睡眠，等待 I/O                   │
│ T (Stopped)      │ 被 signal 停止 (SIGSTOP)                 │
│ Z (Zombie)       │ 已終止，等待父進程收屍                    │
└──────────┴─────────────────────────────────────────────────┘
```

### 1.5 理論模型 vs Linux 實作

> **⚠️ 面試陷阱**
> **Q**: Linux 的 `R` (Running) 狀態一定正在佔用 CPU 嗎？
> **A**: **不一定**。它可能正在執行，也可能在 Run Queue 中等待 Scheduler 排程。Linux 將 "Ready" 和 "Running" 統一標記為 `TASK_RUNNING`。

| 教科書標準模型 (Theoretical) | Linux Kernel 實作 (`task_struct`) | 說明 |
|:---:|:---:|:---|
| **New** | *(無對應)* | `fork()` 過程極快，初始化完即變 `R`，使用者不可見。 |
| **Ready** | **R (Running)** | 在 Run Queue 等待 CPU。 |
| **Running** | **R (Running)** | 正在 CPU 上執行。 |
| **Waiting** | **S (Sleeping)** / **D (Disk Sleep)** | **S**: 可中斷睡眠 (Wait Event)。<br>**D**: 不可中斷 (Wait I/O)。 |
| **Terminated** | **Z (Zombie)** / **X (Dead)** | **Z**: 已死但在等父進程收屍。<br>**X**: 完全清理 (瞬間狀態)。 |


---

## 🔷 第二部分：Context Switch

### 2.1 什麼是 Context Switch？

```c
/* Context = CPU 執行一個 task 所需的所有狀態 */

struct pt_regs {  /* ARM64 範例 */
    u64 regs[31];    /* 通用暫存器 X0-X30 */
    u64 sp;          /* Stack Pointer */
    u64 pc;          /* Program Counter */
    u64 pstate;      /* Processor State (NZCV flags, etc.) */
};

/* Context Switch = 保存當前 context + 載入新 context */
```

### 2.2 Context Switch 觸發時機

```
1. 時間片用完 (time slice expired)
2. 高優先權 task 就緒
3. 當前 task 主動放棄 CPU (sleep, wait, yield)
4. 當前 task 終止
5. 中斷處理完成後（可能選不同 task 執行）
```

### 2.3 Context Switch 的底層實作（ARM64）

```c
/* Kernel 原始碼：arch/arm64/kernel/entry.S (簡化版) */

/*
 * 切換到新的 task
 * x0 = prev task_struct
 * x1 = next task_struct
 */
ENTRY(cpu_switch_to)
    /* 保存 prev 的 callee-saved 暫存器到 prev->thread.cpu_context */
    mov     x10, #THREAD_CPU_CONTEXT
    add     x8, x0, x10
    stp     x19, x20, [x8], #16    /* 保存 x19, x20 */
    stp     x21, x22, [x8], #16
    stp     x23, x24, [x8], #16
    stp     x25, x26, [x8], #16
    stp     x27, x28, [x8], #16
    stp     x29, lr, [x8], #16     /* 保存 fp, lr */
    str     sp, [x8]               /* 保存 stack pointer */
    
    /* 載入 next 的 context */
    add     x8, x1, x10
    ldp     x19, x20, [x8], #16    /* 載入 x19, x20 */
    ldp     x21, x22, [x8], #16
    ldp     x23, x24, [x8], #16
    ldp     x25, x26, [x8], #16
    ldp     x27, x28, [x8], #16
    ldp     x29, lr, [x8], #16     /* 載入 fp, lr */
    ldr     sp, [x8]               /* 載入 stack pointer */
    
    ret     /* 跳到 next 的 lr（上次被切換出去的位置）*/
END(cpu_switch_to)
```

### 2.4 Context Switch 開銷

開銷來源：
1. 保存/恢復暫存器 (~100 cycles)
2. 更新 TLB (如果切換 process)
3. Cache 失效 (Cold Cache)
4. Kernel 資料結構更新

減少開銷的核心技術：

#### 1. 使用 Thread 而非 Process (為何比較快？)
- **共享 Address Space**：
  - Thread 之間共享 `mm_struct` (Memory Descriptor)。
  - **切換時不需要切換 Page Table** (TTBR0/CR3 不變)。
  - **TLB 不需要 Flush**：這非常關鍵！Process 切換時因為地址空間變了，舊的 TLB entry 對新 Process 無效，必須清空。Thread 切換則保留 TLB，Cache 保持熱度 (Hot)。

- **共享資源 vs 獨立資源**：
  | 共享 (Shared) | 獨立 (Private) |
  |:---|:---|
  | **Text Segment** (程式碼) | **Kernel Stack** |
  | **Data/BSS Segment** (全域變數) | **User Stack** |
  | **Heap** (動態記憶體) | **Registers** (PC, SP, etc.) |
  | **Open Files** (FD Table) | **Thread ID** |
  | **Signal Handlers** | **Signal Mask** |

#### 2. vDSO (Virtual Dynamic Shared Object)
- **概念**：Kernel 將部分常用的、唯讀的系統資訊 (如時間) 直接映射到每個 User Process 的記憶體空間中。
- **好處**：**減少 System Call 開銷**。呼叫 `gettimeofday()` 時，程式不需要陷入 Kernel Mode (Context Switch)，而是直接從使用者空間讀取記憶體，速度快 10 倍以上。
- **範例**：`gettimeofday`, `clock_gettime`, `getcpu`。

#### 3. ASID (Address Space ID) / PCID
- **問題**：傳統 Context Switch (Process A → B) 必須 Flush 所有 TLB，因為 A 的虛擬位址 0x1000 和 B 的 0x1000 對應不同實體記憶體。
- **解法 (Hardware Optimization)**：
  - TLB Entry 增加一個欄位：`ASID` (ARM) 或 `PCID` (x86)。
  - **TLB 格式**：`Virtual Address | Physical Address | ASID: 10`
  - 切換 Process 時，CPU 只需要修改目前的 ASID 暫存器 (例如從 10 改成 11)。
  - **結果**：不需要 Flush TLB！如果 Process A 稍後又切回來，它的熱 TLB entries 可能都還在。

---

## 🔷 第三部分：記憶體管理

### 3.1 虛擬記憶體概述

```
┌──────────────────────────────────────────────────────────────┐
│        Virtual Address → Physical Address 轉換               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CPU ──VA──→ MMU ──PA──→ Memory                             │
│               ↑                                              │
│          Page Table                                          │
│                                                              │
│  MMU (Memory Management Unit)：                              │
│  - 在 CPU 內部的硬體單元                                      │
│  - 負責虛擬位址到實體位址的轉換                                │
│  - 檢查存取權限                                               │
│                                                              │
│  TLB (Translation Lookaside Buffer)：                        │
│  - Page Table 的快取                                         │
│  - 避免每次都查 Page Table                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Page Table 結構（ARM64 四級分頁）

```
64-bit Virtual Address 分解：

┌────────────────────────────────────────────────────────────┐
│ 63:48  │ 47:39  │ 38:30  │ 29:21  │ 20:12  │ 11:0         │
│ 未使用  │  L0    │  L1    │  L2    │  L3    │ Page Offset  │
│        │ (PGD)  │ (PUD)  │ (PMD)  │ (PTE)  │              │
└────────────────────────────────────────────────────────────┘

查找過程：
1. TTBR (Translation Table Base Register) 指向 L0 表
2. L0[VA[47:39]] → L1 表位址
3. L1[VA[38:30]] → L2 表位址
4. L2[VA[29:21]] → L3 表位址
5. L3[VA[20:12]] → Physical Page
6. Physical Page + VA[11:0] = Physical Address
```

### 3.3 Page Table Entry

```c
/* ARM64 Page Table Entry 格式 (簡化) */
/*
 * ┌───────────────────────────────────────────────────┐
 * │ 63:52 │ 51:12          │ 11:2      │ 1  │ 0     │
 * │ Upper │ Physical Page  │ Attributes│ AF │ Valid │
 * └───────────────────────────────────────────────────┘
 *
 * Valid: 1=有效, 0=無效(page fault)
 * AF: Access Flag，防止 TLB 污染
 * Attributes: 權限(R/W/X)、快取策略等
 */
```

### 3.4 Page Fault

```c
/* Page Fault 處理流程 */

/* 1. CPU 觸發 exception */
/* 2. Kernel 的 do_page_fault() 處理 */

static int do_page_fault(unsigned long addr, unsigned int esr,
                         struct pt_regs *regs)
{
    struct vm_area_struct *vma;
    
    vma = find_vma(current->mm, addr);
    if (!vma || addr < vma->vm_start)
        goto bad_area;  /* SIGSEGV */
    
    if (!(vma->vm_flags & VM_WRITE) && is_write_access(esr))
        goto bad_area;  /* 寫入唯讀頁面 */
    
    /* Handle the fault */
    return handle_mm_fault(vma, addr, flags, regs);
    
bad_area:
    return send_sigsegv(SIGSEGV, SEGV_MAPERR, addr, regs);
}
```

### 3.5 Memory Barrier

```c
/* 確保記憶體操作的順序 */

/* ARM64 Barriers */
__asm__ __volatile__("dmb sy" ::: "memory"); /* Data Memory Barrier */
__asm__ __volatile__("dsb sy" ::: "memory"); /* Data Sync Barrier */
__asm__ __volatile__("isb" ::: "memory");    /* Instruction Sync Barrier */

/* Linux Kernel 提供的抽象 */
mb();   /* Full memory barrier */
rmb();  /* Read memory barrier */
wmb();  /* Write memory barrier */

smp_mb();   /* SMP 用的 barrier */
smp_rmb();
smp_wmb();

/* 使用場景：
 * 1. 確保對硬體暫存器的操作順序
 * 2. 確保其他 CPU 可以看到記憶體修改
 * 3. 實作 Lock-free 資料結構
 */
```

---

## 🔷 第四部分：CFS Scheduler

### 4.1 CFS 基本概念

```
CFS (Completely Fair Scheduler)：
- Linux 2.6.23 起的預設 scheduler
- 目標：公平分配 CPU 時間
- 使用紅黑樹儲存 runnable tasks
- 選擇 vruntime 最小的 task 執行
```

### 4.2 vruntime 計算

```c
/* vruntime = 虛擬執行時間 */
/* 關鍵公式：vruntime += delta_exec * (NICE_0_LOAD / weight) */

/* 權重表 (nice 0 = 1024) */
static const int prio_to_weight[40] = {
    /* -20 */  88761, 71755, 56483, 46273, 36291,
    /* -15 */  29154, 23254, 18705, 14949, 11916,
    /* -10 */   9548,  7620,  6100,  4904,  3906,
    /*  -5 */   3121,  2501,  1991,  1586,  1277,
    /*   0 */   1024,   820,   655,   526,   423,  /* ← nice 0 */
    /*   5 */    335,   272,   215,   172,   137,
    /*  10 */    110,    87,    70,    56,    45,
    /*  15 */     36,    29,    23,    18,    15,
};

/* 範例：
 * nice 0 (weight=1024) 執行 10ms
 * vruntime += 10 * (1024 / 1024) = 10ms
 * 
 * nice -5 (weight=3121) 執行 10ms
 * vruntime += 10 * (1024 / 3121) = 3.28ms
 * 
 * nice +5 (weight=335) 執行 10ms
 * vruntime += 10 * (1024 / 335) = 30.57ms
 *
 * 結果：高優先權 task 的 vruntime 增加慢，所以更常被選中
 */
```

### 4.3 紅黑樹與 __pick_first_entity

```c
/* CFS 使用紅黑樹，按 vruntime 排序 */
/* 最左邊的節點 = vruntime 最小 = 下一個要執行的 */

struct sched_entity *__pick_first_entity(struct cfs_rq *cfs_rq)
{
    struct rb_node *left = rb_first_cached(&cfs_rq->tasks_timeline);
    if (!left)
        return NULL;
    return rb_entry(left, struct sched_entity, run_node);
}
```

---

## 🔷 第五部分：同步機制

### 5.1 Spinlock

```c
/* Spinlock：忙等待的鎖，適合短期保護 */

spinlock_t lock;
spin_lock_init(&lock);

spin_lock(&lock);
/* 臨界區：不能睡眠！ */
spin_unlock(&lock);

/* 如果可能在中斷中使用 */
unsigned long flags;
spin_lock_irqsave(&lock, flags);   /* 禁用中斷 + 取得鎖 */
/* 臨界區 */
spin_unlock_irqrestore(&lock, flags);

/* 特點：
 * ✓ 低延遲（不需要 context switch）
 * ✓ 可在 interrupt context 使用
 * ✗ 不能睡眠
 * ✗ 持有時間長會浪費 CPU
 */
```

### 5.2 Mutex

```c
/* Mutex：可睡眠的鎖，適合較長的臨界區 */

struct mutex my_mutex;
mutex_init(&my_mutex);

mutex_lock(&my_mutex);
/* 臨界區：可以睡眠 */
/* 可以做 copy_from_user、kmalloc(GFP_KERNEL) 等 */
mutex_unlock(&my_mutex);

/* 特點：
 * ✓ 可以睡眠（等待時不佔 CPU）
 * ✓ 適合較長的臨界區
 * ✗ 不能在 interrupt context 使用
 * ✗ 開銷比 spinlock 大
 */
```

### 5.3 Semaphore

```c
/* Semaphore：計數器形式的同步 */

struct semaphore sem;
sema_init(&sem, 5);  /* 初始計數 = 5 */

down(&sem);          /* 計數 -1，如果 0 則等待 */
/* 使用資源 */
up(&sem);            /* 計數 +1 */

/* vs Mutex：
 * Mutex: 只能 0 或 1，只有持有者可以解鎖
 * Semaphore: 可以 > 1，任何人都可以 up
 */
```

### 5.4 RCU (Read-Copy-Update)

```c
/* RCU：Read 不需要鎖，適合讀多寫少的場景 */

/* 讀取端 */
rcu_read_lock();
struct my_data *p = rcu_dereference(global_ptr);
/* 使用 p */
rcu_read_unlock();

/* 寫入端 */
struct my_data *old, *new;
new = kmalloc(sizeof(*new), GFP_KERNEL);
/* 填充 new */
old = rcu_dereference(global_ptr);
rcu_assign_pointer(global_ptr, new);
synchronize_rcu();  /* 等待所有 reader 完成 */
kfree(old);

/* 特點：
 * ✓ Read 幾乎零開銷
 * ✓ 非常適合讀多寫少（如路由表）
 * ✗ Write 需要複製
 * ✗ 理解和使用較複雜
 */
```

### 5.5 各種鎖的比較

| 特性 | Spinlock | Mutex | Semaphore | RCU |
|:---|:---|:---|:---|:---|
| 可以睡眠？ | ❌ | ✅ | ✅ | Read: ❌ |
| Interrupt Context? | ✅ | ❌ | ❌ | Read: ✅ |
| 開銷 | 低 | 中 | 中 | Read: 極低 |
| 適用場景 | 短臨界區 | 長臨界區 | 資源計數 | 讀多寫少 |

---

## 📝 面試題庫

### Q1: CFS 如何計算 vruntime？Load weight 的作用？

**難度**：⭐⭐⭐⭐⭐
**常見於**：Google / FB kernel 團隊

**答案**：
```
vruntime += delta_exec * (NICE_0_LOAD / weight)

- weight 來自 nice 值對應的權重表
- nice 0 的 weight = 1024
- 高優先權（負 nice）的 weight 大，vruntime 增加慢
- 紅黑樹選擇 vruntime 最小的，所以高優先權更常執行

例如：nice -5 (weight=3121) 執行 10ms
vruntime += 10 * 1024/3121 = 3.28ms
比 nice 0 增加少 3 倍，所以獲得更多 CPU 時間
```

### Q2: Spinlock 和 Mutex 的區別？什麼時候用哪個？

**難度**：⭐⭐⭐⭐

**答案**：
- **Spinlock**：忙等待，不能睡眠，可在中斷中使用，適合短臨界區
- **Mutex**：可以睡眠，不能在中斷中使用，適合長臨界區

選擇原則：
- 臨界區很短（< 幾 μs）→ Spinlock
- 臨界區可能睡眠（I/O、分配記憶體）→ Mutex
- 在中斷處理中 → Spinlock + irqsave

### Q3: 什麼是 TLB？TLB Miss 會怎樣？

**難度**：⭐⭐⭐⭐

**答案**：
TLB (Translation Lookaside Buffer) 是 Page Table 的快取。

TLB Hit：直接得到實體位址，極快
TLB Miss：
1. 從 Page Table 查找（多次記憶體存取）
2. 更新 TLB
3. 如果 Page 不在記憶體 → Page Fault

減少 Miss：
- 使用 Huge Pages
- ASID 減少 TLB flush
- 最佳化記憶體存取 locality

### Q4: 在 Interrupt Context 可以呼叫 mutex_lock() 嗎？

**難度**：⭐⭐⭐⭐⭐

**答案**：
**不可以！**

原因：
- mutex_lock() 可能睡眠
- 睡眠需要 context switch
- Context switch 需要 process context
- Interrupt context 沒有 process 可以切出去

會發生：
- Kernel 會 BUG() 報錯
- 或系統 hang

替代方案：
- 使用 spin_lock_irqsave()
- 或用 workqueue 延遲到 process context 處理

---

## 🔷 第六部分：中斷處理機制

### 6.1 Top-half vs Bottom-half

```
中斷處理分為兩部分，以減少中斷禁用時間：

┌──────────────────────────────────────────────────────────────┐
│                    中斷處理機制                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Top-half (Hardirq)                                          │
│  ─────────────────                                           │
│  - 立即執行                                                   │
│  - 禁用中斷期間                                               │
│  - 必須快速完成                                               │
│  - 不能睡眠                                                   │
│  - 工作：清除中斷、讀取緊急資料、排程 Bottom-half             │
│                                                              │
│  Bottom-half                                                  │
│  ───────────                                                 │
│  1. Softirq：最底層，Kernel 編譯時定義                        │
│  2. Tasklet：基於 Softirq，不能睡眠                            │
│  3. Workqueue：在 Process Context 執行，可以睡眠              │
│  4. Threaded IRQ：專用 Kernel Thread，現代 Driver 推薦        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Softirq 類型

```c
/* Kernel 預定義的 Softirq 類型 */
enum {
    HI_SOFTIRQ = 0,      /* 高優先權 tasklet */
    TIMER_SOFTIRQ,       /* Timer */
    NET_TX_SOFTIRQ,      /* 網路發送 */
    NET_RX_SOFTIRQ,      /* 網路接收 */
    BLOCK_SOFTIRQ,       /* Block device */
    IRQ_POLL_SOFTIRQ,    /* IRQ polling */
    TASKLET_SOFTIRQ,     /* Tasklet */
    SCHED_SOFTIRQ,       /* Scheduler */
    HRTIMER_SOFTIRQ,     /* High-resolution timer */
    RCU_SOFTIRQ,         /* RCU */
    NR_SOFTIRQS
};

/* Softirq 執行時機：
 * 1. Hardirq 返回時（irq_exit()）
 * 2. local_bh_enable()
 * 3. ksoftirqd kernel thread（如果 softirq 太多）
 */
```

### 6.3 Workqueue vs Tasklet

```c
/* Tasklet：不能睡眠 */
static void my_tasklet_handler(unsigned long data)
{
    /* 不能使用 mutex，不能呼叫可能睡眠的函式 */
    spin_lock(&my_lock);
    /* 快速處理 */
    spin_unlock(&my_lock);
}
static DECLARE_TASKLET(my_tasklet, my_tasklet_handler, 0);

/* 在 ISR 中排程 */
tasklet_schedule(&my_tasklet);

/* Workqueue：可以睡眠 */
static void my_work_handler(struct work_struct *work)
{
    /* 可以使用 mutex，可以做 I/O 操作 */
    mutex_lock(&my_mutex);
    /* 耗時處理 */
    mutex_unlock(&my_mutex);
}
static DECLARE_WORK(my_work, my_work_handler);

/* 在 ISR 中排程 */
schedule_work(&my_work);
```

---

## 🔷 第七部分：Deadlock 與 Priority Inversion

### 7.1 Deadlock 條件

```
Deadlock 發生需要同時滿足四個條件：

1. Mutual Exclusion（互斥）
   - 資源一次只能被一個 task 持有

2. Hold and Wait（持有並等待）
   - 持有資源的同時等待另一個資源

3. No Preemption（不可搶占）
   - 已持有的資源不能被強制釋放

4. Circular Wait（循環等待）
   - 形成等待資源的環狀結構

打破任一條件就可避免 Deadlock。
```

### 7.2 Deadlock 預防

```c
/* 方法 1：固定鎖順序（最常用） */
/* 總是按照相同順序取得多個鎖 */

/* 錯誤 */
/* Thread A: lock(A) → lock(B) */
/* Thread B: lock(B) → lock(A)  ← Deadlock! */

/* 正確：定義順序 A < B，總是先鎖 A */
mutex_lock(&lock_A);
mutex_lock(&lock_B);
/* ... */
mutex_unlock(&lock_B);
mutex_unlock(&lock_A);

/* 方法 2：Trylock */
if (mutex_trylock(&lock_B)) {
    /* 成功取得 */
} else {
    mutex_unlock(&lock_A);  /* 釋放已持有的 */
    /* 稍後重試 */
}

/* 方法 3：使用 lockdep 工具偵測 */
/* CONFIG_PROVE_LOCKING 開啟 */
/* Kernel 會追蹤鎖的取得順序，發現潛在問題時警告 */
```

### 7.3 Priority Inversion

```
Priority Inversion：高優先權任務被低優先權任務阻擋

場景：
1. 低優先權 Task L 持有 Lock
2. 高優先權 Task H 需要 Lock，被阻塞
3. 中優先權 Task M 搶占 Task L
4. 結果：Task H 等待 Task M 完成！

解決方案：
┌─────────────────────┬────────────────────────────────────────┐
│ Priority Inheritance │ 持有 Lock 的 Task 暫時提升優先權       │
│ Priority Ceiling    │ Lock 有固定的最高優先權                │
└─────────────────────┴────────────────────────────────────────┘

Linux Kernel 實作：
- rt_mutex：支援 Priority Inheritance
- 普通 mutex：不支援（因為通常不用於 RT）
```

---

## 📝 更多面試題

### Q5: fork() 和 clone() 的差異？

**難度**：⭐⭐⭐⭐

**答案**：
```
fork()：
- 建立完整的 Process 副本
- 複製整個 address space（COW）
- 不共享任何資源
- 回傳兩次（父子各一次）

clone()：
- 可選擇共享哪些資源
- CLONE_VM：共享 address space（Thread 的本質）
- CLONE_FILES：共享 file descriptor table
- CLONE_SIGHAND：共享 signal handler

關係：
- fork() 內部呼叫 clone() + 特定 flags
- pthread_create() 呼叫 clone(CLONE_VM | CLONE_FS | ...)
- vfork() 呼叫 clone(CLONE_VFORK | CLONE_VM | ...)
```

### Q6: 什麼是 Copy-on-Write (COW)？

**難度**：⭐⭐⭐⭐

**答案**：
```
COW 是一種延遲複製優化技術。

fork() 時：
1. 不複製整個 address space
2. 父子共享相同的 Page（標記為 Read-only）
3. 任一方寫入時，觸發 Page Fault
4. 此時才複製該 Page（私有副本）

優點：
- fork() 很快（只複製 page table）
- 只複製實際被修改的 page
- 對 fork + exec 特別有效（exec 會丟棄原有 pages）

實作：
- Page Table Entry 設定為 Read-only
- 寫入時觸發 Page Fault
- do_wp_page() 處理：分配新 page，複製內容，更新 mapping
```

### Q7: 什麼是 OOM Killer？

**難度**：⭐⭐⭐⭐

**答案**：
```
OOM (Out of Memory) Killer 在記憶體耗盡時終止 process。

觸發時機：
1. 記憶體不足且無法回收
2. 或記憶體壓力過大

選擇受害者：
- 計算 oom_score（基於記憶體使用量）
- 考慮 oom_score_adj（使用者調整值）
- 選擇分數最高的 process 殺死

調整 OOM 行為：
# 查看/設定 oom_score_adj (-1000 到 1000)
cat /proc/<pid>/oom_score_adj
echo -1000 > /proc/<pid>/oom_score_adj  # 永不被殺

避免 OOM：
- 合理設定 vm.overcommit_memory
- 使用 cgroups 限制記憶體
- 給關鍵 process 設定低 oom_score_adj
```

### Q8: 解釋 Kernel 的 Preemption Model

**難度**：⭐⭐⭐⭐⭐

**答案**：
```
Linux 提供多種搶占模型：

1. PREEMPT_NONE（無搶占）
   - 只在 syscall 返回時才可能 schedule
   - 適合：Server（最大吞吐量）

2. PREEMPT_VOLUNTARY
   - 在特定檢查點允許搶占
   - 適合：Desktop

3. PREEMPT（完全搶占）
   - 除了持有 spinlock 外，可以隨時搶占
   - 適合：低延遲需求

4. PREEMPT_RT（Real-Time）
   - 將 spinlock 改為可搶占的 rt_mutex
   - 極低延遲
   - 適合：工業控制、音訊

preempt_count：
- 搶占計數器，> 0 時禁止搶占
- spin_lock：preempt_count++
- spin_unlock：preempt_count--
```

### Q9: 什麼是 LKML 常見的 Race Condition Pattern？

**難度**：⭐⭐⭐⭐⭐

**答案**：
```c
/* Pattern 1: TOCTOU (Time-of-Check to Time-of-Use) */
/* 錯誤 */
if (ptr != NULL) {
    /* 另一個 thread 可能在此時清除 ptr */
    use(ptr);
}
/* 正確 */
spin_lock(&lock);
if (ptr != NULL)
    use(ptr);
spin_unlock(&lock);

/* Pattern 2: Double Fetch */
/* 錯誤：從 user space 讀取兩次 */
if (copy_from_user(&size, uptr, sizeof(size)))
    return -EFAULT;
/* 惡意程式可能在兩次讀取之間修改 */
buf = kmalloc(size, GFP_KERNEL);
copy_from_user(buf, uptr + sizeof(size), size);  /* size 可能已變 */

/* 正確：一次複製到 kernel */
struct user_data data;
copy_from_user(&data, uptr, sizeof(data));
/* 使用 kernel 中的 data.size */

/* Pattern 3: Use-After-Free */
/* ISR 和主程式共享資料結構時特別危險 */
kfree(ptr);
ptr = NULL;  /* 即使設為 NULL，另一個 CPU 可能已拿到舊值 */

/* 使用 RCU 安全釋放 */
call_rcu(&ptr->rcu, free_callback);
```

### Q10: Memory Barrier 使用範例？

**難度**：⭐⭐⭐⭐⭐

**答案**：
```c
/* Producer-Consumer Pattern */

/* 錯誤：CPU 可能重排序 */
producer:
    data = 42;
    ready = 1;

consumer:
    while (!ready);
    use(data);  /* 可能讀到舊的 data！ */

/* 正確：使用 Memory Barrier */
producer:
    data = 42;
    smp_wmb();  /* Write barrier: data 一定在 ready 之前寫入 */
    ready = 1;

consumer:
    while (!ready);
    smp_rmb();  /* Read barrier: ready 之後的讀取不會被提前 */
    use(data);

/* 更好的做法：使用 atomic 配對 */
producer:
    WRITE_ONCE(data, 42);
    smp_store_release(&ready, 1);

consumer:
    while (!smp_load_acquire(&ready));
    use(READ_ONCE(data));
```

---

## 🔷 第八部分：System Call 完整流程

### 8.1 什麼是 System Call？

```
┌──────────────────────────────────────────────────────────────┐
│                System Call 概念                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User Space 程式無法直接存取硬體或 Kernel 資料                │
│  → 透過 System Call 向 Kernel 請求服務                       │
│                                                              │
│  ┌───────────────┐      svc #0      ┌───────────────┐       │
│  │  User Space   │ ───────────────► │ Kernel Space  │       │
│  │  (EL0)        │                  │ (EL1)         │       │
│  │               │ ◄─────────────── │               │       │
│  │  Application  │      eret        │  sys_xxx()    │       │
│  └───────────────┘                  └───────────────┘       │
│                                                              │
│  常見 System Call：                                           │
│  - 檔案操作：open, read, write, close                        │
│  - Process 管理：fork, exec, exit, wait                      │
│  - 記憶體管理：mmap, brk, mprotect                            │
│  - 網路：socket, connect, send, recv                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 ARM64 System Call 執行流程

```
┌──────────────────────────────────────────────────────────────┐
│           ARM64 System Call 完整流程                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User Space 準備                                           │
│     ├─► 將 syscall number 放入 x8                            │
│     ├─► 將參數放入 x0-x5 (最多 6 個參數)                      │
│     └─► 執行 svc #0 指令                                     │
│                                                              │
│  2. 硬體處理 (CPU)                                            │
│     ├─► 切換到 EL1 (Exception Level 1)                       │
│     ├─► 保存 PC 到 ELR_EL1                                   │
│     ├─► 保存 PSTATE 到 SPSR_EL1                              │
│     └─► 跳轉到 Exception Vector (VBAR_EL1 + offset)          │
│                                                              │
│  3. Kernel Entry (entry.S)                                    │
│     ├─► el0_sync (同步異常入口)                               │
│     ├─► kernel_entry 0 (保存所有暫存器到 pt_regs)            │
│     ├─► 判斷 ESR_EL1 確認是 SVC                               │
│     └─► 呼叫 el0_svc()                                       │
│                                                              │
│  4. System Call 分發                                          │
│     ├─► 從 x8 讀取 syscall number                            │
│     ├─► 查表 sys_call_table[nr]                              │
│     └─► 呼叫對應的 sys_xxx() 函式                            │
│                                                              │
│  5. Kernel Exit                                               │
│     ├─► 將返回值放入 x0                                       │
│     ├─► ret_to_user (恢復 pt_regs)                           │
│     └─► eret (返回 EL0)                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 ARM64 Entry Code 詳解

```c
/* arch/arm64/kernel/entry.S (簡化版) */

/*
 * Exception Vector Table
 * 位於 VBAR_EL1 指向的位址
 */
    .align  11
ENTRY(vectors)
    /* Current EL with SP0 */
    ventry  el1_sync_invalid
    ventry  el1_irq_invalid
    ventry  el1_fiq_invalid
    ventry  el1_error_invalid

    /* Current EL with SPx */
    ventry  el1_sync         /* Kernel 自己的 synchronous exception */
    ventry  el1_irq          /* Kernel 的 IRQ */
    ventry  el1_fiq_invalid
    ventry  el1_error_invalid

    /* Lower EL using AArch64 (User Space 64-bit) */
    ventry  el0_sync         /* ← User Space syscall 進入這裡！ */
    ventry  el0_irq
    ventry  el0_fiq_invalid
    ventry  el0_error_invalid

    /* Lower EL using AArch32 (User Space 32-bit) */
    ventry  el0_sync_compat
    ventry  el0_irq_compat
    ...
END(vectors)

/*
 * el0_sync - 處理來自 EL0 的同步異常
 */
el0_sync:
    kernel_entry 0          /* 保存 User Context 到 pt_regs */
    
    mrs     x25, esr_el1    /* 讀取 Exception Syndrome Register */
    lsr     x24, x25, #ESR_ELx_EC_SHIFT  /* 取得 Exception Class */
    
    cmp     x24, #ESR_ELx_EC_SVC64  /* 是 SVC (System Call) 嗎？ */
    b.eq    el0_svc         /* 是，跳到 syscall 處理 */
    
    cmp     x24, #ESR_ELx_EC_DABT_LOW  /* Data Abort？ */
    b.eq    el0_da          /* Page Fault */
    
    /* 其他異常類型... */
    b       el0_inv

/*
 * el0_svc - System Call 處理
 */
el0_svc:
    /* 關閉 Interrupt，進入臨界區 */
    msr     daifclr, #(8 | 4 | 1)  /* Enable D, A, I */
    
    /* 呼叫 C 函式 */
    bl      el0_svc_handler
    
    /* 返回 User Space */
    b       ret_to_user
```

### 8.4 System Call Handler

```c
/* arch/arm64/kernel/syscall.c */

void el0_svc_handler(struct pt_regs *regs)
{
    unsigned long scno = regs->regs[8];  /* x8 = syscall number */
    
    /* 1. 追蹤 (如果有開啟 syscall tracing) */
    if (unlikely(test_thread_flag(TIF_SYSCALL_TRACE)))
        scno = syscall_trace_enter(regs);
    
    /* 2. 檢查 syscall number 是否有效 */
    if (scno < NR_syscalls) {
        /* 3. 呼叫對應的 syscall handler */
        regs->regs[0] = invoke_syscall(regs, scno);
    } else {
        regs->regs[0] = -ENOSYS;  /* 無效的 syscall */
    }
    
    /* 4. 追蹤返回 */
    syscall_trace_exit(regs);
}

static long invoke_syscall(struct pt_regs *regs, unsigned int scno)
{
    syscall_fn_t syscall_fn;
    
    /* 查表取得函式指標 */
    syscall_fn = sys_call_table[scno];
    
    /* 呼叫 syscall，參數從 x0-x5 傳入 */
    return syscall_fn(
        regs->regs[0],  /* arg1 */
        regs->regs[1],  /* arg2 */
        regs->regs[2],  /* arg3 */
        regs->regs[3],  /* arg4 */
        regs->regs[4],  /* arg5 */
        regs->regs[5]   /* arg6 */
    );
}
```

### 8.5 System Call Table

```c
/* arch/arm64/kernel/sys.c */

/* Syscall 函式宣告 */
#define __SYSCALL(nr, sym)  asmlinkage long __arm64_##sym(const struct pt_regs *);
#include <asm/unistd.h>

#undef __SYSCALL
#define __SYSCALL(nr, sym)  [nr] = __arm64_##sym,

/* 建立 syscall table */
const syscall_fn_t sys_call_table[__NR_syscalls] = {
    [0 ... __NR_syscalls - 1] = __arm64_sys_ni_syscall,  /* 預設：未實作 */
#include <asm/unistd.h>  /* 展開所有 syscall */
};

/* 範例 syscall 定義 */
/* include/uapi/asm-generic/unistd.h */
#define __NR_read 63
#define __NR_write 64
#define __NR_openat 56
#define __NR_close 57
/* ... */
```

### 8.6 從 User Space 到 Kernel 的完整範例

```c
/* User Space: 呼叫 write() */

#include <unistd.h>

int main() {
    write(1, "Hello\n", 6);  /* stdout, 字串, 長度 */
    return 0;
}

/* 編譯後的組語 (glibc wrapper) */
/*
    mov     x0, #1          ; fd = 1 (stdout)
    adr     x1, message     ; buf = "Hello\n"
    mov     x2, #6          ; count = 6
    mov     x8, #64         ; syscall number = __NR_write
    svc     #0              ; 觸發 syscall
    ; 返回後 x0 = 寫入的 byte 數
*/
```

```c
/* Kernel Space: sys_write 處理 */

/* fs/read_write.c */
SYSCALL_DEFINE3(write, unsigned int, fd, const char __user *, buf,
                size_t, count)
{
    struct fd f = fdget_pos(fd);
    ssize_t ret = -EBADF;
    
    if (!f.file)
        return -EBADF;
    
    /* 權限檢查 */
    if (!(f.file->f_mode & FMODE_WRITE))
        goto out;
    
    /* 呼叫 VFS 層 */
    ret = vfs_write(f.file, buf, count, &pos);
    
out:
    fdput_pos(f);
    return ret;
}
```

### 8.7 vDSO (Virtual Dynamic Shared Object)

```c
/*
 * vDSO：不需要真正進入 Kernel 的 "快速 syscall"
 * 
 * 常見 vDSO 函式：
 * - gettimeofday()
 * - clock_gettime()
 * - getcpu()
 * 
 * 原理：
 * - Kernel 將唯讀資料 (如時間) 映射到 User Space
 * - User Space 直接讀取，不需要 mode switch
 * - 速度提升 10x+
 */

/* User Space 呼叫 clock_gettime() */
#include <time.h>
struct timespec ts;
clock_gettime(CLOCK_MONOTONIC, &ts);
/* 實際上沒有進入 Kernel！直接從 vDSO 頁面讀取 */

/* vDSO 記憶體映射 */
/*
 * 0x00007ffff7ffd000  vdso (由 Kernel 自動映射)
 *    ├── __vdso_clock_gettime
 *    ├── __vdso_gettimeofday
 *    └── __vdso_getcpu
 */
```

---

## 🔷 第九部分：Kernel Module

### 9.1 什麼是 Kernel Module？

```
┌──────────────────────────────────────────────────────────────┐
│                Kernel Module 概念                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Kernel Module = 可動態載入/卸載的 Kernel 程式碼              │
│                                                              │
│  優點：                                                       │
│  ✓ 不需重新編譯整個 Kernel                                    │
│  ✓ 節省記憶體（只載入需要的模組）                              │
│  ✓ 方便開發和除錯                                             │
│                                                              │
│  缺點：                                                       │
│  ✗ 每個模組都有額外開銷                                       │
│  ✗ 模組間介面需要穩定                                         │
│  ✗ 安全風險（可載入惡意模組）                                  │
│                                                              │
│  常見用途：                                                   │
│  - 裝置驅動 (Device Drivers)                                 │
│  - 檔案系統 (ext4, btrfs)                                    │
│  - 網路協定 (IPv6, netfilter)                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 最簡單的 Kernel Module

```c
/* hello.c - 最簡單的 Kernel Module */

#include <linux/module.h>    /* 所有模組都需要 */
#include <linux/kernel.h>    /* printk() */
#include <linux/init.h>      /* __init, __exit */

/* 模組元資料 */
MODULE_LICENSE("GPL");
MODULE_AUTHOR("Your Name");
MODULE_DESCRIPTION("A simple hello world module");
MODULE_VERSION("1.0");

/* 模組載入時執行 */
static int __init hello_init(void)
{
    printk(KERN_INFO "Hello, Kernel World!\n");
    return 0;  /* 0 = 成功，非零 = 失敗 */
}

/* 模組卸載時執行 */
static void __exit hello_exit(void)
{
    printk(KERN_INFO "Goodbye, Kernel World!\n");
}

/* 註冊 init 和 exit 函式 */
module_init(hello_init);
module_exit(hello_exit);
```

### 9.3 Makefile for Kernel Module

```makefile
# Makefile

obj-m := hello.o

# 如果是多檔案模組
# hello-objs := file1.o file2.o

KDIR := /lib/modules/$(shell uname -r)/build
PWD := $(shell pwd)

all:
	$(MAKE) -C $(KDIR) M=$(PWD) modules

clean:
	$(MAKE) -C $(KDIR) M=$(PWD) clean

# 使用方式：
# $ make
# $ sudo insmod hello.ko
# $ dmesg | tail
# $ sudo rmmod hello
```

### 9.4 模組參數

```c
/* 模組參數允許載入時傳入設定 */

#include <linux/moduleparam.h>

/* 定義參數 */
static int debug_level = 0;
static char *device_name = "mydev";

/* 註冊參數 */
module_param(debug_level, int, S_IRUGO | S_IWUSR);
MODULE_PARM_DESC(debug_level, "Debug level (0-3)");

module_param(device_name, charp, S_IRUGO);
MODULE_PARM_DESC(device_name, "Device name");

/* 使用方式：
 * $ sudo insmod mymodule.ko debug_level=2 device_name="dev0"
 * 
 * 查看參數：
 * $ cat /sys/module/mymodule/parameters/debug_level
 */
```

### 9.5 Symbol Export (符號導出)

```c
/*
 * 模組間共享函式和變數
 */

/* 模組 A：導出符號 */
int my_shared_function(int arg)
{
    return arg * 2;
}
EXPORT_SYMBOL(my_shared_function);      /* 所有模組可見 */
/* 或 EXPORT_SYMBOL_GPL(my_shared_function); 只對 GPL 模組可見 */

/* 模組 B：使用模組 A 的函式 */
extern int my_shared_function(int arg);

static int __init moduleB_init(void)
{
    int result = my_shared_function(21);
    printk("Result: %d\n", result);
    return 0;
}

/* 載入順序很重要！
 * 1. 先載入模組 A
 * 2. 再載入模組 B
 * 
 * 否則模組 B 會因為找不到符號而載入失敗
 */
```

### 9.6 Module 載入流程

```
┌──────────────────────────────────────────────────────────────┐
│              insmod / modprobe 載入流程                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User Space: insmod hello.ko                               │
│     └─► 呼叫 init_module() syscall                           │
│                                                              │
│  2. Kernel: load_module()                                     │
│     ├─► 驗證 ELF 格式                                         │
│     ├─► 分配 Kernel 記憶體                                    │
│     ├─► 複製模組程式碼和資料                                  │
│     ├─► 解析符號 (Relocation)                                │
│     ├─► 處理模組依賴                                          │
│     └─► 呼叫 module->init() (你的 init 函式)                  │
│                                                              │
│  3. 模組現在是 Kernel 的一部分！                               │
│                                                              │
│  insmod vs modprobe：                                         │
│  - insmod: 只載入指定模組，不處理依賴                         │
│  - modprobe: 自動處理模組依賴 (從 /lib/modules/)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 9.7 devm_ API (Device Managed Resources)

```c
/*
 * devm_* API：Driver 開發中非常重要！
 * 
 * 自動在 Driver 卸載時釋放資源，避免記憶體洩漏
 */

/* 傳統做法：手動管理 */
static int my_probe(struct platform_device *pdev)
{
    struct my_data *data;
    int ret;
    
    data = kmalloc(sizeof(*data), GFP_KERNEL);
    if (!data)
        return -ENOMEM;
    
    ret = request_irq(irq, handler, 0, "mydev", data);
    if (ret) {
        kfree(data);  /* 必須手動釋放！容易忘記 */
        return ret;
    }
    
    /* ... */
    return 0;
}

static int my_remove(struct platform_device *pdev)
{
    free_irq(irq, data);  /* 必須手動釋放 */
    kfree(data);          /* 必須手動釋放 */
    return 0;
}

/* 使用 devm_：自動管理 */
static int my_probe(struct platform_device *pdev)
{
    struct my_data *data;
    int ret;
    
    /* devm_kzalloc：當 device 移除時自動釋放 */
    data = devm_kzalloc(&pdev->dev, sizeof(*data), GFP_KERNEL);
    if (!data)
        return -ENOMEM;
    
    /* devm_request_irq：當 device 移除時自動 free_irq */
    ret = devm_request_irq(&pdev->dev, irq, handler, 0, "mydev", data);
    if (ret)
        return ret;  /* 不需要手動釋放 data！ */
    
    return 0;
}

static int my_remove(struct platform_device *pdev)
{
    /* 什麼都不需要做！devm_ 自動處理 */
    return 0;
}
```

### 9.8 常見 devm_ API

| API | 功能 |
|:---|:---|
| `devm_kzalloc()` | 配置並清零記憶體 |
| `devm_kmalloc()` | 配置記憶體 |
| `devm_request_irq()` | 註冊中斷 |
| `devm_ioremap()` | 映射 I/O 記憶體 |
| `devm_clk_get()` | 取得 clock |
| `devm_gpio_request()` | 請求 GPIO |
| `devm_regulator_get()` | 取得 regulator |
| `devm_pinctrl_get()` | 取得 pinctrl |

---

## 📝 更多面試題

### Q11: 解釋 ARM64 System Call 的完整流程

**難度**：⭐⭐⭐⭐⭐
**常見於**：ARM 相關職位 / NVIDIA

**問題**：
描述當 User Space 呼叫 write() 時，從 User Space 到 Kernel 再返回的完整流程。

**標準答案**：

1. **User Space 準備**：
   - x0-x5 = 參數 (fd, buf, count, ...)
   - x8 = syscall number (__NR_write = 64)
   - 執行 `svc #0`

2. **CPU 硬體處理**：
   - 切換到 EL1
   - 保存 PC 到 ELR_EL1，PSTATE 到 SPSR_EL1
   - 跳轉到 Exception Vector (el0_sync)

3. **Kernel Entry (entry.S)**：
   - `kernel_entry 0` 保存所有暫存器到 pt_regs
   - 讀取 ESR_EL1 判斷是 SVC
   - 呼叫 `el0_svc_handler()`

4. **Syscall 分發**：
   - 從 x8 讀取 syscall number
   - 查 `sys_call_table[64]` 取得 `sys_write` 指標
   - 呼叫 `sys_write(fd, buf, count)`

5. **返回 User Space**：
   - 返回值放入 x0
   - `ret_to_user` 恢復 pt_regs
   - `eret` 返回 EL0

---

### Q12: 什麼是 vDSO？它如何加速 syscall？

**難度**：⭐⭐⭐⭐

**標準答案**：

**vDSO (Virtual Dynamic Shared Object)**：
- Kernel 自動映射到每個 Process 的共享記憶體區
- 包含不需要真正進入 Kernel 的 "快速 syscall"

**工作原理**：
- Kernel 將唯讀資料（如時間）映射到 User Space
- glibc 呼叫 vDSO 函式直接讀取，不觸發 mode switch
- 節省大約 100-200 cycles

**常見 vDSO 函式**：
- `clock_gettime()`
- `gettimeofday()`
- `getcpu()`

---

### Q13: `devm_request_irq` 和 `request_irq` 有什麼區別？

**難度**：⭐⭐⭐⭐
**常見於**：普遍（Driver 開發必問）

**標準答案**：

| 特性 | request_irq | devm_request_irq |
|:---|:---|:---|
| 資源管理 | 手動 | 自動 |
| 釋放方式 | 必須呼叫 free_irq() | Device 移除時自動釋放 |
| 記憶體洩漏風險 | 高（容易忘記釋放）| 低（自動管理）|
| 適用場景 | 需要精確控制生命週期 | 一般 Driver 開發 |

**最佳實踐**：
- Driver 開發優先使用 `devm_` 系列 API
- 減少樣板程式碼，降低 bug 風險
- 讓 remove() 函式盡可能簡單

---

### Q14: EXPORT_SYMBOL 和 EXPORT_SYMBOL_GPL 有什麼區別？

**難度**：⭐⭐⭐

**標準答案**：

| 特性 | EXPORT_SYMBOL | EXPORT_SYMBOL_GPL |
|:---|:---|:---|
| 可見範圍 | 所有模組 | 僅 GPL 授權模組 |
| 使用場景 | 通用 API | 核心內部 API |

**GPL 限制的原因**：
- 保護 Kernel 核心功能
- 鼓勵開放原始碼
- 阻止專有驅動使用深層 Kernel API

**常見 GPL-only 符號**：
- `schedule()`
- `kmalloc()` 的某些變體
- 許多 Power Management API

---

## 🔷 第八部分：深入核心機制 (Tier 1 必考)

### 8.1 ARM64 System Call 完整路徑

當 User Space 程式呼叫 `read()` 時，到底發生了什麼？這題能展現你對 Computer Architecture 和 OS 互動的深度理解。

```
User Space:
  1. app 呼叫 read() (glibc wrapper)
  2. glibc 將 system call number (如 63) 放入 x8 register
  3. glibc 執行 `svc #0` (Supervisor Call) 指令
       ↓
       ↓ (Exception Level switch: EL0 -> EL1)
       ↓
Kernel Space (ARM64):
  4. 觸發 Synchronous Exception
  5. CPU 跳轉到 Vector Table (arch/arm64/kernel/entry.S)
  6. 執行 `el0_sync` (處理來自 EL0 的同步異常)
  7. 執行 `el0_svc`
  8. 查表 `sys_call_table` (依據 x8 register 的 index)
  9. 執行 `sys_read()` (fs/read_write.c)
       ↓
  10. 執行實際的 VFS 讀取操作
       ↓
  11. `ret_to_user` (恢復 User Space Context)
       ↓ (ERET 指令)
User Space:
  12. read() 返回
```

**關鍵面試點**：
- **Context Saving**：進入 Kernel 時，必須保存 User Space 的暫存器 (x0-x30, sp, pc, pstate) 到 `pt_regs` 結構中 (位於 Kernel Stack)。
- **Table Lookup**：`sys_call_table` 是一個函式指標陣列。
- **Security**：Kernel 必須驗證 User 傳入的 Buffer 指標是否合法 (`access_ok`)，防止 User 騙 Kernel 去讀寫 Kernel Memory。

### 8.2 SMP (Symmetric Multi-Processing) 啟動流程

多核心 CPU 是如何一顆一顆被叫醒的？
通常系統上電時，只有 **Boot CPU (CPU 0)** 會執行，其他 **Secondary CPUs** 處於深層睡眠 (Power off / WFE)。

```
1. Boot CPU (CPU 0) 執行:
   start_kernel()
     ↓
   rest_init()
     ↓
   kernel_init()
     ↓
   smp_init()  (開始叫醒其他人)
     ↓
   for_each_present_cpu(cpu):
       cpu_up(cpu)
         ↓
       __cpu_up(cpu)
         ↓
       PSCI (Power State Coordination Interface) Call
         (透過 SMC 指令呼叫 ATF/TF-A)

2. ATF (EL3) 收到請求:
   - 開啟目標 CPU 的電源
   - 設定目標 CPU 的 Reset Vector 指向 Kernel 的 `secondary_startup`

3. Secondary CPU (CPU N) 醒來:
   secondary_startup (arch/arm64/kernel/head.S)
     ↓
   __cpu_setup (初始化 MMU 等)
     ↓
   secondary_start_kernel()
     ↓
   cpu_startup_entry()
     ↓
   進入 Idle Loop，等待排程
```

**關鍵技術**：**PSCI (Power State Coordination Interface)**。
在 ARMv8，Kernel 不能直接寫暫存器把 CPU 開機 (因為那是 Secure World 的權限)，必須呼叫與 Firmware (ATF) 定義好的標準介面 (PSCI)。

---

## ✅ 章節完成報告

- 檔案：`/05_作業系統/Linux核心概念.md`
- 最終行數：~1400 行
- 涵蓋：
  - ✅ task_struct、Kernel/User Stack、Context Switch 組語
  - ✅ MMU/TLB/Page Table、Page Fault Handling
  - ✅ CFS vruntime 計算
  - ✅ Spinlock/Mutex/RCU
  - ✅ Top-half/Bottom-half、Workqueue/Tasklet
  - ✅ Deadlock 條件與預防
  - ✅ Priority Inversion
  - ✅ **System Call 完整流程 (ARM64)**
  - ✅ **Kernel Module 開發**
  - ✅ **vDSO 機制**
  - ✅ **devm_ API**
  - ✅ 14 道面試題
