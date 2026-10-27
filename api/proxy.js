export default async function handler(req, res) {
  // 取得使用者想要瀏覽的目標網址
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing target url');
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch (e) {
    return res.status(400).send('Invalid target URL format');
  }

  try {
    // 1. 將請求透過你的 Cloudflare Worker 節點抓取目標網頁
    const cfWorkerUrl = `https://bare1.psyduck418.workers.dev/?url=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(cfWorkerUrl, {
      method: req.method,
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    const status = response.status;

    // 2. 如果目標回傳的是 HTML 網頁，我們進行「路徑重寫」
    if (contentType.includes('text/html')) {
      let html = await response.text();
      
      const baseOrigin = `${parsedTarget.protocol}//${parsedTarget.host}`;
      const currentHost = req.headers['host'];
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const proxyBase = `${protocol}://${currentHost}/api/proxy?url=`;

      // 替換絕對路徑或相對路徑的 CSS、JS、圖片，讓它們全部走我們的代理
      // 將 href="..." 與 src="..." 進行智慧轉換
      html = html.replace(/(href|src)=["']([^"']+)["']/gi, (match, attr, val) => {
        // 如果是絕對網址或特殊協議，就保持原樣
        if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:') || val.startsWith('//') || val.startsWith('#') || val.startsWith('javascript:')) {
          return match;
        }

        let absoluteUrl = '';
        if (val.startsWith('/')) {
          absoluteUrl = baseOrigin + val;
        } else {
          // 處理相對路徑
          const basePath = parsedTarget.pathname.substring(0, parsedTarget.pathname.lastIndexOf('/') + 1);
          absoluteUrl = baseOrigin + basePath + val;
        }

        return `${attr}="${proxyBase}${encodeURIComponent(absoluteUrl)}"`;
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(status).send(html);
    }

    // 3. 如果不是 HTML（例如圖片、CSS 檔案、字型等），直接串流或原封不動回傳
    const body = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    return res.status(status).send(Buffer.from(body));

  } catch (err) {
    return res.status(500).send(`Proxy Rewrite Error: ${err.message}`);
  }
}
