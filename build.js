Builder.Random = function() {
    return Math.round(Math.random() * 4294967295).toString(16).padStart(8, "0").toUpperCase();
}

Builder.Running = false;
Builder.Drive = "";
Builder.Run = function() {
    // collect local settings
    let userpath = JSON.parse(Electron_FS.readFileSync(Electron_App.getPath("appData") + "\\GameMakerStudio2\\um.json")); userpath = Electron_App.getPath("appData") + "\\GameMakerStudio2\\" + userpath.login.slice(0, userpath.login.indexOf("@")) + "_" + userpath.userID;
    let usersettings = JSON.parse(Electron_FS.readFileSync(userpath + "\\local_settings.json"));
    let projectname = buildname = $gmedit["gml.Project"].current.name.slice(0, $gmedit["gml.Project"].current.name.indexOf(".yyp"));
    let temppath = usersettings["machine.General Settings.Paths.IDE.TempFolder"] + "GMS2TEMP";
    let runtimepath = Builder.Preferences.runtimeLocation + Builder.Preferences.runtimeSelection;

    // create output tab
    let t = new Date(), gmout = new $gmedit["gml.file.GmlFile"](`Output (${t.getHours()}:${t.getMinutes()}:${t.getSeconds()})`, null, $gmedit["file.kind.misc.KPlain"].inst, `Compile Started: ${t.getHours()}:${t.getMinutes()}:${t.getSeconds()}\n`);
    gmout.editor.session.setOption("readOnly", true);
    $gmedit["gml.file.GmlFile"].openTab(gmout);

    // create subst drive
    let cmd = require("child_process"), drives = cmd.execSync("wmic logicaldisk get caption").toString().replace("Caption", "").split(":").map(c => c.trim());
    while (Builder.Drive == "" || drives.includes(Builder.Drive) == true) {
        Builder.Drive = String.fromCharCode(65 + Math.round((Math.random() * 26)));
    }
    gmout.editor.session.setValue(gmout.editor.session.getValue() + `Using virtual drive letter: ${Builder.Drive}\n`);
    cmd.exec(`subst ${Builder.Drive}: ${temppath}`);
    temppath = Builder.Drive + "://";
    let outpath = temppath + projectname + "_" + Builder.Random();

    Builder.Running = true;
    // run compiler!
    let gmac = cmd.exec(`${runtimepath}\\bin\\GMAssetCompiler.exe /c /zpex /mv=1 /iv=0 /rv=0 /bv=0 /j=4 /gn="${projectname}" /td="${temppath}" /zpuf="${userpath}" /m=windows /tgt=64 /nodnd /cfg="${$gmedit["gml.Project"].current.config}" /o="${outpath}" /sh=True /cvm /baseproject="${runtimepath}\\BaseProject\\BaseProject.yyp" "${$gmedit["gml.Project"].current.path}" /v /bt=run`);
    // add compiler output
    gmac.stdout.on("data", (e) => {
        gmout.editor.session.setValue(gmout.editor.session.getValue() + e);
        if (document.querySelector(".chrome-tab-current").gmlFile == gmout) {
            aceEditor.gotoLine(aceEditor.session.getLength());
        }
    });
    
    gmac.addListener("close", function() {
        // finished compiling, now run!
        let gmrn = cmd.exec(`${runtimepath}\\windows\\Runner.exe -game "${outpath}/${projectname}.win"`);
        gmrn.addListener("close", function() {
            cmd.exec("subst /d " + Builder.Drive + ":");
            Builder.Running = false;
        });

        // add runner output
        gmrn.stdout.on("data", (e) => {
            gmout.editor.session.setValue(gmout.editor.session.getValue() + e);
            if (document.querySelector(".chrome-tab-current").gmlFile == gmout) {
                aceEditor.gotoLine(aceEditor.session.getLength());
            }
        });
    });
}