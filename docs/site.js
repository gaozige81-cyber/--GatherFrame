(function () {
  'use strict';
  var config = window.GATHERFRAME_CONFIG, utils = window.GatherFrameRelease;
  var repo = utils.repository(config), status = document.getElementById('release-status');
  var retry = document.getElementById('retry-release');
  document.querySelectorAll('[data-repository]').forEach(function (a) { a.href = repo; });
  document.querySelectorAll('[data-releases]').forEach(function (a) { a.href = repo + '/releases'; });
  document.getElementById('update-source').textContent = repo;
  var copy = document.getElementById('copy-source');
  copy.addEventListener('click', async function () {
    try { await navigator.clipboard.writeText(repo); copy.textContent = '已复制'; }
    catch (_) { copy.textContent = '请选中左侧地址复制'; }
    setTimeout(function () { copy.textContent = '复制地址'; }, 3000);
  });
  function reset() {
    document.querySelectorAll('[data-download]').forEach(function (card) {
      var link = card.querySelector('.download-button');
      link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); link.classList.add('disabled');
      link.textContent = '等待发布'; card.querySelector('.asset-state').textContent = '尚未获取到公开安装包';
    });
    var checksum = document.getElementById('checksums'); checksum.hidden = true; checksum.removeAttribute('href');
  }
  async function check() {
    retry.disabled = true; retry.textContent = '正在检查…'; reset();
    status.textContent = '正在查询公开发布版本…';
    var controller = new AbortController(), timeout = setTimeout(function () { controller.abort(); }, 10000);
    try {
      var response = await fetch('https://api.github.com/repos/' + config.owner + '/' + config.repository + '/releases/latest', {headers: {Accept: 'application/vnd.github+json'}, signal: controller.signal, credentials: 'omit'});
      if (response.status === 404) { status.textContent = '暂未找到公开正式版。安装包发布且仓库公开后，这里会显示下载按钮。'; return; }
      if (response.status === 403 || response.status === 429) throw Error('版本查询暂时受限，请稍后重试，或直接查看 GitHub 发布页。');
      if (!response.ok) throw Error('暂时无法获取版本，请直接查看 GitHub 发布页。');
      var result = utils.release(await response.json(), config);
      var count = 0;
      document.querySelectorAll('[data-download]').forEach(function (card) {
        var asset = result.downloads[card.dataset.download];
        if (!asset) { card.querySelector('.asset-state').textContent = '此版本暂未提供对应安装包'; return; }
        count++;
        var link = card.querySelector('.download-button');
        link.href = asset.url; link.removeAttribute('aria-disabled'); link.classList.remove('disabled');
        link.textContent = '下载 ' + result.version + ' ↗';
        card.querySelector('.asset-state').textContent = (asset.size / 1024 / 1024).toFixed(1) + ' MB · GitHub Releases';
      });
      document.querySelectorAll('[data-version]').forEach(function (el) { el.textContent = result.version; });
      status.textContent = count ? '最新正式版 ' + result.version + ' · 根据你的系统选择下方安装包。' : '已发布 ' + result.version + '，对应安装包尚未上传；可前往发布页查看。';
      if (result.downloads.checksums) { var link = document.getElementById('checksums'); link.href = result.downloads.checksums.url; link.hidden = false; }
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? '版本查询超时，请重试或直接查看 GitHub 发布页。' : error.message === 'Failed to fetch' ? '暂时无法连接 GitHub，请重试或打开发布页查看。' : error.message;
    } finally { clearTimeout(timeout); retry.disabled = false; retry.textContent = '重新检查'; }
  }
  retry.addEventListener('click', check);
  check();
})();
