---
description: 重新打造 NextJob 外商韌體面試聖經 (觸發完整內容擴充流程)
---

# 🚀 Rebuild NextJob 外商韌體面試聖經

此 Workflow 搭配 `deep-expansion` Skill 使用，逐章節深度擴充學習資料。

---

## Step 1: 讀取品質標準

閱讀 `.agent/skills/deep-expansion/SKILL.md`，了解深度擴充的具體要求。

---

## Step 2: 依序擴充章節

按照以下順序執行，每完成一個檔案後等待使用者確認：

// turbo-all

### 2.1 擴充 02_C語言/
擴充此目錄下所有 `.md` 檔案，遵守 Skill 中的深度標準。
完成後：
```bash
git add . && git commit -m "docs(02_C語言): 深度擴充完成"
```

### 2.2 擴充 03_底層驅動開發/
依序擴充：`驅動程式基礎.md` → `中斷處理.md` → `I2C_SPI_UART.md`
完成後：
```bash
git add . && git commit -m "docs(03_驅動): 深度擴充完成"
```

### 2.3 擴充 04_OpenBMC深化/
依序擴充：`架構複習.md` → `面試重點.md`
完成後：
```bash
git add . && git commit -m "docs(04_OpenBMC): 深度擴充完成"
```

### 2.4 擴充 05_作業系統/
依序擴充：`Linux核心概念.md` → `Bootloader.md`
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

- **每個檔案完成後暫停**，等待使用者說「繼續」
- **品質下降時**：重新閱讀 `.agent/skills/deep-expansion/SKILL.md`
- **遵守 AGENT.md**：繁體中文、Conventional Commits
