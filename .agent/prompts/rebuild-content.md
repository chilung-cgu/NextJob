# 指令：重新打造「外商 IC/BMC 韌體工程師面試聖經」

> [!IMPORTANT]
> 這是一份給 Antigravity AI 的詳細指令文件。
> 當你執行 `/rebuild-nextjob` workflow 時，請嚴格遵循此文件的所有要求。

---

## 背景

之前建立的轉職學習指南，架構是好的，但內容深度不足以應付 **NVIDIA、AMD、Apple、Google、Microsoft、Amazon (AWS) 等外商** 的深入技術面試。

我需要的不是「概念介紹」，而是一份可以讓我「只讀這一份資料，就能從容應對 80% 以上技術面試題」的完整教材。

---

## 目標：成為「面試聖經」等級

1.  **系統性教學**：每個章節從「Why → What → How → Deep Dive」完整展開。
2.  **題庫與詳解**：每個章節結尾必須包含至少 **10 題** 真實外商面試題（標註來源如：常見 Google/NVIDIA 面試題），並附上完整詳解。
3.  **可驗證的深度**：內容必須能回答以下等級的問題：
    *   **C 語言章節**：「Explain the difference between `static inline` and `extern inline`. What happens if you define an inline function in a header file?」、「Implement `aligned_malloc()` and `aligned_free()` from scratch.」
    *   **OS 章節**：「Explain the difference between spinlock and mutex. When would you use one over the other? How are they implemented in the Linux Kernel?」
    *   **Bootloader 章節**：「Walk me through the boot sequence from ARM Cortex-A power-on to Linux init. Include EL transitions, ATF stages, and DTB loading.」
    *   **Driver 章節**：「Explain the Linux driver model. What is the difference between a platform driver and a misc driver? How does the `probe` function get called?」
    *   **Interrupt 章節**：「What is the difference between Top-half and Bottom-half in Linux? Explain tasklet, workqueue, and threaded IRQ.」
    *   **OpenBMC 章節**：「Explain the PLDM over MCTP architecture. How does BMC discover GPU sensors via PLDM Type 2?」、「What is the difference between phosphor-dbus-interfaces and phosphor-objmgr?」

---

## 各章節內容深度標準

### 02_C語言 (目標：每個檔案 1500+ 行)

需涵蓋：
-   **指標進階**：Pointer to Pointer、Function Pointer、Pointer Arithmetic、`restrict` 關鍵字。
-   **記憶體管理**：Stack vs Heap、Memory Alignment (`__attribute__((aligned))`)、手寫 `aligned_malloc`/`aligned_free`。
-   **Bit 操作**：常見 Bit Manipulation 技巧 (Set/Clear/Toggle/Check bit)、Bit Field 在 Driver 中的應用。
-   **volatile / const / static**：每個關鍵字的完整使用場景與面試陷阱題。
-   **Inline Function vs Macro**：Preprocessor vs Compiler 差異、Type Safety、Side Effects。
-   **ABI & Calling Convention**：ARM AAPCS、Caller-saved vs Callee-saved registers。
-   **編譯與連結**：Compilation Stages、Linker Script 基礎、Symbol Visibility。

### 03_底層驅動開發 (目標：每個檔案 2000+ 行)

#### 驅動程式基礎.md
-   Linux Device Model (`struct device`, `struct device_driver`, `struct bus_type`) 詳解並附 Kernel 原始碼節選。
-   Platform Driver 與 Device Tree `compatible` matching 機制。
-   `probe` 函式被呼叫的完整時機：Early Probe vs Late Probe、Deferred Probe。
-   `devm_` (Managed Resource) API 詳解與常見 API 列表。
-   sysfs/debugfs/procfs 介面設計與實作範例。
-   Kernel Synchronization 在 Driver 中的應用 (completion, wait_event, spinlock_irqsave)。

#### 中斷處理.md
-   Linux Kernel 的 Top-half / Bottom-half 機制：
    *   Hardirq vs Softirq 的區別與執行時機。
    *   tasklet、workqueue、threaded IRQ 的使用場景與原始碼範例。
-   GIC (Generic Interrupt Controller) 架構 (GICv2/GICv3)：Distributor, Redistributor, CPU Interface。
-   `request_irq` vs `devm_request_irq` vs `request_threaded_irq` 差異與使用場景。
-   Interrupt Context 判斷 (`in_interrupt()`, `in_softirq()`) 與限制。
-   中斷親和性 (IRQ Affinity) 設定與效能優化。

#### I2C_SPI_UART.md
-   I2C Subsystem 架構：`i2c_adapter`, `i2c_client`, `i2c_driver`。
-   I2C Driver 實作完整範例（從 Device Tree 定義到 `probe` 到 `read/write`）。
-   SPI Subsystem 架構與 DMA 傳輸模式。
-   UART/TTY Subsystem 架構與 Serial Core。
-   各協定的時序圖、錯誤處理、Debug 技巧。

### 04_OpenBMC深化 (目標：每個檔案 2500+ 行)

#### 架構複習.md
-   OpenBMC 完整架構圖：Yocto Layer 結構、Recipe 撰寫。
-   D-Bus 深入：Object Path 命名規則、Interface 設計、Signal 與 Property。
-   Phosphor 框架：phosphor-dbus-interfaces、phosphor-objmgr、phosphor-state-manager。
-   Sensor Daemon 架構：phosphor-hwmon vs dbus-sensors vs entity-manager。
-   Entity Manager 與 JSON 配置檔設計。

#### 面試重點.md
-   IPMI 深入：完整 NetFn/CMD 列表、KCS/BT Channel 實作細節、OEM Command 設計。
-   Redfish 深入：Schema 設計、OEM Extension、EventService SSE 實作。
-   PLDM 深入：
    *   PLDM Type 0-6 完整說明。
    *   PDR (Platform Descriptor Records) 結構與設計。
    *   PLDM over MCTP 的封包結構。
-   SPDM 深入：認證流程、Certificate Chain、Measurement 機制。
-   實際面試題庫：至少 20 題，含 NVIDIA/AMD/Google 級別難度。

### 05_作業系統 (目標：每個檔案 2000+ 行)

#### Linux核心概念.md
-   Process/Thread：包含 Linux 的 `task_struct`、Kernel Stack vs User Stack、Context Switch 的 Assembly 層面流程。
-   Memory：Physical/Virtual Address 轉換、MMU/TLB、Page Table (PGD/PUD/PMD/PTE)、NUMA、Memory Barrier (`mb()`, `rmb()`, `wmb()`)。
-   Scheduler：CFS 的 vruntime 計算、調度類別 (RT, DL, CFS)、load balancing。
-   Synchronization：Spinlock vs Mutex vs Semaphore vs RCU，各自的使用場景與 Kernel 原始碼節選。

#### Bootloader.md
-   ARM Trusted Firmware (ATF/TF-A) 的 BL1/BL2/BL31/BL33 流程。
-   Exception Level (EL0-EL3) 切換與權限模型。
-   U-Boot 的 SPL 機制、Linker Script 說明、`board_init_f` / `board_init_r` 流程。
-   Secure Boot 的完整實作流程（金鑰簽章、驗證鏈、OTP 儲存）。
-   Device Tree Blob (DTB) 的編譯、載入時機、Kernel 如何解析 (`of_` API)。

---

## 格式要求

-   每個 `.md` 檔案的結構：
    1.  **概述與學習目標**
    2.  **系統性教學內容**（包含圖解、原始碼節選、實作範例）
    3.  **常見誤區與最佳實踐**
    4.  **面試題庫（至少 10 題，含詳解）**
    5.  **延伸閱讀（書籍、Kernel Doc、Bootlin 教材連結）**
-   使用 Markdown 格式，善用程式碼區塊 (```c ... ```)、表格、流程圖 (ASCII 或 Mermaid)。
-   中文撰寫，但技術名詞保持英文原文（如 Context Switch, Page Fault）。

---

## 執行策略（避免 Token Limit）

由於內容量大，請按照以下順序「分段執行」，每次只處理一個子章節：

**執行順序：**
1.  `02_C語言/` 全部檔案
2.  `03_底層驅動開發/驅動程式基礎.md`
3.  `03_底層驅動開發/中斷處理.md`
4.  `03_底層驅動開發/I2C_SPI_UART.md`
5.  `04_OpenBMC深化/架構複習.md`
6.  `04_OpenBMC深化/面試重點.md`
7.  `05_作業系統/Linux核心概念.md`
8.  `05_作業系統/Bootloader.md`

**每完成一個子章節後：**
1.  執行 Git Commit（Commit Message 格式：`docs(章節名): 深度擴充 XXX 內容`）
2.  報告進度並等待使用者確認後再繼續。

---

## 最終驗證標準

當你完成後，我會用這些問題測試你產出的資料：

**C 語言：**
1.  「`static inline` 和 `extern inline` 有什麼區別？」
2.  「請手寫 `aligned_malloc(size_t size, size_t alignment)` 實作。」

**OS/Bootloader：**
3.  「CFS 如何計算 vruntime？Load weight 的作用是什麼？」
4.  「ATF BL31 是如何跳轉到 BL33 (U-Boot) 的？」

**Driver/Interrupt：**
5.  「`devm_request_irq` 和 `request_irq` 有什麼區別？什麼時候用哪個？」
6.  「在 Interrupt Context 中，可以呼叫 `mutex_lock()` 嗎？為什麼？」

**OpenBMC：**
7.  「OpenBMC 的 D-Bus Object Path 命名規則是什麼？」
8.  「PLDM Type 2 (Platform Monitoring) 的 PDR 結構是什麼？」

如果你的資料無法回答這些問題，代表深度還不夠，請繼續擴充。

---

**請從第一個子章節開始執行。**
