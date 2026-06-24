#!/bin/bash
#
# TopRouter Manager
# 1=start(skip) 2=build+start 3=stop 4=status
#

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; GRAY='\033[0;37m'; NC='\033[0m'

APP_DIR="/home/sirobo/toprouter"
LOG_DIR="$APP_DIR/log"
PORT=20128

print_header() {
    echo ""; echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║      TopRouter Manager                 ║${NC}"
    echo -e "${CYAN}║    Port: 20128                         ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"; echo ""
}

port_listening() { ss -tlnp 2>/dev/null | grep -q ":$1 "; }

is_running() {
    command -v pm2 &>/dev/null || return 1
    pm2 list 2>/dev/null | grep -q "toprouter.*online" && return 0
    return 1
}

stop_all() {
    echo -e "${YELLOW}Menghentikan top Router...${NC}"; echo ""
    command -v pm2 &>/dev/null || { echo -e "   ${RED}ERROR${NC} - pm2 tidak ditemukan"; return 1; }
    pm2 delete top Router 2>/dev/null && echo -e "   ${GREEN}✓${NC} TopRouter dihentikan" || echo -e "   ${GRAY}○${NC} TopRouter tidak berjalan"
    pm2 save
    sleep 2
    echo ""; echo -e "${GREEN}TopRouter dihentikan!${NC}"; echo ""
}

build_app() {
    echo -e "${YELLOW}Building TopRouter...${NC}"
    cd "$APP_DIR"
    npm run build
    if [ $? -eq 0 ]; then echo -e "   ${GREEN}✓${NC} Build berhasil"; else echo -e "   ${RED}✗${NC} Build gagal"; exit 1; fi
}

do_start_services() {
    mkdir -p "$LOG_DIR"
    echo -e "${YELLOW}Starting TopRouter...${NC}"
    cd "$APP_DIR"
    pm2 start ecosystem.config.cjs 2>&1
    local health_ok=false
    for i in $(seq 1 10); do
        if curl -sf http://localhost:${PORT} >/dev/null 2>&1; then
            health_ok=true
            break
        fi
        sleep 2
    done
    if $health_ok; then
        echo -e "   ${GREEN}✓${NC} TopRouter started on port $PORT (health OK)"
    else
        echo -e "   ${RED}✗${NC} Health check gagal — cek log"
    fi
    pm2 save
    echo ""
}

do_start() {
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Memulai TopRouter${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"; echo ""

    if is_running; then
        echo -e "   ${GREEN}✓${NC} TopRouter sudah aktif — dilewati"; echo ""
        return 0
    fi

    stop_all
    do_start_services
}

build_and_start() {
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Memulai TopRouter (Build + Start)${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"; echo ""

    stop_all; build_app; echo ""
    do_start_services
}

check_status() {
    echo -e "${YELLOW}Status Server:${NC}"; echo ""
    echo -e "${YELLOW}PM2 Processes:${NC}"
    pm2 list 2>/dev/null | grep top Router || echo -e "   ${GRAY}○${NC} Tidak ada proses top Router"
    echo ""; echo -e "${YELLOW}Port Status:${NC}"
    port_listening $PORT && echo -e "   ${GREEN}✓${NC} Port $PORT: LISTENING" || echo -e "   ${RED}✗${NC} Port $PORT: NOT LISTENING"
    echo ""
}

show_menu() {
    echo -e "${CYAN}Pilih opsi:${NC}"; echo ""
    echo "  1) Start (skip kalau sudah jalan)"
    echo "  2) Build + Start"
    echo "  3) Stop"
    echo "  4) Cek status"
    echo ""; read -rp "Masukkan pilihan [1-4]: " choice
    case $choice in
        1) do_start ;; 2) build_and_start ;; 3) stop_all ;; 4) check_status ;;
        *) echo -e "${RED}Pilihan tidak valid${NC}" ;;
    esac
}

print_header
case "$1" in
    1|start)  do_start ;;
    2|build)  build_and_start ;;
    3|stop)   stop_all ;;
    4|status) check_status ;;
    *)        show_menu ;;
esac
