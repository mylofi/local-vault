# Manually handling vault lock-keys

**Local Vault** is intended primarily as an abstraction that automatically and opaquely handles the necessary encryption/decryption operations -- and secures the keypair(s) with a biometric passkey on the device.

**WARNING:** If you store a vault's lock-key on the user's device, alongside the data that was encrypted with that key, you have essentially defeated the protection; an attacker has all they need to decrypt and exfiltrate (or manipulate/remove!) the user's data. For this reason, it's strongly recommended that you not deal with a vault's lock-key directly, if at all possible.

For best security, let **Local Vault** handle these details!

Moreover, in managing lock-key access during a page instance, **Local Vault** (via **Local Data Lock**) uses an internal cache of lock-keys retrieved via passkey authentication (with [30 minutes default timeout](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#change-lock-key-cache-lifetime)). This means that users shouldn't be prompted for passkey authentication more than once per 30 minutes (while in the same page instance). This timeout can be modified via `configure({ cacheLifetime: .. })` (from **Local Data Lock**).

It's strongly recommended to [allow **Local Vault** to manage the balance between security and UX convenience](https://github.com/mylofi/local-data-lock#security-vs-convenience) with this timeout-limited caching of lock-key access.

All those warnings/suggestions aside, there are some legitimate reasons to manually access or set a vault's lock-key. This guide will explain how to do so, responsibly and safely.

## Manually deriving a lock-key

To manually derive a lock-key, use the [`deriveLockKey()` method from **Local Data Lock**, as described here](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#deriving-an-encryptiondecryption-key).

```js
import { deriveLockKey } from "@lo-fi/local-data-lock";

var lockKey = deriveLockKey(seedValue);
```

The `seedValue` (aka IV) must be a 32-byte sized `Uint8Array` instance; it may be generated randomly (see [`generateEntropy()` from **Local Data Lock**](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#deriving-an-encryptiondecryption-key)), or pulled from an existing lock-key value's `iv` property.

## Exporting a vault lock-key

For an existing vault that already has a lock-key established, the vault-instance has a method called `__exportLockKey()` on it.

This method name has the `__` prefix deliberately, to make it stand out among the rest of the code, as unusual and deserving of extra attention. Moreover, this method requires a specific argument (the object: `{ risky: "this is unsafe" }`), to further distinguish and ensure that its usage is intentional, and with extra care taken.

```js
var lockKey = await vault.__exportLockKey({ risky: "this is unsafe" });
```

**Note:** If this method is called on a not-recently-unlocked vault instance, the user will be prompted for a passkey authentication; this authentication is required to access the lock-key being requested.

## Storing/transmitting a lock-key

The value in `lockKey` should be **treated opaquely**, meaning that you don't rely on its structure, don't make any changes to it, etc.

Using the information described in ["Lock Key Value Format"](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#lock-key-value-format), you might define a helper utility like `packLockKey(..)`:

```js
import { toBase64String } from "..";

function packLockKey(lockKey) {
    return Object.fromEntries(
        Object.entries(lockKey)
        .map(([ prop, value ]) => [
            prop,
            (
                value instanceof Uint8Array &&
                value.buffer instanceof ArrayBuffer
            ) ?
                toBase64String(value) :
                value
        ])
    );
}
```

With this helper, you can for example save a vault's lock-key, using [the `rawStorage()` mechanism](README.md#raw-storage-access) to retrieve later on each visit/page-load:

```js
import "@lo-fi/local-vault/adapter/idb";
import { rawStorage, connect } from "..";

var IDBStore = rawStorage("idb");

var vault = await connect({ .. });
var lockKey = await vault.__exportLockKey({ risky: "this is unsafe" });
var packedLockKey = packLockKey(lockKey);

await IDBStore.set("lock-key",packedLockKey);
```

**Note:** Instead of storing the lock-key, you might transmit it (using a secure channel of course!) to another device; this might be useful if a user is replicating/synchronizing their data across multiple devices.

### Unpacking lock-key

[As explained in more detail here](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#lock-key-value-format), a utility for unpacking a lock-key (as it was stored) might look like this:

```js
import { fromBase64String } from "..";

function unpackLockKey(packedLockedKey) {
    return Object.fromEntries(
        Object.entries(packedLockedKey)
        .map(([ prop, value ]) => [
            prop,
            (
                typeof value == "string" &&

                // padded base64 encoding of Uint8Array(32)
                // will be at least 44 characters long
                value.length >= 44
            ) ?
                fromBase64String(value) :
                value
        ])
    );
}
```

With this helper method, you can unpack lock-key object (holding base64 encoded binary values) -- either [pulled from raw-storage](README.md#raw-storage-access), or received transmitted from another device:

```js
import "@lo-fi/local-vault/adapter/idb";
import { rawStorage } from "..";

var IDBStore = rawStorage("idb");

var lockKey = unpackLockKey(
    await IDBStore.get("lock-key")
);
```

### Simpler Approach: IV/seed

Instead of preserving/restoring the entire lock-key object value, just its `iv` value (IV/seed used for the keypair) is enough to re-derive the full keypair; this is a `Uint8Array` value, so it should be converted to a base64 encoded string:

```js
import "@lo-fi/local-vault/adapter/idb";
import { rawStorage, connect, toBase64String } from "..";

/* .. */

await IDBStore.set("lock-key-iv",toBase64String(lockKey.iv));
```

To restore the full keypair object value from a serialized `iv` (either stored or transmitted), you'll need to use `fromBase64String()` to turn it back into a `Uint8Array` value, then pass that to [`deriveKey()`, as explained previously here](#manually-dering-a-lock-key).

## Manually setting lock-key on a new vault

If you have an explicit lock-key value -- from a `connect()`, `__exportLockKey()`, or `deriveLockKey()` call (even on another device) -- and you want to instantiate a *new* local vault with that key:

```js
var existingLockKey = /* .. */;

var vault = await connect({
    storageType: /* .. */,
    addNewVault: true,
    keyOptions: {
        useLockKey: existingLockKey
    }
});
```

**Note:** Even though this lock-key is being manually specified at vault creation, the user will still be prompted for passkey authentication at this time, to be able to save the lock-key. There is *intentionally no way* to use **Local Vault** without a user being passkey-authentication prompted at least once (per device), at initial vault setup.

## Manually setting lock-key when connecting to existing vault

To silently (without passkey prompting!) connect to an existing vault, using a known lock-key (via its vault-ID):

```js
var existingLockKey = /* .. */;

var vault = await connect({
    storageType: /* .. */,
    vaultID: existingVaultID,
    keyOptions: {
        useLockKey: existingLockKey
    }
});
```

**Note:** If `vaultID` is not known (or was lost!), a vault can still be connected via ["discovery mode"](README.md#discoverable-vaults). However, silent connection via `useLockKey` is not allowed for this mode -- doing so will throw an error! Instead, the user must instead be prompted for a passkey authentication to pull the lock-key. You could then re-save that vault ID (`vault.id`), along with the lock-key, to enable subsequent silent reconnections.

## Manually setting lock-key for vault instance operations

Most of a [vault instance's methods](README.md#vault-instance-api) may be called "silently" (ensuring no passkey authentication prompt even if the cached lock-key has expired), with an optional object parameter to specify which lock-key to use.

For example:

```js
var existingLockKey = /* .. */;

await vault.set("hello","world!",{ useLockKey: existingLockKey });
// true

await vault.get("hello",{ useLockKey: existingLockKey });
// "world!"
```

The vault instance methods which *do not* support the `useLockKey` override (passing such will throw an exception):

* `lock()`

* `addPasskey()`

* `__exportLockKey()`

## Using the lock-key for digital signatures/verifications

As it relates to the cryptography these libraries are performing, a digital signature (that can be verified elsewhere) acts as an asymmetric -- meaning you're using an asymmetric keypair, made up of a public-key and private-key -- proof of *who* sent a message. The sender uses the private-key to generate a signature, and the receiver (who typically only has the public-key) can ***verify that signature***, to prove to the receiver that the message came from the sender, and wasn't tampered with by a MitM.

[**Local Data Lock**](https://github.com/mylofi/local-data-lock) provides two API methods, [`signData()` and `verifySignature()`](https://github.com/mylofi/local-data-lock?tab=readme-ov-file#signing-data-and-verifying-signatures), for this purpose. Both methods accept a lock-key, and use it for generating or verifying (detached) digital signatures over arbitrary data.

**Note:** Technically, these methods only use the `privateKey` (for `signData()`) or `publicKey` (for `verifySignature()`) properties from a full lock-key object, so those specific properties are all that's necessary. Encryption/decryption uses the `enc`

It's important to point out: digital signatures are *not encryption*. The data itself may be plain-text or encrypted. The digital signature is not really protecting the data from snooping by others -- that's what encryption does! -- but rather just protecting from having a message unexpectedly modified while in transit between sender and receiver, in a way you the receiver detect.

### Example Scenario

As an example of how you might use this capability in a local-first application, you might have one keypair on one device, and another keypair on another device (user device, or server). These two devices would exchange their respective public-keys -- using a trustable channel), so device A knows its own full keypair as well as device B's public-key; likewise device B would know its own full keypair and device A's public-key.

Now, these devices can send messages between each other, using any public or private channels, and be able to prove the authenticity of these messages as coming from their respective sender.

When device A wants to send a piece of data (again, plain data or encrypted) to device B, it first generates a signature using A's own private key. It then sends the data *and the signature* to B. When B receives the data and the signature, it verifies the signature matches the data *and* that it in fact came from device A, using device A's public-key:

```js
// on device A
import { signData } from "@lo-fi/local-data-lock";

var data = { something: "cool" };
var signature = signData(data,myLockKey);

// now, send data+signature to device B
```

```js
// on device B
import { verifySignature } from "@lo-fi/local-data-lock";

// data, signature received from device A
var verified = verifySignature(data,signature,{
    publicKey: deviceAPublicKey
});
```

Of course, the same process can work in the other direction: device B (signing with B's private-key) sending to device A (verifying with B's public-key).
