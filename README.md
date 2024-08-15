# Local Vault

[![npm Module](https://badge.fury.io/js/@lo-fi%2Flocal-vault.svg)](https://www.npmjs.org/package/@lo-fi/local-vault)
[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

**Local Vault** provides a client-side, key-value storage API abstraction, with automatic encryption/decryption secured by biometric passkeys -- no servers required!

```js
var vault = await connect({ .. });

await vault.set("Hello","World!");       // true

await vault.get("Hello");               // "World!"
```

----

[Library Tests (Demo)](https://mylofi.github.io/local-vault/)

----

## Overview

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

### Enabling Adapters

To load a storage mechanism's adapter (e.g., `idb` for IndexedDB):

```js
import "@lo-fi/local-vault/adapter/idb";

import { connect } from "@lo-fi/local-vault";
```

You can load all five adapters, or only one. But you must have at least one adapter defined, and calls to `connect()` must always specify a storage-type that matches one of the loaded adapters.

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

## Local Vaults

A "local vault" is a JS object (JSON compatible), with the following three properties:

* `accountID` string, holding the ID of the "local account" attached to one or more device passkeys, which themselves hold the encryption/decryption cryptographic key

* `rpID` string, holding the "ID" of the "relying party", which for web applications should almost always be the fully-qualified hostname (i.e., `document.location.hostname`) of the webapp

* `data` string, holding the encrypted data in base64 encoding

This local vault object is stored in the [client storage mechanism](#client-side-storage-adapters) you choose, either directly (for IndexedDB) or as a JSON serialized string.

## Setting up a local vault instance

The local vault object described previously is distinct from the vault-instance that you interact with in code. The vault-instance exposes a simple API (`get()`, `set()`, etc) for managing key-value style data access. Encryption and key-management is all handled automatically while interacting with the vault-instance.

To setup a new vault-instance, use the `connect()` method:

```js
import "@lo-fi/local-vault/adapter-idb";
import { connect } from "..";

// new vault-instance
var vault = await connect({
    storageType: "idb",
    addNewVault: true,
    keyOptions: {
        username: "passkey-user",
        displayName: "Passkey User"
    }
});

vault.id;               // ".." (auto-generated string)
vault.storageType;      // "idb"
```

The `storageType` is required on every `connect()` call. You'll likely do all your vault storage in *one* storage mechanism, so this is probably a fixed value you configure once in your app code -- rather than being an option the user chooses, for example.

Any options set under `keyOptions` are passed along to the underlying [**Local Data Lock** library's `getLockKey()` method](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#registering-a-local-account).

**Note:** The `username` / `displayName` key-options illustrated above are not strictly required, but are strongly recommended; they're only passed along to the biometric passkey, as meta-data for such. The device will often use one or both values in its prompt dialogs, so these values should either be something the user has picked, or at least be something the user will recognize and trust. Also, there may very well be multiple passkeys associated with the same local account, so the username/display-name should be differentiated to help the users know which passkey they're authenticating with.

### Manually Setting Lock-Key

To manually set a new vault's lock-key -- for example, when importing a lock-key from another device:

```js
var vault = await connect({
    storageType: "idb",
    addNewVault: true,
    keyOptions: {
        // created by another vault instance, even on
        // another device
        useLockKey: existingLockKey
    }
});
```

**Warning:** Be judicious with this feature. If for example you're synchronizing keypair identities between a user's multiple devices, this functionality can be useful. But otherwise, it's better (more secure!) to let **Local Vault** automatically generate and internally manage its cryptographic keypair.

## Reconnecting a Vault

You may save the auto-generated `vault.id` value from a `connect()` call, to use in subsequent reconnections, again using `connect()`:

```js
var vault = await connect({
   storageType: "idb",
   vaultID: existingVaultID     // saved from previous connect() call
});
```

**Note:** If the vault's lock-key (biometric passkey protected) is still in the recent-access cache (default timeout: 30 minutes), a `connect()` call will complete silently. Otherwise, the user will be prompted by the device to re-authenticate with their passkey (to access the lock-key) before unlocking the vault.

### Discoverable Vaults

Saving the `vault.id` to use later does create a bit of a chicken-and-the-egg problem, because then you have to separately choose which client-side storage you want to persist that value in, and manage it appropriately. The value may even be saved at first but lost later.

So you can instead use "discovery" mode to detect which vault to use, based on which passkey the user chooses to authenticate with:

```js
var vault = await connect({
    storageType: "idb",
    discoverVault: true
});
```

Discovery mode should only be used when you're sure the user has already setup a vault on this device. If a suitable passkey is not authenticated with, and matching vault is not found, a discovery mode `connect()` call will fail with an exception.

**Note:** Discovery mode will *always* prompt the user for passkey authentication. This might mean a user would have to reauthenticate on each page load, for example. As an affordance to reduce user friction, you might choose to store the vault-ID in `sessionStorage`, along with a timestamp. Even after page refreshes, you might keep using this vault-ID **without** discovery mode. But after a certain amount of time since last authentication has passed, you might choose to push for reauthentication by discarding the known vault-ID and using discovery mode. Alternatively, you might call `lock()` on the vault-instance after a certain period of time, thereby ensuring the next vault operation will re-prompt the user for passkey authentication.

## Removing All Local Data

As a full-reset (across all defined storage mechanisms), `removeAll()` will clear out all local vaults:

```js
import { removeAll } from "..";

var success = await removeAll();
```

This is *very* dangerous (for user's data viability), and cannot be undone. Be careful not to do this unless the user's data has already been preserved elsewhere, or if the *user has given informed-consent* to discarding their data.

----

To also remove all local passkey accounts (from `localStorage`), and clear the lock-key cache:

```js
import { listLocalIdentities, removeLocalAccount } from "..";
import { clearLockKeyCache } from "@lo-fi/local-data-lock";

for (let localIdentity of listLocalIdentities()) {
    removeLocalAccount(localIdentity);
}
clearLockKeyCache();
```

**Warning:** This operation does not actually unregister any biometric passkeys from the device; that can only be done manually by the user, through the device's system settings. Ideally, your application should inform the user to this effect, so their device isn't left cluttered with unused, unwanted passkeys.

Again, this action cannot be undone, so be careful.

## Vault Instance API

The primary interaction with a vault is through its vault instance. For example:

```js
import { connect } from "..";

var vault = await connect({
    storageType: "idb",
    addNewVault: true
});

await vault.set("name","Kyle Simpson");
// true

await vault.has("name");
// true

await vault.set("info",{ nickname: "getify", age: 44 });
// true

await vault.entries();
// [
//    [ "name", "Kyle Simpson" ],
//    [ "info", { nickname: "getify", age: 44 } ]
// ]

// synchronous, no need for `await`!
vault.lock();
// true

// will prompt user for re-authentication
// before removing the 'name' entry
await vault.remove("name");
// true

await vault.keys();
// [ "info" ]
```

A vault instance has the following properties:

* `id` (string): the unique (to this device) vault ID

* `storageType` (string): the type of storage mechanism chosen to back this vault

A vault instance also has the following methods:

* `has(key)` (async): checks if the key-value store has the specified property registered

* `get(key)` (async): retrieves the value associated with the specified key (`undefined` is absent)

* `set(key,value)` (async): adds or updates the value at a specified key; setting a value to `undefined` (not `null`!) is treated as a `remove()` call, as encryption of the key-value store uses JSON serialization, which discards `undefined` values in object property locations.

* `remove(key)` (async): removes a key from the key-value store; same as `set()` with `undefined` as the value.

* `clear()` (async): completely removes the entire vault entry from the storage mechanism; the vault instance can still be used, and any subsequent calls will simply re-initialize the vault with empty data.

* `lock()` (sync): removes the vault's lock-key from the internal time-limited cache, such that the next operation against the vault will require a re-authentication with a passkey; akin to "logging out" in traditional systems design.

* `addPasskey({ ...keyOptions })` (async): add a new passkey to the vault's associated local passkey account

* `resetLockKey({ ...keyOptions })` (async): regenerate a new vault lock-key, as well as a new passkey to hold this lock-key; discards references to any previous passkeys in the local account.

    A `useLockKey` key-option may be passed, to manually set the lock-key to reset the vault with; this may be useful if importing a key from another device.

* `keys()` (async): returns an array of all keys in the key-value store

* `entries()` (async): returns an array of all `[ key, value ]` tuples, representing all entries in the key-value store

* `__exportLockKey({ risky: "this is unsafe" })` (async): call this method (with the required `risky` argument as shown) to reveal the underlying lock-key for a vault; needs either an unlocked vault (freshly-available cached passkey authentication), or will prompt the user for re-authentication to unlock.

    **Warning:** You should only use this method if you're intentionally circumventing the typical security protections of this library. For example: a valid use-case is for synchronizing a lock-key to another of the user's devices.

    The lock-key object should be **treated opaquely**, meaning that you don't rely on its structure, don't make any changes to it, etc. See ["Lock Key Value Format"](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#lock-key-value-format) for information about serializing/deserializing the value for storage, transmission, etc.

**Note:** All of these methods, except `lock()`, are asynchronous (promise-returning), because they all potentially require passkey re-authentication if the vault's lock-key is not freshly available in the internal recently-used cache.

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

To instead run the tests locally, first make sure you've [already run the build](#re-building-dist), then:

```cmd
npm test
```

This will start a static file webserver (no server logic), serving the interactive test page from `http://localhost:8080/`; visit this page in your browser to perform tests.

By default, the `test/test.js` file imports the code from the `src/*` directly. However, to test against the `dist/auto/*` files (as included in the npm package), you can modify `test/test.js`, updating the `/src` in its `import` statements to `/dist` (see the import-map in `test/index.html` for more details).

## License

[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

All code and documentation are (c) 2024 Kyle Simpson and released under the [MIT License](http://getify.mit-license.org/). A copy of the MIT License [is also included](LICENSE.txt).
