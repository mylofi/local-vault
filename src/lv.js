import {
	supportsWebAuthn,
	toBase64String,
	fromBase64String,
	getLockKey,
	lockData,
	unlockData,
	generateEntropy,
	listLocalIdentities,
	removeLocalAccount,
	clearLockKeyCache,
} from "@lo-fi/local-data-lock";


// ***********************

var storageStatus = null;
var adapters = {};
var vaults = {};
var vaultEntryCache = new WeakMap();


// ***********************

export {
	// re-export Local-Data-Lock members:
	supportsWebAuthn,
	listLocalIdentities,
	removeLocalAccount,
	toBase64String,
	fromBase64String,

	// main library API:
	defineAdapter,
	rawStorage,
	connect,
	removeAll,
	keepStorage,
};
var publicAPI = {
	// re-export Local-Data-Lock members:
	supportsWebAuthn,
	listLocalIdentities,
	removeLocalAccount,
	toBase64String,
	fromBase64String,

	// main library API:
	defineAdapter,
	rawStorage,
	connect,
	removeAll,
	keepStorage,
};
export default publicAPI;


// ***********************

function defineAdapter({
	storageType = "unknown",
	read,
	write,
	find,
	clear,
	raw,
} = {}) {
	if (!(storageType in adapters)) {
		adapters[storageType] = { read, write, find, clear, raw: { storageType, ...raw, }, };
	}
	else {
		throw new Error(`Storage type ('${storageType}') already defined`);
	}
}

function rawStorage(storageType) {
	if (storageType in adapters && adapters[storageType].raw != null) {
		return adapters[storageType].raw;
	}
	else {
		throw new Error(`Raw-storage type ('${storageType}') unknown or unavailable`);
	}
}

async function connect({
	storageType,
	vaultID,
	keyOptions: {
		relyingPartyID = document.location.hostname,
		relyingPartyName = "Local Vault",
		localIdentity: newLocalIdentity,
		useLockKey,
		...keyOptions
	} = {},
	addNewVault = false,
	discoverVault = false,
	signal: cancelConnection,
} = {}) {
	if (storageType in adapters) {
		if (discoverVault) {
			// protect against invalid usage
			if (useLockKey != null) {
				throw new Error("Explicit lock-key not allowed in vault-discovery mode");
			}

			let localIdentities = listLocalIdentities();

			// attempt to discover lock-key from chosen passkey
			let vaultLockKey = await getLockKey({
				...keyOptions,
				relyingPartyID,
				relyingPartyName,
				signal: cancelConnection,
			});

			// lock-key discovered?
			if (
				vaultLockKey != null &&
				localIdentities.includes(vaultLockKey.localIdentity)
			) {
				// vault found that matches the local-key's account ID?
				let [ discoveredVaultID, ] = await adapters[storageType].find({
					accountID: vaultLockKey.localIdentity,
				});
				if (discoveredVaultID != null) {
					return connect({
						storageType,
						vaultID: discoveredVaultID,
						keyOptions: {
							relyingPartyID,
							relyingPartyName,
							...keyOptions,
						},
						signal: cancelConnection,
					});
				}
			}

			throw new Error(`No matching vault found in storage ('${storageType}') for presented passkey`);
		}
		// adding a new vault, or explicitly connecting to existing
		// vault?
		else if (addNewVault || vaultID != null) {
			// need to generate new random vault ID?
			if (addNewVault && vaultID == null) {
				vaultID = (
					toBase64String(generateEntropy(12))
					.replace(/[^a-zA-Z0-9]+/g,"")
				);
			}

			// need to define vault instance (public API)?
			if (!(vaultID in vaults)) {
				vaults[vaultID] = {
					id: vaultID,
					storageType,
					has,
					"get": get,
					"set": set,
					remove,
					clear,
					lock,
					addPasskey,
					resetLockKey,
					keys,
					entries,
					__exportLockKey,
				};
				for (let [ name, fn ] of Object.entries(vaults[vaultID])) {
					if (typeof fn == "function") {
						vaults[vaultID][name] = fn.bind(vaults[vaultID]);
					}
				}
				Object.freeze(vaults[vaultID]);
			}

			let vaultEntry = await getVaultEntry(storageType,vaultID);

			// save abort-signal on vault entry?
			if (cancelConnection != null) {
				vaultEntry.externalSignal = cancelConnection;
			}

			// retrieve (or create) the cryptographic lock-key
			// for this vault
			let vaultLockKey = (
				// lock-key provided manually?
				(!addNewVault && useLockKey != null) ?
					// use it instead of trying to retrieve from
					// the passkey
					useLockKey :

				// add new vault lock-key, or retrieve existing lock-key?
				(addNewVault || vaultEntry.accountID != null) ?
					// pull lock-key from passkey
					await getLockKey({
						...keyOptions,
						relyingPartyID: (
							vaultEntry.rpID != null ? vaultEntry.rpID : relyingPartyID
						),
						relyingPartyName,
						...(
							addNewVault ?
								{ addNewPasskey: true, localIdentity: newLocalIdentity, useLockKey, } :
								{ localIdentity: vaultEntry.accountID, }
						),
						signal: cancelConnection,
					}) :

				null
			);

			// vault lock-key retrieval successful?
			if (vaultLockKey != null && vaultLockKey.localIdentity != null) {
				unlockVaultEntry(vaultEntry,vaultLockKey);

				// vault entry meta-data needs to be updated?
				if (!(
					vaultEntry.accountID == vaultLockKey.localIdentity &&
					vaultEntry.rpID == relyingPartyID
				)) {
					vaultEntry.accountID = vaultLockKey.localIdentity;
					vaultEntry.rpID = relyingPartyID;

					// commit vault-entry to storage (via adapter)
					await adapters[storageType].write(
						vaultID,
						vaultEntry,
						lockData(vaultEntry.data,vaultLockKey)
					);
				}

				return vaults[vaultID];
			}
			else {
				vaultEntryCache.delete(vaults[vaultID]);
				delete vaults[vaultID];
				throw new Error("Vault lock-key access failed");
			}
		}
		else {
			throw new Error("Required vault ID missing");
		}
	}
	else {
		throw new Error(`Unknown storage type ('${storageType}')`);
	}
}

async function removeAll() {
	for (let adapter of Object.values(adapters)) {
		try { await adapter.clear(); } catch (err) {}
	}
	return true;
}

async function has(name,{ useLockKey, signal, } = {}) {
	var { vaultEntry, } = await openVault(this,useLockKey,signal);

	if (vaultEntry != null) {
		return (name in vaultEntry.data);
	}
}

async function get(name,{ useLockKey, signal, } = {}) {
	var { vaultEntry, } = await openVault(this,useLockKey,signal);

	if (vaultEntry != null) {
		return vaultEntry.data[name];
	}
}

async function set(name,val,{ useLockKey, signal, } = {}) {
	// JSON drops properties with `undefined` values, so
	// setting a store entry with `undefined` is just
	// treated like a remove()
	if (val === undefined) {
		return this.remove(name,{ useLockKey, signal, });
	}

	var { storageType, vaultID, vaultEntry, vaultLockKey, } = (
		await openVault(this,useLockKey,signal)
	) || {};

	if (
		storageType != null &&
		vaultID != null &&
		vaultEntry != null &&
		vaultLockKey != null
	) {
		vaultEntry.data[name] = val;

		// commit vault-entry to storage (via adapter)
		await adapters[storageType].write(
			vaultID,
			vaultEntry,
			lockData(vaultEntry.data,vaultLockKey)
		);
		return true;
	}
	return false;
}

async function remove(name,{ useLockKey, signal, } = {}) {
	var { storageType, vaultID, vaultEntry, vaultLockKey, } = (
		await openVault(this,useLockKey,signal)
	) || {};

	if (
		storageType != null &&
		vaultID != null &&
		vaultEntry != null &&
		vaultLockKey != null
	) {
		delete vaultEntry.data[name];

		// commit vault-entry to storage (via adapter)
		await adapters[storageType].write(
			vaultID,
			vaultEntry,
			lockData(vaultEntry.data,vaultLockKey)
		);
		return true;
	}
	return false;
}

async function clear({ useLockKey, signal, } = {}) {
	var { storageType, vaultID, } = (
		await openVault(this,useLockKey,signal)
	) || {};

	if (storageType != null && vaultID != null) {
		await adapters[storageType].clear(vaultID);
		vaultEntryCache.delete(vaults[vaultID]);
		return true;
	}
	return false;
}

function lock({ useLockKey } = {}) {
	if (useLockKey != null) {
		throw new Error("Explicit lock-key not allowed when locking a vault");
	}
	var vault = this;
	if (
		vault != null &&
		typeof vault.storageType == "string" &&
		typeof vault.id == "string" &&
		vaultEntryCache.has(vault)
	) {
		let vaultEntry = vaultEntryCache.get(vault);
		vaultEntryCache.delete(vault);
		clearLockKeyCache(vaultEntry.accountID);
		return true;
	}
	else {
		throw new Error("Not a currently unlocked vault");
	}
}

async function addPasskey({
	localIdentity,
	relyingPartyID = document.location.hostname,
	relyingPartyName = "Local Vault",
	useLockKey,
	signal: cancelAddPasskey,
	...keyOptions
} = {}) {
	if (useLockKey != null) {
		throw new Error("Explicit lock-key not allowed when adding a passkey to a vault");
	}
	var { vaultEntry, } = await openVault(this,null,cancelAddPasskey);

	if (vaultEntry != null) {
		try {
			let vaultLockKey = await getLockKey({
				...keyOptions,
				localIdentity: vaultEntry.accountID,
				relyingPartyID: (
					vaultEntry.rpID != null ? vaultEntry.rpID : relyingPartyID
				),
				relyingPartyName,
				addNewPasskey: true,
				signal: (
					cancelAddPasskey != null ? cancelAddPasskey :
					vaultEntry.externalSignal != null ? vaultEntry.externalSignal :
					null
				),
			});
			return (vaultLockKey != null);
		}
		catch (err) {
			throw new Error("Adding passkey to vault's local-account failed",{ cause: err, });
		}
	}
	return false;
}

async function resetLockKey({
	localIdentity,
	relyingPartyID = document.location.hostname,
	relyingPartyName = "Local Vault",
	useLockKey,
	signal: cancelResetPasskey,
	...keyOptions
} = {}) {
	var { storageType, vaultID, vaultEntry, } = (
		await openVault(this,useLockKey,cancelResetPasskey)
	) || {};

	if (
		storageType != null &&
		vaultID != null &&
		vaultEntry != null
	) {
		try {
			let vaultLockKey = await getLockKey({
				...keyOptions,
				localIdentity: vaultEntry.accountID,
				relyingPartyID: (
					vaultEntry.rpID != null ? vaultEntry.rpID : relyingPartyID
				),
				relyingPartyName,
				resetLockKey: true,
				useLockKey,
				signal: (
					cancelResetPasskey != null ? cancelResetPasskey :
					vaultEntry.externalSignal != null ? vaultEntry.externalSignal :
					null
				),
			});

			if (vaultLockKey != null) {
				// commit vault-entry to storage (via adapter)
				await adapters[storageType].write(
					vaultID,
					vaultEntry,
					lockData(vaultEntry.data,vaultLockKey)
				);

				return true;
			}
		}
		catch (err) {
			throw new Error("Resetting vault's lock-key failed",{ cause: err, });
		}
	}
	return false;
}

async function keys({ useLockKey, signal, } = {}) {
	var { vaultEntry, } = (await openVault(this,useLockKey,signal)) || {};

	if (vaultEntry != null) {
		return Object.keys(vaultEntry.data);
	}
	return [];
}

async function entries({ useLockKey, signal, } = {}) {
	var { vaultEntry, } = (await openVault(this,useLockKey,signal)) || {};

	if (vaultEntry != null) {
		return Object.entries(vaultEntry.data);
	}
	return [];
}

async function __exportLockKey({ risky = false, useLockKey, signal, } = {}) {
	if (risky == "this is unsafe") {
		if (useLockKey != null) {
			throw new Error("Explicit lock-key not allowed when exporting existing lock-key");
		}
		return ((await openVault(this,null,signal)) || {}).vaultLockKey;
	}
	else {
		throw new Error("Must pass {risky:\"this is unsafe\"} argument, to acknowledge the risks of using this method");
	}
}

async function openVault(vault,useLockKey,signal) {
	if (
		vault != null &&
		typeof vault.storageType == "string" &&
		typeof vault.id == "string"
	) {
		let { storageType, id: vaultID, } = vault;
		if (adapters[storageType] != null) {
			// always gets a vault entry, even if
			// it's just a newly initialized entry
			let vaultEntry = await getVaultEntry(storageType,vaultID);

			let vaultLockKey = (
				// lock-key provided manually?
				useLockKey != null ?
					// just use it, instead of trying to pull from the
					// passkey
					useLockKey :

					// even if the local vault cache is still present
					// and unlocked, re-retrieve the lock-key to ensure that
					// if its caching has expired, the user is re-prompted
					await getLockKey({
						localIdentity: vaultEntry.accountID,
						relyingPartyID: vaultEntry.rpID,
						signal,
					})
			);

			// lock-key retrieval successful?
			if (vaultLockKey != null) {
				unlockVaultEntry(vaultEntry,vaultLockKey);
				return { storageType, vaultID, vaultEntry, vaultLockKey, };
			}
		}
		else {
			throw new Error(`Unknown storage type ('${storageType}')`);
		}
	}
	else {
		throw new Error("Unrecognized vault instance");
	}
}

async function getVaultEntry(storageType,vaultID) {
	var vaultEntry = (
		vaultEntryCache.has(vaults[vaultID]) ?
			vaultEntryCache.get(vaults[vaultID]) :

			// read() from adapter always works, even
			// if it just auto-initializes (and stores)
			// a new empty vault entry
			await adapters[storageType].read(vaultID)
	);
	vaultEntryCache.set(vaults[vaultID],vaultEntry);
	return vaultEntry;
}

function unlockVaultEntry(vaultEntry,vaultLockKey) {
	if (typeof vaultEntry.data == "string") {
		vaultEntry.data = (
			vaultEntry.data.length > 0 ? unlockData(vaultEntry.data,vaultLockKey) : {}
		);
	}
}

async function keepStorage() {
	// haven't checked storage status yet?
	if (storageStatus == null) {
		try {
			// already persisted?
			storageStatus = await navigator.storage.persisted();
			if (storageStatus) {
				return storageStatus;
			}

			// ask for permission to persist storage
			storageStatus = await navigator.storage.persist();
		}
		catch (err) {
			storageStatus = false;
		}
	}
	return storageStatus;
}
