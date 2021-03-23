class BuilderCompile {
	static run() {
		// Make sure a GMS2 project is open!
        let project = $gmedit["gml.Project"].current;
        if (Builder.ProjectVersion(project) != 2) return;
        const isWindows = (Builder.Platform == "win");

        // Clear any past errors!
        Builder.Errors = [];
        Builder.ErrorMet = false;

        // Save all edits if enabled!
        if (BuilderPreferences.current.saveCompile == true) {
            for (let tab of document.querySelectorAll(".chrome-tab-changed")) {
                let file = tab.gmlFile;
                if (file && file.__changed && file.path != null) file.save();
            }
        }

        // Close any runners if open
        if (BuilderPreferences.current.stopCompile == true) {
            if (Builder.Runner.length > 0) {
                Builder.Runner.forEach((e) => {
                    e.kill();
                });
            }
            Builder.Runner = [];
        }

        // Find the temporary directory!
        let builderSettings = project.properties.builderSettings;
        let runtimeSelection;
        if (builderSettings?.runtimeVersion) {
            let found = false;
            runtimeSelection = builderSettings.runtimeVersion;
            for (let [_, set] of Object.entries(BuilderPreferences.current.runtimeSettings)) {
                if (!set.runtimeList.includes(runtimeSelection)) continue;
                Builder.Runtime = set.location + runtimeSelection;
                found = true;
                break;
            }
            if (!found) {
                $gmedit["electron.Dialog"].showError(`Couldn't find runtime ${runtimeSelection} that is set in project properties!`);
                return;
            }
        } else {
            runtimeSelection = Builder.RuntimeSettings.selection;
            Builder.Runtime = Builder.RuntimeSettings.location + runtimeSelection;
        }
        //
        let isBeta = runtimeSelection.startsWith("runtime-23.");
        let appName = (isBeta ? "GameMakerStudio2-Beta" : "GameMakerStudio2");
        let Userpath, Temporary; {
            let appBase = (isWindows ? Electron_App.getPath("appData") : `/Users/${process.env.LOGNAME}/.config`);
            let appDir = `${appBase}/${appName}/`;
            if (!Electron_FS.existsSync(appDir)) Electron_FS.mkdirSync(appDir);
            //
            try {
                let userData = JSON.parse(Electron_FS.readFileSync(`${appDir}/um.json`));
                let username = userData.username;
                // "you@domain.com" -> "you":
                let usernameAtSign = username.indexOf("@");
                if (usernameAtSign >= 0) username = username.slice(0, usernameAtSign);
                //
                Userpath = `${appDir}/${username}_${userData.userID}`;
            } catch (x) {
                $gmedit["electron.Dialog"].showError([
                    "Failed to figure out your user path!",
                    "Make sure you're logged in.",
                    "Error: " + x
                ].join("\n"));
                return;
            }
            //
            try {
                let userSettings = JSON.parse(Electron_FS.readFileSync(`${Userpath}/local_settings.json`));
                Temporary = userSettings["machine.General Settings.Paths.IDE.TempFolder"];
            } catch (x) {
                console.error("Failed to read temporary folder path, assuming default.", x);
                Temporary = null;
            }
            if (!Temporary) { // figure out default location
                if (isWindows) {
                    Temporary = `${process.env.LOCALAPPDATA}/${appName}`;
                } else {
                    Temporary = require("os").tmpdir();
                    if (Temporary.endsWith("/T")) Temporary = Temporary.slice(0, -2); // ?
                }
            }
            // for an off-chance that your %LOCALAPPDATA%/GameMakerStudio2 directory doesn't exist
            if (!Electron_FS.existsSync(Temporary)) Electron_FS.mkdirSync(Temporary);
            Temporary += "/GMS2TEMP";
            if (!Electron_FS.existsSync(Temporary)) Electron_FS.mkdirSync(Temporary);
        }
        
        let Name = project.name.slice(0, project.name.lastIndexOf("."));
        Builder.Name = Builder.Sanitize(Name);
        
        // Create or reuse output tab!
        let Time = new Date(), Create = true;
        if (BuilderPreferences.current.reuseTab == true) {
           document.querySelectorAll(".chrome-tab").forEach((e) => {
                if (e.gmlFile.output != undefined || e.gmlFile.output == true) {
                    $gmedit["ui.ChromeTabs"].impl.setCurrentTab(e);
                    e.childNodes.forEach((e) => { if (e.className == "chrome-tab-title") e.innerText = `Output (${Builder.GetTime(Time)})`; })
                    e.gmlFile.editor.session.setValue("");
                    Builder.Output = e.gmlFile;
                    Create = false;
                }
            });
        }
        if (Create == true) {
            let GmlFile = $gmedit["gml.file.GmlFile"];
            Builder.Output = new GmlFile(`Output (${Builder.GetTime(Time)})`, null, $gmedit["file.kind.misc.KPlain"].inst, "");
            Builder.Output.output = true;
            Builder.Output.Write = function(e, n=true) {
                this.editor.session.setValue(this.editor.session.getValue() + (n ? "\n" : "") + e);
                if (aceEditor.session.gmlFile == this) {
                    aceEditor.gotoLine(aceEditor.session.getLength());
                }
            }
            GmlFile.openTab(Builder.Output);
        }
        Builder.Output.editor.session.setValue(`Compile Started: ${Builder.GetTime(Time)}\nUsing Runtime: ${runtimeSelection}`);
        Builder.Output.Write("Using Temporary Directory: " + Temporary);

        // Check for GMAssetCompiler and Runner files!
        if (Electron_FS.existsSync(`${Builder.Runtime}/bin/GMAssetCompiler.exe`) == false) {
            Builder.Output.Write(`!!! Could not find "GMAssetCompiler.exe" in ${Builder.Runtime}/bin/`);
            Builder.Stop();
            return;
        } else if (Electron_FS.existsSync(`${Builder.Runtime}/${Builder.Platform == "win" ? "windows/Runner.exe" : "mac/YoYo Runner.app"}`) == false) {
            Builder.Output.Write(`!!! Could not find ${Builder.Platform == "win" ? "Runner.exe" : "YoYo Runner.app"} in ${Runtime}/${Builder.Platform == "win" ? "windows/" : "mac/"}`);
            Builder.Stop();
            return;
        }
        Builder.MenuItems.stop.enabled = true;

        // Create substitute drive on Windows!
        if (Builder.Platform == "win") {
            let drive = BuilderDrives.add(Temporary);
            if (drive == null) {
                Builder.Output.Write(`!!! Could not find a free drive letter to use`)
                return;
            }
            Builder.Drive = drive;
            Temporary = drive + ":/";
        }
        Builder.Outpath = Temporary + Name + "_" + Builder.Random();
        Builder.Output.Write("Using Output Path: " + Builder.Outpath);
        Builder.Output.Write(""); // GMAC doesn't line-break at the start

        // Run the compiler!
		let compilerArgs = [
			`/c`,
			`/zpex`,
			`/j=4`,
			`/gn=${Name}`,
			`/td=${Temporary}`,
			`/zpuf=${Userpath}`,
			`/m=${Builder.Platform == "win" ? "windows" : "mac"}`,
			`/tgt=64`,
			`/nodnd`,
			`/cfg=${$gmedit["gml.Project"].current.config}`,
			`/o=${Builder.Outpath}`,
			`/sh=True`,
			`/cvm`,
			`/baseproject=${Builder.Runtime}/BaseProject/BaseProject.yyp`,
			`${$gmedit["gml.Project"].current.path}`,
			`/v`,
			`/bt=run`,
		];
        if (Builder.Platform == "win") {
            Builder.Compiler = Builder.Command.spawn(`${Builder.Runtime}/bin/GMAssetCompiler.exe`, compilerArgs);
        } else {
            Builder.Compiler = Builder.Command.spawn("/Library/Frameworks/Mono.framework/Versions/Current/Commands/mono", [`${Builder.Runtime}/bin/GMAssetCompiler.exe`].concat(compilerArgs));
        }

        // Capture compiler output!
        Builder.Compiler.stdout.on("data", (e) => {
            switch (Builder.Parse(e, 0)) {
                case 1: Builder.Stop();
                default: Builder.Output.Write(e, false);
            }
        });

        Builder.Compiler.on("close", (exitCode) => {
            // Rename output file!
            if (exitCode != 0 || Builder.Compiler == undefined || Builder.ErrorMet == true) { Builder.Clean(); return; }
            Electron_FS.renameSync(`${Builder.Outpath}/${Name}.${Builder.Extension}`, `${Builder.Outpath}/${Builder.Name}.${Builder.Extension}`);
            Electron_FS.renameSync(`${Builder.Outpath}/${Name}.yydebug`, `${Builder.Outpath}/${Builder.Name}.yydebug`);
            Builder.Runner.push(Builder.Spawn(Builder.Runtime, Builder.Outpath, Builder.Name));
            Builder.MenuItems.fork.enabled = true;
            Builder.Compiler = undefined;
        });
	}
}