# Local Vault

[![npm Module](https://badge.fury.io/js/@lo-fi%2Flocal-vault.svg)](https://www.npmjs.org/package/@lo-fi/local-vault)
[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

**Local Vault** provides a client-side, key-value storage API abstraction with automatic encryption/decryption.

----

[Library Tests (Demo)](https://mylofi.github.io/local-vault/)

----

A *local vault* instance is a simple key-value store (`get()`, `set()`, etc), backed by a client-side storage mechanism (`localStorage` / `sessionStorage`, IndexedDB, cookies, [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), etc).

The primary feature of this library is automatically handling encryption (on write) and decryption (on read) from a local vault's data, all client-side with no servers; the cryptographic key is furthermore protected locally in the client in a biometric passkey.

**Local Vault** directly depends on [**Local-Data-Lock**](https://github.com/mylofi/local-data-lock), which itself depends on [**Webauthn-Local-Client**](https://github.com/mylofi/webauthn-local-client).

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
