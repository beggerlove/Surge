const maxRetry = 2; // 最多重试次数
const timeout = 4000; // 超时时间（ms）

function fetchWithTimeout(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("请求超时"));
    }, timeoutMs);

    $httpClient.get(url, (error, response, data) => {
      clearTimeout(timer);
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

async function fetchAndParse(url) {
  let lastError = null;
  if (
    /^https:\/\/raw\.githubusercontent\.com\/.+/.test(url)
  ) {
    url = FormatUrl(url);
    console.log("Raw 链接转换为 Blob 链接: " + url)
  } else if (/^https:\/\/github\.com\/.+?\/raw\/.+/.test(url)) {
    url = url.replace(/\/raw/, "/blob");
    console.log("Raw 链接转换为 Blob 链接: " + url)
  }
  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      console.log(`请求：${url}`);
      const data = await fetchWithTimeout(url, timeout);
      // console.log(data)
      const parser = new DOMParser();
      const doc = parser.parseFromString(data, 'text/html');
      const scriptTag = doc.querySelector(
        'script[type="application/json"][data-target="react-app.embeddedData"]'
      );

      if (!scriptTag) {
        console.log("未找到目标 <script> 标签");
        break;
      }

      const jsonText = scriptTag.textContent.trim();
      const jsonData = JSON.parse(jsonText);
      let content = ""
      if (jsonData.payload?.blob?.rawLines) {
        content = jsonData.payload.blob.rawLines.join('\n');
        console.log("\n提取成功：Blob URL:\n" + url);
      }
      return content; // 成功则结束
    } catch (err) {
      lastError = err;
      console.log(`第 ${attempt} 次失败：`, err.message);
      if (attempt < maxRetry) {
        console.log("准备重试...\n");
        await new Promise(res => setTimeout(res, 200));
      }
    }
  }

  console.log("全部尝试失败，最后错误：", lastError?.message || lastError);
  return "错误, 请查看log"
}

function FormatUrl(rawUrl) {
  const regex =
    /https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/;
  const match = rawUrl.match(regex);
  if (match) {
    const formattedUrl = `https://github.com/${match[1]}/${match[2]}/blob/${match[3]}/${match[4]}`;
    return formattedUrl;
  } else {
    return "Invalid URL";
  }
}

(async () => {
  if (!$request.url) $done()
  const url = $request.url
  const text = await fetchAndParse(url);
  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: text,
    },
  })
})();