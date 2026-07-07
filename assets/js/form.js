// Submits .ajax-form forms to the Netlify function that emails poptávky,
// since this site is served from GitHub Pages and can't run its own
// server-side form handling. See netlify/functions/submit-form.js.
(function () {
  var ENDPOINT = "https://liberohaus.netlify.app/.netlify/functions/submit-form"

  var STATUS_TEXT = {
    sending: "Odesílám…",
    success: "Děkujeme, ozveme se vám do dvou pracovních dnů.",
    error: "Odeslání se nepodařilo. Zkuste to prosím znovu nebo nám napište na info@liberohaus.cz.",
  }

  document.querySelectorAll("form.ajax-form").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault()
      submitForm(form)
    })
  })

  function submitForm(form) {
    var statusEl = form.querySelector(".form-status")
    var submitButton = form.querySelector('button[type="submit"]')
    var payload = { page: window.location.pathname, fields: collectFields(form) }

    setStatus(statusEl, "sending")
    submitButton.disabled = true

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        if (!response.ok) throw new Error("request failed")
        form.reset()
        setStatus(statusEl, "success")
      })
      .catch(function () {
        setStatus(statusEl, "error")
      })
      .finally(function () {
        submitButton.disabled = false
      })
  }

  function collectFields(form) {
    var fields = {}
    new FormData(form).forEach(function (value, key) {
      if (fields[key] === undefined) {
        fields[key] = value
      } else if (Array.isArray(fields[key])) {
        fields[key].push(value)
      } else {
        fields[key] = [fields[key], value]
      }
    })
    return fields
  }

  function setStatus(el, state) {
    if (!el) return
    el.textContent = STATUS_TEXT[state] || ""
    el.dataset.state = state
  }
})()
