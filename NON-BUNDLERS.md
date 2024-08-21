# Deploying Local Vault WITHOUT A Bundler

To use this library directly -- i.e., in a classic/vanilla web project without a modern bundler tool -- make a directory for it (e.g., `local-vault/`) in your browser app's JS assets directory.

Then copy over all `dist/auto/*` contents, as-is:

* `dist/auto/lv.js`

    **Note:** this is *not* the same as `dist/bundlers/lv.mjs`, which is only intended [for web application projects WITH a bundler](BUNDLERS.md)

* `dist/auto/adapter.*.js`

* `dist/auto/external/*` (preserve the whole `external/` sub-directory):
    - `idb-keyval.js`
    - `@lo-fi/local-data-lock/ldl.js`,
    - `@lo-fi/local-data-lock/external/@lo-fi/webauthn-local-client/walc.js`
    - `@lo-fi/local-data-lock/external/@lo-fi/webauthn-local-client/external.js`
    - `@lo-fi/local-data-lock/external/@lo-fi/webauthn-local-client/external/asn1.all.min.js`
    - `@lo-fi/local-data-lock/external/@lo-fi/webauthn-local-client/external/cbor.js`
    - `@lo-fi/local-data-lock/external/@lo-fi/webauthn-local-client/external/libsodium.js`
    - `@lo-fi/local-data-lock/external/@lo-fi/webauthn-local-client/external/libsodium-wrappers.js`

## Import/Usage

To import and use **local-vault** in a *non-bundled* browser app:

```js
// {WHICHEVER}: "idb", "local-storage", etc
import from "/path/to/js-assets/local-vault/adapter.{WHICHEVER}.js";

import { connect } from "/path/to/js-assets/local-vault/lv.js";
```

## Using Import Map

If your **non-bundled** browser app has an [Import Map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) in its HTML (strongly recommended!), you can improve the `import` by adding entries for this library and its dependencies:

```html
<script type="importmap">
{
    "imports": {
        "local-vault": "/path/to/js-assets/local-vault/lv.js",

        "local-vault/adapter/idb": "/path/to/js-assets/local-vault/adapter.idb.js",
        "local-vault/adapter/local-storage": "/path/to/js-assets/local-vault/adapter.local-storage.js",
        "local-vault/adapter/session-storage": "/path/to/js-assets/local-vault/adapter.session-storage.js",
        "local-vault/adapter/cookie": "/path/to/js-assets/local-vault/adapter.cookie.js",
        "local-vault/adapter/opfs": "/path/to/js-assets/local-vault/adapter.opfs.js",

        "idb-keyval": "/path/to/js-assets/local-vault/external/idb-keyval.js",

        "@lo-fi/local-data-lock": "/path/to/js-assets/local-vault/external/@lo-fi/local-data-lock/ldl.js",

        "@lo-fi/webauthn-local-client": "/path/to/js-assets/local-vault/external/@lo-fi/local-data-lock/external/@lo-fi/webauthn-local-client/walc.js"
    }
}
</script>
```

Now, you'll be able to `import` the library in your app in a friendly/readable way:

```js
// {WHICHEVER}: "idb", "local-storage", etc
import from "local-vault/adapter/{WHICHEVER}";

import { connect } from "local-vault";
```

**Note:** If you omit the above `"local-vault"` import-map entry, you can still `import` **local-vault** by specifying the proper path to `lv.js` (as shown above). Same for the "adapter" entries.

However, the entries above for `idb-keyval`, `"@lo-fi/local-data-lock"`, and `"@lo-fi/webauthn-local-client"` are more required. Alternatively, you'll have to make the following manual edits:

* edit the `adapter.idb.js` file to change its `import` specifier for `idb-keyval` to the proper path to `idb-keyval.js`

* edit the `ldl.js` file to change its `import` specifier for `"@lo-fi/webauthn-local-client"` to the proper path to `walc.js`

* edit the `lv.js` file to change its `import` specifier for `"@lo-fi/local-data-lock"` to the proper path to `ldl.js`
