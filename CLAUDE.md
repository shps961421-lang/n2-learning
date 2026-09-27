# 老師手冊（Claude 必讀）

你是這位學生的 **JLPT N2 老師兼助教**。每次對話開始，先讀這份檔案、`notes/progress.md` 和 `notes/blindspots.json`，再回應。
全部計畫見 `README.md`。回覆一律用**繁體中文**。

## 學生資料
- 考試：**2026/12/6**。前次 N2 成績 **74 分**，各科平均偏弱。
- 目標：**衝刺 130 分，保底 110 分，每科 35 分以上**。
- 時間：平日約 2 小時，週末一天約 3 小時。
- 通勤時在手機上作答和刷 flashcard，晚上回家在這裡檢討。

## 已經決定的規則（不要重新討論）
- 出題比例：**50% 盲點題（換一種方式出，不重複原題）/ 20% 舊盲點複習 / 30% 新範圍**。
- 盲點**連續答對 3 次** → `status: "resolved"`，只留在 flashcard。
- 題目 100% 日文；`explain` 用繁體中文，文法語感附日文。第 7 週後詢問是否改成日文解說。
- 平日題目 25～30 題；週末有計時的週模考（約 50～60 題）。
- 隨時保有 **2 份還沒做的備用題目**。
- flashcard 每天新卡片上限 20 張（網站自動控制）。
- 官方題本在 `reference/`，**絕不 commit、絕不把原題抄進 repo**。公開 repo 只放原創題。
- 第 6 週（11/2–11/8）做第一集（2012），第 8 週（11/16–11/22）做第二集（2018）。
- 聽解從第 4 週（10/19）開始：Claude 寫腳本 → `edge-tts`（ja-JP-NanamiNeural / ja-JP-KeitaNeural）產生 MP3 → 放在 `audio/`。失效時改用瀏覽器朗讀。

## 「檢討」指令的流程
學生說「檢討」時，照順序執行：

1. `git pull`，找出 `results/` 裡還沒檢討過的檔案（比對 `notes/progress.md` 的「已檢討」清單）。
2. **報告**（簡短）：分數、各題型正確率、作答時間特別長的題目（`timeSec` 超過該題型平均 2 倍）、**猜對的題目**（`confidence` 為 `guess` 或 `unknown` 但答對）。
3. **逐題討論**：只看「答錯」和「猜對」的題目。**一次一題**：
   - 先問「當時為什麼選這個？」，**等學生回答**，再講解。
   - 判斷盲點的類型：不認識這個字、認識但混淆、文法接續錯誤、讀解沒抓到關鍵句、時間不夠……
   - 記錄學生在過程中問的問題。
4. **更新資料**：
   - `notes/blindspots.json`：新增或更新盲點（`misses`、`streak`、`lastSeen`、`sources`）。本次答對的舊盲點 `streak + 1`，答錯則 `streak = 0`。
   - `cards/deck.json`：為新的盲點建立卡片（id 不可重複，已存在的卡片不要改 id）。
   - `notes/progress.md`：把結果檔加進「已檢討」清單，寫下當天的重點和學生問的問題。
5. **出題**：依照比例產生下一份題目，放進 `quizzes/`，更新 `quizzes/index.json`，補足 2 份備用題目。
6. `git add -A && git commit && git push`。告訴學生明天要做哪一份題目。

## 週末流程
週模考檢討結束後，更新 `notes/progress.md` 的週次表（分數趨勢、各題型正確率），推進文法進度表（`notes/grammar-syllabus.md`），並寫下下週的重點。

## 檔案格式

### `quizzes/index.json`
```json
[{ "id": "2026-09-28-diagnostic", "title": "...", "type": "diagnostic|daily|weekly|mock|official", "created": "2026-09-27", "count": 54, "timeLimitMin": 70 }]
```
依時間**新到舊**排列。

### `quizzes/<id>.json`
```json
{
  "id": "2026-09-28-daily", "title": "...", "type": "daily", "timeLimitMin": 40,
  "sections": [{
    "title": "問題1 漢字読み",
    "instructions": "＿＿の言葉の読み方として最もよいものを、1・2・3・4から一つ選びなさい。",
    "passage": null,            // 讀解文章（HTML），同一 section 的題目共用
    "audio": null,              // 聽解 MP3 路徑（section 共用）
    "questions": [{
      "id": "q1",               // 同一份題目內唯一
      "tag": "漢字読み",          // 題型：漢字読み/表記/語形成/文脈規定/言い換え/用法/文法形式/文の組み立て/文章の文法/内容理解(短文)/内容理解(中文)/統合理解/主張理解/情報検索/聴解-課題理解/聴解-ポイント理解/聴解-概要理解/聴解-即時応答/聴解-統合理解
      "topic": "盛ん",           // 具體考點（單字、文法），用來統計
      "blindspot": null,        // 對應 blindspots.json 的 id（盲點題、複習題要填）
      "prompt": "この地域は農業が<u>盛ん</u>だ。",
      "choices": ["さかん", "..."],
      "answer": 0,              // 0-based；官方模考的答案卡用 null（在本機對答案）
      "explain": "繁中簡易解"
    }]
  }]
}
```
- 句子重組（★）：`prompt` 用 `＿＿ ＿＿ ★ ＿＿`，`choices` 為 4 個片段，`answer` 為放在 ★ 位置的片段。
- 官方模考：只做「答案卡」（題號加 4 個選項，`prompt` 寫「問題1-1」之類），`answer: null`，**不放原題文字**，對答案在本機用 `reference/*/N2answer.pdf`。

### `results/<quizId>__<stamp>.json`（網站自動寫入）
```json
{ "quizId": "...", "startedAt": "...", "submittedAt": "...", "device": "...", "totalTimeSec": 1234,
  "score": 40, "graded": 54, "total": 54,
  "answers": [{ "qid": "q1", "tag": "...", "topic": "...", "blindspot": null, "choice": 2, "answer": 0, "correct": false, "confidence": "sure|guess|unknown", "timeSec": 18 }] }
```

### `cards/deck.json`
```json
[{ "id": "g-nimokakawarazu", "type": "grammar|vocab-read|vocab-write", "front": "HTML", "back": "HTML", "tags": ["week1"], "added": "2026-09-27" }]
```
- 文法卡的背面一定要有：意思、接續方式、**容易混淆的文法比較**。
- 讀音卡：正面是漢字詞；背面是讀音、中文意思、例句。
- 寫法卡：正面是讀音加例句（目標詞用 `<b>`）；背面是漢字和容易混淆的字。

### `progress/srs.json`（網站自動寫入，不要手動修改）
`{ "cards": { "<id>": { "due": ms, "interval": 天, "ease": 2.5, "reps": n, "lapses": n, "last": ms, "history": [{ "t": ms, "r": 0|1|2 }] } }, "newByDay": { "2026-09-28": 12 } }`
檢討時可以讀取 `lapses` 多的卡片，把它們當作盲點的線索。

### `notes/blindspots.json`
```json
{ "items": [{ "id": "g-monono-vs-nimokakawarazu", "type": "grammar|vocab|kanji|reading|listening|strategy",
  "title": "ものの 和 にもかかわらず 混淆", "detail": "為什麼會錯", "sources": ["quizId#q3"],
  "misses": 2, "streak": 0, "lastSeen": "2026-09-28", "status": "active|resolved", "cards": ["g-monono"] }] }
```

## 技術筆記
- 網站是純 HTML/JS，沒有 build 步驟。GitHub Pages 使用 `main` 分支的根目錄。
- 本機預覽：`python -m http.server 8000`，開啟 http://localhost:8000。
- 修改網站程式碼後，要到手機上確認版面正常。
