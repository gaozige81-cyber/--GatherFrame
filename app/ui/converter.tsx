'use client';
import { useRef, useState, useEffect } from 'react';
import { Upload, ShieldCheck, RefreshCw, Download, Image as ImageIcon, X, LoaderCircle } from 'lucide-react';
import { saveBlob, saveMessage } from '../lib/save';
import { safeFileName } from '../lib/preferences';
import { zip } from '../lib/zip';
import { localId } from '../lib/crypto';
type Entry = {
    id: string;
    file: File;
    origin?: string;
    output?: Blob;
    name?: string;
    width?: number;
    height?: number;
    error?: string;
    status: string;
};
const formats = [['png', 'PNG · 保留透明'], ['jpg', 'JPG · 照片常用'], ['webp', 'WebP · 小体积'], ['avif', 'AVIF · 高压缩'], ['tiff', 'TIFF · 无压缩'], ['bmp', 'BMP · 兼容位图'], ['gif', 'GIF · 静态 / 256色'], ['ico', 'ICO · 图标 ≤256px'], ['svg', 'SVG · 嵌入位图']];
export default function Converter({ notify, onBusy, incoming, onComplete }: {
    notify: (text: string) => void;
    onBusy: (busy: boolean) => void;
    incoming?: {
        token: string;
        files: File[];
        keys?: string[];
    } | null;
    onComplete?: (record: {
        requested: number;
        accepted: number;
        canceled: boolean;
        issues: string[];
        savedStatus?: string;
        summary?: string;
    }) => void;
}) {
    const [files, setFiles] = useState<Entry[]>([]), [format, setFormat] = useState('png'), [quality, setQuality] = useState(90), [maxEdge, setMaxEdge] = useState(0), [background, setBackground] = useState('#ffffff'), [busy, setBusy] = useState(false), [drag, setDrag] = useState(false), [progress, setProgress] = useState(''), [saving, setSaving] = useState(false);
    const worker = useRef<Worker | null>(null), heic = useRef<Worker | null>(null), cancel = useRef(false), busyRef = useRef(false), rejectActive = useRef<((e: Error) => void) | null>(null);
    useEffect(() => { onBusy(busy || saving); }, [busy, saving, onBusy]);
    useEffect(() => () => { cancel.current = true; worker.current?.terminate(); heic.current?.terminate(); rejectActive.current?.(Error('已取消')); onBusy(false); }, [onBusy]);
    const transferToken = useRef('');
    useEffect(() => { if (incoming && incoming.token !== transferToken.current) {
        transferToken.current = incoming.token;
        add(incoming.files, incoming.keys);
    } }, [incoming]);
    function add(incoming: FileList | File[] | null, origins?: string[]) { if (!incoming || busyRef.current)
        return; const accepted: {
        file: File;
        origin?: string;
    }[] = []; let total = files.reduce((n, e) => n + e.file.size, 0); for (const [index, f] of Array.from(incoming).entries()) {
        if (files.length + accepted.length >= 12) {
            notify('处理队列已满，每批最多12张，请先保存或清理已完成文件。');
            break;
        }
        if (!/\.(png|jpe?g|webp|avif|tiff?|bmp|gif|ico|heic|heif|svg)$/i.test(f.name)) {
            notify('不支持此格式：' + f.name);
            continue;
        }
        if (f.size > 25 * 1024 * 1024 || total + f.size > 80 * 1024 * 1024) {
            notify('单图限25MB，每批限80MB：' + f.name);
            continue;
        }
        const origin = origins?.[index];
        if (origin && files.some(e => e.origin === origin))
            continue;
        if ([...files.map(e => e.file), ...accepted.map(e => e.file)].some(e => e.name === f.name && e.size === f.size && e.lastModified === f.lastModified))
            continue;
        accepted.push({ file: f, ...(origin ? { origin } : {}) });
        total += f.size;
    } setFiles(v => [...v, ...accepted.map(e => ({ id: localId(), ...e, status: '等待转换' }))]); if (origins)
        notify(accepted.length ? `已将${accepted.length}张源图加入图片处理队列。` : '处理队列已有这些源图，或队列空间不足。'); }
    async function svgPixels(file: File) {
        const text = await file.text(), doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
            throw Error('SVG文件无效');
        for (const el of Array.from(doc.querySelectorAll('*'))) {
            if (['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'use', 'image', 'feImage', 'animate', 'animateTransform', 'set', 'a', 'style', 'link'].includes(el.localName))
                throw Error('SVG包含嵌入内容、样式或脚本，请使用纯路径SVG');
            for (const a of Array.from(el.attributes))
                if (/^on/i.test(a.name) || /(?:url\s*\(|https?:|\/\/|@import|javascript:)/i.test(a.value))
                    throw Error('SVG包含外部引用或活动内容');
        }
        const root = doc.documentElement, view = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number), w = parseFloat(root.getAttribute('width') || '') || view?.[2] || 1024, h = parseFloat(root.getAttribute('height') || '') || view?.[3] || 1024;
        if (!w || !h || w * h > 40000000 || Math.max(w, h) > 30000)
            throw Error('SVG尺寸过大');
        root.setAttribute('width', String(w));
        root.setAttribute('height', String(h));
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' }));
        try {
            const image = new Image();
            await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(Error('SVG无法栅格化')); image.src = url; });
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(image, 0, 0);
            return ctx.getImageData(0, 0, w, h);
        }
        finally {
            URL.revokeObjectURL(url);
        }
    }
    async function heicPixels(file: File) { if (file.size > 12 * 1024 * 1024)
        throw Error('HEIC导入限12MB，请先在照片应用缩小'); return new Promise<ImageData>((resolve, reject) => { const w = new Worker('/codecs/heic-worker.js'); heic.current = w; const timer = setTimeout(() => { w.terminate(); reject(Error('HEIC解码超时')); }, 90000); rejectActive.current = (err) => { clearTimeout(timer); w.terminate(); reject(err); }; w.onerror = () => { clearTimeout(timer); w.terminate(); reject(Error('HEIC解码器无法读取此文件')); }; w.onmessage = e => { clearTimeout(timer); w.terminate(); const pixels = e.data.imageDataArr?.[0]; if (e.data.error || !pixels)
        reject(Error('HEIC解码失败，可能是未支持的编码版本'));
    else if (pixels.width * pixels.height > 40000000)
        reject(Error('HEIC尺寸超过4000万像素'));
    else
        resolve(pixels); }; file.arrayBuffer().then(buffer => w.postMessage({ id: 'convert', buffer })).catch(reject); }); }
    async function convertOne(entry: Entry, options: any) { let pixels: ImageData | undefined; if (/\.(heic|heif)$/i.test(entry.file.name))
        pixels = await heicPixels(entry.file); if (/\.svg$/i.test(entry.file.name))
        pixels = await svgPixels(entry.file); if (cancel.current)
        throw Error('已取消'); return new Promise<any>((resolve, reject) => { const w = new Worker(new URL('../lib/convert-worker.ts', import.meta.url), { type: 'module' }); worker.current = w; const timer = setTimeout(() => { w.terminate(); reject(Error('转换超时，请降低输出尺寸')); }, 120000); rejectActive.current = (err) => { clearTimeout(timer); w.terminate(); reject(err); }; w.onerror = () => { clearTimeout(timer); w.terminate(); reject(Error('转换器遇到错误，此文件已跳过')); }; w.onmessage = e => { clearTimeout(timer); w.terminate(); e.data.ok ? resolve(e.data) : reject(Error(e.data.error)); }; w.postMessage({ file: entry.file, options, pixels }); }); }
    async function run() { if (busyRef.current || !files.length)
        return; busyRef.current = true; cancel.current = false; setBusy(true); const options = { format, quality, maxEdge, background }; const issues: string[] = []; setFiles(v => v.map(e => ({ ...e, output: undefined, name: undefined, error: undefined, status: '等待转换' }))); let ok = 0, total = 0; try {
        for (const [i, e] of files.entries()) {
            if (cancel.current)
                break;
            setProgress(`正在转换 ${i + 1} / ${files.length}`);
            setFiles(v => v.map(x => x.id === e.id ? { ...x, status: '转换中…' } : x));
            try {
                const r = await convertOne(e, options);
                if (cancel.current)
                    break;
                if (total + r.blob.size > 80 * 1024 * 1024)
                    throw Error('本批输出超过80MB，请缩小长边或分批转换');
                total += r.blob.size;
                ok++;
                const name = safeFileName(e.file.name.replace(/\.[^.]+$/, ''), format);
                setFiles(v => v.map(x => x.id === e.id ? { ...x, output: r.blob, name, width: r.width, height: r.height, error: undefined, status: '转换完成' } : x));
            }
            catch (err) {
                if (cancel.current)
                    break;
                issues.push(e.file.name + '：' + (err instanceof Error ? err.message : '转换失败'));
                setFiles(v => v.map(x => x.id === e.id ? { ...x, status: '转换失败', error: err instanceof Error ? err.message : '转换失败' } : x));
            }
        }
        notify(cancel.current ? '转换已取消，已完成的文件可保存' : `转换完成：${ok}/${files.length}张。原文件保持不变。`);
    }
    finally {
        onComplete?.({ requested: files.length, accepted: ok, canceled: cancel.current, issues });
        busyRef.current = false;
        setBusy(false);
        setProgress('');
        setFiles(v => v.map(e => e.status === '转换中…' ? { ...e, status: '已取消' } : e));
    } }
    function stop() { cancel.current = true; worker.current?.terminate(); heic.current?.terminate(); rejectActive.current?.(Error('已取消')); setProgress('正在取消…'); }
    async function saveEntry(entry: Entry) { if (busyRef.current || !entry.output)
        return; busyRef.current = true; setSaving(true); try {
        const result = await saveBlob(entry.output, entry.name!); notify(saveMessage(result)); onComplete?.({requested:1,accepted:['saved','browser'].includes(result.status)?1:0,canceled:result.status==='canceled',issues:result.error?[result.error]:[],savedStatus:result.status,summary:saveMessage(result)});
    }
    catch {
        notify('保存失败，请重试');
    }
    finally {
        busyRef.current = false;
        setSaving(false);
    } }
    async function downloadAll() { if (busyRef.current)
        return; const ready = files.filter(e => e.output); if (!ready.length)
        return; busyRef.current = true; setSaving(true); try {
        const data: {
            name: string;
            data: Uint8Array;
        }[] = [];
        for (const [i, e] of ready.entries())
            data.push({ name: String(i + 1).padStart(2, '0') + '-' + e.name, data: new Uint8Array(await e.output!.arrayBuffer()) });
        data.push({ name: '转换清单.json', data: new TextEncoder().encode(JSON.stringify(files.map(e => ({ source: e.file.name, file: e.name, width: e.width, height: e.height, status: e.status, error: e.error })), null, 2)) });
        const result = await saveBlob(new Blob([zip(data) as BlobPart], { type: 'application/zip' }), '拾材-图片转换.zip'); notify(saveMessage(result)); onComplete?.({requested:ready.length,accepted:['saved','browser'].includes(result.status)?ready.length:0,canceled:result.status==='canceled',issues:result.error?[result.error]:[],savedStatus:result.status,summary:saveMessage(result)});
    }
    catch (e) {
        notify(e instanceof Error ? e.message : '打包失败');
    }
    finally {
        busyRef.current = false;
        setSaving(false);
    } }
    const done = files.filter(f => f.output).length;
    return <section><div className="converter-intro"><label className={'drop-zone ' + (drag ? 'drag' : '')} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}><Upload size={32}/><b>把图片拖到这里，或点击选择</b><p>PNG · JPG · WebP · AVIF · TIFF · BMP · GIF · ICO · HEIC · SVG</p><small>每批12张 / 单张25MB / 每批80MB · 文件不会上传</small><input disabled={busy || saving} type="file" multiple aria-label="选择待转换图片" accept=".png,.jpg,.jpeg,.webp,.avif,.tif,.tiff,.bmp,.gif,.ico,.heic,.heif,.svg" onChange={e => { add(e.target.files); e.target.value = ''; }}/></label><aside className="converter-tip"><h3><ShieldCheck size={17}/>你的图片，留在你的电脑</h3><p>编解码器随应用内置，桌面版可离线转换。选入的原文件不会被覆盖。</p><p>转换生成8位静态图片。GIF/APNG取首帧，TIFF取第一页，HEIC取第一张；不保留原始 EXIF、ICC 配置或分层。</p></aside></div>
 <div className="convert-options"><label>输出格式<select aria-label="输出格式" value={format} disabled={busy || saving} onChange={e => setFormat(e.target.value)}>{formats.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>输出长边<select aria-label="输出长边" value={maxEdge} disabled={busy || saving} onChange={e => setMaxEdge(Number(e.target.value))}><option value="0">保持原尺寸</option>{[512, 1024, 1600, 2400, 3000, 4096].map(n => <option key={n} value={n}>{n} px（不放大）</option>)}</select></label><label>有损质量 {quality}%<input className="range" type="range" min="10" max="100" aria-label="压缩质量" value={quality} disabled={busy || saving || !['jpg', 'webp', 'avif'].includes(format)} onChange={e => setQuality(Number(e.target.value))}/></label><label>JPG / BMP 背景<input type="color" value={background} disabled={busy || saving || !['jpg', 'bmp'].includes(format)} aria-label="透明区域背景色" onChange={e => setBackground(e.target.value)}/></label><button className="primary" disabled={busy || saving || !files.length} onClick={run}>{busy ? <LoaderCircle size={16} className="spin"/> : <RefreshCw size={16}/>}批量转换</button></div>
 <div className="info-box">{format === 'jpg' || format === 'bmp' ? '此格式不保留透明度，透明区域将填入所选背景色。' : format === 'gif' ? '输出为静态GIF，最多256色，透明度只有全透明或不透明两档。' : format === 'svg' ? 'SVG输出会嵌入PNG位图，不会把照片描摹为可编辑矢量路径。' : format === 'ico' ? 'ICO内嵌PNG图标，长边最多256像素。' : format === 'avif' ? 'AVIF编码限1200万像素，较慢；大图请先设置输出长边。' : '支持透明的格式会保留透明区域。转换无法恢复原文件已经损失的细节。'} 所有动图仅导出首帧，TIFF仅导出第一页；输出不保留 EXIF、ICC 或分层。</div>
 <div className="conversion-summary"><span>{saving ? '正在保存转换结果…' : busy ? progress : `${files.length}张待处理 · ${done}张可保存`}</span><div>{busy ? <button className="outline" onClick={stop}>取消转换</button> : <button className="text-button" disabled={busy || saving || !files.length} onClick={() => { if (!saving)
        setFiles([]); }}>清空列表</button>}<button className="outline" disabled={busy || saving || !done} onClick={downloadAll}><Download size={14}/>打包保存结果</button></div></div><div className="conversion-list">{files.map(e => <div className="conversion-row" key={e.id}><span className="file-icon"><ImageIcon size={21}/></span><div><b title={e.file.name}>{e.file.name}</b><small className={e.error ? 'bad' : ''}>{e.error || `${e.status} · ${(e.file.size / 1024 / 1024).toFixed(2)}MB${e.output ? ` → ${e.name} · ${e.width}×${e.height} · ${(e.output.size / 1024 / 1024).toFixed(2)}MB` : ''}`}</small></div>{e.output && <button className="outline" disabled={busy || saving} onClick={() => saveEntry(e)}>保存</button>}<button className="icon" disabled={busy || saving} aria-label={'移除 ' + e.file.name} onClick={() => setFiles(v => v.filter(x => x.id !== e.id))}><X size={15}/></button></div>)}</div>{!files.length && <div className="empty"><ImageIcon size={31}/><h3>格式不合适，换一个就好。</h3><p>导入本地图片，选好目标格式，再批量保存。</p></div>}
 <details className="format-guide"><summary>格式能力与边界</summary><table><thead><tr><th>类型</th><th>支持范围</th></tr></thead><tbody><tr><td>导入与导出</td><td>PNG、JPG、WebP、AVIF、TIFF、BMP、GIF、ICO、SVG</td></tr><tr><td>仅导入</td><td>HEIC / HEIF（兼容编码；较新编码可能失败，限12MB）</td></tr><tr><td>SVG</td><td>导入仅接受纯路径、无脚本、无外部引用文件；输出为嵌入位图的SVG容器</td></tr><tr><td>不包含</td><td>HEIC编码、PSD图层、AI/EPS、相机RAW、动画重编码、16位/HDR与专业印刷色彩管理</td></tr></tbody></table></details></section>;
}
