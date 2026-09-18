# Pipeline parameters and why they were chosen

Every number and choice in ingestion, retrieval, answering and the agent, with its reason. Read with [ingestion.md](ingestion.md), [retrieval.md](retrieval.md) and [agent.md](agent.md).

**How to read the "Source" column.** This page does not invent history.

- **Decision** — the reason is recorded in [decisions.md](../decisions.md) (linked).
- **Code** — the reason is stated in a comment or docstring next to the value.
- **Inferred** — no reason was written down. The text gives the most likely engineering reason, and the value should be treated as a starting heuristic that has **not been tuned against the golden set**. These are the first candidates for experiments ([pipeline-review.md](pipeline-review.md)).

## Summary: the numbers most people ask about

| Question | Answer |
| --- | --- |
| How many passages does search fetch per leg? | **20** (lookup), **40** (explore), **45** (summarize) from each of dense and keyword search |
| How many go to the reranker? | All fused candidates, up to those same 20 / 40 / 45 |
| How many survive reranking? | **10 / 18 / 24** (the MMR pool) |
| What is the final top-k given to the answer model? | **5** (lookup), **8** (explore), **12** (summarize), after MMR, and for explore/summarize at most **3 per document** |
| Chunk size? | Target **480** tokens, whole-section ceiling **800**, overlap **64**, merge below **80** (estimated tokens) |
| Embedding? | `gemini-embedding-001`, **1,536** dimensions, unit-normalised, HNSW cosine |
| Fusion? | Reciprocal rank fusion, **k = 60**, keyword leg weighted **1.2** for lookup |
| When is retrieval "good enough"? | Top rerank score **≥ 0.50**: good; **< 0.22**: weak; in between: a model grades it |
| How many retries? | **1** rewrite, so at most **2** attempts |
| When is an answer flagged? | Confidence **< 0.35**, or not grounded, no citations, not answerable, or injection suspected |
| Agent limits? | **6** tool steps, **8** history turns, **2** document answers and **5** proposals per message |

---

## 1. Upload and ingestion limits

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| Accepted types | PDF, DOCX | [D-022](../decisions.md#d-022) | PRD MUST scope for Week 1. Excel, PowerPoint and images are out |
| Type detection order | Extension, then MIME | Code | Browsers report MIME types unreliably |
| Max upload | 25 MB | Code | Matches the Storage bucket's file size limit, so the API refuses before storage would |
| `MAX_PDF_PAGES` | 1,500 | [D-041](../decisions.md#d-041) | Bound CPU and memory for one parse. Real documents on hand pass (largest 86 pages) |
| `MAX_DOCX_ENTRIES` | 5,000 | [D-041](../decisions.md#d-041) | A .docx is a zip; bounds a crafted archive with huge numbers of parts |
| `MAX_DOCX_UNCOMPRESSED_BYTES` | 200 MB | [D-041](../decisions.md#d-041) | Zip bomb defence: a few KB can expand to gigabytes |
| `MAX_PASSAGES_PER_DOCUMENT` | 3,000 | [D-041](../decisions.md#d-041) | Bounds embedding cost and time. At 100 texts a minute on the free tier, 3,000 is about 30 minutes |
| Duplicate detection | SHA-256 of bytes per workspace | Code, migration | The same file twice is a duplicate source, not a new one; would double every passage in results |
| Storage upload credential | Caller's token | Code | Bucket policies apply on top of the API's role check (defence in depth) |
| Processing | FastAPI background task, parse in a worker thread | Code | Upload returns 202 at once; parsing is CPU-bound and would block the event loop |
| Chunks saved before embedding | Yes | [D-034](../decisions.md#d-034) | Owner wanted to preview chunking of a large file straight away without an approval step |
| Search only `ready` documents | Yes | [D-034](../decisions.md#d-034) | A half-embedded document would give inconsistent results |
| Insert batches | chunks 200, embeddings 40 | Inferred | Keep each PostgREST request body small; a 1,536-d vector written as text is about 17 KB, so 40 is about 700 KB |

## 2. PDF parsing heuristics

PyMuPDF was chosen for the best table and layout detection available, with its AGPL licence flagged for replacement or a commercial licence before production ([D-024](../decisions.md#d-024)). All thresholds below are in [`parsers/pdf.py`](../../backend/app/rag/parsers/pdf.py).

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| Tables before text | Tables detected first, their area masked | Code | Otherwise table cells leak back in as loose sentences |
| Borderless table fallback | Only when no ruled table was found | Code | Ruled detection is reliable; whitespace detection is not |
| Plausible borderless table | ≥ 3 rows, ≥ 2 columns, ≥ 50% cells filled, mean cell ≤ 40 chars | Code (purpose), Inferred (numbers) | "Guard the borderless fallback, which can otherwise claim a whole page." Long cells look like prose, not a table. **Measured: not strict enough for two-column papers** |
| Reject table covering | > 92% of page, or < 2 rows | Inferred | A "table" that is the whole page is layout, not data |
| Scanned page | < 90 extracted characters and no table | Inferred | Fewer characters than a short paragraph means no usable text layer; page numbers alone stay under it |
| OCR | None | [D-022](../decisions.md#d-022) | Faster, cheaper ingestion; no model or OCR engine calls during parsing |
| Body size | Font size carrying the most characters | Code | Robust to many short headings in large fonts |
| Heading by size | ≥ 1.12 × body | Inferred | Catches one step up in a typical type scale (e.g. 10 → 11.2 pt) without catching rounding noise |
| Heading by weight | bold, ≥ 0.97 × body, ≤ 90 chars | Inferred | Bold run-in headings at body size are common in reports; the length cap stops bold sentences counting |
| Heading max length | 130 chars | Inferred | Longer lines are sentences |
| Not a heading | Bullets, or ends in `. ! ? ; :` (unless numbered like `2.1`) | Code | Numbered section titles often end in punctuation; sentences do too |
| Heading levels | Distinct heading sizes ranked, capped at 6 | Code | Markdown-style depth |
| Running header/footer | First/last line of a page, digits normalised, ≤ 90 chars, on ≥ max(3, 60% of pages); only for ≥ 4 pages | Code (purpose), Inferred (numbers) | Drops "Page 3 of 20" and report titles repeated on every page, which would otherwise pollute passages and headings. 60% tolerates title pages and appendices without it |
| Two-column detection | ≥ 8 lines, no line crossing the middle ± 4% of width, ≥ 25% of lines (min 3) on each side | Inferred | Avoids splitting single-column pages. **Measured weakness:** one full-width caption or licence footer disables it for the page |
| Code block | Consecutive monospaced, non-heading lines ≤ 1.05 × body size, grouped into one element | [D-043](../decisions.md#d-043) | Emitting one element per line turned an 86-page report into 2,112 passages of about 7 tokens; grouping gave 210 |
| Hyphenation | A line ending in `-` is joined to the next without a space | Code | Rejoins words broken across lines |

## 3. Word parsing

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| Walk XML body children | `w:p` and `w:tbl` in order | Code | `document.paragraphs` silently drops every table |
| Heading levels | `Heading N` → N + 1; Title 1; Subtitle 2 | Code | Title is the document root, so Heading 1 sits under it |
| Tables | GitHub Markdown, pipes escaped | Code | Same representation as PDF tables, so the chunker treats both alike and the model reads a real table |
| Empty header row | Replaced with `col1…colN` | Code | Markdown tables need a header row |

## 4. Canonical text and chunking

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| Chunk = exact span of stored text | `content == content_text[start:end]` | [D-023](../decisions.md#d-023) | Non-negotiable 3: a citation must highlight exactly the text the model read |
| Element separator | `"\n\n"`, frozen | Code | Offsets include it; changing it breaks every stored offset |
| Offsets in code points | Yes | [D-023](../decisions.md#d-023) | Same unit as Python and Postgres; frontend must match |
| Structure-aware chunking | Never cross a heading; tables and code whole | Code | A passage mixing two sections embeds as neither; a split table loses its meaning |
| Token estimate | chars ÷ 4 prose, chars ÷ 3 tables/code | Code (purpose), Inferred (ratios) | "Tables and prose have very different tokens per character." 4 chars/token is the usual English average; symbols and short cells tokenise denser. No tokenizer call keeps chunking free and offline |
| `CHUNK_TARGET_TOKENS` | 480 | Inferred | Large enough to hold a full fact with its surrounding sentences (answerable on its own), small enough that one embedding still represents one topic. Common RAG range is 300–600 |
| `CHUNK_MAX_TOKENS` | 800 | Inferred | A section up to this size stays whole rather than being cut mid-thought; well under the embedding model's 2,048-token input and Voyage's per-document limit |
| `CHUNK_OVERLAP_TOKENS` | 64, whole sentences, within a section | Code (purpose), Inferred (number) | "A fact spanning the boundary is retrievable from either side." About one or two sentences; more would duplicate content in top-k |
| `CHUNK_MIN_TOKENS` | 80 | Inferred | A passage under ~320 characters rarely carries enough context to match or answer; merging it into a neighbour helps both |
| `HARD_FLOOR_TOKENS` | 14 (~56 chars), dropped if it cannot merge | Code | "Below this a text chunk with nowhere to merge is page furniture, not content." **Measured weakness:** a real one-line section ("Port 5432.") is also dropped |
| Table split | By rows, header repeated in `context` of later pieces | Code | Every piece still reads as a table with column names |
| Code split | Blank lines, then newlines for blocks without blank lines | [D-043](../decisions.md#d-043) | The only safe boundaries without a language parser; PDF-extracted code has no blank lines |
| `context` column | `file > heading path` (+ table header) | [D-023](../decisions.md#d-023) | Adds retrieval signal (file and section names) without changing the cited text |
| Keyword weights | content A, context B | Migration | A term in the passage matters more than the same term only in its heading |

## 5. Embeddings and vector index

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| Model | `gemini-embedding-001` | [D-026](../decisions.md#d-026) | Owner's provider choice is Gemini; this is its current embedding model |
| Dimensions | 1,536 | [D-026](../decisions.md#d-026) (value), Inferred (reason) | The model outputs 3,072 by default and supports reduced sizes. pgvector's HNSW index on the `vector` type supports at most 2,000 dimensions, so 3,072 could not be indexed; 1,536 is a recommended reduced size that halves storage |
| Normalise to unit length | Yes | Code | Reduced-dimension Gemini vectors are not normalised by the API; cosine ranking then matches dot product, and MMR's similarities are correct |
| Task types | `RETRIEVAL_DOCUMENT` for passages, `RETRIEVAL_QUERY` for questions | [D-026](../decisions.md#d-026) | Asymmetric embeddings put short questions near the passages that answer them |
| Embedded text | `context + content` | Code | Questions often name the document or section |
| No embedding fallback model | — | [D-032](../decisions.md#d-032), [D-033](../decisions.md#d-033) | Vectors from another model are not comparable with stored ones |
| `EMBED_REQUESTS_PER_MINUTE` | 100 | [D-033](../decisions.md#d-033) | Free tier counts each text as a request, 100 a minute |
| Reserve for questions | 10 of 100 while a document embeds | [D-033](../decisions.md#d-033) | A question asked during a large ingestion is not held up |
| Retries | 5 attempts; per-minute quota waits as asked; daily quota fails at once | [D-033](../decisions.md#d-033) | Background waiting costs nobody anything; failing loses the upload |
| Index | HNSW, cosine ops, default build settings (m 16, ef_construction 64) | [D-005](../decisions.md#d-005), migration | HNSW gives good recall without training (unlike IVFFlat, which needs data present at build time) |
| `hnsw.ef_search` | 100 (default is 40) | [D-025](../decisions.md#d-025) (scan), Inferred (100) | Wider search per query for better recall at small cost; needed with filtering |
| `hnsw.iterative_scan` | `relaxed_order` | [D-025](../decisions.md#d-025) | Without it, the workspace filter can discard most of the nearest neighbours and return too few rows |

## 6. Retrieval

### Profiles ([`profiles.py`](../../backend/app/rag/profiles.py))

| Parameter | lookup | explore | summarize | Source | Why |
| --- | --- | --- | --- | --- | --- |
| `candidates` (per leg, and after fusion) | 20 | 40 | 45 | Code (purpose), Inferred (numbers), [D-037](../decisions.md#d-037) (constraint) | Lookup: "precision first". Explore/summarize: "a wider net". 20 also fits the free Voyage limit of 10K tokens/min; 40 and 45 do not, so those profiles often lose reranking on the free key |
| `mmr_pool` (kept by reranker) | 10 | 18 | 24 | Inferred | About twice `keep`, so MMR has real alternatives to trade relevance for diversity |
| `keep` (final top-k to the model) | **5** | **8** | **12** | Code (purpose), Inferred (numbers) | One fact needs one or two passages plus margin; comparisons need several documents; summaries need coverage. More passages cost answer latency and dilute attention |
| `lambda_mult` | 0.82 | 0.55 | 0.45 | Code (meaning), Inferred (numbers) | 1.0 = pure relevance. Lookup barely diversifies; explore balances; summarize favours coverage |
| `dense_weight` / `sparse_weight` | 1.0 / 1.2 | 1.0 / 1.0 | 1.0 / 0.7 | Code (lookup), Inferred (summarize) | Lookup: "such questions carry names, codes and figures", which keyword search matches exactly. Summarize questions are about themes, where exact terms matter less |
| `per_doc_cap` | none | 3 | 3 | Inferred | Stops one long document filling every slot when the question spans documents |
| `grade` | yes | yes | **no** | Code | Summaries have "no single right answer to grade against" |
| `rewrite` | yes | yes | yes | Code | Every profile may retry once |

### Search mechanics

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| Hybrid (dense + keyword) | Both, in parallel | [D-005](../decisions.md#d-005), Code | Embeddings miss exact identifiers ("FR3.5", port numbers, product codes); keywords miss paraphrases |
| Keyword store | Postgres full-text search | [D-005](../decisions.md#d-005) | No second search system to run in Week 1 |
| Keyword query | Any term may match (`&` → `\|`) | Code | An AND query returns nothing for most natural-language questions; ranking rewards passages with more terms |
| Keyword ranking | `ts_rank_cd` with normalisation 32 | Code | Cover density rewards query terms close together; flag 32 scales to 0–1 |
| Fusion | Reciprocal rank fusion | Code | Cosine is in [0, 1] and `ts_rank_cd` is unbounded, so scores cannot be added; ranks can. A passage first in either leg is guaranteed to survive |
| `RRF_K` | 60 | Code | From the original RRF paper; damps the gap between rank 1 and rank 2 so agreement between legs matters more than one leg's top spot |
| Reranker | Voyage `rerank-2.5` | [D-026](../decisions.md#d-026) | A cross-encoder reads question and passage together: "the largest precision lever", and a [0, 1] score to base confidence on |
| Reranker input | `context + content`, truncation on | Code | Same text the passage was embedded with |
| Reranker failure | Fusion order, no scores, search continues | [D-026](../decisions.md#d-026) | A reranker outage must not take search down |
| MMR similarity | Stored vectors vs query vector | Code | "Trading a little relevance for coverage so the model does not read the same paragraph five times" |
| Workspace scoping | Explicit filter **and** RLS as caller | [D-025](../decisions.md#d-025) | A coding mistake in the API still cannot cross workspaces |

### Confidence gate and retry

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| No rewrite on attempt 1 | User's own words | [D-030](../decisions.md#d-030) | Embeddings handle natural questions well; a rewrite mainly helps a failed attempt, and costs a model call |
| `RERANK_CONFIDENT_SCORE` | 0.50 | [D-030](../decisions.md#d-030) (policy), Inferred (number) | "The reranker is sure enough that an LLM grade adds latency and nothing else." Not calibrated against the golden set |
| `RERANK_WEAK_SCORE` | 0.22 | [D-030](../decisions.md#d-030) (policy), Inferred (number) | "Below this the result is plainly weak." Not calibrated |
| Grade only the middle band | Fast model, JSON verdict | [D-030](../decisions.md#d-030) | Zero model calls on the common path protects the 8 s p50 target |
| `RETRIEVAL_MAX_ATTEMPTS` | 2 | [D-030](../decisions.md#d-030) | One recovery attempt; a third rarely helps and doubles worst-case latency |
| Best attempt | max(grade good, top score, count) | Code | A rewrite can be worse than the original; keep whichever retrieved better |
| Grader tokens / temperature | 40 / 0.0 | Inferred | One-word JSON verdict; deterministic |
| Rewrite tokens / temperature | 60 / 0.3 | Inferred | One short query; slight variation so it differs from the failed one |

## 7. Answering

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| Answer model | `gemini-3.5-flash`, thinking minimal | [D-026](../decisions.md#d-026) | Measured latency on a JSON answer: flash ~1.2 s, flash-lite ~1.0 s, 3.6-flash 2.8–11.6 s; 2.5 models unavailable to new keys |
| Fast model | `gemini-3.5-flash-lite` | [D-026](../decisions.md#d-026) | Grading, rewriting, groundedness and agent routing are simpler jobs, and it saves the answer model's scarcer free quota |
| Thinking level | minimal | [D-026](../decisions.md#d-026) | Hidden reasoning adds latency and counts against output tokens for short structured calls |
| Answer tokens / temperature | 1,500 / 0.2 | Inferred | Room for a multi-sentence cited answer in JSON; low temperature for faithful wording |
| Output shape | JSON sentences with source ids | Code | Code writes the `[n]` markers, so "a cited sentence cannot lose its citation to a formatting slip" |
| System prompt is a constant | No document or user text in it | Code, non-negotiable 2 | Structural isolation from prompt injection |
| Passages wrapped and HTML-escaped | `<untrusted_document>` | Code | A passage cannot close its wrapper and pose as instructions |
| Flagged passages kept, with a warning | Not dropped | Code | "A document about prompt injection is not an attack, and hiding uploaded content is its own failure" |
| Groundedness check | Always runs, fast model, cited passages only, 300 tokens, temperature 0 | [D-030](../decisions.md#d-030) | PRD MUST scope; checks the answer against exactly what it cites |
| Unreadable groundedness verdict | Counts as not grounded | Code | Fail closed |
| Confidence formula | mean(rerank of cited) × (1.0 good / 0.6 weak) | [D-027](../decisions.md#d-027) | PRD: combine reranker score and grading verdict, stated and uncalibrated. The 0.6 factor is not derived from data |
| Confidence label | always "uncalibrated" | [D-027](../decisions.md#d-027) | It is not a probability of correctness |
| `REVIEW_CONFIDENCE_THRESHOLD` | 0.35 | [D-027](../decisions.md#d-027) | Set as a starting point, "to be revisited once Gate G1 results exist" |
| Excerpt returned | 800 chars | Inferred | Enough to recognise the passage in the UI; full text is in the document viewer |

## 8. Model gateway

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| `LLM_TIMEOUT_SECONDS` | 15 | [D-031](../decisions.md#d-031), [D-032](../decisions.md#d-032) | The answer model once returned 504 on every call after long waits; 60 s × 3 attempts held a question for minutes |
| One try per model, then next in chain | — | [D-032](../decisions.md#d-032) | Free-tier limits are per model, so a chain multiplies daily quota |
| Chain order | requested → fallbacks → other role's model | [D-032](../decisions.md#d-032) | Grading does not spend the answer model's quota; answers prefer a full model to lite |
| `MODEL_COOLDOWN_SECONDS` | 120 (or the wait a quota error names, max 1 h) | [D-032](../decisions.md#d-032) | Turns a 15–20 s wait on every call into a one-off cost |
| `RESPONSE_CACHE_ENTRIES` | 512 (embeddings 2,048) | PRD, Inferred (size) | PRD asks for a response cache; identical demo questions cost nothing. Size is a memory-safe default |
| Cache only primary-model responses | — | [D-031](../decisions.md#d-031) | The next identical question tries the better model again |

## 9. Agent

| Parameter | Value | Source | Why |
| --- | --- | --- | --- |
| Framework | LangChain tools, own loop, no LangGraph | [D-028](../decisions.md#d-028), [D-039](../decisions.md#d-039) | Owner decision; the job is a single tool loop, and approval is a database row, not a paused graph |
| Model | fast model, temperature 0.1, 1,500 tokens | [D-039](../decisions.md#d-039) | "Tool routing is simple, and the answer model's daily quota is the scarcer one" |
| Called through the gateway | Not a LangChain chat model | [D-039](../decisions.md#d-039) | Keeps the model chain, cooldowns and deadlines |
| `MAX_STEPS` | 6 tool calls, then reply only | [D-039](../decisions.md#d-039) | Enough for list members → propose, or two document answers plus task reads; bounds cost and loops |
| `MAX_HISTORY_TURNS` | 8 (request accepts 20) | Inferred | Recent context for follow-ups while bounding prompt size per step |
| `MAX_TOOL_RESULT_CHARS` | 8,000 | Inferred | A 50-task list fits; stops one tool result dominating the prompt |
| `MAX_DOCUMENT_ANSWERS_PER_TURN` | 2 | [D-042](../decisions.md#d-042) | Each spends an answer-model call and a groundedness check on the free tier |
| `MAX_PROPOSALS_PER_TURN` | 5 | [D-039](../decisions.md#d-039) | Bounds a runaway loop filling the approval queue |
| `MIN_QUOTE_WORDS` | 3 | [D-039](../decisions.md#d-039) | A one- or two-word quote ("a task") could match almost any message |
| Taint disables proposals | For the rest of the turn | [D-039](../decisions.md#d-039) | A poisoned passage and a genuine request can arrive in the same turn |
| One tool per profile | `lookup_fact`, `explore_documents`, `summarize_documents` | [D-042](../decisions.md#d-042) | The person should not need to know retrieval tuning; the choice is explicit, visible and testable |
| Message length | 2,000 chars; history turn 8,000 | [D-041](../decisions.md#d-041), Inferred | Bound input cost |

## 10. Rate limits ([D-041](../decisions.md#d-041))

| Bucket | Per minute | Per hour | Why |
| --- | --- | --- | --- |
| `ask` | 6 | 60 | Each question spends shared model quota; limits are per user because the quota is shared across workspaces |
| `chat` | 10 | 120 | Many chat messages need no model-heavy tool |
| `upload` (and reprocess) | 10 | 60 | Bounds embedding quota use |

All windows are held in the single API process, so they reset on restart and are not shared between processes.
