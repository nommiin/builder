class BuilderDrives {
	static file = new $gmedit["electron.ConfigFile"]("session", "builder-drives");
	
	static add(path) {
		let raw = Builder.Command.execSync("wmic logicaldisk get caption").toString();
		let lines = raw.replace(/\r/g, "").split("\n");
		let takenLetters = {};
		for (let line of lines) {
			let mt = /([A-Z]):/.exec(line);
			if (mt) takenLetters[mt[1]] = true;
		}
		
		let freeLetters = [];
		for (let i = "A".charCodeAt(); i <= "Z".charCodeAt(); i++) {
			let c = String.fromCharCode(i);
			if (!takenLetters[c]) freeLetters.push(c);
		}
		//console.log("Candidate letters:", freeLetters);
		if (freeLetters.length == 0) return null;
		
		let drive = freeLetters[0 | (Math.random() * freeLetters.length)];
		try {
			Builder.Command.execSync(`subst ${drive}: "${path}"`);
		} catch (x) {
			BuilderOutput.main.write(`Failed to subst ${drive}: `, x);
			return null;
		}
		BuilderOutput.main.write(`Using Virtual Drive: ${drive}`);
		
		let conf = this.file;
		if (conf.sync()) conf.data = [];
		conf.data.push(drive);
		conf.flush();
		
		return drive;
	}
	
	static remove(drive) {
		drive ??= Builder.Drive;
		if (drive == null) return;
		BuilderOutput.main.write(`Removing Virtual Drive: ${drive}`); 
		Builder.Command.execSync(`subst /d ${drive}:`);
		
		let conf = this.file;
		if (conf.sync()) conf.data = [];
		let ind = conf.data.indexOf(drive);
		if (ind >= 0) {
			conf.data.splice(ind, 1);
			conf.flush();
		}
	}
	
	static removeCurrent() {
		for (let drive of Builder.Drives) {
			this.remove(drive);
		}
		Builder.Drives.length = 0;
		Builder.Drive = "";
	}
	
	static clean() {
		let conf = this.file;
		if (conf.sync()) conf.data = [];
		let done = [];
		for (let c of conf.data) {
			try {
				Builder.Command.execSync(`subst /d ${c}:`);
				done.push(c);
			} catch(e) {};
		}
		conf.data = [];
		conf.flush();
		Electron_Dialog.showMessageBox({type: "info", title: "Builder", message: `Finished cleaning virtual drives (${done.join(", ")}).`});
	}
}