# 🔌 I2C / SPI / UART 通訊協定詳解

> 這三個通訊協定是嵌入式和韌體工程師的必備知識  
> 面試幾乎一定會問！本章節將從基本概念深入到 Linux Kernel 驅動實作。

---

## 📌 三種協定總覽 (Overview)

在深入細節之前，先比較它們的核心差異。

| 特性 | I2C | SPI | UART |
|-----|-----|-----|------|
| **全名** | Inter-Integrated Circuit | Serial Peripheral Interface | Universal Asynchronous Receiver-Transmitter |
| **線數** | 2 條（SDA + SCL）| 4 條（MOSI + MISO + SCK + CS）| 2 條（TX + RX）|
| **速度** | 100kHz / 400kHz / 1MHz+ | 可達 50MHz+ | 通常 9600-115200 bps |
| **傳輸模式** | ❌ 半雙工 (SDA 共用) | ✅ 全雙工 (MOSI/MISO 獨立) | ✅ 全雙工 (TX/RX 獨立) |
| **Master/Slave** | 多 Master 多 Slave | 1 Master 多 Slave | 點對點 |
| **定址方式** | 7-bit 或 10-bit 位址 | CS（Chip Select）線 | 無需定址 |
| **常見用途** | Sensor、EEPROM、RTC | Flash、顯示器、SD卡 | Debug console、GPS |

---

## 🔷 I2C 協定深究 (I2C Deep Dive)

### 1. Context (概念與應用)

**I2C (Inter-Integrated Circuit)** 的核心設計理念是「省線」與「多裝置連接」。

想像一間教室：
- **SPI** 像是每個學生都有專線電話找老師（每人一條 CS 線）
- **I2C** 像是全班共用一個廣播系統，老師喊學號（地址）再指定誰回答

**特點：**
```text
✅ 省線！只需要 2 條線（SDA + SCL）
✅ 可以接很多裝置（用地址區分，理論上 128 個）
✅ 有 ACK 機制，知道對方有沒有收到
✅ 支援多 Master（進階功能）
❌ 速度較慢（通常 100kHz ~ 400kHz）
❌ 半雙工（不能同時收發）
❌ 需要外部上拉電阻
```

**常見應用：**
- 溫度/濕度 Sensor (BME280)
- EEPROM (AT24C256)
- RTC (DS3231)
- 系統電源管理晶片 (PMIC)

### 2. Mental Model (硬體架構)

#### 硬體連接圖
```text
       MCU (Master)                    Sensor (Slave)
    ┌─────────────┐                 ┌─────────────┐
    │         SDA ├─────────────────┤ SDA         │
    │         SCL ├─────────────────┤ SCL         │
    │         GND ├─────────────────┤ GND         │
    └─────────────┘                 └─────────────┘
                    │    │
                    R    R  ← 上拉電阻（Pull-up Resistor）
                    │    │
                   VCC  VCC
```

#### 關鍵概念：Open-Drain 與上拉電阻

這是 I2C 最重要的硬體特性。I2C 的 PIN 腳只能主動拉低 (Sink Current)，不能主動輸出高電位。

```text
Open-Drain 輸出：
    VCC ─────┬───── R（上拉電阻）
             │        ↓
             └────────┼──────→ 輸出 (SDA/SCL)
                      │
                  【開關】← 只能主動拉「低」
                      │
    GND ──────────────┴─────
    
    邏輯：
    - 開關關閉 (Not Active) → 電阻將線拉到 VCC → High
    - 開關打開 (Active)     → 線接地           → Low
    
    Wired-AND 特性：
    只要總線上任何一個裝置將 SDA 拉低，整條線就是低電位。
    這就是 ACK 機制的基礎：Slave 拉低 SDA 表示「我收到了」。
```

### 3. Logic (通訊協定細節)

#### 訊號定義

| 線名 | 說明 |
| :--- | :--- |
| **SDA** (Serial Data) | 資料線。雙向。Master 和 Slave 輪流使用。 |
| **SCL** (Serial Clock) | 時脈線。單向。永遠由 Master 產生。 |

#### 時序規則
1.  **SCL High**: SDA 必須穩定 (讀取資料)。
2.  **SCL Low**: SDA 可以改變 (準備下一個 bit)。
3.  **例外 (Start/Stop)**: SCL 為 High 時 SDA 變化。

```text
SCL:  ──────┐      ┌──────┐      ┌──────
            │      │      │      │
            └──────┘      └──────┘
              ↑              ↑
            讀取資料       準備資料
```

#### 完整傳輸流程 (Transaction)

寫入 1 byte (0xAB) 到 Slave (0x48):

```text
SCL:  ────┐  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐...
          └──┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─
              1   2   3   4   5   6   7   8   9

SDA:  ─┐                                             ┌────
       └──┬───┬───┬───┬───┬───┬───┬───┬───┬───┬─────┘
          │ 1 │ 0 │ 0 │ 1 │ 0 │ 0 │ 0 │ 0 │ACK│
          │<───── 0x48 地址 ─────>│R/W│   │
       ↑                              │   └── Slave 拉低=收到
     Start                            └── 0=Write
```

**步驟分解：**
1.  **Start**: Master 拉低 SDA (當 SCL 高時)。
2.  **Address**: Master 發送 7-bit 地址 (0x48) + 1-bit R/W (0=Write, 1=Read)。
3.  **ACK**: Slave 識別到自己的地址，在第 9 個 clock 拉低 SDA。
4.  **Data**: Master 發送 8-bit 資料 (0xAB)。
5.  **ACK**: Slave 收到資料，再次拉低 SDA。
6.  **Stop**: Master 拉高 SDA (當 SCL 高時)。

#### ACK vs NACK

| 狀態 | SDA 電位 | 意義 |
| :--- | :--- | :--- |
| **ACK** | 低 | 接收方成功收到資料，且準備好接收下一個 byte。 |
| **NACK** | 高 | 接收方沒反應，或不想再接收資料 (Master Read 最後一個 byte 時)。 |

### 4. Linux Kernel I2C Subsystem (進階實作)

Linux I2C 子系統分為三層，面試時能畫出這個架構圖非常加分。

```text
 ┌─────────────────────────────────────────────────────┐
 │                    Application                       │
 │               (read/write /dev/i2c-N)                │
 └────────────────────────┬────────────────────────────┘
                          ↓
 ┌─────────────────────────────────────────────────────┐
 │                 I2C Core (i2c-core.c)               │
 │     • i2c_transfer() / i2c_smbus_*()                 │
 │     • Device/Driver 匹配                              │
 └────────────────────────┬────────────────────────────┘
                          ↓
 ┌─────────────────────────────────────────────────────┐
 │               I2C Adapter (i2c_adapter)             │
 │     • 代表 I2C Controller 硬體                       │
 │     • 實作 master_xfer() 進行實際 bit-banging 或暫存器操作 │
 └────────────────────────┬────────────────────────────┘
                          ↓
 ┌─────────────────────────────────────────────────────┐
 │                  I2C Hardware                        │
 │            (SoC I2C Controller / GPIO)              │
 └─────────────────────────────────────────────────────┘
```

#### 核心結構 (include/linux/i2c.h)

1.  **`struct i2c_adapter`**: 代表 **I2C Controller** (Master)。
    -   例如：SoC 上有 i2c-0, i2c-1，就是兩個 adapter。
    -   關鍵成員：`algo` (傳輸演算法), `nr` (編號)。

2.  **`struct i2c_client`**: 代表 **I2C Device** (Slave)。
    -   例如：接在總線上的 LM75 溫度感測器。
    -   關鍵成員：`addr` (地址), `adapter` (接在哪個 controller), `irq`。

3.  **`struct i2c_driver`**: 代表 **驅動程式邏輯**。
    -   關鍵函式：`probe()` (初始化), `remove()`。

#### Driver 實作範例 (LM75 溫度 Sensor)

```c
/* Probe 函式：當 Kernel 發現 I2C 裝置匹配時呼叫 */
static int lm75_probe(struct i2c_client *client)
{
    struct lm75_data *data;
    int ret;
    
    /* 1. 分配記憶體 */
    data = devm_kzalloc(&client->dev, sizeof(*data), GFP_KERNEL);
    
    /* 2. 設置 Client Data */
    i2c_set_clientdata(client, data);
    
    /* 3. I2C 通訊測試 (讀取 ID 或暫存器) */
    ret = i2c_smbus_read_word_swapped(client, LM75_REG_TEMP);
    if (ret < 0)
        return ret;
        
    dev_info(&client->dev, "LM75 found!\n");
    return 0;
}

static const struct of_device_id lm75_of_match[] = {
    { .compatible = "national,lm75" },
    { }
};
MODULE_DEVICE_TABLE(of, lm75_of_match);

static struct i2c_driver lm75_driver = {
    .driver = {
        .name = "lm75",
        .of_match_table = lm75_of_match,
    },
    .probe = lm75_probe,
};
module_i2c_driver(lm75_driver);
```

#### API 比較：i2c_transfer vs i2c_smbus_*

**面試必問：這兩個 API 有什麼差別？**

1.  **`i2c_smbus_*`** (推薦使用):
    -   封裝了 SMBus (System Management Bus) 協定，大多數 Sensor 都相容。
    -   自動處理 Start/Stop/ACK 和資料格式。
    -   例如：`i2c_smbus_read_byte_data(client, reg)` = 寫 Reg 地址 -> Restart -> 讀 Data。

2.  **`i2c_transfer`** (底層):
    -   直接控制 I2C Message 序列。
    -   需要建構 `struct i2c_msg` 陣列。
    -   用於非標準 I2C 裝置或需要特殊時序時。

### 5. I2C 常見面試題 (FAQ)

**Q1: 為什麼需要上拉電阻？**
-   因為 I2C 使用 **Open-Drain** 輸出，無法主動輸出 High，必須靠電阻拉高。這實現了 Wired-AND 邏輯，允許多個 Master/Slave 若同時拉低也不會短路。

**Q2: 什麼是 Clock Stretching？**
-   當 Slave (例如慢速 MCU) 來不及處理資料時，它可以將 **SCL 線強制拉低**。
-   Master 發現 SCL 被拉低後，會**暫停傳輸**，直到 Slave 釋放 SCL。
-   Hardware Flow Control 的一種形式。

**Q3: I2C Bus 卡住 (Stuck) 如何恢復 (Bus Recovery)？**
-   **現象**：Slave 在傳送 0 的途中當機或被 Reset，導致 SDA 一直被拉低，Master 無法送出 Start。
-   **解法**：Reference Linux Kernel `i2c_generic_scl_recovery`。
    1.  Master 切換成 GPIO 模式。
    2.  發送 **9 個 SCL pulses** (讓 Slave 吐完剩下的 bits 變成 NACK/Idle)。
    3.  發送 Stop Condition。
    4.  檢查 SDA 是否恢復 High。

---

## 🔷 SPI 協定深究 (SPI Deep Dive)

### 1. Context (概念與應用)

**SPI (Serial Peripheral Interface)** 主打「高速」與「全雙工」。它像是一條高速公路，專門用來搬運大量資料。

**特點：**
```text
✅ 超快！可達 50MHz+ (比 I2C 快 100 倍以上)
✅ 全雙工：Tx 和 Rx 線獨立，可以同時收發
✅ 簡單：沒有 Start/Stop/Ack 這些複雜狀態機
❌ 線多：每多一個 Slave，就多一條 CS 線
❌ 信號完整性：只能短距離使用
```

**常見應用：**
- SPI Flash (存放 BIOS/BMC 韌體)
- 液晶螢幕 (LCD/OLED)
- SD 卡

### 2. Mental Model (硬體架構)

#### 硬體連接圖
```text
       MCU (Master)                    Flash (Slave)
    ┌─────────────┐                 ┌─────────────┐
    │        MOSI ├─────────────────→ MOSI (DI)   │ (Master Out Slave In)
    │        MISO ├←───────────────── MISO (DO)   │ (Master In Slave Out)
    │         SCK ├─────────────────→ SCK         │ (Clock)
    │          CS ├─────────────────→ CS          │ (Chip Select, Active Low)
    │         GND ├─────────────────┤ GND         │
    └─────────────┘                 └─────────────┘
```

#### 多 Slave 連接 (Topology)
1.  **獨立 CS (Standard)**: 每個 Slave 一條 CS 線。
2.  **Daisy Chain (菊花鍊)**: Shift Register 概念。MISO 接下一個 MOSI。優點省線，缺點慢且任一斷掉全斷。

### 3. Logic (通訊協定細節)

#### 4 種模式 (SPI Modes)

這是 SPI 唯一的設定難點。由 **CPOL** (極性) 和 **CPHA** (相位) 決定。

-   **CPOL**: 閒置時 SCK 是 0 還是 1？
-   **CPHA**: 在第幾個邊沿取樣？

| Mode | CPOL | CPHA | 說明 |
| :--- | :--- | :--- | :--- |
| **0** | **0** | **0** | 閒置 Low，第 1 邊沿 (上升) 取樣。**(最常見)** |
| **1** | **0** | **1** | 閒置 Low，第 2 邊沿 (下降) 取樣。 |
| **2** | **1** | **0** | 閒置 High，第 1 邊沿 (下降) 取樣。 |
| **3** | **1** | **1** | 閒置 High，第 2 邊沿 (上升) 取樣。 |

**時序圖 (Mode 0 vs Mode 3):**

```text
Mode 0:
SCK:  _____|‾‾‾‾‾|_____|‾‾‾‾‾|_____
          ↑           ↑
         取樣         取樣

Mode 3:
SCK:  ‾‾‾‾‾|_____|‾‾‾‾‾|_____|‾‾‾‾‾
                 ↑           ↑
                取樣         取樣
```

### 4. Linux Kernel SPI Subsystem

架構類似 I2C，但因為 SPI 常需高速傳輸，會更強調 **DMA (Direct Memory Access)** 與 **Message Queue**。

#### 核心結構 (include/linux/spi/spi.h)

1.  **`struct spi_controller`**: 代表 SPI Master Controller。
    -   成員：`transfer_one` (底層傳輸), `can_dma` (DMA 支援)。
2.  **`struct spi_device`**: 代表 Slave 裝置。
    -   成員：`max_speed_hz`, `mode`, `chip_select`。
3.  **`struct spi_transfer`** & **`struct spi_message`**:
    -   SPI 傳輸以 `message` 為單位，一個 message 包含多個 `transfer`。
    -   `transfer` 包含 tx_buf, rx_buf, len。適合 scatter-gather DMA。

#### SPI Flash Driver 範例 (W25Q64)

讀取 JEDEC ID 流程：

```c
static int w25q_read_id(struct w25q_flash *flash, u32 *id)
{
    u8 cmd = 0x9F;  /* Read JEDEC ID Command */
    u8 buf[3];
    int ret;
    
    /* spi_write_then_read 是封裝好的 API */
    /* 步驟：拉低 CS -> 送 cmd -> 收 3 bytes -> 拉高 CS */
    ret = spi_write_then_read(flash->spi, &cmd, 1, buf, 3);
    
    *id = (buf[0] << 16) | (buf[1] << 8) | buf[2];
    return 0;
}
```

### 5. SPI 常見面試題 (FAQ)

**Q1: spi_sync vs spi_async？**
-   **`spi_sync`**: **Blocking**。呼叫後會睡覺 (Sleep)，直到傳輸完成才醒來。適用於 Process Context。
-   **`spi_async`**: **Non-blocking**。呼叫後立即返回，傳輸在背景進行 (DMA/IRQ)，完成後呼叫 callback。適用於 Interrupt Context。

**Q2: 寫入 SPI Flash 為什麼要先 Erase？**
-   Flash 的物理特性是只能將 1 寫成 0 (Program)，不能將 0 寫成 1。
-   要變回 1，必須執行 **Erase** 指令，這會將整個 Block/Sector 重置為 0xFF (全 1)。
-   流程：Read Sector -> Modify RAM -> Erase Sector -> Write Back。

---

## 🔷 UART 協定深究 (UART Deep Dive)

### 1. Context (概念與應用)

**UART (Universal Asynchronous Receiver-Transmitter)** 是最古老但也最長壽的協定。

**特點：**
-   **非同步 (Asynchronous)**：沒有時脈線 (CLK)。雙方必須約定好 **Baud Rate** (波特率)。
-   **點對點**：通常只接兩個裝置。

### 2. Mental Model (硬體架構)

#### 連接方式 (交叉連接!)
```text
       MCU A                        MCU B
    ┌───────┐                     ┌───────┐
    │    TX ├─────────────────────→ RX    │
    │    RX ↞─────────────────────┤ TX    │
    │   GND ├─────────────────────┤ GND   │
    └───────┘                     └───────┘
```
**口訣：我的嘴巴 (TX) 對你的耳朵 (RX)。**

### 3. Logic (通訊協定細節)

#### Frame 格式
```text
閒置(High)   Start(0)   D0..D7   Parity   Stop(1)
──────────┐  ┌───────┬────────┬────────┬───────
          └──┘       │ Data   │ Check  │
```
-   **Start Bit**: 拉低 1 bit 時間，喚醒接收端。
-   **Data Bits**: 通常 8 bits，**LSB First** (低位先傳)。
-   **Parity**: 奇偶校驗 (可選)。
-   **Stop Bit**: 拉高 1~2 bit 時間，確保有閒置位準。

#### 常見設定：115200 8N1
| 設定 | 意義 |
| :--- | :--- |
| **115200** | Baud Rate。每秒 115200 bits (每個 bit 約 8.7μs)。 |
| **8** | 8 Data Bits。 |
| **N** | No Parity。 |
| **1** | 1 Stop Bit。 |

#### Flow Control (流控)
當接收端來不及處理時使用。
1.  **Hardware (RTS/CTS)**: 額外兩條線。CTS 拉高叫對方暫停。
2.  **Software (XON/XOFF)**: 傳送特殊字元 (Ctrl+S / Ctrl+Q) 叫對方暫停/繼續。

### 4. Linux Kernel UART Subsystem (TTY)

UART 在 Linux 中屬於 **TTY (Teletype)** 子系統。

```text
User Space (open /dev/ttyS0)
      ↓
TTY Core (行規 Line Discipline) <--- 處理 Backspace, Enter 等
      ↓
UART Core (serial_core.c)
      ↓
UART Driver (8250.c / amba-pl011.c)
      ↓
Hardware (FIFO / Registers)
```

#### 關鍵結構 (include/linux/serial_core.h)
-   **`struct uart_port`**: 代表硬體 Port (Base address, IRQ, Clock)。
    -   `ops`: 指向 `struct uart_ops` (start_tx, stop_tx)。
-   **`struct ktermios`**: 存放設定 (Baud rate, Parity, Flow control)。

### 5. UART 常見面試題 (FAQ)

**Q1: 如何在沒有邏輯分析儀的情況下判斷 Baud Rate？**
-   用示波器量測 **「最窄的脈波寬度」**。
-   因為 UART 訊號是由一連串 bits 組成，最短的 High 或 Low 區段通常就是 1 bit 的寬度。
-   頻率 = 1 / 時間寬度。

**Q2: 為什麼 TX/RX 接反會沒反應？**
-   TX 接 TX (兩個都輸出) 沒人聽；RX 接 RX (兩個都輸入) 沒人說。
-   而且若兩個 TX 一高一低，可能造成短路 (雖然這時代通常有保護)。

---

## 🎯 決策指南 (Decision Guide)

面試題：「如果你要設計一個系統，怎麼選擇通訊協定？」

請畫出或描述這個決策樹：

| 需求場景 | 首選協定 | 理由 |
| :--- | :--- | :--- |
| **Debug Log / PC 通訊** | **UART** | 簡單，且 PC 端常用 USB-UART Dongle。 |
| **感測器 (溫度/RTC/PMIC)** | **I2C** | 裝置多，速度要求不高，省 GPIO。 |
| **大量資料 (Flash/LCD)** | **SPI** | 速度快 (MHz等級)，全雙工。 |
| **長距離抗雜訊** | **RS-485/CAN** | (UART 的差分訊號變體) |

```text
決策流程：
1. 裝置支援嗎？ (Datasheet 說了算)
2. 速度要求高嗎？ (Yes: SPI, No: I2C/UART)
3. 距離遠嗎？ (Yes: RS-485/CAN, No: I2C/SPI)
4. GPIO 夠嗎？ (No: I2C, Yes: SPI)
```
