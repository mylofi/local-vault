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

A *local vault* instance is a simple key-value store (`get()`, `set()`, etc), backed by [your choice among various client-side storage mechanisms](#client-side-storage-adapters) (`localStorage` / `sessionStorage`, IndexedDB, cookies, and OPFS) -- powered by the [**Storage** library's adapters](https://github.com/byojs/storage).

The main feature of this library is automatically handling encryption (on write) and decryption (on read) from a local vault's data -- so data is always encrypted at-rest -- all client-side with no servers.

The cryptographic encryption/decryption key is furthermore [protected locally in the client in a biometric passkey (i.e., authenticator, secure enclave, etc)](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#how-does-it-work). Users can safely access their protected data with a simple biometric passkey authentication -- no troublesome passwords, and no privacy-eroding remote servers!

**Local Vault** directly depends on [**Storage**](https://github.com/byojs/storage), as well as [**Local-Data-Lock**](https://github.com/mylofi/local-data-lock), which depends on [**WebAuthn-Local-Client**](https://github.com/mylofi/webauthn-local-client).

----

**Tip:** For additional information about manually handling vault lock-keys, including computing digital signatures for data transmission, [check out the Lock-Key guide](LOCK-KEY.md).

## Client Side Storage Adapters

**Local Vault** ships with adapters ([backed by the corresponding **Storage** adapters](https://github.com/byojs/storage?tab=readme-ov-file#client-side-storage-adapters)) for these browser storage mechanisms:

* `idb`: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

* `local-storage`: [Web Storage `localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

* `session-storage`: [Web Storage `sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)

* `cookie`: [Web cookies](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies)

* `opfs`: [Origin Private File System (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), specifically [virtual origin filesystem](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/getDirectory)

    **Note:** OPFS access in the main UI thread is only currently supported in desktop (not mobile!) Chrome and Firefox.

* `opfs-worker`: OPFS (Web Worker), handles OPFS access in a background thread Web Worker, which expands OPFS support to most modern devices/browsers.

Each of these client-side storage mechanisms has its own pros/cons, so choice should be made carefully.

However, IndexedDB (`idb` adapter) is the most robust and flexible option, and should generally be considered the best default.

### Enabling Adapters

To load a storage mechanism's adapter (e.g., `idb` for IndexedDB):

```js
import "@lo-fi/local-vault/adapter/idb";

import { connect } from "..";
```

You can load any or all of the adapters. But you must have at least one adapter defined, and calls to `connect()` must always specify a storage-type that matches one of the loaded adapters.

### Raw Storage Access

**Local Vault** automatically handles encryption (on write) and decryption (on read) for data being stored in a *vault* (via the methods on a [vault-instance](#setting-up-a-local-vault-instance)). For any important data in your application, you should prefer to use this approach to storage.

However, some bits of data that you need *unencrypted* access to -- for example, when reconnecting/unlocking a vault -- would present a chicken-and-the-egg problem if you stored that data *in a locked vault*. For example, you might store the auto-generated vault-ID, or in a more advanced usage, you might [even store the vault's lock-key](LOCK-KEY.md). Clearly, *these bits of data* cannot be encrypted by their own vault.

Instead of storing/retrieving such data within a vault-instance, you can access the raw underlying storage -- with a friendly, consistent key-value style API ([as provided by **Storage**](https://github.com/byojs/storage?tab=readme-ov-file#storage-api)) -- accessed via the `rawStorage()` method:

```js
import "@lo-fi/local-vault/adapter/idb";

import { rawStorage, connect } from "..";

var IDBStore = rawStorage("idb");
var vaultID;

// already have a vault setup?
if (await IDBStore.has("vault-id")) {
    // retrieve its vault-ID
    vaultID = await IDBStore.get("vault-id");
}

// create or reconnect to vault
var vault = await connect({
    /* .. */

    // add new vault?
    addNewVault: (vaultID == null),

    // or connect to existing (if found)
    vaultID,

    /* .. */
});

// new vault setup?
if (vaultID == null) {
    // store auto-generated vault-ID
    await IDBStore.set("vault-id",vault.id);
}
```

The [raw-storage API available is documented here](https://github.com/byojs/storage?tab=readme-ov-file#storage-api).

**Warning:** Do not access/modify any values in the raw-storage with a specific name prefix of `"local-vault-"`, as you will interfere with the underlying managed vault storage entries.

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

For further information about client-side storage limitations, and guidance in choosing which mechanism to use, [read the documentation for **Storage**](https://github.com/byojs/storage?tab=readme-ov-file#storage-limitations).

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

A "local vault" is a JS object (JSON compatible), which is actually stored in the [client storage mechanism](#client-side-storage-adapters) you choose, either directly (for IndexedDB) or as a JSON serialized string.

The stored local-vault object has the following three properties:

* `accountID` (string): holding the ID of the [*local account* attached to one or more device passkeys](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#registering-a-local-account-and-lock-key-keypair), each of which [hold the (same) encryption/decryption cryptographic key](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#how-does-it-work)

* `rpID` (string): holds the [*relying party ID*](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#configuring-passkeys), which for web applications should almost always be the fully-qualified hostname (i.e., `document.location.hostname`) of the webapp

* `data` (string): holds the encrypted data, in base64 encoding

**WARNING:** This local-vault object is *not* something your code should directly retrieve or modify in any way. Instead, you'll use the methods on the vault-instance, as described in the next section.

## Setting up a local vault instance

The vault-instance, created from a `connect()` call, exposes a simple API (`get()`, `set()`, etc) for managing key-value style data access. Encryption and key-management is all handled automatically while interacting with this vault-instance.

To setup a new vault-instance (e.g., using the IDB storage type):

```js
import "@lo-fi/local-vault/adapter-idb";
import { connect } from "..";

// new vault-instance
var vault = await connect({
    storageType: "idb",     // required
    addNewVault: true,
    keyOptions: {
        username: "passkey-user",
        displayName: "Passkey User"
    }
});

vault.id;                   // ".." (auto-generated string)
vault.storageType;          // "idb"
```

The `storageType` setting is required on every `connect()` call. You'll likely do all your vault storage in *one* storage mechanism, so this is probably a fixed value you configure once in your app code -- rather than being an option the user chooses, for example.

Any [options set under `keyOptions`](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#configuring-passkeys) are passed along to the underlying [**Local Data Lock** library's `getLockKey()` method](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#registering-a-local-account).

When setting up a new vault instance can, [you *can* manually specify a lock-key](LOCK-KEY.md#manually-setting-lock-key-on-a-new-vault).

**Note:** The `username` / `displayName` key-options illustrated above are not strictly required, but are strongly recommended; they're only passed along to the biometric passkey, as meta-data for such. The device will often use one or both values in its prompt dialogs, so these values should either be something the user has picked, or at least be something the user will recognize and trust. Also, there may very well be multiple passkeys associated with the same local account, so the username/display-name should be differentiated to help the users know which passkey they're authenticating with.

### Manually specifying a vault ID

It's often best to let `connect()` automatically generate a unique ID for a new vault. However, this requires storing that value (from `vault.id`) to use in [subsequent vault reconnections](#reconnecting-a-vault).

Alternatively, you can manually specify a vault ID:

```js
var vault = await connect({
    storageType: "..",
    addNewVault: true,
    vaultID: "my-app-data"
});

vault.id;               // "my-app-data"
```

**Note:** Ensure the vault ID is unique (per device).

## Reconnecting a vault

If you manually specified a vault ID at the initial setup `connect()` call, or if you preserved the auto-generated vault ID (i.e., from `vault.id`), you can later reconnect to that vault by providing its existing vault ID:

```js
var vault = await connect({
   storageType: "..",
   vaultID: existingVaultID
});
```

### Discoverable Vaults

Saving the `vault.id` to use later does create a bit of a chicken-and-the-egg problem, because then you have to separately choose which client-side storage you want to persist that value in, and manage it appropriately. The value may even be saved at first but lost later.

So you can instead use "vault discovery" mode to detect which vault to use, based on which passkey the user chooses to authenticate with:

```js
var vault = await connect({
    storageType: "..",
    discoverVault: true
});
```

Discovery mode should only be used when you're sure the user has already setup a vault on this device. If a suitable passkey is not authenticated with, and matching vault is not found, a discovery mode `connect()` call will fail with an exception.

**Note:** Discovery mode will *always* prompt the user for passkey authentication.

### Long-lived vault connections

The default behavior of a vault is to prompt the user for passkey authentication on setup, and on reconnection (subsequent page loads).

Moreover, the lock-key retrieved from a passkey authentication is kept in an [internal recent-access cache (default timeout: 30 minutes)](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#change-lock-key-cache-lifetime), so that any subsequent vault operations complete silently (no passkey authentication prompt). Once the internal lock-key cache entry expires, the next vault operation will re-prompt the user for passkey authentication.

This design is intentionally balanced between more security (prompting every time) and more convenience (long-lived connections that rarely re-prompt the user).

You're strongly encouraged to allow **Local Vault**'s default security behavior. However, if you need to manually override to extend vault connections, [please see the LOCK-KEY guide for more options](LOCK-KEY.md).

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

for (let localIdentity of (await listLocalIdentities())) {
    await removeLocalAccount(localIdentity);
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

    A [`useLockKey` option *can* be passed](LOCK-KEY.md#manually-setting-lock-key-for-vault-instance-operations), to manually specify a lock-key to reset the vault with; this may be useful if importing a key from another device.

* `keys()` (async): returns an array of all keys in the key-value store

* `entries()` (async): returns an array of all `[ key, value ]` tuples, representing all entries in the key-value store

* `__exportLockKey({ risky: "this is unsafe" })` (async): call this method (with the required `risky` argument as shown) to reveal the underlying lock-key for a vault; needs either an unlocked vault (freshly-available cached passkey authentication), or will prompt the user for re-authentication to unlock.

    **Warning:** Please see ["Exporting a vault lock-key"](LOCK-KEY.md#exporting-a-vault-lock-key) for more information about using this method responsibly and safely.

**Note:** All of these methods, except `lock()`, are asynchronous (promise-returning), because they all potentially require passkey re-authentication if the vault's lock-key is not freshly available in the internal recently-used cache.

Except for `lock()`, `addPasskey()`, and `__exportLockKey()`, [all these instance methods accept an optional `useLockKey` setting](LOCK-KEY.md#manually-setting-lock-key-for-vault-instance-operations).

## Cancelling Vault Operations

If a call to `connect(..)` (or any of the asynchronous vault-instance methods) requires a passkey (re)authentication, there may be a substantial delay while the user is navigating the system prompts. Calling `connect()` or any vault method, while another `connect()` or vault method is currently pending, will abort that previous call -- and should cancel any open system dialogs the user is interacting with.

However, you may want to cancel a currently pending passkey authentication *without* having to call one of these methods again, for example based on a timeout if authentication is taking too long.

All asynchronous vault operations -- `connect()` as well as all the vault-instance methods (except `lock()`) -- accept an optional `signal` option, an [`AbortController.signal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/signal) instance. If the associated `AbortController` of this signal is aborted (with `abort()`), and the operation is currently pending a passkey authentication, that operation will be cancelled.

For example:

```js
var cancelToken = new AbortController();

// 5 second timeout for passkey authentication
setTimeout(() => cancelToken.abort("Took too long!"),5000);

var vault = await connect({
    /* .. */,
    signal: cancelToken.signal,
});

await vault.set("hello","world",{ signal: cancelToken.signal });

await vault.entries({ signal: cancelToken.signal });
```

Any abort of a pending passkey authentication will throw an exception at the point of the method call (i.e., the `await`). So if you're using cancellation to control vault operations, make sure to use appropriate exception handling techniques (`try..catch`, etc).

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
