# STAR TREK LCARS SERVER MONITOR

`tvserver` 的本地 HDMI 服务器状态显示。界面固定轮播四页：SYSTEM、MIRAKURUN、EPGSTATION、JELLYFIN；默认每页 15 秒、完整周期 60 秒。

本系统只读监控。它不连接 Docker Socket，不读取或控制 Threadfin，不创建/取消 EPGStation 预约，也不控制 Mirakurun、Jellyfin 或录制。

## 架构

```text
7-inch HDMI → Xorg / Openbox → Epiphany web-application fullscreen → LCARS SPA
                                                   ↓ localhost:8765
                                              Python backend
                              SYSTEM / Mirakurun / EPGStation / Jellyfin
```

后端仅监听 `127.0.0.1:8765`。Jellyfin Key 只由 systemd credential 提供给低权限后端；不会进入浏览器、Git、HTML、JavaScript 或日志。

## 目录

```text
/opt/lcars-monitor/              application and Git repository
/etc/lcars-monitor/jellyfin.env  root-only Jellyfin credential (0600)
/etc/systemd/system/lcars-*.service
/var/lib/lcars-monitor/          unprivileged browser profile
```

## 服务与日常操作

```bash
sudo systemctl status lcars-backend lcars-kiosk
sudo systemctl restart lcars-backend
sudo systemctl restart lcars-kiosk
sudo systemctl stop lcars-kiosk
sudo systemctl start lcars-kiosk
journalctl -u lcars-backend -u lcars-kiosk -f
```

`lcars-backend` 以无登录 shell 的 `lcars` 用户运行，失败后 10 秒重试。`lcars-kiosk` 的 Xorg 必须打开 VT7，因此 unit 由 root 启动；实际 Openbox、Epiphany 和浏览器子进程仍以 `lcars` 运行。kiosk 异常退出后 15 秒重试。

开机自启已启用：

```bash
systemctl is-enabled lcars-backend lcars-kiosk
```

## Jellyfin Key

在 Jellyfin Dashboard 创建 `lcars-monitor` Key 后，仅由管理员写入 `/etc/lcars-monitor/jellyfin.env`：

```text
JELLYFIN_API_KEY=...
```

权限必须保持目录 `0700 root:root`、文件 `0600 root:root`。变更 Key 后执行：

```bash
sudo systemctl restart lcars-backend
```

## HDMI 与显示器排障

- 当前已验证输出为 `1024×600 @ 59.82 Hz`。
- kiosk 会话内已禁用 screensaver 与 DPMS；这不影响显示器物理背光开关。
- 关闭/重新开启物理背光后，后端继续运行；若 kiosk 未恢复，执行 `sudo systemctl restart lcars-kiosk`。
- 如物理开关导致 HDMI disconnect，检查：

```bash
cat /sys/class/drm/card1-HDMI-A-1/status
journalctl -b -k | rg -i 'hdmi|drm|i915'
```

## API 排障

```bash
curl http://127.0.0.1:8765/api/status
curl http://127.0.0.1:40772/api/tuners
curl 'http://127.0.0.1:8888/api/recording?isHalfWidth=false'
```

Jellyfin 发生认证或会话问题时，LCARS 只显示 `UNAVAILABLE` 或 `NO ACTIVE PLAYBACK`；不会影响播放。直播没有可靠总时长时显示 `LIVE STREAM`。

## 更新与备份

项目修改应在 `/opt/lcars-monitor` 内提交 Git；永远不要提交 `/etc/lcars-monitor/jellyfin.env`。代码更新后执行：

```bash
cd /opt/lcars-monitor
git status
sudo systemctl restart lcars-backend lcars-kiosk
```

## 卸载与回滚

```bash
sudo systemctl disable --now lcars-kiosk lcars-backend
sudo rm /etc/systemd/system/lcars-kiosk.service
sudo rm /etc/systemd/system/lcars-backend.service
sudo systemctl daemon-reload
```

之后才可删除 `/opt/lcars-monitor`、`/var/lib/lcars-monitor`、`/etc/lcars-monitor` 和 `lcars` 用户。不要自动移除共享的 Xorg、字体或浏览器软件包。绝对不要删除 Docker、Threadfin、Mirakurun、EPGStation、Jellyfin、录制盘或媒体数据。
