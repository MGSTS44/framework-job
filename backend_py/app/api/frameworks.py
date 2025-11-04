from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    BackgroundTasks,
    Depends,
    Form,
    Query,
)
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
import json
import tempfile
import os
import random
from pathlib import Path
from datetime import datetime
from nanoid import generate

# Database
from ..db import get_db
from ..models import Framework, FRAMEWORK_GROUPS
from ..auth import get_current_user_id

# LLM
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from llm_local import extract_seed
    from llm_global import (
        build_mock_framework,
        call_openai_framework,
        resolve_api_settings,
    )
except ImportError as e:
    print(f"Warning: Could not import LLM modules: {e}")
    print("Make sure llm_local.py and llm_global.py are in the correct location")


router = APIRouter(prefix="/api/frameworks", tags=["frameworks"])


# ============= Request/Response Models =============


class TextGenerateRequest(BaseModel):
    text: str
    use_global_llm: bool = True
    model: str = "gpt-4o"
    user_id: Optional[str] = None


class GenerateResponse(BaseModel):
    success: bool
    framework_id: Optional[str] = None
    framework: Optional[dict] = None
    frameworks: Optional[List[dict]] = None  # 多个framework
    # Local LLM
    metadata: Optional[dict] = None
    error: Optional[str] = None


class RegenerateRequest(BaseModel):
    framework: dict
    use_local: bool = False


class FrameworkListResponse(BaseModel):
    """框架列表响应"""

    id: str
    title: str
    version: str
    family: str
    confidence: float
    created_at: datetime
    updated_at: datetime

    # 简化的内容预览（用于卡片显示）
    preview_artefacts: List[dict]  # 最多3个artefact


class FrameworkDetailResponse(BaseModel):
    """框架详情响应"""

    id: str
    title: str
    version: str
    family: str
    confidence: float
    creator_id: str
    metadata: dict
    steps: List[dict]
    artefacts: dict
    risks: List[dict]
    escalation: List[dict]
    created_at: datetime
    updated_at: datetime


# ============= Helper Functions =============


def calculate_mock_confidence() -> float:
    """
    生成 mock confidence 分数 (60-95)
    未来可以基于 AI 计算真实的置信度
    """
    return round(random.uniform(60, 95), 1)


def ensure_family_in_framework(framework: dict) -> str:
    family = framework.get("family") or framework.get("category")

    if family and family in FRAMEWORK_GROUPS:
        return family

    # 如果 AI 没返回或返回了无效值，尝试基于 title 智能推断
    title = framework.get("title", "").lower()
    # 扩展关键词列表，按优先级排序
    # Technology & AI
    if any(
        word in title
        for word in [
            "ai",
            "artificial intelligence",
            "machine learning",
            "ml",
            "tech",
            "software",
            "system",
            "platform",
            "data",
            "algorithm",
            "digital",
            "cloud",
            "api",
            "code",
            "programming",
        ]
    ):
        return "Technology"

    # Healthcare & Wellbeing  ✅ 添加 wellbeing, wellness
    elif any(
        word in title
        for word in [
            "health",
            "medical",
            "patient",
            "hospital",
            "clinical",
            "wellbeing",
            "wellness",
            "healthcare",
            "care",
            "medicine",
            "diagnosis",
            "treatment",
            "therapy",
            "pharmaceutical",
        ]
    ):
        return "Healthcare"

    # Legal & Compliance
    elif any(
        word in title
        for word in [
            "legal",
            "law",
            "compliance",
            "regulation",
            "regulatory",
            "audit",
            "governance",
            "policy",
            "risk management",
            "gdpr",
            "privacy",
            "data protection",
            "contract",
        ]
    ):
        return "Legal"

    # Financial
    elif any(
        word in title
        for word in [
            "finance",
            "financial",
            "bank",
            "invest",
            "investment",
            "accounting",
            "treasury",
            "payment",
            "trading",
            "fund",
            "capital",
            "credit",
            "loan",
            "insurance",
        ]
    ):
        return "Financial"

    # Education & Training
    elif any(
        word in title
        for word in [
            "education",
            "training",
            "learning",
            "course",
            "curriculum",
            "teaching",
            "student",
            "academic",
            "school",
            "university",
            "certification",
            "workshop",
        ]
    ):
        return "Education"

    # Marketing & Brand
    elif any(
        word in title
        for word in [
            "marketing",
            "brand",
            "campaign",
            "advertising",
            "promotion",
            "social media",
            "seo",
            "content marketing",
            "pr",
            "communication",
            "outreach",
        ]
    ):
        return "Marketing"

    # Operations & Process
    elif any(
        word in title
        for word in [
            "operation",
            "process",
            "workflow",
            "supply chain",
            "logistics",
            "manufacturing",
            "production",
            "delivery",
            "optimization",
            "efficiency",
        ]
    ):
        return "Operations"

    # Human Resources
    elif any(
        word in title
        for word in [
            "hr",
            "human resource",
            "recruit",
            "employee",
            "talent",
            "hiring",
            "onboarding",
            "performance",
            "compensation",
            "benefits",
            "workforce",
        ]
    ):
        return "Human Resources"

    # Sales & Business Development
    elif any(
        word in title
        for word in [
            "sales",
            "sell",
            "selling",
            "revenue",
            "customer",
            "business development",
            "account management",
            "crm",
            "pipeline",
            "deal",
        ]
    ):
        return "Sales"

    # Design & UX
    elif any(
        word in title
        for word in [
            "design",
            "ux",
            "ui",
            "user experience",
            "interface",
            "product design",
            "visual",
            "creative",
            "prototype",
            "wireframe",
            "mockup",
        ]
    ):
        return "Design"

    # Research & Analysis
    elif any(
        word in title
        for word in [
            "research",
            "study",
            "analysis",
            "investigation",
            "survey",
            "questionnaire",
            "data collection",
            "findings",
            "methodology",
            "hypothesis",
        ]
    ):
        return "Research"

    # Strategy & Planning
    elif any(
        word in title
        for word in [
            "strategy",
            "strategic",
            "planning",
            "roadmap",
            "business plan",
            "vision",
            "mission",
            "objectives",
            "goals",
            "initiative",
        ]
    ):
        return "Strategy"

    # Project Management
    elif any(
        word in title
        for word in [
            "project",
            "program",
            "delivery",
            "implementation",
            "milestone",
            "sprint",
            "agile",
            "scrum",
            "waterfall",
            "gantt",
            "timeline",
        ]
    ):
        return "Project Management"

    # Default fallback
    else:
        return "Other"


def process_with_local_llm(input_data: str, is_file: bool = False) -> dict:
    """
    步骤 1: 使用 Local LLM (Cloud or Ollama) 提取元数据

    现在支持从环境变量读取配置：
    - LLM_TYPE: "cloud" 或 "local"
    - LOCAL_LLM_URL: Cloud LLM地址 (例如: http://34.87.13.228:8000/v1)

    Args:
        input_data: 文件路径或文本内容
        is_file: 是否为文件路径

    Returns:
        metadata: 提取的结构化元数据
    """
    try:
        # ✅ 不再硬编码 host 和 model，让 extract_seed 从环境变量读取
        # 这样就能正确使用 Cloud LLM 而不是本地 Ollama
        print(
            f"🔄 Step 1: Processing {'file' if is_file else 'text'} with Local LLM (Privacy Protection)..."
        )

        metadata = extract_seed(input_data=input_data)

        return metadata

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Local LLM processing failed: {str(e)}"
        )


def process_with_global_llm(
    metadata: dict, model: str = "gpt-4o", use_mock: bool = False
) -> dict:
    """
    步骤 2: 使用 Global LLM (OpenAI) 生成框架

    注意：这里会让 AI 自动分配 family 字段
    """
    try:
        api_key, base_url = resolve_api_settings(None, None)

        if use_mock or not api_key:
            print("ℹ️  Using mock framework generation (no OpenAI API key)")
            framework = build_mock_framework(metadata)
        else:
            print(f"🌐 Calling OpenAI API with model: {model}")

            # 🔥 增强 prompt，让 AI 分配 family
            # 注意：这需要修改 llm_global.py 中的 prompt
            # 或者在这里添加额外的 API 调用来分类

            framework = call_openai_framework(
                md=metadata,
                model=model,
                timeout=180,
                api_key=api_key,
                base_url=base_url,
                verbose=True,
            )
            print("✅ OpenAI API call successful")

        # 确保 family 字段存在
        # framework['family'] = ensure_family_in_framework(framework)

        return framework

    except Exception as e:
        import traceback

        print("❌ Global LLM Error:")
        print(traceback.format_exc())

        raise HTTPException(
            status_code=500, detail=f"Global LLM processing failed: {str(e)}"
        )


def save_framework_to_db(
    framework_data: dict, metadata_dict: dict, creator_id: str, db: Session
) -> Framework:
    """
    将生成的 framework 保存到数据库

    Args:
        framework_data: AI 生成的完整框架
        metadata_dict: Local LLM 提取的 metadata
        creator_id: 创建者用户 ID
        db: 数据库 session

    Returns:
        保存的 Framework 对象
    """

    # 生成框架 ID
    framework_id = f"fw_{generate(size=12)}"

    # 提取各部分数据
    metadata = framework_data.get("metadata", {})
    steps = framework_data.get("steps", [])
    artefacts = framework_data.get("artefacts", {})
    risks = framework_data.get("risks", [])
    escalation = framework_data.get("escalation", [])
    pov = framework_data.get("pov")
    family = framework_data.get("family", "Other")
    confidence = float(framework_data.get("confidence", 0))

    # 获取基本信息
    title = metadata.get("title") or framework_data.get("title", "Untitled Framework")
    version = metadata.get("version", "1.0.0")
    # family = ensure_family_in_framework(framework_data)
    # confidence = calculate_mock_confidence()

    # new
    family = framework_data.get("family", "Other")
    confidence = float(framework_data.get("confidence", 0))
    pov = framework_data.get("pov", None)

    # 创建数据库记录
    db_framework = Framework(
        id=framework_id,
        title=title,
        version=version,
        creator_id=creator_id,
        metadata_json=json.dumps(metadata, ensure_ascii=False),
        steps_json=json.dumps(steps, ensure_ascii=False),
        artefacts_json=json.dumps(artefacts, ensure_ascii=False),
        risks_json=json.dumps(risks, ensure_ascii=False),
        escalation_json=json.dumps(escalation, ensure_ascii=False),
        raw_framework_json=json.dumps(framework_data, ensure_ascii=False),
        raw_metadata_json=json.dumps(metadata_dict, ensure_ascii=False),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        pov=pov,
        family=family,
        confidence=confidence,
    )

    db.add(db_framework)
    db.commit()
    db.refresh(db_framework)

    return db_framework


# ============= API Endpoints =============


@router.post("/generate-from-text", response_model=GenerateResponse)
async def generate_from_text(
    request: TextGenerateRequest,
    db: Session = Depends(get_db),
):
    user_id = getattr(request, "user_id", None)
    """
    从文本生成框架（需要登录）

    调用链路: 前端文本 → 本地 LLM → Global LLM → 保存数据库 → 返回框架
    """
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text content is empty")

        if len(request.text) > 50000:
            raise HTTPException(
                status_code=400, detail="Text too long (max 50,000 characters)"
            )

        # ✅ 根据 use_global_llm 决定是否使用 Local LLM
        if not request.use_global_llm:
            # 🔒 Lock ON: 隐私保护模式
            print("🔄 Step 1: Processing with Local LLM (Privacy Protection)...")
            metadata = process_with_local_llm(request.text, is_file=False)
            print(f"✅ Local LLM completed. Extracted {len(metadata)} metadata fields")

            print("🔄 Step 2: Processing with Global LLM...")
            framework_result = process_with_global_llm(
                metadata=metadata, model=request.model, use_mock=False
            )
            print("✅ Global LLM completed")
        else:
            # 🔓 Lock OFF: 快速模式
            print("🔄 Processing with Global LLM (Fast Mode - No Local Processing)...")

            # 🔑 1. 提取标题（第一行或前150字符）
            lines = request.text.strip().split("\n")
            potential_title = lines[0][:150].strip() if lines else "User Content"

            # 🔑 2. 简单关键词提取（从标题中提取）
            # 取长度>3的单词，最多5个
            simple_keywords = [
                word.strip()
                for word in potential_title.lower().split()
                if len(word.strip()) > 3
            ][:5]

            # 🔑 3. 提取章节结构（前5个段落或章节）
            # 不传完整内容，只传标题
            sections = []
            current_section_lines = []

            for line in lines[:100]:  # 只看前100行
                line_stripped = line.strip()
                if not line_stripped:
                    continue

                # 判断是否是章节标题（简单规则：较短的行，或包含数字）
                if len(line_stripped) < 100 and (
                    line_stripped[0].isdigit()
                    or line_stripped.isupper()
                    or any(
                        marker in line_stripped.lower()
                        for marker in ["step", "phase", "stage", "chapter"]
                    )
                ):
                    if current_section_lines:
                        # 保存前一个section（只保留前200字作为摘要）
                        content_preview = " ".join(current_section_lines)[:200]
                        sections.append(
                            {
                                "title": current_section_lines[0][:150],
                                "content": content_preview,  # ✅ 只保留前200字
                                "level": 1,
                            }
                        )
                        current_section_lines = [line_stripped]
                    else:
                        current_section_lines = [line_stripped]
                else:
                    if len(current_section_lines) < 3:  # 每个section最多保留3行预览
                        current_section_lines.append(line_stripped)

            # 保存最后一个section
            if current_section_lines:
                content_preview = " ".join(current_section_lines)[:200]
                sections.append(
                    {
                        "title": current_section_lines[0][:150],
                        "content": content_preview,
                        "level": 1,
                    }
                )

            # 如果没有提取到sections，使用简单的分段
            if not sections:
                # 简单分段：每500字一个section
                text_parts = [
                    request.text[i : i + 500]
                    for i in range(0, min(len(request.text), 2500), 500)
                ]
                sections = [
                    {
                        "title": f"Section {i+1}",
                        "content": part[:200] + "...",  # ✅ 每个section只保留前200字
                        "level": 1,
                    }
                    for i, part in enumerate(text_parts)
                ]

            # ✅ 4. 创建优化的 metadata（参考Lock ON的结构）
            metadata = {
                "doc_id": f"doc-{generate(size=12)}",
                "title": potential_title,  # ✅ 真实标题
                "subject": potential_title,
                "language": "en",
                "bypass_local_llm": True,
                # ✅ 关键字段
                "keywords": simple_keywords,  # ✅ 5-10个关键词
                # ✅ sections：只包含章节标题和前200字预览
                "sections": sections[:10],  # 最多10个sections
                # ✅ facets：简单的主题分类
                "facets": {
                    "main_topic": {
                        "summary": potential_title,
                        "items": [
                            {
                                "value": kw,
                                "evidence": "",
                                "location": "",
                                "confidence": 0.8,
                            }
                            for kw in simple_keywords
                        ],
                    }
                },
                # ✅ key_values：关键信息键值对
                "key_values": [
                    {"key": "document_title", "value": potential_title},
                    {"key": "processing_mode", "value": "direct"},
                    {"key": "section_count", "value": str(len(sections))},
                ],
                # ✅ tags：使用关键词
                "tags": simple_keywords,
                # 其他必需字段（保持为空）
                "triples": [],
                "questions": [],
                "risks": [],
                "actions_todo": [],
                "metrics": [],
                "tables": [],
                "figures": [],
                "extra": {
                    "processing_mode": "direct",
                    "note": "Extracted structure without full text to reduce prompt size",
                    "original_length": len(request.text),
                    "truncated": True,
                },
            }

            # 不添加 raw_text 或 full_content！
            # ChatGPT不需要完整原文，只需要结构化信息

            framework_result = process_with_global_llm(
                metadata=metadata, model=request.model, use_mock=False
            )
            print("✅ Global LLM completed")

        # 🔧 修改：支持多 POV / 多 framework 结果
        # ✅ 支持多 POV / 多 framework 结果
        frameworks = framework_result.get("frameworks", [framework_result])

        print(f"✅ Framework generation completed: {len(frameworks)} framework(s)")

        # ✅ 直接返回生成的数据，不保存到数据库（由前端保存到 Firebase）
        return GenerateResponse(
            success=True,
            framework_id=None,  # 前端创建后会有 ID
            framework=frameworks[0] if frameworks else None,
            frameworks=frameworks,
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in generate_from_text: {str(e)}")
        import traceback

        traceback.print_exc()
        return GenerateResponse(success=False, error=str(e))


@router.post("/generate-from-file", response_model=GenerateResponse)
async def generate_from_file(
    file: UploadFile = File(...),
    use_global_llm: bool = True,
    model: str = "gpt-4o",
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    从上传文件生成框架（需要登录）

    调用链路: 前端文件 → 本地 LLM → Global LLM → 保存数据库 → 返回框架
    """
    temp_path = None

    try:
        # 验证文件
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        # 检查文件类型
        allowed_extensions = {".txt", ".pdf", ".doc", ".docx", ".md"}
        file_ext = Path(file.filename).suffix.lower()

        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}",
            )

        # 检查文件大小 (10MB)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")

        # 保存到临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            tmp.write(content)
            temp_path = tmp.name

        print(f"📁 File saved to: {temp_path}")

        # 步骤 1: 本地 LLM 提取元数据
        print("🔄 Step 1: Processing with Local LLM (Ollama)...")
        metadata = process_with_local_llm(temp_path, is_file=True)
        print(f"✅ Local LLM completed. Extracted {len(metadata)} metadata fields")

        # 步骤 2: Global LLM 生成框架
        print("🔄 Step 2: Processing with Global LLM (OpenAI)...")
        framework_result = process_with_global_llm(  # ✅ MODIFIED
            metadata=metadata, model=model, use_mock=not use_global_llm
        )
        print("✅ Global LLM completed. Framework generated")

        # ✅ MODIFIED: 支持多 POV 输出
        frameworks = framework_result.get("frameworks", [framework_result])

        # 🔥 步骤 3: 保存到数据库
        print("💾 Step 3: Saving framework(s) to database...")
        saved_ids = []  # ✅ MODIFIED
        for fw_data in frameworks:  # ✅ MODIFIED
            db_framework = save_framework_to_db(  # ✅ MODIFIED
                framework_data=fw_data,  # ✅ MODIFIED
                metadata_dict=metadata,
                creator_id=user_id,
                db=db,
            )
            saved_ids.append(db_framework.id)  # ✅ MODIFIED
        print(f"✅ All frameworks saved: {len(saved_ids)} total")  # ✅ MODIFIED

        # ✅ MODIFIED: 同时返回单个与多个（向后兼容）
        return GenerateResponse(
            success=True,
            framework_id=saved_ids[0] if saved_ids else None,  # ✅ MODIFIED
            framework=frameworks[0] if frameworks else None,  # ✅ MODIFIED
            frameworks=frameworks,  # ✅ MODIFIED
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in generate_from_file: {str(e)}")
        import traceback

        traceback.print_exc()
        return GenerateResponse(success=False, error=str(e))
    finally:
        # 清理临时文件
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass


@router.post("/generate-from-files", response_model=GenerateResponse)
async def generate_from_files(
    files: List[UploadFile] = File(...),
    use_global_llm: bool = True,
    model: str = "gpt-4o",
    # No need for this anymore, change to firebase
    ## user_id: str = Depends(get_current_user_id),
    user_id: str = Form(None),
    db: Session = Depends(get_db),
):
    """
    从多个文件生成框架（需要登录）

    多个文件会被合并处理
    """
    temp_paths = []

    try:
        if not files or len(files) == 0:
            raise HTTPException(status_code=400, detail="No files provided")

        if len(files) > 10:
            raise HTTPException(status_code=400, detail="Too many files (max 10)")

        # 保存所有文件到临时目录
        for file in files:
            if not file.filename:
                continue

            file_ext = Path(file.filename).suffix.lower()
            allowed_extensions = {".txt", ".pdf", ".doc", ".docx", ".md"}

            if file_ext not in allowed_extensions:
                continue

            content = await file.read()
            if len(content) > 10 * 1024 * 1024:
                raise HTTPException(
                    status_code=400, detail=f"File {file.filename} too large"
                )

            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                tmp.write(content)
                temp_paths.append(tmp.name)

        if not temp_paths:
            raise HTTPException(status_code=400, detail="No valid files")

        print(f"📁 Saved {len(temp_paths)} files")

        # ✅ 根据 use_global_llm 决定是否使用 Local LLM
        if not use_global_llm:
            # 🔒 Lock ON: 隐私保护模式
            print("🔄 Step 1: Processing files with Local LLM (Privacy Protection)...")
            all_metadata = []

            for temp_path in temp_paths:
                metadata = process_with_local_llm(temp_path, is_file=True)
                all_metadata.append(metadata)

            merged_metadata = all_metadata[0] if all_metadata else {}
            if len(all_metadata) > 1:
                merged_metadata["source_count"] = len(all_metadata)
                merged_metadata["merged_from_multiple_files"] = True

            print(f"✅ Local LLM completed. Processed {len(temp_paths)} files")

            print("🔄 Step 2: Processing with Global LLM...")
            framework_result = process_with_global_llm(
                metadata=merged_metadata, model=model, use_mock=False
            )
            print("✅ Global LLM completed")
        else:
            # 🔓 Lock OFF: 快速模式
            print("🔄 Processing with Global LLM (Fast Mode - No Local Processing)...")

            # 读取所有文件内容
            file_contents = []
            file_names = []
            for i, temp_path in enumerate(temp_paths):
                try:
                    # 获取文件名
                    original_filename = (
                        files[i].filename if i < len(files) else f"file_{i+1}"
                    )
                    file_names.append(original_filename)

                    for encoding in ["utf-8", "gbk", "latin-1"]:
                        try:
                            with open(temp_path, "r", encoding=encoding) as f:
                                content = f.read()
                                file_contents.append(content)
                                break
                        except (UnicodeDecodeError, UnicodeError):
                            continue
                except Exception as e:
                    print(f"Warning: Could not read file {temp_path}: {e}")

            # 🔑 1. 智能提取标题
            if len(file_contents) == 1:
                # 单文件：使用第一行或文件名
                lines = file_contents[0].strip().split("\n")
                potential_title = (
                    lines[0][:150].strip()
                    if lines and len(lines[0].strip()) > 10
                    else file_names[0]
                )
            else:
                # 多文件：使用组合描述
                lines = file_contents[0].strip().split("\n") if file_contents else []
                if lines and len(lines[0].strip()) > 10:
                    potential_title = lines[0][:150].strip()
                else:
                    potential_title = f"Framework from {len(file_names)} files"

            # 🔑 2. 简单关键词提取
            simple_keywords = [
                word.strip()
                for word in potential_title.lower().split()
                if len(word.strip()) > 3
            ][:5]

            # 🔑 3. 提取sections（从所有文件中提取，但每个section只保留前200字）
            all_sections = []

            for idx, content in enumerate(file_contents):
                file_name = (
                    file_names[idx] if idx < len(file_names) else f"File {idx+1}"
                )
                lines = content.strip().split("\n")

                # 为每个文件创建sections
                current_section_lines = []

                for line in lines[:50]:  # 每个文件只看前50行
                    line_stripped = line.strip()
                    if not line_stripped:
                        continue

                    # 判断是否是章节标题
                    if len(line_stripped) < 100 and (
                        line_stripped[0].isdigit()
                        or line_stripped.isupper()
                        or any(
                            marker in line_stripped.lower()
                            for marker in ["step", "phase", "stage", "chapter"]
                        )
                    ):
                        if current_section_lines:
                            content_preview = " ".join(current_section_lines)[:200]
                            all_sections.append(
                                {
                                    "title": f"{file_name}: {current_section_lines[0][:100]}",
                                    "content": content_preview,  # ✅ 只保留前200字
                                    "level": 1,
                                    "source_file": file_name,
                                }
                            )
                            current_section_lines = [line_stripped]
                        else:
                            current_section_lines = [line_stripped]
                    else:
                        if len(current_section_lines) < 3:
                            current_section_lines.append(line_stripped)

                # 保存最后一个section
                if current_section_lines:
                    content_preview = " ".join(current_section_lines)[:200]
                    all_sections.append(
                        {
                            "title": f"{file_name}: {current_section_lines[0][:100]}",
                            "content": content_preview,
                            "level": 1,
                            "source_file": file_name,
                        }
                    )

            # 如果没有提取到sections，为每个文件创建一个简单section
            if not all_sections:
                all_sections = [
                    {
                        "title": file_names[i]
                        if i < len(file_names)
                        else f"File {i+1}",
                        "content": content[:200] + "...",  # ✅ 只保留前200字
                        "level": 1,
                        "source_file": file_names[i]
                        if i < len(file_names)
                        else f"File {i+1}",
                    }
                    for i, content in enumerate(file_contents)
                ]

            # ✅ 4. 创建优化的 metadata
            merged_metadata = {
                "doc_id": f"doc-{generate(size=12)}",
                "title": potential_title,  # ✅ 真实标题
                "subject": potential_title,
                "language": "en",
                "bypass_local_llm": True,
                # ✅ 关键字段
                "keywords": simple_keywords,
                # ✅ sections：只包含章节标题和前200字预览
                "sections": all_sections[:15],  # 最多15个sections
                # ✅ facets
                "facets": {
                    "main_topic": {
                        "summary": potential_title,
                        "items": [
                            {
                                "value": kw,
                                "evidence": "",
                                "location": "",
                                "confidence": 0.8,
                            }
                            for kw in simple_keywords
                        ],
                    },
                    "source_files": {
                        "summary": f"Content from {len(file_contents)} file(s)",
                        "items": [
                            {
                                "value": name,
                                "evidence": "",
                                "location": "",
                                "confidence": 1.0,
                            }
                            for name in file_names
                        ],
                    },
                },
                # ✅ key_values
                "key_values": [
                    {"key": "document_title", "value": potential_title},
                    {"key": "file_count", "value": str(len(file_contents))},
                    {"key": "processing_mode", "value": "direct"},
                    {"key": "source_files", "value": ", ".join(file_names[:3])},
                ],
                # ✅ tags
                "tags": simple_keywords,
                # 其他必需字段
                "source_count": len(file_contents),
                "source_files": file_names,
                "triples": [],
                "questions": [],
                "risks": [],
                "actions_todo": [],
                "metrics": [],
                "tables": [],
                "figures": [],
                "extra": {
                    "processing_mode": "direct",
                    "note": "Extracted structure without full text to reduce prompt size",
                    "file_names": file_names,
                    "total_length": sum(len(c) for c in file_contents),
                    "truncated": True,
                },
            }

            # ❌ 关键：不添加 raw_text、full_content 或完整的 combined_text！

            framework_result = process_with_global_llm(
                metadata=merged_metadata, model=model, use_mock=False
            )
            print("✅ Global LLM completed")

        # ✅ MODIFIED: 支持多 POV 输出
        frameworks = framework_result.get("frameworks", [framework_result])

        # 🔥 步骤 3: 生成 framework IDs(前端会保存到 Firebase)
        print(
            "💾 Step 3: Generating framework IDs (data will be saved to Firebase by frontend)..."
        )

        saved_ids = []
        for fw_data in frameworks:
            # 为每个 framework 生成唯一 ID
            fw_id = f"fw_{generate(size=12)}"
            fw_data["id"] = fw_id  # 添加 ID 到 framework 数据中
            saved_ids.append(fw_id)

        print(f"✅ Generated {len(saved_ids)} framework IDs: {saved_ids}")

        # ✅ MODIFIED: 同时返回单个与多个
        return GenerateResponse(
            success=True,
            framework_id=saved_ids[0] if saved_ids else None,
            framework=frameworks[0] if frameworks else None,
            frameworks=frameworks,
            metadata=merged_metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback

        traceback.print_exc()
        return GenerateResponse(success=False, error=str(e))
    finally:
        # 清理所有临时文件
        for temp_path in temp_paths:
            if os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except:
                    pass


# 新增：获取当前用户的所有 frameworks
@router.get("/my-frameworks", response_model=List[FrameworkListResponse])
def get_my_frameworks(user_id: str = Query(None), db: Session = Depends(get_db)):
    """
    获取当前用户创建的所有 frameworks

    按创建时间倒序排列
    用于 "Your Frameworks" 列表页
    """

    frameworks = (
        db.query(Framework)
        .filter(Framework.creator_id == user_id)
        .order_by(Framework.created_at.desc())
        .all()
    )

    result = []
    for fw in frameworks:
        # 解析 artefacts 用于预览
        artefacts = json.loads(fw.artefacts_json)
        additional = artefacts.get("additional", [])

        # 只取前3个 artefact 用于卡片显示
        preview_artefacts = []
        if additional:
            for art in additional[:3]:
                preview_artefacts.append(
                    {
                        "name": art.get("name", ""),
                        "description": art.get("description", "")[:100],  # 截断描述
                    }
                )

        result.append(
            FrameworkListResponse(
                id=fw.id,
                title=fw.title,
                version=fw.version,
                family=fw.family,
                confidence=fw.confidence,
                created_at=fw.created_at,
                updated_at=fw.updated_at,
                preview_artefacts=preview_artefacts,
            )
        )

    return result


# 新增：按 family 分组获取 frameworks
@router.get("/my-frameworks/by-family")
def get_my_frameworks_by_family(
    user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)
):
    """
    获取当前用户的 frameworks，按 family 分组

    返回格式:
    {
        "Financial": [framework1, framework2, ...],
        "Healthcare": [...],
        ...
    }
    """

    frameworks = (
        db.query(Framework)
        .filter(Framework.creator_id == user_id)
        .order_by(Framework.created_at.desc())
        .all()
    )

    # 按 family 分组
    grouped = {}
    for fw in frameworks:
        family = fw.family or "Other"

        if family not in grouped:
            grouped[family] = []

        # 解析 artefacts
        artefacts = json.loads(fw.artefacts_json)
        additional = artefacts.get("additional", [])

        preview_artefacts = []
        if additional:
            for art in additional[:3]:
                preview_artefacts.append(
                    {
                        "name": art.get("name", ""),
                        "description": art.get("description", "")[:100],
                    }
                )

        grouped[family].append(
            {
                "id": fw.id,
                "title": fw.title,
                "version": fw.version,
                "family": fw.family,
                "confidence": fw.confidence,
                "created_at": fw.created_at.isoformat(),
                "updated_at": fw.updated_at.isoformat(),
                "preview_artefacts": preview_artefacts,
            }
        )

    return grouped


# 新增：获取单个 framework 的详细信息
@router.get("/{framework_id}", response_model=FrameworkDetailResponse)
def get_framework_detail(
    framework_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    获取 framework 的完整信息

    只能访问自己创建的 framework
    """

    framework = (
        db.query(Framework)
        .filter(
            Framework.id == framework_id, Framework.creator_id == user_id  # 确保只能访问自己的
        )
        .first()
    )

    if not framework:
        raise HTTPException(
            status_code=404,
            detail="Framework not found or you don't have permission to access it",
        )

    return FrameworkDetailResponse(
        id=framework.id,
        title=framework.title,
        version=framework.version,
        family=framework.family,
        confidence=framework.confidence,
        creator_id=framework.creator_id,
        metadata=json.loads(framework.metadata_json),
        steps=json.loads(framework.steps_json),
        artefacts=json.loads(framework.artefacts_json),
        risks=json.loads(framework.risks_json),
        escalation=json.loads(framework.escalation_json),
        created_at=framework.created_at,
        updated_at=framework.updated_at,
    )


# 新增：绑定信息接口 (/api/frameworks/{id}/binding)
@router.get("/{framework_id}/binding")
def get_framework_binding(
    framework_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    获取 framework 的 POV、family、confidence 绑定信息
    （用于前端在框架卡片或详情页中同时显示 POV 与信心度）
    """
    # 🔍 查询当前用户的 framework
    fw = (
        db.query(Framework)
        .filter(Framework.id == framework_id, Framework.creator_id == user_id)
        .first()
    )

    if not fw:
        raise HTTPException(
            status_code=404, detail="Framework not found or access denied"
        )

    # 尝试从 raw_framework_json 中提取 POV（AI 返回的完整内容）
    pov_value = None
    try:
        if fw.raw_framework_json:
            raw_data = json.loads(fw.raw_framework_json)
            pov_value = raw_data.get("pov")
    except Exception:
        pov_value = None

    # ✅ 返回统一绑定信息
    return {
        "id": fw.id,
        "title": fw.title,
        "pov": pov_value,
        "family": fw.family,
        "confidence": fw.confidence,
        "created_at": fw.created_at,
        "updated_at": fw.updated_at,
    }


# 新增：更新 framework
@router.put("/{framework_id}")
def update_framework(
    framework_id: str,
    framework_data: dict,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    更新 framework（从 Editor 保存）

    只能更新自己创建的 framework
    """

    framework = (
        db.query(Framework)
        .filter(Framework.id == framework_id, Framework.creator_id == user_id)
        .first()
    )

    if not framework:
        raise HTTPException(
            status_code=404, detail="Framework not found or you don't have permission"
        )

    # 更新字段
    metadata = framework_data.get("metadata", {})
    framework.title = metadata.get("title", framework.title)
    framework.version = metadata.get("version", framework.version)

    # 更新 JSON 字段
    framework.metadata_json = json.dumps(metadata, ensure_ascii=False)
    framework.steps_json = json.dumps(
        framework_data.get("steps", []), ensure_ascii=False
    )
    framework.artefacts_json = json.dumps(
        framework_data.get("artefacts", {}), ensure_ascii=False
    )
    framework.risks_json = json.dumps(
        framework_data.get("risks", []), ensure_ascii=False
    )
    framework.escalation_json = json.dumps(
        framework_data.get("escalation", []), ensure_ascii=False
    )

    framework.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(framework)

    return {
        "success": True,
        "message": "Framework updated successfully",
        "framework_id": framework.id,
    }


# 新增：删除 framework
@router.delete("/{framework_id}")
def delete_framework(
    framework_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    删除 framework

    只能删除自己创建的 framework
    """

    framework = (
        db.query(Framework)
        .filter(Framework.id == framework_id, Framework.creator_id == user_id)
        .first()
    )

    if not framework:
        raise HTTPException(
            status_code=404, detail="Framework not found or you don't have permission"
        )

    db.delete(framework)
    db.commit()

    return {"success": True, "message": "Framework deleted successfully"}


# Export endpoint
@router.post("/export-markdown")
async def export_markdown_from_data(framework_data: dict):
    """
    接收完整的框架数据，生成并返回 Markdown 文件

    Request Body:
    {
      "id": "framework-xxx",
      "metadata": {...},
      "steps": [...],
      "artefacts": {...},
      "risks": [...],
      "escalation": [...]
    }
    """
    try:
        # 生成 Markdown 内容
        markdown_content = generate_markdown(framework_data)

        # 生成文件名
        title = framework_data.get("metadata", {}).get("title", "framework")
        # 清理文件名（移除特殊字符）
        safe_title = "".join(
            c if c.isalnum() or c in (" ", "-", "_") else "_" for c in title
        )
        filename = f"{safe_title.replace(' ', '_')}.md"

        # 返回文件
        return Response(
            content=markdown_content,
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        import traceback

        print("❌ Export Error:")
        print(traceback.format_exc())

        raise HTTPException(
            status_code=500, detail=f"Failed to export markdown: {str(e)}"
        )


@router.post("/regenerate")
async def regenerate_framework(request: RegenerateRequest):
    """
    重新生成框架（用户编辑后的改进）

    用户可以选择：
    1. Cloud Processing (OpenAI) - 快速、高质量、保留所有用户编辑
    2. Local Processing (Ollama) - 隐私优先、可能丢失细节
    """
    try:
        if request.use_local:
            # ========== 本地处理模式 ==========
            print("🔒 Using Local Processing (Ollama)")

            # 检查 Ollama 是否运行
            import requests

            try:
                requests.get("http://127.0.0.1:11434", timeout=2)
            except requests.exceptions.RequestException:
                raise HTTPException(
                    status_code=503,
                    detail="Ollama is not running. Please start Ollama: 'ollama serve'",
                )

            # 步骤 1: 将用户编辑的框架转换回文本（模拟 reverse engineering）
            framework_text = convert_framework_to_text(request.framework)

            # 步骤 2: Local LLM 重新提取 metadata
            from llm_local import extract_seed_from_text, OllamaClient

            llm = OllamaClient(model="llama3.1:8b", host="http://127.0.0.1:11434")
            metadata = extract_seed_from_text(framework_text, llm=llm)

            # 步骤 3: Global LLM 生成新框架（或使用 mock）
            api_key, base_url = resolve_api_settings(None, None)
            if api_key:
                from llm_global import call_openai_framework

                improved_framework = call_openai_framework(
                    md=metadata,
                    model="gpt-4o",
                    timeout=180,
                    api_key=api_key,
                    base_url=base_url,
                    verbose=True,
                )
            else:
                from llm_global import build_mock_framework

                improved_framework = build_mock_framework(metadata)

            return {
                "success": True,
                "framework": improved_framework,
                "method": "local",
                "message": "Framework regenerated using local processing",
            }

        else:
            # ========== 云端处理模式（推荐）==========
            print("☁️ Using Cloud Processing (OpenAI)")

            # 检查 API key
            api_key, base_url = resolve_api_settings(None, None)
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="OpenAI API key not configured. Please use local processing instead.",
                )

            # 直接发送完整框架给 OpenAI 进行改进
            from openai import OpenAI
            import httpx
            import os

            # 清除代理环境变量
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

                # 构建 prompt
                system_prompt = (
                    "You are a framework improvement assistant. "
                    "The user has edited a framework and wants you to review and improve it. "
                    "CRITICAL: Keep ALL user modifications intact. Only fill in missing parts and suggest improvements. "
                    "Return the improved framework as valid JSON matching the original structure."
                )

                user_prompt = (
                    "Here is a framework that the user has edited:\n\n"
                    f"{json.dumps(request.framework, indent=2)}\n\n"
                    "Please:\n"
                    "1. **Keep all user modifications intact** (especially steps, risks, escalation)\n"
                    "2. Fill in missing sections if any:\n"
                    "   - Add 'trigger_context' or 'pov' if missing\n"
                    "   - Add 'inputs_required' if missing\n"
                    "   - Add 'research_required' if missing\n"
                    "   - Add 'attribution' if appropriate\n"
                    "   - Add 'quadrant' (QI/QII/QIII/QIV) if appropriate\n"
                    "3. Ensure consistency across all sections\n"
                    "4. Improve descriptions to be more specific and actionable\n"
                    "5. Return the complete improved framework as JSON\n\n"
                    "IMPORTANT: Do NOT remove or significantly change user's content. Only enhance and complete."
                )

                print("📤 Sending request to OpenAI...")
                response = client.chat.completions.create(
                    model="gpt-4o",
                    temperature=0.3,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                )

                result_text = response.choices[0].message.content.strip()
                print("📥 Received response from OpenAI")

                # 解析 JSON
                from llm_global import robust_json_loads

                improved_framework = robust_json_loads(result_text)

                return {
                    "success": True,
                    "framework": improved_framework,
                    "method": "cloud",
                    "message": "Framework regenerated using cloud processing",
                }

            finally:
                # 恢复代理设置
                for key, value in original_proxies.items():
                    os.environ[key] = value

                # 关闭 HTTP client
                if "http_client" in locals():
                    try:
                        http_client.close()
                    except:
                        pass

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        print("❌ Regeneration Error:")
        print(traceback.format_exc())

        raise HTTPException(
            status_code=500, detail=f"Failed to regenerate framework: {str(e)}"
        )


def convert_framework_to_text(framework: dict) -> str:
    """
    将框架 JSON 转换回文本（用于本地 LLM 处理）
    这是一个简化版本，用于模拟原始文档
    """
    parts = []

    # Title
    metadata = framework.get("metadata", {})
    title = metadata.get("title", "Framework")
    parts.append(f"# {title}\n")

    # Steps
    steps = framework.get("steps", [])
    if steps:
        parts.append("\n## Framework Steps\n")
        for step in steps:
            parts.append(f"\n### {step.get('name', 'Step')}")
            parts.append(step.get("description", ""))
            sub_steps = step.get("subSteps", [])
            if sub_steps:
                for sub in sub_steps:
                    parts.append(f"- {sub}")

    # Risks
    risks = framework.get("risks", [])
    if risks:
        parts.append("\n## Risks\n")
        for risk in risks:
            parts.append(f"\n### {risk.get('title', 'Risk')}")
            parts.append(risk.get("description", ""))

    # Escalation
    escalation = framework.get("escalation", [])
    if escalation:
        parts.append("\n## Escalation Points\n")
        for esc in escalation:
            parts.append(f"- When: {esc.get('trigger', 'Unknown')}")
            parts.append(f"  Action: {esc.get('action', 'Escalate')}")

    return "\n".join(parts)


# ============= AI Merge Endpoint =============


class AIMergeRequest(BaseModel):
    """AI 合并请求模型"""

    frameworks: List[dict]  # 用户选中的多个 frameworks


@router.post("/ai-merge")
async def ai_merge_frameworks(request: AIMergeRequest):
    """
    使用 AI 智能合并多个 frameworks

    临时版本：不需要认证，直接返回测试结果
    """
    try:
        # 验证输入
        if not request.frameworks or len(request.frameworks) < 2:
            raise HTTPException(
                status_code=400, detail="Please select at least 2 frameworks to merge"
            )

        if len(request.frameworks) > 10:
            raise HTTPException(
                status_code=400, detail="Cannot merge more than 10 frameworks at once"
            )

        print(f"🔀 AI Merge: Merging {len(request.frameworks)} frameworks")

        # 检查 API key
        api_key, base_url = resolve_api_settings(None, None)
        if not api_key:
            # 如果没有 API key，返回一个简单的合并结果
            print("⚠️ No API key, returning mock merge")
            return {
                "success": True,
                "merged_framework": {
                    "name": "Merged Framework (Mock)",
                    "description": "This is a test merge of "
                    + str(len(request.frameworks))
                    + " frameworks.",
                    "subSteps": [
                        "Combined step 1",
                        "Combined step 2",
                        "Combined step 3",
                    ],
                },
            }

        # 准备合并 prompt
        frameworks_text = []
        for i, fw in enumerate(request.frameworks, 1):
            frameworks_text.append(f"\n{'='*60}")
            frameworks_text.append(f"FRAMEWORK {i}: {fw.get('name', 'Unnamed')}")
            frameworks_text.append(f"{'='*60}\n")

            # Description
            if fw.get("description"):
                frameworks_text.append(f"Description:\n{fw['description']}\n")

            # Sub-steps
            if fw.get("subSteps"):
                frameworks_text.append("Sub-steps:")
                for j, step in enumerate(fw["subSteps"], 1):
                    frameworks_text.append(f"  {j}. {step}")
                frameworks_text.append("")

        combined_text = "\n".join(frameworks_text)

        # 调用 OpenAI
        from openai import OpenAI
        import httpx
        import os

        # 清除代理环境变量
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
            # OpenAI 2.6.1 自动处理重试和超时
            if base_url:
                client = OpenAI(
                    api_key=api_key,
                    base_url=base_url,
                    timeout=300.0,  # 5分钟超时
                    max_retries=2,
                )
            else:
                client = OpenAI(api_key=api_key, timeout=300.0, max_retries=2)

            # 构建 prompt
            system_prompt = (
                "You are a framework merging assistant. "
                "Your task is to intelligently combine multiple frameworks into one cohesive framework. "
                "You should:\n"
                "1. Identify common themes and consolidate similar content\n"
                "2. Remove redundancy while preserving unique insights from each framework\n"
                "3. Organize the merged content logically\n"
                "4. Create a clear, comprehensive description that captures all key aspects\n"
                "5. Combine sub-steps in a logical order\n"
                "6. Generate an appropriate name for the merged framework\n\n"
                "Return ONLY a valid JSON object with this structure:\n"
                "{\n"
                '  "name": "Merged Framework Name",\n'
                '  "description": "Comprehensive description...",\n'
                '  "subSteps": ["Step 1", "Step 2", ...]\n'
                "}"
            )

            user_prompt = (
                f"Please merge these {len(request.frameworks)} frameworks into one:\n\n"
                f"{combined_text}\n\n"
                "Create a new framework that:\n"
                "- Captures the essence of all input frameworks\n"
                "- Eliminates redundancy and contradictions\n"
                "- Provides a clear, actionable structure\n"
                "- Has a descriptive name that reflects the merged content\n\n"
                "Return the merged framework as JSON."
            )

            print("📤 Sending merge request to OpenAI...")
            response = client.chat.completions.create(
                model="gpt-4o",
                temperature=0.4,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )

            result_text = response.choices[0].message.content.strip()
            print("📥 Received response from OpenAI")

            # 解析 JSON
            from llm_global import robust_json_loads

            merged_framework = robust_json_loads(result_text)

            # 确保必需字段存在
            if not merged_framework.get("name"):
                merged_framework["name"] = "AI Merged Framework"

            if not merged_framework.get("description"):
                merged_framework["description"] = ""

            if not merged_framework.get("subSteps"):
                merged_framework["subSteps"] = []

            print(f"✅ Successfully merged into: {merged_framework['name']}")

            return {"success": True, "merged_framework": merged_framework}

        finally:
            # 恢复代理设置
            for key, value in original_proxies.items():
                os.environ[key] = value

            # 关闭 HTTP client
            if "http_client" in locals():
                try:
                    http_client.close()
                except:
                    pass

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        print("❌ AI Merge Error:")
        print(traceback.format_exc())

        return {"success": False, "error": str(e)}
