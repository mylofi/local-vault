import { defineAdapter } from "./lv.js";


// ***********************

defineAdapter({
	storageType: "cookie",
	read,
	write,
	find,
	clear,
});


// ***********************

function read(vaultID,vaultInfo) {
	var vaultEntry = getCookie(`local-vault-${vaultID}`);
	if (vaultEntry != null) {
		return vaultEntry;
	}

	// create and return default vault entry
	write(vaultID,vaultInfo,"");
	return getCookie(`local-vault-${vaultID}`);
}

function write(vaultID,vaultInfo,vaultData) {
	try {
		return setCookie(`local-vault-${vaultID}`,{ ...vaultInfo, data: vaultData, });
	}
	catch (err) {
		if (err.name == "QuotaExceededError") {
			throw new Error("Cookie is full.",{ cause: err, });
		}
		throw err;
	}
}

function find(search) {
	var searchEntries = Object.entries(search);
	var storageEntries = Object.entries(getAllCookies());
	for (let [ storageEntryProp, storageEntry, ] of storageEntries) {
		let [ , vaultID, ] = (storageEntryProp.match(/^local-vault-([^]+)$/) || []);
		// storage entry is a local-vault?
		if (vaultID != null) {
			let vaultEntry = JSON.parse(storageEntry || "null");
			if (
				// vault entry is non-empty?
				storageEntry != null &&

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
		removeCookie(`local-vault-${vaultID}`);
	}
	else {
		// remove all local-vault entries
		let storageEntryProps = Object.keys(getAllCookies());
		for (let storageEntryProp of storageEntryProps) {
			if (/^local-vault-[^]+$/.test(storageEntryProp)) {
				removeCookie(storageEntryProp);
			}
		}
	}
}

function getAllCookies() {
	return (
		Object.fromEntries(
			document.cookie
				.split(/\s*;\s*/)
				.filter(Boolean)
				.map(rawCookieVal => (
					rawCookieVal.split(/\s*=\s*/)
					.map(val => decodeURIComponent(val))
				))
		)
	);
}

function getCookie(name) {
	return JSON.parse(
		getAllCookies()[encodeURIComponent(name)] || "null"
	);
}

function setCookie(name,storageEntry) {
	var expires = new Date();
	var expiresSeconds = 400 * 24 * 60 * 60;	// 400 days from now (max allowed)
	expires.setTime(expires.getTime() + (expiresSeconds * 1000));
	var cookieName = encodeURIComponent(name);
	var cookieValue = encodeURIComponent(JSON.stringify(storageEntry));
	// cookieName + cookieValue > 4kb?
	//   (https://chromestatus.com/feature/4946713618939904)
	if ((cookieName.length + cookieValue.length) > 4096) {
		// https://developer.mozilla.org/en-US/docs/Web/API/DOMException#quotaexceedederror
		throw new DOMException("Cookie max size (4KB) exceeded","QuotaExceededError");
	}
	var cookie = [
		`${cookieName}=${cookieValue}`,
		`domain=${document.location.hostname}`,
		"path=/",
		"samesite=strict",
		"secure",
		`expires=${expires.toGMTString()}`,
		`maxage=${expiresSeconds}`,
	].join("; ");
	document.cookie = cookie;
}

function removeCookie(name) {
	var expires = new Date();
	expires.setTime(expires.getTime() - 1000);
	document.cookie = [
		`${encodeURIComponent(name)}=`,
		`domain=${document.location.hostname}`,
		"path=/",
		"samesite=strict",
		"secure",
		`expires=${expires.toGMTString()}`,
		"maxage=0"
	].join("; ");
}
