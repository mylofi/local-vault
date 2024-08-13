import {
	supportsWebAuthn,
	toBase64String,
	fromBase64String,
	getLockKey,
	lockData,
	unlockData,
	listLocalIdentities,
	clearLockKeyCache,
} from "@lo-fi/local-data-lock";


// ***********************

var storageStatus = null;
var adapters = {};
var vaults = {};
var vaultEntryCache = new WeakMap();


// ***********************

export {
	// re-export Local-Data-Lock helper utilities:
	supportsWebAuthn,
	toBase64String,
	fromBase64String,

	// main library API:
	defineAdapter,
	connect,
	removeAll,
	keepStorage,
};
var publicAPI = {
	// re-export WebAuthn-Local-Client helper utilities:
	supportsWebAuthn,
	toBase64String,
	fromBase64String,

	// main library API:
	defineAdapter,
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
}) {
	if (!(storageType in adapters)) {
		adapters[storageType] = { read, write, find, clear, };
	}
	else {
		throw new Error(`Storage type ('${storageType}') already defined`);
	}
}

async function connect({
	storageType,
	vaultID,
	keyOptions: {
		relyingPartyID = document.location.hostname,
		relyingPartyName = "Local Vault",
		localIdentity: newLocalIdentity,
		...keyOptions
	} = {},
	addNewVault = false,
	discoverVault = false,
}) {
	if (storageType in adapters) {
		if (discoverVault) {
			let localIdentities = listLocalIdentities();

			// attempt to discover lock-key from chosen passkey
			let vaultLockKey = await getLockKey({
				relyingPartyID,
				relyingPartyName,
				...keyOptions,
			});

			// lock-key discovered?
			if (localIdentities.includes(vaultLockKey.localIdentity)) {
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
					});
				}
			}

			throw new Error(`No matching vault found in storage ('${storageType}') for presented passkey`);
		}
		else if (vaultID != null) {
			// need to define vault instance (public API)?
			if (!(vaultID in vaults)) {
				vaults[vaultID] = {
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
				};
				for (let [ name, fn ] of Object.entries(vaults[vaultID])) {
					vaults[vaultID][name] = fn.bind(vaults[vaultID]);
				}
				Object.defineProperties(
					vaults[vaultID],
					{
						storageType: {
							value: storageType,
							writable: false,
							configurable: false,
							enumerable: true,
						},
						id: {
							value: vaultID,
							writable: false,
							configurable: false,
							enumerable: true,
						},
					}
				);
			}

			let vaultEntry = await getVaultEntry(storageType,vaultID);

			// retrieve (or create) the cryptographic lock-key
			// for this vault
			let vaultLockKey = (
				(addNewVault || vaultEntry.accountID != null) ?
					await getLockKey({
						relyingPartyID: (
							vaultEntry.rpID != null ? vaultEntry.rpID : relyingPartyID
						),
						relyingPartyName,
						...keyOptions,
						...(
							addNewVault ?
								{ addNewPasskey: true, localIdentity: newLocalIdentity, } :
								{ localIdentity: vaultEntry.accountID, }
						),
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
	for (let [ storageType, adapter ] of Object.entries(adapters)) {
		try { await adapter.clear(); } catch (err) {}
	}
}

async function has(name) {
	var { vaultEntry, } = await openVault(this);
	return (name in vaultEntry.data);
}

async function get(name) {
	var { vaultEntry, } = await openVault(this);
	return vaultEntry.data[name];
}

async function set(name,val) {
	var { storageType, vaultID, vaultEntry, vaultLockKey, } = await openVault(this);
	vaultEntry.data[name] = val;
	await adapters[storageType].write(
		vaultID,
		vaultEntry,
		lockData(vaultEntry.data,vaultLockKey)
	);
	return true;
}

async function remove(name) {
	var { storageType, vaultID, vaultEntry, vaultLockKey, } = await openVault(this);
	delete vaultEntry.data[name];
	await adapters[storageType].write(
		vaultID,
		vaultEntry,
		lockData(vaultEntry.data,vaultLockKey)
	);
	return true;
}

async function clear() {
	var { storageType, vaultID, } = await openVault(this);
	await adapters[storageType].clear(vaultID);
	vaultEntryCache.delete(vaults[vaultID]);
	return true;
}

function lock() {
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
	}
	else {
		throw new Error("Not a currently unlocked vault");
	}
}

async function addPasskey({ username, displayName, } = {}) {
	var { vaultEntry, } = await openVault(this);

	try {
		await getLockKey({
			localIdentity: vaultEntry.accountID,
			username,
			displayName,
			relyingPartyID: vaultEntry.rpID,
			relyingPartyName: "Local Vault",
			addNewPasskey: true,
		});
		return true;
	}
	catch (err) {
		throw new Error("Adding passkey to vault's local-account failed",{ cause: err, });
	}
}

async function resetLockKey({ username, displayName, } = {}) {
	var { storageType, vaultID, vaultEntry, vaultLockKey: oldVaultLockKey } = await openVault(this);

	try {
		let newVaultLockKey = await getLockKey({
			localIdentity: vaultEntry.accountID,
			username,
			displayName,
			relyingPartyID: vaultEntry.rpID,
			relyingPartyName: "Local Vault",
			resetLockKey: true,
		});

		await adapters[storageType].write(
			vaultID,
			vaultEntry,
			lockData(vaultEntry.data,newVaultLockKey)
		);

		return true;
	}
	catch (err) {
		throw new Error("Resetting vault's lock-key failed",{ cause: err, });
	}
}

async function keys() {
	var { vaultEntry, } = await openVault(this);
	return Object.keys(vaultEntry.data);
}

async function entries() {
	var { vaultEntry, } = await openVault(this);
	return Object.entries(vaultEntry.data);
}

async function openVault(vault) {
	if (
		vault != null &&
		typeof vault.storageType == "string" &&
		typeof vault.id == "string"
	) {
		let { storageType, id: vaultID, } = vault;
		if (adapters[storageType] != null) {
			let vaultEntry = await getVaultEntry(storageType,vaultID);
			// note: even if the local vault cache is still present
			// and unlocked, retrieve the lock-key to ensure that
			// if its caching has expired, the user is re-prompted
			let vaultLockKey = await getLockKey({
				localIdentity: vaultEntry.accountID,
				relyingPartyID: vaultEntry.rpID,
			});
			unlockVaultEntry(vaultEntry,vaultLockKey);
			return { storageType, vaultID, vaultEntry, vaultLockKey, };
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
