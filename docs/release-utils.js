(function (root) {
  'use strict';
  function repository(config) {
    if (!/^[a-zA-Z0-9-]+$/.test(config.owner) || !/^[a-zA-Z0-9_.-]+$/.test(config.repository)) throw Error('发布仓库配置无效');
    return 'https://github.com/' + config.owner + '/' + config.repository;
  }
  function downloadURL(value, base) {
    try {
      var u = new URL(value);
      return u.origin === 'https://github.com' && u.href.startsWith(base + '/releases/download/') && !u.username && !u.password ? u.href : '';
    } catch (_) { return ''; }
  }
  function release(data, config) {
    var base = repository(config);
    if (!data || data.draft || data.prerelease) throw Error('尚无可用的正式版本');
    var match = /^v?(\d+\.\d+\.\d+)$/.exec(String(data.tag_name));
    if (!match) throw Error('版本标签格式暂不支持，请到发布页查看');
    var version = match[1], assets = Array.isArray(data.assets) ? data.assets : [];
    var suffixes = {windows: 'Windows-x64-Setup.exe', intel: 'macOS-x64-Installer.zip', apple: 'macOS-arm64-Installer.zip', legacy: 'macOS-x64-Legacy-Installer.zip', bigsur: 'macOS-arm64-BigSur-Installer.zip', checksums: 'SHA256SUMS.txt'};
    var downloads = {};
    Object.keys(suffixes).forEach(function (key) {
      var name = 'ShiCai-' + version + '-' + suffixes[key];
      var asset = assets.find(function (a) { return a.name === name && Number(a.size) > 0 && a.state === 'uploaded'; });
      var url = asset && downloadURL(asset.browser_download_url, base);
      if (url) downloads[key] = {url: url, name: name, size: asset.size};
    });
    return {version: version, downloads: downloads, url: base + '/releases/tag/' + encodeURIComponent(data.tag_name)};
  }
  var api = {repository: repository, release: release};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GatherFrameRelease = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
