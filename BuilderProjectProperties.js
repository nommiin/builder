class BuilderProjectProperties {
	static build(project, target) {
		const Preferences = $gmedit["ui.Preferences"];
		let group = Preferences.addGroup(target, "builder Settings");
		const defaultVersion = "<default>";
		
		//
		let ensureJSON = (isDefault) => {
			let properties = project.properties;
			let json = properties.builderSettings;
			if (isDefault && json == null) return null;
			if (json == null) json = properties.builderSettings = {};
			return json;
		};
		
		let json = project.properties.builderSettings;
		
		//
		let versions = [defaultVersion];
		for (let [_, set] of Object.entries(BuilderPreferences.current.runtimeSettings)) {
			versions = versions.concat(set.runtimeList);
		}
		
		Preferences.addDropdown(group,
			"Version override",
			json?.runtimeVersion ?? defaultVersion,
			versions,
		(v) => {
			if (v == defaultVersion) v = null;
			let json = ensureJSON(v == null);
			if (json == null) return;
			json.runtimeVersion = v;
			$gmedit["ui.project.ProjectProperties"].save(project, project.properties);
		});
		
		//
		let argsField = Preferences.addInput(group,
			"Fork arguments override",
			json?.forkArguments ?? "",
		(v) => {
			if (v == "") v = null;
			let json = ensureJSON(v == null);
			if (json == null) return;
			json.forkArguments = v;
			$gmedit["ui.project.ProjectProperties"].save(project, project.properties);
		}).querySelector("input");
		argsField.placeholder = BuilderPreferences.current.forkArguments;
	}
	
	static ready() {
		GMEdit.on("projectPropertiesBuilt", (e) => {
			this.build(e.project, e.target);
		});
	}
}