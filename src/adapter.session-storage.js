import { defineAdapter } from "./lv.js";


// ***********************

defineAdapter({
	storageType: "session-storage",
	read,
	write,
	find,
	clear,
});


// ***********************

function read(vaultID,vaultInfo) {
	var vaultEntryStr = window.sessionStorage.getItem(`local-vault-${vaultID}`);
	if (vaultEntryStr != null) {
		let vault = JSON.parse(vaultEntryStr);
		return vault;
	}

	// create and return default vault entry
	write(vaultID,vaultInfo,"");
	return JSON.parse(window.sessionStorage.getItem(`local-vault-${vaultID}`));
}

function write(vaultID,vaultInfo,vaultData) {
	try {
		window.sessionStorage.setItem(
			`local-vault-${vaultID}`,
			JSON.stringify({ ...vaultInfo, data: vaultData, })
		);
	}
	catch (err) {
		if (err.name == "QuotaExceededError") {
			throw new Error("Local-storage is full, please request more storage space.",{ cause: err, });
		}
		throw err;
	}
}

function find(search) {
	var searchEntries = Object.entries(search);
	for (let i = 0; i < window.sessionStorage.length; i++) {
		let storageEntryProp = window.sessionStorage.key(i);
		let [ , vaultID, ] = (storageEntryProp.match(/^local-vault-([^]+)$/) || []);
		// storage entry is a local-vault?
		if (vaultID != null) {
			let vaultEntry = JSON.parse(window.sessionStorage.getItem(storageEntryProp) || "null");
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
		window.sessionStorage.removeItem(`local-vault-${vaultID}`);
	}
	else {
		// collect all local-vault IDs
		let localVaultIDs = [];
		for (let i = 0; i < window.sessionStorage.length; i++) {
			let storageEntryProp = window.sessionStorage.key(i);
			if (/^local-vault-[^]+$/.test(storageEntryProp)) {
				localVaultIDs.push(storageEntryProp);
			}
		}

		// remove all local-vault entries
		for (let localVaultID of localVaultIDs) {
			window.sessionStorage.removeItem(localVaultID);
		}
	}
}
