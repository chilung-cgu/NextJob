# 🚀 Bootloader 與開機流程 (Boot Process)

> **學習目標**
> 1.  掌握 **ARM Linux 開機全流程** (ROM -> SPL -> U-Boot -> Kernel)。
> 2.  深入理解 **ATF (ARM Trusted Firmware)** 與 **Secure Boot** 信任鏈。
> 3.  精通 **U-Boot SPL** 架構與記憶體限制。
> 4.  理解 **Relocation** 與 **Device Tree** 傳遞機制。

---

## 📌 Context: 開機的第一秒

當你按下電源鍵，DRAM 還沒初始化，作業系統還在睡覺。是誰負責把系統叫醒？
**Bootloader** 是系統的「引路人」。它的任務是在極度受限的環境下 (只有幾 KB SRAM)，完成硬體初始化，建立信任鏈，最終將控制權交給強大的 Linux Kernel。

---

## 🧠 Mental Model (核心觀念圖解)

### 1. 接力賽跑 (The Relay Race)

系統啟動是一場接力賽，每一棒的功能越來越強，但也越來越慢。

```text
Capacity:   [~64KB SRAM]      [~128KB SRAM]      [Secure RAM]      [GBs DRAM]
Complexity: [Hardcoded]       [Minimal Driver]   [Secure Mon]      [Full Driver]
              │                 │                  │                 │
              ▼                 ▼                  ▼                 ▼
          ┌────────┐        ┌────────┐        ┌─────────┐       ┌─────────────┐        ┌────────┐
Power On: │ BootROM│───────▶│   SPL  │───────▶│ ATF/TEE │──────▶│ U-Boot Proper│───────▶│ Linux  │
          └────────┘        └────────┘        └─────────┘       └─────────────┘        └────────┘
                                               (ARMv8/Opt)

Target:   Initialize        Initialize        Secure Monitor    Load Kernel             Mount RootFS
          Basic HW          DRAM & Clocks     (EL3 Runtime)     Net/USB/Disk            Run Services
```

### 2. 信任鏈 (Chain of Trust)

Secure Boot 就像海關檢查。每一站都要檢查下一站的護照 (簽章)。
-   **Root of Trust**: 晶片裡的 OTP 公鑰 (不可修改)。
-   **Chain**: ROM 驗 SPL -> SPL 驗 U-Boot Proper -> U-Boot Proper 驗 Kernel (FIT Image)。
-   任何一環失敗，系統直接停機 (Panic)。

---

## 🔷 Logic I: 標準開機流程 (以 ARMv7 AST2600 為例)
> **Note**: AST2600 是 32-bit ARMv7 架構，通常不執行完整的 ATF (BL31)，而是直接由 SPL 跳轉到 U-Boot Proper (或經由 OpTEE)。

### 1. Stage 0: Boot ROM
-   **位置**: SoC 內部唯讀記憶體 (出廠燒死)。
-   **任務**:
    1.  讀取 Strapping Pin 決定開機來源 (SPI/eMMC/UART)。
    2.  將 Stage 1 (SPL) 從 Flash 複製到內建 **SRAM**。
    3.  (選擇性) 驗證 SPL 簽章。

### 2. Stage 1: SPL (Secondary Program Loader)
-   **限制**: SRAM 極小 (e.g. 64KB)，放不下完整 U-Boot。
-   **任務**:
    1.  **DRAM 初始化** (最重要！)。在此之前 DRAM 是一堆廢鐵。
    2.  初始化基本 Console (UART) 以便 Debug。
    3.  將完整 **U-Boot Proper** 載入到 **DRAM**。
    4.  跳轉到 DRAM 執行。

### 3. Stage 2: U-Boot Proper (第三階段 Bootloader)
> **術語定義**: `U-Boot Proper` 指的是功能完整的 `u-boot.bin` 或 `u-boot.img`，執行於 DRAM。
-   **環境**: 擁有完整 DRAM 空間，功能強大。
-   **任務**:
    1.  **Relocation**: 把自己搬到 RAM 頂端，騰出低位址給 Kernel。
    2.  讀取 `bootcmd` 環境變數。
    3.  從 SPI/Network/MMC 載入 Kernel Image (`uImage` 或 `FIT Image`) 和 Device Tree (`.dtb`)。
    4.  **Handover**: 關閉中斷/Cache，設定暫存器 (r0/x0)，跳轉到 Kernel Entry。

---

## 🔷 Logic II: 韌體架構與 ATF

### 1. ATF (ARM Trusted Firmware) / TF-A
> **Note**: 這主要針對 **ARMv8 (64-bit)** 架構。對於 ARMv7 (如 AST2600)，安全性通常由 Secure Boot Hardware 或 OpTEE 處理，而不稱作 ATF BL31。
在 ARMv8 (64-bit) 架構中，多了一個 **Secure World** (EL3)。
-   **BL31**: ATF 的 Runtime Service，常駐 EL3。
-   **功能**:
    -   管理 Secure/Non-Secure 切換。
    -   提供 **PSCI (Power State Coordination Interface)**：Linux (EL1) 不能直接開關 CPU，因為那是特權指令，必須透過 SMC (Secure Monitor Call) 請 EL3 把這顆 CPU Power On/Off。

### 2. U-Boot Driver Model (DM)
現代 U-Boot 採用類似 Linux 的 Driver Model。
-   **UCLASS**: 定義介面 (e.g., `UCLASS_GPIO`, `UCLASS_SERIAL`)。
-   **U_BOOT_DRIVER**: 實作具體硬體操作。
-   好處：標準化驅動介面，易於移植。

---

## 🔷 Logic III: 安全啟動 (Secure Boot)

### 1. FIT Image (Flattened Image Tree)
傳統 `uImage` 只包一個 Kernel。`FIT Image` (.itb) 是一個容器，可以包含：
-   Kernel Image
-   Device Tree (FDT)
-   Ramdisk
-   **RSA Signature** (簽章)

### 2. 驗證流程
U-Boot 透過 Public Key (存在 U-Boot Control FDT 或 OTP) 驗證 FIT Image 的 Hash 簽章。只有當 `verify` 通過時，才允許 `bootm` 啟動 Kernel。

---

## 🔷 Logic IV: 實作細節與限制

### 1. Linker Script (.lds) 與 SRAM
SPL 的 Linker Script 必須指定 `TTEXT_BASE` 為 SRAM 起始位址。
-   **BSS 問題**: 在 SPL 階段早期，BSS 段 (未初始化變數) 可能無法使用 (因為 SRAM 空間不夠或未清零)，必須小心使用 Global 變數，或將資料放在 `gd` (Global Data, 指向 Register 或 Cache 做為暫存堆疊)。

### 2. U-Boot Relocation
-   **原因**: U-Boot 初始載入位置可能擋到 Kernel (Kernel 喜歡住在 RAM 起點)，或者 U-Boot 想躲到 RAM 頂端以保護自己不被覆蓋。
-   **動作**: `memcpy` 自身代碼、修正 `.rel.dyn` 中的絕對位址符號。

---

## 📝 精選面試題 (Interview Questions)

### Q1: 為什麼 ARM 開機需要 SPL？直接跑 U-Boot 不行嗎？
-   **硬體限制**: 系統剛上電時，DRAM **不可用**。只有 SoC 內部極小的 SRAM (通常 <100KB) 可用。
-   **大小問題**: 現代 **U-Boot Proper** 編譯出來通常 >500KB，塞不進 SRAM。
-   **解法**: 先跑一個小巧的 SPL (負責初始化 DRAM)，有了大記憶體後，再載入完整 **U-Boot Proper**。

### Q2: 什麼是 ATF (TF-A)？PSCI 是什麼？
-   **ATF**: ARM Trusted Firmware，運行在 **EL3 (Secure Monitor)** 的特權韌體，負責系統安全與電源管理。
-   **PSCI**: Power State Coordination Interface。Linux Kernel (EL1) 不能直接操作電源暫存器 (權限不足)，必須發出 `SMC` 指令呼叫 ATF (EL3)，由 ATF 代理執行 `CPU_ON`, `CPU_OFF` 等操作。

### Q3: 詳述 Secure Boot 的信任鏈 (Chain of Trust)。
-   **Root**: OTP 中的 Hash/Public Key (硬體信任根)。
-   **Flow**:
    1.  ROM 驗 SPL。
    2.  SPL 驗 U-Boot Proper (通常包在 FIT 中)。
    3.  U-Boot Proper 驗 Kernel (FIT Image Signature)。
-   **關鍵**: 每一級在執行下一級代碼前，**必須**先驗證其完整性與來源。

### Q4: U-Boot Proper 跳轉到 Linux Kernel 前要做什麼準備？(Handoff 要求)
-   **清理現場**:
    1.  關閉中斷 (Interrupts)。
    2.  關閉 MMU。
    3.  Clean/Invalidate Data Cache。
-   **傳遞參數**:
    -   **ARM32**: `r0=0`, `r1=Machine ID`, `r2=DTB Address`。
    -   **ARM64**: `x0=DTB Address`, CPU 處於 EL2 或 EL1。

### Q5: U-Boot 的 `board_init_f` 和 `board_init_r` 有何不同？ (重要觀念釐清)
> **注意**：這兩個函式在 **SPL** 和 **U-Boot Proper** (完整版) 都會執行，但 Context 不同。

**1. 在 SPL 階段 (SRAM Context):**
*   **`board_init_f` (Front)**: 真的在 **SRAM** 執行。
    *   **任務**: 初始化 **DRAM** (最核心任務)、關閉 Watchdog、基本 Console。
    *   **限制**: 只有 SRAM，Stack 在 SRAM，不可用 Global Variables (BSS 未初始化)。
*   **`board_init_r` (Rear)**:
    *   **任務**: 載入 **U-Boot Proper** 到 DRAM，然後跳轉。

**2. 在 U-Boot Proper 階段 (DRAM Context):**
*   **`board_init_f` (Front)**: 雖然已經在 DRAM 運行，但在 **Relocation 之前**。
    *   **任務**: 預留記憶體空間 (為 Relocation 做準備)，計算搬移位置。
    *   **迷思釐清**: 很多人誤以為這裡還在初始化 DRAM，其實 DRAM 在 SPL 早就好了。
*   **`board_init_r` (Rear)**: 在 **Relocation 之後** (Code 已搬到 DRAM 高位址)。
    *   **任務**: 完整的硬體初始化 (Network, USB, PCI, Mass Storage)，並進入 `main_loop` 等待指令或載入 Kernel。
