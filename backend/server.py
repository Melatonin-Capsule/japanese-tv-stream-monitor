#!/usr/bin/env python3
"""Local-only LCARS status API.  It performs read-only requests and reads."""
from __future__ import annotations

import json
import os
import platform
import socket
import time
import urllib.error
import urllib.request
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
HOST, PORT = "127.0.0.1", int(os.getenv("LCARS_PORT", "8765"))
TIMEOUT = 3
JELLYFIN_URL = os.getenv("JELLYFIN_URL", "http://127.0.0.1:8096").rstrip("/")
JELLYFIN_API_KEY = os.getenv("JELLYFIN_API_KEY", "")
previous_cpu: list[tuple[int, int]] | None = None
previous_net: tuple[float, int, int] | None = None


def now() -> str:
    return time.strftime("%H:%M:%S")


def unavailable(message: str) -> dict:
    return {"status": "UNAVAILABLE", "last_update": None, "error": message}


def get_json(url: str, headers: dict | None = None) -> object:
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.load(response)


def cpu_snapshot() -> list[float]:
    global previous_cpu
    lines = Path("/proc/stat").read_text().splitlines()
    samples = []
    for line in lines:
        if not line.startswith("cpu"):
            break
        values = [int(value) for value in line.split()[1:]]
        total, idle = sum(values), values[3] + (values[4] if len(values) > 4 else 0)
        samples.append((total, idle))
    result = []
    if previous_cpu:
        for (total, idle), (old_total, old_idle) in zip(samples[1:], previous_cpu[1:]):
            total_delta, idle_delta = total - old_total, idle - old_idle
            result.append(round(100 * (1 - idle_delta / total_delta), 1) if total_delta else 0)
    previous_cpu = samples
    return result


def memory() -> dict:
    values = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        key, value = line.split(":", 1)
        values[key] = int(value.split()[0]) * 1024
    total, available = values["MemTotal"], values["MemAvailable"]
    return {"total": total, "available": available, "used": total - available,
            "percent": round((total - available) * 100 / total, 1),
            "swap_total": values.get("SwapTotal", 0),
            "swap_used": values.get("SwapTotal", 0) - values.get("SwapFree", 0)}


def disk(path: str) -> dict:
    stat = os.statvfs(path)
    total, free = stat.f_blocks * stat.f_frsize, stat.f_bavail * stat.f_frsize
    return {"path": path, "total": total, "free": free, "used": total - free,
            "percent": round((total - free) * 100 / total, 1)}


def network() -> dict:
    global previous_net
    received = sent = 0
    for line in Path("/proc/net/dev").read_text().splitlines()[2:]:
        _, data = line.split(":", 1)
        fields = data.split()
        received += int(fields[0]); sent += int(fields[8])
    stamp = time.monotonic()
    rates = {"rx": None, "tx": None}
    if previous_net:
        old_stamp, old_rx, old_tx = previous_net
        elapsed = stamp - old_stamp
        if elapsed:
            rates = {"rx": round((received - old_rx) / elapsed, 1), "tx": round((sent - old_tx) / elapsed, 1)}
    previous_net = (stamp, received, sent)
    return rates


def temperature() -> float | None:
    fallback = None
    for sensor in Path("/sys/class/hwmon").glob("hwmon*"):
        try:
            name = (sensor / "name").read_text().strip()
            for source in sensor.glob("temp*_input"):
                label = source.with_name(source.name.replace("_input", "_label"))
                label_text = label.read_text().strip() if label.exists() else ""
                value = int(source.read_text().strip()) / 1000
                if name == "coretemp" and label_text == "Package id 0":
                    return value
                fallback = fallback or value
        except (OSError, ValueError):
            continue
    return fallback


def lan_ip() -> str | None:
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("192.0.2.1", 1))
        return probe.getsockname()[0]
    except OSError:
        return None
    finally:
        probe.close()


def system_data() -> dict:
    try:
        cores = cpu_snapshot()
        uptime = float(Path("/proc/uptime").read_text().split()[0])
        return {"status": "ONLINE", "last_update": now(), "hostname": socket.gethostname(),
                "ip": lan_ip(), "kernel": platform.release(), "load": [round(n, 2) for n in os.getloadavg()],
                "uptime_seconds": int(uptime), "cpu_percent": cores[0] if cores else None,
                "cores": cores, "temperature_c": temperature(), "memory": memory(),
                "storage": {"root": disk("/"), "recording": disk("/media/tv_record") if Path("/media/tv_record").is_mount() else None},
                "network": network()}
    except Exception as error:
        return unavailable(str(error))


def mirakurun_data() -> dict:
    try:
        tuners = get_json("http://127.0.0.1:40772/api/tuners")
        status = get_json("http://127.0.0.1:40772/api/status")
        result = []
        for tuner in tuners:
            # Mirakurun 4.x reports a live reservation in ``isUsing`` and
            # describes the tuned service in the first entry of ``users``.
            # ``isAvailable`` only describes whether the hardware can be used;
            # it must not be used as a busy/idle indicator.
            users = tuner.get("users") or []
            stream = users[0].get("streamSetting", {}) if users else {}
            channel = stream.get("channel", {})
            channel_name = channel.get("name")
            channel_number = channel.get("channel")
            display_channel = channel_name or channel_number or "UNAVAILABLE"
            if channel_name and channel_number and channel_number not in channel_name:
                display_channel = f"{channel_name} ({channel_number})"
            result.append({"name": tuner.get("name", "UNNAMED"), "types": tuner.get("types", []),
                           "state": "UNAVAILABLE" if tuner.get("isDisabled") else ("ACTIVE" if tuner.get("isUsing") else "IDLE"),
                           "channel": display_channel})
        return {"status": "ONLINE", "last_update": now(), "version": status.get("version"),
                "stream_count": status.get("streamCount"), "tuners": result}
    except (OSError, ValueError, urllib.error.URLError, urllib.error.HTTPError) as error:
        return unavailable(str(error))


def epgstation_data() -> dict:
    try:
        base = "http://127.0.0.1:8888/api"
        channels = get_json(f"{base}/channels")
        names = {channel.get("id"): channel.get("name", "UNAVAILABLE") for channel in channels}
        recording = get_json(f"{base}/recording?isHalfWidth=false").get("records", [])
        reserves = get_json(f"{base}/reserves?isHalfWidth=false&offset=0&limit=1").get("reserves", [])
        def normalize(item: dict) -> dict:
            return {"title": item.get("name", "UNAVAILABLE"), "channel": names.get(item.get("channelId"), "UNAVAILABLE"),
                    "start_at": item.get("startAt"), "end_at": item.get("endAt"), "is_recording": item.get("isRecording", False)}
        return {"status": "ONLINE", "last_update": now(), "recordings": [normalize(item) for item in recording],
                "next_recording": normalize(reserves[0]) if reserves else None,
                "storage": disk("/media/tv_record") if Path("/media/tv_record").is_mount() else None}
    except (OSError, ValueError, urllib.error.URLError, urllib.error.HTTPError) as error:
        return unavailable(str(error))


def jellyfin_data() -> dict:
    if not JELLYFIN_API_KEY:
        return unavailable("JELLYFIN_API_KEY is not configured")
    try:
        headers = {"X-Emby-Token": JELLYFIN_API_KEY}
        sessions = get_json(f"{JELLYFIN_URL}/Sessions", headers)
        active = []
        for session in sessions:
            state = session.get("PlayState") or {}
            now_playing = session.get("NowPlayingItem")
            if not now_playing:
                continue
            active.append({"user": session.get("UserName", "UNAVAILABLE"), "device": session.get("DeviceName", "UNAVAILABLE"),
                           "client": session.get("Client", "UNAVAILABLE"), "title": now_playing.get("Name", "UNAVAILABLE"),
                           "channel": now_playing.get("ChannelName") or now_playing.get("Name", "UNAVAILABLE"),
                           "item_id": now_playing.get("Id"),
                           "state": "PAUSED" if state.get("IsPaused") else "PLAYING",
                           "position_ticks": state.get("PositionTicks"), "runtime_ticks": now_playing.get("RunTimeTicks")})
        return {"status": "ONLINE", "last_update": now(), "sessions": active}
    except (OSError, ValueError, urllib.error.URLError, urllib.error.HTTPError) as error:
        return unavailable(str(error))


def snapshot() -> dict:
    system = system_data()
    jellyfin = jellyfin_data()
    system["current_playback"] = jellyfin.get("sessions", [None])[0] if jellyfin.get("sessions") else None
    return {"generated_at": now(), "system": system, "mirakurun": mirakurun_data(),
            "epgstation": epgstation_data(), "jellyfin": jellyfin}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def do_GET(self):
        if self.path == "/api/status":
            body = json.dumps(snapshot(), ensure_ascii=False).encode()
            self.send_response(HTTPStatus.OK); self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
            return
        if self.path == "/api/system":
            body = json.dumps(system_data(), ensure_ascii=False).encode()
            self.send_response(HTTPStatus.OK); self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
            return
        match = re.fullmatch(r"/api/jellyfin-image/([A-Za-z0-9-]{1,64})", self.path)
        if match and JELLYFIN_API_KEY:
            try:
                request = urllib.request.Request(
                    f"{JELLYFIN_URL}/Items/{match.group(1)}/Images/Primary?maxWidth=180",
                    headers={"X-Emby-Token": JELLYFIN_API_KEY},
                )
                with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                    body = response.read()
                    self.send_response(HTTPStatus.OK)
                    self.send_header("Content-Type", response.headers.get_content_type())
                    self.send_header("Cache-Control", "private, max-age=60")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers(); self.wfile.write(body)
            except (OSError, urllib.error.URLError, urllib.error.HTTPError):
                self.send_error(HTTPStatus.NOT_FOUND)
            return
        super().do_GET()

    def log_message(self, *_args):
        return


if __name__ == "__main__":
    print(f"LCARS local API listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
