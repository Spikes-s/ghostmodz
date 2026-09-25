"""Ghost Mods Tech media worker: yt-dlp + FFmpeg behind a bearer-token API.
Env: WORKER_API_SECRET (required), PUBLIC_BASE_URL (https URL of this worker),
DATA_DIR (/data), MAX_PARALLEL (2)."""
import hashlib, hmac, ipaddress, os, re, shutil, socket, subprocess, threading, time, uuid
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
import yt_dlp

SECRET = os.environ.get("WORKER_API_SECRET", "")
BASE = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
DATA = os.environ.get("DATA_DIR", "/data")
os.makedirs(DATA, exist_ok=True)
POOL = ThreadPoolExecutor(int(os.environ.get("MAX_PARALLEL", "2")))
JOBS: dict[str, dict] = {}
LOCK = threading.Lock()
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

class Err(Exception):
    def __init__(self, code, status=400): self.code, self.status = code, status

@app.exception_handler(Err)
async def _err(_, e: Err): return JSONResponse({"code": e.code}, status_code=e.status)

def auth(h):
    if not SECRET or not h or not hmac.compare_digest(h, f"Bearer {SECRET}"): raise Err("forbidden", 401)

def safe_url(u: str):
    p = urlparse(u)
    if p.scheme not in ("http", "https") or not p.hostname or p.username: raise Err("invalid_url")
    for info in socket.getaddrinfo(p.hostname, None):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            raise Err("blocked_host")

def map_err(msg: str):
    m = msg.lower()
    if "drm" in m: return "drm_protected"
    if "private" in m or "sign in" in m or "login" in m: return "private_content"
    if "unsupported url" in m: return "unsupported_platform"
    if "unavailable" in m or "404" in m: return "media_unavailable"
    return "extraction_failed"

BASE_OPTS = {"quiet": True, "no_warnings": True, "noplaylist": True, "socket_timeout": 20, "retries": 2, "allow_unplayable_formats": False}

def tool_version(cmd):
    try: return subprocess.run(cmd, capture_output=True, text=True, timeout=5).stdout.split("\n")[0][:80]
    except Exception: return None

@app.get("/health")
def health(authorization: str = Header(None)):
    auth(authorization)
    with LOCK: active = sum(1 for j in JOBS.values() if j["status"] in ("queued", "processing", "converting"))
    load = os.getloadavg()[0] / (os.cpu_count() or 1) * 100
    mem = None
    try:
        info = dict(l.split(":", 1) for l in open("/proc/meminfo"))
        tot, av = int(info["MemTotal"].split()[0]), int(info["MemAvailable"].split()[0]); mem = round((1 - av / tot) * 100, 1)
    except Exception: pass
    return {"version": "1.0.0", "activeJobs": active, "queueLength": active, "cpuPercent": round(load, 1), "memoryPercent": mem,
            "ytdlp": yt_dlp.version.__version__, "ffmpeg": tool_version(["ffmpeg", "-version"])}

@app.post("/analyze")
async def analyze(req: Request, authorization: str = Header(None)):
    auth(authorization); url = (await req.json()).get("url", ""); safe_url(url)
    try:
        with yt_dlp.YoutubeDL({**BASE_OPTS, "skip_download": True}) as y: i = y.extract_info(url, download=False)
    except Exception as e: raise Err(map_err(str(e)), 422)
    if i.get("_type") == "playlist": raise Err("unsupported_platform", 422)
    fmts = []
    for f in i.get("formats") or []:
        if f.get("has_drm"): continue
        v, a = f.get("vcodec") not in (None, "none"), f.get("acodec") not in (None, "none")
        if not v and not a: continue
        fmts.append({"id": f.get("format_id"), "container": f.get("ext"), "kind": "video" if v else "audio",
                     "quality": f.get("format_note"), "height": f.get("height"), "bitrate": f.get("tbr"),
                     "codec": f.get("vcodec") if v else f.get("acodec"), "filesize": f.get("filesize") or f.get("filesize_approx")})
    if not fmts and i.get("url"):
        fmts.append({"id": "direct", "container": i.get("ext"), "kind": "video" if i.get("height") else "audio", "quality": None, "height": i.get("height")})
    kind = "video" if any(f["kind"] == "video" for f in fmts) else "audio" if fmts else "image"
    return {"title": i.get("title"), "duration": i.get("duration"), "thumbnail": i.get("thumbnail"), "uploader": i.get("uploader") or i.get("channel"),
            "platform": i.get("extractor_key"), "mediaType": kind, "webpageUrl": i.get("webpage_url"), "formats": fmts}

def safe_name(title, q, ext):
    t = re.sub(r"[^A-Za-z0-9]+", "_", title or "media").strip("_")[:80] or "media"
    return f"Ghost_Mods_Tech_{t}{'_' + q if q and q != 'best' else ''}.{ext}"

def run(jid):
    j = JOBS[jid]; out = os.path.join(DATA, jid); os.makedirs(out, exist_ok=True)
    fmt, q = j["format"], j.get("quality")
    def hook(d):
        if j["status"] == "cancelled": raise Exception("cancelled")
        if d.get("status") == "downloading" and (d.get("total_bytes") or d.get("total_bytes_estimate")):
            tot = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            if tot: j["progress"] = max(1, min(95, int(d.get("downloaded_bytes", 0) * 100 / tot)))
            if tot > j["maxSizeMb"] * 1024 * 1024: raise Exception("too_large")
        if d.get("status") == "finished" and fmt in ("mp3", "wav", "m4a"): j["status"] = "converting"
    o = {**BASE_OPTS, "outtmpl": os.path.join(out, "file.%(ext)s"), "progress_hooks": [hook], "max_filesize": j["maxSizeMb"] * 1024 * 1024}
    h = int(q[:-1]) if q and q.endswith("p") and q[:-1].isdigit() else None
    if fmt in ("mp4", "webm"):
        cap = f"[height<={h}]" if h else ""
        o["format"] = f"bv*{cap}[ext={fmt}]+ba/bv*{cap}+ba/b{cap}" if fmt == "mp4" else f"bv*{cap}[ext=webm]+ba[ext=webm]/bv*{cap}+ba/b{cap}"
        o["merge_output_format"] = fmt
    elif fmt in ("mp3", "wav", "m4a"):
        o["format"] = "ba/b"
        pp = {"key": "FFmpegExtractAudio", "preferredcodec": fmt}
        if fmt == "mp3" and q and q.endswith("k"): pp["preferredquality"] = q[:-1]
        o["postprocessors"] = [pp]
    elif fmt == "image":
        o.update({"skip_download": True, "writethumbnail": True, "postprocessors": [{"key": "FFmpegThumbnailsConvertor", "format": "jpg"}]})
    try:
        j["status"] = "processing"
        with yt_dlp.YoutubeDL(o) as y: info = y.extract_info(j["url"], download=True)
        files = [f for f in os.listdir(out) if not f.endswith((".part", ".ytdl"))]
        if not files: raise Exception("conversion_failed")
        f = max(files, key=lambda n: os.path.getsize(os.path.join(out, n)))
        ext = f.rsplit(".", 1)[-1]
        j.update(status="completed", progress=100, path=os.path.join(out, f), outputFilename=safe_name(info.get("title"), q, ext),
                 outputSize=os.path.getsize(os.path.join(out, f)), title=info.get("title"), expires=time.time() + j["ttlMinutes"] * 60)
    except Exception as e:
        if j["status"] != "cancelled":
            s = str(e); code = s if s in ("too_large", "conversion_failed") else ("too_large" if "max-filesize" in s or "larger than" in s else map_err(s))
            j.update(status="failed", errorCode=code)
        shutil.rmtree(out, ignore_errors=True)

@app.post("/jobs")
async def create(req: Request, authorization: str = Header(None)):
    auth(authorization); b = await req.json(); safe_url(b["url"])
    jid = str(uuid.uuid4())
    with LOCK: JOBS[jid] = {"status": "queued", "progress": 0, "url": b["url"], "format": b["format"], "quality": b.get("quality"),
                            "maxSizeMb": int(b.get("maxSizeMb", 2048)), "ttlMinutes": int(b.get("ttlMinutes", 60)), "ext": b.get("jobId")}
    POOL.submit(run, jid)
    return {"workerJobId": jid, "status": "queued"}

def get(jid):
    j = JOBS.get(jid)
    if not j: raise Err("media_unavailable", 404)
    if j["status"] == "completed" and time.time() > j.get("expires", 0): cleanup_one(jid)
    return j

@app.get("/jobs/{jid}")
def state(jid: str, authorization: str = Header(None)):
    auth(authorization); j = get(jid)
    return {k: j.get(k) for k in ("status", "progress", "errorCode", "outputFilename", "outputSize", "title")}

@app.post("/jobs/{jid}/cancel")
def cancel(jid: str, authorization: str = Header(None)):
    auth(authorization); j = get(jid)
    if j["status"] in ("queued", "processing", "converting"): j["status"] = "cancelled"
    return {"ok": True}

def sign(jid, exp): return hmac.new(SECRET.encode(), f"{jid}.{exp}".encode(), hashlib.sha256).hexdigest()

@app.post("/jobs/{jid}/download-url")
def dl_url(jid: str, authorization: str = Header(None)):
    auth(authorization); j = get(jid)
    if j["status"] != "completed": raise Err("forbidden", 409)
    if not BASE.startswith("https://"): raise Err("storage_failure", 500)
    exp = int(time.time()) + 300
    return {"url": f"{BASE}/files/{jid}?exp={exp}&sig={sign(jid, exp)}", "expiresInSeconds": 300}

@app.get("/files/{jid}")
def files(jid: str, exp: int, sig: str):
    if exp < time.time() or not hmac.compare_digest(sig, sign(jid, exp)): raise Err("forbidden", 403)
    j = get(jid)
    if j["status"] != "completed" or not os.path.exists(j.get("path", "")): raise Err("file_expired", 410)
    return FileResponse(j["path"], filename=j["outputFilename"], media_type="application/octet-stream")

def cleanup_one(jid):
    j = JOBS.get(jid)
    if j: shutil.rmtree(os.path.join(DATA, jid), ignore_errors=True); j["status"] = "expired"

@app.post("/cleanup")
def cleanup(authorization: str = Header(None)):
    auth(authorization); n = f = 0
    for jid, j in list(JOBS.items()):
        if j["status"] == "completed" and time.time() > j.get("expires", 0):
            try: cleanup_one(jid); n += 1
            except Exception: f += 1
    return {"deleted": n, "failed": f}

def janitor():
    while True:
        time.sleep(300)
        for jid, j in list(JOBS.items()):
            if j["status"] == "completed" and time.time() > j.get("expires", 0): cleanup_one(jid)
threading.Thread(target=janitor, daemon=True).start()
