---
name: pyramid-refactor
description: 用於重構技術文件以符合「金字塔學習架構」(Pyramid Structure)。強調「面試導向」、「概念先行」與「程式碼降噪」，並嚴格遵守 Markdown 格式規範。
---

# 🏗️ 金字塔重構技能 (Pyramid Refactor Skill)

> [!IMPORTANT]
> 當你執行重構任務或撰寫新章節時，**必須同時遵守**「金字塔架構」與「Markdown 格式規範」。
> 目標是解決「見樹不見林」的問題，同時確保文件格式完美 (Clean & Correct)。

---

## 🔺 金字塔架構 (The Pyramid Structure)

每個主要章節 (H2/H3) **必須** 依照以下順序撰寫：

### 1. 🎯 面試/應用場景 (Context & Why)
- **開頭說明**：這章節解決什麼問題？面試官為什麼要問這個？
- **真實案例**：舉一個實際工作中的場景（Bug、Feature、效能瓶頸）。
- **關鍵字**：列出回答時必須提到的 High-level 關鍵字。

### 2. 🧠 心智模型與圖解 (Mental Model)
- **白話比喻**：用非技術的生活例子解釋（例如：SSE = 訂閱雜誌）。
- **機制圖解**：**必須** 包含 ASCII 圖、Mermaid 流程圖或決策樹。
    - ❌ 禁止只列出暫存器列表。
    - ✅ 畫出 Host 與 BMC 之間的訊號流動。
    - ✅ ASCII 圖解必須標註 `text` 語言 (```text)。
- **背景橋樑**：補充「學校沒教」的硬體/協定背景（如 LPC 物理層、PCIe TLP）。

### 3. ⚙️ 核心邏輯與流程 (Logic & Flow)
- **虛擬碼 (Pseudo-code)**：用 Python-style 的虛擬碼描述邏輯，**移除** Error handling、Type declaration。
- **流程化**：將複雜程式碼轉化為 Step-by-step 的步驟說明。
- **決策點**：說明系統在這裡做了什麼判斷（If A then B）。

### 4. 📚 實作細節與參考 (Reference / Deep Dive)
- **降噪區**：所有的 `struct` 定義、Hex Code 表格、完整的 C function，**全部移到這裡**。
- **查閱用**：標註「需要時再查」。

---

## 🚫 禁止事項 (Strict Prohibitions)

1.  ❌ **禁止在正文 (Context/Mental Model/Logic) 貼出超過 15 行的 C 原始碼**。
2.  ❌ **禁止直接列出暫存器 Bit 定義**，除非你正在用圖解說明它。
3.  ❌ **禁止使用「詳見 Spec」** 這種敷衍的語句，必須消化過 Spec 並轉述重點。
4.  ❌ **禁止沒有圖解的技術解說**，對於複雜機制（如 Page Fault, KCS flow），沒有圖就代表不及格。
5.  ❌ **禁止在 Code Block 內使用 Markdown 語法 (Critical!)**：
    - **嚴禁**將 Markdown Table (`| col | col |`) 放在 \`\`\` 區塊內。
    - **嚴禁**將 Header (`###`) 或 Bold (`**`) 放在 \`\`\` 區塊內。
    - Code Block 僅限於真實程式碼 (`c`, `python`) 或 純文字 ASCII 圖解 (`text`)。

---

## 🎨 格式與語法規範 (Formatting & Syntax Rules)

**必須同時符合 `markdown-polishing` 的標準：**

1.  **表格 (Tables)**：
    - 必須使用標準 Markdown Table 語法 (`| header |`)。
    - **必須置於 Code Block 之外**，讓其渲染為富文本表格。
    - 只有無法用 Grid 表示的複雜 ASCII 示意圖，才使用 \`\`\`text 包裹。

2.  **程式碼區塊 (Code Blocks)**：
    - 必須標註語言 (e.g., \`\`\`c, \`\`\`bash, \`\`\`text)。
    - **ASCII 圖解**一律使用 \`\`\`text。

3.  **列表 (Lists)**：
    - 子項目必須正確縮排 (4 spaces)。
    - 禁止在純文字段落中使用 `(1)`, `(2)` 作為列表，請轉換為 `1.`, `2.`。

4.  **問答 (Q&A)**：
    - 統一使用以下格式：
    ```markdown
    **Q: 問題描述?**
    *   **A**: 回答內容...
    ```

---

## ✅ 自我檢核表 (Self-Check)

每個章節完成後，請回答以下問題：
- [ ] 面試官問「為什麼」時，讀者能用第一段的內容回答嗎？
- [ ] 讀者能看著 ASCII 圖說出資料流向嗎？
- [ ] Code Block 裡面是否有誤用的 Markdown Table？(**檢查重點**)
- [ ] 最底層的 Code 是否都已經移到 Reference 區塊了？
- [ ] Q&A 格式是否符合 `**Q:** / * **A:**` 標準？

---

## 範例結構

```markdown
### 3.1 KCS 介面原理 (Example)

#### 🎯 面試重點
面試官想知道：為什麼在沒有網路時，Host 還能跟 BMC 通訊？...

#### 🧠 機制圖解
LPC Bus 就像是傳紙條的小窗戶...

```text
Host --[0xCA2]--> BMC
```

#### ⚙️ 讀寫流程
1. Host 檢查 IBF (Input Buffer Full) 是否為 0...
2. Host 寫入 CMD...

#### 📚 參考資料
(struct kcs_regs 定義放在這裡)
```
