---
description: 用於系統化重構技術文件，確保符合「金字塔學習架構」。防止「虎頭蛇尾」的自動化流程。
---

# 系統化內容重構流程 (Systematic Content Refactor)

此流程用於將現有的 .md 文件重構為高品質的「金字塔架構」內容。

## 步驟 1: 分析斷層 (Gap Analysis)
1. 讀取目標檔案。
2. 找出「只有 Code/Spec 但缺乏解釋」的段落。
3. 識別讀者可能缺乏的「背景知識」（如硬體物理層、OS 基本原理）。

## 步驟 2: 建構心智模型 (Mental Modeling)
1. 為每個困難概念想一個「白話比喻」。
2. **[Critial]** 繪製 ASCII 或 Mermaid 圖表，描述資料流或控制流。
    - 必須包含：元件互動、時序關係。

## 步驟 3: 分段重寫 (Incremental Rewriting)
**注意**：不要一次重寫整份文件。每次只針對一個 H2 或 H3 章節。

1. **Context**: 寫出面試場景與 Why。
2. **Visuals**: 插入步驟 2 設計的圖表。
3. **Flow**: 用列表或虛擬碼解釋機制。
4. **Ref**: 將原本的 Code/Table 移動到文件末尾的「參考資料」。

## 步驟 4: 品質驗收 (Validation)
// turbo
1. 檢查正文是否還有長篇大論的 Code。
2. 檢查是否每個機制都有對應的圖解。
3. 如果發現做得不夠好，退回步驟 2 重新來過。

---

使用範例：
`Please run the content-refactor workflow on /path/to/file.md`
