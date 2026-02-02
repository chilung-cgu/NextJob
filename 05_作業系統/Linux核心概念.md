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

```
Process（進程）= 程式的執行實例
- 獨立的記憶體空間
- 獨立的 file descriptor table
- 獨立的 PID

Thread（執行緒）= Process 內的執行單位
- 共享記憶體空間
- 各自的 Stack 和暫存器
- 各自的 Thread ID
```

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

```
開銷來源：
1. 保存/恢復暫存器 (~100 cycles)
2. 更新 TLB (如果切換 process)
3. Cache 失效
4. Kernel 資料結構更新

減少開銷的方法：
- 使用 Thread 而非 Process（共享 address space）
- 使用 vDSO 減少 syscall
- CPU 的 ASID (Address Space ID) 減少 TLB flush
```

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

## ✅ 章節完成報告

- 檔案：`/05_作業系統/Linux核心概念.md`
- 擴充前行數：327 行
- 擴充後行數：約 550 行
- 涵蓋：task_struct、Kernel/User Stack、Context Switch 組語、MMU/TLB/Page Table、CFS vruntime、Spinlock/Mutex/RCU
