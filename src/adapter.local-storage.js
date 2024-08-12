import { defineAdapter } from "./lv.js";


// ***********************

defineAdapter({
	storageType: "local-storage",
	read,
	write,
	find,
	clear,
});


// ***********************

function read(vaultID,vaultInfo) {
	var vaultEntryStr = window.localStorage.getItem(`local-vault-${vaultID}`);
	if (vaultEntryStr != null) {
		let vault = JSON.parse(vaultEntryStr);
		return vault;
	}

	// create and return default vault entry
	write(vaultID,vaultInfo,"");
	return JSON.parse(window.localStorage.getItem(`local-vault-${vaultID}`));
}

function write(vaultID,vaultInfo,vaultData) {
	window.localStorage.setItem(
		`local-vault-${vaultID}`,
		JSON.stringify({ ...vaultInfo, data: vaultData, })
	);
}

function find(search) {
	var searchEntries = Object.entries(search);
	for (let i = 0; i < window.localStorage.length; i++) {
		let storageEntryProp = window.localStorage.key(i);
		let [ , vaultID, ] = (storageEntryProp.match(/^local-vault-([^]+)$/) || []);
		// storage entry is a local-vault?
		if (vaultID != null) {
			let vaultEntry = JSON.parse(window.localStorage.getItem(storageEntryProp) || "null");
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
		window.localStorage.removeItem(`local-vault-${vaultID}`);
	}
	else {
		// remove all local-vault entries
		for (let i = 0; i < window.localStorage.length; i++) {
			let storageEntryProp = window.localStorage.key(i);
			if (/^local-vault-[^]+$/.test(storageEntryProp)) {
				window.localStorage.removeItem(storageEntryProp);
			}
		}
	}
}
