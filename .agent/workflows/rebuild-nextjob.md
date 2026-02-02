---
description: 重新打造 NextJob 外商韌體面試聖經 (觸發完整內容擴充流程)
---

# 🚀 Rebuild NextJob 外商韌體面試聖經

此 Workflow 搭配 Skill 和詳細指令使用，逐章節深度擴充學習資料。

---

## 🚨 強制規則 (Gate Check)

> [!CAUTION]
> 每個檔案完成後，**必須通過以下 Gate Check 才能繼續**：
> 
> 1. **行數達標**：執行 `wc -l <檔案>` 確認達到 rebuild-content.md 的行數要求
> 2. **面試題數量**：確認有 10+ 題面試題
> 3. **禁止宣稱完成卻達不到**：如果沒達標，**必須繼續擴充**，不可跳過
> 
> **如果 AI 衰減（越做越敷衍）**：
> - 立即停止
> - 重新讀取 SKILL.md 和 rebuild-content.md
> - 從上次達標的檔案繼續

---

## Step 1: 讀取規則文件

**必須依序讀取以下文件：**

1. `.agent/skills/deep-expansion/SKILL.md` - 品質標準（行數、結構、禁止事項）
2. `.agent/prompts/rebuild-content.md` - 各章節的**具體內容要求**（非常重要！）

> [!IMPORTANT]
> `rebuild-content.md` 包含每個章節應該涵蓋的具體技術點，例如：
> - 02_C語言 要涵蓋：Pointer to Pointer, Function Pointer, volatile, Inline vs Macro...
> - 03_底層驅動 要涵蓋：Linux Device Model, Platform Driver, probe timing, devm_ API...
> 
> 如果不讀取這份文件，你只會知道「要寫多深」，但不知道「具體要寫什麼」。

---

## Step 2: 依序擴充章節

按照以下順序執行，每完成一個**檔案**後執行 Gate Check：

// turbo-all

### 2.1 擴充 02_C語言/（目標：每檔 1500+ 行）
擴充此目錄下所有 `.md` 檔案，遵守 Skill 和 rebuild-content.md 中的標準。

**Gate Check：**
```bash
wc -l 02_C語言/*.md
# 每個檔案必須 >= 1500 行
```

完成後：
```bash
git add . && git commit -m "docs(02_C語言): 深度擴充完成"
```

### 2.2 擴充 03_底層驅動開發/（目標：每檔 2000+ 行）
依序擴充：`驅動程式基礎.md` → `中斷處理.md` → `I2C_SPI_UART.md`

**Gate Check：**
```bash
wc -l 03_底層驅動開發/*.md
# 每個檔案必須 >= 2000 行
```

完成後：
```bash
git add . && git commit -m "docs(03_驅動): 深度擴充完成"
```

### 2.3 擴充 04_OpenBMC深化/（目標：每檔 2500+ 行）
依序擴充：`架構複習.md` → `面試重點.md` → `專案經驗整理.md`

**Gate Check：**
```bash
wc -l 04_OpenBMC深化/*.md
# 架構複習.md >= 2500 行
# 面試重點.md >= 2500 行
```

完成後：
```bash
git add . && git commit -m "docs(04_OpenBMC): 深度擴充完成"
```

### 2.4 擴充 05_作業系統/（目標：每檔 2000+ 行）
依序擴充：`Linux核心概念.md` → `Bootloader.md` → （如需要可新增檔案）

**Gate Check：**
```bash
wc -l 05_作業系統/*.md
# 每個檔案必須 >= 2000 行
```

完成後：
```bash
git add . && git commit -m "docs(05_OS): 深度擴充完成"
```

---

## Step 3: 完成

執行最終 Commit：
```bash
git add . && git commit -m "docs: 完成面試聖經 v2.0 全面升級"
```

---

## 注意事項

- **每個檔案完成後**：執行 Gate Check，未達標不可繼續
- **品質下降時**：重新閱讀 Skill 和 rebuild-content.md
- **遵守 AGENT.md**：繁體中文、Conventional Commits
- **避免 Token Limit**：每次只處理一個檔案，完成後暫停
- **長對話衰減時**：主動告知使用者「需要重新開始新對話」

---

## 行數目標速查

| 章節 | 目標行數 |
|:---|---:|
| 02_C語言 | 每檔 1500+ |
| 03_底層驅動開發 | 每檔 2000+ |
| 04_OpenBMC深化 | 每檔 2500+ |
| 05_作業系統 | 每檔 2000+ |
