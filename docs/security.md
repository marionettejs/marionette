# Rendering and application security

Marionette owns rendering and lifecycle. It does not authenticate requests,
authorize operations, sanitize arbitrary HTML, or make an application's API safe.
Keep those boundaries explicit when choosing a renderer or adding a recipe.

## Treat template output as HTML

The default renderer evaluates a function template and the default DOM API inserts
its output as HTML. Interpolating an untrusted value into a template string is
therefore an HTML injection boundary. A model, StateApi, or DataApi does not escape
values simply because it supplied them.

For ordinary user text, use fixed markup and write `textContent` or an input's
`value`. Here is a complete View definition:

```javascript
import { View } from 'marionette';

export const CommentView = View.extend({
  template: () => '<h2></h2><p></p>',
  initialize({ author, body }) {
    this.comment = { author, body };
  },
  onRender() {
    this.el.querySelector('h2').textContent = this.comment.author;
    this.el.querySelector('p').textContent = this.comment.body;
  }
});
```

A body such as `<img src=x onerror=alert(1)>` appears literally. Avoid constructing
attributes, inline scripts, or URLs from that string. OWASP recommends safe DOM
sinks such as `textContent` for this use case; escaping rules depend on the output
context. [DOM XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)

If a feature truly requires rich HTML, define an allowlist and use a maintained
sanitizer appropriate to that context before the value reaches an HTML sink.
Test the actual renderer and DomApi combination; incremental patching is not
sanitization. Do not assume a renderer's text interpolation protections extend to
its raw-HTML escape hatch. [XSS prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## Validate link destinations separately

Assigning `anchor.href` avoids attribute-string interpolation but does not decide
whether a URL's protocol or origin is acceptable. A same-origin application link
can use this complete helper:

```javascript
export function applicationURL(value, base = window.location.href) {
  const url = new URL(value, base);
  const origin = new URL(base).origin;
  if (!['https:', 'http:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error('Expected an HTTP(S) URL on this application origin');
  }
  return url.href;
}
```

This policy intentionally rejects external links. A feature supporting them needs
its own explicit protocol/origin policy. URL acceptance does not establish that the
current user may access the destination. Router guards improve navigation behavior;
server authorization must enforce access for every protected operation.

## Keep API responsibilities in the application

- Validate external data before treating it as an application model. TypeScript
  annotations do not validate a response body.
- Keep credentials out of templates, public static assets, logs, and shared agent
  prompts. Follow the authentication system's handling of cookies/tokens and CSRF.
- Show a useful user-facing failure message; keep stack traces, credentials, and
  raw backend responses out of the page.
- Cancel obsolete requests and reject stale results before committing them.
  Cancellation prevents a late UI write; it does not revoke server permission or
  guarantee that an in-flight mutation was undone.

Marionette has no built-in CSRF or authentication middleware. Follow the API's
security design; consult the [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
for cookie-authenticated requests.

## Apply a deployment policy to the actual bundle

A Content Security Policy belongs to the application response. Test the policy
against the selected template compiler, renderer, scripts, and third-party assets.
Avoid adding `unsafe-eval` merely to accommodate runtime template compilation when
precompiled templates can meet the requirement. CSP is additional protection,
not a replacement for safe rendering. [OWASP CSP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

The [forms](./forms-and-accessibility.md) and [routing](./routing.md) fixtures check
literal text rendering and late results for their specific examples. They are not
a security audit of the reader's application or third-party integrations.
