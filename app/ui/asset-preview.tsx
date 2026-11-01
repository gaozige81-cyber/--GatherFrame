'use client';
import { useEffect, useState } from 'react';
import type { Asset } from '../lib/assets';
import { mediaUrl, assetKey } from '../lib/quality';
import { readCached } from '../lib/cache';
import { Image as ImageIcon } from 'lucide-react';
export default function AssetPreview({ asset, blob, verified }: {
    asset: Asset;
    blob?: Blob;
    verified?: boolean;
}) { const [src, setSrc] = useState(''), [failed, setFailed] = useState(false); useEffect(() => { let alive = true, url = ''; setFailed(false); setSrc(''); (async () => { try {
    const data = blob || (verified ? (await readCached(assetKey(asset)))?.blob : null);
    if (!alive || !data)
        return;
    url = URL.createObjectURL(data);
    setSrc(url);
}
catch { } })(); return () => { alive = false; if (url)
    URL.revokeObjectURL(url); }; }, [asset.source, asset.id, asset.url, blob, verified]); return failed ? <span className="image-fallback visible"><ImageIcon size={27}/>预览暂不可用 · 来源仍可检查</span> : <img src={src || mediaUrl(asset)} alt={asset.title} loading="lazy" onError={() => setFailed(true)}/>; }
