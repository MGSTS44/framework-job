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
                    timeout=60.0,
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

            # 🔧 更保守的token估算（避免超出限制）
            # 使用2.0系数而不是1.3，因为实际token数往往更多
            input_tokens_estimate = len(prompt.split()) * 2.0

            # 计算可用空间（留300 tokens安全缓冲）
            available_space = 4096 - int(input_tokens_estimate) - 300

            # 设置max_tokens：最少200，最多1200，不超过可用空间
            max_tokens = max(200, min(1200, available_space))

            # 如果可用空间太小，使用最小值
            if available_space < 200:
                max_tokens = 200
                print("⚠️  Warning: Input is very large, output will be limited")

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
def chunk_text(text: str, chars: int = 16000) -> List[str]:
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
        text: Input text
        llm: LLM client (auto-selects local/cloud based on environment)

    Returns:
        Extracted structured data
    """
    llm = llm or LLMClient()  # Auto-select LLM type
    parts = []
    for ck in chunk_text(text, chars=16000):
        prompt = USER_PROMPT_TEMPLATE.format(text=ck[:120000])
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
    Extract seed data (main entry point)

    Args:
        input_data: Text or file path
        model: Model name (optional, defaults to environment variable)
        host: LLM server address (optional, defaults to environment variable)
        llm_type: LLM type "local"/"cloud" (optional, defaults to environment variable)

    Returns:
        Extracted structured data
    """
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

    # Create LLM client (auto-selects type)
    llm = LLMClient(llm_type=llm_type, model=model, host=host)
    seed = extract_seed_from_text(text, llm=llm)

    mode = os.getenv("SEED_ID_MODE", "random").lower()
    if not seed.get("doc_id"):
        seed["doc_id"] = (
            f"doc-{doc_hash[:16]}" if mode == "hash" else f"doc-{uuid.uuid4().hex[:16]}"
        )
    seed["_generated_at"] = now_iso()
    return seed


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(
        description="LLM seed extractor (supports local Ollama and cloud LLM)"
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
