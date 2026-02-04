# 🔌 Linux 驅動模型與硬體互動 (Device Model & DMA)

> **學習目標**
> 1.  深入理解 Linux Device Model (Bus, Device, Driver)
> 2.  掌握 Platform Driver 與 Device Tree 的配對機制 (Probe)
> 3.  **精通 DMA Mapping (Streaming vs Coherent)** - 韌體面試必考題
> 4.  理解 Cache Coherency 與 Memory Barrier 在驅動中的應用

---

## 🔷 第一部分：Linux Device Model

### 1.1 為什麼需要 Device Model？

```
在 Linux 2.6 之前，驅動程式往往直接操作硬體位址，缺乏統一管理。
Device Model 的引入是為了解決：

1.  **統一裝置視圖**：sysfs (/sys/) 提供所有裝置的樹狀結構
2.  **熱插拔 (Hotplug)**：動態處理裝置的新增與移除
3.  **電源管理 (Power Management)**：關機順序 (先關 Child，再關 Parent)
4.  **各司其職**：
    -   Board support code 描述「有什麼裝置」(Device)
    -   Driver code 描述「怎麼驅動裝置」(Driver)
    -   Bus core 負責「讓兩者相遇」(Match & Probe)
```

### 1.2 核心結構：Bus, Device, Driver

```c
/* 1. Bus (匯流排) */
/* 代表 CPU 與裝置溝通的通道，如 I2C, SPI, PCI, Platform */
struct bus_type {
    const char *name;
    int (*match)(struct device *dev, struct device_driver *drv); /* 關鍵！ */
    int (*probe)(struct device *dev);
};

/* 2. Device (裝置) */
/* 代表一個硬體裝置實體 */
struct device {
    struct device_driver *driver;  /* 綁定到的 Driver */
    struct bus_type *bus;          /* 所屬的 Bus */
    struct device_node *of_node;   /* 指向 Device Tree 節點 */
    void *platform_data;           /* 舊式板級資訊 */
    /* ... kobject 用於參照計數與 sysfs ... */
};

/* 3. Driver (驅動) */
/* 代表軟體驅動程式 */
struct device_driver {
    const char *name;
    struct bus_type *bus;
    const struct of_device_id *of_match_table; /* 用於與 DT 比對 */
    int (*probe)(struct device *dev);          /* 驅動初始化入口 */
    int (*remove)(struct device *dev);
};
```

### 1.3 關鍵流程：Match 與 Probe

最常被問的問題：「Driver 的 `probe` 函式是誰呼叫的？什麼時候呼叫？」

```
初始化流程：
1. Driver 向 Kernel 註冊 (driver_register)
2. Bus Core 遍歷 Bus 上所有尚未綁定的 Device
3. 呼叫 Bus 的 .match() 函式，檢查 Driver 與 Device 是否匹配
   - 比較名稱？
   - 比較 Device Tree 的 compatible string？(常用)
   - 比較 PCI Vendor/Device ID？
4. 如果 Match 成功：
   - Bus Core 呼叫 Driver 的 .probe(device)
   - Driver 在 probe() 中進行硬體初始化 (ioremap, request_irq 等)

這就是為什麼你在寫 driver 時，通常看不到 main()，只有 probe()！
```

---

## 🔷 第二部分：Platform Driver 與 Device Tree

嵌入式系統 (ARM) 最常用的是 `platform_bus`。

### 2.1 範例：一個簡單的 Platform Driver

```c
/* 定義匹配表：這些字串必須跟 Device Tree (DTS) 裡的一樣 */
static const struct of_device_id my_driver_dt_ids[] = {
    { .compatible = "vendor,my-device-v1", },
    { .compatible = "vendor,my-device-v2", },
    { /* sentinel */ }
};
MODULE_DEVICE_TABLE(of, my_driver_dt_ids);

/* Probe 函式：當裝置被發現時執行 */
static int my_driver_probe(struct platform_device *pdev)
{
    struct resource *res;
    void __iomem *base;
    int irq;

    /* 1. 取得硬體資源 (從 DTS 解析而來) */
    base = devm_platform_get_and_ioremap_resource(pdev, 0, &res);
    if (IS_ERR(base))
        return PTR_ERR(base);

    irq = platform_get_irq(pdev, 0);

    /* 2. 註冊中斷、初始化硬體 ... */
    
    return 0;
}

/* 定義 Driver 結構 */
static struct platform_driver my_driver = {
    .probe = my_driver_probe,
    .remove = my_driver_remove,
    .driver = {
        .name = "my_driver",
        .of_match_table = my_driver_dt_ids, /* 綁定匹配表 */
    },
};

/* 註冊 Driver 到 Kernel */
module_platform_driver(my_driver);
```

### 2.2 對應的 Device Tree (DTS)

```dts
/* 在 .dts 檔案中 */
my_device@1000 {
    compatible = "vendor,my-device-v1";  /* 必須匹配！ */
    reg = <0x1000 0x100>;                /* I/O 位址 */
    interrupts = <10 IRQ_TYPE_LEVEL_HIGH>; /* IRQ 號碼 */
};
/* Kernel 開機時解析 DTS -> 建立 platform_device -> 觸發 match -> 呼叫 probe */
```

---

## 🔷 第三部分：DMA (Direct Memory Access)

這是韌體工程師面試的**重中之重**。你必須能清楚解釋 DMA Mapping 的兩種類型以及 Cache Coherency 問題。

### 3.1 為什麼需要 DMA？
為了減輕 CPU 負擔。CPU 只需要告訴 DMA controller：「把 Address A 的 1KB 資料搬到 Address B」，然後 CPU 就可以去做別的事，DMA 搬完後發中斷通知 CPU。

### 3.2 虛擬 vs 實體位址
- **CPU 看到的是 Virtual Address (VA)**。
- **DMA Controller 看到的是 Physical Address (PA) 或 IO Virtual Address (IOVA)**。
- **錯誤觀念**：直接把 `kmalloc` 的指標傳給 Hardware Register。
- **正確做法**：必須經過 `dma_map_*` API 將 VA 轉換為 DMA Handle (dma_addr_t)。

### 3.3 Cache Coherency (快取一致性) 問題 ✨✨✨

```
        CPU <--> Cache <--> DRAM
                  |
              HW (DMA)
```
- **問題 A (CPU 寫入髒資料)**：CPU 修改了 buffer，但資料還在 Cache 裡 (Dirty)，沒有寫回 DRAM。此時 DMA 從 DRAM 搬資料，會搬到舊的資料。
- **問題 B (DMA 寫入新資料)**：DMA 把資料搬進 DRAM 了，但 CPU 還讀取 Cache 裡的舊資料 (Stale)。

**解法：Cache Flush (Clean) & Invalidate**
- **Clean (Flush)**：把 Cache 的髒資料寫回 DRAM。(CPU -> Device 時用)
- **Invalidate**：把 Cache 標記為無效，下次強制從 DRAM 讀。(Device -> CPU 時用)

### 3.4 兩種 DMA Mapping 類型

Kernel 提供了兩套 API，對應不同的使用場景。面試時請務必區分清楚。

#### A. Coherent Mapping (一致性映射)
- **特點**：硬體或 Kernel 保證 CPU 和 DMA 看到的內容永遠一致。不需要手動做 sync/flush。
- **缺點**：通常會關閉 Cache (Uncached) 或使用硬體 Cache Coherent Interconnect，效能較差。
- **適用**：長期的、頻繁的小資料通訊，如 Network Descriptor Rings、Command Buffers。

```c
/* 配置 */
dma_addr_t dma_handle;
void *cpu_addr = dma_alloc_coherent(dev, size, &dma_handle, GFP_KERNEL);

/* 使用：直接讀寫 cpu_addr，硬體會透過 dma_handle 讀寫 */
/* 不需要 sync */

/* 釋放 */
dma_free_coherent(dev, size, cpu_addr, dma_handle);
```

#### B. Streaming Mapping (流式映射)
- **特點**：效能最好，但需要工程師手動管理它。
- **適用**：一次性的大資料傳輸，如 Network Packets (sk_buff)、Storage Data。

```c
/* 1. 準備 Buffer (通常是 kmalloc 出來的) */
void *buf = kmalloc(size, GFP_KERNEL);

/* 2. Map (這時會根據方向做 Cache Clean/Invalidate) */
/* DMA_TO_DEVICE: CPU 寫資料給周邊，執行 Cache Clean */
dma_addr_t dma_handle = dma_map_single(dev, buf, size, DMA_TO_DEVICE);

/* 檢查 mapping 是否成功 */
if (dma_mapping_error(dev, dma_handle)) { /* 處理錯誤 */ }

/* 3. 告訴 Device 用這個 dma_handle 開始搬運 */
writel(dma_handle, REG_DMA_ADDR);

/* ... 硬體搬運中 ... */

/* 4. Unmap (這時如果是 DMA_FROM_DEVICE，會執行 Cache Invalidate) */
dma_unmap_single(dev, dma_handle, size, DMA_TO_DEVICE);
```

#### 進階題：`dma_sync_single_for_cpu` / `device`
如果 buffer 需要重複使用 (reused)，不想在此期間 unmap 怎麼辦？
```c
/* 給 Device 用之前 */
dma_sync_single_for_device(dev, dma_handle, size, direction);
/* Device 搬完，CPU 要讀之前 */
dma_sync_single_for_cpu(dev, dma_handle, size, direction);
```

---

## 🔷 第四部分：Linux Kernel 中的 MMIO (Memory Mapped I/O)

### 4.1 `ioremap` vs `request_mem_region`
- `request_mem_region(start, len, name)`：只是向 Kernel 申請這塊實體記憶體區域的使用權 (保留位置)，防止別人用。並**沒有**做頁表映射。
- `ioremap(phys_addr, size)`：真正的做事者。它會建立 Page Table，將實體位址映射到 Kernel Virtual Address (通常是 `vmalloc` 區域)，並設定為 **Device Memory (nGnRE)** 屬性 (Uncached, 無法預測執行的 Side-effect)。

### 4.2 正確的 Register 存取方式
不要直接用 pointer dereference (`*ptr = val`)！
ARM 架構對於 instruction ordering 比較寬鬆，必須使用專用巨集來保證順序與 Barrier。

```c
void __iomem *base = ioremap(0x10000000, 0x1000);

/* 寫入 */
writel(0x1234, base + 0x10);       /* Write 32-bit */
writeb(0x12,   base + 0x14);       /* Write 8-bit */

/* 讀取 */
u32 val = readl(base + 0x10);      /* Read 32-bit */

/* iounmap */
iounmap(base);
```

`writel` 內部通常隱含了 Memory Barrier (如 `wmb()`)，確保在寫入暫存器之前，前面的 memory write 已經完成 (這對 DMA trigger 很重要)。

---

## 📝 面試題庫

### Q1: 在 Linux Driver 中，什麼時候該用 `dma_alloc_coherent`，什麼時候用 `dma_map_single`？
**難度**：⭐⭐⭐⭐⭐
**答案**：
- **dma_alloc_coherent**：用於**長期存在**的映射，通常是控制器需要的控制結構，如 Ethernet 的 RX/TX Descriptor Ring。它會配置一段一致性的記憶體，CPU 寫入立即可見，無需手動 sync。代價是可能 bypass cache，存取慢。
- **dma_map_single**：用於**一次性**的資料傳輸 (Streaming)，如網路封包的 data payload。它使用既有的 Cache 機制，但在 map/unmap 時需要做 Cache Maintenance (Flush/Invalidate)。效能較好，適合大資料。

### Q2: 為什麼存取硬體暫存器要用 `readl/writel` 而不是直接指標操作？
**難度**：⭐⭐⭐⭐
**答案**：
1.  **Memory Barrier**：`writel` 包含了 barrier，確保編譯器和 CPU 不會對指令進行重排 (Reordering)，保證依序寫入。
2.  **Width & Endianness**：保證特定的存取寬度 (32-bit) 和端序 (Little/Big Endian 轉換)。
3.  **Side Effect 屬性**：指標操作可能會被編譯器優化掉 (如果是 volatile 指標稍微好點，但仍無法解決 barrier 問題)。

### Q3: Platform Device 和 Device Tree 是如何 Match 的？
**難度**：⭐⭐⭐
**答案**：
1.  System Boot 時，Kernel 解析 Device Tree，將每個節點轉換為 `struct platform_device`。
2.  Driver 載入時，註冊 `struct platform_driver`。
3.  Bus Core 檢查 Driver 的 `.of_match_table` 中的 `compatible` 字串。
4.  如果與 Device Tree 中的 `compatible` 屬性相同，則視為 Match。
5.  呼叫 Driver 的 `.probe()` 函式。

### Q4: 什麼是 Bounce Buffer？
**難度**：⭐⭐⭐⭐
**答案**：
當 Device 的 DMA 能力有限 (例如只能定址 32-bit，即 4GB 以下)，但 OS 給的 Buffer 位於高位址 (High Memory, >4GB) 時，DMA 無法直接存取。
此時 `dma_map_single` 會自動配置一塊低位址的 Buffer (Bounce Buffer)，CPU 將資料 copy 過去，再讓 Device 搬運。這會嚴重影響效能，應盡量避免 (如使用 IOMMU 或正確設定 `dma_mask`)。
