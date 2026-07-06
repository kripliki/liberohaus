exports.handler = async (event) => {
  const { code, state, error, error_description: errorDescription } = event.queryStringParameters || {}

  if (error) {
    return htmlResponse(renderMessage("error", { error, description: errorDescription }))
  }

  const cookieState = parseCookies(event.headers.cookie).oauth_state
  if (!state || !cookieState || state !== cookieState) {
    return htmlResponse(renderMessage("error", { error: "invalid_state", description: "OAuth state mismatch" }))
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return htmlResponse(
      renderMessage("error", { error: "server_misconfigured", description: "Missing GitHub client credentials" })
    )
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })
  const tokenData = await tokenResponse.json()

  if (tokenData.error) {
    return htmlResponse(renderMessage("error", { error: tokenData.error, description: tokenData.error_description }))
  }

  return {
    ...htmlResponse(renderMessage("success", { token: tokenData.access_token, provider: "github" })),
    headers: {
      "Content-Type": "text/html",
      "Set-Cookie": "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  }
}

function renderMessage(status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`
  // JSON.stringify doesn't escape "<", so guard against a crafted error/description
  // (attacker-controlled query params) breaking out of the inline <script> tag.
  const safeMessage = JSON.stringify(message).replace(/</g, "\\u003c")
  return `
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(${safeMessage}, e.origin);
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>`
}

function htmlResponse(body) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`,
  }
}

function parseCookies(header) {
  return Object.fromEntries(
    (header || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=")
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))]
      })
  )
}
