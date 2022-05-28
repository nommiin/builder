class BuilderCompile {
	static run(autoRunFork) {
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
        let steamworksPath = null;
        let Userpath, Temporary; {
            let appBase = (isWindows ? Electron_App.getPath("appData") : `/Users/${process.env.LOGNAME}/.config`);
            let appDir = `${appBase}/${appName}/`;
            if (!Electron_FS.existsSync(appDir)) Electron_FS.mkdirSync(appDir);
            //
            try {
                let userData = JSON.parse(Electron_FS.readFileSync(`${appDir}/um.json`));
                let username = userData.login || userData.username;
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
                steamworksPath = userSettings["machine.Platform Settings.Steam.steamsdk_path"];
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
            Temporary += `${isWindows ? "" : "/GameMakerStudio2"}/GMS2TEMP`;
            if (!Electron_FS.existsSync(Temporary)) Electron_FS.mkdirSync(Temporary);
        }
        
        let Name = project.name.slice(0, project.name.lastIndexOf("."));
        Builder.Name = Builder.Sanitize(Name);
        
        // Create or reuse output tab!
		let output = BuilderOutput.open(false);
		output.clear(`Compile Started: ${Builder.GetTime()}\nUsing Runtime: ${runtimeSelection}`);
        output.write("Using Temporary Directory: " + Temporary);

        // Check for GMAssetCompiler and Runner files!
        let GMAssetCompilerDirOrig = Builder.Runtime + "/bin";
        let GMAssetCompilerPathOrig = GMAssetCompilerDirOrig + "/GMAssetCompiler.exe";
        let GMAssetCompilerDir2022 = Builder.Runtime + "/bin/assetcompiler/windows/x64";
        let GMAssetCompilerPath2022 = GMAssetCompilerDir2022 + "/GMAssetCompiler.exe";
        let GMAssetCompilerDir = GMAssetCompilerDirOrig;
        let GMAssetCompilerPath = GMAssetCompilerPathOrig;
        
        if (!Electron_FS.existsSync(GMAssetCompilerPath)) {
            if (Electron_FS.existsSync(GMAssetCompilerPath2022)) {
                GMAssetCompilerDir = GMAssetCompilerDir2022;
                GMAssetCompilerPath = GMAssetCompilerPath2022;
            } else {
                output.write(`!!! Could not find "GMAssetCompiler.exe" in ${GMAssetCompilerPath}`);
                Builder.Stop();
                return;
            }
        }
        if (Electron_FS.existsSync(`${Builder.Runtime}/${isWindows ? "windows/Runner.exe" : "mac/YoYo Runner.app"}`) == false) {
            output.write(`!!! Could not find ${isWindows ? "Runner.exe" : "YoYo Runner.app"} in ${Runtime}/${isWindows ? "windows/" : "mac/"}`);
            Builder.Stop();
            return;
        }
        Builder.MenuItems.stop.enabled = true;

        // Create substitute drive on Windows!
        if (isWindows && BuilderPreferences.current.useVirtualDrives) {
            let drive = BuilderDrives.add(Temporary);
            if (drive == null) {
                output.write(`!!! Could not find a free drive letter to use`)
                return;
            }
            Builder.Drive = drive;
            Builder.Drives.push(drive);
            Temporary = drive + ":/";
        } else if (!Temporary.endsWith("/") && !Temporary.endsWith("\\")) {
            Temporary += "/";
        }
        Builder.Outpath = Temporary + Name + "_" + Builder.Random();
        output.write("Using output path: " + Builder.Outpath);
        output.write(""); // GMAC doesn't line-break at the start

        // Run the compiler!
		let compilerArgs = [
			`/c`,
			`/zpex`,
			`/j=4`,
			`/gn=${Name}`,
			`/td=${Temporary}`,
			`/zpuf=${Userpath}`,
			`/m=${isWindows? "windows" : "mac"}`,
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
            `/rtp=${Builder.Runtime}`
		];
        if (isWindows) {
            Builder.Compiler = Builder.Command.spawn(GMAssetCompilerPath, compilerArgs, {
                cwd: Builder.Runtime,
            });
        } else {
            Builder.Compiler = Builder.Command.spawn("/Library/Frameworks/Mono.framework/Versions/Current/Commands/mono", [GMAssetCompilerPath].concat(compilerArgs));
        }

        // Capture compiler output!
        Builder.Compiler.stdout.on("data", (e) => {
			let text = e.toString();
            switch (Builder.Parse(text, 0)) {
                case 1: Builder.Stop();
                default: output.write(text, false);
            }
        });
        Builder.Compiler.stderr.on("data", (e) => {
			let text = e.toString();
            switch (Builder.Parse(text, 0)) {
                case 1: Builder.Stop();
                default: output.write(text, false);
            }
        });

        Builder.Compiler.on("close", (exitCode) => {
            if (exitCode != 0 || Builder.Compiler == undefined || Builder.ErrorMet == true) { Builder.Clean(); return; }
            
            // Rename output file!
            if (Name != Builder.Name || !isWindows) {
                let executableName = isWindows ? Name : "game";
                Electron_FS.renameSync(`${Builder.Outpath}/${executableName}.${Builder.Extension}`, `${Builder.Outpath}/${Builder.Name}.${Builder.Extension}`);
                Electron_FS.renameSync(`${Builder.Outpath}/${executableName}.yydebug`, `${Builder.Outpath}/${Builder.Name}.yydebug`);
            }
            
            // Copy Steam API binary if needed:
            if (Electron_FS.existsSync(`${Builder.Outpath}/steam_appid.txt`) && steamworksPath) try {
                if (isWindows) {
                    Electron_FS.copyFileSync(`${steamworksPath}/redistributable_bin/steam_api.dll`, `${Builder.Outpath}/steam_api.dll`);
                } else {
                    // note: not tested at all
                    Electron_FS.copyFileSync(`${steamworksPath}/redistributable_bin/osx32/libsteam_api.dylib`, `${Builder.Outpath}/libsteam_api.dylib`);
                }
            } catch (x) {
                console.error("Failed to copy steam_api:", x);
            }
            
            BuilderOutputAside.clearOnNextOpen = true;
            Builder.Runner.push(Builder.Spawn(Builder.Runtime, Builder.Outpath, Builder.Name));
            Builder.MenuItems.fork.enabled = true;
            if (autoRunFork) Builder.Fork();
            Builder.Compiler = undefined;
        });
	}
}