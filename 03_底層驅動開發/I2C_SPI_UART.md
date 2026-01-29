# 🔌 I2C / SPI / UART 通訊協定詳解

> 這三個通訊協定是嵌入式和韌體工程師的必備知識  
> 面試幾乎一定會問！

---

## 📌 三種協定比較

| 特性 | I2C | SPI | UART |
|-----|-----|-----|------|
| **全名** | Inter-Integrated Circuit | Serial Peripheral Interface | Universal Asynchronous Receiver-Transmitter |
| **線數** | 2 條（SDA + SCL）| 4 條（MOSI + MISO + SCK + CS）| 2 條（TX + RX）|
| **速度** | 100kHz / 400kHz / 1MHz+ | 可達 50MHz+ | 通常 9600-115200 bps |
| **全雙工** | ❌ 半雙工 | ✅ 全雙工 | ✅ 全雙工 |
| **Master/Slave** | 多 Master 多 Slave | 1 Master 多 Slave | 點對點 |
| **定址方式** | 7-bit 或 10-bit 位址 | CS（Chip Select）線 | 無需定址 |
| **常見用途** | Sensor、EEPROM、RTC | Flash、顯示器、SD卡 | Debug console、GPS |

---

## 🔷 I2C 協定詳解

### 硬體連接

```
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

### 基本概念

- **SDA (Serial Data)**：資料線，雙向
- **SCL (Serial Clock)**：時脈線，由 Master 產生
- **Pull-up Resistor**：I2C 是 open-drain，需要外部上拉電阻（通常 4.7kΩ）

### I2C 通訊流程

```
1. Start Condition：SDA 從高變低，而 SCL 保持高（表示通訊開始）
2. Address + R/W：Master 送出 7-bit Slave 位址 + 1-bit R/W
3. ACK/NACK：Slave 回應 ACK（低電位）表示收到
4. Data：傳輸 8-bit 資料
5. ACK/NACK：接收方回應
6. 重複 4-5 直到傳輸完成
7. Stop Condition：SDA 從低變高，而 SCL 保持高（表示通訊結束）
```

### 時序圖（簡化）

```
SCL:  ──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──
        └──┘  └──┘  └──┘  └──┘  └──┘  └──┘  └──┘  └──┘  └──┘
        
SDA:  ┐                                                       ┌
      └─┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──────────────────────────┘
        │  Address (7-bit)    │RW│ACK│   Data (8-bit)   │ACK│
     Start                                                  Stop
```

### 常見面試問題

**Q1：I2C 為什麼需要上拉電阻？**
```
I2C 使用 open-drain 輸出：
- 只能主動拉低電壓（接地）
- 無法主動輸出高電壓
- 需要上拉電阻把線拉到 VCC，才能有高電位

好處：
- 允許多個裝置共用同一條線，不會互相干擾
- 實現 wired-AND 邏輯
```

**Q2：如果 Slave 沒有回應 ACK 會怎樣？**
```
- Master 會檢測到 NACK（SDA 保持高電位）
- 通常表示：
  1. 位址錯誤（沒有這個 Slave）
  2. Slave 忙碌無法處理
- Master 應該發送 Stop 或重試
```

**Q3：什麼是 Clock Stretching？**
```
Slave 可以拉住 SCL 使其保持低電位，暫停通訊。
用途：Slave 處理速度較慢時，需要時間準備資料。
Master 必須在 SCL 恢復高電位後才能繼續。
```

**Q4：I2C 有時會「卡住」，如何處理？**
```
可能原因：Slave 在傳輸途中被 reset，導致 SDA 被拉低

解決方法：
1. 發送 9 個 Clock pulse（讓 Slave 完成可能的傳輸）
2. 發送 Stop Condition
3. 重新初始化 I2C
```

---

## 🔷 SPI 協定詳解

### 硬體連接

```
       MCU (Master)                    Flash (Slave)
    ┌─────────────┐                 ┌─────────────┐
    │        MOSI ├─────────────────┤ MOSI (DI)   │
    │        MISO ├─────────────────┤ MISO (DO)   │
    │         SCK ├─────────────────┤ SCK         │
    │          CS ├─────────────────┤ CS (SS)     │
    │         GND ├─────────────────┤ GND         │
    └─────────────┘                 └─────────────┘
```

### 基本概念

- **MOSI (Master Out Slave In)**：Master 送資料到 Slave
- **MISO (Master In Slave Out)**：Slave 送資料到 Master
- **SCK (Serial Clock)**：時脈，由 Master 產生
- **CS (Chip Select)**：選擇要通訊的 Slave（低電位有效）

### SPI 模式

SPI 有 4 種模式，由 **CPOL** 和 **CPHA** 決定：

| Mode | CPOL | CPHA | 時脈閒置狀態 | 資料取樣時機 |
|------|------|------|------------|------------|
| 0 | 0 | 0 | 低 | SCK 上升沿 |
| 1 | 0 | 1 | 低 | SCK 下降沿 |
| 2 | 1 | 0 | 高 | SCK 下降沿 |
| 3 | 1 | 1 | 高 | SCK 上升沿 |

**面試常問：查 Datasheet 確認裝置使用哪個 SPI Mode！**

### 多 Slave 連接

```
方式一：獨立 CS（常見）
       MCU
    ┌───────┐
    │   CS0 ├──── Slave 0
    │   CS1 ├──── Slave 1
    │   CS2 ├──── Slave 2
    │  MOSI ├──── 全部並聯
    │  MISO ├──── 全部並聯
    │   SCK ├──── 全部並聯
    └───────┘

方式二：Daisy Chain（菊花鍊）
    MCU MOSI ──→ Slave0 ──→ Slave1 ──→ Slave2
    MCU MISO ←── Slave0 ←── Slave1 ←── Slave2
```

### 常見面試問題

**Q1：SPI 和 I2C 的主要差異？**
```
1. 速度：SPI 更快（可達數十 MHz）
2. 線數：SPI 需要更多線（每加一個 Slave 多一條 CS）
3. 全雙工：SPI 可同時收發，I2C 不行
4. 定址：I2C 用地址，SPI 用 CS 線
5. 距離：SPI 只適合短距離（同一 PCB 上）
```

**Q2：CPOL 和 CPHA 是什麼？**
```
CPOL (Clock Polarity)：時脈閒置時的電位
- CPOL=0：閒置時 SCK 為低
- CPOL=1：閒置時 SCK 為高

CPHA (Clock Phase)：資料取樣的時機
- CPHA=0：在第一個邊沿取樣（上升或下降沿，取決於 CPOL）
- CPHA=1：在第二個邊沿取樣
```

---

## 🔷 UART 協定詳解

### 硬體連接

```
       MCU                          另一裝置
    ┌───────┐                     ┌───────┐
    │    TX ├─────────────────────┤ RX    │
    │    RX ├─────────────────────┤ TX    │
    │   GND ├─────────────────────┤ GND   │
    └───────┘                     └───────┘
    （注意：TX 接 RX，交叉連接）
```

### 基本概念

- **非同步**：不需要時脈線，收發雙方用相同的 Baud Rate
- **Baud Rate**：每秒傳輸的 bit 數（常見：9600, 115200）
- **點對點**：通常是一對一通訊

### UART Frame 格式

```
    ┌───┬───────────────┬───────┬────┐
    │ S │  D0 D1 ... D7 │ Parity│ Stop│
    └───┴───────────────┴───────┴────┘
    
S = Start bit (1 bit, 必定是 0)
D = Data bits (5-9 bits, 常見 8 bits)
Parity = 同位元檢查 (0 或 1 bit, 可選)
Stop = Stop bit (1 或 2 bits, 必定是 1)
```

### 常見設定

```
範例：115200 8N1
- 115200：Baud Rate
- 8：8 個 data bits
- N：No parity（無同位元檢查）
- 1：1 個 stop bit
```

### 常見面試問題

**Q1：UART 沒有時脈線，如何同步？**
```
1. 收發雙方預先設定相同的 Baud Rate
2. 接收端偵測 Start bit（從高變低）
3. 根據 Baud Rate 計算每個 bit 的時間
4. 在每個 bit 的中間取樣

所以 Baud Rate 必須完全一致！如果差太多會讀錯資料。
```

**Q2：什麼是 Parity Check？**
```
用來檢測資料傳輸是否有錯誤。

- Even Parity：確保 1 的總數是偶數
- Odd Parity：確保 1 的總數是奇數

範例：資料 0x55 = 0b01010101（有 4 個 1）
- Even Parity：Parity bit = 0（4 已經是偶數）
- Odd Parity：Parity bit = 1（4+1=5 變成奇數）

注意：只能檢測單一 bit 錯誤，無法糾正錯誤。
```

---

## ✅ 總結：面試時如何回答「請說明 I2C/SPI/UART」

```
回答架構：
1. 先說全名和基本概念
2. 說明硬體連接（幾條線、各自功能）
3. 說明通訊流程（起始/結束條件、傳輸方式）
4. 提到常見問題或注意事項
5. 最好能舉自己用過的經驗

範例：
「I2C 全名是 Inter-Integrated Circuit，是一種兩線式的串列通訊協定。
使用 SDA 資料線和 SCL 時脈線，採用 open-drain 所以需要上拉電阻。
通訊時 Master 先發 Start condition，再送 7-bit 地址和 R/W bit，
Slave 回應 ACK 後開始傳輸資料。傳輸完成發送 Stop condition。
在我之前的 OpenBMC 工作中，我使用 I2C 讀取各種 sensor 的溫度和電壓資料...」
```
