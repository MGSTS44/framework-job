import sys

print("=" * 50)
print("环境诊断报告")
print("=" * 50)

# Python 版本
print(f"\n🐍 Python 版本: {sys.version}")

# OpenAI SDK 版本
try:
    import openai

    print(f"✅ OpenAI SDK 版本: {openai.__version__}")
except ImportError:
    print("❌ OpenAI SDK 未安装")
except AttributeError:
    print("⚠️ OpenAI SDK 版本未知")

# httpx 版本
try:
    import httpx

    print(f"✅ httpx 版本: {httpx.__version__}")
except ImportError:
    print("❌ httpx 未安装")
except AttributeError:
    print("⚠️ httpx 版本未知")

# requests 版本
try:
    import requests

    print(f"✅ requests 版本: {requests.__version__}")
except ImportError:
    print("❌ requests 未安装")

print("\n" + "=" * 50)
print("诊断建议")
print("=" * 50)

# 检查兼容性
try:
    import openai
    import httpx

    openai_version = tuple(map(int, openai.__version__.split(".")[:2]))
    httpx_version = tuple(map(int, httpx.__version__.split(".")[:2]))

    print(f"\nOpenAI {openai.__version__} + httpx {httpx.__version__}")

    # OpenAI 1.10+ 需要 httpx 0.24+
    if openai_version >= (1, 10) and httpx_version < (0, 24):
        print("⚠️ 版本不兼容！OpenAI 1.10+ 需要 httpx 0.24+")
        print("\n📝 解决方案 1（推荐）：升级 httpx")
        print("   pip install --upgrade httpx")
        print("\n📝 解决方案 2：降级 OpenAI")
        print("   pip install openai==1.3.0")
    else:
        print("✅ 版本组合看起来是兼容的")
        print("⚠️ 问题可能在于系统代理设置")

except Exception as e:
    print(f"⚠️ 无法进行版本兼容性检查: {e}")

print("\n" + "=" * 50)
