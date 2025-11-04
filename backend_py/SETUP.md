# 后端启动指南（最精简版）

## 🚀 快速启动

### 1. 安装依赖
```bash
cd backend_py
pip install fastapi uvicorn python-multipart
```

或者使用 requirements.txt：
```bash
pip install -r requirements.txt
```

### 2. 启动后端
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 🔧 前后端同时运行

### 在 VSCode 里开两个终端：

**终端 1（后端）：**
```bash
cd backend_py
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

看到 `Application startup complete.` 表示成功！

**终端 2（前端）：**
```bash
cd frontend
npm run dev
```
