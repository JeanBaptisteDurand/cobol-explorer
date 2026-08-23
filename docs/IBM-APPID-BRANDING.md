# IBM Cloud App ID - login widget branding

What is configured on the tenant behind "Continue with IBM", how it was set, and
how to change it. Kept because none of it lives in this repository: it is state
on the App ID instance, and the next person to touch it will otherwise guess.

## What is set

| Setting | Value |
|---|---|
| Header band | `#161616` - the product's Carbon ground |
| Logo | `docs/appid-login-logo.png` - the aperture mark plus the wordmark, dark on transparent |
| Tab title | `COBOL Explorer - sign in` |
| Footnote | `Mainframe reasoning workshop · cobol-explorer.fr` (replaces "Powered by App ID") |

The logo is the **light-background** variant: App ID places it on the widget's
white body, not on the header band, so the C is `#161616` rather than the
off-white the product uses. The beam keeps the brand amber.

## What App ID does not let you change

The **Sign in button stays App ID's blue.** The management API exposes the header
colour, the logo and the two strings - and nothing else. Matching it to
`--interactive` would need a fully self-hosted login page, which is not worth it
for a federated path that sits beside a working password form.

## How to change any of it

Everything below needs an IBM Cloud IAM API key with access to the App ID
instance. Exchange it for a token first:

```bash
TOK=$(curl -s -X POST https://iam.cloud.ibm.com/identity/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=urn:ibm:params:oauth:grant-type:apikey" \
  --data-urlencode "apikey=$IBMCLOUD_API_KEY" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

T=a7ed3840-1536-46e5-b265-9464aab2d2cb   # tenant, us-south
BASE=https://us-south.appid.cloud.ibm.com/management/v4/$T/config/ui
```

Read the current state:

```bash
for ep in theme_text theme_color media; do curl -s -H "Authorization: Bearer $TOK" "$BASE/$ep"; echo; done
```

Write. **Note the methods**: the logo is a `POST` multipart, the other two are
`PUT` with JSON. A `POST` to either of those returns 404, which is a confusing way
to say "wrong verb".

```bash
curl -X POST -H "Authorization: Bearer $TOK" \
     -F "file=@docs/appid-login-logo.png;type=image/png" \
     "$BASE/media?mediaType=logo"

curl -X PUT -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
     -d '{"headerColor":"#161616"}' "$BASE/theme_color"

curl -X PUT -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
     -d '{"tabTitle":"COBOL Explorer - sign in","footnote":"Mainframe reasoning workshop · cobol-explorer.fr"}' \
     "$BASE/theme_text"
```

The widget serves the change immediately; there is no cache to clear. Check it by
following the real entry point rather than the console preview:

```bash
open "$(curl -s -o /dev/null -w '%{redirect_url}' https://cobol-explorer.fr/api/auth/ibm)"
```

## Regenerating the logo

The lockup is the mark from `web/src/components/Logo.tsx` beside the wordmark in
IBM Plex Sans 600, rendered at 560×150 on transparency. Rebuild it by rendering
that SVG with `stroke="#161616"` next to the text and exporting at 2x - or edit
the PNG directly; nothing reads it but App ID.

## Console equivalent

Everything above is also under
[cloud.ibm.com/resources](https://cloud.ibm.com/resources) → the App ID instance →
**Manage Authentication → Login Customization**.
Reference: [Customizing the Login Widget](https://cloud.ibm.com/docs/services/appid/login-widget.html) ·
[Management API](https://cloud.ibm.com/apidocs/app-id/management)
