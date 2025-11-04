from __future__ import annotations
import re
from pathlib import Path

_name_re = re.compile(r"[^A-Za-z0-9._-]+")


def safename(name: str) -> str:
    # keep basename and normalize
    return _name_re.sub("_", Path(name).name)


async def savebytes(data: bytes, filename: str) -> str | None:
    # storage
    _ = safename(filename)
    return None


# Some tests, code still patch, save via save_bytes
async def save_bytes(data: bytes, filename: str) -> str | None:
    return await savebytes(data, filename)


__all__ = ["safename", "savebytes", "save_bytes"]
