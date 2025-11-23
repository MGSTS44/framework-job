import os, sys, json, argparse, re, time
from typing import Dict, Any, Optional, List


def log(msg: str, on: bool):
    if on:
        print(msg, flush=True)


# Inline config hooks (optional)
INLINE_API_KEY = None
INLINE_BASE_URL = None


# ---------- I/O helpers ----------

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


def robust_json_loads(s: str) -> Dict[str, Any]:
    """
    Try to parse JSON, tolerate accidental markdown fences and extra text
    """
    s = s.strip()
    try:
        obj = json.loads(s)
        if not isinstance(obj, dict):
            raise ValueError("top-level must be object")
        return obj
    except Exception:
        pass

    # strip ```json ... ``` if present
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.I)
        s = re.sub(r"\s*```$", "", s)

    # try to extract { ... }
    l = s.find("{")
    r = s.rfind("}")
    if l != -1 and r != -1 and r > l:
        core = s[l:r + 1]
        obj = json.loads(core)
        if not isinstance(obj, dict):
            raise ValueError("top-level must be object")
        return obj

    raise ValueError("not valid json")


# ---------- Mock POV helper ----------

def generate_mock_pov(title_lower: str) -> List[str]:
    if "compliance" in title_lower or "audit" in title_lower or "risk" in title_lower:
        return [
            "Proactive risk identification and mitigation",
            "Continuous compliance monitoring",
            "Stakeholder transparency and accountability",
        ]
    elif "ai" in title_lower or "ml" in title_lower or "machine learning" in title_lower:
        return [
            "Risk-first approach to AI implementation",
            "Data-driven decision making with human oversight",
            "Ethical AI practices embedded throughout the lifecycle",
        ]
    elif "wellbeing" in title_lower or "health" in title_lower:
        return [
            "Patient-centered care as the foundation",
            "Evidence-based protocols with clinical flexibility",
            "Holistic wellbeing assessment approach",
        ]
    else:
        return [
            "Structured approach to problem solving",
            "Stakeholder-aligned decision making",
            "Continuous improvement and adaptation",
        ]


# ---------- Mock framework builder (no API key) ----------

def build_mock_framework(md: Dict[str, Any]) -> Dict[str, Any]:
    # Basic title/author
    title = (md.get("title") or md.get("subject") or "Untitled Framework").strip()
    author = md.get("author")
    if not author:
        ents = md.get("entities") or []
        author = ents[0] if ents else None

    # Concept clusters from facets/sections/keywords/entities
    clusters: Dict[str, List[str]] = {}

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
                c = (s or {}).get("preview") or (s or {}).get("content") or ""
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
                "Translate insights into actions",
            ]
        }

    # Workflow layers (simple mock)
    wl = []
    for k in list(clusters.keys())[:4]:
        wl.append(
            {
                "name": k.replace("_", " ").title(),
                "focus": f"Translate {k.replace('_', ' ')} into structured guidance.",
                "guidance": [
                    "Ground recommendations in evidence where available.",
                    "Keep language simple and accessible.",
                    "Connect guidance to real workflows and decisions.",
                ],
            }
        )

    # Tags
    tags: List[str] = []
    for src in (md.get("keywords"), md.get("industry"), md.get("jurisdiction")):
        if isinstance(src, list):
            for x in src:
                sx = str(x).strip()
                if sx and sx not in tags:
                    tags.append(sx)
    tags = tags[:12]

    triples = md.get("triples") or []
    kvs = md.get("key_values") or []

    title_lower = title.lower()

    # Pick primary artefact name/purpose based on keywords
    if "compliance" in title_lower or "audit" in title_lower or "risk" in title_lower:
        primary_name = "Compliance Readiness Pack"
        primary_purpose = "Help stakeholders understand the compliance posture and key risk controls."
        optional_arts = [
            "Detailed Risk Register",
            "Board Compliance Brief",
            "Audit Findings Summary",
        ]
    elif "ai" in title_lower or "ml" in title_lower or "machine learning" in title_lower:
        primary_name = "Gen-AI Readiness Pack"
        primary_purpose = "Help sponsors and teams evaluate and implement a GenAI-based HR support tool."
        optional_arts = [
            "AI Risk Assessment",
            "Model Behaviour Playbook",
            "Human-in-the-loop Checklist",
        ]
    elif "wellbeing" in title_lower or "health" in title_lower:
        primary_name = "Wellbeing Program Pack"
        primary_purpose = "Summarise the structure, metrics and guardrails of a wellbeing program."
        optional_arts = [
            "Wellbeing Dashboard",
            "Intervention Playbook",
            "Communication Toolkit",
        ]
    else:
        primary_name = "Framework Overview Pack"
        primary_purpose = "Explain the framework, key responsibilities and implementation guidance."
        optional_arts = [
            "Implementation Checklist",
            "Stakeholder Briefing Pack",
            "Retrospective Template",
        ]

    # ===== 新：mock artefact_variants -> 多个“独立 artefact” =====
    main_variant_id = "readiness_pack"

    artefact_variants = [
        {
            "id": main_variant_id,
            "name": primary_name,
            "summary": (
                f"A concise pack that explains what '{title}' is, who owns it, and "
                "which risks and controls matter most. Written for non-technical stakeholders."
            ),
            "when_to_use": [
                "Project initiation and approval meetings",
                "When introducing this framework to new stakeholders",
            ],
            "sections": [
                {
                    "heading": "1. System or Framework Overview",
                    "body": (
                        "Describe in plain language what this system or framework does, who uses it, and "
                        "which business workflows it touches. Avoid technical jargon and focus on outcomes."
                    ),
                },
                {
                    "heading": "2. Roles and Accountability",
                    "body": (
                        "List key roles such as Product Owner, Risk Owner and HR lead. For each role, state "
                        "what they are accountable for, what decisions they make and how they escalate issues."
                    ),
                },
                {
                    "heading": "3. Key Risks and Controls",
                    "body": (
                        "Highlight the few risks that really matter for this framework and summarise the "
                        "controls or guardrails that reduce those risks. Point to the full risk register if it exists."
                    ),
                },
                {
                    "heading": "4. Implementation and Rollout Guidance",
                    "body": (
                        "Lay out the main steps for piloting, rolling out and reviewing the framework. Include "
                        "how to onboard teams, measure success and adjust based on feedback."
                    ),
                },
            ],
            "risk_register": [
                {
                    "risk": "Misunderstanding of framework scope",
                    "category": "Governance",
                    "control": "Provide clear scope statements and examples of in-scope and out-of-scope use.",
                    "owner": "Framework Owner",
                },
                {
                    "risk": "Lack of stakeholder alignment",
                    "category": "Change management",
                    "control": "Run alignment workshops and share the readiness pack before major decisions.",
                    "owner": "Project Lead",
                },
            ],
        },
        {
            "id": "implementation_checklist",
            "name": "Implementation Checklist",
            "summary": (
                "A step-by-step checklist used by project teams to confirm that critical tasks, controls "
                "and sign-offs have been completed before go-live."
            ),
            "when_to_use": [
                "Before pilot go-live",
                "Before full rollout into production",
            ],
            "sections": [
                {
                    "heading": "1. Pre-implementation prerequisites",
                    "body": (
                        "Capture the basic prerequisites such as sponsorship, defined success metrics and data "
                        "access approvals. Each item should be framed as a question the team can answer Yes or No."
                    ),
                },
                {
                    "heading": "2. Testing and validation",
                    "body": (
                        "List checks that confirm the framework or system behaves as expected in realistic scenarios. "
                        "Include examples of test cases and how outcomes are recorded."
                    ),
                },
                {
                    "heading": "3. Risk and control confirmations",
                    "body": (
                        "Connect to the key risks and controls. For each control, include a simple check to ensure "
                        "it has been implemented and is owned by a named person or role."
                    ),
                },
            ],
            "risk_register": [
                {
                    "risk": "Checklist used as a formal tick-box only",
                    "category": "Process",
                    "control": "Require teams to record brief notes and attach evidence, not just tick Yes or No.",
                    "owner": "Project Governance Lead",
                }
            ],
        },
    ]

    # ====== 返回 mock framework（只改 artefact 相关字段，其他保持原样） ======
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
                "Initial stakeholder alignment",
                "Before implementation or rollout",
            ],
            "variant_id": main_variant_id,  # 🔥 关键：指向 artefact_variants[0].id
        },
        "concept_clusters": clusters,
        "trigger_context": [
            "When teams need repeatable guidance",
            "When multiple stakeholders need alignment",
        ],
        "workflow_layers": wl,
        "inputs_required": [
            "Source documents or notes",
            "Existing processes and roles",
            "Known risks or constraints",
        ],
        "risks_watchouts": [
            {
                "risk": "Over-generalisation",
                "impact": "Stakeholders cannot see what is specific to their context.",
                "mitigation": "Include concrete examples and context specific guidance.",
            },
            {
                "risk": "Jargon-heavy language",
                "impact": "Non-experts disengage or misinterpret guidance.",
                "mitigation": "Use plain language and explain specialist terms.",
            },
        ],
        "research_required": [
            "Stakeholder interviews or feedback",
            "Comparisons to peer frameworks",
        ],
        "outputs_deliverables": {
            "default": primary_name,
            "optional": optional_arts,
        },
        "escalation": [
            {
                "trigger": "Conflicting policies or unclear ownership",
                "action": "Escalate to framework owner and risk representative.",
            }
        ],
        "tags": tags,
        "derived_from_metadata": {
            "used_facets": list(clusters.keys()),
            "used_triples": triples[:5],
            "used_key_values": kvs[:5],
        },
        "confidence": calculate_mock_confidence(),
        "artefact_variants": artefact_variants,  # 🔥 多个“独立 artefact”
    }


# ---------- OpenAI call ----------

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

    # clear proxies for safety
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
        if base_url:
            client = OpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=timeout,
                max_retries=2,
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
            "6. Be specific and actionable, not generic - use actual content from metadata\n"
            "7. Return ONLY valid JSON - no markdown, no code fences, no comments\n\n"
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
            "pov": [
                "<point of view sentence 1>",
                "<point of view sentence 2>",
            ],
            "primary_artefact": {
                "name": "<primary artefact name>",
                "purpose": "<1-2 sentence purpose>",
                "when_to_use": ["<scenario 1>", "<scenario 2>", "<scenario 3>"],
                "variant_id": "<id of the main artefact in artefact_variants>",
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
            "outputs_deliverables": {
                "default": "<primary deliverable name>",
                "optional": [
                    {
                        "name": "<specific artefact name>",
                        "description": "<10-20 word description of purpose and use case>",
                    }
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
            "confidence": 75.0,  # ✅ AI-generated confidence score (60-100)
            # =====new：multiple artefact schema =====
            "artefact_variants": [
                {
                    "id": "<short id, e.g. 'readiness_pack', 'hr_playbook'>",
                    "name": "<artefact name, e.g. 'Gen-AI Readiness Pack'>",
                    "summary": "<2-4 sentence description in plain text, no markdown>",
                    "when_to_use": [
                        "<specific scenario 1>",
                        "<specific scenario 2>",
                    ],
                    "sections": [
                        {
                            "heading": "<section heading, e.g. '1. System Overview'>",
                            "body": "<full plain-text description of what belongs in this section>",
                        }
                    ],
                    "risk_register": [
                        {
                            "risk": "<risk title>",
                            "category": "<risk category, e.g. 'Accuracy', 'Privacy'>",
                            "control": "<control or mitigation in 1-2 sentences>",
                            "owner": "<role accountable for this risk>",
                        }
                    ],
                }
            ],
        }

        user_prompt = (
            "Build the framework JSON from this metadata. Keep lists short (<=6).\n\n"
            "Schema:\n"
            + json.dumps(schema, indent=2)
            + "\n\nMetadata:\n"
            + json.dumps(md, indent=2)
            + "\n\nCRITICAL INSTRUCTIONS:\n\n"
            "0. POINT OF VIEW (POV):\n"
            "   - Generate 2-4 concise points of view as an ARRAY of strings.\n"
            "   - Each POV is ONE sentence describing a guiding principle of the framework.\n\n"
            "1. WORKFLOW LAYERS:\n"
            "   - Each workflow_layer MUST have 'name', 'focus', and 'guidance'.\n"
            "   - guidance is a list of 3-5 specific, actionable steps.\n\n"
            "2. ARTEFACTS (PRIMARY + OPTIONALS):\n"
            "   - primary_artefact.name MUST be a specific deliverable name, not generic.\n"
            "   - primary_artefact.purpose MUST explain why it matters in 1-2 sentences.\n"
            "   - outputs_deliverables.default MUST equal primary_artefact.name.\n"
            "   - outputs_deliverables.optional MUST be an array of OBJECTS with name and description.\n\n"
            "3. RISKS AND ESCALATION:\n"
            "   - risks_watchouts[*] MUST have risk, impact, mitigation.\n"
            "   - escalation[*] MUST have trigger and action.\n\n"
            "4. MULTIPLE INDEPENDENT ARTEFACT VARIANTS (REASONABLE COUNT):\n"
            "   - artefact_variants MUST be an ARRAY of a reasonable number of independent artefacts.\n"
            "   - Generate AT LEAST 2 artefacts and AT MOST 7 artefacts.\n"
            "   - Use the breadth and richness of the metadata to decide how many to create:\n"
            "       · If the metadata is simple or narrow in scope → 2–3 artefacts.\n"
            "       · If the metadata is moderately rich → 3–5 artefacts.\n"
            "       · If the metadata is broad with many use cases or risks → 5–7 artefacts.\n"
            "   - Each artefact MUST have: id, name, summary, when_to_use, sections and risk_register.\n"
            "   - Do NOT merge multiple ideas into a single artefact if they could be separate usable artefacts.\n"
            "   - primary_artefact.variant_id MUST equal artefact_variants[0].id.\n"
            "   - primary_artefact.name MUST equal artefact_variants[0].name.\n"
            "   - primary_artefact.when_to_use should align with artefact_variants[0].when_to_use.\n\n"
            "5. TEXT FORMAT (IMPORTANT):\n"
            "   - All strings, especially in artefact_variants.summary, sections.body and risk_register.control, MUST be plain text.\n"
            "   - DO NOT use Markdown syntax: no **bold**, no headings with ###, no tables, no ``` fences.\n"
            "   - You can use normal sentences and line breaks only.\n\n"
            "6. SPECIFICITY:\n"
            "   - Base all artefacts and guidance on the actual themes in the metadata (e.g. HR, GenAI, compliance).\n"
            "   - Avoid generic placeholders like 'Framework Document' unless it really fits.\n\n"
            "7. CONFIDENCE SCORE (REQUIRED):\n"
            "   - Evaluate the framework quality and assign a confidence score between 60-100.\n"
            "   - Consider these factors when calculating the score:\n"
            "     · Metadata richness (facets, sections, keywords present): +0 to +15 points\n"
            "     · Structure completeness (all required fields filled): +0 to +15 points\n"
            "     · Artefact quality and specificity: +0 to +10 points\n"
            "     · Risk coverage and mitigation detail: +0 to +10 points\n"
            "   - Base score starts at 60 (minimum acceptable framework).\n"
            "   - Score interpretation:\n"
            "     · 60-64: Minimal framework with only basic structure\n"
            "     · 65-74: Adequate framework with standard completeness\n"
            "     · 75-84: Good framework with solid structure and meaningful detail\n"
            "     · 85-94: Excellent framework with comprehensive coverage\n"
            "     · 95-100: Outstanding framework with exceptional quality and depth\n"
            "   - IMPORTANT: The confidence field MUST be a number (float), NOT a string.\n"
            "   - Example: \"confidence\": 82.5\n"
            "   - DO NOT return \"confidence\": \"82.5\" (with quotes around the number).\n\n"
            "Return ONLY a single valid JSON object matching the schema above."
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
            fix_msg = (
                "Convert your previous answer to a single strict JSON object. "
                "No markdown, no explanation, only JSON."
            )
            resp2 = client.chat.completions.create(
                model=model,
                temperature=0.0,
                messages=[
                    {"role": "system", "content": "You convert text to strict JSON."},
                    {"role": "user", "content": txt},
                    {"role": "system", "content": fix_msg},
                ],
            )
            txt2 = (resp2.choices[0].message.content or "").strip()
            return robust_json_loads(txt2)

    finally:
        # restore proxies
        for key, value in original_proxies.items():
            os.environ[key] = value


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser(description="Global LLM framework generator")
    ap.add_argument("metadata", help="path to metadata JSON, or - for stdin")
    ap.add_argument("--model", default="gpt-4o")
    ap.add_argument("--timeout", type=int, default=180)
    ap.add_argument("--api-key", default=None, help="OpenAI API key (or use env)")
    ap.add_argument("--base-url", default=None, help="custom OpenAI-compatible base URL")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--out", default="-")
    ap.add_argument("--dry-run", action="store_true", help="force mock output without calling API")
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
