import {
	get as idbGet,
	set as idbSet,
	del as idbDel,
	keys as idbKeys,
	entries as idbEntries,
} from "idb-keyval";
import { defineAdapter } from "./lv.js";


// ***********************

defineAdapter({
	storageType: "idb",
	read,
	write,
	find,
	clear,
	raw: {
		has: hasRaw,
		get: idbGet,
		set: writeRaw,
		remove: removeRaw,
	},
});


// ***********************

async function hasRaw(rawName) {
	return ((await idbKeys()) || []).includes(rawName);
}

async function read(vaultID,vaultInfo) {
	var vaultEntry = await idbGet(`local-vault-${vaultID}`);
	if (vaultEntry != null) {
		return vaultEntry;
	}

	// create and return default vault entry
	await write(vaultID,vaultInfo,"");
	return idbGet(`local-vault-${vaultID}`);
}

async function write(vaultID,vaultInfo,vaultData) {
	return writeRaw(`local-vault-${vaultID}`,{ ...vaultInfo, data: vaultData, });
}

async function writeRaw(rawName,rawValue) {
	try {
		await idbSet(rawName,rawValue);
		return true;
	}
	catch (err) {
		if (err.name == "QuotaExceededError") {
			throw new Error("IndexedDB storage is full.",{ cause: err, });
		}
		throw err;
	}
}

async function removeRaw(rawName) {
	await idbDel(rawName);
	return true;
}

async function find(search) {
	var searchEntries = Object.entries(search);
	var storageEntries = await idbEntries();
	for (let [ storageEntryProp, storageEntry, ] of storageEntries) {
		let [ , vaultID, ] = (storageEntryProp.match(/^local-vault-([^]+)$/) || []);
		if (
			// storage entry is a local-vault?
			vaultID != null &&

			// vault entry is non-empty?
			storageEntry != null &&

			// vault entry matches the search?
			searchEntries.every(
				([ prop, val, ]) => storageEntry[prop] == val
			)
		) {
			return [ vaultID, storageEntry, ];
		}
	}
	return [];
}

async function clear(vaultID = null) {
	if (vaultID != null) {
		return idbDel(`local-vault-${vaultID}`);
	}
	else {
		// remove all local-vault entries
		let storageEntryProps = await idbKeys();
		for (let storageEntryProp of storageEntryProps) {
			if (/^local-vault-[^]+$/.test(storageEntryProp)) {
				await idbDel(storageEntryProp);
			}
		}
	}
}
