# CIE signing: browser connectivity and deferred PAdES in Bun

Research date: 17 October 2026. Scope: the HTTPS PoliNetwork admin dashboard, a Go desktop agent that accesses a CIE through PKCS#11/PC-SC, and a Bun/TypeScript PDF signing backend.

## Recommended architecture

Use a user-activated `polinetwork-esign://` link to launch the agent, then let the agent connect outbound to a fixed PoliNetwork HTTPS/WSS service. Keep document approval and PIN entry in native agent UI. The dashboard receives job status through its ordinary authenticated backend connection. HTTPS polling is the fallback when a proxy blocks WSS. This avoids making Safari loopback behavior, browser local-network permission, or local certificate installation prerequisites for signing.

For a strictly TypeScript backend, use a pinned `@cantoo/pdf-lib` for parsing and incremental PDF serialization, plus `pkijs` and `asn1js` for certificate/CMS structures. Own the small signing-specific adapter: field and appearance creation, fixed-width placeholder offsets, immutable prepare state, DER attribute ordering, external-signature verification, and final byte insertion. Do not write a general PDF parser or use upstream `pdf-lib.save()` on an already signed document.

A synthetic Bun experiment supports this choice, including two visible signatures and xref/object-stream input. It does not establish production interoperability with every Word/LibreOffice PDF, Acrobat, or CIE middleware. Those acceptance tests remain mandatory and are explicitly listed below.

## Evidence and limits

Browser findings below come from vendor documentation, release notes, issue trackers, and source code. No live multi-browser test or physical CIE test was performed. `UNVERIFIED` identifies a missing version-specific result, undocumented product detail, or untested implementation claim. Proposed security controls and implementation algorithms are engineering recommendations, not claims that a browser or library implements them automatically.

Scratch dependencies, generated certificates, sample PDFs, and probes were kept under `/tmp/esign-research-r2/`. No system-wide packages were installed. The only requested repository deliverable is this file.

## Part 1: HTTPS dashboard to local agent

### Browser behavior in October 2026

| Browser/version                           | HTTPS public page to HTTP loopback fetch                                                      | HTTPS public page to WS loopback                            | Consequence                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| Chrome 142 to 144                         | LNA permission applies, alongside ordinary CORS                                               | LNA WebSocket checks were not shipped by default in 142     | Do not infer WS behavior from HTTP behavior                    |
| Chrome 145 to 146                         | Permissions split into local-network and loopback-network                                     | Before the Chrome 147 WS launch                             | Code must tolerate different permission names                  |
| Chrome 147+                               | Loopback permission plus CORS                                                                 | LNA now covers WebSockets                                   | WS does not bypass permission or need for agent authentication |
| Edge 143+                                 | Microsoft documents LNA restrictions beginning in 143                                         | Exact Edge WS shipping milestone **UNVERIFIED**             | Chrome milestone numbers are not Edge release guarantees       |
| Safari 18/macOS 15 and Safari 26/macOS 26 | Treat active HTTPS→HTTP loopback as unsupported pending a successful exact-version test       | Same conservative treatment for HTTPS→`ws:`                 | Provide an outbound channel or extension fallback              |
| Firefox 2025                              | Loopback trust exception exists; exact late-2025 LNA experiment/default matrix **UNVERIFIED** | Loopback trust exception is separate from later LNA rollout | Do not describe 2025 behavior as the current Firefox default   |
| Firefox 147                               | LNA began progressive rollout to ETP Strict users                                             | WS rollout came later                                       | January 2026 change                                            |
| Firefox 151+                              | LNA rollout to all users includes services on the current device                              | Firefox 154 adds WS checks                                  | October 2026 Firefox can prompt too                            |

These are documented implementation milestones, not an executed compatibility matrix. Sources for each row and the Safari qualification follow.

### Chrome and Edge: LNA replaced the PNA server opt-in

Chrome 142 introduced a permission gate for requests from public websites into local/loopback address spaces. A first relevant fetch from `https://admin.polinetwork.org` to `http://127.0.0.1:PORT` or `http://localhost:PORT` can trigger a permission prompt. An earlier user choice or administrator policy changes that result. Denial prevents the request; allowing it does not waive CORS. Chrome's original rollout covered fetch, subresources, and subframe navigation. [Chrome LNA announcement](https://developer.chrome.com/blog/local-network-access).

For literal `127.0.0.1` and the special `localhost` hostname, Chrome already knows the target is loopback and allows the loopback mixed-content exception. No `targetAddressSpace` is required. For a different DNS hostname resolving to loopback, `targetAddressSpace: "loopback"` declares the intended destination before DNS resolution and can avoid an earlier mixed-content rejection. This is a fetch option, not a header or permission bypass. It does not open a permission dialog by itself. Chrome 142 to 144 used permission name `local-network-access`; Chrome 145+ uses `local-network` and `loopback-network`. Querying an unsupported name can reject, so permission introspection must be optional. The ordinary request remains the trigger. Top-level navigation is outside the documented LNA scope. [Chrome adoption guide, updated 18 May 2026](https://docs.google.com/document/d/1QQkqehw8umtAgz5z0um7THx-aoU251p705FbIQjDuGs/edit).

Modern LNA does **not** require `Access-Control-Allow-Private-Network: true`. That header belonged to the abandoned PNA preflight-based design. Ordinary cross-origin preflights still exist, including the deliberately forced preflight proposed below. A custom header does not remove the permission prompt. A compatibility implementation may answer an explicitly received legacy `Access-Control-Request-Private-Network: true` with the matching allow header after all normal checks, but that is unnecessary for the modern LNA path and cannot solve Safari mixed content. [GoogleChrome current LNA guidance](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/security/local-network-access.md).

WebSockets are a separate rollout. Chrome 142 had a developer trial; **Chrome 147, released 7 April 2026, shipped WebSocket LNA checks**. Current `ws://127.0.0.1:PORT` is therefore no escape from LNA. The browser WebSocket constructor has URL and subprotocol arguments, with no fetch-style `targetAddressSpace` option. WebSockets also lack fetch's CORS preflight; the agent must check their `Origin` itself. [Chrome 147 notes](https://developer.chrome.com/release-notes/147), [Blink shipping discussion](https://groups.google.com/a/chromium.org/g/blink-dev/c/O6GMKt44Ups/m/QN6EGeNQBQAJ), [WebSocket API specification](https://websockets.spec.whatwg.org/).

Microsoft documents initial restrictions starting at **Edge 143**, not 142. Its adoption documentation describes the original HTTP scope, but does not establish an exact shipping version for the subsequent WebSocket implementation. That Edge version is **UNVERIFIED** here; test the supported Edge build directly. [Microsoft Edge LNA guide](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access).

#### Enterprise deployment

Chrome's original policies are `LocalNetworkAccessAllowedForUrls` and `LocalNetworkAccessBlockedForUrls`. Chrome 146+ adds separate `LocalNetworkAllowedForUrls`, `LocalNetworkBlockedForUrls`, `LoopbackNetworkAllowedForUrls`, and `LoopbackNetworkBlockedForUrls`. Prefer an exact requesting-site exception for `https://admin.polinetwork.org`, limited to loopback where supported. The patterns concern the requesting site; adding an agent URL is not an equivalent allowlist. Edge also documents its loopback-specific policy starting in 146. [Chrome loopback policy](https://chromeenterprise.google/policies/loopback-network-allowed-for-urls/), [Edge loopback policy](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/loopbacknetworkallowedforurls).

Temporary opt-out controls and IP-address-space overrides are migration tools. Sources differ on sunset details, including subsequent Edge extensions, so a design depending on their continued availability is unsound. A policy grant also does not automatically fix cross-origin iframe Permissions Policy. Keep the signing flow in the top-level admin document. [Chrome enterprise release notes](https://support.google.com/chrome/a/answer/7679408), [Edge stable release notes](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-relnote-stable-channel).

### Safari/WebKit: potentially trustworthy is not an interoperability result

The secure-context standard treats loopback origins specially. That does not prove that every browser allows an HTTPS page's active HTTP/WS requests. WebKit's request to stop treating loopback HTTP as mixed content, **bug 171934**, remained open with March and August 2026 discussion. A related report specifically covers `127.0.0.1`. These are direct reasons not to promise an HTTP-loopback-only implementation on Safari. [WebKit 171934](https://bugs.webkit.org/show_bug.cgi?id=171934), [WebKit 218623](https://bugs.webkit.org/show_bug.cgi?id=218623), [Secure Contexts specification](https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy).

Several apparent fixes address different things:

- **272461**, fixed in April 2024, concerns a WKWebView embedder capability. It is not a general Safari website capability. [WebKit 272461](https://bugs.webkit.org/show_bug.cgi?id=272461).
- **279249**, fixed in March 2025, addresses localhost images and passive/upgradable mixed content on Safari 18/macOS 15. A maintainer explicitly distinguished it from unresolved active-loopback issues. The source exception is conditional on upgradable content, so it cannot establish fetch/WS support. [WebKit 279249](https://bugs.webkit.org/show_bug.cgi?id=279249), [pinned mixed-content checker](https://raw.githubusercontent.com/WebKit/WebKit/295fd224c10d/Source/WebCore/loader/MixedContentChecker.cpp).
- **304164**, reported against Safari 26.2 in December 2025, says `targetAddressSpace: "loopback"` throws because the fetch enum does not accept it. Main was fixed on 16 December. The report's statement that plain fetch succeeds does not specify the initiating page's secure context. The first released Safari version with the enum fix is **UNVERIFIED**. [WebKit 304164](https://bugs.webkit.org/show_bug.cgi?id=304164).

WebKit also added LNA implementation work in July to September 2026. The permission-algorithm work initially lacked a native prompt and failed closed; later work added grant recording and Permissions API support. Current source marks `LocalNetworkAccessEnabled` unstable and default false. That is evidence of work in progress, not evidence that Safari 26 ships a working local-network prompt. [WebKit 319907](https://bugs.webkit.org/show_bug.cgi?id=319907), [WebKit 324190](https://bugs.webkit.org/show_bug.cgi?id=324190), [WebKit preference definitions](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml).

The operational recommendation is to assume HTTPS→HTTP/WS loopback is unavailable on Safari 18 and 26 until the exact supported build passes an acceptance test. **UNVERIFIED:** a complete patch-by-patch Safari 18/26 matrix for both `localhost` and `127.0.0.1`. Adding CORS headers cannot repair a mixed-content rejection. Keep the dashboard HTTPS.

### Firefox: the 2026 prompt is real

Firefox's loopback exceptions permit HTTP loopback without mixed-content blocking. `localhost` and its subdomains have been treated as trustworthy since Firefox 84; HTTP fetch still needs CORS. [Mozilla bug 903966](https://bugzilla.mozilla.org/show_bug.cgi?id=903966), [Mozilla secure-context documentation](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).

Local-network permission changed during 2026:

- Firefox 147, 13 January, started progressive LNA rollout for ETP Strict users. [147 release notes](https://www.firefox.com/en-US/firefox/147.0/releasenotes/).
- Firefox 151, 19 May, began rollout to all users, including services running on the same device. [151 release notes](https://www.firefox.com/en-US/firefox/151.0/releasenotes/).
- Firefox 154, 18 August, extended LNA to WebSockets. [154 release notes](https://www.firefox.com/en-US/firefox/154.0/releasenotes/).

Therefore "Firefox has no LNA prompt" is wrong for the target date. Its enterprise `LocalNetworkAccess` policy exposes `Enabled`, `BlockTrackers`, `EnablePrompting`, `SkipDomains`, and `Locked`. The policy availability table and enterprise release notes disagree on the first supported release, so that introduction version is **UNVERIFIED**; use the policy supported by the actual managed release. [Firefox policy](https://firefox-admin-docs.mozilla.org/reference/policies/localnetworkaccess/), [Enterprise 151 notes](https://support.mozilla.org/en-US/kb/firefox-enterprise-151-release-notes).

### What real products demonstrate

| Product             | Verified mechanism or published behavior                                                                                                            | What it establishes for this project                                                                                                                                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DSS/NexU            | Legacy desktop companion accesses local signing keys for a web flow. DSS 6.3, August 2025, switched its demo to server signing and deprecated NexU. | Useful architectural precedent, not a current endorsement of NexU as the default demo path. [EC FAQ](https://ec.europa.eu/digital-building-blocks/sites/spaces/DIGITAL/pages/880312429/eSignature+FAQ), [DSS documentation/release history](https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/doc/dss-documentation.html). |
| NexU community fork | Documents HTTP `127.0.0.1:9795`, HTTPS `localhost:9895`, loopback binding and per-install certificate generation.                                   | Local endpoints are real, but HTTPS entails trust provisioning. These are this fork's claims, not proof of original NexU's October 2026 support. [Fork documentation](https://github.com/p4535992/nexu).                                                                                                                              |
| Aruba               | Hardware-device signing inside Aruba webmail requires the Aruba SDK Web extension.                                                                  | An extension deployment precedent. Exact extension/native wire protocol and PIN UI are **UNVERIFIED**. [Aruba instructions](https://www.aruba.it/magazine/firma-digitale/come-usare-la-firma-digitale-nella-pec-aruba.aspx).                                                                                                          |
| Dike/GoSign         | Desktop manual describes enabling signing from the web and configuring a RootCA for HTTPS web signing.                                              | A desktop companion with local trust setup exists. Exact 2026 protocol and ports are **UNVERIFIED**. [InfoCert desktop manual](https://knowledgecenter.infocert.digital/documents/Manuale_Utente_GoSign_%28DESKTOP%29_PDF.pdf).                                                                                                       |
| Firma con CIE       | Ministry describes desktop Software CIE and mobile CieSign, using the card and PIN, including PAdES. It describes CIE signing as FEA.               | No documented public browser→localhost API was established. PAdES packaging does not itself turn a CIE signature into a qualified signature. [Ministry instructions](https://www.cartaidentita.interno.gov.it/info-utili/firma-con-cie/).                                                                                             |
| 1Password           | Current browser integration uses native messaging, extension/host restrictions, and platform application checks.                                    | A maintained extension/native model. Historical WebSocket descriptions should not be presented as its current design. [1Password browser security](https://support.1password.com/1password-browser-security/).                                                                                                                        |
| Yubico              | WebAuthn signs authenticator data plus client-data hash; arbitrary signing extension work is explicitly a draft.                                    | WebAuthn is not a CIE PKCS#11 interface and cannot simply replace CMS signing. [Yubico signing concept](https://developers.yubico.com/WebAuthn/Concepts/Using_WebAuthn_for_Signing.html), [draft arbitrary-signing work](https://github.com/Yubico/webauthn-sign-kem-extensions).                                                     |
| Zoom                | `zoommtg:` is a launch scheme. Its historical macOS local web server was removed after the 2019 security incident.                                  | Launch schemes are established; the old local-server design is not a 2026 recommendation. [Zoom employee response](https://community.zoom.com/meetings-2/zoommtg-links-are-blocked-in-edge-37075), [FTC complaint](https://www.ftc.gov/system/files/documents/cases/1923167zoomcomplaint_0.pdf).                                      |
| Spotify             | Publishes Spotify resource URIs and links to installed clients.                                                                                     | Deep-link precedent; its current use of a browser localhost API is **UNVERIFIED**. [Spotify URI documentation](https://developer.spotify.com/documentation/web-api/concepts/spotify-uris-ids).                                                                                                                                        |

### Transport choices for PoliNetwork

| Approach                                | Advantages                                                                                                   | Costs and remaining controls                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| HTTP loopback fetch                     | Small Go service; straightforward JSON; no local TLS certificate                                             | Chromium/Firefox permission prompts, Safari active-content incompatibility, CORS, CSRF, rebinding and port discovery               |
| WS loopback                             | Bidirectional status                                                                                         | Same browser compatibility concerns; LNA now covers current Chrome/Firefox; no ordinary CORS preflight; authenticate WS explicitly |
| HTTPS/WSS loopback                      | Can satisfy Safari mixed-content requirements with a trusted certificate                                     | Certificate issuance, renewal, hostname and trust-store provisioning; TLS does not remove LNA; never ship one shared private key   |
| Custom scheme alone                     | Launches installed agent from a user action                                                                  | Does not return the signature or create a secure channel; OS confirmation, scheme hijacking and untrusted arguments need handling  |
| Scheme plus agent outbound WSS/HTTPS    | Uses ordinary public HTTPS from the browser; no inbound listener or local root certificate; PIN stays native | Backend rendezvous and job authentication; proxy reconnects; installer registers the scheme; native consent remains essential      |
| Browser extension plus native messaging | Removes loopback networking and binds access to an extension/native-host contract                            | Separate browser packages, store review/update lifecycle, Safari app packaging; webpage bridge must restrict origins               |
| Download/sign/upload                    | Broad fallback with no browser-local API                                                                     | Less convenient, but works with existing Software CIE/CieSign; server must verify the returned PDF and expected document revision  |

Chrome and Firefox native messaging use a registered native host and framed messages over standard input/output. Only the extension invokes that host; the website needs a restricted extension bridge. Safari has its own extension/app messaging API. [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging), [Firefox native messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging), [Safari extension/app messaging](https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension).

#### Recommended reverse-channel sequence

This sequence is a proposed application protocol:

1. The authenticated admin session creates a signing job bound to the document revision, user, selected page/rectangle, expected operation and expiry. Backend authorization uses the existing BFF/session rules.
2. A user click opens `polinetwork-esign://sign?ticket=...`. The ticket is short-lived, random and single-use. It contains no PIN, document body, session cookie or reusable bearer credential. Logs redact it.
3. The agent accepts only the `sign` action and a bounded ticket format. It contacts a compiled/configured allowlisted PoliNetwork HTTPS backend. The URI cannot supply arbitrary callbacks, shell commands, paths or PKCS#11 module locations.
4. Redeem the ticket for a restricted job session. Bind it to an enrolled agent key or a fresh key with a browser/native pairing confirmation. A scheme registration is not proof of agent identity; an intercepted ticket must not silently enroll an arbitrary replacement agent.
5. The agent reads the selected signing certificate and sends its DER certificate/chain to the backend. The backend must know the certificate before producing `signing-certificate-v2` and the final to-be-signed digest.
6. The backend prepares immutable PDF/CMS state and sends a signed, expiring job description containing the PDF hash, attributes hash, algorithm, certificate fingerprint, document identity and nonce. The agent authenticates the backend and binds the response to the pending user-approved job.
7. Native UI displays the document identity and requested signing action. For stronger what-you-see-is-what-you-sign guarantees, let the agent obtain the exact prepared PDF, recompute its ByteRange hash and verify the signed attributes. A digest alone cannot prove what document the user saw. Enter the PIN only in native UI and confirm locally.
8. The agent signs locally and returns only certificate material, signature bytes and job identifiers. The backend verifies the signature before embedding it, atomically consumes the job and advances the document revision.
9. The dashboard watches its normal backend status channel. Use outbound HTTPS polling if WSS is unavailable. Treat an already completed job as completed on retry rather than asking for another signature.

Use a job session expiry measured in minutes, bind every message to the job nonce, and require reapproval after expiry or a changed document revision. A malicious local process can forge browser headers; browser controls do not replace native confirmation or endpoint authentication.

### Hardening an optional localhost API

If a loopback fast path is retained, choose the literal IPv4 URL `http://127.0.0.1:PORT` and bind only `127.0.0.1`, not `0.0.0.0` or an unspecified Go listen address. Supporting `::1` requires a separate deliberate binding and matching Host checks. `localhost` can resolve to IPv6 first, so advertising it while listening only on IPv4 causes avoidable failures.

Apply these checks before any card operation:

- Exact `Host: 127.0.0.1:PORT`. Allow only deliberately supported aliases. Reject arbitrary DNS names, wrong ports, and forwarded-host overrides. This blocks the usual DNS-rebinding route to a loopback listener.
- Exact `Origin: https://admin.polinetwork.org`. Reject absent Origin, `null`, suffix matches, arbitrary subdomains and reflected Origin. Use a separate constrained mechanism for CLI diagnostics.
- Sensitive operations accept only POST with JSON and a non-safelisted `X-PoliNetwork-Sign-Token` header. Reject GET mutations, form submissions and `text/plain` bodies. A random per-session token is still required; a constant custom-header value only forces preflight.
- Native pairing/confirmation, one-use job nonces, expiry, replay protection, limits on body size and concurrency, and no broad signing or filesystem API. Keep PIN input native even with loopback.
- OPTIONS validates Host, Origin, requested method and requested header names. It does not sign and cannot require the actual session-token value, because preflight sends header names rather than that value.
- No local authentication cookie. Use `credentials: "omit"`. Send CORS headers on errors for the approved origin so the dashboard can distinguish failures. Reject other origins before side effects, with no allow-origin header.

CORS controls which browser origins can read responses; it is not agent authentication. Preflight-forcing headers prevent ordinary malicious-site form requests from reaching a protected handler, provided the handler itself insists on them. WebSockets require their own Origin check and first-message or single-use-ticket authentication, because a browser WebSocket cannot set the same arbitrary request header. Do not put reusable secrets in WS URLs. [Fetch CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol), [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP WebSocket security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).

#### Exact response headers

For a valid `OPTIONS /v1/sign` requesting POST and the two headers below:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://admin.polinetwork.org
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: Content-Type, X-PoliNetwork-Sign-Token
Access-Control-Max-Age: 300
Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers
Cache-Control: no-store
```

For a permitted actual response, including an application error returned to that permitted origin:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://admin.polinetwork.org
Vary: Origin
Content-Type: application/json
Cache-Control: no-store
X-Content-Type-Options: nosniff
```

Use the actual application status in place of 200 for errors. Omit `Access-Control-Allow-Credentials`, wildcard allow-origin and `Access-Control-Allow-Private-Network` on the modern path. Do not add unrelated allowed methods or headers. Unapproved origins receive 403 without ACAO. Supporting legacy PNA, if explicitly needed in a managed installation, is a separate conditional compatibility branch, not a normal requirement.

```ts
await fetch("http://127.0.0.1:17951/v1/sign", {
  method: "POST",
  mode: "cors",
  credentials: "omit",
  cache: "no-store",
  headers: {
    "Content-Type": "application/json",
    "X-PoliNetwork-Sign-Token": sessionCapability,
  },
  body: JSON.stringify({ jobId, nonce }),
})
```

No `targetAddressSpace` is necessary for this literal address. The dashboard's CSP `connect-src` must explicitly permit the selected loopback endpoint if this path is used. A browser permission denial, mixed-content error, agent-not-running error, and CSP rejection must produce different recovery instructions where diagnostics permit; do not loop on prompts or advise disabling browser security.

## Part 2: deferred PAdES in TypeScript/Bun

### The required profile and the two different hashes

Target PAdES baseline B-B with `/SubFilter /ETSI.CAdES.detached`, a detached CMS object containing the signer certificate, and SHA-256/RSA PKCS#1 v1.5. Include CMS `content-type`, `message-digest` and `signing-certificate-v2`. Omit CMS `signing-time`; put the claimed UTC time in the PDF signature dictionary's `/M`. The ByteRange covers the complete signed revision except its own signature Contents value. `/Name` and `/Reason` are metadata, not substitutes for certificate identity. For this minimal profile, omit signature-policy and commitment-type attributes, which impose further conditions on `/Reason`. B-B does not provide a trusted timestamp or long-term revocation evidence. [ETSI EN 319 142-1 V1.2.1, table 1 and clause 6.3](https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.02.01_60/en_31914201v010201p.pdf).

The prepare/finalize contract must distinguish:

```text
pdfDigest = SHA256(preparedPDF[0:a] || preparedPDF[b:N])
attrsDER  = DER SET OF signed attributes, including message-digest = pdfDigest
agentDigest = SHA256(attrsDER)
rawSignature = RSASSA-PKCS1-v1_5-SIGN(cardKey, SHA-256, attrsDER)
```

The external signer signs the digest of the DER attributes, not the PDF digest directly. Its result is an RSA signature value, not a complete CMS object. The backend embeds that value into the exact CMS state prepared earlier. This distinction follows CMS message-digest and signed-attribute processing. [RFC 5652, sections 5.3 to 5.5 and 11.1 to 11.2](https://datatracker.ietf.org/doc/html/rfc5652).

### Library assessment

Registry versions below were fetched directly on 17 October 2026. Mutable GitHub branches were inspected as well; pin a release/commit and review its actual installed source before implementation.

| Library                           | What is established                                                                                                                                                                                         | Fit for this requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@signpdf/signpdf`                | Fills a prepared placeholder and calls a pluggable async Signer; the Signer returns a complete CMS. It is not an incremental PDF parser/writer or a persistent prepare/finalize service.                    | Can serve a simple one-call workflow with a custom CMS signer. It does not solve preservation of prior PDF signatures. Source uses whole-buffer placeholder discovery; own known offsets are safer for deferred multiple-signature jobs. [Signing source](https://github.com/vbuch/node-signpdf/blob/develop/packages/signpdf/src/signpdf.js).                                                                                                                                                                                                                                                                                 |
| `@signpdf/placeholder-plain`      | Maintainer explicitly says string-based, fragile, no streams, PDF ≤1.3.                                                                                                                                     | Reject for Word/LibreOffice xref/object-stream input. [Project documentation](https://github.com/vbuch/node-signpdf).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `@signpdf/placeholder-pdf-lib`    | Uses loaded upstream pdf-lib, supports a page/rectangle and adds `/AP`, but the current appearance stream is empty. It sets the signature SubFilter when requested.                                         | The widget can have a rectangle without displaying a meaningful signature. Drawing text into an AP requires extra work. Saving with upstream pdf-lib rewrites the file. [Placeholder source](https://github.com/vbuch/node-signpdf/blob/develop/packages/placeholder-pdf-lib/src/pdflibAddPlaceholder.js).                                                                                                                                                                                                                                                                                                                     |
| `@signpdf/signer-p12`             | Uses a server-side private key and adds `signingTime`; no SigningCertificateV2 construction appears in the inspected source.                                                                                | Wrong key custody and wrong minimal PAdES attribute set here. Changing only `/SubFilter` does not fix the CMS. [P12 signer source](https://github.com/vbuch/node-signpdf/blob/develop/packages/signer-p12/src/P12Signer.js).                                                                                                                                                                                                                                                                                                                                                                                                   |
| `node-signpdf`                    | Original name of the scoped `@signpdf` project.                                                                                                                                                             | Not a separate modern incremental-signing solution. [Project history](https://github.com/vbuch/node-signpdf/releases).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Upstream `pdf-lib`                | Reads PDFs with compressed objects, but its save implementation chooses full PDFWriter/PDFStreamWriter serialization. Incremental updates remain a separate feature request/PR.                             | Useful for unsigned PDF preparation; do not use its save on prior signatures. `useObjectStreams:false` changes encoding, not rewrite semantics. [Save implementation](https://github.com/Hopding/pdf-lib/blob/master/src/api/PDFDocument.ts), [issue 816](https://github.com/Hopding/pdf-lib/issues/816), [PR 1741](https://github.com/Hopding/pdf-lib/pull/1741).                                                                                                                                                                                                                                                             |
| `pdf-lib-incremental-save` 1.17.4 | Fork exposes snapshot/change tracking and `saveIncremental(snapshot)`, producing an increment to concatenate. Latest registry release is 29 January 2024.                                                   | Real incremental API, but manual dirty tracking and old release require a careful audit. Do not confuse its return value with a full PDF. Not executed here. [Fork](https://github.com/remdra/pdf-lib-incremental-save), [registry](https://registry.npmjs.org/pdf-lib-incremental-save).                                                                                                                                                                                                                                                                                                                                      |
| `@cantoo/pdf-lib` 2.11.1          | `load(...,{forIncrementalUpdate:true})`, automatic change tracking, incremental `save()` and `commit()`; the documented PDF-signing example explicitly addresses preservation. Published 15 September 2026. | Best tested basis here. Bun probe passed both table and stream inputs with two signatures. Use low-level signature/widget/AP objects and disable unrelated metadata/form appearance changes. [README](https://github.com/cantoo-scribe/pdf-lib), [registry](https://registry.npmjs.org/@cantoo%2Fpdf-lib), [change tracking](https://github.com/cantoo-scribe/pdf-lib/blob/master/src/api/snapshot/IncrementalDocumentSnapshot.ts).                                                                                                                                                                                            |
| PDFKit                            | PDF generation library; can draw a new PDF and participate in a first signature workflow.                                                                                                                   | It does not parse and incrementally update arbitrary uploaded Office PDFs. [PDFKit](https://pdfkit.org/).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pkijs` 3.4.1 and `asn1js` 3.1.0  | Certificate parsing, CMS structures and ASN.1 encoding; PKI.js has CMS signing examples.                                                                                                                    | Suitable for constructing CMS around an external RSA value. Explicitly canonicalize SET OF ordering; do not assume a `toBER()` call alone means canonical DER. Tested in Bun here. [PKI.js CMS example](https://pkijs.org/docs/examples/signing-and-encryption-with-CMS/working-with-CMS-signing/), [attribute implementation](https://github.com/PeculiarVentures/PKI.js/blob/master/src/SignedAndUnsignedAttributes.ts).                                                                                                                                                                                                     |
| `@peculiar/asn1-cms` 2.11.0       | Typed ASN.1 schemas for CMS, with related X.509/PKCS/ESS schemas in the same collection.                                                                                                                    | An alternative schema layer, not a PDF writer, card signer or complete PAdES workflow. Bun runtime compatibility for this package was **UNVERIFIED** by execution here. Avoid mixing two independent CMS representations unnecessarily. [Schema repository](https://github.com/PeculiarVentures/asn1-schema).                                                                                                                                                                                                                                                                                                                  |
| `@libpdf/core` 0.5.3              | New TypeScript library, explicitly supports Bun, incremental saves and CAdES. Published 16 October 2026. Source has a custom `Signer.sign(data, algorithm)` hook and omits CAdES signing-time.              | Promising 2026 candidate, but the inspected guide says visible appearances are not implemented. Its high-level API does not document a durable serialized prepare/finalize transaction. A callback that waits for a card is not the same as a restart-safe two-phase API. **UNVERIFIED:** all requirements together. [Project](https://github.com/LibPDF-js/core), [guide](https://github.com/LibPDF-js/core/blob/main/content/docs/guides/signatures/index.mdx), [CAdES source](https://github.com/LibPDF-js/core/blob/main/src/signatures/formats/cades-detached.ts), [registry](https://registry.npmjs.org/@libpdf%2Fcore). |
| `pdf-signature` 0.0.4             | Registry metadata describes HTML/PDF image-signature placement, with PhantomJS/html-pdf dependencies; last published July 2018.                                                                             | Not evidence of CMS/PAdES support. Reject for cryptographic signing. [Registry and README](https://registry.npmjs.org/pdf-signature).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pades-js`                        | Registry lookup returned 404; a verifiable maintained library under that exact package name was not found.                                                                                                  | **UNVERIFIED:** package identity and capabilities. Do not build a dependency plan around a plausible name. [Registry endpoint checked](https://registry.npmjs.org/pades-js).                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `@digitalbazaar/*`                | The named organization provides forge, linked-data/credential and other cryptographic packages.                                                                                                             | No maintained Digital Bazaar PDF incremental/PAdES package was established. **UNVERIFIED** as a complete solution. Forge is general crypto, not a PDF revision engine. [Organization](https://github.com/digitalbazaar), [forge](https://github.com/digitalbazaar/forge).                                                                                                                                                                                                                                                                                                                                                      |
| `@ninja-labs/verify-pdf` 1.0.0    | Verification helper, last registry release May 2022, with outstanding signature-format and multi-signature issues.                                                                                          | Not a signer or a sufficient PAdES conformance/trust oracle. Treat any use as supplementary. [Project](https://github.com/ninja-labs-tech/verify-pdf), [issues](https://github.com/ninja-labs-tech/verify-pdf/issues), [registry](https://registry.npmjs.org/@ninja-labs%2Fverify-pdf).                                                                                                                                                                                                                                                                                                                                        |

Other 2026 leads deserve evaluation rather than a blanket claim that "no JS PAdES library exists":

- `pdfnative` documents PAdES, multiple signatures and incremental placeholder insertion. Full Office parser interoperability, external CIE signing, visible AP behavior and strict DER behavior remain **UNVERIFIED** here. [Repository](https://github.com/Nizoka/pdfnative), [signature guide](https://github.com/Nizoka/pdfnative/blob/main/docs/guides/signatures.md).
- `@signature-kit/pdf` documents PAdES policies and a remote signer interface. Its documentation alone does not establish append-only preservation, Office xref coverage or a durable prepare/finalize contract. Those are **UNVERIFIED**. [Official PDF signing guide](https://signature-kit.dev/en-US/docs/signing/pdf).
- `tr-esign` claims a TypeScript PAdES implementation with incremental updates. No independent interoperability result was established here. **UNVERIFIED** for this requirement. [Repository](https://github.com/byigitt/tr-esign).
- `@dottedice/pades-pdf-signer` explicitly says it stores signatures in metadata and standard readers will not show a native signature badge. Despite its name, this is not the required ByteRange/CMS signature implementation. [Publisher's package documentation](https://www.npmjs.com/package/@dottedice/pades-pdf-signer).

The useful division of work is PDF parsing/writing in a maintained library, CMS structures in a cryptographic library, and a small audited application layer that joins them. If the real-document acceptance corpus fails, use a mature PDF signing engine such as DSS behind a service boundary. That preserves a Bun application backend, but the actual PDF engine then runs outside Bun and would require agreement to relax the strict TypeScript-only constraint.

### Minimal correct incremental PDF algorithm

The following is an implementation design, using ISO PDF structures and the append-only behavior tested below. It is intentionally more explicit than a generic `sign(pdf)` API.

#### 1. Parse the latest revision, never search the PDF with regex

Load the exact current file bytes. Locate the last valid `startxref`, parse its classic xref section or xref stream, follow `/Prev`, and incorporate any hybrid `/XRefStm`. Resolve newest entries before older entries. Type-2 xref-stream entries reference an `/ObjStm` and an index within its decoded object list; resolve that stream to obtain the logical object. Use a parser for dictionaries, names, strings, indirect references, streams and filters. Binary content can contain misleading `endobj`, `trailer`, `/Contents` and `%%EOF` text.

Keep the original buffer immutable. Resolve the catalog, selected page, `/Annots`, `/AcroForm` and field tree through that object model. Use the highest existing object number and trailer `/Size` to allocate fresh numbers without collisions. Retain the object number and generation when replacing an existing object. Objects originally compressed can be replaced by an ordinary uncompressed object with the same identifier in the new revision.

These details are why the parser must handle compressed objects even if the new increment deliberately uses only ordinary objects. The PDF Association distinguishes mixed xref types across revisions from a hybrid-reference revision that uses both in one revision. [PDF terminology](https://pdfa.org/glossary-of-pdf-terms/), [Cantoo stream writer](https://github.com/cantoo-scribe/pdf-lib/blob/master/src/core/writers/PDFStreamWriter.ts).

For the initial release, reject encrypted documents, broken xref chains, XFA workflows, and unsupported existing certification/field-lock policies instead of silently repairing or rewriting them. Set size/decompression/object-count limits. A repair pass before the first signature can be a separate, explicitly reviewed import operation; repair after an existing signature normally breaks preservation.

#### 2. Create a standalone signature object with reserved bytes

Append an ordinary indirect dictionary, outside any object stream:

```pdf
101 0 obj
<< /Type /Sig
   /Filter /Adobe.PPKLite
   /SubFilter /ETSI.CAdES.detached
   /ByteRange [0 00000000000000000000 00000000000000000000 00000000000000000000]
   /Contents <000000...fixed number of hex digits...000000>
   /M (D:20261017101500Z)
   /Name (Signer display name)
   /Reason (Approval)
>>
endobj
```

The placeholder is illustrative; use a fixed-width replaceable region, then write ordinary decimal integers and pad unused space with ASCII spaces. Record the byte offsets while serializing. Reserve enough CMS capacity for the selected certificate chain and any planned extra attributes, with a hard bound. A 16 to 32 KiB CMS slot is a practical starting policy, not a conformance requirement or a guarantee for every chain. The hexadecimal region needs twice the reserved CMS byte count.

Keep `/M`, `/Name`, `/Reason`, the appearance and all other signed bytes fixed before exposing the digest. PDF string escaping/encoding belongs to the library. Put no `/Cert` entry in this CAdES signature dictionary; certificate material is in CMS. Do not compress this dictionary into an object stream. The existing `@signpdf` helper similarly uses a standalone raw object for placeholder control, but its broader save path is not enough for this application. [Placeholder implementation](https://github.com/vbuch/node-signpdf/blob/develop/packages/placeholder-pdf-lib/src/pdflibAddPlaceholder.js), [PDF signature structures](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf), clauses 7.5.7 and 12.8.

#### 3. Build the signature widget and its actual appearance

A combined terminal field/widget is sufficient for one visible signature:

```pdf
102 0 obj
<< /Type /Annot /Subtype /Widget
   /FT /Sig /T (Signature_job_unique_id)
   /Rect [40 70 260 120]
   /P 12 0 R
   /F 4
   /V 101 0 R
   /AP << /N 103 0 R >>
>>
endobj

103 0 obj
<< /Type /XObject /Subtype /Form /FormType 1
   /BBox [0 0 220 50]
   /Resources << /Font << /F1 104 0 R >> >>
   /Length ...
>>
stream
q
BT /F1 11 Tf 8 30 Td (Signed by Example Person) Tj
0 -15 Td (17 October 2026, approval) Tj ET
Q
endstream
endobj
```

Object 104 is the font resource. `/F 4` sets Print without Hidden/NoView; `/AP /N` is the normal appearance Form XObject in local widget coordinates. A zero-length AP makes a signature invisible even if `/Rect` is nonzero. A signature stamp drawn into the page's `/Contents` is also the wrong implementation for later signers: it changes page content, whereas the new signature's own widget appearance is the intended change.

If field and widget are separate objects, the field has `/FT`, `/T`, `/V` and `/Kids`; the widget has `/Parent` and its annotation/appearance entries. Preserve an existing field hierarchy rather than flattening it. Select a unique fully qualified field name. AP text must be escaped and laid out within the BBox. Production names need an embedded font with the required characters; the simple Helvetica probe does not establish Unicode or PDF/A conformance. [pyHanko signature appearance API and examples](https://docs.pyhanko.eu/en/latest/lib-guide/signing.html#signature-appearance-generation), [PDF interactive-feature corrections](https://pdf-issues.pdfa.org/32000-2-2020/clause12.html).

Convert the browser rectangle through the inverse PDF viewer viewport transform. Account for CropBox offsets, page rotation and `/UserUnit`. Do not merely flip a CSS y-coordinate unless the page is known to be unrotated with matching coordinates. The backend validates a finite rectangle, positive dimensions, selected page index, page bounds and the stored document revision. Test 0/90/180/270-degree rotation and nonzero CropBox origins.

#### 4. Append the necessary page/form replacements

Append a replacement selected-page dictionary preserving every entry except the deliberate `/Annots` update. Preserve all old annotations and append the new widget reference. If `/Annots` is indirect, resolve it and deliberately update the referenced array or replace that entry with an appropriate new array; do not lose its previous contents.

Resolve or create the catalog's `/AcroForm`. Preserve its existing `/Fields`, field hierarchy, resources and other entries; append the new top-level field. Set `/SigFlags` to the prior flags OR `3`, meaning SignaturesExist and AppendOnly. If `/Fields` is an indirect array, resolve it instead of testing only the raw entry's type. An existing form must never be replaced by a fresh one containing only our signature.

Only append a new catalog object when its `/AcroForm`, version or extension entries actually need changing. Avoid unrelated Info/XMP updates, document-wide resource changes, form appearance regeneration, flattening and page-count changes. For PDF 1.x, establish a consistent version/extension declaration before the first signature. EN 319 142-1 clause 5.6 recommends `/ESIC << /BaseVersion /1.7 /ExtensionLevel 2 >>` for the CAdES SubFilter; preserve compatible existing extensions and do not lower the declared version. [ETSI extension guidance](https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.02.01_60/en_31914201v010201p.pdf#page=15), [Cantoo signature example](https://github.com/cantoo-scribe/pdf-lib#using-pdf-lib-to-generate-a-placeholder-for-an-electronic-signature), [AcroForm structure](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf), clause 12.7.2.

#### 5. Write the new xref and trailer

Always retain the old file bytes as an identical prefix, including old xrefs, trailers and EOF markers. The new revision consists of new/replacement objects, its xref representation, and `startxref`/`%%EOF`.

For a classic xref increment, write sorted subsections for changed/new object numbers with absolute file byte offsets and the correct generations. Entries are fixed-width 20-byte records. Supply object-zero's free-list entry consistently with the writer's xref model; do not mark prior live objects free. Then write:

```pdf
xref
...subsections for this update...
trailer
<< /Size 105
   /Root 1 0 R
   /Prev 18342
   /ID [<original-permanent-id> <updated-revision-id>]
   /Info 7 0 R
>>
startxref
...absolute offset of this xref keyword...
%%EOF
```

`/Size` is one greater than the highest allocated object number, across all revisions, not the number of entries in this increment. `/Prev` points to the immediately preceding `startxref` target, which can be a stream object or classic xref section. `/Root` identifies the effective catalog. Preserve relevant trailer metadata such as `/Info`; `/Encrypt` would need consistent encryption handling, so this implementation rejects it. Preserve the permanent first `/ID` and generate a new second ID for a revision. PDF 1.x does not universally require an ID in unencrypted input; create one if absent under the chosen output policy. PDF 2.0 requires it. [PDF Association syntax corrections](https://pdf-issues.pdfa.org/32000-2-2020/clause07.html), [PDF 2.0 ID requirement discussion](https://pdfa.org/the-smallest-possible-valid-pdf/).

**A classic xref section may follow an xref-stream revision.** Older compressed objects remain addressable through the older xref stream via `/Prev`; changed objects can be emitted uncompressed. This is different from a hybrid-reference revision, which uses `/XRefStm` to combine representations within one revision. Do not copy a stale `/XRefStm` from an earlier hybrid trailer into a new standalone classic increment. This mixed-revision case was also exercised successfully in the Bun probe below. [PDF Association glossary, hybrid-reference definition](https://pdfa.org/glossary-of-pdf-terms/), [Cantoo classic incremental writer](https://github.com/cantoo-scribe/pdf-lib/blob/master/src/core/writers/PDFWriter.ts).

If writing a new xref stream instead, its indirect dictionary combines stream and trailer data:

```pdf
105 0 obj
<< /Type /XRef /Size 106 /Root 1 0 R /Prev 18342
   /ID [<original-permanent-id> <updated-revision-id>]
   /W [1 8 2]
   /Index [...first-object-number count pairs...]
   /Length ...
>>
stream
...binary xref entries...
endstream
endobj
startxref
...absolute offset of object 105...
%%EOF
```

`/W` defines field widths; `/Index` lists the object-number ranges represented in this stream. Encode entries big-endian. Type 0 is free, type 1 gives an ordinary object's absolute offset and generation, and type 2 gives its object-stream number and index. Include an entry for the new xref-stream object itself and count it in `/Size`. Use direct values for `/W`, `/Index`, `/Size`, `/Prev`, `/Length` and filter parameters; `/Root` remains an indirect reference. The xref stream is not encrypted. Do not put stream-only keys such as `/W`, `/Index`, `/Filter`, `/Length` into a classic trailer copied from a previous xref-stream dictionary. [PDF xref-stream specification](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf), clause 7.5.8, [current corrections](https://pdf-issues.pdfa.org/32000-2-2020/clause07.html).

For the simplest application adapter, emit a classic xref increment with uncompressed new signature objects and let the library parse older stream revisions. Using `useObjectStreams:false` for the new increment is compatible with preserving an older compressed prefix. It does not mean decompressing or rewriting that prefix.

#### 6. Patch ByteRange, then freeze prepare state

Let `a` be the byte offset of the opening `<` of this signature's Contents value, `b` the first byte after its closing `>`, and `N` the completed revision length. Write `/ByteRange [0 a b N-b]` into its reserved region without changing the file length. Hash bytes `[0,a)` and `[b,N)`. Exclude both hex delimiters along with the hex bytes; do not exclude the `/Contents` key, the rest of the signature dictionary, ByteRange, xref or EOF.

All offsets are bytes, not JavaScript string/UTF-16 positions. Record them in the writer or identify them only within the known newly allocated signature object. Never patch the first global `/ByteRange` or `/Contents` match, which would target an earlier signature. Check every fixed-width write for overflow. [pyHanko ByteRange preparation API](https://docs.pyhanko.eu/en/latest/lib-guide/signing.html#interrupted-signing), [signpdf byte insertion example](https://github.com/vbuch/node-signpdf/blob/develop/packages/signpdf/src/signpdf.js).

Persist the exact prepared bytes, slot offsets/capacity, final ByteRange, PDF digest, canonical attributes DER, attributes digest, certificate DER/chain, document/base-revision identifier, user/job identity, expiry and operation algorithm. Keep this state server-side or authenticate any externalized state. Prepare must return the attributes digest and a job handle, not trust a later client-supplied replacement digest or PDF.

#### 7. Verify and finalize without another PDF save

Verify the returned RSA signature against the prepared attributes and the selected certificate. Reject a different certificate, wrong algorithm, wrong signature length, expired job or stale document base revision. Build the detached CMS from frozen attributes and certificate data, and verify its embedded attribute encoding matches the signed bytes.

Hex-encode CMS and insert it into the reserved Contents payload. Pad the remainder with zero bytes, represented as `00` hex pairs. Keep `<`, `>`, every ByteRange number and the file length unchanged. If the CMS does not fit, abort that prepare transaction and prepare a larger slot, requiring a new signature. Never shift bytes after signing. Publish the final PDF atomically with its expected base revision and make repeat finalize calls idempotent.

A second signer starts by loading the fully finalized first-signer PDF as a new immutable input. It appends a second independent signature dictionary, field/widget/AP and xref increment. The second signature's excluded gap is only its own Contents; it includes the first CMS and all other previous bytes in its signed ranges.

### Approval signatures, certification, and "allowed changes"

Use **approval signatures only** for this workflow. Do not automatically add `/Perms /DocMDP`, a `/Reference` with a DocMDP transform, an all-fields `/Lock`, or a FieldMDP rule that prevents later signing. Certification is a document policy decision, not a prerequisite for PAdES. If a certification signature is used, it must be first; permission 1 prevents normal subsequent signing, while permission 2 permits form filling/signing and permission 3 additionally permits annotations. Existing locks/certification policies must be checked before accepting the document. [pyHanko policy definitions](https://docs.pyhanko.eu/en/latest/api-docs/pyhanko.sign.html#pyhanko.sign.fields.MDPPerm), [PDF DocMDP/FieldMDP corrections](https://pdf-issues.pdfa.org/32000-2-2020/clause12.html).

Preserving old bytes proves cryptographic integrity of the old revision. It does not by itself prove that the current document contains only acceptable later changes. Validators also inspect the semantic differences. A library that rewrites page content, substitutes resources or adds arbitrary annotations might leave the old hash intact yet cause a suspicious-change result.

Limit later increments to the new signature and its necessary form/widget changes. Keep the original page content, signed widgets and appearances unchanged. Avoid `page.drawText()` for a later visible signature. Precreating agreed signature fields before the first signature is even more predictable when positions and signer count are known. When they are not known, append signature fields carefully and verify the exact change class. pyHanko explicitly has signature-field creation/modification rules and a FORM_FILLING category for later signatures. [pyHanko difference analysis](https://docs.pyhanko.eu/en/latest/api-docs/pyhanko.sign.diff_analysis.html).

Adobe may display that an earlier signature covers a prior revision with later signatures present; that is expected. **UNVERIFIED:** exact Acrobat status text and acceptance of this adapter across supported Acrobat versions. A green result in a CMS verifier alone is insufficient. Acceptance must include Acrobat's change analysis and validation of every earlier signature in the final file.

### Building the detached CMS correctly

Use these structures for one RSA signer, with issuer-and-serial SignerIdentifier:

```text
ContentInfo: signedData OID 1.2.840.113549.1.7.2
  [0] EXPLICIT SignedData
    version = 1
    digestAlgorithms = SET { SHA-256 AlgorithmIdentifier }
    encapContentInfo = SEQUENCE { id-data OID 1.2.840.113549.1.7.1 }
      eContent ABSENT, because this is detached
    certificates [0] IMPLICIT = SET OF DER certificates
    signerInfos = SET {
      SignerInfo
        version = 1
        sid = IssuerAndSerialNumber from the signer certificate
        digestAlgorithm = SHA-256
        signedAttrs [0] IMPLICIT = canonical attributes
        signatureAlgorithm = rsaEncryption with NULL parameters
        signature = OCTET STRING containing external RSA bytes
    }
```

Use SHA-256 AlgorithmIdentifier OID `2.16.840.1.101.3.4.2.1`, normally with absent parameters. The sketch uses `rsaEncryption` OID `1.2.840.113549.1.1.1` with NULL parameters for PKCS#1 v1.5 and a separate SHA-256 digest identifier. Do not confuse that with RSA-PSS or the certificate issuer's signature algorithm. [RFC 5754, SHA-2 CMS conventions](https://datatracker.ietf.org/doc/html/rfc5754), [RFC 3370, RSA CMS conventions](https://datatracker.ietf.org/doc/html/rfc3370), [CMS ASN.1 schemas](https://github.com/PeculiarVentures/asn1-schema/tree/master/packages/cms).

The minimal signed attribute set for this design is:

| Attribute              | OID                          | Single attribute value                                                                            |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| content-type           | `1.2.840.113549.1.9.3`       | OBJECT IDENTIFIER `1.2.840.113549.1.7.1`                                                          |
| message-digest         | `1.2.840.113549.1.9.4`       | OCTET STRING of the 32-byte PDF ByteRange digest                                                  |
| signing-certificate-v2 | `1.2.840.113549.1.9.16.2.47` | `SigningCertificateV2` containing ESSCertIDv2 with SHA-256 of the complete signer certificate DER |

Each Attribute is `SEQUENCE { oid, SET OF value }`. SigningCertificateV2 adds two SEQUENCE wrappers around the ESSCertIDv2: its own SEQUENCE and the `certs SEQUENCE OF`. For SHA-256, omit ESSCertIDv2's DEFAULT hashAlgorithm in DER. Do not hash the PEM text, certificate public key, issuer certificate or TBSCertificate alone. RFC 5035's old SHA-1 wording in the certHash explanation has a verified erratum; the hash uses the selected algorithm. [RFC 5035](https://datatracker.ietf.org/doc/html/rfc5035), [verified erratum 2364](https://www.rfc-editor.org/errata/eid2364).

Omit optional ESS `issuerSerial` in this minimal profile; SignerInfo already identifies issuer and serial. EN 319 122-1 recommends omitting it. If included for a separately justified profile, it contains `GeneralNames` with directoryName `[4] EXPLICIT Name`, plus the positive certificate serial INTEGER. Do not reparse an issuer DN from a display string, lose its RDN ordering/string types, or strip the serial INTEGER's required sign-padding byte. `cmsAlgorithmProtection` is optional for the fixed RSA v1.5 profile; adding it means including it before hashing and never reconstructing a different attribute set later. [ETSI EN 319 122-1 V1.3.1, clause 6.3 and note 8](https://www.etsi.org/deliver/etsi_en/319100_319199/31912201/01.03.01_60/en_31912201v010301p.pdf).

DER requires lexicographic sorting of the full encoded elements of every SET OF, including the outer signed-attribute set and any multivalued attribute set. Compare unsigned DER octets, not OID strings. A sequence of attributes that happens to verify cryptographically can still fail strict DER conformance. ASN1.js's `toBER(false)` is an encoder API, not proof that unsorted application values were canonicalized. PKI.js's attribute serialization does not establish an automatic sorting guarantee. [ITU-T X.690 DER rules](https://www.itu.int/rec/T-REC-X.690), [PKI.js attribute source](https://github.com/PeculiarVentures/PKI.js/blob/master/src/SignedAndUnsignedAttributes.ts).

For hashing/signing, the complete attributes encoding begins with universal SET OF tag **`31` hex**, including DER length and body. Inside SignerInfo, signedAttrs uses **`A0` hex**, the implicit constructed context tag zero. It replaces the SET tag; it does not add a wrapper around a nested SET. Keep the length and body byte-for-byte equal. The ContentInfo wrapper uses a different, **explicit** `[0]` around SignedData. Confusing these two cases is a common source of apparently well-formed but invalid signatures. [RFC 5652 signedAttrs digest rules](https://datatracker.ietf.org/doc/html/rfc5652#section-5.4).

On the Go/card side, define the API's input precisely:

- With `crypto.Signer.Sign(..., attrsDigest, crypto.SHA256)`, the digest is already SHA-256; the implementation must produce the matching PKCS#1 v1.5 signature.
- With PKCS#11 `CKM_RSA_PKCS`, pass the SHA-256 **DigestInfo**, not just the 32 digest bytes. DigestInfo is `3031300d060960864801650304020105000420 || attrsDigest` in hex.
- With `CKM_SHA256_RSA_PKCS`, pass the original `attrsDER`; the token hashes it internally. Passing `attrsDigest` here causes double hashing.
- Do not expose raw `CKM_RSA_X_509` as a remote signing API or accept arbitrary caller-selected signing mechanisms.

These mechanisms have different input contracts. Actual CIE middleware mechanism availability, certificate/key pairing and PIN behavior are **UNVERIFIED** on hardware in this research. Discover supported mechanisms and verify a test signature against the selected certificate. [OASIS PKCS#11 mechanisms](https://docs.oasis-open.org/pkcs11/pkcs11-curr/v2.40/cs02/pkcs11-curr-v2.40-cs02.pdf), [RFC 8017 PKCS#1 v1.5 encoding](https://datatracker.ietf.org/doc/html/rfc8017), [Go crypto.Signer](https://pkg.go.dev/crypto#Signer).

### Code sketch for the application adapter

The CMS core below is a small adaptation of the executed probe. The CMS and PDF sketch blocks were also extracted together, executed in Bun, and used to produce a second two-signature PDF that pyHanko validated. It uses the library's certificate structures, keeps the signed attribute order explicit, and inserts an external signature without invoking a private-key signing API. This is not a complete HTTP service. Durable storage, permission checks, document revision locking, native job confirmation, input limits and certificate trust policy belong around it.

```ts
import * as asn1 from "asn1js"
import * as pkijs from "pkijs"
import { createHash, constants, verify, X509Certificate } from "node:crypto"

const SHA256 = "2.16.840.1.101.3.4.2.1"
const DATA = "1.2.840.113549.1.7.1"
const SIGNED_DATA = "1.2.840.113549.1.7.2"
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest()
const buffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer
const der = (value: asn1.BaseBlock) => Buffer.from(value.toBER(false))
const seq = (...value: asn1.BaseBlock[]) => new asn1.Sequence({ value })
const octets = (bytes: Uint8Array) => new asn1.OctetString({ valueHex: buffer(bytes) })
const algorithm = (algorithmId: string) => new pkijs.AlgorithmIdentifier({ algorithmId })

function parseCert(bytes: Uint8Array) {
  const parsed = asn1.fromBER(buffer(bytes))
  if (parsed.offset !== bytes.length) throw new Error("Invalid certificate DER")
  return new pkijs.Certificate({ schema: parsed.result })
}

export function prepareAttributes(certDer: Uint8Array, pdfDigest: Uint8Array) {
  if (pdfDigest.length !== 32) throw new Error("Expected SHA-256 digest")
  const cert = parseCert(certDer)
  const ess = seq(seq(seq(octets(hash(certDer)))))
  const attrs = [
    new pkijs.Attribute({
      type: "1.2.840.113549.1.9.3",
      values: [new asn1.ObjectIdentifier({ value: DATA })],
    }),
    new pkijs.Attribute({
      type: "1.2.840.113549.1.9.4",
      values: [octets(pdfDigest)],
    }),
    new pkijs.Attribute({
      type: "1.2.840.113549.1.9.16.2.47",
      values: [ess],
    }),
  ].sort((a, b) => Buffer.compare(der(a.toSchema()), der(b.toSchema())))

  const attrsDer = der(new asn1.Set({ value: attrs.map((a) => a.toSchema()) }))
  return { cert, attrs, attrsDer, agentDigest: hash(attrsDer) }
}

export function buildCms(
  certDer: Uint8Array,
  pdfDigest: Uint8Array,
  expectedAttrsDer: Uint8Array,
  signature: Uint8Array,
  intermediates: Uint8Array[] = []
) {
  const state = prepareAttributes(certDer, pdfDigest)
  if (!state.attrsDer.equals(Buffer.from(expectedAttrsDer))) {
    throw new Error("Prepare state changed")
  }
  const publicKey = new X509Certificate(certDer).publicKey
  if (publicKey.asymmetricKeyType !== "rsa") throw new Error("Expected RSA key")
  if (
    !verify(
      "sha256",
      state.attrsDer,
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_PADDING,
      },
      signature
    )
  )
    throw new Error("External signature does not match prepare state")

  const signedAttrs = new pkijs.SignedAndUnsignedAttributes({
    type: 0,
    attributes: state.attrs,
  })
  const embeddedAttrs = der(signedAttrs.toSchema())
  if (embeddedAttrs[0] !== 0xa0) throw new Error("Expected implicit signedAttrs")
  embeddedAttrs[0] = 0x31
  if (!embeddedAttrs.equals(state.attrsDer)) throw new Error("Attribute encoding changed")

  const signerInfo = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({
      issuer: state.cert.issuer,
      serialNumber: state.cert.serialNumber,
    }),
    digestAlgorithm: algorithm(SHA256),
    signedAttrs,
    signatureAlgorithm: new pkijs.AlgorithmIdentifier({
      algorithmId: "1.2.840.113549.1.1.1",
      algorithmParams: new asn1.Null(),
    }),
    signature: octets(signature),
  })
  // Validate/deduplicate supplied certificates before this call.
  const certs = [state.cert, ...intermediates.map(parseCert)].sort((a, b) =>
    Buffer.compare(der(a.toSchema()), der(b.toSchema()))
  )
  const signedData = new pkijs.SignedData({
    version: 1,
    digestAlgorithms: [algorithm(SHA256)],
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: DATA }),
    certificates: certs,
    signerInfos: [signerInfo],
  })
  return der(
    new pkijs.ContentInfo({
      contentType: SIGNED_DATA,
      content: signedData.toSchema(true),
    }).toSchema()
  )
}
```

The PDF integration uses Cantoo's actual APIs. The shortened example assumes an already checked unencrypted document, no unsupported locks/XFA, a unique ASCII field name, an unrotated validated rectangle, and an ASCII display label. The production adapter must handle the coordinate/font/version cases described above. It returns the complete prepared PDF, not only an increment.

```ts
import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFString,
  PDFHexString,
  PDFInvalidObject,
} from "@cantoo/pdf-lib"

export async function appendPlaceholder(
  input: Buffer,
  pageIndex: number,
  rect: [number, number, number, number],
  fieldName: string,
  displayLabel: string,
  time: Date,
  capacity = 16_384
) {
  const doc = await PDFDocument.load(input, {
    forIncrementalUpdate: true,
    updateMetadata: false,
  })
  const c = doc.context
  const n = PDFName.of
  const page = doc.getPage(pageIndex)
  const [x1, y1, x2, y2] = rect
  const font = c.register(
    c.obj({
      Type: "Font",
      Subtype: "Type1",
      BaseFont: "Helvetica",
    })
  )
  const label = PDFString.of(displayLabel).toString()
  const ap = c.register(
    c.stream(`q BT /F1 11 Tf 8 20 Td ${label} Tj ET Q`, {
      Type: "XObject",
      Subtype: "Form",
      FormType: 1,
      BBox: [0, 0, x2 - x1, y2 - y1],
      Resources: { Font: { F1: font } },
    })
  )
  const sigDict = c.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "ETSI.CAdES.detached",
    ByteRange: [0, 1111111111, 2222222222, 3333333333],
    Contents: PDFHexString.of("0".repeat(2 * capacity)),
    M: PDFString.fromDate(time),
    Name: PDFString.of(displayLabel),
    Reason: PDFString.of("Approval"),
  })
  const sigBytes = new Uint8Array(sigDict.sizeInBytes())
  sigDict.copyBytesInto(sigBytes, 0)
  const sigRef = c.register(PDFInvalidObject.of(sigBytes))
  const widget = c.register(
    c.obj({
      Type: "Annot",
      Subtype: "Widget",
      FT: "Sig",
      T: PDFString.of(fieldName),
      Rect: rect,
      F: 4,
      P: page.ref,
      V: sigRef,
      AP: { N: ap },
    })
  )
  let annots = page.node.lookupMaybe(n("Annots"), PDFArray)
  if (!annots) {
    annots = c.obj([]) as PDFArray
    page.node.set(n("Annots"), annots)
  }
  annots.push(widget)
  let acro = doc.catalog.lookupMaybe(n("AcroForm"), PDFDict)
  if (!acro) {
    acro = c.obj({ Fields: [] }) as PDFDict
    doc.catalog.set(n("AcroForm"), c.register(acro))
  }
  acro.lookup(n("Fields"), PDFArray).push(widget)
  const priorFlags = acro.lookupMaybe(n("SigFlags"), PDFNumber)?.asNumber() ?? 0
  acro.set(n("SigFlags"), PDFNumber.of(priorFlags | 3))

  const pdf = Buffer.from(
    await doc.save({
      useObjectStreams: false,
      updateFieldAppearances: false,
    })
  )
  if (!pdf.subarray(0, input.length).equals(input)) {
    throw new Error("Incremental save changed the original bytes")
  }

  // Match only the complete raw signature object we just created.
  const raw = Buffer.from(sigBytes)
  const pos = pdf.indexOf(raw, input.length)
  if (pos < 0 || pdf.indexOf(raw, pos + 1) !== -1) {
    throw new Error("Signature placeholder was not uniquely located")
  }
  const text = raw.toString("latin1")
  const range = /\/ByteRange\s*\[\s*0\s+1111111111\s+2222222222\s+3333333333\s*\]/.exec(text)
  const contentsKey = text.indexOf("/Contents <")
  if (!range || contentsKey < 0) throw new Error("Unexpected placeholder serialization")
  const a = pos + contentsKey + "/Contents ".length
  const b = a + 2 * capacity + 2
  if (pdf[a] !== 60 || pdf[b - 1] !== 62) throw new Error("Invalid Contents slot")
  const replacement = `/ByteRange [0 ${a} ${b} ${pdf.length - b}]`
  if (replacement.length > range[0].length) throw new Error("ByteRange overflow")
  pdf.write(replacement.padEnd(range[0].length, " "), pos + range.index, "ascii")
  const pdfDigest = createHash("sha256").update(pdf.subarray(0, a)).update(pdf.subarray(b)).digest()
  return { pdf, a, b, pdfDigest, capacity }
}
```

The bounded regex above recognizes only a generated signature dictionary under our control; it is not parsing the uploaded PDF. For a production writer integration, expose byte offsets directly rather than depending on even this owned serialization shape. Declare the appropriate PDF version/extensions before preparing the first signature; this shortened placeholder function intentionally does not implement that catalog policy.

The application-level split then looks like this. `jobs`, document revision checks and `publishDocumentRevision` are proposed application interfaces, not exports from the PDF libraries:

```ts
// Prepare, after receiving and validating the selected agent certificate.
const prepared = await appendPlaceholder(input, pageIndex, rect, name, label, time)
const attrs = prepareAttributes(certDer, prepared.pdfDigest)
const jobId = await jobs.storeImmutable({
  ...prepared,
  certDer,
  chain,
  attrsDer: attrs.attrsDer,
  userId,
  documentId,
  baseRevision,
  expiresAt,
  nonce,
})
return { jobId, algorithm: "RSASSA-PKCS1-v1_5/SHA-256", digest: attrs.agentDigest.toString("base64") }

// Finalize in a transaction guarded by user, expiry, nonce and base revision.
const state = await jobs.claimForFinalize(jobId, userId, nonce)
const cms = buildCms(state.certDer, state.pdfDigest, state.attrsDer, signature, state.chain)
if (cms.length > state.capacity) throw new Error("CMS exceeds the prepared slot")
const output = Buffer.from(state.pdf)
output.write(cms.toString("hex").padEnd(2 * state.capacity, "0"), state.a + 1, "ascii")
if (output.length !== state.pdf.length) throw new Error("Final PDF length changed")
await publishDocumentRevision(state.documentId, state.baseRevision, output, jobId)
```

The production finalize transaction also checks that the stored signed ranges hash correctly, validates the slot bounds and contents, verifies every existing signature's integrity after assembly, and returns a prior completed result on retries. If publishing succeeds but dashboard refresh fails, report the document as signed and retry the refresh, not the signing operation.

### Tests and independent validators

Use complementary tools. A structural parser, a CMS verifier, a PDF signature verifier and a revision-difference validator answer different questions.

| Tool                     | Use in tests                                                                                              | Limit                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pyHanko                  | Cryptographic signature, certificate path, signed revision coverage and incremental modification analysis | Configure trust deliberately. Do not disable difference analysis to obtain a green result. [Validation guide](https://docs.pyhanko.eu/en/latest/cli-guide/validation.html).                                                                                                                                                |
| Poppler `pdfsig`         | Independent extraction/verification of every signature and its signed byte ranges                         | Trust backend/build differs; not a full ETSI policy/conformance service. [Maintainer source](https://cgit.freedesktop.org/poppler/poppler/tree/utils/pdfsig.cc).                                                                                                                                                           |
| `qpdf --check`           | Xref, stream decoding and structural syntax checks                                                        | Does not establish signature validity or full PDF conformance. Run inspection only; rewriting the final PDF changes signed bytes. [qpdf check documentation](https://qpdf.readthedocs.io/en/stable/cli.html#option-check).                                                                                                 |
| OpenSSL CMS verification | Check detached CMS against extracted signed ByteRange bytes                                               | `-noverify` skips certificate trust; it proves neither PAdES profile nor allowed later changes. [OpenSSL cms manual](https://docs.openssl.org/3.5/man1/openssl-cms/).                                                                                                                                                      |
| EU DSS                   | PAdES profile, trust and signature validation report under its configured policy                          | Demo upload is for synthetic/nonconfidential fixtures only. A self-signed fixture's untrusted result is expected. Use self-hosted DSS for private documents and repeatable CI. [DSS validation demo](https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/validation), [DSS project](https://github.com/esig/dss). |
| ETSI conformance checker | Check profile constraints such as attributes and PDF signature structure                                  | Conformance is different from certificate trust and legal qualification. Not executed here. [ETSI checker](https://signatures-conformance-checker.etsi.org/).                                                                                                                                                              |
| Acrobat Reader           | Human acceptance of visible appearances, earlier-signature status and later allowed changes               | Requires recorded version/platform tests; browser PDF viewers are not equivalent.                                                                                                                                                                                                                                          |

Example commands for fixtures:

```sh
qpdf --check signed-twice.pdf
pdfsig signed-twice.pdf
pyhanko sign validate --pretty-print --trust-replace --trust test-root.pem signed-twice.pdf
openssl cms -verify -inform DER -in signature.der \
  -content signed-ranges.bin -binary -noverify -out verified-content.bin
```

Since pyHanko 0.29, its CLI is distributed separately as `pyhanko-cli`; installing only `pyhanko` no longer supplies the command. Install test dependencies in a project-local/scratch virtual environment or a test container, never globally. [pyHanko CLI installation note](https://docs.pyhanko.eu/en/latest/cli-guide/index.html).

#### What was actually executed

Under `/tmp/esign-research-r2/`, Bun 1.3.11 ran a synthetic probe with `@cantoo/pdf-lib` 2.11.1, `pkijs` 3.4.1 and `asn1js` 3.1.0. A scratch OpenSSL-generated RSA-2048 certificate/key simulated the agent. This did not use a real CIE.

The probe generated two one-page source PDFs: one classic-xref and one with xref/object streams. For each it appended a visible signature field with an AP Form XObject, patched ByteRange, constructed the three-attribute CMS described above, signed the DER attributes externally with Node-compatible RSA APIs, filled Contents, then repeated the process for a second signature. New increments used classic xrefs and uncompressed new objects. Assertions confirmed exact prefix preservation at both saves and successful local RSA verification.

| Check                                             | Classic-xref source                                                              | Xref/object-stream source                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| Source length in final probe                      | 1,306 bytes                                                                      | 1,053 bytes                                         |
| First signed revision                             | 35,286 bytes                                                                     | 35,033 bytes                                        |
| Second signed revision                            | 69,292 bytes                                                                     | 69,036 bytes                                        |
| First signed PDF is an identical prefix of second | Passed                                                                           | Passed                                              |
| Poppler `pdfsig`, both signatures                 | Valid                                                                            | Valid                                               |
| pyHanko 0.37, first signature in final file       | `intact=True`, `valid=True`, `ENTIRE_REVISION`, `FORM_FILLING`, `docmdp_ok=True` | Same                                                |
| pyHanko 0.37, second signature                    | `ENTIRE_FILE`, `NONE`, valid                                                     | Same                                                |
| Visible stamp rendering                           | Not separately rendered                                                          | Poppler-rendered PNG inspected; both labels visible |

For pyHanko the test certificate was explicitly supplied as a scratch trust anchor, giving `bottom_line=True` for all four signatures. This models technical validity, not public trust. Poppler correctly reported an untrusted certificate issuer without importing it into a user trust store. It also emitted an NSS database warning while still verifying both cryptographic signatures. OpenSSL detached-CMS verification was executed successfully for the first stream-input signature. `qpdf` was not present and was not installed; its check is **UNVERIFIED**. DSS/ETSI and Acrobat were not run.

The probe omits production font embedding, PDF/A preservation, catalog extension policy, hostile-input handling, real certificate-chain/revocation policy, persistent transaction handling, and browser transport. A valid synthetic result supports the selected approach, but is not a blanket PAdES conformance certification.

#### Acceptance corpus before implementation is considered complete

1. Real Word and LibreOffice exports, both classic and xref/object-stream forms; signed inputs produced by Software CIE and at least one independent signing engine.
2. At least three sequential signers, different certificates, and checking every prior signature after each append. Include forms, indirect `/Fields` and `/Annots`, hierarchical field names, nonzero generations and old hybrid-reference revisions.
3. Rotated pages, nonzero CropBox origins, `/UserUnit`, Unicode signer names and long labels. Confirm the signature appears at the dashboard-selected rectangle and renders/prints in Acrobat and independent viewers.
4. Certified/locked input is rejected or handled according to an explicitly supported policy. Confirm normal approval signatures permit later signatures without changing the original page content.
5. Wrong certificate, wrong digest, double hashing, wrong padding, unsorted attributes, wrong `A0`/`31` tag, stale prepare state, oversize CMS, expired job and concurrent base revision all fail safely.
6. Truncated/hostile xrefs and streams, resource-exhaustion limits, encrypted input, duplicate names and malformed fields. Never silently fall back to rewriting a previously signed file.
7. Browser tests on supported Chrome, Edge, Firefox and Safari versions, Windows/macOS/Linux installation/launch, denied/revoked permissions, agent absent, proxy blocking WSS and outbound HTTPS polling recovery.
8. Real CIE PKCS#11 middleware on each supported OS: certificate selection, key association, mechanism contract, card removal, cancellation and wrong PIN. No automatic PIN retries or PIN transmission to the backend.

### Repository validation for this research delivery

The repository-required commands were attempted without changing unrelated files. In the supplied checkout they did not pass:

- `pnpm check`: formatting failures in `docs/esign/TRACKER.md` and the separately present `docs/esign/research/cie.md`. The requested `web-and-pades.md` passes its targeted formatter check. The initial pre-report check already failed on `TRACKER.md`.
- `pnpm typecheck`: existing missing `@tanstack/charts`, `@tanstack/react-charts`, `openid-client` and `redis` dependencies, plus backend input type mismatches such as missing `modifiedBy`/`createdBy`.
- `pnpm test`: session/OIDC integration files fail module loading for missing `redis`/`openid-client`.
- `pnpm build`: cannot resolve `@tanstack/charts` from `src/features/dashboard/user-growth-chart.tsx`.

These application checkout failures are separate from the executed signing probe. No dependency installation or application-code fix was made in the repository for this report.
