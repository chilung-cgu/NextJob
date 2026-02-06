# 💬 行為面試：STAR 題庫 (Behavioral Questions)

> **學習目標**
> 1.  內化 **STAR 敘事法** (Situation, Task, Action, Result)。
> 2.  準備 **4 個核心故事** (Bug, Conflict, Failure, Innovation) 以應萬變。
> 3.  學習 **Firmware 專屬** 的回答策略 (強調 Systematic Debugging)。

---

## 📌 Context: 為什麼行為面試這麼難？

技術題有標準答案，行為題沒有。
但面試官想聽到的不是流水帳，而是你的 **思考過程 (Thought Process)** 和 **決策依據 (Decision Making)**。
最忌諱：講了一堆 "We" (團隊做了什麼)，卻沒聽到 "I" (你具體做了什麼)。

---

## 🧠 Mental Model: STAR 法則

把你的故事框在這個架構裡，不要跑題。

-   **S (Situation)**: 發生什麼事？ (10%) - "系統在燒機測試時隨機 Crash。"
-   **T (Task)**: 你的任務？ (10%) - "我負責找出 Root Cause 並修復。"
-   **A (Action)**: **你做了什麼？** (60%) - "我接上 JTAG，設定 Hardware Breakpoint，分析 Stack Trace..."
-   **R (Result)**: 結果如何？ (20%) - "發現是 Race Condition，修復後提升了 99.9% 穩定度。"

---

## 🔷 Logic I: 四大核心故事 (The Big 4)

你不需要準備 100 個答案，只需要準備這 4 個故事，然後靈活套用。

### 1. 困難的 Bug (The Nasty Bug)
**適用題目**:
-   "Tell me about the hardest bug you've ever solved."
-   "Describe a time you showed perseverance."

**腳本 (Firmware 版)**:
-   **S**: 產線回報 1% 的機台在開機時會卡在 U-Boot，無法複製。
-   **T**: 必須在出貨前解決，壓力巨大。
-   **A**:
    -   我推測是 Timing Issue。
    -   使用 **邏輯分析儀 (Logic Analyzer)** 監控 I2C Bus，發現 ACK 有時會被吃掉。
    -   查閱 Datasheet，發現 Sensor 的 Power-on Sequence 需要 10ms 延遲，但 Spec 沒寫。
    -   我在 Driver 加入 `mdelay(10)` 並加上 Retry 機制。
-   **R**: 問題完全解決，產線良率回到 100%。

### 2. 衝突處理 (The Conflict)
**適用題目**:
-   "Tell me about a time you disagreed with a coworker."
-   "How do you handle difficult feedback?"

**腳本**:
-   **S**: 資深同事想用舊的 Shell Script 做初始化，我想引入 Systemd Service。
-   **T**: 說服團隊採用新技術，但不破壞和氣。
-   **A**:
    -   我沒有直接說他的方法不好，而是做了一個 **POC (Proof of Concept)**。
    -   展示 Systemd 的依賴管理 (Dependency management) 和自動重啟功能。
    -   列出數據：Boot time 減少了 5 秒，且維護更簡單。
-   **R**: 團隊採納了我的方案，且該同事後來也請我教他 Systemd。

### 3. 失敗經驗 (The Failure)
**適用題目**:
-   "Tell me about a mistake you made."
-   "What is your biggest weakness?"

**腳本**:
-   **S**: 為了趕 Release，我在沒有充分測試的情況下 merge 了一個 patch。
-   **T**: 導致 Nightly Build 炸掉，影響了 QA 測試進度。
-   **A**:
    -   我立刻 **Revert** 了該 commit，恢復 Build。
    -   我主動向團隊道歉 (Intellectual Honesty)。
    -   **Post-mortem**: 我寫了一個 Jenkins Pipline 腳本，強制每次 Merge 前都要跑過 Unit Test。
-   **R**: 雖然犯錯，但我們因此建立更嚴謹的 CI/CD 流程。

### 4. 創新與優化 (The Innovation)
**適用題目**:
-   "Tell me about a time you improved a process."
-   "How do you stay efficient?"

**腳本**:
-   **S**: 每次 Release 都要手動跑 50 個由 Excel 管理的測試案例，耗時 2 天。
-   **T**: 我覺得這樣太沒效率，決定自動化。
-   **A**:
    -   我用 **Python + PyTest** 寫了一個自動化測試框架。
    -   透過 UART/SSH 自動對 BMC 下指令並驗證回傳值。
-   **R**: 測試時間從 2 天縮短到 2 小時，且可以每天跑。

---

## 📝 面試官的紅旗 (Red Flags)

避免這些回答，否則會被扣分。

1.  **"We did this..."**: 面試官要雇用的是你，不是你的團隊。多用 "I"。
2.  **"It was simple..."**: 不要輕描淡寫。即使很簡單，也要把它描述得有條理。
3.  **抱怨前公司**: "My boss was an idiot..." (絕對禁止)。
4.  **沒有數據**: "Result was good." (Bad) -> "Improved performance by 20%." (Good).

---

## ✅ 自我檢核表

- [ ] 我有準備好 4 個不同的 STAR 故事了嗎？
- [ ] 每個故事都有具體的技術細節 (JTAG, GDB, Oscilloscope) 嗎？
- [ ] 結果 (Result) 有量化數據嗎？
- [ ] 我能用英文流利地講出這些故事嗎？
