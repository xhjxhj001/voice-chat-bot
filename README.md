# voice-chat-bot (语音聊天机器人)

一个集成了语音识别、大语言模型和文本转语音的会话式AI应用。用户可以通过语音与AI进行对话，AI也能通过语音回复。

## 🌟 功能特点

- 💬 实时语音对话：支持用户语音输入和AI语音输出
- 🔄 文本对话模式：同时支持传统的文本输入方式
- 🧠 多模型支持：集成了多种大语言模型（OpenAI、Ollama等）
- 🗣️ 多种语音合成：支持EdgeTTS和达观声音（DashScope）
- 🌈 简洁现代的界面：基于Next.js和Tailwind CSS构建的响应式UI
- 💾 对话历史保存：自动保存对话历史记录

## 🛠️ 技术栈

### 前端
- Next.js 14 (React框架)
- TypeScript
- Tailwind CSS (样式)
- SSE (Server-Sent Events) 用于流式响应

### 后端
- FastAPI (Python后端框架)
- Whisper (OpenAI的语音识别模型)
- EdgeTTS/DashScope (文本转语音)
- OpenAI API/Ollama (大语言模型接口)

## 📋 系统要求

- Node.js 18+ (前端)
- Python 3.8+ (后端)
- 可选：Ollama本地部署（如果使用本地模型）

## 🚀 快速开始

### 安装和设置

1. 克隆仓库
```bash
git clone https://github.com/yourusername/voice-chat-bot.git
cd voice-chat-bot
```

2. 设置后端
```bash
cd backend
# 创建并激活Python虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # 在Windows上使用 venv\Scripts\activate
# 安装依赖
pip install -r requirements.txt
# 配置环境变量
cp .env.example .env
# 编辑.env文件，填入你的API密钥
```

3. 设置前端
```bash
cd ../frontend
# 安装依赖
npm install
# 配置环境变量
cp .env.example .env.local
```

### 运行应用

1. 启动后端
```bash
cd backend
uvicorn main:app --reload
```

2. 启动前端
```bash
cd ../frontend
npm run dev
```

3. 在浏览器中访问 http://localhost:3000

## 🔧 配置选项

### 后端环境变量 (.env)

- `OPENAI_API_KEY`: OpenAI API密钥
- `OPENAI_API_BASIC`: OpenAI API基础URL
- `OPENAI_MODEL_NAME`: 使用的OpenAI模型名称
- `OLLAMA_API_KEY`: Ollama API密钥
- `OLLAMA_API_BASIC`: Ollama API基础URL
- `OLLAMA_MODEL_NAME`: 使用的Ollama模型名称
- `DASHSCOPE_API_KEY`:阿里云百炼数据API密钥（用于语音合成）
- `TTS_SERVICE`: 使用的文本转语音服务（"edge_tts"或"cosyvoice"）
- `MODEL_SERVICE`: 使用的模型服务（"openai"或"ollama"）

### 前端环境变量 (.env.local)

- `NEXT_PUBLIC_API_BASE_URL`: 后端API的基础URL

## 📂 项目结构

```
voice-chat-bot/
├── backend/               # 后端代码
│   ├── main.py            # 主应用入口
│   ├── text2voice.py      # 文本转语音服务
│   ├── ollama_chat.py     # Ollama模型集成
│   ├── requirements.txt   # Python依赖
│   └── temp_audio/        # 临时音频文件存储
├── frontend/              # 前端代码
│   ├── app/               # Next.js应用
│   │   ├── components/    # React组件
│   │   └── page.tsx       # 主页面
│   ├── public/            # 静态资源
│   └── package.json       # Node.js依赖
└── deploy.sh              # 一键部署脚本
```

## 📝 使用说明

1. 访问应用后，允许浏览器使用麦克风
2. 点击录音按钮开始语音对话
3. 说话后释放按钮，系统会自动处理您的语音并生成回复
4. 也可以使用文本输入框直接输入文字
5. 可以在设置面板中选择不同的模型和语音选项

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出新功能建议！请遵循以下步骤：

1. Fork这个仓库
2. 创建一个新的分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建一个Pull Request

## 📄 许可证

本项目采用MIT许可证 - 详见LICENSE文件 