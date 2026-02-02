# 🚀 Bootloader 與開機流程完整指南

> **學習目標**
> 1. 深入理解 ARM vs x86 開機流程差異
> 2. 掌握 ATF (ARM Trusted Firmware) 架構
> 3. 理解 Secure Boot 與 Chain of Trust
> 4. 熟練 U-Boot 操作與驅動模型 (DM)
> 5. 掌握 Device Tree 與 FIT Image

---

## 📌 第一部分：Bootloader 基礎

### 1.1 什麼是 Bootloader？

```
Bootloader = 系統啟動時第一個執行的軟體

工作內容：
1. 初始化硬體（CPU、記憶體、時脈）
2. 載入作業系統
3. 把控制權交給 OS

類比：
電腦開機 → BIOS/UEFI → GRUB/U-Boot → Linux Kernel
```

### 1.2 為什麼需要多階段 Bootloader？

```
系統剛上電時資源非常有限：
- DRAM 還沒初始化，只有 SRAM (幾十 KB)
- Boot ROM 空間很小（晶片內建）

所以分階段：
┌────────────┬──────────────────────────────────────────────────┐
│ Stage 0    │ Boot ROM (晶片內建，不可修改)                     │
│ Stage 1    │ SPL (在 SRAM 執行，初始化 DRAM)                   │
│ Stage 2    │ U-Boot (在 DRAM 執行，完整功能)                   │
│ Stage 3    │ Linux Kernel                                     │
└────────────┴──────────────────────────────────────────────────┘
```

---

## 🔷 第二部分：ARM vs x86 開機流程

### 2.1 ARM 開機流程

```
┌──────────────────────────────────────────────────────────────┐
│                   ARM (如 AST2600 BMC)                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Power On                                                    │
│      ↓                                                       │
│  Boot ROM (內建於 SoC)                                       │
│      ↓ 載入 SPL                                              │
│  SPL (Secondary Program Loader)                              │
│      ↓ 初始化 DRAM，載入 U-Boot                               │
│  U-Boot                                                      │
│      ↓ 載入 kernel + DTB                                     │
│  Linux Kernel                                                │
│      ↓                                                       │
│  Root Filesystem                                             │
│                                                              │
│  記憶體演進：                                                  │
│  Boot ROM: SRAM only                                         │
│  SPL: SRAM → 初始化 DRAM                                     │
│  U-Boot: 完整 DRAM 可用                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 x86 開機流程

```
┌──────────────────────────────────────────────────────────────┐
│                   x86 伺服器 (UEFI)                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Power On                                                    │
│      ↓                                                       │
│  Reset Vector (CPU 從 0xFFFFFFF0 開始)                       │
│      ↓                                                       │
│  UEFI Firmware (SEC → PEI → DXE → BDS)                       │
│      ↓                                                       │
│  UEFI Boot Manager                                           │
│      ↓ 選擇 Boot Entry                                       │
│  Bootloader (GRUB / systemd-boot)                            │
│      ↓ 載入 kernel                                           │
│  Linux Kernel                                                │
│      ↓                                                       │
│  Initramfs → Root Filesystem                                 │
│                                                              │
│  UEFI 階段：                                                  │
│  SEC: Security Phase (最早期初始化)                           │
│  PEI: Pre-EFI Initialization (記憶體初始化)                   │
│  DXE: Driver Execution Environment                           │
│  BDS: Boot Device Selection                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 主要差異

| 特性 | ARM | x86 |
|:---|:---|:---|
| Reset Vector | 0x0 或高位址 | 0xFFFFFFF0 |
| 標準 Firmware | U-Boot | UEFI |
| Device Tree | 必須 | 通常 ACPI |
| Boot Device | SPI Flash, eMMC | SPI Flash, NVMe |
| 開機介面 | UART console | VGA/Serial |

---

## 🔷 第三部分：ARM Trusted Firmware (ATF)

### 3.1 ATF 概述

```
ATF (現稱 TF-A = Trusted Firmware-A) 是 ARM 官方的參考實作，
提供安全啟動和執行時服務。

為什麼需要 ATF？
- 實現 ARM 的 Security Extensions
- 管理 Exception Levels (EL0-EL3)
- 提供 Secure Boot 框架
- Power Management 服務
```

### 3.2 ARM Exception Levels

```
┌──────────────────────────────────────────────────────────────┐
│                   ARM Exception Levels                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  EL3 (Secure Monitor)    ← ATF BL31                         │
│    │  - 最高權限                                             │
│    │  - 處理 Secure/Non-Secure 切換                          │
│    ↓                                                         │
│  EL2 (Hypervisor)        ← KVM / 虛擬化                      │
│    │  - 可選                                                 │
│    ↓                                                         │
│  EL1 (Kernel)            ← Linux Kernel / RTOS              │
│    │                                                         │
│    ↓                                                         │
│  EL0 (User)              ← User Applications                │
│                                                              │
│  Secure World        │    Normal World                       │
│  ────────────────────┼────────────────────                   │
│  Secure OS (OP-TEE)  │    Linux                             │
│  Trusted Apps        │    Normal Apps                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 ATF 啟動階段

```
ATF 將啟動分為多個 BL (Boot Loader) 階段：

┌────────┬────────────────────────────────────────────────────┐
│ BL1    │ 在 ROM 或 Flash 執行，載入 BL2                      │
│        │ 驗證 BL2 簽章（如有 Secure Boot）                   │
├────────┼────────────────────────────────────────────────────┤
│ BL2    │ 在 SRAM 執行，初始化 DRAM                          │
│        │ 載入 BL31, BL32, BL33                              │
├────────┼────────────────────────────────────────────────────┤
│ BL31   │ EL3 Runtime Service，常駐在記憶體                   │
│        │ 處理 SMC (Secure Monitor Call)                     │
├────────┼────────────────────────────────────────────────────┤
│ BL32   │ Secure OS (如 OP-TEE)，可選                        │
├────────┼────────────────────────────────────────────────────┤
│ BL33   │ Normal World Bootloader (U-Boot 或 UEFI)           │
└────────┴────────────────────────────────────────────────────┘
```

---

## 🔷 第四部分：Secure Boot

### 4.1 Chain of Trust

```
Secure Boot 建立「信任鏈」：每一階段驗證下一階段

┌──────────────────────────────────────────────────────────────┐
│                   Chain of Trust                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Root of Trust (硬體)                                        │
│      │  - 晶片內建的公鑰 (OTP)                                │
│      │  - 不可修改                                           │
│      ↓  驗證                                                 │
│  Boot ROM                                                    │
│      │                                                       │
│      ↓  驗證簽章                                             │
│  ATF BL1                                                     │
│      │                                                       │
│      ↓  驗證簽章                                             │
│  ATF BL2 / SPL                                               │
│      │                                                       │
│      ↓  驗證簽章                                             │
│  U-Boot                                                      │
│      │                                                       │
│      ↓  驗證簽章 (FIT Image)                                 │
│  Linux Kernel + DTB + initramfs                              │
│                                                              │
│  如果任何一個環節驗證失敗 → 停止開機                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 簽章驗證機制

```c
/* 簽章驗證流程 (簡化) */

/* 1. 計算 Image Hash */
SHA256(image_data, image_size, hash);

/* 2. 用公鑰驗證簽章 */
int verified = RSA_verify(public_key, signature, hash);

/* 3. 驗證成功才載入執行 */
if (verified)
    boot_next_stage();
else
    panic("Signature verification failed!");

/* U-Boot 中的驗證 */
/* 使用 FIT Image 的 signature 節點 */
```

### 4.3 OpenBMC Secure Boot

```
OpenBMC 在 AST2600 上的 Secure Boot：

1. AST2600 Boot ROM 驗證 SPL
2. SPL 驗證 U-Boot
3. U-Boot 驗證 FIT Image (kernel + DTB + rootfs)
4. 使用 verified-boot 機制

啟用方式：
- 燒錄公鑰到 OTP (One-Time Programmable)
- 簽署所有 boot images
- 設定 security strap
```

---

## 🔷 第五部分：U-Boot 詳解

### 5.1 常用命令

```bash
# 環境變數
printenv              # 顯示所有環境變數
setenv foo bar        # 設定環境變數
saveenv               # 儲存到 Flash

# 記憶體操作
md 0x80000000 100     # 顯示記憶體 (memory display)
mw 0x80000000 0xDEAD  # 寫入記憶體 (memory write)
cp 0x80000000 0x81000000 0x1000  # 複製記憶體

# Flash 操作
sf probe              # 初始化 SPI Flash
sf read 0x80000000 0x100000 0x500000   # 讀取
sf erase 0x100000 0x10000              # 擦除
sf write 0x80000000 0x100000 0x10000   # 寫入

# eMMC/SD
mmc dev 0             # 選擇 mmc device
mmc read 0x80000000 0x800 0x1000  # 讀取

# 網路
setenv ipaddr 192.168.1.10
setenv serverip 192.168.1.100
tftp 0x80000000 uImage   # 從 TFTP 下載
ping 192.168.1.1

# 開機
bootm 0x80000000      # 啟動 uImage
bootz 0x80000000 - 0x81000000  # 啟動 zImage + DTB
```

### 5.2 U-Boot Driver Model (DM)

```c
/* U-Boot DM 是類似 Linux Kernel 的驅動框架 */

/* 定義一個 UCLASS (驅動類型) */
UCLASS_DRIVER(gpio) = {
    .id = UCLASS_GPIO,
    .name = "gpio",
    .per_device_auto = sizeof(struct gpio_dev_priv),
};

/* 定義一個具體 Driver */
static const struct dm_gpio_ops my_gpio_ops = {
    .direction_input = my_gpio_direction_input,
    .direction_output = my_gpio_direction_output,
    .get_value = my_gpio_get_value,
    .set_value = my_gpio_set_value,
};

U_BOOT_DRIVER(my_gpio) = {
    .name = "my-gpio",
    .id = UCLASS_GPIO,
    .of_match = my_gpio_ids,
    .ops = &my_gpio_ops,
    .probe = my_gpio_probe,
    .priv_auto = sizeof(struct my_gpio_priv),
};
```

---

## 🔷 第六部分：Device Tree 與 FIT Image

### 6.1 Device Tree Blob (DTB)

```c
/* Device Tree 告訴 Kernel 硬體配置 */

/* DTS 原始碼範例 */
/dts-v1/;

/ {
    compatible = "aspeed,ast2600";
    
    cpus {
        cpu@0 {
            compatible = "arm,cortex-a7";
        };
    };
    
    memory@80000000 {
        device_type = "memory";
        reg = <0x80000000 0x40000000>;  /* 1GB */
    };
    
    i2c0: i2c@1e78a000 {
        compatible = "aspeed,ast2600-i2c";
        reg = <0x1e78a000 0x80>;
        interrupts = <GIC_SPI 110 IRQ_TYPE_LEVEL_HIGH>;
        #address-cells = <1>;
        #size-cells = <0>;
        
        temp_sensor@48 {
            compatible = "ti,tmp102";
            reg = <0x48>;
        };
    };
};
```

### 6.2 FIT Image

```c
/* FIT (Flattened Image Tree) 打包多個 image */

/* FIT Image 結構 (.its 檔) */
/dts-v1/;

/ {
    description = "OpenBMC FIT Image";
    
    images {
        kernel {
            data = /incbin/("zImage");
            type = "kernel";
            arch = "arm";
            compression = "none";
            hash-1 { algo = "sha256"; };
        };
        
        fdt {
            data = /incbin/("board.dtb");
            type = "flat_dt";
            arch = "arm";
            compression = "none";
            hash-1 { algo = "sha256"; };
        };
        
        ramdisk {
            data = /incbin/("rootfs.cpio.gz");
            type = "ramdisk";
            arch = "arm";
            compression = "gzip";
            hash-1 { algo = "sha256"; };
        };
    };
    
    configurations {
        default = "conf";
        conf {
            kernel = "kernel";
            fdt = "fdt";
            ramdisk = "ramdisk";
            signature {
                algo = "sha256,rsa2048";
                key-name-hint = "dev-key";
                sign-images = "kernel", "fdt", "ramdisk";
            };
        };
    };
};
```

### 6.3 製作 FIT Image

```bash
# 編譯 DTS 成 DTB
dtc -I dts -O dtb board.dts -o board.dtb

# 製作 FIT Image
mkimage -f image.its image.fit

# 簽署 FIT Image (Secure Boot)
mkimage -F -k /path/to/keys -r image.fit
```

---

## 📝 面試題庫

### Q1: ARM 和 x86 開機流程的主要差異？

**難度**：⭐⭐⭐⭐

**答案**：
| 特性 | ARM | x86 |
|:---|:---|:---|
| Reset Vector | 0x0 (低位址) | 0xFFFFFFF0 (高位址) |
| Firmware | U-Boot | UEFI |
| 硬體描述 | Device Tree | ACPI |
| 記憶體映射 | 由 SoC 定義 | 較統一 |

### Q2: 什麼是 ATF？BL31 的作用？

**難度**：⭐⭐⭐⭐⭐
**常見於**：NVIDIA / ARM 職位

**答案**：
ATF (TF-A) 是 ARM 的安全啟動參考實作。

BL31 (EL3 Runtime)：
- 常駐記憶體
- 處理 SMC (Secure Monitor Call)
- 管理 Secure/Normal World 切換
- 提供 PSCI (Power State Coordination Interface)

### Q3: Secure Boot 的 Chain of Trust 如何運作？

**難度**：⭐⭐⭐⭐⭐

**答案**：
1. Root of Trust：晶片內建不可修改的公鑰 (OTP)
2. Boot ROM 使用此公鑰驗證下一階段
3. 每個階段驗證下一階段的簽章
4. 任何驗證失敗都會停止開機

關鍵：信任從硬體開始，逐層向上建立。

### Q4: 什麼是 FIT Image？優點是什麼？

**難度**：⭐⭐⭐⭐

**答案**：
FIT (Flattened Image Tree) 是 U-Boot 支援的映像格式。

優點：
1. 打包多個 image (kernel, DTB, initramfs)
2. 支援數位簽章驗證
3. 支援多種壓縮
4. 配置靈活（多個 configuration）
5. 單一檔案易於管理

### Q5: 解釋 U-Boot 的 bootcmd 環境變數

**難度**：⭐⭐⭐

**答案**：
```bash
# bootcmd 是開機時自動執行的命令
bootcmd=sf probe; sf read 0x80000000 0x100000 0x500000; bootm 0x80000000

# 解釋：
# sf probe - 初始化 SPI Flash
# sf read - 從 Flash 讀取 kernel 到 RAM
# bootm - 啟動 kernel
```

---

## ✅ 章節完成報告

- 檔案：`/05_作業系統/Bootloader.md`
- 擴充前行數：318 行
- 擴充後行數：約 500 行
- 涵蓋：ARM vs x86 Boot 流程、ATF/TF-A、Exception Levels、Secure Boot Chain of Trust、U-Boot DM、FIT Image

---

## 🔷 第七部分：U-Boot SPL 詳解

### 7.1 SPL 是什麼？

```
SPL (Secondary Program Loader) / MLO (X-Loader)

為什麼需要 SPL？
━━━━━━━━━━━━━━━━
系統剛上電時，只有 SRAM 可用（幾十 KB），DRAM 還沒初始化。
完整的 U-Boot (~500KB+) 無法放入 SRAM。

解決方案：
1. Boot ROM 載入一個小的 SPL 到 SRAM
2. SPL 初始化 DRAM
3. SPL 載入完整 U-Boot 到 DRAM
4. 跳轉到 U-Boot

┌──────────────────────────────────────────────────────────────┐
│                   SPL 執行環境                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  記憶體佈局（典型 AST2600）：                                  │
│                                                              │
│  0x00000000  ┌────────────────────┐                         │
│              │  Boot ROM (內建)    │ 64KB                   │
│  0x00010000  ├────────────────────┤                         │
│              │  SRAM              │ 64KB                    │
│              │  ┌──────────────┐  │                         │
│              │  │ SPL Code     │  │ ~32KB                   │
│              │  │ SPL Stack    │  │                         │
│              │  │ SPL BSS      │  │                         │
│              │  └──────────────┘  │                         │
│  0x00020000  └────────────────────┘                         │
│                                                              │
│  DRAM 初始化後：                                              │
│  0x80000000  ┌────────────────────┐                         │
│              │  U-Boot (完整)     │ ~1MB                    │
│              ├────────────────────┤                         │
│              │  Kernel           │                          │
│              ├────────────────────┤                         │
│              │  DTB / FIT Image  │                          │
│              └────────────────────┘                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 SPL 程式碼結構

```c
/* arch/arm/lib/crt0_aarch64.S */
/* SPL 的 Entry Point */

ENTRY(_start)
    /* 1. 設定 Stack Pointer */
    ldr     x0, =CONFIG_SPL_STACK
    bic     sp, x0, #0xf        /* 16-byte aligned */
    
    /* 2. 清除 BSS */
    ldr     x0, =__bss_start
    ldr     x1, =__bss_end
clear_bss:
    cmp     x0, x1
    b.hs    clear_done
    str     xzr, [x0], #8
    b       clear_bss
clear_done:
    
    /* 3. 跳轉到 C 程式碼 */
    bl      board_init_f        /* 早期初始化 */
    bl      board_init_r        /* 後期初始化 */
ENDPROC(_start)
```

```c
/* common/spl/spl.c */
/* SPL 的 C 入口 */

void board_init_f(ulong dummy)
{
    /* 早期硬體初始化 */
    
    /* 1. Timer 初始化 */
    timer_init();
    
    /* 2. UART 初始化（用於 debug） */
    preloader_console_init();
    
    /* 3. 讀取 Boot Mode（從哪開機：SPI/eMMC/UART）*/
    u32 boot_mode = get_boot_device();
    
    /* 4. DRAM 初始化（最關鍵！）*/
    gd->ram_size = initdram(0);
    if (gd->ram_size == 0)
        hang();
    
    printf("DRAM: %llu MiB\n", gd->ram_size >> 20);
}

void board_init_r(gd_t *dummy1, ulong dummy2)
{
    /* DRAM 已可用 */
    
    /* 1. 重新設定 Stack 到 DRAM */
    
    /* 2. 載入 U-Boot 到 DRAM */
    struct spl_image_info spl_image;
    spl_load_image(&spl_image);
    
    /* 3. 驗證簽章（如有 Secure Boot）*/
#ifdef CONFIG_SPL_FIT_SIGNATURE
    if (!fit_image_verify(&spl_image))
        hang();
#endif
    
    /* 4. 跳轉到 U-Boot */
    jump_to_image_no_args(&spl_image);
    /* 永不返回 */
}
```

### 7.3 DRAM 初始化

```c
/* board/aspeed/ast2600/dram.c (簡化) */

int initdram(void)
{
    struct ast2600_sdram_regs *regs = 
        (void *)AST2600_SDRAM_BASE;
    
    /* 1. 設定 SDRAM Controller */
    writel(CONFIG_DRAM_TIMINGS, &regs->cfg);
    
    /* 2. 發送初始化命令 */
    writel(SDRAM_CMD_PALL, &regs->cmd);  /* Precharge All */
    writel(SDRAM_CMD_MRS, &regs->cmd);   /* Mode Register Set */
    writel(SDRAM_CMD_REF, &regs->cmd);   /* Refresh */
    writel(SDRAM_CMD_REF, &regs->cmd);   /* Refresh */
    
    /* 3. 啟用自動刷新 */
    writel(AUTO_REFRESH_ENABLE, &regs->refresh);
    
    /* 4. 回傳 DRAM 大小 */
    return CONFIG_SYS_SDRAM_SIZE;
}
```

---

## 🔷 第八部分：U-Boot Linker Script

### 8.1 Linker Script 基礎

```ld
/* u-boot.lds (簡化版) */

OUTPUT_FORMAT("elf64-littleaarch64")
OUTPUT_ARCH(aarch64)
ENTRY(_start)

MEMORY
{
    /* SRAM for SPL */
    SRAM (rwx) : ORIGIN = 0x00010000, LENGTH = 64K
    
    /* DRAM for U-Boot */
    DRAM (rwx) : ORIGIN = 0x80000000, LENGTH = 512M
}

SECTIONS
{
    /* 程式碼段 */
    . = CONFIG_SYS_TEXT_BASE;  /* U-Boot 載入位址 */
    
    .text : {
        __text_start = .;
        arch/arm/cpu/armv8/start.o (.text*)  /* Entry Point 放最前 */
        *(.text*)
        __text_end = .;
    }
    
    /* 唯讀資料 */
    .rodata : {
        *(.rodata*)
    }
    
    /* 可寫資料（有初始值）*/
    .data : {
        __data_start = .;
        *(.data*)
        __data_end = .;
    }
    
    /* BSS（未初始化資料，載入時清零）*/
    .bss (NOLOAD) : {
        __bss_start = .;
        *(.bss*)
        *(COMMON)
        __bss_end = .;
    }
    
    /* U-Boot 需要的特殊段 */
    .u_boot_list : {
        KEEP(*(SORT(.u_boot_list*)));  /* 命令、驅動註冊 */
    }
    
    _end = .;
}
```

### 8.2 重要的 Section 解釋

```
┌──────────────────────────────────────────────────────────────┐
│              U-Boot 常見 Section                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  .text     - 程式碼                                          │
│  .rodata   - 唯讀資料（字串常數等）                           │
│  .data     - 有初始值的全域變數                               │
│  .bss      - 未初始化的全域變數（清零）                        │
│                                                              │
│  .u_boot_list - U-Boot 特有：                                 │
│    - 命令表 (U_BOOT_CMD)                                     │
│    - 驅動表 (U_BOOT_DRIVER)                                  │
│    - 環境變數預設值                                           │
│                                                              │
│  .rel.dyn  - 位址無關碼的重定位資訊 (PIC)                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔷 第九部分：Kernel 載入與啟動

### 9.1 U-Boot 載入 Kernel 的過程

```c
/* 以 bootm 命令為例 */

int do_bootm(cmd_tbl_t *cmdtp, int flag, int argc, char *const argv[])
{
    /* 1. 解析 Image Header */
    struct bootm_headers images;
    bootm_find_other(cmdtp, flag, argc, argv, &images);
    
    /* 2. 驗證 Image */
    if (images.verify) {
        if (!image_verify(images.os.image_start, images.os.image_len))
            return -1;
    }
    
    /* 3. 解壓縮（如需要）*/
    if (images.os.comp != IH_COMP_NONE) {
        decompress(images.os.load, ..., images.os.comp);
    }
    
    /* 4. 載入 DTB */
    ftaddr = map_fdt_blob(images.ft_addr);
    set_bootargs(ftaddr);
    
    /* 5. 跳轉到 Kernel */
    boot_jump_linux(&images, flag);
    /* 永不返回 */
}
```

### 9.2 跳轉到 Linux Kernel

```c
/* arch/arm/lib/bootm.c */

void boot_jump_linux(bootm_headers_t *images, int flag)
{
    unsigned long machid = gd->bd->bi_arch_number;
    char *s;
    void (*kernel_entry)(int, int, uint);
    
    kernel_entry = (void *)images->ep;  /* Entry Point */
    
    /* ARM Linux 啟動約定：
     * r0 = 0
     * r1 = Machine Type ID
     * r2 = DTB 位址
     */
    
    /* 關閉 Cache 和 MMU */
    cleanup_before_linux();
    
    /* 跳轉！ */
    kernel_entry(0, machid, (unsigned long)images->ft_addr);
}

void cleanup_before_linux(void)
{
    /* 1. 關閉中斷 */
    disable_interrupts();
    
    /* 2. Flush D-Cache */
    flush_dcache_all();
    
    /* 3. 關閉 D-Cache */
    dcache_disable();
    
    /* 4. 關閉 I-Cache */
    icache_disable();
    
    /* 5. 關閉 MMU（如果有開啟）*/
    mmu_disable();
}
```

### 9.3 ARM64 Kernel Entry Point

```c
/* Linux Kernel: arch/arm64/kernel/head.S */

/*
 * ARM64 Linux 啟動要求：
 * - x0 = DTB 的實體位址
 * - CPU 必須在 EL2 或 EL1
 * - MMU 關閉
 * - D-cache 關閉
 * - Primary CPU 呼叫，Secondary CPU 等待
 */

ENTRY(_text)
    /*
     * 跳過 Image header
     * Linux ARM64 Image 開頭有 64-byte header
     */
    b       primary_entry
    .quad   0                       /* Image load offset */
    .quad   _kernel_size_le         /* Image size */
    .quad   _kernel_flags_le        /* Flags */
    /* ... */

primary_entry:
    /* 保存 DTB 位址 */
    mov     x21, x0
    
    /* 必要的 CPU 設定 */
    bl      el2_setup               /* 設定 EL2 → EL1 */
    
    /* 建立初始 Page Table */
    adrp    x0, init_pg_dir
    bl      __create_page_tables
    
    /* 開啟 MMU */
    bl      __enable_mmu
    
    /* 跳轉到 start_kernel */
    ldr     x8, =__primary_switched
    br      x8
```

---

## 🔷 第十部分：BMC 特有的開機場景

### 10.1 AST2600 Boot ROM 流程

```
┌──────────────────────────────────────────────────────────────┐
│                AST2600 Boot ROM 流程                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Power On Reset                                           │
│     └─► Boot ROM 開始執行 (位於 SoC 內部)                     │
│                                                              │
│  2. 讀取 Boot Strap Pins / OTP                               │
│     ├─► 決定 Boot Source: SPI/eMMC/UART                      │
│     └─► 讀取 Secure Boot 設定                                │
│                                                              │
│  3. 初始化 Boot Device                                        │
│     └─► SPI Flash Controller / eMMC Controller               │
│                                                              │
│  4. 載入 SPL                                                  │
│     ├─► 讀取 SPL Image Header                                │
│     ├─► 驗證簽章 (如有 Secure Boot)                          │
│     └─► 複製 SPL 到 SRAM                                     │
│                                                              │
│  5. 跳轉到 SPL                                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 OpenBMC 開機完整流程

```
┌──────────────────────────────────────────────────────────────┐
│              OpenBMC 完整開機流程                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  硬體層：                                                     │
│  ┌──────────────────────────────────────────┐                │
│  │ Boot ROM → SPL → U-Boot → Kernel        │                │
│  └──────────────────────────────────────────┘                │
│                                                              │
│  U-Boot 環境變數 (典型)：                                      │
│  ─────────────────────────                                   │
│  bootcmd=bootm 0x20080000                                    │
│  bootargs=console=ttyS4,115200n8 root=/dev/ram rw            │
│                                                              │
│  Kernel 啟動：                                                │
│  ─────────────                                               │
│  1. 解壓縮 initramfs                                          │
│  2. 執行 /init (busybox)                                     │
│  3. 掛載 rootfs (squashfs from FIT)                          │
│  4. switch_root 到真正的 rootfs                              │
│                                                              │
│  Systemd 啟動：                                               │
│  ─────────────                                               │
│  1. basic.target (基礎服務)                                   │
│  2. multi-user.target (BMC 服務)                             │
│     ├─► phosphor-xxx 服務群                                  │
│     ├─► ipmid / bmcweb                                       │
│     └─► 硬體監控 daemon                                       │
│                                                              │
│  典型開機時間：                                                │
│  Boot ROM → SPL:     ~100ms                                  │
│  SPL → U-Boot:       ~500ms                                  │
│  U-Boot → Kernel:    ~2s                                     │
│  Kernel → Services:  ~30s                                    │
│  Total:              ~35s                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📝 更多面試題

### Q6: 解釋 U-Boot 的 board_init_f 和 board_init_r

**難度**：⭐⭐⭐⭐⭐
**常見於**：NVIDIA / AMD

**問題**：
U-Boot 中的 board_init_f() 和 board_init_r() 有什麼區別？

**標準答案**：

**board_init_f (f = First)**：
- 在 DRAM 初始化**之前**執行
- 只能使用 SRAM 和 CPU 暫存器
- 不能使用 BSS（需要清零但可能沒空間）
- 使用 GD（Global Data）存放在 Stack
- 典型工作：Timer、UART、DRAM 初始化

**board_init_r (r = Relocated)**：
- 在 DRAM 初始化**之後**執行
- 完整記憶體可用
- BSS 已清零
- 可以使用 malloc()
- 典型工作：載入 Kernel、網路、Flash

```c
void board_init_f(ulong boot_flags)
{
    gd->flags = boot_flags;
    timer_init();
    serial_init();
    dram_init();  /* 關鍵！ */
    /* 這之後 DRAM 可用 */
}

void board_init_r(gd_t *new_gd, ulong dest_addr)
{
    /* 已在 DRAM 執行 */
    flash_init();
    env_init();
    eth_init();
    /* ... */
    main_loop();  /* 命令行或自動開機 */
}
```

---

### Q7: 什麼是 U-Boot Relocation？

**難度**：⭐⭐⭐⭐⭐

**問題**：
U-Boot 為什麼需要 Relocation？如何實現？

**標準答案**：

**為什麼需要**：
- U-Boot 最初被載入到某個位址（CONFIG_SYS_TEXT_BASE）
- 但這個位址可能不適合：
  - Kernel 需要在低位址
  - 需要連續記憶體給 Kernel
- 所以 U-Boot 會把自己搬到 DRAM 頂端

**Relocation 過程**：
1. 計算新位址（DRAM 頂端減去 U-Boot 大小）
2. 複製程式碼到新位址
3. 修正所有需要重定位的位址（.rel.dyn section）
4. 跳轉到新位址繼續執行

```c
/* 重定位偏移量 */
gd->reloc_off = new_addr - CONFIG_SYS_TEXT_BASE;

/* 修正指標 */
for (ptr = __rel_dyn_start; ptr < __rel_dyn_end; ptr++) {
    *ptr += gd->reloc_off;
}
```

---

### Q8: Linux Kernel 啟動時對 U-Boot 的要求？

**難度**：⭐⭐⭐⭐

**問題**：
U-Boot 跳轉到 Linux Kernel 前，必須滿足哪些條件？

**標準答案**：

**ARM64 (AArch64)**：
```
x0 = DTB 的實體位址
x1-x3 = 保留（設為 0）

CPU 狀態要求：
- 必須在 EL2 或 EL1（不能在 EL3）
- MMU 關閉
- D-cache 關閉（或乾淨）
- I-cache 可開可關
- 中斷禁用
- Primary CPU 呼叫，其他 CPU 在 WFI
```

**ARM32**：
```
r0 = 0
r1 = Machine Type ID
r2 = DTB 的實體位址（或 ATAGS）

MMU 關閉，Cache 關閉，中斷禁用
```

**準備工作**：
```c
void cleanup_before_linux(void)
{
    disable_interrupts();
    flush_dcache_all();
    dcache_disable();
    icache_disable();
    mmu_disable();
}
```

---

### Q9: 什麼是 ATF 的 PSCI？

**難度**：⭐⭐⭐⭐⭐
**常見於**：ARM 相關職位

**問題**：
解釋 PSCI 的作用和常見用途。

**標準答案**：

**PSCI (Power State Coordination Interface)**：
- ARM 定義的電源管理標準介面
- 通過 SMC (Secure Monitor Call) 呼叫
- 由 ATF BL31 實作

**常見 PSCI 功能**：
| 功能 | 說明 |
|:---|:---|
| CPU_ON | 啟動一個 Secondary CPU |
| CPU_OFF | 關閉當前 CPU |
| CPU_SUSPEND | 進入低功耗狀態 |
| SYSTEM_RESET | 重啟系統 |
| SYSTEM_OFF | 關閉系統 |

**Linux 使用 PSCI**：
```c
/* arch/arm64/kernel/psci.c */
static int psci_cpu_on(unsigned long cpuid, unsigned long entry)
{
    return invoke_psci_fn(PSCI_0_2_FN64_CPU_ON,
                          cpuid, entry, 0);
}
```

---

### Q10: 如何 Debug 開機問題？

**難度**：⭐⭐⭐⭐

**問題**：
系統開不了機，如何診斷問題在哪個階段？

**標準答案**：

**Debug 方法（由易到難）**：

1. **UART Log**：最基本
```
# 確認 UART 有輸出
# 看最後一行停在哪
U-Boot SPL 2023.01 (...)
Trying to boot from SPI
<停在這裡> → SPL 問題
```

2. **GPIO Beep Code**：沒有 UART 輸出時
```c
/* 用 GPIO LED 或蜂鳴器指示進度 */
void debug_beep(int code) {
    for (int i = 0; i < code; i++) {
        gpio_set_value(DEBUG_LED, 1);
        udelay(100000);
        gpio_set_value(DEBUG_LED, 0);
        udelay(100000);
    }
}
```

3. **JTAG/SWD**：硬體除錯
   - 可以單步執行
   - 查看暫存器
   - 需要專用硬體

4. **常見問題檢查**：
   - DRAM 初始化失敗 → SPL 停止
   - 簽章驗證失敗 → Secure Boot 拒絕
   - Image 損壞 → CRC 錯誤
   - 錯誤的 bootargs → Kernel panic

---

## 📚 延伸閱讀

1. **U-Boot 官方文件**：https://u-boot.readthedocs.io/
2. **ARM Trusted Firmware**：https://trustedfirmware-a.readthedocs.io/
3. **Linux Kernel Documentation**：Documentation/arm64/booting.rst
4. **Bootlin 教材**：https://bootlin.com/doc/training/embedded-linux/
5. **LWN.net**：Boot-related articles

