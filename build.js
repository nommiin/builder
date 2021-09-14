Builder = Object.assign(Builder, {
    Extension: (Builder.Platform.includes("Windows") == true ? "win" : "ios"),
    Command: require("child_process"),
    Compiler: undefined,
    Output: undefined,
    ErrorMet: false,
    Runner: [],
    Errors: [],
    Outpath: "",
    Runtime: "",
    Drive: "",
    Run: function() {
        // Make sure a GMS2 project is open!
        var project = $gmedit["gml.Project"].current;
        if (Builder.ProjectVersion(project) != 2) return;

        // Clear any past errors!
        Builder.Errors = [];
        Builder.ErrorMet = false;

        // Save all edits if enabled!
        if (Builder.Preferences.saveCompile == true) {
            let Changed = document.querySelectorAll(".chrome-tab-changed");
            for(let i = 0; i < Changed.length; i++) {
                let File = Changed[i].gmlFile;
                if (File.__changed == true && File.path != null) {
                    File.save();
                }
            }
        }

        // Close any runners if open
        if (Builder.Preferences.stopCompile == true) {
            if (Builder.Runner.length > 0) {
                Builder.Runner.forEach((e) => {
                    e.kill();
                });
            }
            Builder.Runner = [];
        }

        // Find the temporary directory!
        let Userpath = "", Temporary = require("os").tmpdir();
        Builder.Runtime = Builder.RuntimeSettings.location + Builder.RuntimeSettings.selection;
        if (Builder.Platform == "win") {
            let User = JSON.parse(Electron_FS.readFileSync(Electron_App.getPath("appData") + "/GameMakerStudio2/um.json"));
            Userpath = `${Electron_App.getPath("appData")}/GameMakerStudio2/${User.username.slice(0, User.username.indexOf("@")) + "_" + User.userID}`;
            Temporary = (JSON.parse(Electron_FS.readFileSync(`${Userpath}/local_settings.json`))["machine.General Settings.Paths.IDE.TempFolder"] || `${process.env.LOCALAPPDATA}/GameMakerStudio2`) + "/GMS2TEMP";
        } else {
            let User = JSON.parse(Electron_FS.readFileSync("/Users/" + process.env.LOGNAME + "/.config/GameMakerStudio2/um.json"));
            Userpath = `/Users/${process.env.LOGNAME}/.config/GameMakerStudio2/${User.username.slice(0, User.username.indexOf("@")) + "_" + User.userID}`;
            Temporary = (JSON.parse(Electron_FS.readFileSync(`${Userpath}/local_settings.json`))["machine.General Settings.Paths.IDE.TempFolder"] || `${(Temporary.endsWith("/T") ? Temporary.slice(0, -2) : Temporary)}/GameMakerStudio2`) + "/GMS2TEMP/";
        }
        if (Electron_FS.existsSync(Temporary) == false) Electron_FS.mkdirSync(Temporary);
        
        let Name = project.name.slice(0, project.name.lastIndexOf("."));
        Builder.Name = Builder.Sanitize(Name);
        
        // Create or reuse output tab!
        let Time = new Date(), Create = true;
        if (Builder.Preferences.reuseTab == true) {
           document.querySelectorAll(".chrome-tab").forEach((e) => {
                if (e.gmlFile.output != undefined || e.gmlFile.output == true) {
                    //Check for Preference of opening existing tab on compile
                    if (Builder.Preferences.openOutputTabOnCompile == true) {
                        $gmedit["ui.ChromeTabs"].impl.setCurrentTab(e);
                    }
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
            
            //If creating new output tab, always open it
            GmlFile.openTab(Builder.Output);
        }
        Builder.Output.editor.session.setValue(`Compile Started: ${Builder.GetTime(Time)}\nUsing Runtime: ${Builder.Preferences.runtimeSelection}`);
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
            let Drives = Builder.Command.execSync("wmic logicaldisk get caption").toString().replace("Caption", "").split(":").map(c => c.trim());
            while (Builder.Drive == "" || Drives.includes(Builder.Drive) == true) {
                Builder.Drive = String.fromCharCode(65 + Math.round((Math.random() * 25)));
            }
            Builder.Command.execSync(`subst ${Builder.Drive}: "${Temporary}"`);
            Builder.Output.Write("Using Virtual Drive: " + Builder.Drive);
            window.localStorage["builder:drives"] += Builder.Drive;
            Temporary = Builder.Drive + ":/";
        }
        Builder.Outpath = Temporary + Name + "_" + Builder.Random();
        Builder.Output.Write("Using Output Path: " + Builder.Outpath);

        // Run the compiler!
        if (Builder.Platform == "win") {
            Builder.Compiler = Builder.Command.spawn(`${Builder.Runtime}/bin/GMAssetCompiler.exe`, ["/c", "/zpex", "/j=4", `/gn="${Name}"`, `/td=${Temporary}`, `/zpuf=${Userpath}`, "/m=windows", "/tgt=64", "/nodnd", `/cfg=${$gmedit["gml.Project"].current.config}`, `/o=${Builder.Outpath}`, `/sh=True`, `/cvm`, `/baseproject=${Builder.Runtime}/BaseProject/BaseProject.yyp`, `${$gmedit["gml.Project"].current.path}`, "/v", "/bt=run"]);
        } else {
            Builder.Compiler = Builder.Command.spawn("/Library/Frameworks/Mono.framework/Versions/Current/Commands/mono", [`${Builder.Runtime}/bin/GMAssetCompiler.exe`, "/c", "/zpex", "/j=4", `/gn="${Name}"`, `/td=${Temporary}`, `/zpuf=${Userpath}`, `/m=mac`, "/tgt=64", "/nodnd", `/cfg=${$gmedit["gml.Project"].current.config}`, `/o=${Builder.Outpath}`, `/sh=True`, `/cvm`, `/baseproject=${Builder.Runtime}/BaseProject/BaseProject.yyp`, `${$gmedit["gml.Project"].current.path}`, "/v", "/bt=run"]);
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
    },
    Stop: function() {
        // Make sure a GMS2 project is open!
        if (Builder.ProjectVersion($gmedit["gml.Project"].current) != 2) return;

        // Display errors and kill processes!
        if (Builder.ErrorMet == true) Builder.Display();
        if (Builder.Compiler != undefined) {
            Builder.Compiler.kill();
            Builder.Compiler = undefined;
        }
        if (Builder.Runner.length > 0) {
            Builder.Runner.forEach((e) => {
                e.kill();
            });
        }
    },
    Fork: function() {
        // Make sure a GMS2 project is open!
        if (Builder.ProjectVersion($gmedit["gml.Project"].current) != 2) return;

        // Fork runner and add it to process list!
        Builder.Runner.push(Builder.Spawn(Builder.Runtime, Builder.Outpath, Builder.Name));
    },
    Clean: function() {
        // Clean up anything from compile job!
        for (let item of Builder.MenuItems.list) item.enabled = item == Builder.MenuItems.run;
        if (Builder.Drive != "") Builder.RemoveDrive();
        Builder.Output.Write(`Compile Ended: ${Builder.GetTime(new Date())}`);
        Builder.Runner = [];
        Builder.Drive = "";
    },
    Parse: function(string, type) {
        // Parse error output!
        let Contents = (string.toString()).split("\n");
        for(let i = 0; i < Contents.length; i++) {
            let Message = Contents[i];
            switch (type) {
                case 0: { // GMAssetCompiler.exe
                    if (Message.slice(0, 8) == "Error : ") {
                        Builder.Errors.push(Message.slice(8).trim());
                        Builder.ErrorMet = true;
                    } else if (Message.startsWith("Final Compile") == true && Builder.ErrorMet == true) {
                        return 1;
                    }
                    break;
                }

                case 1: { // Runner.exe
                    if (Builder.Preferences.displayLine == true && (Message.startsWith("ERROR!!! :: ") == true && Contents[i + 1].startsWith("FATAL ERROR") == true)) {
                        for(let j = i + 1; j < Contents.length; j++) {
                            if (Contents[j].startsWith("stack frame is") == true) {
                                let Stack = Builder.ParseDescriptor(Contents[++j]);
                                if ($gmedit["ui.OpenDeclaration"].openLocal(Stack.Asset, Stack.Line) == true) {
                                    setTimeout(() => {
                                        let Offset = 0;
                                        if (Stack.Type == "Object") {
                                            for(let Event = Builder.GetEvent(Stack.Event), k = 0; k < aceEditor.session.getLength(); k++) {
                                                if (aceEditor.session.getLine(k).startsWith("#event " + Event) == true) {
                                                    Offset = ++k;
                                                    break;
                                                }
                                            }
                                        }
                                        aceEditor.gotoLine(Stack.Line + Offset);
                                    }, 10);
                                }
                                break;
                            }
                        }
                    }
                    break;
                }
            }
        }
        return 0;
    },
    ParseDescriptor: function(string) {
        // Parse error descriptor and return object about it!
        let Descriptor = {};
        if (string.startsWith("gml_")) string = string.slice(4);
        Descriptor.Type = string.slice(0, string.indexOf("_"));
        string = string.slice(Descriptor.Type.length + 1);
        Descriptor.Line = parseInt(string.slice(string.lastIndexOf("(") + 1, string.lastIndexOf(")")).replace("line", ""));
        string = string.slice(0, string.lastIndexOf("(")).trim();
        if (Descriptor.Type == "Object") {
            Descriptor.Event = string.slice(string.lastIndexOf("_", string.lastIndexOf("_") - 1) + 1);
            string = string.slice(0, (Descriptor.Event.length * -1) - 1);
        }
        Descriptor.Asset = string;
        return Descriptor;
    },
    GetEvent: function(event) {
        // Turn descriptor event into GMEdit event name! 
        let SubEvent = event.slice(event.lastIndexOf("_") + 1), GmlEvent = $gmedit["parsers.GmlEvent"];
        event = event.slice(0, event.lastIndexOf("_"));
        for(let i = 0; i < GmlEvent.t2sc.length; i++) {
            if (GmlEvent.t2sc[i] == event) {
                return GmlEvent.i2s[i][SubEvent];
            }
        }
        return "";
    },
    Display: function() {
        // Display errors in new tab!
        let project = $gmedit["gml.Project"].current;
        let GmlFile = $gmedit["gml.file.GmlFile"];
        let output = new GmlFile(`Compilation Errors`, null, $gmedit["file.kind.gml.KGmlSearchResults"].inst, `// Compile failed with ${Builder.Errors.length} error${(Builder.Errors.length == 1 ? "" : "s")}\n\n`); 
        output.Write = (e) => {output.editor.session.setValue(output.editor.session.getValue() + "\n" + e); }
        for (let error of Builder.Errors) {
            let colonPos = error.indexOf(":");
            let descriptor = Builder.ParseDescriptor(error.slice(0, colonPos).trim());
            let errorText = error.slice(colonPos + 1).trim();
            let errorLine = "";
            grabErrorLine: {
                let resourceGUID = project.yyResourceGUIDs[descriptor.Asset];
                if (resourceGUID == null) break grabErrorLine;
                let resource = project.yyResources[resourceGUID];
                if (resource == null) break grabErrorLine;
                let resourcePath;
                if (resource.Value) {
                    resourcePath = resource.Value.resourcePath;
                } else if (resource.id) {
                    resourcePath = resource.id.path;
                } else break grabErrorLine;
                let path = resourcePath.slice(0, -(3 + descriptor.Asset.length));
                switch (descriptor.Type) {
                    case "Object": path += descriptor.Event; break;
                    default: path += descriptor.Asset; break;
                }
                try {
                    errorLine = project.readTextFileSync(path + ".gml").split("\n")[descriptor.Line].trim();
                } catch (_) {}
            };
            output.Write(`// Error in ${descriptor.Type[0].toLowerCase() + descriptor.Type.slice(1)} at @[${descriptor.Asset}${(descriptor.Type == "Object" ? `(${Builder.GetEvent(descriptor.Event)})` : "")}:${descriptor.Line + 1}]:\n// ${errorText}\n${errorLine}\n`)
        }
        GmlFile.openTab(output);
    },
    Spawn: function(runtime, output, name) {
        // Spawn an instance of the runner!
        let RunnerPath = (Builder.Platform == "win"
            ? `${runtime}/windows/Runner.exe`
            : `${runtime}/mac/YoYo Runner.app/Contents/MacOS/Mac_Runner`
        );
        let Runner = Builder.Command.spawn(RunnerPath, ["-game", `${output}/${name}.${Builder.Extension}`].concat(Builder.Preferences.forkArguments.split(" ")));
        Runner.stdout.on("data", (e) => {
            switch (Builder.Parse(e, 1)) {
                default: Builder.Output.Write(e, false);
            }
        });
        Runner.addListener("close", function(code) {
            Builder.Runner.forEach((e, i) => {
                if (this == e) {
                    Builder.Runner[i] = undefined;
                }
            });
            Builder.Runner = Builder.Runner.filter(e => e != undefined);
            if (code != 0) Builder.Output.Write(`Runner exited with non-zero status (0x${code.toString(16)} = ${code})`)
            if (Builder.Runner.length == 0) Builder.Clean();
        });
        return Runner;
    },
    Sanitize: (value) => { return value.replace(/ /g, "_"); },
    Random: () => { return Math.round(Math.random() * 4294967295).toString(16).padStart(8, "0").toUpperCase(); },
    GetTime: (t) => { return `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}:${t.getSeconds().toString().padStart(2, "0")}` },
    RemoveDrive: () => { Builder.Output.Write(`Removing Virtual Drive: ${Builder.Drive}`); Builder.Command.execSync(`subst /d ${Builder.Drive}:`); window.localStorage["builder:drives"] = window.localStorage["builder:drives"].slice(0, window.localStorage["builder:drives"].indexOf(Builder.Drive)) + window.localStorage["builder:drives"].slice(window.localStorage["builder:drives"].indexOf(Builder.Drive) + 1); }
});
