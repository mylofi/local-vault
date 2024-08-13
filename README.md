# Local Vault

[![npm Module](https://badge.fury.io/js/@lo-fi%2Flocal-vault.svg)](https://www.npmjs.org/package/@lo-fi/local-vault)
[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

**Local Vault** provides a client-side, key-value storage API abstraction, with automatic encryption/decryption secured by biometric passkeys.

----

[Library Tests (Demo)](https://mylofi.github.io/local-vault/)

----

A *local vault* instance is a simple key-value store (`get()`, `set()`, etc), backed by [your choice among various client-side storage mechanisms](#client-side-storage-adapters) (`localStorage` / `sessionStorage`, IndexedDB, cookies, and OPFS).

The primary feature of this library is automatically handling encryption (on write) and decryption (on read) from a local vault's data -- so data is always encrypted at-rest -- all client-side with no servers.

The cryptographic encryption/decryption key is furthermore protected locally in the client in a biometric passkey (i.e., in an authenticator, secure enclave, etc). Users can thus safely access their protected data with a simple biometric passkey authentication -- no troublesome passwords, and no privacy-eroding remote servers!

**Local Vault** directly depends on [**Local-Data-Lock**](https://github.com/mylofi/local-data-lock), which depends on [**Webauthn-Local-Client**](https://github.com/mylofi/webauthn-local-client).

## Client Side Storage Adapters

**Local Vault** ships with these five adapters, for choosing where/how on the client to store the encrypted vault data:

* `idb`: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
* `local-storage`: [Web Storage `localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
* `session-storage`: [Web Storage `sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
* `cookie`: [Web cookies](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies)
* `OPFS`: [Origin Private File System](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), specifically [virtual origin filesystem](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/getDirectory)

Each of these client-side storage mechanisms has its own pros/cons, so choice should be made carefully.

However, IndexedDB (`idb` adapter) is the most robust and flexible option, and should generally be considered the best default.

### Storage Limitations

[Client-side storage is notoriously volatile](https://web.dev/articles/storage-for-the-web). However, this library allows you to request the user's device to [treat client-side storage as *persistent*](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist):

```js
import { keepStorage } from "..";

// will check for persistent storage, ask for it
// if possible, and potentially prompt the user
// to confirm (if necessary)
var storageIsPersistent = await keepStorage();
if (storageIsPersistent) {
    // let the user know their storage is safe!
}
else {
    // warn the user their storage may not be
    // as reliable as desired
}
```

Moreover, some client storage mechanisms have different storage limits, which in some cases may be rather small (i.e., 5MB). Be careful with `set()` calls: look for the [`QuotaExceededError` DOM exception](https://developer.mozilla.org/en-US/docs/Web/API/DOMException#quotaexceedederror) being thrown, and determine what data can be freed up, or potentially switch to another storage mechanism with higher limits.

For example:

```js
try {
    vault.set("app-data",allMyAppData);
}
catch (err) {
    if (err.reason?.name == "QuotaExceededError") {
        // handle storage limit failure!
    }
}
```

#### Web Storage (`localStorage`, `sessionStorage`)

The web storage mechanisms (`localStorage`, `sessionStorage`) are by far the most common place web applications storage client-side data. However, there are some factors to consider when using the `local-storage` / `session-storage` adapters.

Each mechanism is size-limited to 5MB, on most all browsers/devices. And they are only available from main browser threads, not in workers (Web Workers, Service Workers).

#### Cookies

The `cookie` adapter stores vault data in browser cookies. There are however some strong caveats to consider before choosing this storage mechanism.

Cookies are typically limited to 2MB. Moreover, data in the cookie must be URI-encoded (e.g, replacing spaces with `%20`), which increases your data size further towards this limit. And there's no exception thrown if you exceed the limit, it may just silently truncate (corrupt) data on write. For stable behavior, you'll need to carefully monitor your own data size to stay comfortably under that limit.

Also, cookies are typically sent on *every request* to a first-party origin server (images, CSS, fetch calls, etc). So that data (encrypted, of course) will be sent remotely, and will weigh down all those requests.

Moreover, cookies are never "persistent" storage, and are subject to both expirations (maximum allowed is ~400 days out from the last update) and to users clearing them.

All these concerns considered, the `cookie` adapter *really should not be used* except as a last resort. For example, your app might use this storage as a temporary location if normal storage quota has been reached, and later synchronize/migrate/backup off-device, etc.

#### Origin Private File System

The [Origin Private File System](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) (OPFS) web feature can be used to read/write "files" in a virtual filesystem on the client's device (private to the page's origin). The `opfs` adapter provided with this library creates JSON "files" in this OPFS to store the vault data, one per vault.

Be aware: [the ability to asynchronously `write()`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream/write#browser_compatibility) on the main browser thread, into OPFS, is currently only supported on desktop (not mobile!) Chromium and Firefox browsers.

However, there is [widespread browser/device support for synchronous `write()`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle#browser_compatibility) into OPFS, if done off-thread in a background worker (Web Worker, Service Worker). The `opfs` adapter does *not currently* support this approach, but it may in the future. Developers can also write their own such adapter, using the `defineAdapter()` method of **Local Vault**.

## Deployment / Import

```cmd
npm install @lo-fi/local-vault
```

The [**@lo-fi/local-vault** npm package](https://npmjs.com/package/@lo-fi/local-vault) includes a `dist/` directory with all files you need to deploy **Local Vault** (and its dependencies) into your application/project.

**Note:** If you obtain this library via git instead of npm, you'll need to [build `dist/` manually](#re-building-dist) before deployment.

* **USING A WEB BUNDLER?** (Astro, Vite, Webpack, etc) Use the `dist/bundlers/*` files and see [Bundler Deployment](BUNDLERS.md) for instructions.

* Otherwise, use the `dist/auto/*` files and see [Non-Bundler Deployment](NON-BUNDLERS.md) for instructions.

## `WebAuthn` Supported?

To check if `WebAuthn` API and functionality is supported on the device, consult the `supportsWebAuthn` exported boolean:

```js
import { supportsWebAuthn } from "..";

if (supportsWebAuthn) {
    // welcome to the future, without passwords!
}
else {
    // sigh, use fallback authentication, like
    // icky passwords :(
}
```

## Creating A Local Vault

// TODO

## Re-building `dist/*`

If you need to rebuild the `dist/*` files for any reason, run:

```cmd
# only needed one time
npm install

npm run build:all
```

## Tests

Since the library involves non-automatable behaviors (requiring user intervention in browser), an automated unit-test suite is not included. Instead, a simple interactive browser test page is provided.

Visit [`https://mylofi.github.io/local-vault/`](https://mylofi.github.io/local-vault/), and follow instructions in-page from there to perform the interactive tests.

### Run Locally

To locally run the tests, start the simple static server (no server-side logic):

```cmd
# only needed one time
npm install

npm run test:start
```

Then visit `http://localhost:8080/` in a browser.

## License

[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

All code and documentation are (c) 2024 Kyle Simpson and released under the [MIT License](http://getify.mit-license.org/). A copy of the MIT License [is also included](LICENSE.txt).
