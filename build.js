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

    // create temp path if needed
    if (Electron_FS.existsSync(temppath) == false) {
        Electron_FS.mkdirSync(temppath);
    }

    // create output tab
    let t = new Date(), p = performance.now();
    gmout = new $gmedit["gml.file.GmlFile"](`Output (${t.getHours()}:${t.getMinutes()}:${t.getSeconds()})`, null, $gmedit["file.kind.misc.KPlain"].inst, `Compile Started: ${t.getHours()}:${t.getMinutes()}:${t.getSeconds()}\nUsing runtime: ${runtimepath}\n`);
    gmout.write = (e) => {
        gmout.editor.session.setValue(gmout.editor.session.getValue() + e);
        if (document.querySelector(".chrome-tab-current").gmlFile == gmout) aceEditor.gotoLine(aceEditor.session.getLength());
    }
    $gmedit["gml.file.GmlFile"].openTab(gmout);

    // make sure assetcompiler exists
    if (Electron_FS.existsSync(`${runtimepath}\\bin\\GMAssetCompiler.exe`) == false) {
        Electron_Dialog.showErrorBox("Failed to compile project.", "Could not find \"GMAssetCompiler.exe\" in " + runtimepath + "\\bin\\");
        gmout.write(`\n!!!\n   Could not compile project as "GMAssetCompiler.exe" could not be found in ${runtimepath}\\bin\\\n!!!\n\n`);
        return;
    }

    // create subst drive
    let cmd = require("child_process"), drives = cmd.execSync("wmic logicaldisk get caption").toString().replace("Caption", "").split(":").map(c => c.trim());
    while (Builder.Drive == "" || drives.includes(Builder.Drive) == true) {
        Builder.Drive = String.fromCharCode(65 + Math.round((Math.random() * 26)));
    }
    gmout.write(`Creating virtual drive: ${Builder.Drive}\n`);
    cmd.execSync(`subst ${Builder.Drive}: ${temppath}`);
    temppath = Builder.Drive + "://";
    let outpath = temppath + projectname + "_" + Builder.Random();

    Builder.Running = true;
    // run compiler!
    let gmac = cmd.exec(`${runtimepath}\\bin\\GMAssetCompiler.exe /c /zpex /mv=1 /iv=0 /rv=0 /bv=0 /j=4 /gn="${projectname}" /td="${temppath}" /zpuf="${userpath}" /m=windows /tgt=64 /nodnd /cfg="${$gmedit["gml.Project"].current.config}" /o="${outpath}" /sh=True /cvm /baseproject="${runtimepath}\\BaseProject\\BaseProject.yyp" "${$gmedit["gml.Project"].current.path}" /v /bt=run`);
    // add compiler output
    gmac.stdout.on("data", (e) => {
        gmout.write(e);
    });
    
    gmac.addListener("close", function() {
        // finished compiling, now run!
        gmout.write(`Compile completed in ${(performance.now() - p).toFixed(1)}ms\n`);
        // check if runner exists
        if (Electron_FS.existsSync(`${runtimepath}\\windows\\Runner.exe`) == false) {
            Electron_Dialog.showErrorBox("Failed to run game.", "Could not find \"Runner.exe\" in " + runtimepath + "\\windows\\");
            gmout.write(`\n!!!\n   Could not run project as "Runner.exe" could not be found in ${runtimepath}\\windows\\\n!!!\n\n`);
            gmout.write(`Removing virtual drive: ${Builder.Drive}\n`);
            cmd.exec("subst /d " + Builder.Drive + ":");
            return;
        }

        let gmrn = cmd.exec(`${runtimepath}\\windows\\Runner.exe -game "${outpath}/${projectname}.win"`);
        gmrn.addListener("close", function() {
            gmout.write(`Removing virtual drive: ${Builder.Drive}\n`);
            cmd.exec("subst /d " + Builder.Drive + ":");
            Builder.Running = false;
        });

        // add runner output
        gmrn.stdout.on("data", (e) => {
            gmout.write(e);
        });
    });
}