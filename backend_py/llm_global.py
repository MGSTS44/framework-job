import os, sys, json, argparse, re, time
from typing import Dict, Any, Optional


def log(msg: str, on: bool):
    if on:
        print(msg, flush=True)


# config
INLINE_API_KEY = None
INLINE_BASE_URL = None


# io
def load_metadata(path: str) -> Dict[str, Any]:
    if path == "-":
        data = sys.stdin.read()
    else:
        with open(path, "r", encoding="utf-8") as f:
            data = f.read()
    return json.loads(data)


def dump_json(obj: Dict[str, Any], out_path: str):
    if out_path == "-":
        print(json.dumps(obj, ensure_ascii=False, indent=2))
    else:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)


# json guard
def robust_json_loads(s: str) -> Dict[str, Any]:
    s = s.strip()
    try:
        obj = json.loads(s)
        if not isinstance(obj, dict):
            raise ValueError("top-level must be object")
        return obj
    except Exception:
        pass
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.I)
        s = re.sub(r"\s*```$", "", s)
    l = s.find("{")
    r = s.rfind("}")
    if l != -1 and r != -1 and r > l:
        s2 = s[l : r + 1]
        obj = json.loads(s2)
        if not isinstance(obj, dict):
            raise ValueError("top-level must be object")
        return obj
    raise ValueError("not valid json")


def generate_mock_pov(title_lower):
    """根据标题生成 mock POV 数组"""
    if "compliance" in title_lower or "audit" in title_lower:
        return [
            "Proactive risk identification and mitigation",
            "Continuous compliance monitoring",
            "Stakeholder transparency and accountability",
        ]
    elif "ai" in title_lower or "ml" in title_lower:
        return [
            "Risk-first approach to AI implementation",
            "Data-driven decision making with human oversight",
            "Ethical AI practices throughout the lifecycle",
        ]
    elif "wellbeing" in title_lower or "health" in title_lower:
        return [
            "Patient-centered care as the foundation",
            "Evidence-based protocols with clinical flexibility",
            "Holistic wellbeing assessment approach",
        ]
    else:
        return [
            "Structured approach to problem-solving",
            "Stakeholder-aligned decision making",
            "Continuous improvement and adaptation",
        ]


# mock builder
def build_mock_framework(md: Dict[str, Any]) -> Dict[str, Any]:
    title = (md.get("title") or md.get("subject") or "Untitled Framework").strip()
    author = md.get("author")
    if not author:
        ents = md.get("entities") or []
        author = ents[0] if ents else None

    clusters = {}

    fx = md.get("facets") or {}
    if isinstance(fx, dict):
        for name, obj in list(fx.items())[:4]:
            if isinstance(obj, dict):
                items = obj.get("items") or []
            elif isinstance(obj, list):
                items = obj
            else:
                items = [obj]
            bullets = []
            for itm in items[:6]:
                v = (itm or {}).get("value") if isinstance(itm, dict) else str(itm)
                v = (v or "").strip()
                if v:
                    bullets.append(v)
            if bullets:
                clusters[name] = bullets

    if not clusters:
        secs = md.get("sections") or []
        if isinstance(secs, list) and secs:
            bullets = []
            for s in secs[:6]:
                t = (s or {}).get("title") or ""
                c = (s or {}).get("content") or ""
                one = (t or c).strip()
                if not one and isinstance(c, str):
                    one = c.strip().split(".")[0]
                if one:
                    bullets.append(one[:120])
            if bullets:
                clusters["sections"] = bullets

    if not clusters:
        kws = md.get("keywords") or []
        if isinstance(kws, list) and kws:
            clusters["keywords"] = [str(k)[:60] for k in kws[:6] if str(k).strip()]

    if not clusters:
        ents = md.get("entities") or []
        if isinstance(ents, list) and ents:
            clusters["entities"] = [str(e)[:60] for e in ents[:6] if str(e).strip()]

    if not clusters:
        clusters = {
            "general": [
                f"{title} — key idea 1",
                f"{title} — key idea 2",
                "Align team and stakeholders",
                "Translate insights to actions",
            ]
        }

    wl = []
    for k in list(clusters.keys())[:4]:
        wl.append(
            {
                "name": k.replace("_", " ").title(),
                "guidance": [
                    "Ground in evidence",
                    "Keep copy plain",
                    "Place into journeys",
                    "Validate with users",
                ],
            }
        )

    tags = []
    for src in (md.get("keywords"), md.get("industry"), md.get("jurisdiction")):
        if isinstance(src, list):
            for x in src:
                sx = str(x).strip()
                if sx and sx not in tags:
                    tags.append(sx)
    tags = tags[:12]

    triples = md.get("triples") or []
    kvs = md.get("key_values") or []

    # 在 return 之前生成 artefacts
    title_lower = title.lower()
    if "compliance" in title_lower or "audit" in title_lower:
        primary_name = "Compliance Checklist"
        primary_purpose = (
            "Systematic verification of regulatory requirements and controls"
        )
        optional_arts = [
            "Audit Report",
            "Risk Register",
            "Policy Documentation",
            "Board Brief",
        ]
    elif (
        "ai" in title_lower or "ml" in title_lower or "machine learning" in title_lower
    ):
        primary_name = "AI Implementation Plan"
        primary_purpose = "Comprehensive guide for deploying and managing AI systems"
        optional_arts = [
            "Model Documentation",
            "Risk Assessment",
            "Ethics Guidelines",
            "Performance Dashboard",
        ]
    elif "wellbeing" in title_lower or "health" in title_lower:
        primary_name = "Health Assessment Report"
        primary_purpose = "Structured evaluation of health and wellbeing metrics"
        optional_arts = [
            "Wellbeing Dashboard",
            "Action Plan",
            "Progress Report",
            "Clinical Guidelines",
        ]
    elif "question" in title_lower or "survey" in title_lower:
        primary_name = "Question Set Document"
        primary_purpose = "Structured questionnaire with scoring methodology"
        optional_arts = [
            "Survey Results Dashboard",
            "Analysis Report",
            "Respondent Guide",
        ]
    elif "strategy" in title_lower or "business" in title_lower:
        primary_name = "Strategic Plan"
        primary_purpose = (
            "Comprehensive strategic planning document with actionable roadmap"
        )
        optional_arts = [
            "Business Case",
            "Roadmap",
            "Executive Summary",
            "Risk Analysis",
        ]
    else:
        primary_name = "Framework Document"
        primary_purpose = (
            "Comprehensive framework documentation and implementation guide"
        )
        optional_arts = [
            "Implementation Guide",
            "Best Practices",
            "Case Studies",
            "Reference Materials",
        ]

    # ✅ 现在可以在 return 中使用这些变量
    return {
        "id": f"framework-{(md.get('doc_id') or 'seed')}-v1.0",
        "title": title,
        "type": "evergreen",
        "attribution": author,
        "quadrant": None,
        "version": "1.0",
        "core_method": ["Reframe", "Draft", "Embed", "Validate"],
        "pov": generate_mock_pov(title_lower),
        "primary_artefact": {
            "name": primary_name,
            "purpose": primary_purpose,
            "when_to_use": [
                "Project kickoff",
                "Stakeholder alignment",
                "Implementation planning",
            ],
        },
        "concept_clusters": clusters,
        "trigger_context": [
            "When teams need repeatable guidance",
            "When multiple stakeholders align",
        ],
        "workflow_layers": wl,
        "inputs_required": ["Summary notes", "Current artefacts", "Known constraints"],
        "risks_watchouts": [
            "Over-generalization",
            "Jargon-heavy copy",
            "No traceability",
        ],
        "research_required": ["Usability testing", "Benchmark peers"],
        "outputs_deliverables": {
            "default": primary_name,  # ✅ 使用动态生成的名称
            "optional": optional_arts,  # ✅ 使用动态生成的列表
        },
        "escalation": ["Legal ambiguity", "Sensitive data", "Conflicting policies"],
        "tags": tags,
        "derived_from_metadata": {
            "used_facets": list(clusters.keys()),
            "used_triples": triples[:5],
            "used_key_values": kvs[:5],
        },
    }


# openai call (optional; only if key is set)
def resolve_api_settings(
    cli_key: Optional[str], cli_base: Optional[str]
) -> (Optional[str], Optional[str]):
    key = cli_key or INLINE_API_KEY or os.getenv("OPENAI_API_KEY") or None
    base = cli_base or INLINE_BASE_URL or os.getenv("OPENAI_BASE_URL") or None
    return key, base


def call_openai_framework(
    md: Dict[str, Any],
    model: str,
    timeout: int,
    api_key: str,
    base_url: Optional[str],
    verbose: bool,
) -> Dict[str, Any]:
    from openai import OpenAI
    import httpx
    import os

    original_proxies = {}
    proxy_keys = [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "http_proxy",
        "https_proxy",
        "ALL_PROXY",
        "all_proxy",
        "NO_PROXY",
        "no_proxy",
    ]

    for key in proxy_keys:
        if key in os.environ:
            original_proxies[key] = os.environ[key]
            del os.environ[key]

    try:
        # ✅ 简化初始化 - OpenAI 2.6.1 会自动处理
        if base_url:
            client = OpenAI(
                api_key=api_key, base_url=base_url, timeout=timeout, max_retries=2
            )
        else:
            client = OpenAI(api_key=api_key, timeout=timeout, max_retries=2)

        sys_prompt = (
            "You are a senior framework designer. Transform metadata into a comprehensive framework.\n\n"
            "CRITICAL REQUIREMENTS:\n"
            "1. workflow_layers MUST include 'focus' (1-2 sentence overview) AND 'guidance' (3-5 actionable steps)\n"
            "2. risks_watchouts MUST be objects with 'risk', 'impact', and 'mitigation' fields\n"
            "3. escalation MUST be objects with 'trigger' and 'action' fields\n"
            "4. primary_artefact MUST have meaningful 'name' and 'purpose' - NEVER leave as null\n"
            "5. outputs_deliverables MUST include 'default' and 3-5 'optional' artefacts specific to this framework\n"
            "6. family: Categorize into one of these: Technology, Healthcare, Financial, Legal, Education, Marketing, Operations, Human Resources, Sales, Design, Research, Strategy, Compliance, Project Management, or Other\n"
            "7. Be specific and actionable, not generic - use actual content from metadata\n"
            "8. Return ONLY valid JSON - no markdown, no code fences, no comments\n\n"
            "Use null or [] ONLY for truly unknown fields, NOT for artefacts."
        )

        schema = {
            "id": None,
            "title": None,
            "type": None,
            "attribution": None,
            "quadrant": None,
            "version": "1.0",
            "core_method": [],
            # POV change to the array
            "pov": [
                "<point of view 1 - one sentence describing approach>",
                "<point of view 2 - another perspective or principle>",
            ],
            # change primary_artefact
            "primary_artefact": {
                "name": "<specific artefact name, e.g., 'Compliance Checklist', 'Implementation Plan'>",
                "purpose": "<clear purpose in 1-2 sentences>",
                "when_to_use": ["<scenario 1>", "<scenario 2>", "<scenario 3>"],
            },
            "concept_clusters": {},
            "trigger_context": [],
            "workflow_layers": [
                {
                    "name": "<layer name>",
                    "focus": "<1-2 sentence description of what this layer achieves>",
                    "guidance": [
                        "<specific actionable step 1>",
                        "<specific actionable step 2>",
                        "<specific actionable step 3>",
                    ],
                }
            ],
            "inputs_required": [],
            "risks_watchouts": [
                {
                    "risk": "<risk title>",
                    "impact": "<why this matters>",
                    "mitigation": "<how to address>",
                }
            ],
            "research_required": [],
            # outputs_deliverables
            "outputs_deliverables": {
                "default": "<primary deliverable name>",
                "optional": [
                    {
                        "name": "<specific artefact name>",
                        "description": "<10-20 word description of purpose and use case>",
                    },
                    {
                        "name": "<another specific artefact>",
                        "description": "<10-20 word description of purpose and use case>",
                    },
                    {
                        "name": "<third artefact>",
                        "description": "<10-20 word description of purpose and use case>",
                    },
                ],
            },
            "escalation": [
                {
                    "trigger": "<specific condition that requires escalation>",
                    "action": "<who to escalate to and what action to take>",
                }
            ],
            "tags": [],
            "derived_from_metadata": {
                "used_facets": [],
                "used_triples": [],
                "used_key_values": [],
            },
        }

        user_prompt = (
            "Build the framework JSON from this metadata. Keep lists short (<=6). "
            "Schema:\n"
            + json.dumps(schema, indent=2)
            + "\n\nMetadata:\n"
            + json.dumps(md, indent=2)
            + "\n\n🎯 CRITICAL INSTRUCTIONS:\n\n"
            # POV
            "0. POINT OF VIEW (POV) - CRITICAL:\n"
            "   - Generate 2-4 concise points of view (POV) as an ARRAY of strings\n"
            "   - Each POV should be ONE sentence describing a key principle or approach\n"
            "   - POVs should reflect the framework's philosophy and guiding principles\n"
            "   - Base POVs on the document's core themes and methodologies\n\n"
            "   EXAMPLES:\n"
            "   * For AI/ML frameworks:\n"
            "     pov: [\n"
            '       "Risk-first approach to AI implementation",\n'
            '       "Data-driven decision making with human oversight",\n'
            '       "Ethical AI practices embedded throughout the lifecycle"\n'
            "     ]\n\n"
            "   * For healthcare frameworks:\n"
            "     pov: [\n"
            '       "Patient-centered care as the foundation",\n'
            '       "Evidence-based protocols with clinical flexibility",\n'
            '       "Holistic wellbeing assessment approach"\n'
            "     ]\n\n"
            "   * For compliance frameworks:\n"
            "     pov: [\n"
            '       "Proactive risk identification and mitigation",\n'
            '       "Continuous compliance monitoring",\n'
            '       "Stakeholder transparency and accountability"\n'
            "     ]\n\n"
            "1. WORKFLOW LAYERS:\n"
            "   - Each workflow_layer MUST have 'name', 'focus' (description), and 'guidance' (3-5 steps)\n"
            "   - Extract from metadata.sections if available\n"
            "   - Be SPECIFIC using actual content, not generic placeholders\n\n"
            "2. ARTEFACTS (MOST IMPORTANT - DO NOT SKIP):\n"
            "   - primary_artefact.name: Choose a SPECIFIC deliverable name based on the document type\n"
            "   - primary_artefact.purpose: Explain WHY this artefact matters in 1-2 sentences\n"
            "   - primary_artefact.when_to_use: List 2-3 specific scenarios\n"
            "   - outputs_deliverables.default: Same as primary_artefact.name\n\n"
            "   - outputs_deliverables.optional: Generate 3-5 RELATED artefacts as OBJECTS with name AND description:\n"
            '     CRITICAL: Each artefact MUST be an object: {"name": "...", "description": "..."}\n'
            "     * Analyze the ACTUAL document content to determine relevant deliverables\n"
            "     * Each description should be 10-20 words explaining the artefact's purpose\n"
            "     * Base artefacts on document topics, not generic categories\n\n"
            "     EXAMPLES by document type:\n"
            "     * For compliance/audit docs:\n"
            "       [\n"
            '         {"name": "Audit Report", "description": "Comprehensive findings, recommendations, and remediation plans from compliance review"},\n'
            '         {"name": "Risk Register", "description": "Identified risks with likelihood, impact assessment, and mitigation controls"},\n'
            '         {"name": "Board Brief", "description": "Executive summary of compliance status for board reporting and decisions"}\n'
            "       ]\n\n"
            "     * For AI/ML docs:\n"
            "       [\n"
            '         {"name": "Model Documentation", "description": "Technical specifications, architecture, training data, and performance metrics"},\n'
            '         {"name": "Risk Assessment", "description": "Analysis of bias, fairness, safety, and ethical concerns in AI system"},\n'
            '         {"name": "Ethics Guidelines", "description": "Responsible AI principles, governance framework, and ethical review process"}\n'
            "       ]\n\n"
            "     * For health/wellbeing docs:\n"
            "       [\n"
            '         {"name": "Wellbeing Dashboard", "description": "Visual metrics, trends, and health indicators for patient monitoring"},\n'
            '         {"name": "Action Plan", "description": "Personalized recommendations based on assessment results and goals"},\n'
            '         {"name": "Clinical Guidelines", "description": "Evidence-based protocols and best practices for clinical implementation"}\n'
            "       ]\n\n"
            "     DO NOT use simple strings like ['Artefact 1', 'Artefact 2']\n"
            "     ALWAYS use objects with both name and description fields\n\n"
            "3. RISKS:\n"
            "   - Each risk MUST have 'risk', 'impact', 'mitigation'\n"
            "   - Extract from metadata.risks if available\n\n"
            "4. ESCALATION:\n"
            "   - Each escalation MUST have 'trigger' and 'action'\n\n"
            "5. FAMILY CLASSIFICATION (REQUIRED):\n"
            "   Analyze the document content and categorize into the most appropriate family:\n"
            "   - Technology: AI, ML, software, systems, platforms, data science\n"
            "   - Healthcare: health, medical, wellbeing, patient care, clinical\n"
            "   - Financial: finance, banking, investment, accounting, treasury\n"
            "   - Legal: law, compliance, regulation, governance, audit\n"
            "   - Education: learning, training, curriculum, academic\n"
            "   - Marketing: brand, campaign, advertising, social media\n"
            "   - Operations: process, workflow, supply chain, logistics\n"
            "   - Human Resources: HR, recruitment, employee, talent\n"
            "   - Sales: selling, revenue, business development\n"
            "   - Design: UX, UI, product design, creative\n"
            "   - Research: study, analysis, investigation, academic research\n"
            "   - Strategy: strategic planning, business strategy, roadmap\n"
            "   - Compliance: regulatory compliance, audit, risk management\n"
            "   - Project Management: project planning, delivery, program management\n"
            "   - Other: only if none of the above fit\n"
            "   Choose the MOST SPECIFIC category that fits.\n\n"
            "❌ NEVER return null for primary_artefact.name, outputs_deliverables.default, or family\n"
            "❌ NEVER use generic placeholders like 'Framework Document' or 'Concept Pack' unless truly appropriate\n"
            "✅ ALWAYS analyze the document content and generate SPECIFIC, MEANINGFUL artefacts with descriptions\n"
        )

        log(">> calling OpenAI...", verbose)
        resp = client.chat.completions.create(
            model=model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        txt = (resp.choices[0].message.content or "").strip()

        try:
            return robust_json_loads(txt)
        except Exception:
            fix = "Return the same content as a SINGLE valid JSON object only. No markdown, no comments."
            resp2 = client.chat.completions.create(
                model=model,
                temperature=0.0,
                messages=[
                    {"role": "system", "content": "You convert text to strict JSON."},
                    {"role": "user", "content": txt},
                    {"role": "system", "content": fix},
                ],
            )
            txt2 = (resp2.choices[0].message.content or "").strip()
            return robust_json_loads(txt2)

    except Exception as e:
        log(f"OpenAI API Error: {str(e)}", True)
        raise

    finally:
        # 恢复原始代理设置
        for key, value in original_proxies.items():
            os.environ[key] = value


# ---- main ----
def main():
    ap = argparse.ArgumentParser(description="Global LLM framework generator")
    ap.add_argument("metadata", help="path to metadata JSON, or - for stdin")
    ap.add_argument("--model", default="gpt-4o")
    ap.add_argument("--timeout", type=int, default=180)
    ap.add_argument(
        "--api-key", default=None, help="fill later or use env OPENAI_API_KEY"
    )
    ap.add_argument("--base-url", default=None, help="custom endpoint if any")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--out", default="-")
    ap.add_argument("--dry-run", action="store_true", help="force mock without API")
    args = ap.parse_args()

    md = load_metadata(args.metadata)
    key, base = resolve_api_settings(args.api_key, args.base_url)

    if args.dry_run or not key:
        log(">> no API key detected, using mock mode", True if args.verbose else False)
        fw = build_mock_framework(md)
    else:
        fw = call_openai_framework(
            md,
            model=args.model,
            timeout=args.timeout,
            api_key=key,
            base_url=base,
            verbose=args.verbose,
        )

    dump_json(fw, args.out)


if __name__ == "__main__":
    main()
