#!/bin/bash

# Strava热力图代理服务器重启脚本
# 使用方法: ./app.sh [start|stop|status|logs]

APP_NAME="strava-utility"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$APP_DIR/../$APP_NAME.pid"
LOG_FILE="$APP_DIR/../$APP_NAME.log"

# 日志函数
log_info() {
    echo -e "[INFO] $1"
}

log_success() {
    echo -e "[SUCCESS] $1"
}

log_warning() {
    echo -e "[WARNING] $1"
}

log_error() {
    echo -e "[ERROR] $1"
}

# 检查应用是否正在运行
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            # PID文件存在但进程不存在，清理PID文件
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# 获取进程ID
get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    else
        echo ""
    fi
}

# 启动应用（如果已在运行则自动重启）
start_app() {
    if is_running; then
        log_info "$APP_NAME 已经在运行中 (PID: $(get_pid))，正在重启..."
        stop_app
        if [ $? -ne 0 ]; then
            log_error "停止应用失败，无法重启"
            return 1
        fi
        sleep 2
    else
        log_info "正在启动 $APP_NAME..."
    fi
    
    # 检查环境变量文件
    if [ ! -f ".env" ]; then
        log_warning "未找到 .env 文件，请确保环境变量已正确配置"
        return 1
    fi
    
    # 启动应用
    cd "$APP_DIR"
    nohup node index.js > "$LOG_FILE" 2>&1 &
    local pid=$!
    
    # 保存PID
    echo "PID: $pid"
    echo $pid > "$PID_FILE"
    
    # 等待一下检查是否启动成功
    sleep 5
    if kill -0 "$pid" 2>/dev/null; then
        log_success "$APP_NAME 启动成功 (PID: $pid)"
        log_info "日志文件: $LOG_FILE"
        return 0
    else
        log_error "$APP_NAME 启动失败"
        rm -f "$PID_FILE"
        return 1
    fi
}

# 停止应用
stop_app() {
    log_info "正在停止 $APP_NAME..."
    
    if ! is_running; then
        log_warning "$APP_NAME 未在运行"
        return 0
    fi
    
    local pid=$(get_pid)
    
    # 尝试优雅停止
    log_info "发送 SIGTERM 信号到进程 $pid..."
    kill -TERM "$pid"
    
    # 等待进程结束
    local count=0
    while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    echo
    
    # 如果进程仍在运行，强制杀死
    if kill -0 "$pid" 2>/dev/null; then
        log_warning "进程未响应 SIGTERM，发送 SIGKILL 信号..."
        kill -KILL "$pid"
        sleep 1
    fi
    
    # 清理PID文件
    rm -f "$PID_FILE"
    
    if ! kill -0 "$pid" 2>/dev/null; then
        log_success "$APP_NAME 已停止"
        return 0
    else
        log_error "无法停止 $APP_NAME"
        return 1
    fi
}



# 显示应用状态
show_status() {
    if is_running; then
        local pid=$(get_pid)
        local uptime=""
        
        # 获取运行时间
        if [ -n "$pid" ]; then
            local start_time=$(ps -o lstart= -p "$pid" 2>/dev/null)
            if [ -n "$start_time" ]; then
                uptime=" (启动时间: $start_time)"
            fi
        fi
        
        log_success "$APP_NAME 正在运行 (PID: $pid)$uptime"
        
        # 显示内存和CPU使用情况
        if [ -n "$pid" ]; then
            local mem_cpu=$(ps -o pid,ppid,%cpu,%mem,etime,command -p "$pid" 2>/dev/null | tail -n +2)
            if [ -n "$mem_cpu" ]; then
                echo "进程信息:"
                echo "$mem_cpu" | sed 's/^/  /'
            fi
        fi
    else
        log_warning "$APP_NAME 未在运行"
    fi
    
    # 显示端口占用情况
    local port=$(grep -o 'PORT.*=.*[0-9]\+' index.js 2>/dev/null | grep -o '[0-9]\+' | head -1)
    if [ -n "$port" ]; then
        local port_status=$(lsof -i :$port 2>/dev/null)
        if [ -n "$port_status" ]; then
            echo "端口 $port 占用情况:"
            echo "$port_status" | sed 's/^/  /'
        else
            echo "端口 $port 未被占用"
        fi
    fi
}

# 显示日志
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        log_info "显示 $APP_NAME 日志 (最后50行):"
        echo "----------------------------------------"
        tail -n 50 "$LOG_FILE"
        echo "----------------------------------------"
        log_info "完整日志文件: $LOG_FILE"
    else
        log_warning "日志文件不存在: $LOG_FILE"
    fi
}

# 清理日志
clean_logs() {
    if [ -f "$LOG_FILE" ]; then
        log_info "正在清理日志文件..."
        > "$LOG_FILE"
        log_success "日志已清理"
    else
        log_warning "日志文件不存在"
    fi
}

# 显示帮助信息
show_help() {
    echo "使用方法: $0 [命令]"
    echo ""
    echo "可用命令:"
    echo "  start     启动应用（如果已在运行则自动重启）"
    echo "  stop      停止应用"
    echo "  status    显示应用状态"
    echo "  logs      显示应用日志"
    echo "  clean     清理日志文件"
    echo "  help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start      # 启动应用（自动重启）"
    echo "  $0 status     # 查看状态"
}

# 主函数
main() {
    case "${1:-help}" in
        start)
            start_app
            ;;
        stop)
            stop_app
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        clean)
            clean_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 检查是否在正确的目录
if [ ! -f "index.js" ] || [ ! -f "package.json" ]; then
    log_error "请在 $APP_NAME 项目根目录下运行此脚本"
    exit 1
fi

# 执行主函数
main "$@"
