export default baseAdapter;


// ***********************

function baseAdapter(clientStore) {
	return {
		read,
		write,
		find,
		clear,
	};


	// ***********************

	async function read(vaultID,vaultInfo) {
		var vaultEntry = await clientStore.get(`local-vault-${vaultID}`);
		if (vaultEntry != null) {
			return vaultEntry;
		}

		// create and return default vault entry
		await write(vaultID,vaultInfo,"");
		return clientStore.get(`local-vault-${vaultID}`);
	}

	async function write(vaultID,vaultInfo,vaultData) {
		return clientStore.set(`local-vault-${vaultID}`,{ ...vaultInfo, data: vaultData, });
	}

	async function find(search) {
		var searchEntries = Object.entries(search);
		for (let [ storageEntryProp, vaultEntry, ] of clientStore.entries()) {
			let [ , vaultID, ] = (storageEntryProp.match(/^local-vault-([^]+)$/) || []);
			if (
				// storage entry is a local-vault?
				vaultID != null &&

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
		return [];
	}

	async function clear(vaultID = null) {
		if (vaultID != null) {
			return clientStore.remove(`local-vault-${vaultID}`);
		}
		else {
			// remove all local-vault entries
			for (let storageEntryProp of (await clientStore.keys()).filter(
				name => /^local-vault-[^]+$/.test(name)
			)) {
				await clientStore.remove(storageEntryProp);
			}
			return true;
		}
	}
}
