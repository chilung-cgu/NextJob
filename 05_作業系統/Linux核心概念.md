# 📊 Linux 核心概念

> IC 韌體面試常考的 OS 概念，特別是和 Linux 相關的部分

---

## 📌 Process（進程）和 Thread（執行緒）

### 什麼是 Process？

```
Process 是程式的執行實例。

每個 process 有：
- 獨立的記憶體空間
- 獨立的 file descriptor table
- 獨立的 process ID (PID)
- 至少一個 thread（主執行緒）
```

### 什麼是 Thread？

```
Thread 是 process 內的執行單位。

同一個 process 的 threads 共享：
- 記憶體空間（heap、global variables）
- file descriptors
- signal handlers

但各有自己的：
- Stack
- 暫存器
- Thread ID
```

### Process vs Thread 比較

| 特性 | Process | Thread |
|-----|---------|--------|
| 記憶體 | 獨立空間 | 共享空間 |
| 建立開銷 | 較大 | 較小 |
| 通訊方式 | IPC（較複雜）| 直接讀寫共享記憶體 |
| 隔離性 | 高（一個崩潰不影響其他）| 低（一個崩潰可能影響全部）|
| Context Switch | 較慢 | 較快 |

---

## 📌 進程狀態

```
┌─────────────────────────────────────────────────────────────┐
│                     Linux 進程狀態                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│        ┌─────────────┐                                      │
│        │   Created   │                                      │
│        └──────┬──────┘                                      │
│               ↓                                              │
│        ┌─────────────┐  scheduler  ┌─────────────┐         │
│    ┌───│    Ready    │────────────→│   Running   │         │
│    │   └─────────────┘             └──────┬──────┘         │
│    │         ↑                            │                 │
│    │         │             wait/sleep     ↓                 │
│    │         │           ┌─────────────────────┐           │
│    │         │           │    Waiting/Blocked  │           │
│    │         │           └─────────┬───────────┘           │
│    │         └─────────────────────┘                       │
│    │         event/signal                                   │
│    │                                                        │
│    │    time slice expired                                  │
│    └────────────────────────────────────────────────────    │
│                                                             │
│        Running ──exit()──→ Terminated (Zombie)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Linux 進程狀態：
R - Running or Runnable
S - Interruptible Sleep (waiting for event)
D - Uninterruptible Sleep (waiting for I/O)
T - Stopped
Z - Zombie
```

---

## 📌 進程排程（Scheduling）

### 常見排程演算法

| 演算法 | 特點 | 適用場景 |
|-------|------|---------|
| **FCFS** | First Come First Served | 簡單，但可能有 convoy effect |
| **SJF** | Shortest Job First | 最佳平均等待時間，但難預測執行時間 |
| **Round Robin** | 時間片輪轉 | 分時系統，公平 |
| **Priority** | 按優先權 | 需要區分重要性 |
| **CFS** | Completely Fair Scheduler | Linux 預設，公平且高效 |

### Linux CFS

```
Linux 使用 CFS (Completely Fair Scheduler)：
- 使用「虛擬運行時間」概念
- 紅黑樹儲存可執行的進程
- 總是選擇虛擬運行時間最小的進程
- nice 值影響時間片分配
```

---

## 📌 記憶體管理

### 虛擬記憶體（Virtual Memory）

```
┌─────────────────────────────────────────────────────────────┐
│                    Process 記憶體佈局                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  High Address                                               │
│  ┌─────────────────┐                                       │
│  │   Kernel Space  │  使用者程式無法直接存取               │
│  ├─────────────────┤                                       │
│  │      Stack      │  區域變數、函式參數（向下成長）         │
│  │        ↓        │                                       │
│  │                 │                                       │
│  │        ↑        │                                       │
│  │       Heap      │  動態分配（向上成長）                  │
│  ├─────────────────┤                                       │
│  │       BSS       │  未初始化的全域/靜態變數              │
│  ├─────────────────┤                                       │
│  │      Data       │  已初始化的全域/靜態變數              │
│  ├─────────────────┤                                       │
│  │      Text       │  程式碼（唯讀）                        │
│  └─────────────────┘                                       │
│  Low Address (0x0)                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 分頁（Paging）

```
虛擬記憶體透過「分頁」映射到實體記憶體：

Virtual Address → Page Table → Physical Address

Page Table：
- 每個 process 有自己的 page table
- 記錄虛擬頁面 → 實體框架的對應
- 包含存取權限（讀/寫/執行）

好處：
1. 進程隔離（各自的 address space）
2. 記憶體保護
3. 可以使用比實體記憶體更大的空間（swap）
```

### Page Fault

```
當存取的頁面不在記憶體中：

1. CPU 產生 page fault exception
2. Kernel 的 page fault handler 處理
3. 可能的情況：
   a. Demand paging：從磁碟載入頁面
   b. Copy-on-write：複製頁面
   c. Invalid access：發送 SIGSEGV（Segmentation Fault）
```

---

## 📌 IPC（Inter-Process Communication）

### 常見 IPC 方式

| 方式 | 特點 | 使用場景 |
|-----|------|---------|
| **Pipe** | 單向、半雙工 | 父子進程通訊 |
| **Named Pipe (FIFO)** | 可跨無關進程 | 簡單的跨進程通訊 |
| **Message Queue** | 有格式的訊息 | 結構化資料傳遞 |
| **Shared Memory** | 最快 | 大量資料交換 |
| **Semaphore** | 同步機制 | 控制資源存取 |
| **Signal** | 異步通知 | 事件通知 |
| **Socket** | 可跨網路 | 網路通訊 |
| **D-Bus** | 訊息匯流排 | OpenBMC 大量使用！|

### D-Bus（你需要知道的！）

```
D-Bus 是 Linux 上常用的 IPC 機制，OpenBMC 大量使用。

組成：
- Bus Daemon：訊息路由
- Connection Name：進程識別（如 org.freedesktop.DBus）
- Object Path：物件識別（如 /org/openbmc/sensors/temperature）
- Interface：方法和信號的集合
- Method：可呼叫的函式
- Signal：事件通知
- Property：可讀/寫的屬性

你應該知道的：
1. busctl 命令的使用
2. 如何查看系統上的 D-Bus 服務
3. 如何呼叫 D-Bus method
```

---

## 📌 同步機制

### Mutex vs Semaphore

```
Mutex（互斥鎖）：
- 只有 lock/unlock 兩種狀態
- 只有加鎖的人可以解鎖
- 用於保護臨界區段

Semaphore（號誌）：
- 計數器，可以 > 1
- 任何人都可以 signal
- 用於控制資源存取數量
- 可用於進程間同步
```

### Deadlock（死結）

```
死結發生條件（四個條件同時成立）：
1. Mutual Exclusion：資源只能被一個進程使用
2. Hold and Wait：持有資源同時等待其他資源
3. No Preemption：資源不能被強制釋放
4. Circular Wait：循環等待

避免方法：
- 破壞任一條件
- 資源排序
- 使用 timeout
```

---

## 📝 常見面試問題

**Q1：Process 和 Thread 的差異？**
```
Process：
- 獨立的記憶體空間
- 透過 IPC 通訊
- 建立開銷大
- 隔離性好

Thread：
- 共享記憶體
- 直接存取共享資料
- 建立開銷小
- 一個 thread 崩潰可能影響整個 process
```

**Q2：什麼是 Context Switch？**
```
Context Switch 是 CPU 從一個 process/thread 切換到另一個的過程。

步驟：
1. 保存當前 context（暫存器、PC、stack pointer）
2. 更新 PCB（Process Control Block）
3. 載入下一個 process 的 context
4. 恢復執行

開銷來源：
- 保存/恢復暫存器
- 更新 page table（process switch）
- Cache/TLB 失效
```

**Q3：什麼是 Zombie Process？**
```
Zombie 是已經終止但還沒被父進程 wait() 的進程。

特點：
- 仍佔用 PID 和 process table entry
- 不佔用記憶體和 CPU
- 狀態顯示為 Z

解決：
- 父進程呼叫 wait() 或 waitpid()
- 或父進程終止（zombie 被 init 接管並清理）
```

**Q4：User Space 和 Kernel Space 的區別？**
```
Kernel Space：
- 最高權限（Ring 0）
- 可直接存取硬體
- 執行核心程式碼

User Space：
- 一般程式執行的空間
- 受限的權限（Ring 3）
- 透過 system call 存取核心服務

分離的好處：
- 保護核心不受錯誤程式影響
- 提供安全隔離
```

**Q5：什麼是 System Call？**
```
System Call 是使用者程式請求 kernel 服務的介面。

常見 system calls：
- 檔案操作：open, read, write, close
- 進程控制：fork, exec, wait, exit
- 記憶體：mmap, brk
- 網路：socket, connect, send, recv

流程：
1. 使用者程式呼叫 library function（如 read()）
2. Library 觸發 software interrupt（syscall 指令）
3. CPU 切換到 kernel mode
4. Kernel 執行對應的 syscall handler
5. 結果返回給使用者程式
```
