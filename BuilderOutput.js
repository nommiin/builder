class BuilderOutput {
	
	/** @type {BuilderOutput} */
	static main = null;
	
	/** @type {BuilderOutput} */
	static aside = null;
	
	static fileKind = (function() {
		const KCode = $gmedit["file.kind.KCode"];
		function KBuilderOutput() {
			KCode.call(this);
			this.setChangedOnEdits = false;
		}
		KBuilderOutput.prototype = GMEdit.extend(KCode.prototype, {});
		return new KBuilderOutput();
	})();
	
	constructor(title, aceEditor) {
		this.gmlFile = new $gmedit["gml.file.GmlFile"](title, null, BuilderOutput.fileKind, "");
		this.aceSession = this.gmlFile.codeEditor.session;
		this.aceEditors = [aceEditor];
	}
	
	clear(text = "") {
		this.aceSession.setValue(text);
	}
	
	write(text, addLineBreak = true) {
		let row = this.aceSession.getLength() - 1;
		let col;
		if (row < 0) {
			row = 0;
			col = this.aceSession.getLine(row).length;
		} else {
			col = this.aceSession.getLine(row).length;
			if (col > 0 && addLineBreak) {
				text = "\n" + text;
			}
		}
		let pos = { row: row, column: col };
		this.aceSession.insert(pos, text);
		
		let undoManager = this.aceSession.getUndoManager();
		if (undoManager) undoManager.markClean();
		
		for (let aceEditor of this.aceEditors) {
			if (aceEditor.session.gmlFile != this.gmlFile) continue;
			let renderer = aceEditor.renderer;
			row = this.aceSession.getLength() - 1;
			let pos = renderer.$cursorLayer.getPixelPosition({row: row, column: 0});
			let offset = pos.top;
			offset -= renderer.$size.scrollerHeight - renderer.lineHeight * 2;
			renderer.session.setScrollTop(offset);
		}
	}
	
	static open(isFork) {
		const prefs = BuilderPreferences.current;
		const forkAside = isFork && prefs.forkInSideView;
		const reuseTab = prefs.reuseTab;
		const lookFor = forkAside ? this.aside : this.main;
		
		const title = `${isFork && forkAside ? "Fork" : "Output"} (${Builder.GetTime()})`;
		
		if (lookFor && reuseTab)
		for (let tab of document.querySelectorAll(".chrome-tab")) {
			if (tab.gmlFile == lookFor.gmlFile) {
				tab.querySelector(".chrome-tab-title-text").innerText = title;
				if (forkAside) {
					BuilderOutputAside.show(lookFor);
				} else tab.click();
				return lookFor;
			}
		}
		
		const GmlFile = $gmedit["gml.file.GmlFile"];
		let output = new BuilderOutput(title, window.aceEditor);
		if (forkAside) {
			this.aside = output;
			let currentTab = GmlFile.current.tabEl;
			GmlFile.openTab(output.gmlFile);
			BuilderOutputAside.show(output);
			currentTab.click();
		} else {
			this.main = output;
			GmlFile.openTab(output.gmlFile);
		}
		
		return output;
	}
}