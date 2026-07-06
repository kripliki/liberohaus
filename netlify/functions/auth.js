const crypto = require("crypto")

exports.handler = async (event) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    return { statusCode: 500, body: "Missing GITHUB_CLIENT_ID environment variable" }
  }

  const state = crypto.randomBytes(16).toString("hex")
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl(event)}/callback`,
    scope: "repo,user",
    state,
  })

  return {
    statusCode: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
      "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
    body: "",
  }
}

function baseUrl(event) {
  const host = event.headers["x-forwarded-host"] || event.headers.host
  const proto = event.headers["x-forwarded-proto"] || "https"
  return `${proto}://${host}`
}
