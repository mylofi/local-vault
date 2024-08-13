import { defineAdapter } from "./lv.js";


// ***********************

var rootFS;

defineAdapter({
	storageType: "opfs",
	read,
	write,
	find,
	clear,
});


// ***********************

async function read(vaultID,vaultInfo) {
	var vaultEntry = await readFile(`local-vault-${vaultID}`);
	if (vaultEntry != null) {
		return vaultEntry;
	}

	// create and return default vault entry
	await write(vaultID,vaultInfo,"");
	return readFile(`local-vault-${vaultID}`);
}

function write(vaultID,vaultInfo,vaultData) {
	try {
		return writeFile(`local-vault-${vaultID}`,{ ...vaultInfo, data: vaultData, });
	}
	catch (err) {
		if (err.name == "QuotaExceededError") {
			throw new Error("Local-storage is full, please request more storage space.",{ cause: err, });
		}
		throw err;
	}
}

async function find(search) {
	// note: trick to skip `await` microtask when
	// not a promise
	rootFS = getRootFS();
	rootFS = isPromise(rootFS) ? await rootFS : rootFS;

	var searchEntries = Object.entries(search);
	for await (let storageEntryProp of rootFS.keys()) {
		let [ , vaultID, ] = (storageEntryProp.match(/^local-vault-([^]+)$/) || []);
		// storage entry is a local-vault?
		if (vaultID != null) {
			let vaultEntry = await readFile(storageEntryProp);
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

async function clear(vaultID = null) {
	// note: trick to skip `await` microtask when
	// not a promise
	rootFS = getRootFS();
	rootFS = isPromise(rootFS) ? await rootFS : rootFS;

	if (vaultID != null) {
		return deleteFile(`local-vault-${vaultID}`);
	}
	else {
		// remove all local-vault entries
		for await (let filename of rootFS.keys()) {
			if (/^local-vault-[^]+$/.test(filename)) {
				await deleteFile(filename);
			}
		}
	}
}

async function readFile(filename) {
	// note: trick to skip `await` microtask when
	// not a promise
	rootFS = getRootFS();
	rootFS = isPromise(rootFS) ? await rootFS : rootFS;

	var fh = await rootFS.getFileHandle(filename,{ create: true, });
	var file = await fh.getFile();
	return JSON.parse((await file.text()) || "null");
}

async function writeFile(filename,storageEntry) {
	// note: trick to skip `await` microtask when
	// not a promise
	rootFS = getRootFS();
	rootFS = isPromise(rootFS) ? await rootFS : rootFS;

	var fh = await rootFS.getFileHandle(filename,{ create: true, });
	var file = await fh.createWritable();
	await file.write(JSON.stringify(storageEntry));
	return file.close();
}

async function deleteFile(filename) {
	// note: trick to skip `await` microtask when
	// not a promise
	rootFS = getRootFS();
	rootFS = isPromise(rootFS) ? await rootFS : rootFS;

	return rootFS.removeEntry(filename);
}

function getRootFS() {
	return (
		rootFS == null ?
			navigator.storage.getDirectory() :
			rootFS
	);
}

function isPromise(val) {
	return (val && typeof val == "object" && typeof val.then == "function");
}
