// Receives the poptávka (inquiry) forms from kontakt.html and index.html.
// Those pages are served from GitHub Pages, not this Netlify site, so
// Netlify's built-in form detection (which parses HTML at Netlify's own
// deploy time) never sees them — this function is the substitute: the
// pages POST to it directly via fetch(), and it forwards the submission
// as an email through Resend's HTTP API.

const ALLOWED_ORIGINS = ["https://kripliki.github.io"]

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin
  const corsHeaders = buildCorsHeaders(origin)

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" }
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, error: "method_not_allowed" }, corsHeaders)
  }

  let payload
  try {
    payload = JSON.parse(event.body || "{}")
  } catch {
    return jsonResponse(400, { ok: false, error: "invalid_json" }, corsHeaders)
  }

  const fields = payload.fields || {}

  // Honeypot: real visitors never fill this hidden field in, bots that
  // blindly fill every input do. Report success so the bot doesn't retry,
  // but skip sending the email.
  if (fields.company) {
    return jsonResponse(200, { ok: true }, corsHeaders)
  }

  const name = trimString(fields.name)
  const email = trimString(fields.email)
  const phone = trimString(fields.phone)
  const message = trimString(fields.message)

  if (!name || (!email && !phone)) {
    return jsonResponse(400, { ok: false, error: "missing_required_fields" }, corsHeaders)
  }

  const apiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.FORM_TO_EMAIL
  const fromEmail = process.env.FORM_FROM_EMAIL
  if (!apiKey || !toEmail || !fromEmail) {
    return jsonResponse(500, { ok: false, error: "server_misconfigured" }, corsHeaders)
  }

  const interests = Array.isArray(fields.interests)
    ? fields.interests
    : fields.interests
      ? [fields.interests]
      : []

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      reply_to: email || undefined,
      subject: `Nová poptávka z webu — ${name}`,
      text: renderEmailBody({ name, email, phone, message, interests, page: payload.page }),
    }),
  })

  if (!emailResponse.ok) {
    return jsonResponse(502, { ok: false, error: "email_send_failed" }, corsHeaders)
  }

  return jsonResponse(200, { ok: true }, corsHeaders)
}

function renderEmailBody({ name, email, phone, message, interests, page }) {
  const lines = [
    `Jméno a příjmení: ${name}`,
    `E-mail: ${email || "—"}`,
    `Telefon: ${phone || "—"}`,
  ]
  if (interests.length) lines.push(`Zájem o: ${interests.join(", ")}`)
  lines.push("", "Zpráva:", message || "—", "", `Stránka: ${page || "—"}`)
  return lines.join("\n")
}

function trimString(value) {
  return typeof value === "string" ? value.trim() : ""
}

function buildCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

function jsonResponse(statusCode, body, corsHeaders) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify(body),
  }
}
