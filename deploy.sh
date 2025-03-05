#!/bin/bash

# 颜色设置
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[Voice-Chat-Bot]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装。请安装后再运行此脚本。"
        exit 1
    fi
}

# 检查基本依赖
print_message "检查基本依赖..."
check_command "node"
check_command "npm"
check_command "python3"
check_command "pip3"

# 检查Node.js版本
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)
if [ $NODE_MAJOR_VERSION -lt 18 ]; then
    print_warning "Node.js版本 ($NODE_VERSION) 低于推荐版本 (18+)。可能会遇到兼容性问题。"
fi

# 检查Python版本
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d ' ' -f 2)
PYTHON_MAJOR_VERSION=$(echo $PYTHON_VERSION | cut -d '.' -f 1)
PYTHON_MINOR_VERSION=$(echo $PYTHON_VERSION | cut -d '.' -f 2)
if [ $PYTHON_MAJOR_VERSION -lt 3 ] || ([ $PYTHON_MAJOR_VERSION -eq 3 ] && [ $PYTHON_MINOR_VERSION -lt 8 ]); then
    print_warning "Python版本 ($PYTHON_VERSION) 低于推荐版本 (3.8+)。可能会遇到兼容性问题。"
fi

# 设置虚拟环境
setup_backend() {
    print_message "设置后端..."
    cd backend

    # 检查.env文件
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            print_message "创建.env文件从.env.example模板..."
            cp .env.example .env
            print_warning "请编辑.env文件，填入您的API密钥"
        else
            print_error "找不到.env.example文件。请手动创建.env文件。"
            exit 1
        fi
    fi

    # 创建虚拟环境
    print_message "创建Python虚拟环境..."
    python3 -m venv venv
    
    # 激活虚拟环境
    if [ -f venv/bin/activate ]; then
        source venv/bin/activate
    elif [ -f venv/Scripts/activate ]; then
        source venv/Scripts/activate
    else
        print_error "无法激活虚拟环境。请检查Python安装。"
        exit 1
    fi
    
    # 安装依赖
    print_message "安装Python依赖..."
    pip install -r requirements.txt
    
    cd ..
}

# 设置前端
setup_frontend() {
    print_message "设置前端..."
    cd frontend
    
    # 检查.env.local文件
    if [ ! -f .env.local ]; then
        if [ -f .env.example ]; then
            print_message "创建.env.local文件从.env.example模板..."
            cp .env.example .env.local
        else
            print_error "找不到.env.example文件。请手动创建.env.local文件。"
            exit 1
        fi
    fi
    
    # 安装依赖
    print_message "安装Node.js依赖..."
    npm install
    
    cd ..
}

# 构建前端
build_frontend() {
    print_message "构建前端生产版本..."
    cd frontend
    npm run build
    cd ..
}

# 启动服务
start_services() {
    # 启动后端
    print_message "启动后端服务..."
    cd backend
    source venv/bin/activate
    uvicorn main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    cd ..
    
    # 等待后端启动
    print_message "等待后端服务启动..."
    sleep 5
    
    # 启动前端
    print_message "启动前端服务..."
    cd frontend
    npm start &
    FRONTEND_PID=$!
    cd ..
    
    print_message "服务已启动！"
    print_message "前端: http://localhost:3000"
    print_message "后端: http://localhost:8000"
    print_message "按Ctrl+C停止服务"
    
    # 等待按键并捕获Ctrl+C
    trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
    wait
}

# 主函数
main() {
    print_message "开始部署语音聊天机器人..."
    
    # 询问用户是开发模式还是生产模式
    read -p "请选择模式 [1: 开发模式, 2: 生产模式]: " mode
    
    setup_backend
    setup_frontend
    
    if [ "$mode" = "2" ]; then
        build_frontend
    fi
    
    start_services
}

# 执行主函数
main 