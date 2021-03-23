class BuilderOutputAside {
	
	/** @type {AceEditor} */
	static aceEditor = null;
	
	static aceSession = null;
	
	/** @type {HTMLDivElement} */
	static sizer = null;
	
	/** @type {GMEdit_Splitter} */
	static splitter = null;
	
	/** @type {HTMLDivElement} */
	static container = null;
	
	/** @type {HTMLDivElement} */
	static parent = null;
	
	/** @type {BuilderOutput} */
	static output = null;
	
	static editorID = "builder_fork";
	
	static prepare() {
		this.container = document.createElement("div");
		this.container.classList.add("ace_container");
		
		this.sizer = document.createElement("div");
		this.sizer.setAttribute("splitter-element", "#" + this.editorID);
		this.sizer.setAttribute("splitter-lskey", "aside_width");
		this.sizer.setAttribute("splitter-default-width", "" + (aceEditor.container.clientWidth >> 1));
		this.sizer.classList.add("splitter-td");
		
		let nextCont = document.createElement("div");
		nextCont.classList.add("ace_container");
		// .ace_container[editor] -> .ace_container[.ace_container[editor], splitter, .ace_container[aside_editor]]:
		let mainCont = aceEditor.container.parentElement;
		var mainChildren = [];
		for (let el of mainCont.children) mainChildren.push(el);
		for (let ch of mainChildren) {
			mainCont.removeChild(ch);
			nextCont.appendChild(ch);
		}
		mainCont.style.setProperty("flex-direction", "row");
		mainCont.appendChild(nextCont);
		mainCont.appendChild(this.sizer);
		mainCont.appendChild(this.container);
		this.parent = mainCont;
		
		var textarea = document.createElement("textarea");
		this.container.appendChild(textarea);
		this.aceEditor = GMEdit.aceTools.createEditor(textarea);
		
		this.container.id = this.editorID;
		this.splitter = new GMEdit_Splitter(this.sizer);
		
		this.aceEditor.commands.addCommand({
			name: "exitPeekAside",
			bindKey: "Escape|Ctrl-W",
			exec: (e) => {
				for (let tab of $gmedit["ui.ChromeTabs"].element.querySelectorAll(".chrome-tab")) {
					if (tab.gmlFile != e.session.gmlFile) continue;
					BuilderOutputAside.hide();
					/*if (!tab.classList.contains("chrome-tab-current")) {
						tab.querySelector(".chrome-tab-close").click();
					}*/
					break;
				}
			}
		});
	}
	
	static emitResize() {
		var e = new CustomEvent("resize");
		e.initEvent("resize");
		window.dispatchEvent(e);
	}
	
	static onFileClose(e) {
		if (e.file == BuilderOutputAside.output?.gmlFile) {
			BuilderOutputAside.hide();
		}
	}
	
	/** @param {BuilderOutput} output */
	static show(output) {
		if (this.output == null) {
			GMEdit.on("fileClose", this.onFileClose);
			if (this.aceEditor != null) {
				this.parent.appendChild(this.sizer);
				this.parent.appendChild(this.container);
			} else this.prepare();
			this.emitResize();
		}
		this.output = output;
		this.aceSession = GMEdit.aceTools.cloneSession(output.aceSession);
		this.aceEditor.setSession(this.aceSession);
		output.aceEditors.push(this.aceEditor);
	}
	
	static hide() {
		if (this.output == null) return;
		GMEdit.off("fileClose", this.onFileClose);
		this.parent.removeChild(this.sizer);
		this.parent.removeChild(this.container);
		this.output = null;
		this.aceSession = null;
		this.emitResize();
		setTimeout(() => window.aceEditor.focus());
	}
}