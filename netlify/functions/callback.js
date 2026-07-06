const crypto = require("crypto")

const STATE_MAX_AGE_MS = 10 * 60 * 1000

exports.handler = async (event) => {
  const { code, state, error, error_description: errorDescription } = event.queryStringParameters || {}

  if (error) {
    return htmlResponse(renderMessage("error", { error, description: errorDescription }))
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return htmlResponse(
      renderMessage("error", { error: "server_misconfigured", description: "Missing GitHub client credentials" })
    )
  }

  if (!isValidState(state, clientSecret)) {
    return htmlResponse(renderMessage("error", { error: "invalid_state", description: "OAuth state mismatch" }))
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

  return htmlResponse(renderMessage("success", { token: tokenData.access_token, provider: "github" }))
}

// Mirrors the signing done in auth.js: verify nonce+timestamp+signature instead
// of comparing against a stored cookie, since that cookie doesn't reliably
// survive the redirect bounce through github.com and back on all browsers.
const STATE_FORMAT = /^([0-9a-f]{32})\.(\d+)\.([0-9a-f]{64})$/

function isValidState(state, secret) {
  if (!state) return false
  const match = STATE_FORMAT.exec(state)
  if (!match) return false
  const [, nonce, timestamp, signature] = match
  const expected = crypto.createHmac("sha256", secret).update(`${nonce}.${timestamp}`).digest("hex")
  const signatureBuffer = Buffer.from(signature, "hex")
  const expectedBuffer = Buffer.from(expected, "hex")
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return false
  }
  const age = Date.now() - Number(timestamp)
  return age >= 0 && age < STATE_MAX_AGE_MS
}

function renderMessage(status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`
  // JSON.stringify doesn't escape "<", so guard against a crafted error/description
  // (attacker-controlled query params) breaking out of the inline <script> tag.
  const safeMessage = JSON.stringify(message).replace(/</g, "\\u003c")
  const humanText =
    status === "success"
      ? "Signed in. You can close this window."
      : `Sign-in failed: ${(payload.description || payload.error).replace(/\.*$/, ".")} Close this window and try logging in again.`
  const htmlEscapedHumanText = humanText.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
  // The human-readable text above is always rendered, so if window.opener is
  // null (e.g. this callback URL, with its now-single-use code, got reopened
  // directly from browser history/session restore rather than as the popup
  // Decap CMS spawns) the user still sees what happened instead of a blank
  // page from an uncaught "Cannot read properties of null" postMessage throw.
  return `
<p id="message" style="font-family: sans-serif;">${htmlEscapedHumanText}</p>
<script>
(function() {
  if (!window.opener) return;
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
    // This page's only job is `window.opener.postMessage(...)`. If any layer
    // in front of this function (CDN, corporate proxy, browser default)
    // applies a stricter Cross-Origin-Opener-Policy, the browser silently
    // severs window.opener the moment this cross-origin popup navigates here,
    // so the postMessage handshake never fires and the popup just sits open.
    // Being explicit here keeps that opener link alive regardless of what a
    // consumer's admin page origin (e.g. a GitHub Pages domain) is.
    headers: { "Content-Type": "text/html", "Cross-Origin-Opener-Policy": "unsafe-none" },
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`,
  }
}
