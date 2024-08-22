import { defineAdapter } from "./lv.js";


// ***********************

defineAdapter({
	storageType: "local-storage",
	read,
	write,
	find,
	clear,
	raw: {
		has: hasRaw,
		get: readRaw,
		set: writeRaw,
		remove: removeRaw,
	},
});


// ***********************

function hasRaw(rawName) {
	return (window.localStorage.getItem(rawName) !== null);
}

function read(vaultID,vaultInfo) {
	var vaultEntry = readRaw(`local-vault-${vaultID}`);
	if (vaultEntry != null) {
		return vaultEntry;
	}

	// create and return default vault entry
	write(vaultID,vaultInfo,"");
	return readRaw(`local-vault-${vaultID}`);
}

function readRaw(rawName) {
	var rawValue = window.localStorage.getItem(rawName);
	if (rawValue != null && rawValue != "") {
		try { return JSON.parse(rawValue); } catch (err) {}
	}
	return rawValue;
}

function write(vaultID,vaultInfo,vaultData) {
	return writeRaw(`local-vault-${vaultID}`,{ ...vaultInfo, data: vaultData, });
}

function writeRaw(rawName,rawValue) {
	try {
		window.localStorage.setItem(rawName,JSON.stringify(rawValue));
		return true;
	}
	catch (err) {
		if (err.name == "QuotaExceededError") {
			throw new Error("Local-storage is full.",{ cause: err, });
		}
		throw err;
	}
}

function removeRaw(rawName) {
	window.localStorage.removeItem(rawName);
	return true;
}

function find(search) {
	var searchEntries = Object.entries(search);
	for (let i = 0; i < window.localStorage.length; i++) {
		let storageEntryProp = window.localStorage.key(i);
		let [ , vaultID, ] = (storageEntryProp.match(/^local-vault-([^]+)$/) || []);
		// storage entry is a local-vault?
		if (vaultID != null) {
			let vaultEntry = readRaw(storageEntryProp);
			if (
				// vault entry is non-empty?
				vaultEntry != null &&

				// vault entry matches the search?
				searchEntries.every(
					([ prop, val, ]) => vaultEntry[prop] == val
				)
			) {
				return [ vaultID, vaultEntry, ];
			}
		}
	}
	return [];
}

function clear(vaultID = null) {
	if (vaultID != null) {
		removeRaw(`local-vault-${vaultID}`);
	}
	else {
		// collect all local-vault IDs
		let localVaultIDs = [];
		for (let i = 0; i < window.localStorage.length; i++) {
			let storageEntryProp = window.localStorage.key(i);
			if (/^local-vault-[^]+$/.test(storageEntryProp)) {
				localVaultIDs.push(storageEntryProp);
			}
		}

		// remove all local-vault entries
		for (let localVaultID of localVaultIDs) {
			removeRaw(localVaultID);
		}
	}
}
