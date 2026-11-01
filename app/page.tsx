'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, ArrowUpRight, Download, Bookmark, FolderOpen, SlidersHorizontal, Check, X, ExternalLink, Image as ImageIcon, Layers, Globe, CheckCircle2, ArrowRight, LoaderCircle, Link as LinkIcon, ScanLine, RefreshCw, Inbox, Plus, ArrowDownToLine, History, Trash2, Undo2, FileDown, FileUp, FileImage, ChevronRight, WandSparkles } from 'lucide-react';
import type { Asset } from './lib/assets';
import { zip } from './lib/zip';
import { normalizePreferences, defaultProfile, safeFileName } from './lib/preferences';
import type { Profile } from './lib/preferences';
import { saveBlob, saveMessage } from './lib/save';
import { assetKey, mediaUrl, verifyAsset, meetsQuality } from './lib/quality';
import type { Quality } from './lib/quality';
import Converter from './ui/converter';
import AIStudio from './ui/ai-studio';
import AssetPreview from './ui/asset-preview';
import WebsiteDirectory from './ui/website-directory';
import SoftwareUpdates from './ui/software-updates';
import {searchSites} from './lib/search-sites';
import { localId } from './lib/crypto';
import { mergeAssets, normalizeAssets, qualityIssues, projectFile, readProject, displayQuality } from './lib/workbench';
import type { RunRecord } from './lib/workbench';
import { readCached, storeCached, cacheMetadata, clearCached } from './lib/cache';
import { contactSheet } from './lib/contact-sheet';
import { publicUrl } from './lib/public-fetch';
type SourceStatus = {
    source: string;
    name: string;
    ok: boolean;
    count: number;
    error: string;
    queries?: string[];
};
type Inspection = {
    quality?: Quality;
    error?: string;
};
const sourceNames: Record<string, string> = { commons: 'Wikimedia', openverse: 'Openverse', artic: '芝加哥艺术博物馆', web: '网络图片' };
function suggest(q: string) { const words = [['纸张', 'paper texture'], ['半色调', 'halftone'], ['颗粒', 'grain texture'], ['校园', 'university campus'], ['森林', 'forest'], ['植物', 'botanical leaves'], ['建筑', 'architecture'], ['复古', 'vintage'], ['免抠', 'isolated transparent'], ['油画', 'oil painting']]; return words.filter(([cn]) => q.includes(cn)).map(([, en]) => en).join(' '); }
export default function Home() {
    const [converterBusy, setConverterBusy] = useState(false), [tab, setTab] = useState('collect'), [mode, setMode] = useState('search'), [input, setInput] = useState(''), [query, setQuery] = useState(''), [source, setSource] = useState('bing'), [items, setItems] = useState<Asset[]>([]), [statuses, setStatuses] = useState<SourceStatus[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState(''), [page, setPage] = useState(1), [more, setMore] = useState(false), [saved, setSaved] = useState<Asset[]>([]), [selected, setSelected] = useState<string[]>([]), [history, setHistory] = useState<string[]>([]), [profile, setProfile] = useState<Profile>(defaultProfile), [draft, setDraft] = useState<Profile>(defaultProfile), [ready, setReady] = useState(false), [mirror, setMirror] = useState(''), [mirrorDraft, setMirrorDraft] = useState(''), [desktop, setDesktop] = useState(false), [downloadDir, setDownloadDir] = useState(''), [toast, setToast] = useState(''), [detail, setDetail] = useState<Asset | null>(null), [inspection, setInspection] = useState<Record<string, Inspection>>({}), [job, setJob] = useState(''), [min, setMin] = useState(1600), [transparent, setTransparent] = useState(false), [format, setFormat] = useState(''), [group, setGroup] = useState('format'), [onlyPassed, setOnlyPassed] = useState(false);
    const [queue, setQueue] = useState<Asset[]>([]), [projectName, setProjectName] = useState('未命名项目'), [runs, setRuns] = useState<RunRecord[]>([]), [incoming, setIncoming] = useState<{
        token: string;
        files: File[];
        keys: string[];
    } | null>(null), [view, setView] = useState('all'), [dense, setDense] = useState(false), [queueSearch, setQueueSearch] = useState(''), [undo, setUndo] = useState<Asset[] | null>(null), [cacheCount, setCacheCount] = useState(0), [cacheBytes, setCacheBytes] = useState(0), [cacheWarning, setCacheWarning] = useState(false);
    const recipe = { min, transparent, format, group };
    const logRun = useCallback((record: Omit<RunRecord, 'id' | 'at'>) => setRuns(v => [{ ...record, id: localId(), at: new Date().toISOString() }, ...v].slice(0, 30)), []);
    const converterComplete = useCallback((record: {
        requested: number;
        accepted: number;
        canceled: boolean;
        issues: string[];
        savedStatus?: string;
        summary?: string;
    }) => logRun({ kind: 'convert', requested: record.requested, accepted: record.accepted, status: record.savedStatus || (record.canceled ? 'canceled' : 'converted'), summary: record.summary || (record.canceled ? '图片处理已取消' : `已转换${record.accepted}/${record.requested}张，转换结果已准备好`), issues: record.issues }), [logRun]);
    async function refreshCache(list = queue) { try {
        const data = await cacheMetadata(list.map(assetKey));
        setCacheCount(data.length);
        setCacheBytes(data.reduce((n, v) => n + v.bytes, 0));
        setInspection(v => { const next = { ...v }; for (const c of data)
            if (!next[c.key]?.error)
                next[c.key] = { quality: c.quality }; return next; });
    }
    catch {
        setCacheWarning(true);
    } }
    const seq = useRef(0), request = useRef<AbortController | null>(null), jobAbort = useRef<AbortController | null>(null), running = useRef(false), cache = useRef(new Map<string, {
        blob: Blob;
        quality: Quality;
    }>()), dialog = useRef<HTMLDialogElement>(null), projectImport = useRef<HTMLInputElement>(null);
    useEffect(() => { let alive = true; (async () => { let raw: any = {}; try {
        raw = { ...JSON.parse(localStorage.getItem('shicai-workbench') || '{}'), saved: JSON.parse(localStorage.getItem('shicai-saved') || '[]'), history: JSON.parse(localStorage.getItem('shicai-history') || '[]'), profile: JSON.parse(localStorage.getItem('shicai-profile') || 'null'), mirror: localStorage.getItem('shicai-mirror') || '' };
    }
    catch { } if (window.shicaiDesktop) {
        setDesktop(true);
        try {
            const cfg = await window.shicaiDesktop.getSettings();
            if (cfg.state)
                raw = cfg.state;
            setDownloadDir(cfg.downloadDir);
        }
        catch {
            setToast('资料读取失败，请先导出备份');
        }
    } if (!alive)
        return; const v = normalizePreferences(raw); setSaved(v.saved); setHistory(v.history); setProfile(v.profile); setDraft(v.profile); setMirror(v.mirror); setMirrorDraft(v.mirror); setQueue(v.queue); setProjectName(v.projectName); setRuns(v.runs); setMin(v.recipe.min); setTransparent(v.recipe.transparent); setFormat(v.recipe.format); setGroup(v.recipe.group); setReady(true); await refreshCache(v.queue); })(); return () => { alive = false; request.current?.abort(); jobAbort.current?.abort(); }; }, []);
    useEffect(() => { if (!ready)
        return; const state = { profile, saved, history, mirror, queue, projectName, recipe, runs }; try {
        localStorage.setItem('shicai-workbench', JSON.stringify({ queue, projectName, recipe, runs }));
        for (const [k, v] of Object.entries({ profile, saved, history, mirror }))
            localStorage.setItem('shicai-' + k, k === 'mirror' ? v as string : JSON.stringify(v));
    }
    catch {
        setToast('本机缓存已满，请导出资料备份');
    } window.shicaiDesktop?.saveState(state).then(r => { if (!r.ok)
        setToast('资料保存失败，请检查用户目录'); }).catch(() => setToast('资料保存失败，请导出备份')); }, [ready, profile, saved, history, mirror, queue, projectName, min, transparent, format, group, runs]);
    useEffect(() => { if (!toast)
        return; const t = setTimeout(() => setToast(''), 7000); return () => clearTimeout(t); }, [toast]);
    useEffect(() => { if (detail)
        dialog.current?.showModal();
    else
        dialog.current?.close(); }, [detail]);
    function navigate(t: string) { if (running.current || converterBusy) {
        setToast('请先等待任务完成或取消任务');
        return;
    } request.current?.abort(); seq.current++; setBusy(false); if (t === 'search' || t === 'collect') { const nextMode = t === 'search' ? 'search' : 'page'; if (mode !== nextMode) { setMode(nextMode); setInput(''); setQuery(''); setItems([]); setStatuses([]); setError(''); setNote(''); setMore(false); } setTab('collect'); } else setTab(t); setSelected([]); setOnlyPassed(false); setView('all'); if (t === 'settings')
        setDraft(profile); }
    function stopSearch() {
        request.current?.abort(); seq.current++; setBusy(false); setMore(false);
        setNote('已停止搜索，可以更换关键词或图库后重试。');
    }
    async function saveOriginal(a: Asset) {
        if (running.current || converterBusy || busy) return;
        running.current = true;
        const controller = new AbortController(); jobAbort.current = controller;
        setJob('正在读取原图…');
        let status = 'error', summary = '', accepted = 0;
        try {
            const {blob, quality} = await ensure(a, controller.signal);
            if (controller.signal.aborted) throw new DOMException('已取消', 'AbortError');
            setJob('正在保存原图…');
            const result = await saveBlob(blob, safeFileName(a.title, quality.ext));
            status = result.status; summary = saveMessage(result);
            accepted = result.status === 'saved' || result.status === 'browser' ? 1 : 0;
            setToast(summary);
        } catch (e) {
            status = controller.signal.aborted ? 'canceled' : 'error';
            summary = status === 'canceled' ? '已取消保存原图' : e instanceof Error ? e.message : '原图读取失败，请打开来源页重试';
            if (status === 'error') setInspection(v => ({...v, [assetKey(a)]: {error: summary}}));
            setToast(summary);
        } finally {
            logRun({kind:'download',requested:1,accepted,status,summary,issues:status === 'error' ? [a.title + '：' + summary] : []});
            running.current = false; jobAbort.current = null; setJob('');
            await refreshCache();
        }
    }
    async function search(q: string, p = 1, s = source) { if (running.current || converterBusy) {
        setToast('请先完成或取消当前任务');
        return;
    } q = q.trim(); if (!q || q.length > 180) {
        setToast('请输入1–180字关键词');
        return;
    } request.current?.abort(); const controller = new AbortController(); request.current = controller; const n = ++seq.current; const append = p > 1 && q === query && s === source; setBusy(true); setError(''); setNote(''); setTab('collect'); setMode('search'); setQuery(q); setInput(q); setSource(s); setPage(p); if (!append) setItems([]); setSelected([]); setStatuses([]); setOnlyPassed(false); try {
        const r = await fetch('/api/search?' + new URLSearchParams({ q, page: String(p), source: s }), { signal: controller.signal });
        const d: any = await r.json();
        if (n !== seq.current)
            return;
        setStatuses(d.sources || []);
        if (!r.ok)
            throw Error(d.error || '所选搜索来源暂时无法连接，请换一个来源，或使用下方网站入口');
        const next = normalizeAssets(append ? [...items, ...d.items] : d.items, 2000);
        setItems(next);
        setMore(d.more && next.length < 2000);
        setNote(`本次新增${next.length - (append ? items.length : 0)}张，已加载${next.length}张图片。`);
        setHistory(v => [q, ...v.filter(x => x !== q)].slice(0, 8));
    }
    catch (e) {
        if (n === seq.current && !(e instanceof DOMException && e.name === 'AbortError'))
            setError(e instanceof Error ? e.message : '连接失败');
    }
    finally {
        if (n === seq.current)
            setBusy(false);
    } }
    async function extract() { if (running.current || converterBusy)
        return; if (mode === 'links') {
        try {
            const lines = input.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            if (!lines.length || lines.length > 80)
                throw Error('每次粘贴1–80个图片地址，每行一个');
            const assets = lines.map((raw, i) => { const u = publicUrl(raw); return { id: 'web-link-' + i, source: 'web', url: u.href, title: decodeURIComponent(u.pathname.split('/').pop() || '直接图片'), creator: '作者见来源页', width: 0, height: 0, format: '待检测', license: '待核验授权', licenseUrl: '', page: u.href, attribution: '直接图片 · ' + u.href }; });
            setItems(normalizeAssets(assets));
            setQuery('直接图片地址');
            setError('');
            setNote('已导入图片地址候选。扩展名不代表实际格式，请加入收集箱检测。');
            setSelected([]);
            setMore(false);
        }
        catch (e) {
            setToast(e instanceof Error ? e.message : '地址无效');
        }
        return;
    } try {
        const u = new URL(input);
        if (!['http:', 'https:'].includes(u.protocol))
            throw Error();
    }
    catch {
        setToast('请粘贴完整的 HTTP/HTTPS 网页地址');
        return;
    } request.current?.abort(); const controller = new AbortController(); request.current = controller; const n = ++seq.current; setBusy(true); setError(''); setNote(''); setStatuses([]); setItems([]); setSelected([]); setOnlyPassed(false); setQuery(input); setPage(1); setMore(false); try {
        const r = await fetch('/api/extract?' + new URLSearchParams({ url: input }), { signal: controller.signal });
        const d: any = await r.json();
        if (n !== seq.current)
            return;
        if (!r.ok)
            throw Error(d.error);
        setItems(d.items);
        setNote(d.note);
        setQuery(d.title + ' · ' + new URL(d.page).hostname);
    }
    catch (e) {
        if (n === seq.current && !(e instanceof DOMException && e.name === 'AbortError'))
            setError(e instanceof Error ? e.message : '网页读取失败');
    }
    finally {
        if (n === seq.current)
            setBusy(false);
    } }
    function bookmark(a: Asset) { setSaved(v => v.some(x => assetKey(x) === assetKey(a)) ? v.filter(x => assetKey(x) !== assetKey(a)) : [a, ...v].slice(0, 1000)); }
    function toggle(a: Asset) { const key = assetKey(a); setSelected(v => v.includes(key) ? v.filter(k => k !== key) : v.length < 12 ? [...v, key] : (setToast('每批最多12张，避免大图占满内存'), v)); }
    function addToQueue(list: Asset[]) { const next = mergeAssets(queue, list), added = next.length - queue.length; setQueue(next); setToast(added ? `已加入收集箱${added}张${next.length === 200 ? '，收集箱上限200张' : ''}` : '这些素材已在收集箱中，或收集箱已满'); }
    function removeFromQueue(keys: string[]) { setUndo(queue); setQueue(v => v.filter(a => !keys.includes(assetKey(a)))); setSelected([]); setToast('已从收集箱移除，可点击“撤销移除”恢复。'); }
    async function ensure(a: Asset, signal: AbortSignal, force = false) { const key = assetKey(a); if (!force) {
        const memory = cache.current.get(key);
        if (memory)
            return memory;
        try {
            const local = await readCached(key);
            if (local) {
                cache.current.set(key, local);
                setInspection(v => ({ ...v, [key]: { quality: local.quality } }));
                return local;
            }
        }
        catch {
            setCacheWarning(true);
        }
    } const result = await verifyAsset(a, signal); let total = [...cache.current.values()].reduce((n, v) => n + v.blob.size, 0); for (const [k, v] of cache.current) {
        if (total + result.blob.size <= 80 * 1024 * 1024)
            break;
        cache.current.delete(k);
        total -= v.blob.size;
    } cache.current.set(key, result); setInspection(v => ({ ...v, [key]: { quality: result.quality } })); try {
        await storeCached({ key, ...result, usedAt: Date.now() });
    }
    catch {
        setCacheWarning(true);
    } return result; }
    const base = tab === 'board' ? queue : tab === 'saved' ? saved : items;
    const filtered = base.filter(a => { const record = inspection[assetKey(a)], q = record?.quality; if (tab === 'board' && queueSearch && !a.title.toLowerCase().includes(queueSearch.toLowerCase()))
        return false; if (onlyPassed && (!q || qualityIssues(q, recipe).length))
        return false; if (tab === 'board' && view === 'pending' && (q || record?.error))
        return false; if (tab === 'board' && view === 'ready' && (!q || qualityIssues(q, recipe).length))
        return false; if (tab === 'board' && view === 'issues' && !(record?.error || (q && qualityIssues(q, recipe).length)))
        return false; return true; });
    const shown = filtered, chosen = base.filter(a => selected.includes(assetKey(a))), passed = base.filter(a => { const q = inspection[assetKey(a)]?.quality; return q && !qualityIssues(q, recipe).length; }).length;
    const queueReady = queue.filter(a => { const q = inspection[assetKey(a)]?.quality; return q && !qualityIssues(q, recipe).length; }).length, queuePending = queue.filter(a => !inspection[assetKey(a)]).length, queueIssues = queue.length - queueReady - queuePending;
    async function openDownloads() {
        if (!window.shicaiDesktop) { navigate('settings'); return; }
        try { const result = await window.shicaiDesktop.openDownloadFolder(); if (result.error) setToast(result.error); }
        catch { setToast('无法打开下载文件夹，请在偏好设置中重新选择。'); }
    }
    async function exportProject() { try {
        setToast(saveMessage(await saveBlob(new Blob([JSON.stringify(projectFile(projectName, queue, recipe), null, 2)], { type: 'application/json' }), safeFileName(projectName + '-项目清单', 'json'))));
    }
    catch {
        setToast('项目清单保存失败');
    } }
    async function importProject(file?: File) { if (!file)
        return; try {
        if (file.size > 3 * 1024 * 1024)
            throw Error('项目清单限3MB');
        const data = readProject(JSON.parse(await file.text()));
        setUndo(queue);
        setQueue(v => mergeAssets(v, data.queue));
        setProjectName(data.name);
        setMin(data.recipe.min);
        setTransparent(data.recipe.transparent);
        setFormat(data.recipe.format);
        setGroup(data.recipe.group);
        setTab('board');
        setSelected([]);
        setToast('项目清单已合并；源图需检测后缓存，不包含在清单中。');
    }
    catch (e) {
        setToast(e instanceof Error ? e.message : '导入失败');
    } }
    async function process(kind: 'verify' | 'download' | 'convert' | 'sheet', override?: Asset[], force = false) {
        if (running.current || converterBusy)
            return;
        const list = (override || ((chosen.length ? chosen : shown).slice(0, 12))).slice(0, 12);
        if (!list.length) {
            setToast('请先导入素材，再选择需要处理的图片');
            return;
        }
        if (tab !== 'board')
            setQueue(v => mergeAssets(v, list));
        running.current = true;
        const controller = new AbortController();
        jobAbort.current = controller;
        const files: {
            name: string;
            data: Uint8Array;
        }[] = [], manifest: any[] = [], hashes = new Set<string>(), prepared: {
            asset: Asset;
            quality: Quality;
            blob: Blob;
        }[] = [];
        let size = 0, accepted = 0;
        let status = 'error', summary = '任务未完成';
        try {
            for (const [i, a] of list.entries()) {
                if (controller.signal.aborted)
                    break;
                setJob(`${kind === 'verify' ? '检测源图' : '准备素材'} ${i + 1} / ${list.length}`);
                try {
                    const { quality: q, blob } = await ensure(a, controller.signal, force);
                    if (controller.signal.aborted)
                        break;
                    const reason = qualityIssues(q, recipe)[0] || (hashes.has(q.hash) ? '与本批次图片字节重复' : '');
                    if (reason) {
                        manifest.push({ asset: a, quality: q, status: 'skipped', reason });
                        continue;
                    }
                    hashes.add(q.hash);
                    if (kind !== 'verify') {
                        if (size + blob.size > 80 * 1024 * 1024)
                            throw Error('本批次超过80MB，请减少选择');
                        size += blob.size;
                        prepared.push({ asset: a, quality: q, blob });
                    }
                    if (kind === 'download') {
                        const folder = group === 'color' ? q.color : group === 'alpha' ? (q.transparent === true ? '透明PNG' : q.transparent === false ? '不透明PNG' : '其他格式') : q.format;
                        const name = folder + '/' + safeFileName(String(i + 1).padStart(2, '0') + '-' + a.title, q.ext);
                        files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
                        manifest.push({ asset: a, quality: q, status: 'saved-in-archive', file: name });
                    }
                    else
                        manifest.push({ asset: a, quality: q, status: 'passed' });
                    accepted++;
                }
                catch (e) {
                    if (controller.signal.aborted)
                        break;
                    const message = e instanceof Error ? e.message : '检测失败';
                    setInspection(v => ({ ...v, [assetKey(a)]: { error: message } }));
                    manifest.push({ asset: a, status: 'error', reason: message });
                }
            }
            if (controller.signal.aborted) {
                status = 'canceled';
                summary = '任务已取消，已完成的检测结果已保留';
                setToast(summary);
                return;
            }
            if (kind === 'download' && files.length) {
                const enc = new TextEncoder();
                files.push({ name: '素材清单.json', data: enc.encode(JSON.stringify({ version: 3, projectName, createdAt: new Date().toISOString(), filters: recipe, items: manifest }, null, 2)) }, { name: '来源与检测说明.txt', data: enc.encode('拾材项目：' + projectName + '\n图片保留来源返回的字节，不进行二次编码。机构图像为其提供的高清版本。透明像素不保证精细抠图，主色为近似取样。请按来源页核验授权。\n\n' + manifest.map(m => `${m.status} · ${m.asset.title}\n${m.asset.attribution}\n来源：${m.asset.page}\n许可：${m.asset.license} ${m.asset.licenseUrl}\n${m.reason || m.file || ''}`).join('\n\n')) });
                setJob('正在生成项目素材包…');
                const result = await saveBlob(new Blob([zip(files) as BlobPart], { type: 'application/zip' }), safeFileName(projectName + '-源素材包', 'zip'));
                status = result.status;
                summary = saveMessage(result) + ` · ${accepted}/${list.length}张符合条件`;
                setToast(summary);
            }
            else if (kind === 'convert' && prepared.length) {
                const data = prepared.map((e, i) => new File([e.blob], safeFileName(String(i + 1).padStart(2, '0') + '-' + e.asset.title, e.quality.ext), { type: e.blob.type, lastModified: Date.now() }));
                setIncoming({ token: localId(), files: data, keys: prepared.map(e => assetKey(e.asset) + ':' + e.quality.hash) });
                setTab('converter');
                status = 'prepared';
                summary = `已将${accepted}张达标源图送入图片处理`;
                setToast(summary);
            }
            else if (kind === 'sheet' && prepared.length) {
                setJob('正在生成选片预览…');
                const result = await saveBlob(await contactSheet(prepared, projectName), safeFileName(projectName + '-选片预览', 'png'));
                status = result.status;
                summary = saveMessage(result) + ` · ${accepted}张选片预览`;
                setToast(summary);
            }
            else {
                status = kind === 'verify' && manifest.some(m => m.quality) ? 'verified' : 'error';
                summary = `检测完成：${accepted}/${list.length}张符合当前条件${accepted ? '' : '，请查看未达标原因'}`;
                setToast(summary);
            }
        }
        catch (e) {
            status = 'error';
            summary = e instanceof Error ? e.message : '处理失败';
            setToast(summary);
        }
        finally {
            logRun({ kind, requested: list.length, accepted, status, summary, issues: manifest.filter(m => m.reason).map(m => m.asset.title + '：' + m.reason) });
            running.current = false;
            setJob('');
            jobAbort.current = null;
            await refreshCache(mergeAssets(queue, list));
        }
    }
    async function avatarFile(file?: File) { if (!file)
        return; if (file.size > 5 * 1024 * 1024) {
        setToast('头像请小于5MB');
        return;
    } try {
        const image = await createImageBitmap(file), c = document.createElement('canvas');
        c.width = c.height = 256;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#e4e9da';
        ctx.fillRect(0, 0, 256, 256);
        const side = Math.min(image.width, image.height);
        ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 256, 256);
        image.close();
        setDraft(v => ({ ...v, avatar: c.toDataURL('image/jpeg', .85) }));
    }
    catch {
        setToast('无法读取此头像');
    } }
    async function importSettings(file?: File) { if (!file)
        return; try {
        if (file.size > 6 * 1024 * 1024)
            throw Error('备份超过6MB');
        const raw = JSON.parse(await file.text());
        if (![1, 2, 3].includes(raw.version) || !raw.profile || !Array.isArray(raw.saved))
            throw Error('不是拾材资料备份');
        const v = normalizePreferences(raw);
        setProfile(v.profile);
        setDraft(v.profile);
        setSaved(v.saved);
        setHistory(v.history);
        setMirror(v.mirror);
        setMirrorDraft(v.mirror);
        setQueue(v.queue);
        setProjectName(v.projectName);
        setRuns(v.runs);
        setMin(v.recipe.min);
        setTransparent(v.recipe.transparent);
        setFormat(v.recipe.format);
        setGroup(v.recipe.group);
        setToast('已恢复资料备份，源图文件不包含在备份中');
    }
    catch (e) {
        setToast(e instanceof Error ? e.message : '导入失败');
    } }
    const domesticSearch = (<details className="domestic" open><summary><Globe size={16}/> 更多搜图网站 <span>在浏览器中打开，找到来源页后可用“网页导入”收集</span></summary><p>这些入口打开搜索引擎，不代表已接入它们的取图接口。优先从图片原始页面收集，脚本页面或防盗链可能不可读取。</p><div>{[['Bing 图片', 'https://www.bing.com/images/search?q='], ['百度图片', 'https://image.baidu.com/search/index?tn=baiduimage&word='], ['搜狗图片', 'https://pic.sogou.com/pics?query='], ['360图片', 'https://image.so.com/i?q=']].map(([n, u]) => <a key={n} href={u + encodeURIComponent(input || query || '设计素材')} target="_blank" rel="noreferrer">{n}<ArrowUpRight size={14}/></a>)}{mirror && <a href={mirror.replaceAll('{query}', encodeURIComponent(input || query))} target="_blank" rel="noreferrer">自定义入口<ArrowUpRight size={14}/></a>}</div></details>);
    const names: Record<string, string> = { board: '素材收集箱', collect: mode === 'search' ? '寻找图片' : '网页导入', converter: '图片处理', saved: '素材收藏', activity: '最近任务', settings: '偏好设置', sites: '搜图网站', ai: 'AI海报助手' };
    return <div className="shell studio-shell"><aside className="sidebar"><button className="brand" onClick={() => navigate('search')} aria-label="返回寻找图片"><span className="brand-icon"><Layers size={25}/></span><span>拾材<small>SHICAI / 2.3.0</small></span></button><div className="workspace">素材准备工作室</div><nav>{[['search', '寻找图片', Search], ['sites', '搜图网站', Globe], ['board', '素材收集箱', Inbox], ['collect', '网页导入', LinkIcon], ['converter', '图片处理', RefreshCw], ['ai', 'AI海报助手', WandSparkles], ['saved', '素材收藏', Bookmark], ['activity', '最近任务', History], ['settings', '偏好设置', SlidersHorizontal]].map(([id, label, Icon]: any) => <button key={id} className={(id === 'search' ? tab === 'collect' && mode === 'search' : id === 'collect' ? tab === 'collect' && mode !== 'search' : tab === id) ? 'active' : ''} onClick={() => navigate(id)}><Icon size={18}/>{label}{id === 'board' && <em>{queue.length}</em>}{id === 'saved' && <em>{saved.length}</em>}</button>)}</nav><div className="side-project"><span>当前项目</span><b>{projectName}</b><small>清单保存在本机</small><button onClick={exportProject} disabled={!queue.length || !!job || converterBusy}><FileDown size={14}/>导出项目清单</button></div><div className="side-bottom"><div className="side-utilities"><button onClick={openDownloads}><FolderOpen size={16}/>{desktop ? '打开下载文件夹' : '下载位置设置'}</button><button disabled={!!job || converterBusy} onClick={() => projectImport.current?.click()}><FileUp size={16}/>导入项目清单</button><input ref={projectImport} type="file" accept=".json" hidden aria-label="从侧栏导入项目清单" onChange={e => { importProject(e.target.files?.[0]); e.target.value = ''; }}/></div></div></aside>
 <main><header><div className="project-breadcrumb"><label htmlFor="project-name">项目名称</label><input id="project-name" placeholder="给这组素材起个名字" aria-label="项目名称" value={projectName} maxLength={40} disabled={!!job || converterBusy} onChange={e => setProjectName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={() => { if (!projectName.trim())
        setProjectName('未命名项目'); }}/></div><button className="header-profile" aria-label="编辑头像与姓名" title="编辑头像与姓名" disabled={!!job || converterBusy} onClick={() => navigate('settings')}><span className="header-profile-avatar">{profile.avatar ? <img src={profile.avatar} alt="个人头像"/> : profile.name.slice(0, 1)}</span><span className="header-profile-name">{profile.name}</span><SlidersHorizontal size={15}/></button></header><div className="content"><div className="studio-heading"><div><div className="page-label">{tab === 'collect' ? (mode === 'search' ? '从关键词开始找图' : '带回网页里的图片') : tab === 'converter' ? '让素材适配你的作品' : tab === 'sites' ? '常用素材来源' : tab === 'ai' ? '从创意到素材' : tab === 'board' ? '你的素材准备台' : 'SHICAI STUDIO'}</div><h1>{names[tab]}</h1><p>{tab === 'board' ? '把不同来源的图片放在一起，检测、挑选，再交给下一步。' : tab === 'collect' ? (mode === 'search' ? '输入关键词查看真实图片结果，预览后直接保存原图，或加入收集箱。' : '粘贴公开网页或图片直链，把图片加入同一个收集箱。') : tab === 'converter' ? '已收集源图可直接处理，本地文件也能加入；离线转换，原文件保持原样。' : tab === 'sites' ? '按类型选择网站，关键词可带入站内搜索；找到来源页后可导入图片。' : tab === 'ai' ? '先拆分需求，再找真实素材；缺少的元素可以单独生成。' : tab === 'activity' ? '查看每次处理的结果与跳过原因。浏览器下载需自行确认完成。' : tab === 'saved' ? '留住可复用的素材来源，需要时重新加入项目。' : '个人资料与项目清单保存在当前设备。'}</p></div>{tab === 'collect' && mode === 'search' && <button className="outline" onClick={() => navigate('sites')}><Globe size={17}/>搜图网站 · {searchSites.length}</button>}{tab === 'board' && <button className="primary" disabled={!!job || converterBusy} onClick={() => navigate('search')}><Search size={17}/>寻找图片</button>}</div>
 {(tab === 'board' || tab === 'collect' || tab === 'converter' || tab === 'ai') && <div className="stage-nav"><button className={tab === 'board' ? 'active' : ''} onClick={() => navigate('board')}><span>01</span>收集箱<small>{queue.length}</small></button><ChevronRight size={13}/><button disabled={!!job || converterBusy} onClick={() => { navigate('board'); setView('pending'); }}><span>02</span>检测筛选</button><ChevronRight size={13}/><button className={tab === 'converter' ? 'active' : ''} onClick={() => navigate('converter')}><span>03</span>格式处理</button><ChevronRight size={13}/><button disabled={!!job || converterBusy} onClick={() => { navigate('board'); setView('ready'); }}><span>04</span>整理交付</button></div>}
 {tab === 'sites' && <WebsiteDirectory keyword={input} onKeyword={setInput} custom={mirror} onImport={() => navigate('collect')}/>}
 <div hidden={tab !== 'ai'}><AIStudio projectName={projectName} assets={queue} onCandidates={addToQueue} onSearch={q => { setMode('search'); search(q); }} onProcess={file => { setIncoming({ token: localId(), files: [file], keys: [] }); navigate('converter'); }}/></div>
 <div hidden={tab !== 'converter'}><Converter notify={setToast} onBusy={setConverterBusy} incoming={incoming} onComplete={converterComplete}/></div>
 {tab === 'board' && <><div className="project-stats"><button onClick={() => { setView('all'); setSelected([]); }}><Inbox size={20}/><span><b>{queue.length}</b>已收集</span><small>一个项目，多种来源</small></button><button onClick={() => { setView('pending'); setSelected([]); }}><ScanLine size={20}/><span><b>{queuePending}</b>待检测</span><small>读取真实格式与像素</small></button><button onClick={() => { setView('ready'); setSelected([]); }}><CheckCircle2 size={20}/><span><b>{queueReady}</b>符合标准</span><small>可直接处理与导出</small></button><div><FolderOpen size={20}/><span><b>{cacheCount}</b>已缓存源图</span><small>{(cacheBytes / 1024 / 1024).toFixed(1)} MB · 缓存可用时免重复下载</small></div></div><div className="board-controls"><div className="board-tabs">{[['all', '全部', queue.length], ['pending', '待检测', queuePending], ['ready', '达标', queueReady], ['issues', '待处理', queueIssues]].map(([id, label, count]) => <button key={id} className={view === id ? 'active' : ''} disabled={!!job} onClick={() => { setView(String(id)); setSelected([]); }}>{label}<span>{count}</span></button>)}</div><div className="board-tools"><label className="board-search"><Search size={14}/><input aria-label="筛选收集箱标题" placeholder="筛选收集箱" value={queueSearch} onChange={e => { setQueueSearch(e.target.value); setSelected([]); }}/></label><button className="icon" aria-label="切换紧凑布局" title="切换紧凑布局" onClick={() => setDense(v => !v)}><Layers size={16}/></button><label className="outline compact-upload"><FileUp size={14}/>导入清单<input type="file" accept=".json" aria-label="导入项目清单" disabled={!!job || converterBusy} onChange={e => { importProject(e.target.files?.[0]); e.target.value = ''; }}/></label></div></div>{cacheWarning && <div className="info-box">本地源图缓存暂不可用，仍可处理图片。重新打开后可能需要重新读取源图。</div>}{undo && <div className="undo-strip"><span>项目中的移除操作可以撤销。</span><button onClick={() => { setQueue(undo); setUndo(null); }}><Undo2 size={14}/>撤销移除</button><button className="icon" aria-label="收起撤销提示" onClick={() => setUndo(null)}><X size={13}/></button></div>}</>}
 {tab === 'collect' && <><section className="collect-box"><div className="mode-tabs"><button className={mode === 'search' ? 'active' : ''} disabled={busy || !!job} onClick={() => navigate('search')}><Search size={17}/>关键词搜图</button><button className={mode === 'page' ? 'active' : ''} disabled={busy || !!job} onClick={() => navigate('collect')}><LinkIcon size={17}/>网页提取</button><button className={mode === 'links' ? 'active' : ''} disabled={busy || !!job} onClick={() => { navigate('collect'); setMode('links'); setInput(''); setQuery(''); setItems([]); setStatuses([]); setError(''); setNote(''); setMore(false); }}><ArrowDownToLine size={17}/>图片直链</button><span>{mode === 'search' ? '同时检索，集中筛选' : '把页面里的大图候选带回来'}</span></div><form className="search-box" onSubmit={e => { e.preventDefault(); mode === 'search' ? search(input) : extract(); }}>{mode === 'search' ? <Search size={23}/> : <LinkIcon size={23}/>}{mode === 'links' ? <textarea className="link-input" aria-label="图片直链，每行一个" value={input} onChange={e => setInput(e.target.value)} maxLength={320000} placeholder={'粘贴图片地址，每行一个\nhttps://…/image.png'}/> : <input value={input} onChange={e => setInput(e.target.value)} aria-label={mode === 'search' ? '素材关键词' : '公开网页地址'} maxLength={mode === 'search' ? 180 : 4096} placeholder={mode === 'search' ? '输入关键词，例如：植物、纸张纹理、forest' : '粘贴包含图片的公开网页地址 https://…'}/>}<button className="primary" disabled={busy || !!job}>{busy ? <LoaderCircle className="spin" size={18}/> : <>{mode === 'search' ? '搜索图片' : mode === 'links' ? '导入地址' : '提取候选'}<ArrowRight size={17}/></>}</button>{busy && <button type="button" className="outline" onClick={stopSearch}>停止搜索</button>}</form><div className="under-search">{mode === 'search' ? <><span>检索来源</span><select aria-label="检索来源" value={source} disabled={busy || !!job} onChange={e => setSource(e.target.value)}><option value="bing">全网图片（Bing）</option><option value="all">三个公共图库同时搜索</option><option value="commons">Wikimedia Commons</option><option value="openverse">Openverse</option><option value="artic">芝加哥艺术博物馆</option></select><span className="search-tip">多词扩展搜图；加载更多会用下一组相关词继续找图</span></> : <p>读取公开 HTML 的 srcset 大图、懒加载图片和原图链接；不读取登录内容，最多80张。</p>}</div>{mode === 'search' && suggest(input) && suggest(input) !== input && <div className="suggest-line">词典建议（可编辑）<button onClick={() => setInput(suggest(input))}>{suggest(input)}<ArrowUpRight size={13}/></button></div>}{mode === 'search' && <div className="search-shortcuts"><span>{history.length ? '最近搜索' : '试试搜图'}</span>{(history.length ? history.map(q => [q, q]) : [['植物', 'botanical leaves'], ['纸张纹理', 'paper texture'], ['建筑', 'architecture'], ['复古插画', 'vintage illustration']]).map(([label, q]) => <button key={q} disabled={busy || !!job} onClick={() => search(q)}>{label}</button>)}</div>}{mode === 'search' && domesticSearch}</section>
 </>}
 {(tab === 'collect' || tab === 'saved' || tab === 'board') && <section className={'results ' + (dense ? 'dense' : '')}><div className="section-heading"><div><h2>{tab === 'board' ? '本项目素材' : tab === 'saved' ? '我的素材收藏' : '候选素材'}<span>{shown.length} / {base.length} 张</span></h2><p>{query && tab === 'collect' ? query : tab === 'saved' ? '收藏保留原始来源；可以随时加入当前项目。' : tab === 'board' ? '源图检测与本地缓存可复用，收集箱会自动保存。' : '选择候选后加入收集箱，接着检测和处理。'}</p></div><div className="result-actions"><button className="outline" disabled={!base.length || !!job || busy} onClick={() => { setOnlyPassed(v => !v); setSelected([]); }}>{onlyPassed ? '显示全部候选' : `只看达标 ${passed}`}</button><button className="outline" disabled={!shown.length || !!job || busy} onClick={() => setSelected(shown.slice(0, 12).map(assetKey))}>选择前12张</button></div></div>
 {tab === 'collect' && statuses.length > 0 && <div className="source-status">{statuses.map(s => <span key={s.source} className={s.ok ? 'ok' : 'failed'} title={s.error || s.queries?.join(' / ')}>{s.ok ? <CheckCircle2 size={13}/> : <Globe size={13}/>} {s.name} · {s.ok ? s.count + '张' : s.error}</span>)}</div>}
 {tab === 'collect' && error && shown.length > 0 && <div className="info-box">{error}<button className="text-button" onClick={() => search(query, page)}>重试本批</button></div>}
 {tab === 'collect' && note && <div className="info-box">{note}</div>}
 <details className="quality-settings"><summary><ScanLine size={16}/><b>项目验收标准</b><span>{min ? `长边≥${min}px` : '不限尺寸'} · {format || '全部格式'}{transparent ? ' · 透明PNG' : ''}</span><small>调整规则</small></summary><div className="quality-panel"><div className="quality-label"><ScanLine size={18}/><b>收集标准</b><small>下载时逐张检测</small></div><label>长边至少<select aria-label="最小长边" value={min} disabled={!!job} onChange={e => setMin(Number(e.target.value))}><option value="0">不限尺寸</option><option value="800">800 px</option><option value="1600">1600 px</option><option value="2400">2400 px</option><option value="3000">3000 px</option></select></label><label>实际格式<select aria-label="实际格式" value={format} disabled={!!job} onChange={e => setFormat(e.target.value)}><option value="">全部格式</option>{['PNG', 'JPG', 'WEBP', 'GIF'].map(f => <option key={f}>{f}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={transparent} disabled={!!job} onChange={e => setTransparent(e.target.checked)}/>仅含透明像素的 PNG</label><label className="group-label">入库分类<select aria-label="打包分类" value={group} disabled={!!job} onChange={e => setGroup(e.target.value)}><option value="format">按真实格式</option><option value="color">按主色</option><option value="alpha">按透明状态</option></select></label></div></details><div className="quality-hint"><span>透明、尺寸与格式以源文件检测为准。仅验证静态 PNG 的透明像素，主色为近似取样。</span><button className="text-button" disabled={!shown.length || !!job || busy} onClick={() => process('verify')}><ScanLine size={14}/>检测{chosen.length ? '已选' : '前12张'}</button></div>
 {tab === 'collect' && busy && !shown.length ? <div className="loading-state"><LoaderCircle size={26} className="spin"/><h3>{mode === 'page' ? '正在读取网页…' : '正在寻找图片…'}</h3><p>来源连接失败会单独列出，已连接的图库仍会返回结果。</p></div> : tab === 'collect' && error && !shown.length ? <div className="empty"><Globe size={32}/><h3>这次没能取回素材</h3><p>{error}</p><button className="outline" onClick={() => mode === 'page' ? extract() : search(input || query)}>重新尝试</button></div> : shown.length ? <div className="asset-grid">{shown.map(a => { const k = assetKey(a), q = inspection[k]?.quality, err = inspection[k]?.error, isSaved = saved.some(x => assetKey(x) === k); return <article className={'asset ' + (selected.includes(k) ? 'selected' : '')} key={k}><div className="asset-image"><button className={'select-asset ' + (selected.includes(k) ? 'checked' : '')} disabled={!!job} aria-label={'选择 ' + a.title} onClick={() => toggle(a)}>{selected.includes(k) && <Check size={14}/>}</button><button className="image-open" aria-label={'查看 ' + a.title} onClick={() => setDetail(a)}><AssetPreview asset={a} blob={cache.current.get(k)?.blob} verified={!!q}/></button><span className="format-badge">{q ? q.format + ' · 已验证' : a.format === '待检测' ? '源图待检测' : a.format + ' · 待检测'}</span><button className={'save-asset ' + (isSaved ? 'is-saved' : '')} aria-label={(isSaved ? '取消收藏 ' : '收藏 ') + a.title} onClick={() => bookmark(a)}><Bookmark size={16}/></button></div><div className="asset-body"><button className="asset-title" title={a.title} onClick={() => setDetail(a)}>{a.title}</button><div className="asset-meta"><span>{q ? `${q.width} × ${q.height}` : a.width && a.height ? `${a.width} × ${a.height}（来源标注）` : '尺寸待检测'}</span><span>{sourceNames[a.source]}</span></div><div className={'inspection ' + (err ? 'bad' : q ? meetsQuality(q, min, transparent, format) ? 'good' : 'bad' : '')} title={err || (q ? qualityIssues(q, recipe).join('；') : '')}>{err ? <><X size={13}/>{err}</> : q ? <><span className="color-dot" style={{ background: q.hex }}/>{q.transparent === true ? '含透明像素' : q.transparent === false ? '无透明像素' : q.animated ? '动图 · 透明未验证' : q.color} · {(q.bytes / 1024 / 1024).toFixed(1)}MB {q.declaredMismatch ? ' · 格式已纠正' : ''}{qualityIssues(q, recipe).length ? ' · ' + qualityIssues(q, recipe)[0] : ''}</> : <><ScanLine size={13}/>等待源图检测</>}</div><div className="asset-footer"><span title={a.license}>{a.license}</span><button className="asset-download" aria-label={'保存原图 ' + a.title} disabled={!!job || busy || converterBusy} onClick={() => saveOriginal(a)}><Download size={14}/>保存</button>{tab === 'board' ? <button className="queue-action" disabled={!!job} aria-label={'移除 ' + a.title} onClick={() => removeFromQueue([k])}><Trash2 size={14}/></button> : <button className={'queue-action ' + (queue.some(x => assetKey(x) === k) ? 'in-queue' : '')} aria-label={'加入收集箱 ' + a.title} onClick={() => addToQueue([a])}>{queue.some(x => assetKey(x) === k) ? <Check size={14}/> : <Plus size={14}/>}</button>}<a href={a.page} target="_blank" rel="noreferrer" aria-label={'打开来源 ' + a.title}><ExternalLink size={14}/></a></div></div></article>; })}</div> : <div className="empty"><FolderOpen size={34}/><h3>{onlyPassed ? '暂无符合条件的已验证图片' : tab === 'saved' ? '还没有收藏的素材' : tab === 'board' ? '收集箱等你放入第一组素材' : query ? '没有找到图片候选' : mode === 'search' ? '输入关键词，开始寻找图片' : '从公开页面带回图片'}</h3><p>{onlyPassed ? '先检测一批候选，或调整收集标准。' : tab === 'board' ? '先添加素材；然后检测真实格式、分辨率和透明像素。' : '选择值得保留的图片加入收集箱，再统一处理。'}</p>{tab === 'board' && !queue.length && <div className="empty-entry-actions"><button className="primary" onClick={() => navigate('search')}><Search size={16}/>按关键词寻找图片</button><button className="outline" onClick={() => navigate('converter')}><FileImage size={16}/>直接处理本地图片</button></div>}</div>}
 {tab === 'collect' && mode === 'search' && query && !error && <div className="pagination"><span>已加载 {items.length} 张图片</span><button className="primary" disabled={!more || !!job || busy} onClick={() => search(query, page + 1)}>{busy ? '正在加载…' : more ? '加载更多图片' : '本轮搜索已完成'}<ArrowRight size={14}/></button></div>}
 {base.length > 0 && <div className="collect-toolbar"><div><b>{chosen.length ? `已选择 ${chosen.length} 张` : '每批处理最多12张'}</b><small>{tab === 'board' ? '读取缓存源图后处理，未达标素材会列出具体原因。' : '挑选候选加入项目，再统一检测与处理。'}</small></div>{tab !== 'board' ? <button className="primary" disabled={!shown.length || !!job || busy} onClick={() => addToQueue(chosen.length ? chosen : shown.slice(0, 12))}><Inbox size={17}/>加入收集箱</button> : <><button className="outline" disabled={!shown.length || !!job} onClick={() => process('verify')}><ScanLine size={15}/>检测筛选</button><button className="outline" disabled={!shown.length || !!job} onClick={() => process('convert')}><RefreshCw size={15}/>送去处理</button><button className="primary" disabled={!shown.length || !!job} onClick={() => process('download')}><Download size={16}/>{chosen.length ? '导出已选源图' : '导出前12张'}</button></>}</div>}
 {tab === 'board' && queue.length > 0 && <div className="secondary-toolbar"><button className="text-button" disabled={!shown.length || !!job} onClick={() => process('sheet')}><FileImage size={14}/>导出选片预览</button><button className="text-button" disabled={!queue.length || !!job} onClick={exportProject}><FileDown size={14}/>项目清单</button><button className="text-button" disabled={!queue.some(a => inspection[assetKey(a)]?.error) || !!job} onClick={() => process('verify', queue.filter(a => inspection[assetKey(a)]?.error), true)}>重试失败项</button><button className="text-button" disabled={!chosen.length || !!job} onClick={() => process('verify', chosen, true)}>重新读取已选源图</button><button className="text-button danger" disabled={!chosen.length || !!job} onClick={() => removeFromQueue(selected)}><Trash2 size={13}/>移除已选</button></div>}

 </section>}
 {tab === 'activity' && <section className="activity-list">{runs.length ? runs.map(r => <article key={r.id}><span className={'run-icon ' + r.status}>{r.status === 'error' ? <X size={18}/> : r.status === 'canceled' ? <History size={18}/> : <CheckCircle2 size={18}/>}</span><div><div className="run-heading"><h3>{{ verify: '源图检测', download: '源图包导出', convert: '格式处理', sheet: '选片预览' }[r.kind] || r.kind}</h3><time>{new Date(r.at).toLocaleString('zh-CN')}</time></div><p>{r.summary}</p><small>{r.accepted}/{r.requested}张 · {{ verified: '已检测', saved: '已保存', browser: '交由浏览器下载，待确认', canceled: '已取消', error: '未完成', prepared: '已送去处理', converted: '转换结果待保存' }[r.status]}</small>{r.issues.length > 0 && <details><summary>查看{r.issues.length}项未完成原因</summary>{r.issues.map((e, i) => <p key={i}>{e}</p>)}</details>}</div></article>) : <div className="empty"><History size={32}/><h3>还没有处理记录</h3><p>检测、转换或导出素材后，这里会留下结果和跳过原因。</p><button className="outline" onClick={() => navigate('board')}>回到收集箱</button></div>}</section>}
 {tab === 'settings' && <div className="settings"><section><h2>头像与姓名</h2><div className="profile-preview"><span>{draft.avatar ? <img src={draft.avatar} alt="头像预览"/> : draft.name.slice(0, 1)}</span><label className="upload-label">选择头像<input type="file" aria-label="选择头像" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { avatarFile(e.target.files?.[0]); e.target.value = ''; }}/></label><button className="text-button" onClick={() => setDraft(v => ({ ...v, avatar: '' }))}>恢复文字头像</button></div><label>显示姓名<input aria-label="显示姓名" value={draft.name} maxLength={30} onChange={e => setDraft(v => ({ ...v, name: e.target.value }))}/></label><button className="primary" onClick={() => { if (!draft.name.trim()) {
        setToast('姓名不能为空');
        return;
    } setProfile(normalizePreferences({ profile: draft }).profile); setToast('头像与姓名已更新'); }}>保存个人资料</button><p className="fine">头像自动居中裁切，仅保存在当前设备。安装包不包含你的个人资料。</p></section><section><h2>下载位置</h2>{desktop ? <><label>默认目录<output>{downloadDir || '系统下载目录'}</output></label><div className="setting-actions"><button className="outline" onClick={async () => { try {
        const r = await window.shicaiDesktop!.chooseDownloadFolder();
        if (r.path) {
            setDownloadDir(r.path);
            setToast('下载目录已更新');
        }
        else if (r.error)
            setToast(r.error);
    }
    catch {
        setToast('目录选择失败，请重启重试');
    } }}>选择文件夹</button><button className="text-button" onClick={async () => { try {
        const r = await window.shicaiDesktop!.openDownloadFolder();
        if (r.error)
            setToast(r.error);
    }
    catch {
        setToast('无法打开文件夹');
    } }}>打开文件夹</button></div><p className="fine">每次保存仍可选择其他盘符；权限、目录与磁盘空间问题会显示具体错误。</p></> : <p>网页版保存位置由浏览器决定；桌面版支持默认文件夹和其他盘符。</p>}</section><section><h2>备份与迁移</h2><p>备份包含头像、姓名、收藏、收集箱、项目规则与任务记录。导入会替换当前资料，请先导出一份。</p><div className="setting-actions"><button className="outline" onClick={async () => setToast(saveMessage(await saveBlob(new Blob([JSON.stringify({ version: 3, profile, saved, history, mirror, queue, projectName, recipe, runs }, null, 2)], { type: 'application/json' }), '拾材-资料备份.json')))}>导出资料备份</button><label className="upload-label">导入资料<input type="file" accept=".json" aria-label="导入资料备份" onChange={e => { importSettings(e.target.files?.[0]); e.target.value = ''; }}/></label></div></section><section><h2>自定义搜索 / 镜像入口</h2><p>填入你信任的 HTTPS 搜索地址，用 {'{query}'} 代替关键词。用于打开结果页，不会代理整个网站。</p><label>URL 模板<input aria-label="自定义入口" value={mirrorDraft} onChange={e => setMirrorDraft(e.target.value)} placeholder="https://example.com/search?q={query}"/></label><div className="setting-actions"><button className="outline" onClick={() => { try {
        const u = new URL(mirrorDraft.replace('{query}', 'test'));
        if (u.protocol !== 'https:' || u.username || u.password || mirrorDraft.length > 2000 || !mirrorDraft.includes('{query}'))
            throw Error();
        setMirror(mirrorDraft);
        setToast('入口已保存');
    }
    catch {
        setToast('请输入含 {query} 的 HTTPS 地址，不得包含账号密码');
    } }}>保存入口</button><button className="text-button" onClick={() => { setMirror(''); setMirrorDraft(''); }}>移除</button></div></section><section><h2>本地源图缓存</h2><p>检测后缓存源图，后续处理可复用。总缓存上限120MB，空间不足时移除较早文件。清单与头像不受清理影响。资料备份不包含图片文件。</p><button className="outline" disabled={!!job || converterBusy} onClick={async () => { try {
        await clearCached();
        cache.current.clear();
        setInspection({});
        setCacheCount(0);
        setCacheBytes(0);
        setCacheWarning(false);
        setToast('源图缓存已清理，收集箱与项目清单已保留');
    }
    catch {
        setToast('缓存清理失败，请重试');
    } }}>清理源图缓存</button></section><section><h2>数据与功能边界</h2><p>无需 API 密钥。检索会把关键词发送给所选图库；网页收集会由服务读取你输入的公共地址。图片转换在本机运行，不上传图片。网页版和桌面版的可访问来源取决于各自网络；不保证任何外站始终可连接。</p><p>“含透明像素”不等于精细抠图，“保留源字节”不代表图片从未压缩。芝加哥艺术博物馆提供的是3000像素上限的机构高清版本。</p></section></div>}
 <SoftwareUpdates visible={tab === 'settings'} notify={setToast}/>
 <footer><span>拾材 / SHICAI</span><span>收集 · 检测 · 处理 · 交付</span><span className="creator-signature"><b>时归制作</b><span>希望看到这段文字的你天天开心</span></span></footer></div></main>
 <dialog ref={dialog} onCancel={() => setDetail(null)} onClick={e => { if (e.target === dialog.current)
        setDetail(null); }}>{detail && <div className="detail"><button className="close icon" aria-label="关闭详情" onClick={() => setDetail(null)}><X /></button><div className="detail-preview"><AssetPreview asset={detail} blob={cache.current.get(assetKey(detail))?.blob} verified={!!inspection[assetKey(detail)]?.quality}/></div><div className="detail-info"><span className="page-label">SOURCE MATERIAL</span><h2>{detail.title}</h2><p>{detail.creator}</p><dl><dt>来源标注</dt><dd>{detail.format} · {detail.width && detail.height ? `${detail.width} × ${detail.height}` : '尺寸待检测'}</dd><dt>真实检测</dt><dd>{inspection[assetKey(detail)]?.quality ? displayQuality(inspection[assetKey(detail)].quality!) : inspection[assetKey(detail)]?.error || '尚未检测源文件'}</dd><dt>许可</dt><dd>{detail.license}</dd></dl><p className="fine">使用前核对来源授权。透明PNG只检测透明像素，不提供自动抠图。</p><div className="detail-actions"><button className="outline" onClick={() => addToQueue([detail])}><Inbox size={16}/>加入收集箱</button><button className="primary" disabled={!!job} onClick={() => saveOriginal(detail)}><Download size={16}/>保存原图</button><button className="outline" disabled={!!job} onClick={() => process('verify', [detail])}><ScanLine size={16}/>检测源图</button><a href={detail.page} target="_blank" rel="noreferrer">打开来源页<ExternalLink size={14}/></a>{detail.licenseUrl && <a href={detail.licenseUrl} target="_blank" rel="noreferrer">查看授权<ArrowUpRight size={14}/></a>}</div><textarea readOnly aria-label="来源与署名" value={detail.attribution + '\n' + detail.licenseUrl}/><button className="text-button" onClick={async () => { try {
        await navigator.clipboard.writeText(detail.attribution + '\n' + detail.licenseUrl);
        setToast('署名已复制');
    }
    catch {
        setToast('请手动复制上方署名');
    } }}>复制署名</button></div></div>}</dialog>
 {job && <div className="job-bar" role="status"><LoaderCircle size={18} className="spin"/><span>{job}</span><button onClick={() => jobAbort.current?.abort()}>取消任务</button></div>}
 {toast && <div className="toast" role="status">{toast}<button aria-label="关闭通知" onClick={() => setToast('')}><X size={15}/></button></div>}
 </div>;
}
