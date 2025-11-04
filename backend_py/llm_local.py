from __future__ import annotations
import os, io, re, json, time, mimetypes, pathlib, hashlib, uuid, sys
from dotenv import load_dotenv

load_dotenv()
from typing import Dict, Any, List, Optional, Union, Tuple
from collections import Counter


def now_iso() -> str:
    s = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return s


def sha256_hex(b: bytes) -> str:
    h = hashlib.sha256()
    h.update(b)
    hexf = h.hexdigest()
    return hexf


def guess_mime(path: Union[str, pathlib.Path]) -> str:
    mt, _ = mimetypes.guess_type(str(path))
    mt = mt or "application/octet-stream"
    return mt


def read_bytes(path: Union[str, pathlib.Path]) -> bytes:
    with open(path, "rb") as f:
        data = f.read()
    return data


def extract_text_from_bytes(
    data: bytes, mime: Optional[str], filename: Optional[str]
) -> str:
    name = (filename or "").lower()
    mime = (mime or "").lower()

    if name.endswith((".txt", ".md", ".csv", ".log")) or mime.startswith("text/"):
        try:
            import chardet

            enc = chardet.detect(data).get("encoding") or "utf-8"
        except Exception:
            enc = "utf-8"
        out = data.decode(enc, errors="replace")
        return out

    if name.endswith(".pdf") or mime == "application/pdf":
        try:
            from pypdf import PdfReader

            pages = [p.extract_text() or "" for p in PdfReader(io.BytesIO(data)).pages]
            out = "\n\n".join(pages).strip()
            return out
        except Exception as e:
            msg = f"[PDF parse error: {e}]"
            return msg

    if name.endswith(".docx") or "wordprocessingml.document" in mime:
        try:
            import docx

            doc = docx.Document(io.BytesIO(data))
            out = "\n".join(p.text for p in doc.paragraphs)
            return out
        except Exception as e:
            msg = f"[DOCX parse error: {e}]"
            return msg

    if name.endswith((".html", ".htm")) or mime == "text/html":
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(data, "lxml")
            out = soup.get_text("\n")
            return out
        except Exception:
            out = re.sub(r"<[^>]+>", "", data.decode("utf-8", errors="replace"))
            return out

    msg = f"[Unsupported binary file: {len(data)} bytes]"
    return msg


# schema
A_FIXED = {
    "doc_id": None,
    "title": None,
    "subject": None,
    "author": None,
    "created_at": None,
    "jurisdiction": [],
    "industry": [],
    "confidentiality": None,
    "version": None,
    "language": None,
    "keywords": [],
    "entities": [],
}
B_MINIMUM = {
    "facets": {},
    "sections": [],
    "triples": [],
    "key_values": [],
    "tags": [],
    "questions": [],
    "risks": [],
    "actions_todo": [],
    "metrics": [],
    "tables": [],
    "figures": [],
    "extra": {},
}


def ensure_open_schema(parsed: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k, v in A_FIXED.items():
        out[k] = parsed.get(k, v)
    for k, v in B_MINIMUM.items():
        out[k] = parsed.get(k, v)
    for k, v in parsed.items():
        if k not in out:
            out[k] = v
    return out


def dedup_list(values: List[Any]) -> List[Any]:
    seen, out = set(), []
    for v in values:
        key = json.dumps(v, ensure_ascii=False, sort_keys=True)
        if key not in seen:
            seen.add(key)
            out.append(v)
    return out


def _as_list(x):
    if x is None:
        return []
    if isinstance(x, list):
        return x
    return [x]


def _norm_facet_item(it):
    if isinstance(it, dict):
        val = str(it.get("value", it.get("text", it.get("name", "")))).strip()
        ev = str(it.get("evidence", "")).strip()[:200]
        loc = str(it.get("location", "")).strip()
        try:
            conf = float(it.get("confidence", it.get("score", 0.5)))
        except Exception:
            conf = 0.5
        return {
            "value": val,
            "evidence": ev,
            "location": loc,
            "confidence": max(0.0, min(1.0, conf)),
        }
    return {"value": str(it), "evidence": "", "location": "", "confidence": 0.5}


def _norm_facets(facets_obj):
    out = {}
    if isinstance(facets_obj, list) or isinstance(facets_obj, str):
        items = [_norm_facet_item(x) for x in _as_list(facets_obj)]
        out["misc"] = {"summary": "", "items": items}
        return out
    if not isinstance(facets_obj, dict):
        return {}
    for name, obj in facets_obj.items():
        if isinstance(obj, dict):
            summary = str(obj.get("summary", ""))
            items = [_norm_facet_item(x) for x in _as_list(obj.get("items", []))]
        elif isinstance(obj, list):
            summary = ""
            items = [_norm_facet_item(x) for x in obj]
        else:
            summary = ""
            items = [_norm_facet_item(obj)]
        out[name] = {"summary": summary, "items": items}
    return out


def _dedup_items(items):
    seen, out = set(), []
    for it in items:
        key = json.dumps(
            {
                "v": it.get("value", ""),
                "e": it.get("evidence", ""),
                "l": it.get("location", ""),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        if key not in seen:
            seen.add(key)
            out.append(it)
    return out


def merge_maps(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    results = [ensure_open_schema(r) for r in results]
    merged: Dict[str, Any] = {}

    for k, v in A_FIXED.items():
        if isinstance(v, list):
            merged[k] = dedup_list(sum((r.get(k, []) for r in results), []))[:50]
        else:
            merged[k] = next(
                (r.get(k) for r in results if r.get(k) not in (None, "", "unknown")),
                None,
            )

    facets_merged: Dict[str, Dict[str, Any]] = {}
    for r in results:
        rf_raw = r.get("facets", {}) or {}
        rf = _norm_facets(rf_raw)
        for name, obj in rf.items():
            tgt = facets_merged.setdefault(name, {"summary": "", "items": []})
            cand_summary = obj.get("summary", "") or ""
            if len(cand_summary) > len(tgt["summary"]):
                tgt["summary"] = cand_summary[:2000]
            tgt["items"].extend(obj.get("items", []))
    for name in list(facets_merged.keys()):
        facets_merged[name]["items"] = _dedup_items(facets_merged[name]["items"])[:200]
    merged["facets"] = facets_merged

    def _norm_list_slot(all_res, key, cap):
        acc = []
        for r in all_res:
            val = r.get(key, [])
            if val is None:
                continue
            if isinstance(val, list):
                acc.extend(val)
            else:
                acc.append(val)
        return dedup_list(acc)[:cap]

    merged["sections"] = _norm_list_slot(results, "sections", 200)
    merged["triples"] = _norm_list_slot(results, "triples", 500)
    merged["key_values"] = _norm_list_slot(results, "key_values", 500)
    merged["tags"] = _norm_list_slot(results, "tags", 300)
    merged["questions"] = _norm_list_slot(results, "questions", 300)
    merged["risks"] = _norm_list_slot(results, "risks", 300)
    merged["actions_todo"] = _norm_list_slot(results, "actions_todo", 300)
    merged["metrics"] = _norm_list_slot(results, "metrics", 300)
    merged["tables"] = _norm_list_slot(results, "tables", 300)
    merged["figures"] = _norm_list_slot(results, "figures", 300)

    extra: Dict[str, Any] = {}
    for r in results:
        ex = r.get("extra", {}) or {}
        if isinstance(ex, dict):
            extra.update(ex)
    merged["extra"] = extra

    out = ensure_open_schema(merged)
    return out


# ============= Smart Preprocessing Functions =============


def extract_title_from_text(text: str) -> str:
    """提取文档标题（第一行或最突出的行）"""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return "Untitled Document"

    # 尝试找到标题格式的行
    for line in lines[:5]:  # 只看前5行
        # 标题通常：较短、不以小写字母开头、可能有特殊格式
        if len(line) < 200 and (line[0].isupper() or line[0] == "#"):
            # 清理markdown标记
            title = re.sub(r"^#+\s*", "", line)
            return title.strip()

    # 默认用第一行
    return lines[0][:150]


def extract_simple_keywords(text: str, top_n: int = 10) -> List[str]:
    """简单的关键词提取（不用LLM）"""
    # 转小写，分词
    words = re.findall(r"\b[a-z]{4,}\b", text.lower())

    # 停用词（常见无意义词）
    stop_words = {
        "this",
        "that",
        "with",
        "from",
        "have",
        "been",
        "were",
        "will",
        "would",
        "could",
        "should",
        "about",
        "their",
        "there",
        "where",
        "which",
        "these",
        "those",
        "what",
        "when",
        "then",
        "them",
        "they",
        "than",
        "such",
        "into",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
    }

    # 过滤停用词
    words = [w for w in words if w not in stop_words]

    # 词频统计
    word_freq = Counter(words)

    # 返回top N
    return [word for word, count in word_freq.most_common(top_n)]


def extract_sections_structure(text: str) -> List[Dict[str, str]]:
    """提取文档结构（章节标题）"""
    sections = []

    lines = text.split("\n")
    current_section = None

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        # 识别章节标题的模式
        is_section = False
        level = 1

        # Markdown标题格式
        if line.startswith("#"):
            is_section = True
            level = len(re.match(r"^#+", line).group())
            line = re.sub(r"^#+\s*", "", line)

        # 数字编号格式 (1. 2. 3.)
        elif re.match(r"^\d+[\.\)]\s+[A-Z]", line):
            is_section = True
            level = 2

        # 全大写短行（可能是标题）
        elif len(line) < 100 and line.isupper() and len(line.split()) > 1:
            is_section = True
            level = 2

        # 短行且首字母大写（可能是标题）
        elif (
            len(line) < 80 and line[0].isupper() and not line.endswith((".", ",", ";"))
        ):
            is_section = True
            level = 3

        if is_section:
            # 收集前一个section的内容
            if current_section:
                sections.append(current_section)

            current_section = {
                "title": line[:100],
                "level": level,
                "preview": "",  # 将在下面填充
            }
        elif current_section and len(current_section["preview"]) < 150:
            # 添加内容预览
            current_section["preview"] += " " + line

    # 添加最后一个section
    if current_section:
        sections.append(current_section)

    # 限制返回数量
    return sections[:10]


def extract_simple_entities(text: str) -> List[str]:
    """简单的实体提取（不用spaCy，避免额外依赖）"""
    entities = set()

    # 大写开头的短语（可能是实体）
    capitalized_phrases = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text)

    # 过滤常见词
    common_words = {
        "The",
        "This",
        "That",
        "These",
        "Those",
        "There",
        "Here",
        "When",
        "Where",
        "What",
        "Which",
        "Who",
        "How",
        "Why",
    }

    for phrase in capitalized_phrases:
        if phrase not in common_words and len(phrase) > 2:
            entities.add(phrase)

    # 限制数量
    return list(entities)[:15]


def preprocess_document_smart(
    text: str, max_summary_chars: int = 800
) -> Dict[str, Any]:
    """
    智能预处理文档 - 在本地提取关键信息，不用LLM

    Args:
        text: 原始文档文本
        max_summary_chars: 摘要最大字符数

    Returns:
        预处理后的结构化信息
    """
    print(f"🔍 Smart preprocessing: {len(text)} chars → extracting key info...")

    # 1. 提取标题
    title = extract_title_from_text(text)
    print(f"   📌 Title: {title[:50]}...")

    # 2. 提取关键词
    keywords = extract_simple_keywords(text, top_n=10)
    print(f"   🔑 Keywords: {', '.join(keywords[:5])}...")

    # 3. 提取文档结构
    sections = extract_sections_structure(text)
    print(f"   📑 Sections: {len(sections)} found")

    # 4. 提取实体
    entities = extract_simple_entities(text)
    print(f"   🏷️  Entities: {len(entities)} found")

    # 5. 生成精简摘要
    # 摘要包含：标题 + 前几个段落 + 关键章节
    summary_parts = [f"Title: {title}\n"]

    # 添加文档开头（前500字符）
    text_start = text[:500].strip()
    summary_parts.append(f"Content: {text_start}...\n")

    # 添加章节结构
    if sections:
        summary_parts.append("\nSections:")
        for sec in sections[:5]:
            summary_parts.append(f"- {sec['title']}")

    summary = "\n".join(summary_parts)[:max_summary_chars]

    print(
        f"   ✅ Generated summary: {len(summary)} chars (~{int(len(summary) * 0.7)} tokens)"
    )

    return {
        "title": title,
        "keywords": keywords,
        "entities": entities,
        "sections": sections,
        "summary": summary,
        "original_length": len(text),
        "summary_length": len(summary),
        "compression_ratio": round(len(summary) / len(text), 2),
    }


# ============= Unified LLM Client =============


class LLMClient:
    """
    Unified LLM client supporting:
    1. Local Ollama (legacy)
    2. Cloud LLM (GCP Llama via OpenAI-compatible API)

    Environment variables:
    - LLM_TYPE: "local" or "cloud"
    - LOCAL_LLM_URL: Cloud LLM URL
    - LOCAL_LLM_MODEL: Cloud LLM model name
    - LOCAL_LLM_API_KEY: Cloud LLM API key
    """

    def __init__(
        self,
        llm_type: Optional[str] = None,
        model: Optional[str] = None,
        host: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        # Get configuration from environment variables or parameters
        self.llm_type = llm_type or os.getenv("LLM_TYPE", "local")

        if self.llm_type == "cloud":
            # Cloud LLM configuration
            self.host = host or os.getenv(
                "LOCAL_LLM_URL", "http://34.87.13.228:8000/v1"
            )
            self.model = model or os.getenv(
                "LOCAL_LLM_MODEL", "meta-llama/Llama-3.1-8B-Instruct"
            )
            self.api_key = api_key or os.getenv(
                "LOCAL_LLM_API_KEY", "sk-F1YL14npR514cgzYEVFv19LcWf1dGQ98Wyv10"
            )

            # Use OpenAI SDK
            try:
                from openai import OpenAI

                self.client = OpenAI(
                    base_url=self.host,
                    api_key=self.api_key,
                    timeout=300.0,  # 增加到 5 分钟
                    max_retries=3,
                )
                print(f"✅ Using Cloud LLM: {self.host}")
            except ImportError:
                raise ImportError("Please install OpenAI SDK: pip install openai")

        else:
            # Local Ollama configuration (backward compatibility)
            self.model = model or "llama3.1:8b"
            self.host = host or "http://127.0.0.1:11434"

            # Validate localhost only
            assert self.host.startswith("http://127.0.0.1") or self.host.startswith(
                "http://localhost"
            ), "Local Ollama must use localhost"

            self.client = None
            print(f"✅ Using Local Ollama: {self.host}")

    def generate(self, prompt: str, system: str = "") -> str:
        """
        Generate response (unified interface)

        Args:
            prompt: User prompt
            system: System prompt

        Returns:
            LLM response text
        """
        if self.llm_type == "cloud":
            return self._generate_cloud(prompt, system)
        else:
            return self._generate_local(prompt, system)

    def _generate_cloud(self, prompt: str, system: str = "") -> str:
        """Generate using Cloud LLM (OpenAI format)"""
        try:
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})

            # 🔧 Token估算（保守）
            input_tokens_estimate = len(prompt.split()) * 2.0

            # 计算可用空间（留200 tokens安全缓冲）
            available_space = 4096 - int(input_tokens_estimate) - 200

            # 设置max_tokens：最少300，最多1500
            max_tokens = max(300, min(1500, available_space))

            # 如果可用空间太小，使用最小值
            if available_space < 300:
                max_tokens = 300
                print("⚠️  Warning: Very limited output space")

            # 调试日志
            print(f"📊 Token估算:")
            print(f"   - 输入估算: ~{int(input_tokens_estimate)} tokens")
            print(f"   - 可用空间: ~{available_space} tokens")
            print(f"   - 使用max_tokens: {max_tokens}")
            print(f"   - 预计总计: ~{int(input_tokens_estimate) + max_tokens} / 4096")

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.7,
            )

            content = response.choices[0].message.content
            return content.strip()

        except Exception as e:
            print(f"❌ Cloud LLM error: {e}")
            raise RuntimeError(f"Cloud LLM call failed: {e}")

    def _generate_local(self, prompt: str, system: str = "") -> str:
        """Generate using Local Ollama (original logic)"""
        import requests

        url = f"{self.host}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.0, "top_p": 0.9},
        }

        with requests.Session() as s:
            s.trust_env = False
            r = s.post(url, json=payload, timeout=600)

        r.raise_for_status()
        resp = (r.json().get("response") or "").strip()
        return resp


# Backward compatibility - OllamaClient alias
class OllamaClient(LLMClient):
    """Backward compatible alias"""

    def __init__(
        self, model: str = "llama3.1:8b", host: str = "http://127.0.0.1:11434"
    ):
        super().__init__(llm_type="local", model=model, host=host)


# prompts
SYSTEM_PROMPT = (
    "Extract structured data from text. Return ONLY valid JSON. "
    "NO markdown, NO explanations. Start with { end with }. "
    "Use null for unknown, [] for empty lists. All text in English."
)

USER_PROMPT_TEMPLATE = """Return ONLY valid JSON. NO markdown.

Extract metadata from this text:
\"\"\"{text}\"\"\"

Required JSON structure:
{{
  "title": null, "subject": null, "keywords": [], "entities": [],
  "facets": {{}}, "industry": []
}}

Rules:
- facets: topic groups. Each item has "value", "evidence" (max 15 words), "confidence" (0-1)
- ALL text in English
- If unknown: null or []
- NO verbatim quotes

Return JSON only."""


# chunk / json
def chunk_text(text: str, chars: int = 2000) -> List[str]:
    """
    Split text into chunks (default 2000 chars to fit 4096 token limit)
    """
    out, i, n = [], 0, len(text)
    while i < n:
        j = min(n, i + chars)
        k = text.rfind("\n", i, j)
        if k == -1:
            k = text.rfind(".", i, j)
        if k == -1 or k <= i:
            k = j
        seg = text[i:k].strip()
        if seg:
            out.append(seg)
        i = k
    return out or [""]


def robust_loads(maybe_json: str) -> Dict[str, Any]:
    """
    Robust JSON parser with markdown cleanup and detailed debugging
    """
    # 调试：打印原始响应（前1000字符）
    print("=" * 80)
    print("🔍 DEBUG: Raw LLM Response")
    print("=" * 80)
    print(maybe_json[:1000])
    print("=" * 80)

    # 尝试直接解析
    try:
        obj = json.loads(maybe_json)
        if not isinstance(obj, dict):
            raise ValueError("Top-level JSON must be an object")
        print("✅ JSON parsed successfully (direct)")
        return obj
    except Exception as e:
        print(f"⚠️  Direct JSON parse failed: {e}")
        print("🔄 Trying cleanup...")

    s = maybe_json.strip()

    # 清理 markdown 代码块
    if "```" in s:
        print("🧹 Removing markdown code fences...")
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.I)
        s = re.sub(r"\s*```$", "", s)

    # 提取 JSON 对象 { ... }
    l = s.find("{")
    r = s.rfind("}")
    if l != -1 and r != -1 and r > l:
        s2 = s[l : r + 1]
        print(f"🧹 Extracted JSON from position {l} to {r}")
        print("🔍 Cleaned content:")
        print(s2[:500])
        print("=" * 80)
        try:
            obj = json.loads(s2)
            if not isinstance(obj, dict):
                raise ValueError("Top-level JSON must be an object")
            print("✅ JSON parsed successfully (after cleanup)")
            return obj
        except Exception as e:
            print(f"❌ Cleaned JSON parse failed: {e}")
            print(f"📝 Failed content (first 500 chars): {s2[:500]}")

    print("=" * 80)
    print("❌ All parsing attempts failed")
    print(f"📝 Original content (first 1000 chars):")
    print(maybe_json[:1000])
    print("=" * 80)
    raise ValueError("LLM did not return valid JSON")


# !!!core function!!!
def extract_seed_from_text(
    text: str, llm: Optional[LLMClient] = None
) -> Dict[str, Any]:
    """
    Extract seed data from text

    Args:
        text: Input text (should be pre-processed summary)
        llm: LLM client (auto-selects local/cloud based on environment)

    Returns:
        Extracted structured data
    """
    llm = llm or LLMClient()  # Auto-select LLM type
    parts = []

    # Process in chunks (each chunk ~2000 chars for 4K limit)
    for ck in chunk_text(text, chars=2000):
        limited_chunk = ck[:2000]
        prompt = USER_PROMPT_TEMPLATE.format(text=limited_chunk)
        raw = llm.generate(prompt, system=SYSTEM_PROMPT)
        parts.append(robust_loads(raw))

    out = merge_maps(parts)
    return out


def extract_seed(
    input_data: Union[str, pathlib.Path],
    model: Optional[str] = None,
    host: Optional[str] = None,
    llm_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extract seed data (main entry point) - WITH SMART PREPROCESSING

    This function now:
    1. Preprocesses document locally (extracts title, keywords, structure)
    2. Generates a summary (~800 chars)
    3. Sends only the summary to Cloud LLM for enhancement
    4. Merges local + LLM results

    Args:
        input_data: Text or file path
        model: Model name (optional, defaults to environment variable)
        host: LLM server address (optional, defaults to environment variable)
        llm_type: LLM type "local"/"cloud" (optional, defaults to environment variable)

    Returns:
        Extracted structured data
    """
    # Read file/text
    if (
        isinstance(input_data, (str, pathlib.Path))
        and pathlib.Path(str(input_data)).exists()
    ):
        path = pathlib.Path(str(input_data))
        data = read_bytes(path)
        text = extract_text_from_bytes(data, guess_mime(path), path.name)
        doc_hash = sha256_hex(data)
        del data
    else:
        text = str(input_data)
        doc_hash = sha256_hex(text.encode("utf-8"))

    print(f"\n{'='*60}")
    print(f"📄 Document Processing Pipeline (Smart Mode)")
    print(f"{'='*60}")

    # 🔧 Step 1: Local smart preprocessing (NO LLM)
    preprocessed = preprocess_document_smart(text, max_summary_chars=800)

    print(f"\n📊 Compression: {len(text)} → {preprocessed['summary_length']} chars")
    print(f"   Ratio: {preprocessed['compression_ratio']*100:.1f}%")
    print(
        f"   Saved: ~{int((len(text) - preprocessed['summary_length']) * 0.7)} tokens\n"
    )

    # 🔧 Step 2: Use LLM to enhance metadata (send only summary)
    print(f"☁️  Sending summary to Cloud LLM for enhancement...")
    llm = LLMClient(llm_type=llm_type, model=model, host=host)

    # Construct compact prompt
    enhanced_prompt = f"""
Based on this document summary, extract structured metadata:

{preprocessed['summary']}

Pre-extracted info:
- Title: {preprocessed['title']}
- Keywords: {', '.join(preprocessed['keywords'][:5])}
- Entities: {', '.join(preprocessed['entities'][:5])}

Enhance and validate this information, return complete metadata JSON.
"""

    # Call LLM (input is now very small)
    llm_metadata = extract_seed_from_text(enhanced_prompt, llm=llm)

    # 🔧 Step 3: Merge local extraction + LLM enhancement
    final_metadata = {
        **llm_metadata,
        "title": preprocessed["title"] or llm_metadata.get("title"),
        "keywords": list(
            set(preprocessed["keywords"] + (llm_metadata.get("keywords") or []))
        ),
        "entities": list(
            set(preprocessed["entities"] + (llm_metadata.get("entities") or []))
        ),
        "sections": preprocessed["sections"] or llm_metadata.get("sections", []),
        "_preprocessing": {
            "original_length": preprocessed["original_length"],
            "processed_length": preprocessed["summary_length"],
            "compression_ratio": preprocessed["compression_ratio"],
            "method": "smart_local_preprocessing",
        },
    }

    mode = os.getenv("SEED_ID_MODE", "random").lower()
    if not final_metadata.get("doc_id"):
        final_metadata["doc_id"] = (
            f"doc-{doc_hash[:16]}" if mode == "hash" else f"doc-{uuid.uuid4().hex[:16]}"
        )
    final_metadata["_generated_at"] = now_iso()

    print(f"✅ Metadata extraction complete!")
    print(f"{'='*60}\n")

    return final_metadata


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(
        description="LLM seed extractor with smart preprocessing"
    )
    ap.add_argument("input", help="Raw text OR a file path")
    ap.add_argument("--model", default=None, help="Model name")
    ap.add_argument("--host", default=None, help="LLM server host")
    ap.add_argument(
        "--llm-type",
        choices=["local", "cloud"],
        default=None,
        help="LLM type: local (Ollama) or cloud (GCP)",
    )
    args = ap.parse_args()

    if pathlib.Path(args.input).exists():
        inp = pathlib.Path(args.input)
    else:
        inp = args.input

    out = extract_seed(inp, model=args.model, host=args.host, llm_type=args.llm_type)
    print(json.dumps(out, ensure_ascii=False, indent=2))
