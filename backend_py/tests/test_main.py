"""
just for example
"""

import pytest


def test_example():
    assert 1 + 1 == 2


def test_another_example():
    result = "hello"
    assert result == "hello"
    assert len(result) == 5


# 如果你有API，可以这样测试
# def test_api_endpoint():
#     from main import app
#     client = app.test_client()
#     response = client.get('/api/endpoint')
#     assert response.status_code == 200
