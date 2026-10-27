export default async function handler(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing target url');
  }

  try {
    // 💡 這裡等一下要填入你在第二步建立的 Cloudflare Worker 網址
    const cfWorkerUrl = `https://bare1.psyduck418.workers.dev/?url=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(cfWorkerUrl, {
      method: req.method,
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0'
      }
    });

    const body = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/html');
    return res.status(response.status).send(body);
  } catch (err) {
    return res.status(500).send(`Proxy Error: ${err.message}`);
  }
}
