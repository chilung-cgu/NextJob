# 🚀 Bootloader 與開機流程詳解

> 瞭解系統如何從 power on 到 OS 運行，是韌體工程師的必備知識

---

## 📌 什麼是 Bootloader？

```
Bootloader 是系統啟動時第一個執行的軟體程式。

它的工作：
1. 初始化最基本的硬體（CPU、記憶體、時脈）
2. 載入作業系統或主程式
3. 把控制權交給作業系統

類比：
電腦開機 → BIOS/UEFI → Bootloader (GRUB/U-Boot) → Linux Kernel
```

---

## 🔷 完整開機流程

### 嵌入式 Linux 系統（如 BMC）

```
┌─────────────────────────────────────────────────────────────┐
│                     嵌入式開機流程                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Power On / Reset                                        │
│        ↓                                                    │
│  2. CPU 從固定位址開始執行（Reset Vector）                   │
│        ↓                                                    │
│  3. Boot ROM（晶片內建，做最基本初始化）                     │
│        ↓                                                    │
│  4. SPL (Secondary Program Loader)                          │
│        ↓                                                    │
│  5. U-Boot（完整 Bootloader）                                │
│        ↓                                                    │
│  6. Linux Kernel                                            │
│        ↓                                                    │
│  7. Root Filesystem (initramfs → rootfs)                    │
│        ↓                                                    │
│  8. Init / Systemd                                          │
│        ↓                                                    │
│  9. Applications                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 為什麼需要多階段？

```
Stage 0 - Boot ROM：
- 在晶片內部（不可修改）
- 只能做最基本的事
- 空間非常小（幾 KB）

Stage 1 - SPL：
- 初始化 DRAM
- 因為此時 DRAM 還沒初始化，SPL 要在 SRAM 執行
- SRAM 很小，所以 SPL 要很精簡

Stage 2 - U-Boot：
- DRAM 已經可用，空間大很多
- 可以做完整的初始化和載入工作
```

---

## 🔷 U-Boot 詳解

### 什麼是 U-Boot？

```
U-Boot (Universal Bootloader) 是嵌入式系統最常用的 bootloader。

特色：
- 開源
- 支援多種 CPU 架構（ARM, x86, MIPS, RISC-V...）
- 支援多種開機方式（eMMC, SPI Flash, UART, Ethernet, USB）
- 可互動式操作
```

### U-Boot 常用命令

```bash
# 查看環境變數
printenv

# 設定環境變數
setenv bootargs 'console=ttyS0,115200'

# 儲存環境變數
saveenv

# 查看記憶體內容
md 0x80000000 100

# 修改記憶體
mw 0x80000000 0xDEADBEEF

# 從 eMMC/SD 讀取到記憶體
mmc read 0x80000000 0x800 0x1000

# 從 SPI Flash 讀取
sf probe
sf read 0x80000000 0x100000 0x500000

# 從 TFTP 下載 (網路開機)
setenv serverip 192.168.1.100
tftp 0x80000000 uImage

# 啟動 Linux
bootm 0x80000000

# 查看 MTD 分區
mtdparts
```

### U-Boot 環境變數

```bash
# 重要環境變數
bootcmd = 開機時自動執行的命令
bootargs = 傳給 Linux kernel 的參數
bootdelay = 等待幾秒讓使用者中斷
baudrate = UART baud rate
ipaddr = 本機 IP（網路開機用）
serverip = TFTP server IP
```

### U-Boot 開機命令範例

```bash
# 典型的 bootcmd
bootcmd=sf probe; sf read 0x80000000 0x100000 0x500000; bootm 0x80000000

# 解釋：
# 1. sf probe      - 初始化 SPI Flash
# 2. sf read       - 從 SPI Flash 讀取 kernel 到記憶體
# 3. bootm         - 啟動 kernel
```

---

## 🔷 Linux Kernel 開機流程

```
┌─────────────────────────────────────────────────────────────┐
│                 Linux Kernel 開機流程                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Kernel Image 被載入記憶體                               │
│        ↓                                                    │
│  2. 解壓縮（如果是 zImage/uImage）                           │
│        ↓                                                    │
│  3. 架構相關初始化（setup_arch）                            │
│        ↓                                                    │
│  4. 解析 Device Tree                                        │
│        ↓                                                    │
│  5. 初始化記憶體管理                                        │
│        ↓                                                    │
│  6. 初始化排程器                                            │
│        ↓                                                    │
│  7. 載入並初始化 drivers                                    │
│        ↓                                                    │
│  8. 掛載 root filesystem                                    │
│        ↓                                                    │
│  9. 執行 /init 或 /sbin/init                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### bootargs（Kernel 命令列參數）

```bash
# 常見 bootargs
console=ttyS0,115200   # 設定 console 輸出
root=/dev/mmcblk0p2    # 設定 root filesystem 位置
rootfstype=ext4        # root filesystem 類型
init=/sbin/init        # 第一個執行的程式
debug                  # 開啟 kernel debug 訊息
quiet                  # 減少開機訊息
```

---

## 🔷 OpenBMC 的開機流程

```
┌─────────────────────────────────────────────────────────────┐
│                   OpenBMC 開機流程                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. AST2500/2600 Boot ROM                                   │
│        ↓                                                    │
│  2. U-Boot SPL                                              │
│        ↓                                                    │
│  3. U-Boot                                                  │
│        ↓                                                    │
│  4. Linux Kernel (FIT image)                                │
│        ↓                                                    │
│  5. initramfs                                               │
│        ↓                                                    │
│  6. Systemd                                                 │
│        ↓                                                    │
│  7. OpenBMC 服務啟動                                        │
│     - phosphor-xxx 服務                                     │
│     - ipmid, bmcweb, etc.                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### OpenBMC Flash Layout（範例）

```
┌──────────────────────────────────────────┐
│  SPI Flash (32MB)                        │
├──────────────────────────────────────────┤
│  0x0000000 - 0x000FFFF : U-Boot (64KB)   │
│  0x0010000 - 0x001FFFF : U-Boot Env      │
│  0x0020000 - 0x00FFFFF : Reserved        │
│  0x0100000 - 0x05FFFFF : Kernel (5MB)    │
│  0x0600000 - 0x1FFFFFF : RootFS (26MB)   │
└──────────────────────────────────────────┘
```

---

## 📝 常見面試問題

**Q1：什麼是 Bootloader？它的作用是什麼？**
```
Bootloader 是系統啟動時最先執行的程式。

主要作用：
1. 初始化硬體（CPU 時脈、記憶體控制器、必要周邊）
2. 提供除錯介面（UART console）
3. 載入作業系統到記憶體
4. 傳遞開機參數給 OS
5. 把控制權交給 OS
```

**Q2：為什麼需要多階段的 bootloader？**
```
因為系統剛啟動時資源非常有限：
- DRAM 還沒初始化，只能用很小的 SRAM
- 可能需要從不同的 boot device 載入

所以分階段：
Stage 1 (SPL)：在 SRAM 執行，初始化 DRAM
Stage 2 (U-Boot)：在 DRAM 執行，完整功能
```

**Q3：Reset Vector 是什麼？**
```
Reset Vector 是 CPU 重置後開始執行的位址。

例如：
- ARM Cortex-M：通常是 0x00000004（Stack Pointer 在 0x00000000）
- ARM Cortex-A：通常是 0x00000000 或 high vector 0xFFFF0000
- x86：0xFFFFFFF0

Boot ROM 或 Bootloader 必須放在這個位址。
```

**Q4：U-Boot 如何知道要載入什麼？**
```
透過環境變數，特別是 bootcmd：

bootcmd 儲存了開機要執行的命令序列，例如：
1. 從 Flash/eMMC/網路載入 kernel 到記憶體
2. 設定 bootargs（傳給 kernel 的參數）
3. 執行 bootm 或 bootz 啟動 kernel
```

**Q5：什麼是 FIT Image？**
```
FIT (Flattened Image Tree) 是 U-Boot 支援的映像格式。

特點：
- 可以把 kernel、device tree、ramdisk 打包在一起
- 支援數位簽章驗證（Secure Boot）
- 支援多種壓縮格式

OpenBMC 使用 FIT Image 打包 kernel 和 initramfs。
```

**Q6：Secure Boot 是什麼？**
```
Secure Boot 確保只有經過驗證的程式碼才能執行。

流程：
1. Boot ROM 驗證 Bootloader 的簽章
2. Bootloader 驗證 Kernel 的簽章
3. Kernel 驗證下一階段程式

用途：
- 防止惡意軟體在開機時注入
- 確保系統完整性
- 符合安全規範（如 BMC 的安全需求）
```

---

## ✅ 實作建議

```
1. 用開發板（如 Raspberry Pi）練習 U-Boot 操作
2. 研究 OpenBMC 的 U-Boot 設定
3. 閱讀 U-Boot 原始碼中的 board 初始化流程
4. 練習從 U-Boot 透過 TFTP 載入 kernel
5. 了解你們公司使用的 SoC 的 boot 流程
```
