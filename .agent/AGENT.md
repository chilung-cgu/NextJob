# NextJob 外商韌體面試聖經 - 專案規則

> [!NOTE]
> 這份 `AGENT.md` 是專案級規則，當 AI 在這個專案目錄下工作時會自動讀取並遵守。

---

## 專案基本資訊

- **專案名稱**：NextJob 外商韌體面試聖經
- **專案目標**：建立一份能讓使用者「只讀這一份資料，就能從容應對 80% 以上外商 IC/BMC 韌體技術面試題」的完整教材
- **目標職位**：NVIDIA、AMD、Apple、Google、Microsoft、Amazon (AWS) 等外商的 Firmware Engineer / System Software Engineer / BMC Engineer

---

## 🚨 強制規則 (Gate Check)

> [!CAUTION]
> **這是硬性規則，必須嚴格遵守。**

### 行數門檻

| 章節 | 最低行數 | 理想行數 |
|:---|---:|---:|
| 02_C語言 | 1500 | 2000+ |
| 03_底層驅動開發 | 2000 | 2500+ |
| 04_OpenBMC深化 | 2500 | 3000+ |
| 05_作業系統 | 2000 | 2500+ |

### 完成驗證條件

每個檔案完成時，**必須同時滿足**：

1. **行數達標**：`wc -l <檔案>` >= 上表最低行數
2. **面試題數量**：>= 10 題
3. **技術點覆蓋**：對照 `rebuild-content.md` 確認已涵蓋列出的技術點

### 未達標處理

- ❌ **禁止**：宣稱完成但未達標
- ❌ **禁止**：跳過未完成的檔案繼續下一個
- ✅ **必須**：繼續擴充直到達標

---

## 內容撰寫標準

### 深度要求
- 每個章節必須能回答「中高難度面試題」，而非僅是概念介紹
- 每個章節結尾必須包含 **至少 10 題面試題庫** 含詳解

### 結構要求
每個 `.md` 檔案應包含：
1. 概述與學習目標
2. 系統性教學內容（含圖解、原始碼節選、實作範例）
3. 常見誤區與最佳實踐
4. 面試題庫（含詳解）
5. 延伸閱讀（書籍、Kernel Doc、Bootlin 教材連結）

### 語言規則
- 主體內容使用**繁體中文**
- 技術名詞保持**英文原文**（如 Context Switch, Page Fault, Device Tree）
- 程式碼註解使用繁體中文

---

## Git Commit 規則

使用 Conventional Commits 格式：

```
<type>(<scope>): <subject>

範例：
docs(02_C語言): 深度擴充指標與記憶體管理章節
docs(04_OpenBMC): 新增 PLDM/SPDM 完整協定說明
fix(03_驅動): 修正 Driver Model 圖解錯誤
```

**Type 選項**：
- `docs`：文件內容變更（主要使用這個）
- `fix`：修正錯誤內容
- `feat`：新增章節

---

## 目錄結構

```
NextJob/
├── .agent/                     # AI 配置目錄
│   ├── AGENT.md               # 本檔案 - 專案級規則（含 Gate Check）
│   ├── skills/                # 可重用能力
│   │   └── deep-expansion/
│   ├── workflows/             # 執行流程步驟
│   │   └── rebuild-nextjob.md
│   └── prompts/               # 詳細內容要求
│       └── rebuild-content.md
├── 02_C語言/
├── 03_底層驅動開發/
├── 04_OpenBMC深化/
├── 05_作業系統/
├── 06_面試準備/
└── README.md
```

---

## 驗證標準

完成後，內容應能回答以下等級的問題：

**C 語言**：
- 「`static inline` 和 `extern inline` 有什麼區別？」
- 「請手寫 `aligned_malloc(size_t size, size_t alignment)` 實作。」

**OS/Bootloader**：
- 「CFS 如何計算 vruntime？」
- 「ATF BL31 是如何跳轉到 BL33 的？」

**Driver/Interrupt**：
- 「`devm_request_irq` 和 `request_irq` 有什麼區別？」
- 「在 Interrupt Context 中，可以呼叫 `mutex_lock()` 嗎？」

**OpenBMC**：
- 「PLDM Type 2 的 PDR 結構是什麼？」
- 「OpenBMC D-Bus Object Path 命名規則是什麼？」
